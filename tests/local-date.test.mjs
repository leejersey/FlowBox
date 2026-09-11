import test from 'node:test'
import assert from 'node:assert/strict'
import { localDateKey, localDayBounds, localMondayStart } from '../src/lib/localDate.ts'

test('业务日期始终取本地日历而不是 UTC 切片', () => {
  const midnight = new Date(2026, 8, 10, 0, 5)
  assert.equal(localDateKey(midnight), '2026-09-10')
  const { start, end } = localDayBounds(midnight)
  assert.equal(start.getHours(), 0)
  assert.equal(end.getDate(), 11)
  assert.equal(localMondayStart(new Date(2026, 8, 13)).getDay(), 1)
})
