import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('代码主题偏好应使用 markdown.codeTheme 键并对脏值回退 dark', async () => {
  const source = await readFile(new URL('../src/features/markdown/codeThemePreference.ts', import.meta.url), 'utf8')

  assert.ok(source.includes("const CODE_THEME_STORAGE_KEY = 'markdown.codeTheme'"))
  assert.ok(source.includes("return 'dark'"))
  assert.ok(source.includes("theme === 'light' || theme === 'dark'"))
})
