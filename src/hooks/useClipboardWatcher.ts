/**
 * useClipboardWatcher — 剪贴板自动监听 Hook
 *
 * 职责：
 * 1. 订阅 Rust 端发来的 `clipboard://new` 事件
 * 2. 收到新内容后调用 clipCreate 写入 SQLite
 * 3. 通过 Tauri Command 控制 Rust 端全局开关
 * 4. 读取/写入 settings 持久化开关状态
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import * as clipboardService from '@/services/clipboardService'
import * as settingsService from '@/services/settingsService'
import * as aiService from '@/services/aiService'
import { showToast } from '@/store/useToastStore'
import { registerMainWindowListener } from '@/services/appInitializationService'
import { applyBackgroundSetting } from '@/services/backgroundSettingsService'

const isTauriApp = isTauri()

interface ClipboardPayload {
  content_type: string
  text_content?: string
  image_path?: string
  content_hash: string
}

/** 后台 AI 分类，不阻塞主流程 */
async function classifyInBackground(clipId: number, text: string) {
  try {
    const autoClassify = await settingsService.settingsGet('clipboard.auto_classify')
    if (autoClassify === 'false') return

    const category = await aiService.classifyClipboard(text)
    if (category) {
      await clipboardService.clipUpdateCategory(clipId, category)
    }
  } catch {
    // 分类失败不影响主流程
  }
}

/**
 * @param onNewClip 当有新剪贴板内容入库后的回调（通常是 refresh 列表）
 */
const CLIPBOARD_SAVED_EVENT = 'flowbox:clipboard-saved'
// 默认值由后台同步服务按 saved !== 'false' 语义开启。

export function useClipboardPersistence() {
  useEffect(() => {
    if (!isTauriApp) return

    return registerMainWindowListener(
      getCurrentWindow().label,
      () => listen<ClipboardPayload>('clipboard://new', async (event) => {
        const { content_type, text_content, image_path, content_hash } = event.payload
        try {
          const normalizedText = text_content?.trim()
          const item = await clipboardService.clipCreate({
            content_type: content_type as 'text' | 'code' | 'image',
            text_content: normalizedText,
            image_path: image_path,
            content_hash,
          })
          window.dispatchEvent(new Event(CLIPBOARD_SAVED_EVENT))

          if (normalizedText && item.id && !item.category) {
            classifyInBackground(item.id, normalizedText)
          }
        } catch (err) {
          console.error('写入剪贴板记录失败:', err)
        }
      }),
      error => showToast(`订阅剪贴板事件失败: ${String(error)}`, 'error'),
    )
  }, [])
}

export function useClipboardControls(onNewClip?: () => void) {
  const [watching, setWatching] = useState(false)
  const onNewClipRef = useRef(onNewClip)
  onNewClipRef.current = onNewClip

  const syncWatchState = useCallback(async () => {
    const current = await invoke<boolean>('clipboard_is_watching')
    setWatching(current)
    return current
  }, [])

  useEffect(() => {
    if (!isTauriApp) return
    void syncWatchState().catch(err => {
      showToast(`读取剪贴板监听状态失败: ${String(err)}`, 'error')
    })
  }, [syncWatchState])

  useEffect(() => {
    const refresh = () => onNewClipRef.current?.()
    window.addEventListener(CLIPBOARD_SAVED_EVENT, refresh)
    return () => window.removeEventListener(CLIPBOARD_SAVED_EVENT, refresh)
  }, [])

  // 切换开关
  const toggleWatch = useCallback(async (enabled: boolean) => {
    if (!isTauriApp) return

    try {
      await applyBackgroundSetting('clipboard.auto_watch', enabled, {
        get: settingsService.settingsGet,
        set: settingsService.settingsSet,
        invoke: (command, payload) => invoke(command, payload),
      })
      setWatching(enabled)
      showToast(enabled ? '剪贴板监听已开启' : '剪贴板监听已关闭', 'info')
    } catch (err) {
      showToast(`切换监听失败: ${String(err)}`, 'error')
    }
  }, [])

  return { watching, toggleWatch }
}
