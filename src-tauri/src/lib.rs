pub mod errors;
pub mod models;
pub mod services;
pub mod commands;

use tauri::Manager;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

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
    ];

    tauri::Builder::default()
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
                        }
                    }
                })
                .build(),
        )
        .manage(services::voice_recorder::VoiceRecorderState::default())
        .invoke_handler(tauri::generate_handler![
            commands::clipboard::clipboard_set_watch,
            commands::clipboard::clipboard_is_watching,
            commands::butler::toggle_butler,
            commands::butler::hide_butler,
            commands::butler::show_butler,
            commands::butler::butler_set_shortcut,
            commands::app_usage::app_usage_set_tracking,
            commands::app_usage::app_usage_is_tracking,
            commands::obsidian::obsidian_export_markdown,
            commands::voice::voice_start_recording,
            commands::voice::voice_stop_recording,
        ])
        .setup(move |app| {
            services::butler_shortcut::register_initial_shortcut(
                &app.handle().clone(),
                app.state::<services::butler_shortcut::ButlerShortcutState>().inner(),
            )
            .map_err(std::io::Error::other)?;
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
