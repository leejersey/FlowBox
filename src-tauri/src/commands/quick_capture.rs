//! 全局快速记录浮窗（⌥⇧Space）相关的 Tauri Commands

use tauri::{AppHandle, Manager};

use crate::services::paste_back;

const WINDOW_LABEL: &str = "quick-capture";

/// 切换快速记录浮窗
#[tauri::command]
pub fn toggle_quick_capture(app: AppHandle) {
    let Some(window) = app.get_webview_window(WINDOW_LABEL) else {
        log::warn!("quick-capture window not found");
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        paste_back::activate_previous_app();
    } else {
        paste_back::remember_frontmost_app();
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// 隐藏快速记录浮窗；`restore_focus` 为 true 时切回呼出前的应用
///
/// 失焦自动收起时应传 false，避免抢走用户刚点击的应用焦点
#[tauri::command]
pub fn hide_quick_capture(app: AppHandle, restore_focus: bool) {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.hide();
    }
    if restore_focus {
        paste_back::activate_previous_app();
    }
}
