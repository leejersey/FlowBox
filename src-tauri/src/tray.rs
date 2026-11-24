//! macOS 顶部菜单栏常驻托盘与实时番茄倒计时标题

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub const TRAY_ID: &str = "flowbox-tray";
const MENU_SHOW_MAIN: &str = "tray-show-main";
const MENU_TOGGLE_BUTLER: &str = "tray-toggle-butler";
const MENU_TOGGLE_CLIPBOARD: &str = "tray-toggle-clipboard";
const MENU_QUICK_CAPTURE: &str = "tray-quick-capture";
const MENU_TEXT_ACTION: &str = "tray-text-action";
const MENU_QUIT: &str = "tray-quit";

pub fn install(app: &tauri::App) -> tauri::Result<()> {
    let show_main = MenuItem::with_id(app, MENU_SHOW_MAIN, "打开 FlowBox", true, None::<&str>)?;
    let toggle_butler = MenuItem::with_id(
        app,
        MENU_TOGGLE_BUTLER,
        "呼出 AI Butler (Shift+Space)",
        true,
        None::<&str>,
    )?;
    let toggle_clipboard = MenuItem::with_id(
        app,
        MENU_TOGGLE_CLIPBOARD,
        "剪贴板快选 (⇧⌘V)",
        true,
        None::<&str>,
    )?;
    let quick_capture = MenuItem::with_id(
        app,
        MENU_QUICK_CAPTURE,
        "快速记录灵感 / 待办 (⌥⇧Space)",
        true,
        None::<&str>,
    )?;
    let text_action = MenuItem::with_id(
        app,
        MENU_TEXT_ACTION,
        "AI 处理选中文字 (⌥⇧A)",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "退出 FlowBox", true, Some("CmdOrCtrl+Q"))?;

    let menu = Menu::with_items(
        app,
        &[
            &show_main,
            &toggle_butler,
            &toggle_clipboard,
            &quick_capture,
            &text_action,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("FlowBox — AI 效率工作台")
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_SHOW_MAIN => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.unminimize();
                    let _ = win.set_focus();
                }
            }
            MENU_TOGGLE_BUTLER => {
                crate::commands::butler::toggle_butler(app.clone());
            }
            MENU_TOGGLE_CLIPBOARD => {
                crate::commands::clipboard::toggle_clipboard_picker(app.clone());
            }
            MENU_QUICK_CAPTURE => {
                crate::commands::quick_capture::toggle_quick_capture(app.clone());
            }
            MENU_TEXT_ACTION => {
                crate::services::text_action::trigger(app);
            }
            MENU_QUIT => {
                app.exit(0);
            }
            _ => {}
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

/// 更新顶部菜单栏标题（用于实时展示番茄倒计时，空字符串则恢复纯图标）
#[tauri::command]
pub fn tray_set_title(app: AppHandle, title: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let next = if title.trim().is_empty() {
            None
        } else {
            Some(title)
        };
        tray.set_title(next).map_err(|err| err.to_string())?;
    }
    Ok(())
}
