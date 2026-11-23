import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { extractButlerActions } from '../src/lib/butlerActions.ts'
import { DEFAULT_SESSION_TITLE, deriveSessionTitle } from '../src/lib/butlerSession.ts'

test('extractButlerActions 正确解析单个待办动作并剥离代码块', () => {
  const raw = `好的，已经帮你整理好待办：\n\n\`\`\`flowbox-action\n{"type":"create_todo","title":"体验 MCP 框架","priority":3,"due_date":"2026-11-25","tags":["AI","MCP"]}\n\`\`\``
  const parsed = extractButlerActions(raw)

  assert.equal(parsed.displayContent, '好的，已经帮你整理好待办：')
  assert.equal(parsed.actions.length, 1)
  assert.deepEqual(parsed.actions[0], {
    type: 'create_todo',
    title: '体验 MCP 框架',
    content: undefined,
    priority: 3,
    due_date: '2026-11-25',
    tags: ['AI', 'MCP'],
  })
})

test('extractButlerActions 支持数组多动作（待办 + 灵感 + 番茄）', () => {
  const raw = `已为你拆解计划：\n\`\`\`flowbox-action\n[\n  {"type":"create_todo","title":"完成接口联调","priority":2},\n  {"type":"create_idea","content":"把热榜做成每日自动推送","tags":["产品"]},\n  {"type":"start_pomodoro","duration_minutes":45,"mode":"focus","label":"深度开发"}\n]\n\`\`\``
  const parsed = extractButlerActions(raw)

  assert.equal(parsed.actions.length, 3)
  assert.equal(parsed.actions[0].type, 'create_todo')
  assert.equal(parsed.actions[1].type, 'create_idea')
  assert.deepEqual(parsed.actions[2], {
    type: 'start_pomodoro',
    duration_minutes: 45,
    mode: 'focus',
    label: '深度开发',
  })
})

test('extractButlerActions 流式输出未闭合动作块时不泄露原始 JSON', () => {
  const streaming = `正在帮你安排：\n\`\`\`flowbox-action\n{"type":"create_todo","title":"半截`
  const parsed = extractButlerActions(streaming)

  assert.equal(parsed.displayContent, '正在帮你安排：')
  assert.equal(parsed.actions.length, 0)
})

test('extractButlerActions 对非法 JSON 和无效动作类型安全忽略', () => {
  const broken = `测试\n\`\`\`flowbox-action\n{not-json}\n\`\`\`\n\`\`\`flowbox-action\n{"type":"unknown","title":"x"}\n\`\`\``
  const parsed = extractButlerActions(broken)

  assert.equal(parsed.displayContent, '测试')
  assert.equal(parsed.actions.length, 0)
})

test('deriveSessionTitle 自动过滤上下文标签并生成简洁会话标题', () => {
  assert.equal(
    deriveSessionTitle('[GitHub: acme/mcp] @热榜\n请帮我分析它的核心架构和优缺点'),
    '请帮我分析它的核心架构和优缺点',
  )
  assert.equal(deriveSessionTitle('   '), DEFAULT_SESSION_TITLE)
  assert.equal(
    deriveSessionTitle('这是一段非常非常长的用户提问内容用于测试标题自动截断功能是否生效', 10),
    '这是一段非常非常长的…',
  )
})

test('012_butler_sessions 迁移已注册到 lib.rs', async () => {
  const libRs = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8')
  assert.match(libRs, /012_butler_sessions\.sql/)
})
