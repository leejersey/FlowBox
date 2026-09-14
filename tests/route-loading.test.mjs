import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const lazyRoutes = ['Todo', 'Idea', 'Pomodoro', 'Clipboard', 'Voice', 'Markdown', 'Stats', 'Trending', 'Settings']

test('feature routes use named-export lazy adapters', () => {
  for (const name of lazyRoutes) {
    assert.doesNotMatch(source, new RegExp(`import \\{ ${name}Page \\} from './pages/${name}Page'`))
    assert.match(
      source,
      new RegExp(`const ${name}Page = lazy\\(\\(\\) => import\\('./pages/${name}Page'\\)\\.then\\(module => \\(\\{ default: module\\.${name}Page \\}\\)\\)\\)`),
    )
  }
})

test('one Suspense boundary wraps only the lazy outlet below AppShell', () => {
  assert.equal(source.match(/<Suspense\b/g)?.length, 1)
  assert.match(source, /function SuspendedOutlet\(\)[\s\S]*<Suspense fallback=\{<div[^>]*>加载中\.\.\.<\/div>\}>\s*<Outlet context=\{context\} \/>\s*<\/Suspense>/)
  assert.doesNotMatch(source, /<Suspense[^>]*>\s*<Routes>/)

  const lazyOutlet = source.match(
    /<Route path="\/" element=\{<AppShell \/>\}>\s*<Route element=\{<SuspendedOutlet \/>\}>([\s\S]*?)<\/Route>\s*<\/Route>/,
  )?.[1]
  assert.ok(lazyOutlet, 'AppShell should stay outside the lazy outlet boundary')

  for (const name of lazyRoutes) assert.match(lazyOutlet, new RegExp(`element=\\{<${name}Page \\/>\\}`))
  assert.doesNotMatch(lazyOutlet, /ButlerPage/)
  assert.match(source, /<\/Route>\s*<\/Route>[\s\S]*<Route path="\/butler" element=\{<ButlerPage \/>\} \/>/)
})

test('suspended outlet preserves the AppShell outlet context', () => {
  assert.match(source, /import \{[^}]*useOutletContext[^}]*\} from 'react-router-dom'/)
  assert.match(source, /import (?:type )?\{[^}]*AppShellOutletContext[^}]*\} from '\.\/components\/layout\/AppShell'/)
  assert.match(source, /const context = useOutletContext<AppShellOutletContext>\(\)/)
  assert.match(source, /<Outlet context=\{context\} \/>/)
})

test('app shell, toast, and Butler stay synchronously loaded', () => {
  for (const [name, path] of [
    ['AppShell', './components/layout/AppShell'],
    ['ToastContainer', './components/ui/ToastContainer'],
    ['ButlerPage', './pages/ButlerPage'],
  ]) {
    assert.match(source, new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from '${path}'`))
  }
})
