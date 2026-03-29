use std::sync::Mutex;

use tauri::{AppHandle, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub const DEFAULT_BUTLER_SHORTCUT: &str = "Shift+Space";

pub struct ButlerShortcutState {
    current: Mutex<String>,
}

impl Default for ButlerShortcutState {
    fn default() -> Self {
        Self {
            current: Mutex::new(DEFAULT_BUTLER_SHORTCUT.to_string()),
        }
    }
}

impl ButlerShortcutState {
    pub fn current(&self) -> Result<String, String> {
        self.current
            .lock()
            .map(|value| value.clone())
            .map_err(|_| "Butler 快捷键状态锁定失败。".to_string())
    }
}

pub fn register_initial_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    state: &ButlerShortcutState,
) -> Result<(), String> {
    let shortcut = state.current()?;
    register_shortcut(app, state, &shortcut).map(|_| ())
}

pub fn set_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    state: &ButlerShortcutState,
    shortcut: &str,
) -> Result<String, String> {
    register_shortcut(app, state, shortcut)
}

pub fn matches_current_shortcut(
    state: &ButlerShortcutState,
    shortcut: &Shortcut,
) -> bool {
    state
        .current()
        .ok()
        .and_then(|value| value.parse::<Shortcut>().ok())
        .is_some_and(|current| current == *shortcut)
}

fn register_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    state: &ButlerShortcutState,
    shortcut: &str,
) -> Result<String, String> {
    let normalized = shortcut.trim();
    if normalized.is_empty() {
        return Err("Butler 快捷键不能为空。".to_string());
    }

    let next_shortcut = normalized
        .parse::<Shortcut>()
        .map_err(|err| format!("Butler 快捷键格式无效: {err}"))?;

    let mut current = state
        .current
        .lock()
        .map_err(|_| "Butler 快捷键状态锁定失败。".to_string())?;

    if *current == normalized {
        if !app.global_shortcut().is_registered(next_shortcut) {
            app.global_shortcut()
                .register(next_shortcut)
                .map_err(|err| format!("无法注册 Butler 快捷键: {err}"))?;
        }
        return Ok(current.clone());
    }

    if let Ok(previous_shortcut) = current.parse::<Shortcut>() {
        if app.global_shortcut().is_registered(previous_shortcut) {
            app.global_shortcut()
                .unregister(previous_shortcut)
                .map_err(|err| format!("无法卸载旧的 Butler 快捷键: {err}"))?;
        }
    }

    app.global_shortcut()
        .register(next_shortcut)
        .map_err(|err| format!("无法注册 Butler 快捷键: {err}"))?;

    *current = normalized.to_string();
    Ok(current.clone())
}
