import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const hookUrl = new URL('../src/hooks/useDailyReview.ts', import.meta.url)

test('doReview 在首个 await 前锁定，并在 finally 释放', async () => {
  const hook = await readFile(hookUrl, 'utf8')

  assert.match(hook, /const inFlightRef = useRef\(false\)/)
  assert.match(hook, /const doReview[\s\S]*?if \(inFlightRef\.current\) return[\s\S]*?inFlightRef\.current = true[\s\S]*?try \{[\s\S]*?await dailyReviewService\.gatherTodayData\(\)/)
  assert.match(hook, /finally \{\s*inFlightRef\.current = false[\s\S]*?abortRef\.current === controller[\s\S]*?\}/)
  assert.match(hook, /const triggerReview[\s\S]*?await doReview\(\)/)
  assert.match(hook, /shouldTriggerDailyReview[\s\S]*?await doReview\(\)/)
})

test('卸载会 abort，且 await 恢复后不更新状态或启动 AI', async () => {
  const hook = await readFile(hookUrl, 'utf8')

  assert.match(hook, /const mountedRef = useRef\(false\)/)
  assert.match(hook, /useEffect\(\(\) => \{\s*mountedRef\.current = true[\s\S]*?return \(\) => \{\s*mountedRef\.current = false\s*abortRef\.current\?\.abort\(\)/)
  assert.match(hook, /await dailyReviewService\.gatherTodayData\(\)\s*if \(!mountedRef\.current \|\| controller\.signal\.aborted \|\| abortRef\.current !== controller\) return/)
  assert.match(hook, /await dailyReviewService\.markShown\(data\.date\)[\s\S]*?if \(!mountedRef\.current \|\| controller\.signal\.aborted \|\| abortRef\.current !== controller\) return/)
  assert.match(hook, /\(token\) => \{\s*if \(mountedRef\.current && !controller\.signal\.aborted\) \{\s*setAiSummary\(prev => prev \+ token\)/)
  assert.match(hook, /finally \{\s*if \(mountedRef\.current && !controller\.signal\.aborted\) setIsLoadingAi\(false\)/)
})

test('AI controller 仅由所属调用清理，close 仍可 abort', async () => {
  const hook = await readFile(hookUrl, 'utf8')

  assert.match(hook, /inFlightRef\.current = true[\s\S]*?const controller = new AbortController\(\)\s*abortRef\.current = controller[\s\S]*?await dailyReviewService\.gatherTodayData\(\)/)
  assert.match(hook, /await dailyReviewService\.gatherTodayData\(\)\s*if \(!mountedRef\.current \|\| controller\.signal\.aborted \|\| abortRef\.current !== controller\) return/)
  assert.match(hook, /await dailyReviewService\.markShown\(data\.date\)[\s\S]*?if \(!mountedRef\.current \|\| controller\.signal\.aborted \|\| abortRef\.current !== controller\) return/)
  assert.match(hook, /if \(abortRef\.current === controller\) abortRef\.current = null/)
  assert.match(hook, /const close[\s\S]*?abortRef\.current\.abort\(\)[\s\S]*?abortRef\.current = null[\s\S]*?setIsLoadingData\(false\)[\s\S]*?setIsLoadingAi\(false\)/)
})

test('markShown 失败不会阻断 AI 总结', async () => {
  const hook = await readFile(hookUrl, 'utf8')

  assert.match(hook, /try \{\s*await dailyReviewService\.markShown\(data\.date\)\s*\} catch \(err\) \{[\s\S]*?console\.warn[\s\S]*?\}\s*if \([^)]*controller\.signal\.aborted[^)]*\) return[\s\S]*?generateAiSummaryStream/)
})
