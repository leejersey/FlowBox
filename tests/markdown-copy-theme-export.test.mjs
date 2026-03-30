import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('复制富文本应复用当前主题渲染后的代码块 HTML', async () => {
  const source = await readFile(new URL('../src/pages/MarkdownPage.tsx', import.meta.url), 'utf8')

  assert.ok(source.includes('previewRef.current.innerHTML'))
  assert.ok(source.includes('const activeCodeTheme = codeThemes[codeThemeName]'))
  assert.ok(source.includes('createMarkdownPreviewComponents(activeCodeTheme)'))
  assert.ok(source.includes("showToast('富文本排版已复制'"))
})
