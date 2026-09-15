import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { notifySubscribers } from '../src/lib/notifySubscribers.ts'

const [service, statusBar] = await Promise.all([
  readFile(new URL('../src/services/pomodoroService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/layout/StatusBar.tsx', import.meta.url), 'utf8'),
])

function bodyBetween(start, end) {
  const from = service.indexOf(start)
  const to = service.indexOf(end, from)
  assert.notEqual(from, -1, `missing ${start}`)
  assert.notEqual(to, -1, `missing ${end}`)
  return service.slice(from, to)
}

test('订阅者抛错不阻断后续订阅者且通知不抛错', () => {
  const received = []
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    assert.doesNotThrow(() => notifySubscribers(new Set([
      () => { throw new Error('boom') },
      value => received.push(value),
    ]), () => ({ elapsed_seconds: 1 })))
  } finally {
    console.error = originalError
  }

  assert.deepEqual(received, [{ elapsed_seconds: 1 }])
  assert.equal(errors.length, 1)
})

test('tick 和 complete 注册为可解订的多订阅者', () => {
  assert.match(service, /const tickCallbacks = new Set<TickCallback>\(\)/)
  assert.match(service, /const completeCallbacks = new Set<CompleteCallback>\(\)/)
  assert.match(service, /pomodoroOnTick[\s\S]*tickCallbacks\.add\(cb\)[\s\S]*return \(\) => \{\s*tickCallbacks\.delete\(cb\)\s*\}/)
  assert.match(service, /pomodoroOnComplete[\s\S]*completeCallbacks\.add\(cb\)[\s\S]*return \(\) => \{\s*completeCallbacks\.delete\(cb\)\s*\}/)
})

test('通知遍历订阅者快照且每个 tick 回调获得独立 state 副本', () => {
  assert.match(service, /notifySubscribers\(tickCallbacks, \(\) => \(\{ \.\.\.timerState \}\)\)/)
  assert.match(service, /notifySubscribers\(completeCallbacks, \(\) => \(\{ \.\.\.session \}\)\)/)
})

test('所有计时状态转换均通知且失败 stop 不发布重置状态', () => {
  for (const [start, end] of [
    ['export async function pomodoroStart', '/** pomodoro_pause'],
    ['export function pomodoroPause', '/** pomodoro_resume'],
    ['export function pomodoroResume', '/** pomodoro_stop'],
    ['function tick()', 'function refreshElapsed()'],
  ]) {
    assert.match(bodyBetween(start, end), /notifyTick\(\)/)
  }

  const stop = bodyBetween('async function stopCurrentPomodoro', '/** pomodoro_get_state')
  const reset = stop.lastIndexOf('timerState = {')
  const notify = stop.lastIndexOf('notifyTick()')
  assert.ok(reset >= 0 && notify > reset, 'successful stop must notify only after state reset')
  assert.doesNotMatch(stop.slice(0, reset), /notifyTick\(\)/)
  assert.match(bodyBetween('function tick()', 'function refreshElapsed()'), /pomodoroStop\(false\)[\s\S]*notifyComplete\(session\)/)
})

test('StatusBar effect 直接返回 tick unsubscribe', () => {
  assert.match(statusBar, /useEffect\(\(\) => \{[\s\S]*return pomodoroOnTick\(/)
})
