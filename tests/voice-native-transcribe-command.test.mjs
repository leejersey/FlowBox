import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('语音转写应通过 Tauri 原生命令而不是前端直接 fetch ASR', async () => {
  const [hookSource, aiSource, libSource] = await Promise.all([
    readFile(new URL('../src/hooks/useVoiceTranscribe.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/aiService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
  ])

  assert.ok(
    hookSource.includes("invoke('voice_transcribe_audio'"),
    'useVoiceTranscribe 应调用 voice_transcribe_audio 原生命令'
  )
  assert.ok(
    !aiSource.includes("fetch('https://openspeech.bytedance.com/api/v2/asr/bigmodel'"),
    'aiService 不应继续在前端直接请求火山引擎 ASR'
  )
  assert.ok(
    libSource.includes('commands::voice::voice_transcribe_audio'),
    'lib.rs 应注册 voice_transcribe_audio 命令'
  )
})
