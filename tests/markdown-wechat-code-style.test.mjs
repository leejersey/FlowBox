import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Markdown 富文本预览应为代码块输出内联样式，兼容公众号复制', async () => {
  const source = await readFile(new URL('../src/pages/MarkdownPage.tsx', import.meta.url), 'utf8')

  assert.ok(
    source.includes('function createMarkdownPreviewComponents'),
    'MarkdownPage 应提供主题化的 markdownPreviewComponents 工厂'
  )
  assert.ok(
    source.includes("whiteSpace: 'pre-wrap'"),
    '代码块应显式设置 whiteSpace: pre-wrap，避免公众号编辑器折叠格式'
  )
  assert.ok(
    source.includes("fontFamily: \"'SFMono-Regular'"),
    '代码块应使用内联 monospace 字体样式，而不是依赖页面 class'
  )
  assert.ok(
    source.includes('<ReactMarkdown components={markdownPreviewComponents}>'),
    'ReactMarkdown 预览应接入自定义组件，输出带内联样式的 HTML'
  )
  assert.ok(
    source.includes('theme.tokens[token.type]'),
    '代码高亮颜色应由当前主题提供，而不是硬编码常量'
  )
  assert.ok(
    source.includes('theme.block.backgroundColor'),
    '代码块容器背景色应从主题对象读取'
  )
  assert.ok(
    source.includes('renderHighlightedCode(content, language, theme)'),
    '代码高亮渲染应接收当前主题'
  )
})
