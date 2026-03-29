/**
 * useSettings — Settings 状态管理 Hook
 * 统一管理配置表的读写，并提供 Toast 反馈
 */

import { useState, useCallback, useEffect } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import * as settingsService from '@/services/settingsService'
import { showToast } from '@/store/useToastStore'

const isTauriEnv = isTauri()

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false) // 用于触发"已保存"动画

  const loadSettings = useCallback(async () => {
    if (!isTauriEnv) return
    setLoading(true)
    try {
      const all = await settingsService.settingsGetAll()
      setSettings(all)
    } catch (err) {
      showToast(`加载设置失败: ${String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const setSetting = useCallback(async (key: string, value: string, showFeedback = true) => {
    if (!isTauriEnv) return
    try {
      await settingsService.settingsSet(key, value)
      setSettings(prev => ({ ...prev, [key]: value }))
      
      if (showFeedback) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }
    } catch (err) {
      showToast(`保存设置失败: ${String(err)}`, 'error')
    }
  }, [])

  const toggleSetting = useCallback(async (key: string, showFeedback = true) => {
    const current = settings[key] === 'true'
    await setSetting(key, String(!current), showFeedback)
  }, [settings, setSetting])

  return {
    settings,
    loading,
    saved,
    setSetting,
    toggleSetting,
    loadSettings
  }
}
