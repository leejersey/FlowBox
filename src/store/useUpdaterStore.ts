import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { showToast } from './useToastStore'

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up_to_date'
  | 'downloading'
  | 'ready'
  | 'error'

interface UpdaterStore {
  status: UpdaterStatus
  currentVersion: string
  availableVersion: string | null
  releaseNotes: string | null
  releaseDate: string | null
  progress: number
  downloadedBytes: number
  totalBytes: number
  error: string | null
  loadCurrentVersion: () => Promise<void>
  checkForUpdate: (options?: { silent?: boolean }) => Promise<void>
  downloadAndInstall: () => Promise<void>
  relaunchNow: () => Promise<void>
}

let pendingUpdate: Update | null = null

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  status: 'idle',
  currentVersion: '0.5.0',
  availableVersion: null,
  releaseNotes: null,
  releaseDate: null,
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  error: null,

  loadCurrentVersion: async () => {
    if (!isTauri()) return
    try {
      const version = await getVersion()
      set({ currentVersion: version })
    } catch {
      // 保留默认版本
    }
  },

  checkForUpdate: async (options) => {
    const silent = options?.silent ?? false
    if (!isTauri()) {
      if (!silent) showToast('仅桌面版支持应用内自动更新', 'info')
      return
    }
    if (get().status === 'checking' || get().status === 'downloading') return

    set({ status: 'checking', error: null })
    try {
      const update = await check()
      if (update) {
        pendingUpdate = update
        set({
          status: 'available',
          availableVersion: update.version,
          releaseNotes: update.body ?? null,
          releaseDate: update.date ?? null,
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
        })
        if (!silent) {
          showToast(`发现新版本 v${update.version}`, 'info')
        }
      } else {
        pendingUpdate = null
        set({
          status: 'up_to_date',
          availableVersion: null,
          releaseNotes: null,
          releaseDate: null,
        })
        if (!silent) {
          showToast('当前已是最新版本', 'success')
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ status: silent ? 'idle' : 'error', error: silent ? null : msg })
      if (!silent) {
        showToast(`检查更新失败: ${msg}`, 'error')
      }
    }
  },

  downloadAndInstall: async () => {
    if (!isTauri()) return
    if (!pendingUpdate) {
      await get().checkForUpdate({ silent: false })
      if (!pendingUpdate) return
    }

    set({ status: 'downloading', progress: 0, downloadedBytes: 0, totalBytes: 0, error: null })
    let downloaded = 0
    let total = 0

    try {
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
          set({ totalBytes: total, downloadedBytes: 0, progress: 0 })
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          const pct = total > 0 ? Math.min(99, Math.round((downloaded / total) * 100)) : 50
          set({ downloadedBytes: downloaded, progress: pct })
        } else if (event.event === 'Finished') {
          set({ progress: 100 })
        }
      })

      set({ status: 'ready', progress: 100 })
      showToast('更新包已安装完成，点击重启即可生效', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ status: 'error', error: msg })
      showToast(`下载更新失败: ${msg}`, 'error')
    }
  },

  relaunchNow: async () => {
    if (!isTauri()) return
    try {
      await relaunch()
    } catch (err) {
      showToast(`自动重启失败，请手动重启应用: ${String(err)}`, 'error')
    }
  },
}))
