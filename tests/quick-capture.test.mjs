import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseCaptureText, splitTodoText } from '../src/lib/quickCapture.ts'
import { focusModeTransition, isFocusActive } from '../src/lib/pomodoroFocusMode.ts'

test('快速记录提取 #标签 并去重，不误伤 URL 锚点与 C#', () => {
  assert.deepEqual(parseCaptureText('学习 Rust 宏 #rust #学习 #rust'), { body: '学习 Rust 宏', tags: ['rust', '学习'] })
  assert.deepEqual(parseCaptureText('#想法 开头的标签'), { body: '开头的标签', tags: ['想法'] })
  assert.deepEqual(parseCaptureText('看 https://a.com/#install 和 C# 文档'), {
    body: '看 https://a.com/#install 和 C# 文档',
    tags: [],
  })
  assert.deepEqual(parseCaptureText('  #只有标签  '), { body: '', tags: ['只有标签'] })
})

test('待办首行为标题，其余为备注', () => {
  assert.deepEqual(splitTodoText('写周报\n- 汇总数据\n- 发给老板'), { title: '写周报', content: '- 汇总数据\n- 发给老板' })
  assert.deepEqual(splitTodoText('单行待办'), { title: '单行待办', content: '' })
})

test('专注模式仅在专注计时跨越边界时触发', () => {
  const base = { is_running: true, type: 'focus', elapsed_seconds: 10, total_seconds: 1500, related_todo_id: null }
  assert.equal(isFocusActive(base), true)
  assert.equal(focusModeTransition(false, base), 'on')
  assert.equal(focusModeTransition(true, base), null, '计时 tick 不重复触发')
  assert.equal(focusModeTransition(true, { ...base, is_running: false }), 'off', '暂停退出专注')
  assert.equal(focusModeTransition(true, { ...base, elapsed_seconds: 1500 }), 'off', '倒计时结束')
  assert.equal(focusModeTransition(false, { ...base, type: 'short_break' }), null, '休息不开启专注')
})

test('快速记录浮窗已在 Tauri 窗口、权限、全局快捷键与托盘中配置', async () => {
  const [confRaw, capRaw, libRs, trayRs, app] = await Promise.all([
    readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/capabilities/quick-capture.json', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/tray.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  ])
  const conf = JSON.parse(confRaw)
  const cap = JSON.parse(capRaw)
  assert.ok(conf.app.windows.some(w => w.label === 'quick-capture' && w.url === '/quick-capture' && w.visible === false))
  assert.ok(cap.windows.includes('quick-capture'))
  assert.ok(cap.permissions.includes('core:event:allow-emit'), '浮窗需要广播数据变更事件')
  assert.match(libRs, /Alt\+Shift\+Space/)
  assert.match(libRs, /commands::quick_capture::hide_quick_capture/)
  assert.match(trayRs, /toggle_quick_capture/)
  assert.match(app, /path="\/quick-capture"/)
  assert.match(app, /usePomodoroFocusMode\(\)/)
})

test('主窗口列表监听跨窗口数据变更', async () => {
  const [todos, ideas, butler] = await Promise.all([
    readFile(new URL('../src/hooks/useTodos.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/hooks/useIdeas.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/butlerActionService.ts', import.meta.url), 'utf8'),
  ])
  assert.match(todos, /onDataChanged\('todo'/)
  assert.match(ideas, /onDataChanged\('idea'/)
  assert.match(butler, /emitDataChanged\('todo'\)/)
  assert.match(butler, /emitDataChanged\('idea'\)/)
})
