import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sidebar = await readFile(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8')
const settingsLink = sidebar.match(/<NavLink\s+to="\/settings"[\s\S]*?<\/NavLink>/)?.[0]

test('settings stays outside the main navigation sections', () => {
  const sections = sidebar.slice(sidebar.indexOf('const navSections'), sidebar.indexOf('interface SidebarProps'))
  assert.doesNotMatch(sections, /\/settings|系统设置/)
  assert.equal((sidebar.match(/to="\/settings"/g) ?? []).length, 1)
})

test('bottom settings link is an accessible icon in both sidebar sizes', () => {
  assert.ok(settingsLink, 'bottom settings NavLink must exist')
  assert.doesNotMatch(sidebar, /系统设置/)
  assert.match(settingsLink, /title="偏好设置 \(⌘,\)"/)
  assert.match(settingsLink, /aria-label="打开偏好设置"/)
  assert.match(settingsLink, /focus-visible:ring-2/)
  assert.match(settingsLink, /focus-visible:ring-primary/)
  assert.match(settingsLink, /<Settings\b[^>]*aria-hidden="true"[^>]*\/>/)
  assert.doesNotMatch(settingsLink, /<span\b|!collapsed|collapsed\s*\?/)
  assert.match(settingsLink, /isActive && 'text-primary bg-primary\/10'/)
})

test('settings and the unchanged collapse button remain separate controls', () => {
  const bottom = sidebar.slice(sidebar.indexOf('{/* 底部功能区'))
  assert.match(bottom, /<\/NavLink>[\s\S]*<button\s+onClick=\{\(\) => setCollapsed\(v => !v\)\}/)
  assert.match(bottom, /title=\{collapsed \? "展开侧边栏" : "折叠侧边栏"\}/)
  assert.match(bottom, /<ChevronRight className="w-4 h-4" \/>/)
  assert.match(bottom, /<ChevronLeft className="w-4 h-4 shrink-0" \/>/)
  assert.match(bottom, /折叠侧栏/)
})
