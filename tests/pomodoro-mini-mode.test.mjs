import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const [shell, page, app] = await Promise.all([
  readFile(new URL('../src/components/layout/AppShell.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/PomodoroPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
])

test('typed outlet context retains review and adds Mini owner actions', () => {
  assert.match(shell, /interface AppShellOutletContext[\s\S]*triggerReview:[\s\S]*isMini: boolean[\s\S]*enterMini:[\s\S]*exitMini:/)
  assert.match(shell, /<Outlet context=\{\{ triggerReview: dailyReview.triggerReview, isMini, enterMini, exitMini \}\}/)
  assert.match(app, /useOutletContext<AppShellOutletContext>\(\)/)
  assert.match(app, /<Outlet context=\{context\}/)
})

test('Mini omits chrome and removes normal main and inner padding', () => {
  for (const component of ['TitleBar', 'Sidebar', 'StatusBar', 'ButlerOverlay', 'GlobalSearchBar', 'DailyReviewModal', 'ScreenshotOcrPanel']) {
    assert.match(shell, new RegExp(`!isMini && \\(?\\s*<${component}\\b`))
  }
  assert.match(shell, /<main className=\{isMini \? 'h-full w-full overflow-hidden'/)
  assert.match(shell, /<div className=\{isMini \? 'h-full w-full'/)
})

test('main-only unit-explicit adapter and route/unmount cleanup stay in AppShell', () => {
  assert.match(shell, /useLocation\(\)/)
  assert.match(shell, /if \(isTauriApp[\s\S]*getCurrentWindow\(\)[\s\S]*\.label === 'main'/)
  assert.match(shell, /createMiniWindowController\(/)
  assert.match(shell, /innerPhysicalSize: \(\) => win.innerSize\(\)/)
  assert.match(shell, /outerPhysicalPosition: \(\) => win.outerPosition\(\)/)
  for (const unit of ['LogicalSize', 'PhysicalSize', 'PhysicalPosition']) assert.match(shell, new RegExp(`new ${unit}\\(`))
  assert.match(shell, /currentPathRef.current = location.pathname/)
  assert.match(shell, /location.pathname !== '\/pomodoro'[\s\S]*forceExitMini/)
  assert.match(shell, /mountedRef.current = false[\s\S]*forceExit\(\)/)
  assert.match(shell, /if \(isMini\) return/)
})

test('page shares one subscribed state and activity truth across full/Mini views', () => {
  assert.doesNotMatch(page, /isMiniWindow|getCurrentWindow|LogicalSize|setAlwaysOnTop|\.setSize\(/)
  assert.match(page, /useOutletContext<AppShellOutletContext>\(\)/)
  assert.match(page, /if \(isMini\)/)
  assert.match(page, /todos.find\(t => t.id === state.related_todo_id\)/)
  assert.equal((page.match(/pomodoroService.pomodoroOnTick\(/g) ?? []).length, 1)
  assert.equal((page.match(/pomodoroService.pomodoroOnComplete\(/g) ?? []).length, 1)
  assert.match(page, /unsubscribeTick\(\)[\s\S]*unsubscribeComplete\(\)/)
  assert.match(page, /<PomodoroDial[\s\S]*state=\{state\}/)
  assert.match(page, /const isActive = state.total_seconds > 0/)
  assert.match(page, /onClick=\{exitMini\}/)
  assert.match(page, /onClick=\{enterMini\}/)
})

// Execute the actual callback bodies, not a duplicate lifecycle implementation.
function action(name, environment) {
  const tree = ts.createSourceFile('AppShell.tsx', shell, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let callback
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0]
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.ok(callback, `${name} callback must exist`)
  const js = ts.transpileModule(`const callback = ${callback.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return Function(...Object.keys(environment), `${js}\nreturn callback`)(...Object.values(environment))
}

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function setup() {
  const entered = deferred()
  const exited = deferred()
  const updates = [], toasts = [], search = []
  let forced = 0
  const controller = {
    enter: () => entered.promise,
    exit: () => exited.promise,
    forceExit: async () => { forced += 1 },
    getState: () => ({ mode: 'mini', desired: 'mini', generation: 1 }),
  }
  const environment = {
    isTauriApp: true,
    mountedRef: { current: true },
    currentPathRef: { current: '/pomodoro' },
    controllerRef: { current: controller },
    setIsMini: value => updates.push(value),
    setSearchOpen: value => search.push(value),
    showToast: (...args) => toasts.push(args),
  }
  return { environment, controller, entered, exited, updates, toasts, search, forced: () => forced }
}

test('entry only commits Mini after native success and closes search', async () => {
  const f = setup()
  const pending = action('enterMini', f.environment)()
  assert.deepEqual(f.updates, [])
  f.entered.resolve()
  await pending
  assert.deepEqual(f.updates, [true])
  assert.deepEqual(f.search, [false])
})

test('route change during entry prevents stale Mini commit and forces cleanup', async () => {
  const f = setup()
  const pending = action('enterMini', f.environment)()
  f.environment.currentPathRef.current = '/settings'
  f.entered.resolve()
  await pending
  assert.deepEqual(f.updates, [])
  assert.equal(f.forced(), 1)
})

for (const outcome of ['resolve', 'reject']) {
  test(`unmounted entry ${outcome} does not update UI or toast`, async () => {
    const f = setup()
    const pending = action('enterMini', f.environment)()
    f.environment.mountedRef.current = false
    f.entered[outcome](new Error('native failure'))
    await pending
    assert.deepEqual(f.updates, [])
    assert.deepEqual(f.toasts, [])
  })
}

test('manual exit failure keeps Mini UI and reports error', async () => {
  const f = setup()
  const pending = action('exitMini', f.environment)()
  f.exited.reject(new Error('restore failed'))
  await pending
  assert.deepEqual(f.updates, [])
  assert.equal(f.toasts.length, 1)
})

test('forced exit reveals shell before waiting for native restoration', async () => {
  const f = setup()
  f.controller.forceExit = () => f.exited.promise
  const pending = action('forceExitMini', f.environment)()
  assert.deepEqual(f.updates, [false])
  f.environment.mountedRef.current = false
  f.exited.reject(new Error('restore failed'))
  await pending
  assert.deepEqual(f.toasts, [])
})

test('browser entry shows info and never invokes controller', async () => {
  const f = setup()
  f.environment.isTauriApp = false
  f.controller.enter = () => { assert.fail('browser must not enter native mode') }
  await action('enterMini', f.environment)()
  assert.equal(f.toasts[0][1], 'info')
  assert.deepEqual(f.updates, [])
})
