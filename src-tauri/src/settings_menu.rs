pub const SETTINGS_ID: &str = "flowbox-settings";
pub const SETTINGS_EVENT: &str = "flowbox:open-settings";

fn authorize_ready(label: &str) -> Result<(), String> {
    if label == "main" { Ok(()) } else { Err("settings readiness requires main".into()) }
}

#[tauri::command]
pub fn settings_menu_ready(window: tauri::WebviewWindow) -> Result<(), String> {
    authorize_ready(window.label())?;
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        let menu = window.app_handle().menu()
            .ok_or_else(|| "menu not installed".to_string())?;
        let items = menu.items().map_err(|error| error.to_string())?;
        let submenu = items.first().and_then(|item| item.as_submenu())
            .ok_or_else(|| "application submenu missing".to_string())?;
        let item = submenu.get(SETTINGS_ID)
            .ok_or_else(|| "settings menu not installed".to_string())?;
        let item = item.as_menuitem().ok_or_else(|| "invalid settings menu item".to_string())?;
        item.set_enabled(true).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn install(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{Emitter, EventTarget, Manager};
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    let menu = Menu::default(app.handle())?;
    let items = menu.items()?;
    let submenu = items.first().and_then(|item| item.as_submenu())
        .ok_or_else(|| std::io::Error::other("default application submenu missing"))?;
    let settings = MenuItem::with_id(app, SETTINGS_ID, "设置…", false, Some("CmdOrCtrl+,"))?;
    submenu.insert(&settings, 2)?;
    submenu.insert(&PredefinedMenuItem::separator(app)?, 3)?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id().as_ref() != SETTINGS_ID { return; }
        let result = (|| -> tauri::Result<()> {
            let window = app.get_webview_window("main")
                .ok_or_else(|| std::io::Error::other("main window missing"))?;
            window.show()?;
            window.unminimize()?;
            window.set_focus()?;
            app.emit_to(EventTarget::WebviewWindow { label: "main".into() }, SETTINGS_EVENT, ())?;
            Ok(())
        })();
        if let Err(error) = result { log::error!("open settings failed: {error}"); }
    });
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn install(_app: &tauri::App) -> tauri::Result<()> { Ok(()) }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn readiness_only_accepts_main() {
        assert!(authorize_ready("main").is_ok());
        assert!(authorize_ready("butler").is_err());
        assert!(authorize_ready("").is_err());
    }

    #[test]
    fn only_settings_id_is_handled() {
        assert_eq!(SETTINGS_ID, "flowbox-settings");
        assert_ne!(SETTINGS_ID, "quit");
    }
}
