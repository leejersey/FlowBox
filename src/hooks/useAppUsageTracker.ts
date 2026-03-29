/**
 * useAppUsageTracker — 监听 Rust 端的 app_usage://tick 事件
 * 负责将使用时长数据落库到 app_usage 表
 */

import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import * as appUsageService from '@/services/appUsageService'

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

interface AppUsageTickPayload {
  app_name: string
  duration_seconds: number
}

export function useAppUsageTracker() {
  useEffect(() => {
    if (!isTauri) return

    let unlisten: (() => void) | null = null

    listen<AppUsageTickPayload>('app_usage://tick', async (event) => {
      const { app_name, duration_seconds } = event.payload
      if (app_name && duration_seconds > 0) {
        try {
          await appUsageService.saveUsageTick(app_name, duration_seconds)
        } catch {
          // 静默处理，不打扰用户
        }
      }
    }).then(fn => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [])
}
