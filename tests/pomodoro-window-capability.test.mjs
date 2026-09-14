import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const capability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/pomodoro-window-main.json', import.meta.url), 'utf8').catch(() => '{}'))

test('番茄小窗只允许主窗口调整尺寸和置顶', () => {
  assert.deepEqual(capability.windows, ['main'])
  assert.deepEqual(capability.permissions, [
    'core:window:allow-set-size',
    'core:window:allow-set-always-on-top',
  ])
})
