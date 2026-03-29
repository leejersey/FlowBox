import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Tauri 需启用 assetProtocol 并放通 clipboard_images 作用域', async () => {
  const raw = await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8')
  const conf = JSON.parse(raw)

  const security = conf?.app?.security ?? {}
  const asset = security.assetProtocol ?? {}
  const scope = Array.isArray(asset.scope) ? asset.scope : []

  assert.equal(asset.enable, true, 'app.security.assetProtocol.enable 必须为 true 才能预览本地图片')
  assert.ok(
    scope.some((s) => typeof s === 'string' && s.includes('$APPDATA/clipboard_images')),
    'assetProtocol.scope 需包含 $APPDATA/clipboard_images 路径'
  )
})
