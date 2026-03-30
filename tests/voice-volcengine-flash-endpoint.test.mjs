import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('火山引擎极速转写应使用 v3 flash 接口与 auc_turbo 资源 ID', async () => {
  const source = await readFile(new URL('../src-tauri/src/services/voice_transcribe.rs', import.meta.url), 'utf8')

  assert.ok(
    source.includes('https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash'),
    'voice_transcribe 应使用火山引擎 v3 flash 识别接口'
  )
  assert.ok(
    source.includes('volc.bigasr.auc_turbo'),
    'voice_transcribe 应使用 volc.bigasr.auc_turbo 资源 ID'
  )
  assert.ok(
    source.includes('X-Api-Request-Id'),
    'voice_transcribe 应携带 X-Api-Request-Id'
  )
  assert.ok(
    source.includes('X-Api-Sequence'),
    'voice_transcribe 应携带 X-Api-Sequence'
  )
  assert.ok(
    source.includes('"uid": app_id'),
    'voice_transcribe 请求体应带 user.uid'
  )
})
