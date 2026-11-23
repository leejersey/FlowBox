import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('tauri.conf.json 开启自动更新产物、公钥与 GitHub Releases 清单地址', async () => {
  const conf = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'))
  assert.equal(conf.bundle?.createUpdaterArtifacts, true)
  assert.ok(conf.plugins?.updater?.pubkey?.length > 20)
  assert.ok(
    conf.plugins?.updater?.endpoints?.some(url => url.includes('github.com/leejersey/FlowBox/releases/latest/download/latest.json')),
  )
})

test('updater 权限仅授予 main 窗口且 Rust 已注册 updater 与 process 插件', async () => {
  const [capRaw, libRs, releaseYml] = await Promise.all([
    readFile(new URL('../src-tauri/capabilities/updater.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'),
  ])
  const cap = JSON.parse(capRaw)
  assert.deepEqual(cap.windows, ['main'])
  assert.ok(cap.permissions.includes('updater:default'))
  assert.ok(cap.permissions.includes('process:allow-restart'))
  assert.match(libRs, /tauri_plugin_updater::Builder::new\(\)\.build\(\)/)
  assert.match(libRs, /tauri_plugin_process::init\(\)/)
  assert.match(releaseYml, /TAURI_SIGNING_PRIVATE_KEY/)
})
