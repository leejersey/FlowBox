//! 剪贴板相关的 Tauri Commands

use tauri::{AppHandle, Manager};

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

/// 切换全局剪贴板快选浮窗（⇧⌘V）
#[tauri::command]
pub fn toggle_clipboard_picker(app: AppHandle) {
    if let Some(window) = app.get_webview_window("clipboard-picker") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.center();
        }
    } else {
        log::warn!("clipboard-picker window not found");
    }
}

/// 隐藏全局剪贴板快选浮窗
#[tauri::command]
pub fn hide_clipboard_picker(app: AppHandle) {
    if let Some(window) = app.get_webview_window("clipboard-picker") {
        let _ = window.hide();
    }
}

/// 写回文本到系统剪贴板（用于快选浮窗回车一键回填）
#[tauri::command]
pub fn clipboard_write_text(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("无法访问系统剪贴板: {e}"))?;
    clipboard
        .set_text(text)
        .map_err(|e| format!("写入剪贴板失败: {e}"))
}
