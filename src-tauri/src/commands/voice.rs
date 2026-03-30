//! 语音录制命令

use tauri::{AppHandle, State};

use crate::services::{
    voice_recorder::{self, VoiceRecorderState, VoiceRecordingResult},
    voice_transcribe,
};

#[tauri::command]
pub fn voice_start_recording(
    app: AppHandle,
    state: State<'_, VoiceRecorderState>,
) -> Result<(), String> {
    voice_recorder::start_recording(&app, state.inner())
}

#[tauri::command]
pub fn voice_stop_recording(
    state: State<'_, VoiceRecorderState>,
) -> Result<VoiceRecordingResult, String> {
    voice_recorder::stop_recording(state.inner())
}

#[tauri::command]
pub fn voice_transcribe_audio(
    audio_source: String,
    ai_provider: Option<String>,
    openai_api_key: Option<String>,
    volc_app_id: Option<String>,
    volc_token: Option<String>,
) -> Result<String, String> {
    voice_transcribe::transcribe_audio(
        &audio_source,
        ai_provider.as_deref(),
        openai_api_key.as_deref(),
        volc_app_id.as_deref(),
        volc_token.as_deref(),
    )
}
