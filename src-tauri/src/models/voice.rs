use serde::Serialize;

/// 语音记录（对应 voice_records 表）
#[derive(Debug, Clone, Serialize)]
pub struct VoiceRecord {
    pub id: i64,
    pub audio_path: String,
    pub duration_seconds: i32,
    pub transcript: Option<String>,
    pub ai_summary: Option<String>,
    pub ai_todos: Option<String>,
    pub status: String,
    pub created_at: String,
}
