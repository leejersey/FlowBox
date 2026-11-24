import { useCallback, useEffect, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { DatabaseBackup, FolderOpen, History, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/store/useToastStore'
import { ConfirmIconButton } from '@/components/ui/ConfirmIconButton'
import * as backupService from '@/services/backupService'
import type { BackupInfo, BackupOverview } from '@/services/backupService'

const isTauriApp = isTauri()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

function RestoreButton({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 3000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (confirming) {
          setConfirming(false)
          onConfirm()
        } else {
          setConfirming(true)
        }
      }}
      onBlur={() => setConfirming(false)}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40',
        confirming
          ? 'bg-amber-500 text-white hover:bg-amber-600'
          : 'bg-surface-container text-on-surface hover:bg-surface-container-highest',
      )}
      title={confirming ? '再次点击：恢复此备份并重启 FlowBox' : '恢复此备份'}
    >
      {confirming ? '确认恢复并重启' : '恢复'}
    </button>
  )
}

/** 设置页 · 本地数据库位置、备份列表与恢复 */
export function DataBackupSection() {
  const [overview, setOverview] = useState<BackupOverview | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!isTauriApp) return
    try {
      setOverview(await backupService.getBackupOverview())
    } catch (err) {
      showToast(`读取备份列表失败: ${String(err)}`, 'error')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleCreate = async () => {
    setBusy(true)
    try {
      await backupService.createBackup()
      showToast('已创建备份', 'success')
      await refresh()
    } catch (err) {
      showToast(`备份失败: ${String(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (backup: BackupInfo) => {
    setBusy(true)
    try {
      // 成功时应用会直接重启，不会返回
      await backupService.restoreBackupAndRelaunch(backup.name)
    } catch (err) {
      showToast(`恢复失败: ${String(err)}`, 'error')
      setBusy(false)
    }
  }

  const handleDelete = async (backup: BackupInfo) => {
    try {
      await backupService.deleteBackup(backup.name)
      await refresh()
    } catch (err) {
      showToast(String(err), 'error')
    }
  }

  return (
    <>
      <section className="mb-10">
        <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wider">本地存储位置</h3>
        <div className="bg-surface p-4 rounded-2xl border border-white/10">
          <p className="text-sm text-on-surface-variant mb-3 leading-relaxed">
            应用的所有状态与文本均存储在本机的 SQLite 数据库文件中：
          </p>
          <code className="block p-3 bg-surface-container-highest rounded-xl text-xs font-mono text-on-surface-variant/80 break-all select-all">
            {overview?.db_path ?? '~/Library/Application Support/com.flowbox.app/flowbox.db'}
          </code>
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4" /> 数据备份与恢复
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void backupService.revealBackupDir().catch(err => showToast(String(err), 'error'))}
              disabled={!isTauriApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-container text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-40"
            >
              <FolderOpen className="w-3.5 h-3.5" /> 打开备份目录
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!isTauriApp || busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DatabaseBackup className="w-3.5 h-3.5" />}
              立即备份
            </button>
          </div>
        </div>

        <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
          每天首次启动自动备份（保留 7 份），应用升级前自动快照；恢复前会先为当前数据再保存一份快照，可随时撤销。
        </p>

        <div className="bg-surface rounded-2xl border border-white/10 overflow-hidden text-sm">
          {!overview || overview.backups.length === 0 ? (
            <div className="p-6 text-center text-xs text-on-surface-variant">
              {isTauriApp ? '暂无备份' : '仅桌面版支持数据库备份'}
            </div>
          ) : (
            overview.backups.map((backup, idx) => (
              <div
                key={backup.name}
                className={cn('flex items-center justify-between gap-3 px-4 py-3', idx !== 0 && 'border-t border-white/5')}
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-on-surface">{formatTime(backup.created_at)}</span>
                  <span className="text-xs text-on-surface-variant mt-0.5">
                    {backupService.BACKUP_KIND_LABELS[backup.kind]} · {formatSize(backup.size_bytes)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RestoreButton disabled={busy} onConfirm={() => void handleRestore(backup)} />
                  <ConfirmIconButton
                    onConfirm={() => void handleDelete(backup)}
                    title="删除备份"
                    className="p-1.5 text-on-surface-variant hover:text-red-500 hover:bg-red-500/10"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )
}
