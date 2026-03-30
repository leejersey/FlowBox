use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::blocking::{multipart, Client};
use serde_json::{json, Value};

struct AudioPayload {
    bytes: Vec<u8>,
    file_name: String,
    mime_type: String,
}

pub fn transcribe_audio(
    audio_source: &str,
    ai_provider: Option<&str>,
    openai_api_key: Option<&str>,
    volc_app_id: Option<&str>,
    volc_token: Option<&str>,
) -> Result<String, String> {
    let audio = load_audio_payload(audio_source)?;

    if let (Some(app_id), Some(token)) = (
        normalize_non_empty(volc_app_id),
        normalize_non_empty(volc_token),
    ) {
        return transcribe_with_volcengine(&audio, app_id, token);
    }

    if matches!(normalize_non_empty(ai_provider), Some("openai")) {
        if let Some(api_key) = normalize_non_empty(openai_api_key) {
            return transcribe_with_openai(&audio, api_key);
        }
    }

    Err("请先在设置 → 语音识别中配置火山引擎 ASR AppID 和 Access Token，或切换到 OpenAI 并填写 API Key。".to_string())
}

fn normalize_non_empty(value: Option<&str>) -> Option<&str> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn load_audio_payload(audio_source: &str) -> Result<AudioPayload, String> {
    if audio_source.starts_with("data:") {
        return parse_data_url_audio(audio_source);
    }

    let path_str = audio_source.strip_prefix("file://").unwrap_or(audio_source);
    let bytes = fs::read(path_str).map_err(|err| format!("无法读取录音文件: {err}"))?;
    let path = Path::new(path_str);
    let format = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .unwrap_or_else(|| "wav".to_string());
    let mime_type = mime_type_from_format(&format).to_string();
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .unwrap_or_else(|| format!("recording.{format}"));

    Ok(AudioPayload {
        bytes,
        file_name,
        mime_type,
    })
}

fn parse_data_url_audio(data_url: &str) -> Result<AudioPayload, String> {
    let (header, base64_data) = data_url
        .split_once(',')
        .ok_or_else(|| "录音数据格式无效。".to_string())?;
    let mime_type = header
        .strip_prefix("data:")
        .and_then(|rest| rest.split(';').next())
        .unwrap_or("audio/wav")
        .to_string();
    let bytes = BASE64
        .decode(base64_data)
        .map_err(|err| format!("录音数据解码失败: {err}"))?;
    let format = format_from_mime_type(&mime_type).to_string();

    Ok(AudioPayload {
        bytes,
        file_name: format!("recording.{format}"),
        mime_type,
    })
}

fn format_from_mime_type(mime_type: &str) -> &'static str {
    match mime_type {
        "audio/webm" => "webm",
        "audio/mp3" | "audio/mpeg" => "mp3",
        "audio/ogg" => "ogg",
        "audio/mp4" | "audio/m4a" | "audio/x-m4a" => "m4a",
        "audio/aac" => "aac",
        _ => "wav",
    }
}

fn mime_type_from_format(format: &str) -> &'static str {
    match format {
        "webm" => "audio/webm",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "m4a" => "audio/m4a",
        "aac" => "audio/aac",
        _ => "audio/wav",
    }
}

fn transcribe_with_volcengine(
    audio: &AudioPayload,
    app_id: &str,
    token: &str,
) -> Result<String, String> {
    let client = Client::new();
    let request_id = build_request_id();
    let resp = client
        .post("https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash")
        .header("Content-Type", "application/json")
        .header("X-Api-App-Key", app_id)
        .header("X-Api-Access-Key", token)
        .header("X-Api-Resource-Id", "volc.bigasr.auc_turbo")
        .header("X-Api-Request-Id", &request_id)
        .header("X-Api-Sequence", "1")
        .json(&json!({
            "audio": {
                "data": BASE64.encode(&audio.bytes),
            },
            "request": {
                "model_name": "bigmodel",
                "language": "zh-CN",
                "show_utterances": false,
            },
            "user": {
                "uid": app_id,
            }
        }))
        .send()
        .map_err(|err| format!("火山引擎 ASR 请求失败: {err}"))?;

    let status = resp.status();
    let body = resp
        .text()
        .map_err(|err| format!("火山引擎 ASR 响应读取失败: {err}"))?;
    if !status.is_success() {
        return Err(format!("火山引擎 ASR 错误 ({status}): {body}"));
    }

    let data: Value =
        serde_json::from_str(&body).map_err(|err| format!("火山引擎 ASR 响应解析失败: {err}"))?;
    let code = data
        .get("code")
        .and_then(Value::as_i64)
        .or_else(|| data.get("resp_code").and_then(Value::as_i64));
    if let Some(code) = code {
        if code != 0 && code != 1000 {
            let message = data
                .get("message")
                .and_then(Value::as_str)
                .or_else(|| data.get("resp_message").and_then(Value::as_str))
                .unwrap_or("未知错误");
            return Err(format!("火山引擎 ASR 识别失败 (code={code}): {message}"));
        }
    }

    let text = data
        .pointer("/result/text")
        .and_then(Value::as_str)
        .or_else(|| data.pointer("/audio_info/text").and_then(Value::as_str))
        .or_else(|| data.get("text").and_then(Value::as_str))
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .ok_or_else(|| "火山引擎 ASR 未返回识别文本，请检查录音格式。".to_string())?;

    Ok(text.to_string())
}

fn build_request_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("flowbox-{}-{}", std::process::id(), millis)
}

fn transcribe_with_openai(audio: &AudioPayload, api_key: &str) -> Result<String, String> {
    let client = Client::new();
    let part = multipart::Part::bytes(audio.bytes.clone())
        .file_name(audio.file_name.clone())
        .mime_str(&audio.mime_type)
        .map_err(|err| format!("无法构造 Whisper 音频文件: {err}"))?;
    let form = multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-1")
        .text("language", "zh");

    let resp = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .map_err(|err| format!("Whisper 请求失败: {err}"))?;

    let status = resp.status();
    let body = resp
        .text()
        .map_err(|err| format!("Whisper 响应读取失败: {err}"))?;
    if !status.is_success() {
        return Err(format!("Whisper API 错误 ({status}): {body}"));
    }

    let data: Value =
        serde_json::from_str(&body).map_err(|err| format!("Whisper 响应解析失败: {err}"))?;
    let text = data
        .get("text")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .ok_or_else(|| "Whisper 未返回识别文本。".to_string())?;

    Ok(text.to_string())
}
