import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { RECOVER_RUNNING_SESSIONS_SQL } from '../src/lib/pomodoroSession.ts'

const migration = readFileSync(new URL('../src-tauri/migrations/007_pomodoro_running.sql', import.meta.url), 'utf8')
const service = readFileSync(new URL('../src/services/pomodoroService.ts', import.meta.url), 'utf8')

function database() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE pomodoro_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'focus',
    duration_minutes INTEGER,
    actual_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'completed',
    related_todo_id INTEGER,
    ai_summary TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT
  )`)
  return db
}

test('迁移清理伪 completed 后限制最多一条 running', () => {
  const db = database()
  db.exec("INSERT INTO pomodoro_sessions (status, started_at) VALUES ('completed', '2026-09-10T00:00:00Z')")
  db.exec(migration)
  assert.equal(db.prepare('SELECT status FROM pomodoro_sessions').get().status, 'interrupted')
  db.exec("INSERT INTO pomodoro_sessions (status, started_at) VALUES ('running', '2026-09-10T01:00:00Z')")
  assert.throws(
    () => db.exec("INSERT INTO pomodoro_sessions (status, started_at) VALUES ('running', '2026-09-10T02:00:00Z')"),
    /UNIQUE constraint failed/,
  )
})

test('恢复 running 的实际分钟始终是合法区间内整数', () => {
  const db = database()
  const insert = db.prepare('INSERT INTO pomodoro_sessions (duration_minutes, status, started_at) VALUES (?, \'running\', ?)')
  insert.run(25, '2026-09-10T09:55:00Z')
  insert.run(25, '2026-09-10T10:05:00Z')
  insert.run(-5, '2026-09-10T09:55:00Z')
  insert.run(25, 'invalid')
  db.prepare(RECOVER_RUNNING_SESSIONS_SQL).run({ $1: '2026-09-10T10:00:00Z' })
  assert.deepEqual(
    db.prepare('SELECT actual_minutes FROM pomodoro_sessions ORDER BY id').all().map(row => row.actual_minutes),
    [5, 0, 0, 0],
  )
})

test('服务持久化路径不靠写后 SELECT，并包含暂停刷新、失败恢复及 stop 重入保护', () => {
  assert.doesNotMatch(service, /SELECT \* FROM pomodoro_sessions WHERE id/)
  assert.match(service, /pomodoroPause[\s\S]*refreshElapsed[\s\S]*clearInterval/)
  assert.match(service, /finishPomodoroFromElapsed\(timerState\.elapsed_seconds/)
  assert.match(service, /stopPromise/)
  assert.match(service, /try[\s\S]*getDb\(\)[\s\S]*db\.execute[\s\S]*catch[\s\S]*setInterval/)
})
