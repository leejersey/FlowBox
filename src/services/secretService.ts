import { invoke } from '@tauri-apps/api/core'
import { showToast } from '../store/useToastStore.ts'
import { settingsDelete, settingsGetLegacySecret } from './settingsService.ts'

export const SECRET_KEYS = [
  'ai.openai_api_key',
  'asr.volc_app_id',
  'asr.volc_access_token',
] as const

export type SecretKey = typeof SECRET_KEYS[number]

const getSecure = (key: SecretKey) => invoke<string | null>('secret_get', { key })

export async function getSecret(
  key: SecretKey,
  deps = { getSecure, getLegacy: settingsGetLegacySecret },
): Promise<string | null> {
  let secure: string | null = null
  try {
    secure = await deps.getSecure(key)
  } catch {
    console.warn(`安全存储读取失败，将尝试旧设置: ${key}`)
  }
  if (secure !== null) return secure

  const legacy = await deps.getLegacy(key)
  if (legacy !== null) console.warn(`正在使用待迁移的旧凭据: ${key}`)
  return legacy
}

export const setSecret = (key: SecretKey, value: string) =>
  invoke<void>('secret_set', { key, value })

export async function secretExists(key: SecretKey): Promise<boolean> {
  try {
    if (await invoke<boolean>('secret_exists', { key })) return true
  } catch {
    console.warn(`安全存储状态读取失败，将检查旧设置: ${key}`)
  }
  return (await settingsGetLegacySecret(key)) !== null
}

interface MigrationDeps {
  getSecret: (key: SecretKey) => Promise<string | null>
  getLegacy: (key: SecretKey) => Promise<string | null>
  setSecret: (key: SecretKey, value: string) => Promise<unknown>
  deleteLegacy: (key: SecretKey) => Promise<unknown>
}

export type MigrationResult = {
  value: string | null
  migrated: boolean
  error?: string
}

export async function migrateLegacySecret(
  key: SecretKey,
  deps: MigrationDeps,
): Promise<MigrationResult> {
  let secure: string | null
  try {
    secure = await deps.getSecret(key)
  } catch (error) {
    let legacy: string | null = null
    try {
      legacy = await deps.getLegacy(key)
    } catch { /* keep the original secure-storage error */ }
    return { value: legacy, migrated: false, error: error instanceof Error ? error.message : String(error) }
  }

  let legacy: string | null
  try {
    legacy = await deps.getLegacy(key)
  } catch (error) {
    return { value: secure, migrated: false, error: error instanceof Error ? error.message : String(error) }
  }
  if (legacy === null) return { value: secure, migrated: false }

  try {
    if (secure === null) await deps.setSecret(key, legacy)
    await deps.deleteLegacy(key)
    return { value: secure ?? legacy, migrated: true }
  } catch (error) {
    return {
      value: secure ?? legacy,
      migrated: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function migrateLegacySecrets(
  keys: readonly SecretKey[] = SECRET_KEYS,
  deps: MigrationDeps = {
    getSecret: getSecure,
    getLegacy: settingsGetLegacySecret,
    setSecret,
    deleteLegacy: settingsDelete,
  },
) {
  const results: MigrationResult[] = []
  for (const key of keys) {
    let result: MigrationResult
    try {
      result = await migrateLegacySecret(key, deps)
    } catch (error) {
      result = { value: null, migrated: false, error: error instanceof Error ? error.message : String(error) }
    }
    results.push(result)
    if (result.error) {
      console.warn(`凭据迁移失败，可稍后重试: ${key}`)
      showToast('安全存储暂不可用，可稍后重试', 'error')
    }
  }
  return results
}
