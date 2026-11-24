//! 选中文字一键 AI 处理（⌥⇧A）
//!
//! 1. 记住前台应用，等待用户松开快捷键修饰键，模拟 ⌘C 读取选中文字
//! 2. 立即恢复用户原剪贴板文本，弹出处理浮窗
//! 3. 用户确认替换时：写入结果 → 切回原应用 → 模拟 ⌘V → 再次恢复原剪贴板
//!
//! 整个过程暂停剪贴板历史记录，避免选中内容与 AI 结果污染历史。

use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::services::{clipboard_watcher, paste_back};

pub const WINDOW_LABEL: &str = "text-action";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SelectionStatus {
    /// 成功读取到选中文字
    Ok,
    /// 未检测到选中文字（前台应用未响应 ⌘C 或没有选区）
    Empty,
    /// 缺少辅助功能权限，无法模拟按键
    NeedsPermission,
}

#[derive(Debug, Clone, Serialize)]
pub struct SelectionSnapshot {
    pub status: SelectionStatus,
    pub text: String,
}

#[derive(Default)]
struct Session {
    selection: Option<SelectionSnapshot>,
    /// 呼出前用户剪贴板中的文本；非文本内容（图片等）无法恢复，记为 None
    original_clipboard: Option<String>,
}

static SESSION: Mutex<Option<Session>> = Mutex::new(None);
static CAPTURING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn with_session<T>(f: impl FnOnce(&mut Session) -> T) -> T {
    let mut guard = SESSION.lock().unwrap_or_else(|e| e.into_inner());
    f(guard.get_or_insert_with(Session::default))
}

fn read_clipboard_text() -> Option<String> {
    arboard::Clipboard::new().ok()?.get_text().ok()
}

fn write_clipboard_text(text: &str) -> Result<(), String> {
    arboard::Clipboard::new()
        .and_then(|mut c| c.set_text(text.to_string()))
        .map_err(|e| format!("写入剪贴板失败: {e}"))
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        log::warn!("text-action window not found");
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use std::time::{Duration, Instant};

    use objc2_app_kit::NSPasteboard;

    /// kCGEventSourceStateHIDSystemState
    const HID_SYSTEM_STATE: i32 = 1;
    /// Shift | Control | Option | Command
    const MODIFIER_MASK: u64 = 0x0002_0000 | 0x0004_0000 | 0x0008_0000 | 0x0010_0000;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceFlagsState(state_id: i32) -> u64;
    }

    pub fn change_count() -> isize {
        NSPasteboard::generalPasteboard().changeCount()
    }

    /// 等待用户松开快捷键的修饰键，避免 ⌘C 与 ⌥⇧ 叠加成其他组合键
    pub fn wait_modifiers_released(timeout: Duration) {
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if unsafe { CGEventSourceFlagsState(HID_SYSTEM_STATE) } & MODIFIER_MASK == 0 {
                return;
            }
            std::thread::sleep(Duration::from_millis(15));
        }
    }

    /// 轮询剪贴板 changeCount，判断前台应用是否响应了 ⌘C
    pub fn wait_change(from: isize, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if change_count() != from {
                return true;
            }
            std::thread::sleep(Duration::from_millis(15));
        }
        false
    }
}

#[cfg(target_os = "macos")]
fn capture_selection() -> SelectionSnapshot {
    if !paste_back::is_accessibility_trusted() {
        paste_back::prompt_accessibility_once();
        return SelectionSnapshot { status: SelectionStatus::NeedsPermission, text: String::new() };
    }

    clipboard_watcher::suppress_for(Duration::from_secs(4));
    mac::wait_modifiers_released(Duration::from_millis(1200));

    let original = read_clipboard_text();
    let before = mac::change_count();
    if paste_back::post_cmd_key(paste_back::KEY_C).is_err() {
        return SelectionSnapshot { status: SelectionStatus::Empty, text: String::new() };
    }
    let copied = mac::wait_change(before, Duration::from_millis(600));
    // changeCount 变化后内容写入可能稍有延迟
    let text = if copied {
        std::thread::sleep(Duration::from_millis(30));
        read_clipboard_text().unwrap_or_default()
    } else {
        String::new()
    };

    if copied {
        if let Some(orig) = &original {
            let _ = write_clipboard_text(orig);
        }
        clipboard_watcher::suppress_for(Duration::from_millis(2500));
    }
    with_session(|s| s.original_clipboard = original);

    if text.trim().is_empty() {
        SelectionSnapshot { status: SelectionStatus::Empty, text: String::new() }
    } else {
        SelectionSnapshot { status: SelectionStatus::Ok, text }
    }
}

#[cfg(not(target_os = "macos"))]
fn capture_selection() -> SelectionSnapshot {
    SelectionSnapshot { status: SelectionStatus::Empty, text: String::new() }
}

/// 全局快捷键入口：在后台线程读取选区，完成后弹出浮窗（不阻塞主线程）
pub fn trigger(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            paste_back::activate_previous_app();
            return;
        }
    }
    if CAPTURING.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return;
    }
    paste_back::remember_frontmost_app();
    let app = app.clone();
    std::thread::spawn(move || {
        let snapshot = capture_selection();
        with_session(|s| s.selection = Some(snapshot));
        CAPTURING.store(false, std::sync::atomic::Ordering::SeqCst);
        show_window(&app);
    });
}

pub fn current_selection() -> SelectionSnapshot {
    with_session(|s| s.selection.clone()).unwrap_or(SelectionSnapshot {
        status: SelectionStatus::Empty,
        text: String::new(),
    })
}

pub fn hide(app: &AppHandle, restore_focus: bool) {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.hide();
    }
    if restore_focus {
        paste_back::activate_previous_app();
    }
}

/// 用结果替换原选区；缺少权限时返回 needs_permission（结果已留在剪贴板）
pub fn apply(app: &AppHandle, text: &str) -> Result<&'static str, String> {
    clipboard_watcher::suppress_for(Duration::from_secs(3));
    write_clipboard_text(text)?;
    hide(app, false);
    let outcome = paste_back::paste_into_previous_app();
    if outcome == paste_back::PasteOutcome::Pasted {
        // 等 ⌘V 被目标应用消费后再恢复用户原剪贴板
        let original = with_session(|s| s.original_clipboard.take());
        if let Some(orig) = original {
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(600));
                let _ = write_clipboard_text(&orig);
                clipboard_watcher::suppress_for(Duration::from_millis(2500));
            });
        }
    }
    Ok(outcome.as_str())
}
