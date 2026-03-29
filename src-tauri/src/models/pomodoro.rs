use serde::Serialize;

/// 番茄钟记录（对应 pomodoro_sessions 表）
#[derive(Debug, Clone, Serialize)]
pub struct PomodoroSession {
    pub id: i64,
    pub r#type: String,
    pub duration_minutes: i32,
    pub actual_minutes: Option<i32>,
    pub status: String,
    pub related_todo_id: Option<i64>,
    pub ai_summary: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
}
