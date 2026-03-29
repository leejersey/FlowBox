use serde::Serialize;

/// 应用使用时长（对应 app_usage 表）
#[derive(Debug, Clone, Serialize)]
pub struct AppUsage {
    pub id: i64,
    pub app_name: String,
    pub app_bundle_id: Option<String>,
    pub window_title: Option<String>,
    pub duration_seconds: i32,
    pub recorded_date: String,
    pub hour: i32,
}
