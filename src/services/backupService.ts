import { invoke, isTauri } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'

export type BackupKind = 'manual' | 'daily' | 'premigrate' | 'prerestore'

export interface BackupInfo {
  name: string
  kind: BackupKind
  size_bytes: number
  created_at: string
}

export interface BackupOverview {
  db_path: string
  backup_dir: string
  backups: BackupInfo[]
}

export const BACKUP_KIND_LABELS: Record<BackupKind, string> = {
  manual: '手动备份',
  daily: '每日自动',
  premigrate: '升级前快照',
  prerestore: '恢复前快照',
}

function ensureTauri() {
  if (!isTauri()) {
    throw new Error('仅桌面版支持数据库备份。')
  }
}

export async function getBackupOverview(): Promise<BackupOverview> {
  ensureTauri()
  return invoke('db_backup_overview')
}

export async function createBackup(): Promise<BackupInfo> {
  ensureTauri()
  return invoke('db_backup_create')
}

export async function deleteBackup(name: string): Promise<void> {
  ensureTauri()
  await invoke('db_backup_delete', { name })
}

export async function revealBackupDir(): Promise<void> {
  ensureTauri()
  await invoke('db_backup_reveal')
}

/** 暂存恢复任务并立即重启，重启时在数据库打开前完成替换 */
export async function restoreBackupAndRelaunch(name: string): Promise<void> {
  ensureTauri()
  await invoke('db_backup_restore', { name })
  await relaunch()
}
