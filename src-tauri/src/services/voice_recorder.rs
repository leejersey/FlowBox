use std::{
    fs::{self, File},
    io::BufWriter,
    path::PathBuf,
    sync::{
        mpsc::{self, Receiver, SyncSender},
        Arc, Mutex,
    },
    thread,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    FromSample, Sample, SampleFormat, SizedSample, Stream, StreamConfig,
};
use hound::{SampleFormat as WavSampleFormat, WavSpec, WavWriter};
use serde::Serialize;
use tauri::{AppHandle, Manager};

pub struct VoiceRecorderState {
    command_tx: Mutex<mpsc::Sender<VoiceRecorderCommand>>,
}

struct ActiveRecording {
    stream: Stream,
    writer: Arc<Mutex<Option<WavWriter<BufWriter<File>>>>>,
    output_path: PathBuf,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceRecordingResult {
    pub data_url: String,
}

pub fn start_recording(app: &AppHandle, state: &VoiceRecorderState) -> Result<(), String> {
    let (reply_tx, reply_rx) = mpsc::sync_channel(1);
    let command_tx = state
        .command_tx
        .lock()
        .map_err(|_| "录音命令通道锁定失败。".to_string())?;

    command_tx
        .send(VoiceRecorderCommand::Start {
            app: app.clone(),
            reply: reply_tx,
        })
        .map_err(|_| "录音线程不可用。".to_string())?;

    reply_rx
        .recv()
        .map_err(|_| "录音线程未返回启动结果。".to_string())?
}

pub fn stop_recording(state: &VoiceRecorderState) -> Result<VoiceRecordingResult, String> {
    let (reply_tx, reply_rx) = mpsc::sync_channel(1);
    let command_tx = state
        .command_tx
        .lock()
        .map_err(|_| "录音命令通道锁定失败。".to_string())?;

    command_tx
        .send(VoiceRecorderCommand::Stop { reply: reply_tx })
        .map_err(|_| "录音线程不可用。".to_string())?;

    reply_rx
        .recv()
        .map_err(|_| "录音线程未返回停止结果。".to_string())?
}

impl Default for VoiceRecorderState {
    fn default() -> Self {
        let (command_tx, command_rx) = mpsc::channel();
        thread::spawn(move || run_voice_recorder(command_rx));

        Self {
            command_tx: Mutex::new(command_tx),
        }
    }
}

enum VoiceRecorderCommand {
    Start {
        app: AppHandle,
        reply: SyncSender<Result<(), String>>,
    },
    Stop {
        reply: SyncSender<Result<VoiceRecordingResult, String>>,
    },
}

fn run_voice_recorder(command_rx: Receiver<VoiceRecorderCommand>) {
    let mut active: Option<ActiveRecording> = None;

    while let Ok(command) = command_rx.recv() {
        match command {
            VoiceRecorderCommand::Start { app, reply } => {
                let _ = reply.send(start_recording_inner(&app, &mut active));
            }
            VoiceRecorderCommand::Stop { reply } => {
                let _ = reply.send(stop_recording_inner(&mut active));
            }
        }
    }
}

fn start_recording_inner(app: &AppHandle, active: &mut Option<ActiveRecording>) -> Result<(), String> {
    if active.is_some() {
        return Err("当前已有录音任务在进行中。".to_string());
    }

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "未检测到可用麦克风设备。".to_string())?;
    let supported_config = device
        .default_input_config()
        .map_err(|err| format!("无法读取默认麦克风配置: {err}"))?;
    let stream_config: StreamConfig = supported_config.config();
    let output_path = prepare_output_path(app)?;

    let file = File::create(&output_path)
        .map_err(|err| format!("无法创建录音文件: {err}"))?;
    let writer = WavWriter::new(
        BufWriter::new(file),
        WavSpec {
            channels: stream_config.channels,
            sample_rate: stream_config.sample_rate.0,
            bits_per_sample: 16,
            sample_format: WavSampleFormat::Int,
        },
    )
    .map_err(|err| format!("无法初始化录音写入器: {err}"))?;

    let writer = Arc::new(Mutex::new(Some(writer)));
    let stream = build_input_stream(
        &device,
        &stream_config,
        supported_config.sample_format(),
        Arc::clone(&writer),
    )?;

    stream
        .play()
        .map_err(|err| format!("无法启动麦克风录音: {err}"))?;

    *active = Some(ActiveRecording {
        stream,
        writer,
        output_path,
    });

    Ok(())
}

fn stop_recording_inner(active: &mut Option<ActiveRecording>) -> Result<VoiceRecordingResult, String> {
    let active = active
        .take()
        .ok_or_else(|| "当前没有正在进行的录音。".to_string())?;

    drop(active.stream);

    let writer = active
        .writer
        .lock()
        .map_err(|_| "录音写入器锁定失败。".to_string())?
        .take()
        .ok_or_else(|| "录音写入器已丢失。".to_string())?;

    writer
        .finalize()
        .map_err(|err| format!("无法完成录音文件写入: {err}"))?;

    let audio_bytes = fs::read(&active.output_path)
        .map_err(|err| format!("无法读取录音文件: {err}"))?;
    let _ = fs::remove_file(&active.output_path);

    Ok(VoiceRecordingResult {
        data_url: format!("data:audio/wav;base64,{}", BASE64.encode(audio_bytes)),
    })
}

fn prepare_output_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("无法定位应用数据目录: {err}"))?;
    let voice_dir = app_data_dir.join("voice_records");
    fs::create_dir_all(&voice_dir).map_err(|err| format!("无法创建录音目录: {err}"))?;

    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("无法生成录音文件名: {err}"))?
        .as_millis();

    Ok(voice_dir.join(format!("recording-{millis}.wav")))
}

fn build_input_stream(
    device: &cpal::Device,
    config: &StreamConfig,
    sample_format: SampleFormat,
    writer: Arc<Mutex<Option<WavWriter<BufWriter<File>>>>>,
) -> Result<Stream, String> {
    let err_fn = |err| {
        log::error!("voice recorder stream error: {err}");
    };

    match sample_format {
        SampleFormat::F32 => build_typed_input_stream::<f32>(device, config, writer, err_fn),
        SampleFormat::I16 => build_typed_input_stream::<i16>(device, config, writer, err_fn),
        SampleFormat::U16 => build_typed_input_stream::<u16>(device, config, writer, err_fn),
        _ => Err("当前麦克风采样格式暂不支持。".to_string()),
    }
}

fn build_typed_input_stream<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    writer: Arc<Mutex<Option<WavWriter<BufWriter<File>>>>>,
    err_fn: impl FnMut(cpal::StreamError) + Send + 'static,
) -> Result<Stream, String>
where
    T: Sample + SizedSample,
    i16: FromSample<T>,
{
    device
        .build_input_stream(
            config,
            move |data: &[T], _| write_input_data::<T>(data, &writer),
            err_fn,
            None,
        )
        .map_err(|err| format!("无法创建麦克风输入流: {err}"))
}

fn write_input_data<T>(input: &[T], writer: &Arc<Mutex<Option<WavWriter<BufWriter<File>>>>>)
where
    T: Sample,
    i16: FromSample<T>,
{
    let Ok(mut guard) = writer.lock() else {
        log::error!("voice recorder writer lock poisoned");
        return;
    };

    let Some(writer) = guard.as_mut() else {
        return;
    };

    for sample in input {
        let pcm: i16 = sample.to_sample::<i16>();
        if let Err(err) = writer.write_sample(pcm) {
            log::error!("voice recorder write sample failed: {err}");
            break;
        }
    }
}
