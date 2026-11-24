//! 数据库备份与恢复相关的 Tauri Commands

use tauri::{AppHandle, State};

use crate::services::db_backup::{self, BackupInfo, BackupOverview};

/// 当前应用内置的最新迁移版本，用于拒绝来自更新版本的备份
pub struct DbBackupConfig {
    pub latest_version: i64,
}

#[tauri::command]
pub async fn db_backup_overview(app: AppHandle) -> Result<BackupOverview, String> {
    tauri::async_runtime::spawn_blocking(move || db_backup::overview(&app))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn db_backup_create(app: AppHandle) -> Result<BackupInfo, String> {
    tauri::async_runtime::spawn_blocking(move || db_backup::create_manual(&app))
        .await
        .map_err(|e| e.to_string())?
}

/// 暂存恢复任务；前端随后重启应用，在 SQL 插件打开数据库前完成替换
#[tauri::command]
pub async fn db_backup_restore(
    app: AppHandle,
    config: State<'_, DbBackupConfig>,
    name: String,
) -> Result<(), String> {
    let latest_version = config.latest_version;
    tauri::async_runtime::spawn_blocking(move || db_backup::stage_restore(&app, &name, latest_version))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn db_backup_delete(app: AppHandle, name: String) -> Result<(), String> {
    db_backup::delete(&app, &name)
}

/// 在 Finder 中打开备份目录
#[tauri::command]
pub fn db_backup_reveal(app: AppHandle) -> Result<(), String> {
    let dir = db_backup::backup_dir(&app)?;
    std::process::Command::new("open")
        .arg(dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("打开备份目录失败: {e}"))
}
