//! 剪贴板相关的 Tauri Commands

use crate::services::clipboard_watcher;

/// 设置剪贴板监听开关
#[tauri::command]
pub fn clipboard_set_watch(enabled: bool) {
    clipboard_watcher::set_watcher_enabled(enabled);
}

/// 查询当前监听状态
#[tauri::command]
pub fn clipboard_is_watching() -> bool {
    clipboard_watcher::is_watcher_enabled()
}
