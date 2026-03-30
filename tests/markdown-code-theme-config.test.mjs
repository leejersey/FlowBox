import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('代码主题模块应提供 light/dark 两套主题定义', async () => {
  const source = await readFile(new URL('../src/features/markdown/codeThemes.ts', import.meta.url), 'utf8')

  assert.ok(source.includes("export type CodeThemeName = 'light' | 'dark'"))
  assert.ok(source.includes('export const codeThemes'))
  assert.ok(source.includes('light: {'))
  assert.ok(source.includes('dark: {'))
  assert.ok(source.includes('inlineCode'))
  assert.ok(source.includes('tokens'))
})
