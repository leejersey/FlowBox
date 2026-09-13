/**
 * useSettings — Settings 状态管理 Hook
 * 统一管理配置表的读写，并提供 Toast 反馈
 */

import { useState, useCallback, useEffect } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import * as settingsService from '@/services/settingsService'
import { showToast } from '@/store/useToastStore'
import { SECRET_KEYS, secretExists, setSecret, type SecretKey } from '@/services/secretService'

const isTauriEnv = isTauri()

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [secretsConfigured, setSecretsConfigured] = useState<Record<SecretKey, boolean>>({
    'ai.openai_api_key': false,
    'asr.volc_app_id': false,
    'asr.volc_access_token': false,
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false) // 用于触发"已保存"动画

  const markSaved = useCallback(() => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [])

  const loadSettings = useCallback(async () => {
    if (!isTauriEnv) return
    setLoading(true)
    try {
      const [all, configured] = await Promise.all([
        settingsService.settingsGetAll(),
        Promise.all(SECRET_KEYS.map(async key => [key, await secretExists(key)] as const)),
      ])
      setSettings(all)
      setSecretsConfigured(Object.fromEntries(configured) as Record<SecretKey, boolean>)
    } catch (err) {
      showToast(`加载设置失败: ${String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  const setSecretSetting = useCallback(async (key: SecretKey, value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      showToast('请输入有效凭据', 'error')
      return false
    }
    if (!isTauriEnv) return false
    try {
      await setSecret(key, trimmed)
      setSecretsConfigured(prev => ({ ...prev, [key]: true }))
      return true
    } catch {
      showToast('安全存储暂不可用，可稍后重试', 'error')
      return false
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
      
      if (showFeedback) markSaved()
    } catch (err) {
      showToast(`保存设置失败: ${String(err)}`, 'error')
    }
  }, [markSaved])

  const toggleSetting = useCallback(async (key: string, showFeedback = true) => {
    const current = settings[key] === 'true'
    await setSetting(key, String(!current), showFeedback)
  }, [settings, setSetting])

  return {
    settings,
    secretsConfigured,
    loading,
    saved,
    markSaved,
    setSetting,
    setSecretSetting,
    toggleSetting,
    loadSettings
  }
}
