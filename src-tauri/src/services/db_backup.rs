//! 本地数据库备份与恢复
//!
//! - 迁移前快照：启动时若 `flowbox.db` 的迁移版本落后于当前应用，在 SQL 插件执行迁移前先备份
//! - 每日自动备份：启动后若距最近一次每日备份超过 20 小时，则在后台生成一份
//! - 手动备份 / 恢复：恢复采用「暂存 + 重启」，在下次启动、SQL 插件打开数据库之前完成替换
//!
//! 备份统一使用 SQLite Online Backup API，数据库被占用（WAL 模式）时也能得到一致快照。

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use chrono::{DateTime, Local};
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

pub const DB_FILE_NAME: &str = "flowbox.db";
const BACKUP_DIR_NAME: &str = "backups";
const BACKUP_PREFIX: &str = "flowbox-";
const BACKUP_EXT: &str = ".db";
const PENDING_RESTORE_FILE: &str = ".pending_restore";
const DAILY_INTERVAL: Duration = Duration::from_secs(20 * 60 * 60);
const DAILY_START_DELAY: Duration = Duration::from_secs(15);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackupKind {
    Manual,
    Daily,
    PreMigrate,
    PreRestore,
}

impl BackupKind {
    fn slug(self) -> &'static str {
        match self {
            BackupKind::Manual => "manual",
            BackupKind::Daily => "daily",
            BackupKind::PreMigrate => "premigrate",
            BackupKind::PreRestore => "prerestore",
        }
    }

    fn from_slug(slug: &str) -> Option<Self> {
        match slug {
            "manual" => Some(BackupKind::Manual),
            "daily" => Some(BackupKind::Daily),
            "premigrate" => Some(BackupKind::PreMigrate),
            "prerestore" => Some(BackupKind::PreRestore),
            _ => None,
        }
    }

    /// 自动备份的保留份数；手动备份不自动清理
    fn retention(self) -> Option<usize> {
        match self {
            BackupKind::Manual => None,
            BackupKind::Daily => Some(7),
            BackupKind::PreMigrate | BackupKind::PreRestore => Some(5),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub kind: &'static str,
    pub size_bytes: u64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupOverview {
    pub db_path: String,
    pub backup_dir: String,
    pub backups: Vec<BackupInfo>,
}

fn data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    // 与 tauri-plugin-sql 保持一致：数据库位于 app_config_dir
    app.path()
        .app_config_dir()
        .map_err(|e| format!("无法定位应用数据目录: {e}"))
}

fn db_path_in(dir: &Path) -> PathBuf {
    dir.join(DB_FILE_NAME)
}

fn backup_dir_in(dir: &Path) -> PathBuf {
    dir.join(BACKUP_DIR_NAME)
}

fn parse_kind(name: &str) -> Option<BackupKind> {
    let rest = name.strip_prefix(BACKUP_PREFIX)?.strip_suffix(BACKUP_EXT)?;
    BackupKind::from_slug(rest.split('-').next()?)
}

/// 仅接受本应用生成的备份文件名，防止路径穿越
fn validate_backup_name(name: &str) -> Result<BackupKind, String> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err("非法的备份文件名".into());
    }
    parse_kind(name).ok_or_else(|| "非法的备份文件名".into())
}

fn snapshot_to(src_db: &Path, dest: &Path) -> Result<(), String> {
    let src = Connection::open_with_flags(src_db, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("打开数据库失败: {e}"))?;
    let tmp = dest.with_extension("db.tmp");
    let _ = fs::remove_file(&tmp);
    src.backup(rusqlite::DatabaseName::Main, &tmp, None)
        .map_err(|e| format!("备份数据库失败: {e}"))?;
    fs::rename(&tmp, dest).map_err(|e| format!("保存备份失败: {e}"))
}

fn create_backup_in(dir: &Path, kind: BackupKind) -> Result<PathBuf, String> {
    let db = db_path_in(dir);
    if !db.exists() {
        return Err("数据库文件不存在".into());
    }
    let backups = backup_dir_in(dir);
    fs::create_dir_all(&backups).map_err(|e| format!("创建备份目录失败: {e}"))?;

    let stamp = Local::now().format("%Y%m%d-%H%M%S");
    let mut dest = backups.join(format!("{BACKUP_PREFIX}{}-{stamp}{BACKUP_EXT}", kind.slug()));
    let mut n = 1;
    while dest.exists() {
        dest = backups.join(format!("{BACKUP_PREFIX}{}-{stamp}-{n}{BACKUP_EXT}", kind.slug()));
        n += 1;
    }

    snapshot_to(&db, &dest)?;
    prune_in(dir, kind);
    Ok(dest)
}

fn list_in(dir: &Path) -> Vec<(BackupKind, PathBuf, fs::Metadata)> {
    let Ok(entries) = fs::read_dir(backup_dir_in(dir)) else {
        return Vec::new();
    };
    let mut items: Vec<_> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            let kind = parse_kind(&name)?;
            let meta = entry.metadata().ok()?;
            meta.is_file().then(|| (kind, entry.path(), meta))
        })
        .collect();
    // 文件名带时间戳，按名称倒序即为时间倒序；同类型内同样成立
    items.sort_by(|a, b| b.1.file_name().cmp(&a.1.file_name()));
    items
}

fn modified_at(meta: &fs::Metadata) -> SystemTime {
    meta.modified().unwrap_or(SystemTime::UNIX_EPOCH)
}

fn prune_in(dir: &Path, kind: BackupKind) {
    let Some(keep) = kind.retention() else { return };
    let mut same_kind: Vec<_> = list_in(dir).into_iter().filter(|(k, ..)| *k == kind).collect();
    same_kind.sort_by_key(|(_, _, meta)| std::cmp::Reverse(modified_at(meta)));
    for (_, path, _) in same_kind.into_iter().skip(keep) {
        let _ = fs::remove_file(path);
    }
}

fn applied_migration_version(db: &Path) -> Option<i64> {
    let conn = Connection::open_with_flags(db, OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
    conn.query_row(
        "SELECT MAX(version) FROM _sqlx_migrations WHERE success = 1",
        [],
        |row| row.get::<_, Option<i64>>(0),
    )
    .ok()
    .flatten()
}

/// 校验备份可用：完整性检查通过，且迁移版本不高于当前应用
fn verify_backup(path: &Path, latest_version: i64) -> Result<(), String> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("无法打开备份: {e}"))?;
    let check: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|e| format!("备份完整性检查失败: {e}"))?;
    if check != "ok" {
        return Err(format!("备份文件已损坏: {check}"));
    }
    drop(conn);
    match applied_migration_version(path) {
        Some(v) if v > latest_version => Err(format!(
            "该备份来自更新版本的 FlowBox（数据库版本 v{v}），请先升级应用"
        )),
        _ => Ok(()),
    }
}

fn remove_db_files(db: &Path) {
    for suffix in ["", "-wal", "-shm"] {
        let mut p = db.as_os_str().to_owned();
        p.push(suffix);
        let _ = fs::remove_file(PathBuf::from(p));
    }
}

fn apply_pending_restore_in(dir: &Path, latest_version: i64) -> Result<bool, String> {
    let marker = backup_dir_in(dir).join(PENDING_RESTORE_FILE);
    let Ok(name) = fs::read_to_string(&marker) else {
        return Ok(false);
    };
    let _ = fs::remove_file(&marker);
    let name = name.trim();
    validate_backup_name(name)?;
    let source = backup_dir_in(dir).join(name);
    verify_backup(&source, latest_version)?;

    let db = db_path_in(dir);
    if db.exists() {
        // 恢复前为当前数据再留一份快照，确保操作可撤销
        create_backup_in(dir, BackupKind::PreRestore)?;
    }
    remove_db_files(&db);
    fs::copy(&source, &db).map_err(|e| format!("恢复备份失败: {e}"))?;
    Ok(true)
}

fn backup_before_migration_in(dir: &Path, latest_version: i64) -> Result<Option<PathBuf>, String> {
    let db = db_path_in(dir);
    if !db.exists() {
        return Ok(None);
    }
    match applied_migration_version(&db) {
        Some(v) if v < latest_version => create_backup_in(dir, BackupKind::PreMigrate).map(Some),
        _ => Ok(None),
    }
}

fn daily_backup_due_in(dir: &Path) -> bool {
    let latest = list_in(dir)
        .into_iter()
        .filter(|(k, ..)| *k == BackupKind::Daily)
        .map(|(_, _, meta)| modified_at(&meta))
        .max();
    match latest {
        None => true,
        Some(t) => SystemTime::now().duration_since(t).unwrap_or_default() >= DAILY_INTERVAL,
    }
}

/// 必须在 SQL 插件打开数据库之前调用：先应用待恢复的备份，再做迁移前快照，最后安排每日备份
pub fn prepare_on_startup<R: Runtime>(app: &AppHandle<R>, latest_version: i64) {
    let dir = match data_dir(app) {
        Ok(dir) => dir,
        Err(err) => {
            log::warn!("db backup disabled: {err}");
            return;
        }
    };

    match apply_pending_restore_in(&dir, latest_version) {
        Ok(true) => log::info!("restored database from staged backup"),
        Ok(false) => {}
        Err(err) => log::error!("failed to apply staged restore: {err}"),
    }
    match backup_before_migration_in(&dir, latest_version) {
        Ok(Some(path)) => log::info!("pre-migration backup created: {}", path.display()),
        Ok(None) => {}
        Err(err) => log::error!("pre-migration backup failed: {err}"),
    }

    std::thread::spawn(move || {
        std::thread::sleep(DAILY_START_DELAY);
        if daily_backup_due_in(&dir) {
            if let Err(err) = create_backup_in(&dir, BackupKind::Daily) {
                log::warn!("daily backup failed: {err}");
            }
        }
    });
}

fn to_info(kind: BackupKind, path: &Path, meta: &fs::Metadata) -> BackupInfo {
    let created: DateTime<Local> = modified_at(meta).into();
    BackupInfo {
        name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
        kind: kind.slug(),
        size_bytes: meta.len(),
        created_at: created.to_rfc3339(),
    }
}

pub fn overview<R: Runtime>(app: &AppHandle<R>) -> Result<BackupOverview, String> {
    let dir = data_dir(app)?;
    Ok(BackupOverview {
        db_path: db_path_in(&dir).to_string_lossy().into_owned(),
        backup_dir: backup_dir_in(&dir).to_string_lossy().into_owned(),
        backups: list_in(&dir)
            .iter()
            .map(|(kind, path, meta)| to_info(*kind, path, meta))
            .collect(),
    })
}

pub fn create_manual<R: Runtime>(app: &AppHandle<R>) -> Result<BackupInfo, String> {
    let dir = data_dir(app)?;
    let path = create_backup_in(&dir, BackupKind::Manual)?;
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(to_info(BackupKind::Manual, &path, &meta))
}

pub fn stage_restore<R: Runtime>(app: &AppHandle<R>, name: &str, latest_version: i64) -> Result<(), String> {
    validate_backup_name(name)?;
    let dir = data_dir(app)?;
    let source = backup_dir_in(&dir).join(name);
    if !source.is_file() {
        return Err("备份文件不存在".into());
    }
    verify_backup(&source, latest_version)?;
    fs::write(backup_dir_in(&dir).join(PENDING_RESTORE_FILE), name)
        .map_err(|e| format!("暂存恢复任务失败: {e}"))
}

pub fn delete<R: Runtime>(app: &AppHandle<R>, name: &str) -> Result<(), String> {
    validate_backup_name(name)?;
    let path = backup_dir_in(&data_dir(app)?).join(name);
    fs::remove_file(path).map_err(|e| format!("删除备份失败: {e}"))
}

pub fn backup_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = backup_dir_in(&data_dir(app)?);
    fs::create_dir_all(&dir).map_err(|e| format!("创建备份目录失败: {e}"))?;
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "flowbox-backup-test-{tag}-{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn seed_db(dir: &Path, migration_version: i64, note: &str) {
        let conn = Connection::open(db_path_in(dir)).unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS _sqlx_migrations (version INTEGER PRIMARY KEY, success INTEGER NOT NULL);
             CREATE TABLE IF NOT EXISTS notes (body TEXT);
             DELETE FROM notes;",
        )
        .unwrap();
        conn.execute("INSERT OR REPLACE INTO _sqlx_migrations VALUES (?1, 1)", [migration_version])
            .unwrap();
        conn.execute("INSERT INTO notes VALUES (?1)", [note]).unwrap();
    }

    fn read_note(db: &Path) -> String {
        Connection::open(db)
            .unwrap()
            .query_row("SELECT body FROM notes", [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn rejects_untrusted_backup_names() {
        assert!(validate_backup_name("../flowbox.db").is_err());
        assert!(validate_backup_name("flowbox-manual-x/../../a.db").is_err());
        assert!(validate_backup_name("other.db").is_err());
        assert!(validate_backup_name("flowbox-unknown-20260101-000000.db").is_err());
        assert_eq!(
            validate_backup_name("flowbox-daily-20260101-000000.db"),
            Ok(BackupKind::Daily)
        );
    }

    #[test]
    fn snapshot_captures_uncheckpointed_wal_data() {
        let dir = temp_dir("wal");
        seed_db(&dir, 12, "hello");
        // 保持连接打开，数据仍在 WAL 中
        let _open = Connection::open(db_path_in(&dir)).unwrap();
        let path = create_backup_in(&dir, BackupKind::Manual).unwrap();
        assert_eq!(read_note(&path), "hello");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn backs_up_only_when_migrations_are_pending() {
        let dir = temp_dir("premigrate");
        seed_db(&dir, 12, "current");
        assert_eq!(backup_before_migration_in(&dir, 12).unwrap(), None);
        let path = backup_before_migration_in(&dir, 13).unwrap().expect("backup expected");
        assert_eq!(parse_kind(path.file_name().unwrap().to_str().unwrap()), Some(BackupKind::PreMigrate));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn staged_restore_replaces_db_and_keeps_safety_copy() {
        let dir = temp_dir("restore");
        seed_db(&dir, 12, "old");
        let backup = create_backup_in(&dir, BackupKind::Manual).unwrap();
        seed_db(&dir, 12, "new");

        let name = backup.file_name().unwrap().to_str().unwrap();
        fs::write(backup_dir_in(&dir).join(PENDING_RESTORE_FILE), name).unwrap();
        assert!(apply_pending_restore_in(&dir, 12).unwrap());

        assert_eq!(read_note(&db_path_in(&dir)), "old");
        let safety: Vec<_> = list_in(&dir)
            .into_iter()
            .filter(|(k, ..)| *k == BackupKind::PreRestore)
            .collect();
        assert_eq!(safety.len(), 1);
        assert_eq!(read_note(&safety[0].1), "new");
        assert!(!backup_dir_in(&dir).join(PENDING_RESTORE_FILE).exists());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn refuses_backup_from_newer_schema() {
        let dir = temp_dir("newer");
        seed_db(&dir, 15, "future");
        let backup = create_backup_in(&dir, BackupKind::Manual).unwrap();
        assert!(verify_backup(&backup, 12).is_err());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn prunes_automatic_backups_beyond_retention() {
        let dir = temp_dir("prune");
        seed_db(&dir, 12, "x");
        for _ in 0..9 {
            create_backup_in(&dir, BackupKind::Daily).unwrap();
        }
        create_backup_in(&dir, BackupKind::Manual).unwrap();
        let items = list_in(&dir);
        assert_eq!(items.iter().filter(|(k, ..)| *k == BackupKind::Daily).count(), 7);
        assert_eq!(items.iter().filter(|(k, ..)| *k == BackupKind::Manual).count(), 1);
        let _ = fs::remove_dir_all(dir);
    }
}
