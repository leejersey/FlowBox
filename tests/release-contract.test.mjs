import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const [packageSource, packageLockSource, cargo, cargoLock, tauriSource, readme, ci] = await Promise.all([
  read('package.json'),
  read('package-lock.json'),
  read('src-tauri/Cargo.toml'),
  read('src-tauri/Cargo.lock'),
  read('src-tauri/tauri.conf.json'),
  read('README.md'),
  read('.github/workflows/ci.yml').catch(() => ''),
])
const pkg = JSON.parse(packageSource)
const packageLock = JSON.parse(packageLockSource)
const tauri = JSON.parse(tauriSource)

test('npm、Cargo 与 Tauri 发布版本统一为 0.5.0', () => {
  assert.equal(pkg.version, '0.5.0')
  assert.equal(packageLock.packages[''].version, '0.5.0')
  assert.match(cargo, /^\[package\]\s+name = "flowbox"\s+version = "0\.5\.0"/m)
  assert.match(cargoLock, /\[\[package\]\]\s+name = "flowbox"\s+version = "0\.5\.0"/m)
  assert.equal(tauri.version, '0.5.0')
})

test('React Router 保持 major 7 并采用修复后的兼容版本范围', () => {
  assert.equal(pkg.dependencies['react-router-dom'], '^7.14.1')
  assert.match(packageLock.packages['node_modules/react-router-dom'].version, /^7\./)
})

test('README 准确说明安全存储、OCR、关联、自启动与 usage 行为', () => {
  assert.match(readme, /macOS Keychain/)
  assert.match(readme, /AI 与 ASR[^\n]*凭据[^\n]*Keychain/)
  assert.match(readme, /迁移成功后[^\n]*SQLite[^\n]*明文/)
  assert.match(readme, /OpenAI[^\n]*直接[^\n]*Vision/)
  assert.match(readme, /DeepSeek[^\n]*Ollama[^\n]*macOS Vision OCR[^\n]*文本/)
  assert.match(readme, /待办[^\n]*灵感[^\n]*语音[^\n]*剪贴板[^\n]*双向[^\n]*查看[^\n]*跳转[^\n]*删除/)
  assert.match(readme, /官方 autostart 插件[^\n]*插件实际状态/)
  assert.match(readme, /应用使用追踪[^\n]*周期[^\n]*增量/)
  assert.match(readme, /docs\/ui_assets/)
  assert.doesNotMatch(readme, /PaddleOCR|SkillsPage|src\/models/)
  assert.doesNotMatch(readme, /DeepSeek[^\n]*(?:直接|原生|支持)\s*(?:AI\s*)?Vision/)
})

test('CI 在 macOS、Node 24 与 stable Rust 上执行完整检查', () => {
  assert.match(ci, /runs-on:\s*macos-latest/)
  assert.match(ci, /uses:\s*actions\/checkout@v4/)
  assert.match(ci, /uses:\s*actions\/setup-node@v4[\s\S]*node-version:\s*24/)
  assert.match(ci, /uses:\s*dtolnay\/rust-toolchain@stable/)

  const commands = [
    'npm ci',
    'npm run check',
    'npm run check:rust',
    'npm audit --omit=dev --audit-level=high',
  ]
  let position = -1
  for (const command of commands) {
    const next = ci.indexOf(`run: ${command}`)
    assert.ok(next > position, `${command} 应存在并保持要求顺序`)
    position = next
  }
})
