import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createPomodoroBridge } from '../src/lib/pomodoroBridge.ts'

function createBus() {
  const handlers = new Map()
  return {
    async emit(event, payload) {
      for (const h of handlers.get(event) ?? []) queueMicrotask(() => h(structuredClone(payload)))
    },
    async listen(event, handler) {
      const set = handlers.get(event) ?? new Set()
      set.add(handler)
      handlers.set(event, set)
      return () => set.delete(handler)
    },
    count: event => handlers.get(event)?.size ?? 0,
  }
}

function setup({ startImpl, timeoutMs } = {}) {
  const bus = createBus()
  const started = []
  const start = startImpl ?? (async payload => { started.push(payload) })
  const main = createPomodoroBridge({ isMainWindow: () => true, start, emit: bus.emit, emitToMain: bus.emit, listen: bus.listen })
  const butler = createPomodoroBridge({
    isMainWindow: () => false,
    start: async () => { throw new Error('浮窗不应直接启动番茄钟') },
    emit: bus.emit,
    emitToMain: bus.emit,
    listen: bus.listen,
    timeoutMs,
  })
  return { bus, started, main, butler }
}

test('浮窗启动番茄钟由主窗口执行，并清理结果监听', async () => {
  const { bus, started, main, butler } = setup()
  await main.serveRequests()
  await butler.requestStart({ type: 'focus', duration_minutes: 45 })
  assert.deepEqual(started, [{ type: 'focus', duration_minutes: 45 }])
  assert.equal(bus.count('flowbox:pomodoro-start-result'), 0)
})

test('主窗口启动失败时错误回传给浮窗', async () => {
  const { main, butler } = setup({ startImpl: async () => { throw new Error('POMODORO_ALREADY_RUNNING') } })
  await main.serveRequests()
  await assert.rejects(butler.requestStart({ type: 'focus', duration_minutes: 25 }), /POMODORO_ALREADY_RUNNING/)
})

test('主窗口未响应时超时报错', async () => {
  const { butler } = setup({ timeoutMs: 20 })
  await assert.rejects(butler.requestStart({ type: 'focus', duration_minutes: 25 }), /超时/)
})

test('主窗口内直接启动，不经过事件', async () => {
  const { bus, started, main } = setup()
  await main.requestStart({ type: 'short_break', duration_minutes: 5 })
  assert.deepEqual(started, [{ type: 'short_break', duration_minutes: 5 }])
  assert.equal(bus.count('flowbox:pomodoro-start-request'), 0)
})

test('Butler 动作经由跨窗口桥启动番茄钟，主窗口注册请求处理', async () => {
  const [butler, app] = await Promise.all([
    readFile(new URL('../src/services/butlerActionService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  ])
  assert.match(butler, /requestPomodoroStart\(/)
  assert.doesNotMatch(butler, /pomodoroService\.pomodoroStart/)
  assert.match(app, /registerMainWindowListener\(windowLabel, servePomodoroStartRequests\)/)
})
