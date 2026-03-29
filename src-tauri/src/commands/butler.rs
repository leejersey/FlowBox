//! AI Butler 窗口控制命令

use tauri::{AppHandle, Manager, State};

use crate::services::butler_shortcut::ButlerShortcutState;

/// 切换 Butler 窗口的可见性
#[tauri::command]
pub fn toggle_butler(app: AppHandle) {
    if let Some(window) = app.get_webview_window("butler") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.center();
        }
    } else {
        log::warn!("butler window not found");
    }
}

/// 隐藏 Butler 窗口（供前端 ESC 键调用）
#[tauri::command]
pub fn hide_butler(app: AppHandle) {
    if let Some(window) = app.get_webview_window("butler") {
        let _ = window.hide();
    }
}

/// 显示 Butler 窗口
#[tauri::command]
pub fn show_butler(app: AppHandle) {
    if let Some(window) = app.get_webview_window("butler") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.center();
    }
}

/// 更新 Butler 全局快捷键
#[tauri::command]
pub fn butler_set_shortcut(
    app: AppHandle,
    state: State<'_, ButlerShortcutState>,
    shortcut: String,
) -> Result<String, String> {
    crate::services::butler_shortcut::set_shortcut(&app, state.inner(), &shortcut)
}
