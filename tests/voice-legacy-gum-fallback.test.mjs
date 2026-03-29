import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('语音录制应包含 legacy getUserMedia 兜底', async () => {
  const source = await readFile(new URL('../src/hooks/useVoiceRecorder.ts', import.meta.url), 'utf8')

  assert.ok(
    source.includes('webkitGetUserMedia'),
    'useVoiceRecorder 应包含 webkitGetUserMedia 兼容分支'
  )
  assert.ok(
    source.includes('requestAudioStream'),
    'useVoiceRecorder 应统一通过 requestAudioStream 申请音频流'
  )
})
