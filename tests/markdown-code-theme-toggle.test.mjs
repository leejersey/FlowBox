import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('MarkdownPage 应提供页面内主题切换并恢复上次选择', async () => {
  const source = await readFile(new URL('../src/pages/MarkdownPage.tsx', import.meta.url), 'utf8')

  assert.ok(source.includes("const [codeThemeName, setCodeThemeName] = useState"))
  assert.ok(source.includes('loadCodeThemePreference'))
  assert.ok(source.includes('saveCodeThemePreference'))
  assert.ok(source.includes('亮色'))
  assert.ok(source.includes('暗色'))
})
