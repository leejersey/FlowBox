//! 应用使用追踪命令

use crate::services::app_usage_tracker;

/// 设置追踪开关
#[tauri::command]
pub fn app_usage_set_tracking(enabled: bool) {
    app_usage_tracker::set_tracking(enabled);
}

/// 查询追踪状态
#[tauri::command]
pub fn app_usage_is_tracking() -> bool {
    app_usage_tracker::is_tracking()
}
