import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const capability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/pomodoro-window-main.json', import.meta.url), 'utf8').catch(() => '{}'))

test('番茄小窗权限精确仅授予 main', () => {
  assert.deepEqual(capability.windows, ['main'])
  assert.deepEqual(capability.permissions, [
    'core:window:allow-set-size',
    'core:window:allow-set-always-on-top',
    'core:window:allow-set-position',
    'core:window:allow-set-resizable',
    'core:window:allow-maximize',
    'core:window:allow-unmaximize',
  ])
})
