//! 语音录制命令

use tauri::{AppHandle, State};

use crate::services::voice_recorder::{self, VoiceRecorderState, VoiceRecordingResult};

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
