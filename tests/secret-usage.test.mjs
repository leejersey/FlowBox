import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('敏感设置绕过通用 SQLite 读写并由专用服务读取', async () => {
  const [settings, ai, voice] = await Promise.all([
    read('../src/services/settingsService.ts'),
    read('../src/services/aiService.ts'),
    read('../src/hooks/useVoiceTranscribe.ts'),
  ])
  assert.match(settings, /SENSITIVE_KEYS\.has\(key\)/)
  assert.match(settings, /WHERE key NOT IN/)
  assert.doesNotMatch(ai, /settingsGet\('ai\.openai_api_key'\)/)
  assert.doesNotMatch(voice, /settingsGet\('(ai\.openai_api_key|asr\.volc_app_id|asr\.volc_access_token)'\)/)
})

test('设置页仅显示固定掩码，不回填已保存密钥', async () => {
  const page = await read('../src/pages/SettingsPage.tsx')
  assert.match(page, /••••••••/)
  assert.doesNotMatch(page, /setLocalApiKey\(settings\['ai\.openai_api_key'\]\)/)
  assert.doesNotMatch(page, /setVolc(AppId|Token)\(settings\['asr\./)
})

test('密钥子写入不独立标记全局保存成功', async () => {
  const [hook, page] = await Promise.all([
    read('../src/hooks/useSettings.ts'),
    read('../src/pages/SettingsPage.tsx'),
  ])
  const secretSetter = hook.match(/const setSecretSetting[\s\S]*?\n  \}, \[\]\)/)?.[0] ?? ''
  assert.doesNotMatch(secretSetter, /setSaved\(/)
  assert.match(hook, /const markSaved/)
  assert.match(page, /attempted[\s\S]*allSaved[\s\S]*markSaved\(\)/)
})

test('前端 trim 密钥并拒绝空白写入', async () => {
  const hook = await read('../src/hooks/useSettings.ts')
  assert.match(hook, /value\.trim\(\)/)
  assert.match(hook, /请输入[^'"`]*凭据/)
})

test('原生命令使用固定白名单且 CSP 不允许内联脚本或 Google Fonts', async () => {
  const [secrets, config] = await Promise.all([
    read('../src-tauri/src/services/secrets.rs'),
    read('../src-tauri/tauri.conf.json'),
  ])
  assert.match(secrets, /"ai\.openai_api_key"/)
  assert.match(secrets, /"asr\.volc_app_id"/)
  assert.match(secrets, /"asr\.volc_access_token"/)
  assert.match(secrets, /unsupported secret key/)
  assert.doesNotMatch(config, /script-src[^;]*unsafe-inline/)
  assert.doesNotMatch(config, /fonts\.googleapis|fonts\.gstatic/)
})
