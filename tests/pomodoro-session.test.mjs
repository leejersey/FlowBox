import test from 'node:test'
import assert from 'node:assert/strict'
import { finishPomodoro, finishPomodoroFromElapsed } from '../src/lib/pomodoroSession.ts'

test('结束时才决定 completed/interrupted，短会话允许 0 分钟', () => {
  const started = new Date('2026-09-10T10:00:00.000Z')
  assert.deepEqual(finishPomodoro(started, new Date('2026-09-10T10:00:20.000Z'), false), { status: 'completed', actualMinutes: 0 })
  assert.equal(finishPomodoro(started, new Date('2026-09-10T10:05:00.000Z'), true).status, 'interrupted')
})

test('按活跃秒数结算并限制在计划时长内', () => {
  assert.deepEqual(finishPomodoroFromElapsed(125, 1500, true), { status: 'interrupted', actualMinutes: 2 })
  assert.equal(finishPomodoroFromElapsed(9999, 1500, false).actualMinutes, 25)
  assert.equal(finishPomodoroFromElapsed(-10, 1500, true).actualMinutes, 0)
})
