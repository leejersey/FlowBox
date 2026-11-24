//! 选中文字一键 AI 处理（⌥⇧A）相关的 Tauri Commands

use tauri::AppHandle;

use crate::services::text_action::{self, SelectionSnapshot};

/// 浮窗获得焦点时读取本次捕获的选中文字
#[tauri::command]
pub fn text_action_get_selection() -> SelectionSnapshot {
    text_action::current_selection()
}

/// 用 AI 结果替换原应用中的选中文字；返回 "pasted" 或 "needs_permission"
#[tauri::command]
pub fn text_action_apply(app: AppHandle, text: String) -> Result<String, String> {
    text_action::apply(&app, &text).map(String::from)
}

/// 关闭浮窗；`restore_focus` 为 false 用于失焦自动收起
#[tauri::command]
pub fn text_action_hide(app: AppHandle, restore_focus: bool) {
    text_action::hide(&app, restore_focus);
}
