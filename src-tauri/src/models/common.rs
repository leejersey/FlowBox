use serde::Serialize;

/// 标签（对应 tags 表）
#[derive(Debug, Clone, Serialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub created_at: String,
}

/// 用户设置（对应 settings 表）
#[derive(Debug, Clone, Serialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}
