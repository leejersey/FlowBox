pub mod services;
pub mod commands;
pub mod settings_menu;
pub mod tray;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};
use tauri_plugin_autostart::MacosLauncher;

const CLIPBOARD_PICKER_SHORTCUT: &str = "CommandOrControl+Shift+V";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 定义数据库迁移
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_all_tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_error_logs",
            sql: include_str!("../migrations/002_error_logs.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_butler_messages",
            sql: include_str!("../migrations/003_butler_messages.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "cross_module_links",
            sql: include_str!("../migrations/004_cross_link.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "butler_skills",
            sql: include_str!("../migrations/005_butler_skills.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "trending_repos",
            sql: include_str!("../migrations/006_trending.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "pomodoro_running",
            sql: include_str!("../migrations/007_pomodoro_running.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "app_usage_unique",
            sql: include_str!("../migrations/008_app_usage_unique.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "item_links_canonical",
            sql: include_str!("../migrations/009_item_links_canonical.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "item_link_cleanup",
            sql: include_str!("../migrations/010_item_link_cleanup.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "trending_v2",
            sql: include_str!("../migrations/011_trending_v2.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "butler_sessions",
            sql: include_str!("../migrations/012_butler_sessions.sql"),
            kind: MigrationKind::Up,
        },
    ];

    let latest_migration_version = migrations.iter().map(|m| m.version).max().unwrap_or(0);

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        // 必须注册在 SQL 插件之前：应用待恢复备份、迁移前快照都要在数据库被打开前完成
        .plugin(
            tauri::plugin::Builder::<tauri::Wry, ()>::new("db-backup")
                .setup(move |app, _api| {
                    services::db_backup::prepare_on_startup(app, latest_migration_version);
                    Ok(())
                })
                .build(),
        )
        .manage(commands::backup::DbBackupConfig {
            latest_version: latest_migration_version,
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:flowbox.db", migrations)
                .build(),
        )
        .manage(services::butler_shortcut::ButlerShortcutState::default())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let shortcut_state = app.state::<services::butler_shortcut::ButlerShortcutState>();
                        if services::butler_shortcut::matches_current_shortcut(shortcut_state.inner(), shortcut) {
                            commands::butler::toggle_butler(app.clone());
                            return;
                        }
                        if let Ok(clip_shortcut) = CLIPBOARD_PICKER_SHORTCUT.parse::<Shortcut>() {
                            if clip_shortcut == *shortcut {
                                commands::clipboard::toggle_clipboard_picker(app.clone());
                            }
                        }
                    }
                })
                .build(),
        )
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .manage(services::voice_recorder::VoiceRecorderState::default())
        .invoke_handler(tauri::generate_handler![
            commands::clipboard::clipboard_set_watch,
            commands::clipboard::clipboard_is_watching,
            commands::clipboard::toggle_clipboard_picker,
            commands::clipboard::hide_clipboard_picker,
            commands::clipboard::clipboard_write_text,
            commands::clipboard::clipboard_paste_selection,
            commands::butler::toggle_butler,
            commands::butler::hide_butler,
            commands::butler::show_butler,
            commands::butler::butler_set_shortcut,
            commands::app_usage::app_usage_set_tracking,
            commands::app_usage::app_usage_is_tracking,
            commands::obsidian::obsidian_export_markdown,
            commands::voice::voice_start_recording,
            commands::voice::voice_stop_recording,
            commands::voice::voice_transcribe_audio,
            commands::screenshot::screenshot_from_clipboard,
            commands::secrets::secret_get,
            commands::secrets::secret_set,
            commands::secrets::secret_exists,
            commands::ocr::ocr_recognize_text,
            commands::backup::db_backup_overview,
            commands::backup::db_backup_create,
            commands::backup::db_backup_restore,
            commands::backup::db_backup_delete,
            commands::backup::db_backup_reveal,
            settings_menu::settings_menu_ready,
            tray::tray_set_title,
        ])
        .setup(move |app| {
            settings_menu::install(app)?;
            tray::install(app)?;
            services::butler_shortcut::register_initial_shortcut(
                &app.handle().clone(),
                app.state::<services::butler_shortcut::ButlerShortcutState>().inner(),
            )
            .map_err(std::io::Error::other)?;
            if let Ok(clip_shortcut) = CLIPBOARD_PICKER_SHORTCUT.parse::<Shortcut>() {
                if let Err(err) = app.handle().global_shortcut().register(clip_shortcut) {
                    log::warn!("failed to register clipboard picker shortcut ({CLIPBOARD_PICKER_SHORTCUT}): {err}");
                }
            }
            log::info!(
                "registered global shortcut: {}",
                services::butler_shortcut::DEFAULT_BUTLER_SHORTCUT
            );

            // 启动剪贴板监听后台线程
            services::clipboard_watcher::start_clipboard_watcher(app.handle().clone());

            // 启动应用使用追踪后台线程
            services::app_usage_tracker::start_app_usage_tracker(app.handle().clone());

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // 主窗口点红叉后仅隐藏到菜单栏；点击 Dock 图标时需要把它重新唤回
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = event {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.unminimize();
                    let _ = win.set_focus();
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
