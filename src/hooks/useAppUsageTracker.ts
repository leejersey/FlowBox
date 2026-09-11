/**
 * useAppUsageTracker — 监听 Rust 端的 app_usage://tick 事件
 * 负责将使用时长数据落库到 app_usage 表
 */

import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import * as appUsageService from '@/services/appUsageService'
import { registerMainWindowListener, shouldPersistUsageTick } from '@/services/appInitializationService'

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

interface AppUsageTickPayload {
  app_name: string
  duration_seconds: number
  recorded_date: string
  hour: number
}

export function useAppUsageTracker() {
  useEffect(() => {
    if (!isTauri) return
    const label = getCurrentWindow().label
    if (!shouldPersistUsageTick(label)) return

    return registerMainWindowListener(
      label,
      () => listen<AppUsageTickPayload>('app_usage://tick', async (event) => {
        const { app_name, duration_seconds, recorded_date, hour } = event.payload
        if (app_name && duration_seconds > 0) {
          try {
            await appUsageService.saveUsageTick(app_name, duration_seconds, recorded_date, hour)
          } catch {
            // 静默处理，不打扰用户
          }
        }
      }),
      error => console.error('订阅应用使用事件失败:', error),
    )
  }, [])
}
