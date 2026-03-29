use serde::Serialize;

/// 灵感速记（对应 ideas 表）
#[derive(Debug, Clone, Serialize)]
pub struct Idea {
    pub id: i64,
    pub content: String,
    pub tags: String,
    pub source: String,
    pub is_archived: i32,
    pub created_at: String,
}
