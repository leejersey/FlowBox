import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildTextActionPrompt, cleanReplacement, filterTextSkills } from '../src/lib/textAction.ts'

test('技能指令：前缀拼接原文，系统提示附加「只输出结果」约束', () => {
  const { systemPrompt, input } = buildTextActionPrompt(
    { kind: 'skill', skill: { prompt_prefix: '帮我润色这段文字：\n\n', system_prompt: '你是资深编辑' } },
    '今天天气很好',
  )
  assert.equal(input, '帮我润色这段文字：\n\n今天天气很好')
  assert.match(systemPrompt, /^你是资深编辑\n\n/)
  assert.match(systemPrompt, /只输出处理后的结果本身/)
})

test('自定义指令置于原文之前', () => {
  const { input } = buildTextActionPrompt({ kind: 'custom', instruction: '  改成正式语气 ' }, 'hi there')
  assert.equal(input, '改成正式语气\n\nhi there')
})

test('清洗结果：去掉多余的整段代码块包裹，原文是代码块时保留', () => {
  assert.equal(cleanReplacement('```ts\nconst a = 1\n```', 'const a=1'), 'const a = 1')
  assert.equal(cleanReplacement('  润色后的文字\n', '原文'), '润色后的文字')
  assert.equal(cleanReplacement('```js\nx\n```', '```js\ny\n```'), '```js\nx\n```')
  assert.equal(cleanReplacement('前言 ```a``` 结尾', '原文'), '前言 ```a``` 结尾')
})

test('截图分析技能不出现在选中文字处理列表', () => {
  const skills = [{ id: 'builtin-polish' }, { id: 'builtin-analyze-img' }, { id: 'custom-1' }]
  assert.deepEqual(filterTextSkills(skills).map(s => s.id), ['builtin-polish', 'custom-1'])
})

test('选中文字浮窗已注册窗口、权限、快捷键、托盘与路由，并暂停剪贴板历史记录', async () => {
  const [confRaw, capRaw, libRs, trayRs, app, service, watcher] = await Promise.all([
    readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/capabilities/text-action.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/tray.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/services/text_action.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/services/clipboard_watcher.rs', import.meta.url), 'utf8'),
  ])
  const conf = JSON.parse(confRaw)
  assert.ok(conf.app.windows.some(w => w.label === 'text-action' && w.url === '/text-action' && w.visible === false))
  assert.ok(JSON.parse(capRaw).windows.includes('text-action'))
  assert.match(libRs, /Alt\+Shift\+KeyA/)
  assert.match(libRs, /commands::text_action::text_action_apply/)
  assert.match(trayRs, /text_action::trigger/)
  assert.match(app, /path="\/text-action"/)
  assert.match(service, /clipboard_watcher::suppress_for/)
  assert.match(service, /wait_modifiers_released/)
  assert.match(watcher, /if is_suppressed\(\)/)
})
