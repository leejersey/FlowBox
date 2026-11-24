//! 全局浮窗焦点归还：记住呼出浮窗前的前台应用，关闭时切回该应用；剪贴板快选还会模拟 ⌘V 回填
//!
//! 模拟按键需要 macOS「辅助功能」权限；未授权时仅写入剪贴板，并弹出一次系统授权引导。

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PasteOutcome {
    /// 已切回原应用并发送 ⌘V
    Pasted,
    /// 缺少辅助功能权限，仅写入了剪贴板
    NeedsPermission,
}

impl PasteOutcome {
    pub fn as_str(self) -> &'static str {
        match self {
            PasteOutcome::Pasted => "pasted",
            PasteOutcome::NeedsPermission => "needs_permission",
        }
    }
}

#[cfg(target_os = "macos")]
mod imp {
    use super::PasteOutcome;
    use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
    use std::time::Duration;

    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
    use core_foundation::string::CFString;
    use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication, NSWorkspace};

    /// kVK_ANSI_V
    pub const KEY_V: u16 = 9;
    /// kVK_ANSI_C
    pub const KEY_C: u16 = 8;
    /// 切回原应用后等待其成为 key window 再发送按键
    const ACTIVATE_DELAY: Duration = Duration::from_millis(120);

    static PREVIOUS_APP_PID: AtomicI32 = AtomicI32::new(-1);
    static PERMISSION_PROMPTED: AtomicBool = AtomicBool::new(false);

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
        fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> bool;
    }

    pub fn remember_frontmost_app() {
        let own_pid = std::process::id() as i32;
        let pid = NSWorkspace::sharedWorkspace()
            .frontmostApplication()
            .map(|app| app.processIdentifier())
            .filter(|pid| *pid > 0 && *pid != own_pid)
            .unwrap_or(-1);
        PREVIOUS_APP_PID.store(pid, Ordering::SeqCst);
    }

    pub fn is_accessibility_trusted() -> bool {
        unsafe { AXIsProcessTrusted() }
    }

    pub fn prompt_accessibility_once() {
        if PERMISSION_PROMPTED.swap(true, Ordering::SeqCst) {
            return;
        }
        let options = CFDictionary::from_CFType_pairs(&[(
            CFString::new("AXTrustedCheckOptionPrompt"),
            CFBoolean::true_value(),
        )]);
        unsafe {
            AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef());
        }
    }

    /// 发送 ⌘+指定按键（需要辅助功能权限）
    pub fn post_cmd_key(key: u16) -> Result<(), ()> {
        let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)?;
        let down = CGEvent::new_keyboard_event(source.clone(), key, true)?;
        let up = CGEvent::new_keyboard_event(source, key, false)?;
        down.set_flags(CGEventFlags::CGEventFlagCommand);
        up.set_flags(CGEventFlags::CGEventFlagCommand);
        down.post(CGEventTapLocation::HID);
        up.post(CGEventTapLocation::HID);
        Ok(())
    }

    /// 把焦点还给呼出浮窗前的应用（无需辅助功能权限）
    pub fn activate_previous_app() {
        let pid = PREVIOUS_APP_PID.swap(-1, Ordering::SeqCst);
        if pid > 0 {
            if let Some(app) = NSRunningApplication::runningApplicationWithProcessIdentifier(pid) {
                app.activateWithOptions(NSApplicationActivationOptions::empty());
            }
        }
    }

    pub fn paste_into_previous_app() -> PasteOutcome {
        if !is_accessibility_trusted() {
            prompt_accessibility_once();
            return PasteOutcome::NeedsPermission;
        }

        activate_previous_app();

        // 不阻塞主线程：等待目标应用激活后再发送 ⌘V
        std::thread::spawn(|| {
            std::thread::sleep(ACTIVATE_DELAY);
            if post_cmd_key(KEY_V).is_err() {
                log::warn!("failed to post Cmd+V event for clipboard picker");
            }
        });
        PasteOutcome::Pasted
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    use super::PasteOutcome;

    pub fn remember_frontmost_app() {}

    pub fn activate_previous_app() {}

    pub fn paste_into_previous_app() -> PasteOutcome {
        PasteOutcome::NeedsPermission
    }
}

pub use imp::{activate_previous_app, paste_into_previous_app, remember_frontmost_app};
#[cfg(target_os = "macos")]
pub use imp::{is_accessibility_trusted, post_cmd_key, prompt_accessibility_once, KEY_C, KEY_V};
