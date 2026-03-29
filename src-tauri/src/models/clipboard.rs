use serde::Serialize;

/// 剪贴板历史（对应 clipboard_items 表）
#[derive(Debug, Clone, Serialize)]
pub struct ClipboardItem {
    pub id: i64,
    pub content_type: String,
    pub text_content: Option<String>,
    pub image_path: Option<String>,
    pub ocr_text: Option<String>,
    pub category: Option<String>,
    pub tags: String,
    pub is_pinned: i32,
    pub content_hash: String,
    pub created_at: String,
}
