import test from 'node:test'
import assert from 'node:assert/strict'
import { finishPomodoro } from '../src/lib/pomodoroSession.ts'

test('结束时才决定 completed/interrupted，短会话允许 0 分钟', () => {
  const started = new Date('2026-09-10T10:00:00.000Z')
  assert.deepEqual(finishPomodoro(started, new Date('2026-09-10T10:00:20.000Z'), false), { status: 'completed', actualMinutes: 0 })
  assert.equal(finishPomodoro(started, new Date('2026-09-10T10:05:00.000Z'), true).status, 'interrupted')
})
