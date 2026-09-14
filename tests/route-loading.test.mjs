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

test('one Suspense boundary wraps Routes with a loading fallback', () => {
  assert.equal(source.match(/<Suspense\b/g)?.length, 1)
  assert.match(source, /<Suspense fallback=\{<div[^>]*>加载中\.\.\.<\/div>\}>\s*<Routes>[\s\S]*<\/Routes>\s*<\/Suspense>/)
})

test('app shell, toast, and Butler stay synchronously loaded', () => {
  for (const [name, path] of [
    ['AppShell', './components/layout/AppShell'],
    ['ToastContainer', './components/ui/ToastContainer'],
    ['ButlerPage', './pages/ButlerPage'],
  ]) {
    assert.match(source, new RegExp(`import \\{ ${name} \\} from '${path}'`))
  }
})
