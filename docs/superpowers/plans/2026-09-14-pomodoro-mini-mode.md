# Pomodoro Mini Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Pomodoro Mini mode into a real compact main-window mode that preserves timer state and restores the user's prior window state safely.

**Architecture:** `AppShell` is the sole Mini-mode owner and passes mode/actions through the existing outlet context. A small pure window transaction module snapshots and restores native properties with a serialized, best-effort rollback path. The Pomodoro service uses unsubscribe-capable subscriber sets so the page and status bar receive the same timer state without replacing each other's callbacks.

**Tech Stack:** React 19, TypeScript, React Router outlet context, Tauri v2 window API, Node built-in test runner.

---

## Baseline

At branch creation, `npm test` (115 tests), `npx tsc -b`, and `cargo check` pass. Full `npm run check` already fails on unrelated lint errors and a 500 kB chunk warning introduced by commit `a695a9c`; this plan must not broaden into those files. Run ESLint on touched TypeScript files and record the unchanged full-check baseline at completion.

### Task 1: Make Pomodoro notifications safely multi-subscriber

**Files:**
- Modify: `src/services/pomodoroService.ts`
- Modify: `src/components/layout/StatusBar.tsx`
- Create: `tests/pomodoro-subscriptions.test.mjs`

- [ ] **Step 1: Write the failing subscription contract test**

Create a focused source/behavior contract asserting that tick and completion callbacks are stored in `Set`s, registration returns an unsubscribe function, notification iterates a snapshot of each set, and `StatusBar` returns the tick unsubscribe from its effect.

```js
assert.match(service, /const tickCallbacks = new Set<TickCallback>\(\)/)
assert.match(service, /return \(\) => tickCallbacks\.delete\(cb\)/)
assert.match(statusBar, /return pomodoroOnTick\(/)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/pomodoro-subscriptions.test.mjs`

Expected: FAIL because the service has one replaceable callback slot and registration returns nothing.

- [ ] **Step 3: Implement the minimum subscriber sets**

Replace the two callback slots with sets:

```ts
const tickCallbacks = new Set<TickCallback>()
const completeCallbacks = new Set<CompleteCallback>()

export function pomodoroOnTick(cb: TickCallback) {
  tickCallbacks.add(cb)
  return () => tickCallbacks.delete(cb)
}
```

Use small `notifyTick` / `notifyComplete` loops over copied state/subscriber snapshots. Notify state changes after start, pause, resume, successful stop reset, and timer ticks; completion subscribers run after natural completion. Update `StatusBar` to return the unsubscribe function.

- [ ] **Step 4: Verify GREEN and regression safety**

Run: `node --test tests/pomodoro-subscriptions.test.mjs tests/pomodoro-persistence.test.mjs tests/pomodoro-session.test.mjs && npx eslint src/services/pomodoroService.ts src/components/layout/StatusBar.tsx`

Expected: PASS with no lint output.

- [ ] **Step 5: Commit**

```bash
git add src/services/pomodoroService.ts src/components/layout/StatusBar.tsx tests/pomodoro-subscriptions.test.mjs
git commit -m "fix: support multiple Pomodoro subscribers"
```

### Task 2: Add a transactional native window adapter

**Files:**
- Create: `src/lib/pomodoroMiniWindow.ts`
- Create: `tests/pomodoro-mini-window.test.mjs`
- Modify: `src-tauri/capabilities/pomodoro-window-main.json`
- Modify: `tests/pomodoro-window-capability.test.mjs`

- [ ] **Step 1: Write failing transaction tests**

Use a fake adapter with call logging to cover:

- snapshot of size, position, resizable, always-on-top, and maximized state;
- maximized entry unmaximizes before reading normal geometry;
- enter applies compact size, non-resizable, and always-on-top;
- exit restores geometry and flags, maximizing last when originally maximized;
- every injected forward failure triggers best-effort reverse restoration;
- rollback failures preserve the original error and include rollback context;
- entering uses logical `340 × 160`, while snapshot restoration uses the exact physical size and position;
- two queued enter intents are idempotent and never replace the original normal-window snapshot;
- an exit/force-exit intent arriving during entry wins, leaving the final native/UI mode normal.

The adapter interface must make units explicit so Retina scaling cannot corrupt restoration:

```ts
export interface PhysicalGeometry {
  size: { width: number; height: number }
  position: { x: number; y: number }
}

export interface MiniWindowAdapter {
  innerPhysicalSize(): Promise<PhysicalGeometry['size']>
  outerPhysicalPosition(): Promise<PhysicalGeometry['position']>
  isResizable(): Promise<boolean>
  isAlwaysOnTop(): Promise<boolean>
  isMaximized(): Promise<boolean>
  setLogicalSize(width: number, height: number): Promise<void>
  setPhysicalSize(size: PhysicalGeometry['size']): Promise<void>
  setPhysicalPosition(position: PhysicalGeometry['position']): Promise<void>
  setResizable(value: boolean): Promise<void>
  setAlwaysOnTop(value: boolean): Promise<void>
  maximize(): Promise<void>
  unmaximize(): Promise<void>
}
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/pomodoro-mini-window.test.mjs tests/pomodoro-window-capability.test.mjs`

Expected: FAIL because the transaction module and four additional permissions do not exist.

- [ ] **Step 3: Implement the minimum transaction module**

Add `captureWindowSnapshot`, `enterMiniWindow`, `restoreWindow`, and a serialized controller with internal native mode (`normal | entering | mini | exiting`), original snapshot, and monotonically increasing desired-mode generation. Keep snapshot and rollback logic in this pure module; do not import React. Queue execution must re-check the latest desired mode when it starts: duplicate enter is a no-op once entering/mini and must not capture again; exit requested during entry runs immediately after entry (or its rollback) and ends normal. The Tauri adapter uses `LogicalSize(340, 160)` only for entry, and restores snapshots with `PhysicalSize` / `PhysicalPosition`, preserving display scale exactly.

Extend the main-only capability with:

```json
"core:window:allow-set-position",
"core:window:allow-set-resizable",
"core:window:allow-maximize",
"core:window:allow-unmaximize"
```

Do not grant any Mini permission to `butler`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/pomodoro-mini-window.test.mjs tests/pomodoro-window-capability.test.mjs && npx eslint src/lib/pomodoroMiniWindow.ts && npx tsc -b && cargo check --manifest-path src-tauri/Cargo.toml`

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pomodoroMiniWindow.ts tests/pomodoro-mini-window.test.mjs src-tauri/capabilities/pomodoro-window-main.json tests/pomodoro-window-capability.test.mjs
git commit -m "feat: add safe Pomodoro mini window transaction"
```

### Task 3: Make AppShell own Mini mode and render only timer content

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/PomodoroPage.tsx`
- Create: `tests/pomodoro-mini-mode.test.mjs`

- [ ] **Step 1: Write the failing integration contract**

Assert that:

- `AppShellOutletContext` retains `triggerReview` and adds `isMini`, `enterMini`, and `exitMini`;
- `AppShell` conditionally omits TitleBar, Sidebar, StatusBar, Butler, search, daily review, and OCR while Mini is active;
- the Mini content container has no normal top padding or page padding;
- `AppShell` watches `location.pathname` and force-exits Mini when it is not `/pomodoro`, including when navigation happens while entry is pending;
- duplicate rapid enter clicks do not capture Mini geometry as the normal snapshot;
- `SuspendedOutlet` still forwards the complete typed context;
- `PomodoroPage` no longer directly calls `getCurrentWindow`, `setSize`, or `setAlwaysOnTop` and instead consumes outlet actions;
- Mini task name derives from `state.related_todo_id`;
- PomodoroPage subscribes once at page level and unsubscribes on cleanup.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/pomodoro-mini-mode.test.mjs`

Expected: FAIL because AppShell does not own Mini mode and its chrome remains rendered.

- [ ] **Step 3: Implement AppShell ownership**

Create the unit-explicit Tauri adapter in `AppShell` from `getCurrentWindow()`. Hold one controller ref whose desired/native mode and original snapshot live outside React render closures, plus mounted and current-path refs. `enterMini` requests desired mode `mini`; after native entry resolves, commit `isMini=true` only if the latest intent is still Mini and the route is still `/pomodoro`. A duplicate request while entering/mini is idempotent. Route change or unmount always requests desired mode `normal`; if it arrives during entry, the controller restores immediately after entry and stale completion cannot commit Mini UI. On manual exit, keep Mini UI if restore fails so the user can retry; on route/unmount forced cleanup, reveal the shell first and report restoration failure.

Render one compact branch around the outlet:

```tsx
<div className={isMini ? 'h-screen w-screen overflow-hidden bg-surface' : 'flex h-screen ...'}>
  {!isMini && <TitleBar />}
  {!isMini && <Sidebar ... />}
  <main className={isMini ? 'h-full w-full' : '...'}>
    <div className={isMini ? 'h-full w-full' : '...'}>
      <Outlet context={{ triggerReview, isMini, enterMini, exitMini }} />
    </div>
    {!isMini && <StatusBar />}
  </main>
  {!isMini && <ButlerOverlay />}
  ...
</div>
```

Keep global keyboard navigation disabled while Mini is active. Do not create a store or second window.

- [ ] **Step 4: Update PomodoroPage**

Consume the extended outlet context. Replace local `isMiniWindow` and direct Tauri calls with `isMini`, `enterMini`, and `exitMini`. Keep one page-level timer state subscription for both full and compact render branches. Derive the active task from `state.related_todo_id`; preserve start/pause/resume semantics. Add a reason comment to the existing empty catch in the touched file so its focused lint passes.

- [ ] **Step 5: Verify focused and full behavior**

Run:

```bash
node --test tests/pomodoro-mini-mode.test.mjs tests/pomodoro-mini-window.test.mjs tests/pomodoro-subscriptions.test.mjs tests/pomodoro-window-capability.test.mjs tests/pomodoro-persistence.test.mjs
npm test
npx tsc -b
npx eslint src/components/layout/AppShell.tsx src/App.tsx src/pages/PomodoroPage.tsx src/components/layout/StatusBar.tsx src/services/pomodoroService.ts src/lib/pomodoroMiniWindow.ts
git diff --check
```

Expected: all focused checks, all Node tests, TypeScript, touched-file lint, and diff check PASS. Run `npm run check` once and record only the known unrelated baseline failures from `a695a9c`; no new failures may appear. Run `cargo check --manifest-path src-tauri/Cargo.toml` after capability changes.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/AppShell.tsx src/App.tsx src/pages/PomodoroPage.tsx tests/pomodoro-mini-mode.test.mjs
git commit -m "feat: complete Pomodoro mini mode"
```

### Task 4: Final review and runtime smoke test

**Files:**
- No planned source changes

- [ ] **Step 1: Run automated acceptance**

Run all commands from Task 3 Step 5 plus `cargo test --manifest-path src-tauri/Cargo.toml`.

Expected: focused checks PASS; only documented unrelated repository-wide lint/chunk baseline may remain.

- [ ] **Step 2: Run Tauri smoke test**

From `/pomodoro`, enter Mini and verify shell chrome disappears, timer controls remain live, window is `340 × 160`, non-resizable, and always-on-top. Exit and verify prior geometry/flags. Repeat from a maximized window. Trigger navigation/close during Mini and verify the shell is not stranded hidden.

- [ ] **Step 3: Request code review**

Review all commits against `docs/superpowers/specs/2026-09-14-pomodoro-mini-mode-design.md`, fixing only confirmed blocking regressions.
