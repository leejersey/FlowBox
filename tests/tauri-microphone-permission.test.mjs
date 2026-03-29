import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('macOS 打包配置应声明麦克风权限说明', async () => {
  const confRaw = await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8')
  const conf = JSON.parse(confRaw)
  const infoPlistPath = conf?.bundle?.macOS?.infoPlist

  assert.equal(
    infoPlistPath,
    'Info.plist',
    'bundle.macOS.infoPlist 应指向包含 NSMicrophoneUsageDescription 的 plist 文件'
  )

  const plistRaw = await readFile(new URL('../src-tauri/Info.plist', import.meta.url), 'utf8')
  assert.ok(
    plistRaw.includes('NSMicrophoneUsageDescription'),
    'Info.plist 必须包含 NSMicrophoneUsageDescription'
  )
})
