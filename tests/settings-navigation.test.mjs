import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createSettingsNavigation } from '../src/lib/settingsNavigation.ts'

test('delayed subscription precedes readiness and pending requests coalesce', async () => {
  const nav = createSettingsNavigation()
  let subscribed, request, ready = 0, unlistened = 0
  const subscription = new Promise(resolve => { subscribed = resolve })
  const start = nav.start(() => { request = () => nav.request(); return subscription }, async () => { ready++ })
  await Promise.resolve()
  assert.equal(ready, 0)
  request(); request()
  subscribed(() => { unlistened++ })
  await start
  assert.equal(ready, 1)
  const calls = []
  const cleanup = nav.bind(() => calls.push('/settings'))
  assert.deepEqual(calls, ['/settings'])
  request()
  assert.equal(calls.length, 2)
  cleanup()
  assert.equal(unlistened, 0)
})

test('concurrent and repeated starts retain one process subscription', async () => {
  const nav = createSettingsNavigation()
  let subscriptions = 0, ready = 0
  const subscribe = async () => { subscriptions++ }
  const enable = async () => { ready++ }
  await Promise.all([nav.start(subscribe, enable), nav.start(subscribe, enable)])
  await nav.start(subscribe, enable)
  assert.equal(subscriptions, 1)
  assert.equal(ready, 3)
})

test('requests during delayed readiness survive a late Router bind', async () => {
  const nav = createSettingsNavigation()
  let enable, request, calls = 0, settled = false
  const readiness = new Promise(resolve => { enable = resolve })
  const start = nav.start(async () => { request = () => nav.request() }, () => readiness)
    .then(() => { settled = true })
  await Promise.resolve()
  request(); request()
  nav.bind(() => { calls++ })
  assert.equal(calls, 1)
  assert.equal(settled, false)
  enable()
  await start
  assert.equal(settled, true)
  assert.equal(calls, 1)
})

test('subscription failure retries without enabling the menu', async () => {
  const nav = createSettingsNavigation()
  let subscriptions = 0, ready = 0
  const subscribe = async () => { if (++subscriptions === 1) throw new Error('listen failed') }
  const enable = async () => { ready++ }
  await assert.rejects(nav.start(subscribe, enable), /listen failed/)
  assert.equal(ready, 0)
  await nav.start(subscribe, enable)
  assert.equal(subscriptions, 2)
  assert.equal(ready, 1)
})

test('readiness failure retries only readiness while retaining the listener', async () => {
  const nav = createSettingsNavigation()
  let subscriptions = 0, ready = 0
  const subscribe = async () => { subscriptions++ }
  const enable = async () => { if (++ready === 1) throw new Error('ready failed') }
  await assert.rejects(nav.start(subscribe, enable), /ready failed/)
  await nav.start(subscribe, enable)
  assert.equal(subscriptions, 1)
  assert.equal(ready, 2)
})

test('StrictMode rebind consumes pending once and stale cleanup preserves the current handler', () => {
  const nav = createSettingsNavigation()
  let oldCalls = 0, newCalls = 0
  const oldCleanup = nav.bind(() => { oldCalls++ })
  oldCleanup()
  nav.request(); nav.request()
  const cleanup = nav.bind(() => { newCalls++ })
  oldCleanup()
  nav.request()
  assert.equal(oldCalls, 0)
  assert.equal(newCalls, 2)
  cleanup()
  nav.request(); nav.request()
  nav.bind(() => { newCalls++ })
  assert.equal(newCalls, 3)
})

const source = async path => readFile(new URL(path, import.meta.url), 'utf8')

test('native service gates browser/Butler before listening and preserves its HMR singleton', async () => {
  const service = await source('../src/services/settingsNavigationService.ts')
  assert.match(service, /isTauri\(\) && \/Mac\/.test\(navigator.platform\)/)
  assert.match(service, /globalThis/)
  assert.match(service, /__flowboxSettingsNavigation \?\?=/)
  const initializer = service.slice(service.indexOf('export async function initializeSettingsNavigation'))
  assert.match(initializer, /if \(!supportsNativeSettingsMenu\(\) \|\| getCurrentWindow\(\).label !== 'main'\) return/)
  assert.ok(initializer.indexOf('return') < initializer.indexOf('settingsNavigation.start('))
  assert.match(initializer, /listen\('flowbox:open-settings', \(\) => settingsNavigation.request\(\)\)/)
  assert.match(initializer, /invoke\('settings_menu_ready'\)/)
  assert.doesNotMatch(service, /useEffect|unlisten\(/)
})

test('bootstrap precedes React and the main bridge is inside Router but outside Routes', async () => {
  const main = await source('../src/main.tsx')
  const app = await source('../src/App.tsx')
  assert.ok(main.indexOf('void initializeSettingsNavigation()') < main.indexOf('createRoot(document'))
  assert.match(main, /initializeSettingsNavigation\(\).catch\(/)
  assert.doesNotMatch(main, /useEffect/)
  assert.match(app, /useEffect\(\(\) => settingsNavigation.bind\(\(\) => navigate\('\/settings'\)\), \[navigate\]\)/)
  assert.match(app, /windowLabel === 'main' && <SettingsNavigationBridge \/>/)
  const bridge = app.indexOf('<SettingsNavigationBridge />')
  assert.ok(app.indexOf('<BrowserRouter>') < bridge && bridge < app.indexOf('<Routes>'))
  assert.ok(app.indexOf('if (!ready)') < app.indexOf('<BrowserRouter>'))
})

test('native comma navigation bypasses Mini DOM early-return while pathname restoration remains', async () => {
  const shell = await source('../src/components/layout/AppShell.tsx')
  assert.match(shell, /e.key === ',' && !supportsNativeSettingsMenu\(\)/)
  assert.match(shell, /if \(isMini\) return/)
  assert.match(shell, /if \(location.pathname !== '\/pomodoro'\)/)
  assert.match(shell, /return forceExitMini\(\)/)
  assert.match(shell, /triggerReview: dailyReview.triggerReview, isMini, enterMini, exitMini/)
})
