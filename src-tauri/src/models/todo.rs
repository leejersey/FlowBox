use serde::Serialize;

/// 待办事项（对应 todos 表）
#[derive(Debug, Clone, Serialize)]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub priority: i32,
    pub status: String,
    pub source: String,
    pub source_id: Option<i64>,
    pub due_date: Option<String>,
    pub tags: String,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}
