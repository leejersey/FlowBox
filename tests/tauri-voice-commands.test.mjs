import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Tauri 应注册语音录制命令与服务模块', async () => {
  const [libSource, commandsSource, servicesSource] = await Promise.all([
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/commands/mod.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/services/mod.rs', import.meta.url), 'utf8'),
  ])

  assert.ok(
    commandsSource.includes('pub mod voice;'),
    'commands/mod.rs 应导出 voice 命令模块'
  )
  assert.ok(
    servicesSource.includes('pub mod voice_recorder;'),
    'services/mod.rs 应导出 voice_recorder 服务模块'
  )
  assert.ok(
    libSource.includes('commands::voice::voice_start_recording'),
    'lib.rs 应注册 voice_start_recording'
  )
  assert.ok(
    libSource.includes('commands::voice::voice_stop_recording'),
    'lib.rs 应注册 voice_stop_recording'
  )
})
