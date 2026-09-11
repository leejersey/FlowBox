import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const src = new URL('../src/', import.meta.url)

async function readSource(path) {
  return readFile(new URL(path, src), 'utf8')
}

async function readTsSources(dir = src) {
  const entries = await readdir(dir, { withFileTypes: true })
  const sources = await Promise.all(entries.map(async entry => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir)
    if (entry.isDirectory()) return readTsSources(url)
    return /\.tsx?$/.test(entry.name) ? readFile(url, 'utf8') : ''
  }))
  return sources.flat()
}

test('AppShell 是每日回顾的唯一 owner，并向 Settings 暴露 trigger', async () => {
  const [appShell, settings, ...sources] = await Promise.all([
    readSource('components/layout/AppShell.tsx'),
    readSource('pages/SettingsPage.tsx'),
    readTsSources(),
  ])

  assert.equal(sources.join('\n').match(/=\s*useDailyReview\(\)/g)?.length, 1)
  assert.match(appShell, /<Outlet\s+context=\{\{\s*triggerReview:\s*dailyReview\.triggerReview\s*\}\}\s*\/>/)
  assert.match(settings, /useOutletContext<[^>]*>/)
  assert.match(settings, /await triggerReview\(\)/)
  assert.doesNotMatch(settings, /useDailyReview/)
})

test('每日自动检查依赖持久化日期，不依赖一次性午夜 reset timer', async () => {
  const hook = await readSource('hooks/useDailyReview.ts')

  assert.match(hook, /dailyReviewService\.hasShownToday\(\)/)
  assert.doesNotMatch(hook, /hasAutoTriggeredRef/)
  assert.doesNotMatch(hook, /resetAtMidnight|msUntilMidnight/)
})

test('回顾使用聚合得到的业务日期标记已展示', async () => {
  const [hook, service] = await Promise.all([
    readSource('hooks/useDailyReview.ts'),
    readSource('services/dailyReviewService.ts'),
  ])

  assert.match(service, /markShown\(date\s*=\s*localDateKey\(\)\)/)
  assert.match(service, /settingsSet\(LAST_SHOWN_KEY,\s*date\)/)
  assert.match(hook, /markShown\(data\.date\)/)
})
