import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldTriggerDailyReview } from '../src/lib/dailyReviewSchedule.ts'

test('晚于目标小时启动仍触发且无效时间不触发', () => {
  assert.equal(shouldTriggerDailyReview(new Date(2026, 8, 10, 22, 0), '21:30', false), true)
  assert.equal(shouldTriggerDailyReview(new Date(2026, 8, 10, 21, 29), '21:30', false), false)
  assert.equal(shouldTriggerDailyReview(new Date(), '25:99', false), false)
  assert.equal(shouldTriggerDailyReview(new Date(), '21:30', true), false)
})
