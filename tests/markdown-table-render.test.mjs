import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Markdown 预览应支持 GFM 表格并输出可复制的内联表格样式', async () => {
  const source = await readFile(new URL('../src/pages/MarkdownPage.tsx', import.meta.url), 'utf8')

  assert.ok(
    source.includes("import remarkGfm from 'remark-gfm'"),
    'MarkdownPage 应引入 remark-gfm 解析 GFM 表格'
  )
  assert.ok(
    source.includes('remarkPlugins={[remarkGfm]}'),
    'ReactMarkdown 应接入 remark-gfm'
  )
  assert.ok(
    source.includes('table: ({ children }) =>'),
    'markdownPreviewComponents 应为 table 提供自定义渲染'
  )
  assert.ok(
    source.includes("borderCollapse: 'collapse'"),
    '表格渲染应使用内联样式，确保复制后可见'
  )
  assert.ok(
    source.includes('th: ({ children }) =>'),
    '表头单元格应有自定义渲染'
  )
  assert.ok(
    source.includes('td: ({ children }) =>'),
    '表格单元格应有自定义渲染'
  )
})
