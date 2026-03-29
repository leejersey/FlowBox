import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Tauri 语音录制应调用原生命令而不是仅依赖浏览器 API', async () => {
  const source = await readFile(new URL('../src/hooks/useVoiceRecorder.ts', import.meta.url), 'utf8')

  assert.ok(
    source.includes("invoke('voice_start_recording'"),
    'useVoiceRecorder 应在 Tauri 环境调用 voice_start_recording'
  )
  assert.ok(
    source.includes("invoke('voice_stop_recording'"),
    'useVoiceRecorder 应在停止时调用 voice_stop_recording'
  )
})
