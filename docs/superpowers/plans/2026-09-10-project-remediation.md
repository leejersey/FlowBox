# FlowBox Project Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 FlowBox 当前正确性、安全性、生命周期、质量和性能问题，并让 README 已承诺的自启动、跨模块关联与 DeepSeek/Ollama 截图 OCR 成为可验收的真实功能。

**Architecture:** 保持 React 19 + Tauri 2 + SQLite 的现有分层；业务日期、调度判定和状态转换提取为小型纯函数，数据库和 Tauri IPC 保持在既有 service/hook 边界。Rust 只增加 macOS Keychain、Vision OCR、autostart 和周期追踪所需的最小实现，不引入通用框架或跨平台抽象。

**Tech Stack:** TypeScript 5.9、React 19、React Router 7、Node 24 `node:test`、Vite 8、ESLint 9、Tauri 2、Rust 2021、SQLite、macOS Keychain/Vision、官方 Tauri autostart plugin。

---

## 最终文件结构

以下是本计划完成后的文件级变更；未列出的现有文件保持不动，`docs/ui_assets/**` 明确保留。

### 创建

- `.github/workflows/ci.yml` — macOS 上安装依赖并执行前端、Rust、audit 检查。
- `src/lib/localDate.ts` — 本地日期键、本地日界、本地周一和时间标签。
- `src/lib/dailyReviewSchedule.ts` — 每日回顾时间解析与触发纯函数。
- `src/lib/pomodoroSession.ts` — 番茄结束状态和实际分钟数纯函数。
- `src/lib/itemLink.ts` — 无副作用的关联端点规范化函数。
- `src/services/appInitializationService.ts` — main window 独占、StrictMode 幂等的应用级恢复编排。
- `src/services/backgroundSettingsService.ts` — DB 就绪后的后台开关恢复，以及命令成功后持久化。
- `src/services/secretService.ts` — 固定敏感键的 Keychain 读取、写入、存在性与旧 SQLite 迁移。
- `src/lib/ocrRouting.ts` — OCR provider 分流与模型 JSON 结果规范化。
- `src/components/links/LinkPanel.tsx` — 四类实体共用的搜索、创建、反向展示、跳转、删除面板。
- `src-tauri/src/commands/secrets.rs` — Keychain IPC commands。
- `src-tauri/src/services/secrets.rs` — macOS Keychain 白名单存取。
- `src-tauri/src/commands/ocr.rs` — `ocr_recognize_text` IPC command。
- `src-tauri/src/services/ocr.rs` — 路径限制、Vision 文字识别和错误分类。
- `src-tauri/migrations/007_pomodoro_running.sql` — 修正历史伪 completed 会话。
- `src-tauri/migrations/008_app_usage_unique.sql` — 合并重复使用记录并增加三列唯一索引。
- `src-tauri/migrations/009_item_links_canonical.sql` — 清理反向重复、规范化端点并增加数据库级无向 expression UNIQUE index。
- `tests/project-quality-baseline.test.mjs` — scripts 与 ESLint ignore 局部守卫。
- `tests/main-window-effects.test.mjs` — 双窗口/StrictMode 下副作用只执行一次及降级后仍 ready 的行为契约。
- `tests/local-date.test.mjs` — 午夜、周界和日界行为测试。
- `tests/daily-review-trigger.test.mjs` — 跨小时、迟启动和非法配置测试。
- `tests/pomodoro-session.test.mjs` — running/完成/中断状态转换测试。
- `tests/background-services.test.mjs` — 后台设置恢复、回滚顺序与追踪 upsert 契约。
- `tests/secret-migration.test.mjs` — Keychain 成功后才删除 SQLite 明文的行为测试。
- `tests/autostart-settings.test.mjs` — 插件真实状态优先的行为测试。
- `tests/ocr-routing.test.mjs` — OpenAI Vision 与本地 OCR 分流测试。
- `tests/item-links.test.mjs` — 端点规范化、反向去重和 SQLite 约束测试。
- `tests/dead-code.test.mjs` — 删除清单与 Rust module 声明守卫。
- `tests/route-loading.test.mjs` — 路由级懒加载守卫。
- `tests/release-contract.test.mjs` — 版本、README、安全说明和 capability 守卫。

### 修改

- `package.json`, `package-lock.json` — 检查脚本、React Router 安全升级、autostart 前端依赖、版本号。
- `eslint.config.js` — 只扫描产品代码，忽略工作树、Rust target、依赖和生成物。
- `src/App.tsx` — 路由级 `React.lazy`/`Suspense`；只在 main window 常驻挂载 clipboard persistence 与 usage subscriber，并继续以数据库 ready gate 控制页面渲染。
- `src/hooks/useDatabase.ts` — 每窗数据库就绪；仅 main window 执行一次恢复/迁移/后台同步，非关键失败不阻塞 ready。
- `src/services/statsService.ts`, `src/services/dailyReviewService.ts`, `src/services/trendingService.ts`, `src/services/pomodoroService.ts`, `src/services/appUsageService.ts` — 统一本地时间范围、正确统计与原子写入。
- `src/pages/PomodoroPage.tsx`, `src/pages/VoicePage.tsx` — 使用本地日期工具显示/分组；正确展示 running。
- `src/hooks/useDailyReview.ts` — 使用纯触发判定。
- `src/types/pomodoro.ts` — 增加 `running`。
- `src/hooks/useClipboardWatcher.ts`, `src/hooks/useAppUsageTracker.ts` — 拆分剪贴板持久化与页面 controls，应用级 listener 仅 main window 注册并安全释放。
- `src/pages/SettingsPage.tsx` — 后台命令先于持久化、Keychain 掩码、自启动真实状态。
- `src/hooks/useSettings.ts`, `src/services/settingsService.ts`, `src/services/aiService.ts`, `src/hooks/useVoiceTranscribe.ts` — 敏感设置专用存取与旧值迁移。
- `src/services/screenshotOcrService.ts` — provider 分流、本地 OCR + 文本模型整理、明确错误。
- `src/services/linkService.ts`, `src/services/searchService.ts` — 无向关联、面板搜索和实体摘要。
- `src/components/todo/TodoDetailModal.tsx`, `src/pages/IdeaPage.tsx`, `src/pages/VoicePage.tsx`, `src/pages/ClipboardPage.tsx` — 接入关联面板并消费 `highlight`。
- `src/components/ui/CodeBlock.tsx`, `src/components/ui/ImageLightbox.tsx`, `src/hooks/useTodos.ts` — 5 个当前 TypeScript 阻塞。
- `src/components/butler/ChatMessageItem.tsx`, `src/components/layout/TitleBar.tsx`, `src/components/ui/VirtualList.tsx`, `src/hooks/useDebounce.ts`, `src/pages/MarkdownPage.tsx`, `src/pages/StatsPage.tsx` — 当前 ESLint 问题的最小修正。
- `src-tauri/src/lib.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/services/mod.rs`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json` — migrations、commands、原生依赖、capabilities、CSP 与版本。
- `src-tauri/src/services/app_usage_tracker.rs` — 固定周期增量与 Rust 端本地时间归属。
- `README.md` — 实际功能、安全存储、OCR 流程、自启动、关联入口、Roadmap 和版本。

### 删除

- `src/pages/SkillsPage.tsx`, `src/App.css`, `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`。
- `src-tauri/src/services/mod_placeholder.rs`, `src-tauri/src/errors.rs`, `src-tauri/src/models/**`, `remove_bg.py`。

---

### Task 1: 建立可重复的局部质量基线

**Files:**
- Create: `tests/project-quality-baseline.test.mjs`
- Modify: `package.json:6-12`
- Modify: `eslint.config.js:1-21`

- [ ] **Step 1: 先写失败的质量基线测试**

```js
// tests/project-quality-baseline.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('项目提供统一检查脚本并隔离生成物', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  const eslint = await readFile(new URL('../eslint.config.js', import.meta.url), 'utf8')
  assert.equal(pkg.scripts.test, 'node --test')
  assert.match(pkg.scripts.check, /build.*lint.*test/)
  assert.match(pkg.scripts['check:rust'], /cargo check.*cargo test/)
  for (const ignored of ['.worktrees/**', 'src-tauri/target/**', 'node_modules/**']) assert.ok(eslint.includes(ignored))
})
```

- [ ] **Step 2: 运行并确认测试失败**

Run: `node --test tests/project-quality-baseline.test.mjs`

Expected: FAIL，至少提示缺少 `test`/`check`/`check:rust` 或 ignore。

- [ ] **Step 3: 增加最小 scripts 和 ignore**

`package.json` 使用现有工具，不新增测试框架：

```json
"test": "node --test",
"check": "npm run build && npm run lint && npm test",
"check:rust": "cargo check --manifest-path src-tauri/Cargo.toml && cargo test --manifest-path src-tauri/Cargo.toml"
```

`eslint.config.js` 的首个配置改为：

```js
globalIgnores(['dist/**', '.worktrees/**', 'src-tauri/target/**', 'node_modules/**'])
```

- [ ] **Step 4: 运行局部检查并确认通过**

Run: `node --test tests/project-quality-baseline.test.mjs && node --test`

Expected: 新测试 PASS；现有 35 个测试继续 PASS。

- [ ] **Step 5: 提交**

```bash
git add package.json eslint.config.js tests/project-quality-baseline.test.mjs
git commit -m "chore: establish project quality checks"
```

### Task 2: 清除当前 5 个 TypeScript 构建阻塞

**Files:**
- Create: `tests/typescript-build.test.mjs`
- Modify: `src/components/ui/CodeBlock.tsx:1`
- Modify: `src/components/ui/ImageLightbox.tsx:1-2`
- Modify: `src/hooks/useTodos.ts:50-66`
- Modify: `src/pages/ClipboardPage.tsx:470-477`

- [ ] **Step 1: 把当前编译失败固化为可运行检查**

```js
// tests/typescript-build.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('tsc -b 无错误', () => {
  const run = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
})
```

- [ ] **Step 2: 运行并确认准确失败在 5 个错误**

Run: `node --test tests/typescript-build.test.mjs`

Expected: FAIL，列出 `CodeBlock` 1 个、`ImageLightbox` 2 个、`useTodos` tags 1 个、`ClipboardPage` 占位组件 1 个错误。

- [ ] **Step 3: 做最小修正**

删除三个未使用 import 和整个未使用 `ClipboardItemPlaceholder`。`useTodos` 乐观更新不要把 `UpdateTodoPayload.tags: string[]` 直接覆盖 `Todo.tags: string`：

```ts
const patch = { ...payload, tags: payload.tags === undefined ? undefined : JSON.stringify(payload.tags) }
return prev.map(todo => todo.id === payload.id ? { ...todo, ...patch } : todo)
```

确保不把 `tags: undefined` 覆盖原值，可在 spread 前移除 undefined，或只对已定义字段赋值。

- [ ] **Step 4: 运行并确认通过**

Run: `node --test tests/typescript-build.test.mjs && npx tsc -b`

Expected: PASS，0 TypeScript errors。后续每个任务都必须运行 `npx tsc -b` 并保持绿灯，不再接受“仍只有原 5 个错误”。

- [ ] **Step 5: 提交**

```bash
git add src/components/ui/CodeBlock.tsx src/components/ui/ImageLightbox.tsx src/hooks/useTodos.ts src/pages/ClipboardPage.tsx tests/typescript-build.test.mjs
git commit -m "fix: clear TypeScript build blockers"
```

### Task 3: 统一本地日期边界并修复每日回顾触发

**Files:**
- Create: `src/lib/localDate.ts`
- Create: `src/lib/dailyReviewSchedule.ts`
- Create: `tests/local-date.test.mjs`
- Create: `tests/daily-review-trigger.test.mjs`
- Modify: `src/services/statsService.ts:30-184`
- Modify: `src/services/dailyReviewService.ts:41-107,208-220`
- Modify: `src/services/trendingService.ts:20-109`
- Modify: `src/services/pomodoroService.ts:187-213`
- Modify: `src/hooks/useDailyReview.ts:111-140`
- Modify: `src/pages/PomodoroPage.tsx:96-104`
- Modify: `src/pages/VoicePage.tsx:19-26`

- [ ] **Step 1: 写午夜、周界、迟启动和非法配置的失败测试**

```js
// tests/local-date.test.mjs
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
```

```js
// tests/daily-review-trigger.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldTriggerDailyReview } from '../src/lib/dailyReviewSchedule.ts'

test('晚于目标小时启动仍触发且无效时间不触发', () => {
  assert.equal(shouldTriggerDailyReview(new Date(2026, 8, 10, 22, 0), '21:30', false), true)
  assert.equal(shouldTriggerDailyReview(new Date(2026, 8, 10, 21, 29), '21:30', false), false)
  assert.equal(shouldTriggerDailyReview(new Date(), '25:99', false), false)
  assert.equal(shouldTriggerDailyReview(new Date(), '21:30', true), false)
})
```

- [ ] **Step 2: 运行并确认缺少模块而失败**

Run: `node --test tests/local-date.test.mjs tests/daily-review-trigger.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现最小本地日期和触发纯函数**

```ts
// src/lib/localDate.ts
export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function localDayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString() }
}

export function localMondayStart(date = new Date()): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}
```

```ts
// src/lib/dailyReviewSchedule.ts
export function shouldTriggerDailyReview(now: Date, value: string, alreadyShown: boolean): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (alreadyShown || !match) return false
  const hour = Number(match[1]), minute = Number(match[2])
  return hour < 24 && minute < 60 && now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute
}
```

把 `statsService`、`dailyReviewService` 的“今日”SQL 改为 `timestamp >= $start AND timestamp < $end`；小时分组在 JS 中按 `new Date(row.started_at).getHours()` 聚合，避免 SQLite 按 UTC 解释。Trending 缓存键、Pomodoro 趋势日期、Pomodoro/Voice 页面今日标签统一使用 `localDateKey`；ISO 时间戳写入仍保持不变。

- [ ] **Step 4: 使用纯函数替换 Hook 内比较并执行检查**

`useDailyReview` 保留“今天已显示”数据库检查，再调用：

```ts
if (shouldTriggerDailyReview(new Date(), time, hasShown)) {
  hasAutoTriggeredRef.current = true
  await doReview()
}
```

Run: `node --test tests/local-date.test.mjs tests/daily-review-trigger.test.mjs && npm test && npx tsc -b`

Expected: 两个新行为测试和全部既有 Node tests PASS；`npx tsc -b` 继续保持 0 error。

- [ ] **Step 5: 提交**

```bash
git add src/lib/localDate.ts src/lib/dailyReviewSchedule.ts src/services/statsService.ts src/services/dailyReviewService.ts src/services/trendingService.ts src/services/pomodoroService.ts src/hooks/useDailyReview.ts src/pages/PomodoroPage.tsx src/pages/VoicePage.tsx tests/local-date.test.mjs tests/daily-review-trigger.test.mjs
git commit -m "fix: use local calendar boundaries"
```

### Task 4: 修复番茄钟 running 生命周期与统计

**Files:**
- Create: `src/lib/pomodoroSession.ts`
- Create: `src-tauri/migrations/007_pomodoro_running.sql`
- Create: `tests/pomodoro-session.test.mjs`
- Modify: `src/types/pomodoro.ts:7-20`
- Modify: `src/services/pomodoroService.ts:44-138,187-213`
- Modify: `src/pages/PomodoroPage.tsx:244-273`
- Modify: `src-tauri/src/lib.rs:12-49`

- [ ] **Step 1: 写状态转换失败测试**

```js
// tests/pomodoro-session.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { finishPomodoro } from '../src/lib/pomodoroSession.ts'

test('结束时才决定 completed/interrupted，短会话允许 0 分钟', () => {
  const started = new Date('2026-09-10T10:00:00.000Z')
  assert.deepEqual(finishPomodoro(started, new Date('2026-09-10T10:00:20.000Z'), false), { status: 'completed', actualMinutes: 0 })
  assert.equal(finishPomodoro(started, new Date('2026-09-10T10:05:00.000Z'), true).status, 'interrupted')
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/pomodoro-session.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现最小状态转换、running 写入和孤儿结算**

```ts
// src/lib/pomodoroSession.ts
export function finishPomodoro(startedAt: Date, endedAt: Date, interrupted: boolean) {
  return {
    status: interrupted ? 'interrupted' as const : 'completed' as const,
    actualMinutes: Math.round(Math.max(0, endedAt.getTime() - startedAt.getTime()) / 60_000),
  }
}
```

`pomodoroStart` 的 INSERT 改为 `status = 'running'`；`pomodoroStop` 复用 `finishPomodoro`；`PomodoroSession.status` 加 `'running'`。新增 `recoverRunningSessions()`，把它注册为 Task 5 的 main window 初始化步骤，而不是在每个窗口的 `useDatabase` 中直接执行；它只处理 `status='running'` 的遗留行，写为 `interrupted`、设置 `ended_at`，实际分钟上限为配置时长，避免隔夜退出被算成超长专注。

迁移只修已存在的伪完成记录，不猜测其实际时长：

```sql
UPDATE pomodoro_sessions
SET status = 'interrupted'
WHERE status = 'completed' AND ended_at IS NULL AND actual_minutes IS NULL;
```

在 `lib.rs` 以 version 7 注册迁移；所有 session count 使用 `ended_at IS NOT NULL`，completed count 继续限定 `status='completed'`。

- [ ] **Step 4: 验证行为、迁移和 Rust 注册**

Run: `node --test tests/pomodoro-session.test.mjs && rg -n "version: 7|007_pomodoro_running|status.*running|ended_at IS NOT NULL" src-tauri/src/lib.rs src/services/pomodoroService.ts src-tauri/migrations/007_pomodoro_running.sql && npx tsc -b`

Expected: 测试 PASS；四个契约均能匹配。

- [ ] **Step 5: 提交**

```bash
git add src/lib/pomodoroSession.ts src/types/pomodoro.ts src/services/pomodoroService.ts src/pages/PomodoroPage.tsx src-tauri/migrations/007_pomodoro_running.sql src-tauri/src/lib.rs tests/pomodoro-session.test.mjs
git commit -m "fix: model pomodoro running sessions"
```

### Task 5: 统一 main window 初始化、剪贴板/应用追踪同步与周期增量

**Files:**
- Create: `src/services/appInitializationService.ts`
- Create: `src/services/backgroundSettingsService.ts`
- Create: `src-tauri/migrations/008_app_usage_unique.sql`
- Create: `tests/background-services.test.mjs`
- Create: `tests/main-window-effects.test.mjs`
- Modify: `src/App.tsx:1-80`
- Modify: `src/hooks/useDatabase.ts:15-53`
- Modify: `src/pages/SettingsPage.tsx:379-410`
- Modify: `src/pages/ClipboardPage.tsx:35-468`
- Modify: `src/hooks/useClipboardWatcher.ts:46-130`
- Modify: `src/hooks/useAppUsageTracker.ts:12-40`
- Modify: `src/services/appUsageService.ts:9-78`
- Modify: `src-tauri/src/services/app_usage_tracker.rs:13-89`
- Modify: `src-tauri/src/lib.rs:12-49`
- Modify: `src-tauri/Cargo.toml:18-30`

- [ ] **Step 1: 写 main window 独占、StrictMode 幂等、后台同步和增量落库的失败测试**

```js
// tests/background-services.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { syncBackgroundSettings, applyBackgroundSetting } from '../src/services/backgroundSettingsService.ts'

test('启动默认开启剪贴板、关闭追踪，命令成功后才写 DB', async () => {
  const calls = []
  const deps = {
    get: async key => key === 'clipboard.auto_watch' ? null : 'false',
    set: async (key, value) => calls.push(['set', key, value]),
    invoke: async (command, payload) => calls.push(['invoke', command, payload]),
  }
  await syncBackgroundSettings(deps)
  assert.deepEqual(calls[0], ['invoke', 'clipboard_set_watch', { enabled: true }])
  assert.ok(calls.find(c => c[0] === 'invoke' && c[1] === 'app_usage_set_tracking'))

  calls.length = 0
  await applyBackgroundSetting('general.app_tracking', true, deps)
  assert.equal(calls[0][0], 'invoke')
  assert.equal(calls[1][0], 'set')
})
```

```js
// tests/main-window-effects.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeAppWindow, registerMainWindowListener, shouldPersistUsageTick } from '../src/services/appInitializationService.ts'

test('双窗口和 StrictMode 重挂载只执行一次应用级写操作', async () => {
  const calls = []
  const steps = [['recover', async () => calls.push('recover')]]
  await Promise.all([
    initializeAppWindow('main', steps),
    initializeAppWindow('main', steps),
    initializeAppWindow('butler', steps),
  ])
  assert.deepEqual(calls, ['recover'])
  assert.equal(shouldPersistUsageTick('main'), true)
  assert.equal(shouldPersistUsageTick('butler'), false)
})

test('剪贴板只有 App 常驻 persistence subscriber，页面不得再次写库', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const clipboard = await readFile(new URL('../src/pages/ClipboardPage.tsx', import.meta.url), 'utf8')
  assert.equal(app.match(/useClipboardPersistence\(/g)?.length, 1)
  assert.match(clipboard, /useClipboardControls\(/)
  assert.doesNotMatch(clipboard, /useClipboardPersistence|clipCreate/)
})

test('异步 listen 晚到时仍安全清理，Butler 不订阅', async () => {
  let resolveListen
  let unlistenCalls = 0
  const cleanup = registerMainWindowListener('main', () => new Promise(resolve => { resolveListen = resolve }))
  cleanup()
  resolveListen(() => { unlistenCalls += 1 })
  await Promise.resolve()
  assert.equal(unlistenCalls, 1)

  let butlerListens = 0
  registerMainWindowListener('butler', async () => { butlerListens += 1; return () => {} })
  await Promise.resolve()
  assert.equal(butlerListens, 0)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/background-services.test.mjs tests/main-window-effects.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现 main window 初始化闸门、共享同步函数和安全 listener 清理**

`backgroundSettingsService` 只接受三个显式依赖（`get`、`set`、`invoke`），映射固定为：

```ts
const BACKGROUND_SETTINGS = {
  'clipboard.auto_watch': ['clipboard_set_watch', true],
  'general.app_tracking': ['app_usage_set_tracking', false],
} as const
```

`appInitializationService.ts` 保持一个模块级 main window Promise：`initializeAppWindow(label, steps)` 对 `label !== 'main'` 立即成功，对 main window 只执行一次步骤列表；这同时覆盖第二窗口和 React StrictMode 的重复 effect。步骤按名称逐项 `try/catch`，失败时记录并 Toast、继续后续步骤，返回失败项而不 reject。`recoverRunningSessions`、后台设置同步和 Task 6 的 Keychain 迁移都挂在这里。Butler 窗口仍可初始化数据库并按需读取 secret，但不得执行恢复、迁移、启动/停止 watcher 或任何重复写入。

```ts
let mainInitialization: Promise<{ failures: string[] }> | undefined

export function initializeAppWindow(label: string, steps: [string, () => Promise<unknown>][], onFailure = () => {}) {
  if (label !== 'main') return Promise.resolve({ failures: [] })
  return mainInitialization ??= (async () => {
    const failures: string[] = []
    for (const [name, step] of steps) {
      try { await step() }
      catch (error) { failures.push(name); onFailure({ name, error }) }
    }
    return { failures }
  })()
}

export const shouldPersistUsageTick = (label: string) => label === 'main'

export function registerMainWindowListener(label: string, subscribe: () => Promise<() => void>, onError = () => {}) {
  let cancelled = false
  let unlisten: (() => void) | undefined
  if (label === 'main') void subscribe().then(
    fn => cancelled ? fn() : (unlisten = fn),
    error => { if (!cancelled) onError(error) },
  )
  return () => { cancelled = true; unlisten?.() }
}
```

`useDatabase` 先完成每个窗口必要的数据库连接/迁移；数据库失败仍走致命错误路径。数据库成功后，仅 main window await 上述应用初始化 Promise，并用只包围这些非关键步骤的 `finally` 明确 `setReady(true)`，避免恢复/迁移/后台命令失败把应用卡在 loading。Settings 和 Clipboard 页面切换都复用 `applyBackgroundSetting`；若 invoke 失败则不写 DB、不改本地 UI，并 Toast。删除 hook 中读取/写入设置的初始化 effect。

两个异步 listener 复用 `registerMainWindowListener`；既覆盖“unlisten 尚未返回就卸载”，也捕获注册失败，避免未处理 Promise：

```ts
return registerMainWindowListener(
  getCurrentWindow().label,
  () => listen('event', handler),
  reportListenerError,
)
```

`useClipboardWatcher.ts` 导出两个明确入口：`useClipboardPersistence` 只负责订阅 Rust broadcast 和执行 `clipCreate`，由 main App 常驻挂载，保存成功后派发轻量的同窗口刷新通知；`useClipboardControls` 只负责状态查询、显式 toggle 和接收该刷新通知，由 `ClipboardPage` 使用，绝不调用 `clipCreate`。这样离开 Clipboard 页面仍会持久化，但进入页面不会产生第二次写入。两个 app-level subscriber 都以当前窗口 label 调用 `registerMainWindowListener`；若 effect 已清理才取得 unlisten，立即调用它。`useAppUsageTracker` 只有 `shouldPersistUsageTick('main')` 为真时才调用 `saveUsageTick`，保证同一 Rust broadcast tick 在双窗口下只落库一次；Butler 不注册任一 persistence listener。

`App.tsx` 用独立的 `MainWindowEffects` 组件调用 `useClipboardPersistence()` 与 `useAppUsageTracker()`，只在当前窗口 label 为 `main` 时渲染它；不要条件调用 hooks。`ClipboardPage` 改为 `useClipboardControls(refresh)`。

- [ ] **Step 4: 实现 Rust 固定周期 tick、时间归属和 SQLite 原子 upsert**

`AppUsageTick` 增加 `recorded_date`、`hour`；每 5 秒对上一个前台应用发一次 `min(elapsed, 5s)` 增量，关闭开关时清空样本。用 `chrono::Local` 在 emit 前生成本地日期和小时，并在 `Cargo.toml` 增加仅此用途的 `chrono = "0.4"`。

`008_app_usage_unique.sql` 先把同一 `(app_name, recorded_date, hour)` 的 `duration_seconds` 汇总到最小 id，再删除其余重复行，最后：

```sql
CREATE UNIQUE INDEX idx_usage_app_date_hour
ON app_usage(app_name, recorded_date, hour);
```

`saveUsageTick(appName, durationSeconds, recordedDate, hour)` 改为单条：

```sql
INSERT INTO app_usage(app_name, duration_seconds, recorded_date, hour)
VALUES ($1, $2, $3, $4)
ON CONFLICT(app_name, recorded_date, hour)
DO UPDATE SET duration_seconds = duration_seconds + excluded.duration_seconds;
```

在 `lib.rs` 以 version 8 注册迁移。前端 listener 使用 Rust payload 的日期/小时，不再读取接收时刻。

- [ ] **Step 5: 运行行为测试和 Rust 单元测试**

在 `app_usage_tracker.rs` 内为 `capped_elapsed_seconds` 写 `#[test]`，断言 12 秒被限制为 5 秒、2 秒保持 2 秒。

Run: `node --test tests/background-services.test.mjs tests/main-window-effects.test.mjs && cargo test --manifest-path src-tauri/Cargo.toml app_usage_tracker && npx tsc -b`

Expected: Node 测试 PASS；双窗口/StrictMode 合约证明 clipboard 与 usage 各自只有 main window 的一个 persistence subscriber，单事件只写一次，Butler 写入 0 次，延迟返回的 listener 仍被释放；Rust 至少 1 个真实 test PASS；TypeScript 0 error。

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx src/hooks/useDatabase.ts src/pages/SettingsPage.tsx src/pages/ClipboardPage.tsx src/hooks/useClipboardWatcher.ts src/hooks/useAppUsageTracker.ts src/services/appInitializationService.ts src/services/appUsageService.ts src/services/backgroundSettingsService.ts src-tauri/src/services/app_usage_tracker.rs src-tauri/migrations/008_app_usage_unique.sql src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock tests/background-services.test.mjs tests/main-window-effects.test.mjs
git commit -m "fix: synchronize background services and usage ticks"
```

### Task 6: 将 AI/ASR 密钥迁移到 macOS Keychain 并收紧 CSP

**Files:**
- Create: `src/services/secretService.ts`
- Create: `src-tauri/src/services/secrets.rs`
- Create: `src-tauri/src/commands/secrets.rs`
- Create: `tests/secret-migration.test.mjs`
- Modify: `src/hooks/useDatabase.ts:15-53`
- Modify: `src/services/settingsService.ts:10-40`
- Modify: `src/hooks/useSettings.ts:18-62`
- Modify: `src/services/aiService.ts:8-49`
- Modify: `src/hooks/useVoiceTranscribe.ts:30-48`
- Modify: `src/pages/SettingsPage.tsx:61-115,180-302`
- Modify: `src-tauri/src/services/mod.rs:1-7`
- Modify: `src-tauri/src/commands/mod.rs:1-8`
- Modify: `src-tauri/src/lib.rs:51-113`
- Modify: `src-tauri/Cargo.toml:18-30`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json:37-45`

- [ ] **Step 1: 写“安全写入成功后才删旧值”的失败测试**

```js
// tests/secret-migration.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { getSecret, migrateLegacySecret, migrateLegacySecrets } from '../src/services/secretService.ts'
import { initializeAppWindow } from '../src/services/appInitializationService.ts'

test('Keychain 写入成功后才删除 SQLite 明文', async () => {
  const calls = []
  const deps = {
    getSecret: async () => null,
    getLegacy: async () => 'legacy-token',
    setSecret: async () => calls.push('set'),
    deleteLegacy: async () => calls.push('delete'),
  }
  assert.deepEqual(await migrateLegacySecret('ai.openai_api_key', deps), { value: 'legacy-token', migrated: true })
  assert.deepEqual(calls, ['set', 'delete'])
})

test('Keychain 写入失败时保留 SQLite 明文', async () => {
  let deleted = false
  const result = await migrateLegacySecret('asr.volc_access_token', {
    getSecret: async () => null,
    getLegacy: async () => 'legacy-token',
    setSecret: async () => { throw new Error('denied') },
    deleteLegacy: async () => { deleted = true },
  })
  assert.deepEqual(result, { value: 'legacy-token', migrated: false, error: 'denied' })
  assert.equal(deleted, false)
  assert.equal(await getSecret('asr.volc_access_token', {
    getSecure: async () => { throw new Error('denied') },
    getLegacy: async () => 'legacy-token',
  }), 'legacy-token')
})

test('三键中间迁移失败仍继续并允许应用 ready', async () => {
  const keys = ['ai.openai_api_key', 'asr.volc_app_id', 'asr.volc_access_token']
  const attempted = [], deleted = []
  let outcomes, ready = false
  const init = await initializeAppWindow('main', [['migrate-secrets', async () => {
    outcomes = await migrateLegacySecrets(keys, {
      getSecret: async () => null,
      getLegacy: async key => `legacy:${key}`,
      setSecret: async key => { attempted.push(key); if (key === 'asr.volc_app_id') throw new Error('denied') },
      deleteLegacy: async key => deleted.push(key),
    })
  }]])
  ready = true
  assert.deepEqual(attempted, keys)
  assert.deepEqual(deleted, ['ai.openai_api_key', 'asr.volc_access_token'])
  assert.equal(outcomes[1].value, 'legacy:asr.volc_app_id')
  assert.equal(outcomes[1].migrated, false)
  assert.deepEqual(init.failures, [])
  assert.equal(ready, true)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/secret-migration.test.mjs`

Expected: FAIL，`secretService.ts` 尚不存在。

- [ ] **Step 3: 实现固定白名单的原生 Keychain commands**

仅允许以下账户名，拒绝任意 key：

```rust
fn account_for(key: &str) -> Result<&'static str, String> {
    match key {
        "ai.openai_api_key" => Ok("ai.openai_api_key"),
        "asr.volc_app_id" => Ok("asr.volc_app_id"),
        "asr.volc_access_token" => Ok("asr.volc_access_token"),
        _ => Err("unsupported secret key".into()),
    }
}
```

在 `Cargo.toml` 增加 macOS target dependency `security-framework = "3"`。`services/secrets.rs` 使用 service `com.flowbox.app` 和上述 account 调用 Keychain；`commands/secrets.rs` 暴露 `secret_get`、`secret_set`、`secret_exists`。所有错误返回脱敏文本，绝不记录 secret。注册 service、command 和 invoke handler。

- [ ] **Step 4: 接入前端迁移、专用读取和掩码 UI**

`secretService.ts` 导出固定 `SecretKey`、`getSecret`、`setSecret`、`secretExists` 和 `migrateLegacySecrets`。迁移三个 key 时逐键 `try/catch`：只有 `setSecret` 成功后才 `settingsDelete`；任一键失败都保留 SQLite 明文、记录脱敏日志、Toast“安全存储暂不可用，可稍后重试”，继续迁移下一键并让应用 ready。把迁移注册到 Task 5 的 main window 初始化步骤，Butler 不触发迁移。

`getSecret` 先读 Keychain；未命中或 Keychain 暂不可用时使用 SQLite **legacy fallback**，同时记录可重试的降级状态，确保升级后的 AI/ASR 功能不会因一次 Keychain 故障丢失可用凭据。`settingsSet` 遇到敏感键直接抛错，`settingsGetAll` 默认不返回三键，仅该 fallback 使用专用白名单读取；增加 `settingsDelete` 供成功迁移使用。

`aiService.getAiConfig` 改用 `getSecret('ai.openai_api_key')`；`useVoiceTranscribe` 从 Keychain 读取 AI key/AppID/token，再作为现有 `voice_transcribe_audio` 参数传给 Rust。Settings 页面只保存“是否已配置”的 boolean 和用户新输入，已保存值显示固定掩码 `••••••••`，不把旧 secret 填回普通 input state。

收紧 CSP 为系统字体方案：移除 `script-src` 的 `'unsafe-inline'`、`style-src` 的 `https://fonts.googleapis.com`、整个 `font-src https://fonts.gstatic.com`，保留 `style-src 'self' 'unsafe-inline'`。

- [ ] **Step 5: 执行行为、安全和 Rust 检查**

Run: `node --test tests/secret-migration.test.mjs tests/main-window-effects.test.mjs && cargo test --manifest-path src-tauri/Cargo.toml secrets && rg -n "unsafe-inline|fonts.googleapis|fonts.gstatic" src-tauri/tauri.conf.json && npx tsc -b`

Expected: Node/Rust 测试 PASS；失败注入证明某一 Keychain 写入拒绝时旧值仍可读取、后续键仍迁移且应用进入 ready；`rg` 只能匹配保留的 `style-src 'unsafe-inline'`，不能匹配 Google Fonts 或 `script-src 'unsafe-inline'`；TypeScript 0 error。

手工 DB 核查（先在测试副本/开发库启动一次应用）：

```sql
SELECT key FROM settings
WHERE key IN ('ai.openai_api_key','asr.volc_app_id','asr.volc_access_token');
```

Expected: 正常迁移为 0 rows；若 Keychain 写入失败则应用保持可用、旧值保留并经 legacy fallback 读取，日志/Toast 明确可重试降级，待重试成功后才删除旧值。

- [ ] **Step 6: 提交**

```bash
git add src/services/secretService.ts src/services/settingsService.ts src/services/aiService.ts src/services/appInitializationService.ts src/hooks/useDatabase.ts src/hooks/useSettings.ts src/hooks/useVoiceTranscribe.ts src/pages/SettingsPage.tsx src-tauri/src/services/secrets.rs src-tauri/src/services/mod.rs src-tauri/src/commands/secrets.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json tests/secret-migration.test.mjs tests/main-window-effects.test.mjs
git commit -m "fix: store credentials in macOS Keychain"
```

### Task 7: 用官方插件实现开机自启动

**Files:**
- Create: `tests/autostart-settings.test.mjs`
- Modify: `src/services/backgroundSettingsService.ts`
- Modify: `src/services/appInitializationService.ts`
- Modify: `src/hooks/useDatabase.ts:15-53`
- Modify: `src/pages/SettingsPage.tsx:372-385`
- Modify: `package.json:13-27`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml:18-32`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs:51-70`
- Modify: `src-tauri/capabilities/default.json:8-24`

- [ ] **Step 1: 写插件真实状态优先的失败测试**

```js
// tests/autostart-settings.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { syncAutostart, setAutostart } from '../src/services/backgroundSettingsService.ts'

test('初始化与切换都以插件 isEnabled 结果回写 DB', async () => {
  const writes = []
  const plugin = { isEnabled: async () => true, enable: async () => {}, disable: async () => {} }
  assert.equal(await syncAutostart(plugin, async (k, v) => writes.push([k, v])), true)
  assert.deepEqual(writes.at(-1), ['general.autostart', 'true'])
  await setAutostart(false, { ...plugin, isEnabled: async () => false }, async (k, v) => writes.push([k, v]))
  assert.deepEqual(writes.at(-1), ['general.autostart', 'false'])
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/autostart-settings.test.mjs`

Expected: FAIL，缺少两个导出函数。

- [ ] **Step 3: 安装并注册官方 autostart 插件**

Run: `npm install @tauri-apps/plugin-autostart@^2 && cargo add tauri-plugin-autostart@2 --target 'cfg(target_os = "macos")' --manifest-path src-tauri/Cargo.toml`

在 builder 注册：

```rust
use tauri_plugin_autostart::MacosLauncher;

.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
```

API 以 Tauri 2 官方 [Autostart plugin 文档](https://v2.tauri.app/plugin/autostart/) 和当前 2.x `init(MacosLauncher, args)` 签名为准，不使用不存在的自定义 builder 方法。

在 `default.json` 增加 `autostart:allow-enable`、`autostart:allow-disable`、`autostart:allow-is-enabled`。

- [ ] **Step 4: 实现真实状态同步和失败回滚**

在 `backgroundSettingsService` 中封装 `enable/disable/isEnabled`。把插件真实状态读取与 `general.autostart` 回写注册为 main window 初始化步骤；`useDatabase` 仅在 main window 的 ready 前 await 该步骤，Butler 不重复回写。Settings toggle 先调插件，随后读取真实状态再持久化。任何插件错误只 Toast，不提前更新 UI/DB，也不得让 ready gate 永久悬挂。

Run: `node --test tests/autostart-settings.test.mjs tests/main-window-effects.test.mjs && cargo check --manifest-path src-tauri/Cargo.toml && npx tsc -b`

Expected: 测试 PASS；Rust 编译通过且 capability 无拒绝错误。

- [ ] **Step 5: 提交**

```bash
git add package.json package-lock.json src/services/backgroundSettingsService.ts src/services/appInitializationService.ts src/hooks/useDatabase.ts src/pages/SettingsPage.tsx src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json tests/autostart-settings.test.mjs tests/main-window-effects.test.mjs
git commit -m "feat: add real macOS autostart"
```

### Task 8: 为 DeepSeek/Ollama 接入 macOS Vision OCR

**Files:**
- Create: `src/lib/ocrRouting.ts`
- Create: `src-tauri/src/services/ocr.rs`
- Create: `src-tauri/src/commands/ocr.rs`
- Create: `tests/ocr-routing.test.mjs`
- Modify: `src/services/screenshotOcrService.ts:41-98`
- Modify: `src/services/aiService.ts:13-49,115-128,253-288`
- Modify: `src/hooks/useScreenshotOcr.ts:45-82`
- Modify: `src-tauri/src/services/mod.rs:1-9`
- Modify: `src-tauri/src/commands/mod.rs:1-9`
- Modify: `src-tauri/src/lib.rs:71-90`
- Modify: `src-tauri/Cargo.toml:18-36`
- Modify: `src-tauri/Cargo.lock`

- [ ] **Step 1: 写 provider 分流和结果规范化失败测试**

```js
// tests/ocr-routing.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { ocrRoute, normalizeOcrResult } from '../src/lib/ocrRouting.ts'

test('仅 OpenAI 直接接收图片，其他 provider 先走本地文字识别', () => {
  assert.equal(ocrRoute('openai'), 'vision')
  assert.equal(ocrRoute('deepseek'), 'local-text')
  assert.equal(ocrRoute('ollama'), 'local-text')
})

test('非 JSON 模型输出安全回退', () => {
  assert.equal(normalizeOcrResult('plain text').rawText, 'plain text')
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/ocr-routing.test.mjs`

Expected: FAIL，`ocrRouting.ts` 不存在。

- [ ] **Step 3: 实现 Rust 路径边界和 Vision OCR**

在 macOS target dependencies 中增加当前兼容版本的 `objc2`、`objc2-foundation`、`objc2-vision`、`objc2-app-kit`；只启用创建 `NSImage`、`VNRecognizeTextRequest`、`VNImageRequestHandler` 所需 features。命令先 canonicalize 输入与两个允许根目录：

```rust
fn allowed_image(path: &Path, app_data: &Path) -> Result<PathBuf, OcrError> {
    let path = path.canonicalize().map_err(|_| OcrError::Unreadable)?;
    let screenshots = app_data.join("screenshots").canonicalize().map_err(|_| OcrError::Unreadable)?;
    let clipboard = app_data.join("clipboard_images").canonicalize().map_err(|_| OcrError::Unreadable)?;
    if path.starts_with(screenshots) || path.starts_with(clipboard) { Ok(path) }
    else { Err(OcrError::OutsideAllowedDirectory) }
}
```

`recognize_with_vision` 使用 Accurate recognition level、简体中文/英文语言，拼接非空候选；返回错误严格区分 `outside allowed directory`、`file unreadable`、`no text found`。为 `allowed_image` 和“空候选 → NoText”写 Rust 单元测试；非 macOS 编译分支只返回“unsupported platform”，不设计完整跨平台后端。

- [ ] **Step 4: 前端按 provider 分流并复用当前文本模型**

让 `aiService` 只额外导出 provider 名称，不暴露 secret。`recognizeScreenshot`：OpenAI 继续 `chatWithVision`；DeepSeek/Ollama 调 `invoke<string>('ocr_recognize_text', { imagePath })`，空文本报“没有文本”，再调用现有 `chatWithAssistant({ input: recognizedText, systemPrompt: ... })` 整理标题、标签和类型。模型整理失败保留明确的“模型整理失败”错误，不冒充 OCR 失败。

Run: `node --test tests/ocr-routing.test.mjs && cargo test --manifest-path src-tauri/Cargo.toml ocr && cargo check --manifest-path src-tauri/Cargo.toml && npx tsc -b`

Expected: Node 分流测试 PASS；路径越界/空文本 Rust 测试 PASS；macOS Vision 代码编译通过。

- [ ] **Step 5: 桌面烟测两条路径**

Run: `npm run tauri dev`

Expected: OpenAI 使用图片 Vision 返回可编辑结果；DeepSeek 使用同一截图先得到本地文字再生成 JSON 结果。分别验证“无文字”“文件不可读”“模型失败”展示不同错误。

- [ ] **Step 6: 提交**

```bash
git add src/lib/ocrRouting.ts src/services/screenshotOcrService.ts src/services/aiService.ts src/hooks/useScreenshotOcr.ts src-tauri/src/services/ocr.rs src-tauri/src/services/mod.rs src-tauri/src/commands/ocr.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock tests/ocr-routing.test.mjs
git commit -m "feat: add native OCR fallback"
```

### Task 9: 完成无向跨模块关联 CRUD 与四类入口

**Files:**
- Create: `src/components/links/LinkPanel.tsx`
- Create: `src/lib/itemLink.ts`
- Create: `src-tauri/migrations/009_item_links_canonical.sql`
- Create: `tests/item-links.test.mjs`
- Modify: `src/services/linkService.ts:10-103`
- Modify: `src/services/searchService.ts:10-102`
- Modify: `src/components/todo/TodoDetailModal.tsx:1-190`
- Modify: `src/pages/IdeaPage.tsx:20-416`
- Modify: `src/pages/VoicePage.tsx:28-306`
- Modify: `src/pages/ClipboardPage.tsx:35-468`
- Modify: `src-tauri/src/lib.rs:12-55`

- [ ] **Step 1: 写端点规范化和 SQLite 无向唯一失败测试**

```js
// tests/item-links.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFile } from 'node:fs/promises'
import { canonicalizeLink, createOrGetLink } from '../src/lib/itemLink.ts'

test('A-B 与 B-A 规范化为同一端点顺序', () => {
  assert.deepEqual(canonicalizeLink('todo', 9, 'idea', 2), canonicalizeLink('idea', 2, 'todo', 9))
  assert.deepEqual(canonicalizeLink('todo', 10, 'todo', 2), {
    sourceType: 'todo', sourceId: 2, targetType: 'todo', targetId: 10,
  })
})

test('迁移清理反向重复且约束拒绝再次重复', async () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE item_links(id INTEGER PRIMARY KEY, source_type TEXT NOT NULL, source_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(source_type, source_id, target_type, target_id));`)
  const insert = db.prepare('INSERT INTO item_links VALUES (?, ?, ?, ?, ?, ?)')
  insert.run(1, 'todo', 9, 'idea', 2, '2026-09-10T00:00:00Z')
  insert.run(2, 'idea', 2, 'todo', 9, '2026-09-10T00:00:01Z')
  insert.run(3, 'todo', 10, 'todo', 2, '2026-09-10T00:00:02Z')
  const migration = await readFile(new URL('../src-tauri/migrations/009_item_links_canonical.sql', import.meta.url), 'utf8')
  db.exec(migration)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM item_links').get().count, 2)
  assert.deepEqual(db.prepare('SELECT source_type, source_id, target_type, target_id FROM item_links WHERE id = 3').get(), {
    source_type: 'todo', source_id: 2, target_type: 'todo', target_id: 10,
  })
  assert.throws(() => insert.run(4, 'idea', 2, 'todo', 9, '2026-09-10T00:00:03Z'))
  assert.throws(() => insert.run(5, 'todo', 9, 'idea', 2, '2026-09-10T00:00:04Z'))

  const adapter = {
    execute: async (sql, params) => db.prepare(sql).run(...params),
    select: async (sql, params) => db.prepare(sql).all(...params),
  }
  const existing = await createOrGetLink(adapter, 'todo', 10, 'todo', 2)
  assert.equal(existing.id, 3)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/item-links.test.mjs`

Expected: FAIL，缺少 `canonicalizeLink`/009 migration。

- [ ] **Step 3: 实现规范化写入和迁移**

```ts
// src/lib/itemLink.ts；不要放进会加载 Tauri DB 的 linkService.ts，否则 Node 行为测试无法导入。
export type LinkableType = 'todo' | 'idea' | 'voice' | 'clipboard'

export function canonicalizeLink(aType: LinkableType, aId: number, bType: LinkableType, bId: number) {
  const a = { type: aType, id: aId }, b = { type: bType, id: bId }
  const aFirst = a.type < b.type || (a.type === b.type && a.id <= b.id)
  const [source, target] = aFirst ? [a, b] : [b, a]
  if (source.type === target.type && source.id === target.id) throw new Error('不能关联自身')
  return { sourceType: source.type, sourceId: source.id, targetType: target.type, targetId: target.id }
}
```

009 migration 必须先删反向重复，再规范化端点；现有表级有向 UNIQUE 会使“先 UPDATE 后去重”直接冲突：

```sql
DELETE FROM item_links AS duplicate
WHERE EXISTS (
  SELECT 1 FROM item_links AS kept
  WHERE kept.id < duplicate.id
    AND kept.source_type = duplicate.target_type
    AND kept.source_id = duplicate.target_id
    AND kept.target_type = duplicate.source_type
    AND kept.target_id = duplicate.source_id
);

UPDATE item_links
SET
  source_type = CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN source_type ELSE target_type END,
  source_id = CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN source_id ELSE target_id END,
  target_type = CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN target_type ELSE source_type END,
  target_id = CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN target_id ELSE source_id END
WHERE NOT (source_type < target_type OR (source_type = target_type AND source_id <= target_id));

CREATE UNIQUE INDEX idx_item_links_undirected ON item_links (
  CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN source_type ELSE target_type END,
  CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN source_id ELSE target_id END,
  CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN target_type ELSE source_type END,
  CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN target_id ELSE source_id END
);
```

SQLite 同一条 `UPDATE` 的所有右值都读取更新前的原始列，因此上面的单条语句不会发生“先改 source 再污染 target”的交换错误。保留 `004_cross_link.sql` 已有的有向 UNIQUE，同时用 expression index 防止绕过 service 的 raw 反向重复。

`src/lib/itemLink.ts` 额外导出最小的 `createOrGetLink(db, ...)`：先 canonicalize，以规范化参数和 SQLite/Tauri 均支持的 `?1`…`?4` 占位符执行 `INSERT OR IGNORE INTO item_links(..., created_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))`，再用相同四参数查询并返回已有行；`linkService.ts` 只提供真实 Tauri DB adapter 并复用它。这样迁移前那条单独的非规范旧行在规范化后，调用 service 的反向参数仍返回原 id，而不是新建/漏查。保留 `linksByItem`、`linkBetween`、`linkedIds` 的双向读取。

- [ ] **Step 4: 实现共用面板和 highlight 跳转**

`LinkPanel` 接收 `{ type, id, onClose }`，复用 `globalSearch` 搜索四类实体，排除自身；打开时 `linksByItem`，点击添加 `linkCreate`，删除 `linkDelete`。跳转必须复用当前实际路由映射（todo 是 `/`，不是 `/todo`）：

```ts
const LINK_PATH: Record<LinkableType, string> = {
  todo: '/', idea: '/idea', voice: '/voice', clipboard: '/clipboard',
}
navigate(`${LINK_PATH[target.type]}?highlight=${target.type}-${target.id}`)
```

面板只处理四个现有类型，不加 plugin/factory 层。

Todo/Idea 详情中增加“关联”区域；Voice/Clipboard 卡片操作区增加“关联”按钮。四个页面读取 `useSearchParams().get('highlight')`，加载后滚动并短暂加高亮 class；这是现有 `GlobalSearchBar` 已生成 query、但页面尚未消费的缺口。

- [ ] **Step 5: 运行测试和桌面 CRUD 烟测**

Run: `node --test tests/item-links.test.mjs && npm test && npx tsc -b`

Expected: 关联测试和全部既有 Node tests PASS；`npx tsc -b` 继续保持 0 error。

桌面烟测：依次建立 todo↔idea、voice↔clipboard；从两端都能查看；点击跳转并高亮；删除后两端消失；反向重复添加只保留一条。

- [ ] **Step 6: 提交**

```bash
git add src/components/links/LinkPanel.tsx src/lib/itemLink.ts src/services/linkService.ts src/services/searchService.ts src/components/todo/TodoDetailModal.tsx src/pages/IdeaPage.tsx src/pages/VoicePage.tsx src/pages/ClipboardPage.tsx src-tauri/migrations/009_item_links_canonical.sql src-tauri/src/lib.rs tests/item-links.test.mjs
git commit -m "feat: complete cross-module links"
```

### Task 10: 清零 ESLint 并删除确认无调用的代码

**Files:**
- Create: `tests/dead-code.test.mjs`
- Modify: `src/components/butler/ChatMessageItem.tsx`
- Modify: `src/components/layout/TitleBar.tsx`
- Modify: `src/components/ui/ImageLightbox.tsx`
- Modify: `src/components/ui/VirtualList.tsx`
- Modify: `src/hooks/useClipboardWatcher.ts`
- Modify: `src/hooks/useDebounce.ts`
- Modify: `src/hooks/useTodos.ts`
- Modify: `src/pages/ClipboardPage.tsx`
- Modify: `src/pages/IdeaPage.tsx`
- Modify: `src/pages/MarkdownPage.tsx`
- Modify: `src/pages/PomodoroPage.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/StatsPage.tsx`
- Modify: `src-tauri/src/lib.rs:1-4`
- Modify: `src-tauri/src/services/mod.rs:1-9`
- Delete: `src/pages/SkillsPage.tsx`
- Delete: `src/App.css`
- Delete: `src/assets/react.svg`
- Delete: `src/assets/vite.svg`
- Delete: `src/assets/hero.png`
- Delete: `src-tauri/src/services/mod_placeholder.rs`
- Delete: `src-tauri/src/errors.rs`
- Delete: `src-tauri/src/models/app_usage.rs`
- Delete: `src-tauri/src/models/clipboard.rs`
- Delete: `src-tauri/src/models/common.rs`
- Delete: `src-tauri/src/models/idea.rs`
- Delete: `src-tauri/src/models/mod.rs`
- Delete: `src-tauri/src/models/pomodoro.rs`
- Delete: `src-tauri/src/models/todo.rs`
- Delete: `src-tauri/src/models/voice.rs`
- Delete: `remove_bg.py`

- [ ] **Step 1: 写死代码和 module 声明失败测试**

```js
// tests/dead-code.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

test('死代码已删除且 Rust 不再声明空模块', async () => {
  for (const file of ['../src/pages/SkillsPage.tsx', '../src/App.css', '../remove_bg.py', '../src-tauri/src/services/mod_placeholder.rs', '../src-tauri/src/models/mod.rs']) {
    await assert.rejects(access(new URL(file, import.meta.url)))
  }
  const lib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8')
  assert.doesNotMatch(lib, /pub mod (errors|models)/)
})
```

- [ ] **Step 2: 运行并确认测试和 lint 失败**

Run: `node --test tests/dead-code.test.mjs; npm run lint`

Expected: 死代码测试 FAIL；lint 在仅产品范围内仍报告真实源码问题（不再包含 `.worktrees` 或 `src-tauri/target`）。

- [ ] **Step 3: 逐类做最小 lint 修正**

- `@ts-ignore` 改为带原因的 `@ts-expect-error`；未使用 catch 参数直接写 `catch {}`。
- `any` 改为已有 React/Recharts props 类型或 `unknown`；`useDebouncedCallback` 用 `T extends (...args: never[]) => unknown`。
- `useClipboardWatcher` 的 callback ref 在 effect 中更新，不在 render 写 `.current`。
- `IdeaPage` 不用 effect 镜像 `idea.tags`，从 props 计算当前 tags，仅在编辑动作产生新数组。
- `ClipboardPage` 从 `clip.image_path` 直接派生初始图片 URL，只为加载失败保存 fallback 状态。
- `SettingsPage` 先把 `settings[key]` 提成标量，再放 dependency array；不依赖整个对象。
- `StatsPage`/`PomodoroPage` 的初始异步加载直接在 effect 内启动并带取消标记，不在 effect 同步调用一个已知会 setState 的函数。
- `VirtualList` 不在 `useMemo` 写 ref；测量写入放 layout/effect 或 callback ref。
- Markdown 的无用转义、复杂依赖表达式和未用 catch 参数做局部修正。

不要为 lint 新建状态管理层，不禁用规则，不添加 eslint-disable 掩盖产品错误。

- [ ] **Step 4: 删除已确认零调用文件并同步 Rust 声明**

删除清单文件；从 `lib.rs` 删除 `pub mod errors;`、`pub mod models;`，从 `services/mod.rs` 删除 `pub mod mod_placeholder;`。再次运行 `rg` 确认无残留引用；保留 `docs/ui_assets/**`。

- [ ] **Step 5: 运行全量 lint、测试和 Rust 检查**

Run: `npm run lint && node --test tests/dead-code.test.mjs && npm test && npm run check:rust && npx tsc -b`

Expected: ESLint 0 errors / 0 warnings；Node 全部 PASS；Rust check/test PASS。

- [ ] **Step 6: 提交**

```bash
git add src/components/butler/ChatMessageItem.tsx src/components/layout/TitleBar.tsx src/components/ui/ImageLightbox.tsx src/components/ui/VirtualList.tsx src/hooks/useClipboardWatcher.ts src/hooks/useDebounce.ts src/hooks/useTodos.ts src/pages/ClipboardPage.tsx src/pages/IdeaPage.tsx src/pages/MarkdownPage.tsx src/pages/PomodoroPage.tsx src/pages/SettingsPage.tsx src/pages/StatsPage.tsx src/pages/SkillsPage.tsx src/App.css src/assets/react.svg src/assets/vite.svg src/assets/hero.png src-tauri/src/lib.rs src-tauri/src/services/mod.rs src-tauri/src/services/mod_placeholder.rs src-tauri/src/errors.rs src-tauri/src/models remove_bg.py tests/dead-code.test.mjs
git commit -m "refactor: remove dead code and lint violations"
```

### Task 11: 路由级拆包并消除生产构建警告

**Files:**
- Create: `tests/route-loading.test.mjs`
- Modify: `src/App.tsx:1-55`
- Modify: `vite.config.ts:1-14`（仅当实测仍需手工 chunk）

- [ ] **Step 1: 写路由懒加载失败测试**

```js
// tests/route-loading.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('功能页面通过 React.lazy 加载，壳与 Toast 保持同步', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/StatsPage'/)
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/MarkdownPage'/)
  assert.match(app, /<Suspense/)
  assert.match(app, /import \{ AppShell \}/)
  assert.match(app, /import \{ ToastContainer \}/)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/route-loading.test.mjs`

Expected: FAIL，当前所有页面均为静态 import。

- [ ] **Step 3: 最小改造功能页路由**

对 Todo、Idea、Pomodoro、Clipboard、Voice、Markdown、Stats、Trending、Settings 使用 named-export 适配：

```ts
const StatsPage = lazy(() => import('./pages/StatsPage').then(module => ({ default: module.StatsPage })))
```

用一个 `<Suspense fallback={<div ...>加载中...</div>}>` 包裹 Routes。`AppShell`、`ToastContainer`、Butler overlay/workbench 所需共享组件保持同步加载；不要增加通用 loader 框架。

- [ ] **Step 4: 构建并按真实输出消除残余 warning**

Run: `npm run build`

Expected: PASS；无 CSS/font 规则 warning，无单个 main chunk 超限 warning。

只有当路由拆分后仍存在超限 chunk，才在 `vite.config.ts` 加最小 vendor 分组，例如将 `recharts` 与 markdown 依赖分别拆为 `charts`、`markdown`；不得仅提高 `chunkSizeWarningLimit` 隐藏问题：

```ts
manualChunks(id) {
  if (id.includes('recharts')) return 'charts'
  if (id.includes('react-markdown') || id.includes('remark-gfm')) return 'markdown'
}
```

- [ ] **Step 5: 运行路由守卫与全量前端检查**

Run: `node --test tests/route-loading.test.mjs && npm run check`

Expected: 路由测试 PASS；TypeScript、build、ESLint、Node tests 全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx vite.config.ts tests/route-loading.test.mjs
git commit -m "perf: lazy load feature routes"
```

### Task 12: 修复 Router audit、统一 0.5.0、校正文档并首次接入全绿 CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `tests/release-contract.test.mjs`
- Modify: `package.json:1-27`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml:1-36`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json:1-5`
- Modify: `README.md:1-390`

- [ ] **Step 1: 写版本与文档契约失败测试**

```js
// tests/release-contract.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('0.5.0、Keychain、本地 OCR、关联入口和自启动文档一致', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  const tauri = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url)))
  const cargo = await readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8')
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  assert.equal(pkg.version, '0.5.0')
  assert.equal(tauri.version, '0.5.0')
  assert.match(cargo, /^version = "0\.5\.0"$/m)
  for (const term of ['Keychain', 'macOS Vision', '开机自启动', '关联']) assert.ok(readme.includes(term))
  for (const command of ['npm ci', 'npm run check', 'npm run check:rust', 'npm audit --omit=dev --audit-level=high']) assert.ok(ci.includes(command))
  assert.match(ci, /macos-latest/)
})
```

- [ ] **Step 2: 运行并确认版本测试和 audit 失败**

Run: `node --test tests/release-contract.test.mjs`

Expected: FAIL，CI 文件尚不存在，且 package/Cargo/Tauri 仍为 0.3.0。

Run: `npm audit --omit=dev --audit-level=high`

Expected: FAIL，报告当前 React Router high advisory。

- [ ] **Step 3: 升级兼容的 React Router 7 并确认 audit**

Run: `npm install react-router-dom@^7.14.1`

Expected: `package-lock.json` 更新，保持 major 7；随后 `npm audit --omit=dev --audit-level=high` 返回 0 high/critical。若锁文件解析到更新的兼容 7.x，以 audit 结果为准，不升级到未经适配的新 major。

- [ ] **Step 4: 统一版本、让 README 只陈述真实行为，并在全部本地检查已绿后创建 CI**

把 `package.json`、`Cargo.toml`、`tauri.conf.json` 统一为 `0.5.0`，刷新两个 lockfile。README 修改：

- Keychain 保存 AI/ASR secrets，SQLite 不保存明文。
- OpenAI 直接 Vision；DeepSeek/Ollama 使用 macOS Vision 本地 OCR 后再由文本模型整理。
- 关联面板在 Todo/Idea 详情、Voice/Clipboard 卡片入口，支持双向查看/跳转/删除。
- 开机自启动使用官方插件且插件状态为准。
- 应用追踪描述改为周期增量，不再只记录切换。
- Roadmap 只勾选本轮验收后确实完成的项目，删除与实际实现冲突的 OCR/关联描述；保留仍未完成的周报等项目。
- 项目结构更新 commands/services/migrations 数量与新文件，删除 SkillsPage/models 等已删条目；`docs/ui_assets` 仍列为设计参考。

此时 Task 2 已清零 TypeScript，Task 10 已清零 ESLint，Task 11 已消除构建 warning；只有现在才创建 `.github/workflows/ci.yml`。使用 `macos-latest`、Node 24、stable Rust，顺序执行 `npm ci`、`npm run check`、`npm run check:rust`、`npm audit --omit=dev --audit-level=high`。不在 Task 1 先提交一个注定失败的 workflow；CI 的第一个 commit 就必须对应本地全绿命令。

- [ ] **Step 5: 执行 release 契约和 audit**

Run: `node --test tests/release-contract.test.mjs && npm audit --omit=dev --audit-level=high && npm run check && npm run check:rust`

Expected: 全部 PASS；版本与 README 一致；audit 0 high/critical；workflow 中的四条命令与本地验证一致，首次 CI commit 可直接为绿。

- [ ] **Step 6: 提交**

```bash
git add .github/workflows/ci.yml package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json README.md tests/release-contract.test.mjs
git commit -m "chore: prepare FlowBox 0.5.0"
```

---

## 最终验收（所有任务完成后执行，不单独提交）

- [ ] Run: `npm ci && npm run check`  
  Expected: build、ESLint、全部 Node tests 通过；ESLint 0 error / 0 warning。
- [ ] Run: `npm run check:rust`  
  Expected: Cargo check/test 通过，Rust test 数量大于 0。
- [ ] Run: `npm audit --omit=dev --audit-level=high`  
  Expected: 0 high/critical。
- [ ] Run: `npm run build 2>&1 | tee /tmp/flowbox-build.log`  
  Expected: 退出码 0；`rg -n "font|@import|chunk.*larger" /tmp/flowbox-build.log` 无 warning。
- [ ] 在本地时区手工/自动验证 23:59→00:00、周日→周一、21:30 后迟启动每日回顾，结果归入正确本地日期且每天仅弹一次。
- [ ] 新建番茄后查询 SQLite：状态为 `running`；正常/中断结束后分别为 `completed`/`interrupted`，统计不包含未结束行。
- [ ] 重启应用后核对剪贴板、应用追踪、自启动：Rust/plugin 真实状态与设置 UI 一致；命令失败时 UI/DB 不提前翻转。
- [ ] 保持同一前台应用至少 20 秒，确认 `app_usage` 周期累计且 `(app_name, recorded_date, hour)` 仅一行；跨小时 tick 使用 Rust payload 的归属。
- [ ] 同时打开 main window 与 Butler，并在开发 StrictMode 下重挂载：`recoverRunningSessions`、后台同步、Keychain 迁移均只执行一次；同一个 clipboard broadcast 与 usage tick 都只产生一次 SQLite 写入；关闭窗口/卸载后无残留 listener。
- [ ] 查询 SQLite 确认正常迁移后三项 secret key 为 0 rows，并在 Keychain 中能读到已保存项；注入单键 Keychain 失败时应用仍 ready、旧明文保留且 fallback 可读、其余键继续迁移；UI 只显示掩码。
- [ ] 用四种实体各建立至少一条关联，验证反向查看、highlight 跳转、删除和反向重复去重。
- [ ] 分别用 OpenAI 与 DeepSeek 完成同一张含文字截图 OCR；验证无文字、非法路径、模型整理失败三类错误。
- [ ] Run: `rg -n "0\.3\.0|PaddleOCR|DeepSeek.*Vision" package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json README.md`  
  Expected: 无过期版本或错误 OCR 宣称；历史 changelog 中确需保留的旧版本标题可人工确认后豁免。

## 规格验收映射

1. 局部 scripts/ignore 基线：Task 1；全量 `npm run check` / `check:rust`：Task 10、11、12、最终验收。
2. ESLint 0/0：Task 10。
3. Rust 真实单元测试：Task 5、6、8。
4. audit 无 high/critical：Task 12。
5. 本地日期/周界/每日回顾：Task 3。
6. 番茄 running/结束/统计：Task 4。
7. main window/StrictMode 独占、重启后台服务与自启动同步：Task 5、7。
8. 单一应用周期累计：Task 5。
9. SQLite 无明文密钥与失败 fallback：Task 6。
10. 四类实体关联 CRUD/跳转：Task 9。
11. OpenAI + DeepSeek OCR：Task 8。
12. tsc、构建、font/chunk：Task 2、11。
13. 版本与 README：Task 12。

额外明确覆盖：当前 5 个 tsc 错误（Task 2）、React Router audit（Task 12）、ESLint ignore（Task 1）、macOS CI（Task 12，且首次提交即全绿）、`docs/ui_assets` 保留（文件结构与 Task 10）。
