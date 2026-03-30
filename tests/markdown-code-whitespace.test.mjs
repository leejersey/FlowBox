import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Markdown 代码高亮应显式保留跨 token 空格', async () => {
  const source = await readFile(new URL('../src/pages/MarkdownPage.tsx', import.meta.url), 'utf8')

  assert.ok(
    source.includes('function mergeStandaloneWhitespaceTokens'),
    'MarkdownPage 应提供空白 token 合并辅助函数，避免复制后独立空格节点被目标编辑器吞掉'
  )
  assert.ok(
    source.includes('return mergeStandaloneWhitespaceTokens(result)'),
    'tokenizeCodeContent 应在返回前合并独立空白 token'
  )
  assert.ok(
    source.includes("whiteSpace: 'break-spaces'"),
    '代码 token span 应显式使用 break-spaces 保留空格'
  )
})
