import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFile } from 'node:fs/promises'
import { canonicalizeLink, createOrGetLink, ensureLinkedTarget, linkedTargetId } from '../src/lib/itemLink.ts'

test('关联高亮只接受对应类型的安全正整数 ID', () => {
  assert.equal(linkedTargetId('todo-42', 'todo'), 42)
  for (const value of ['todo-0', 'todo--1', 'todo-1.5', 'idea-42', `todo-${Number.MAX_SAFE_INTEGER}0`]) {
    assert.equal(linkedTargetId(value, 'todo'), null)
  }
})

test('关联目标超出列表上限时按 ID 补载', async () => {
  const items = Array.from({ length: 200 }, (_, index) => ({ id: index + 1 }))
  const loaded = { id: 999 }
  const result = await ensureLinkedTarget(items, loaded.id, async () => loaded)

  assert.equal(result.target, loaded)
  assert.equal(result.items.find(item => item.id === loaded.id), loaded)
})

test('关联目标已在列表中时不重复加载', async () => {
  const items = [{ id: 1 }]
  let calls = 0
  const result = await ensureLinkedTarget(items, 1, async () => {
    calls++
    return { id: 1 }
  })

  assert.equal(calls, 0)
  assert.equal(result.items, items)
  assert.equal(result.target, items[0])
})

test('关联目标加载失败时向调用方报错', async () => {
  await assert.rejects(
    ensureLinkedTarget([], 999, async () => { throw new Error('NOT_FOUND') }),
    /NOT_FOUND/
  )
})

test('A-B 与 B-A 规范化为同一端点顺序', () => {
  assert.deepEqual(canonicalizeLink('todo', 9, 'idea', 2), canonicalizeLink('idea', 2, 'todo', 9))
  assert.deepEqual(canonicalizeLink('todo', 10, 'todo', 2), {
    sourceType: 'todo', sourceId: 2, targetType: 'todo', targetId: 10,
  })
  assert.throws(() => canonicalizeLink('idea', 2, 'idea', 2), /不能关联自身/)
})

test('迁移清理反向重复且约束拒绝再次重复', async () => {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE item_links(id INTEGER PRIMARY KEY, source_type TEXT NOT NULL, source_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(source_type, source_id, target_type, target_id));')
  const insert = db.prepare('INSERT INTO item_links VALUES (?, ?, ?, ?, ?, ?)')
  insert.run(1, 'todo', 9, 'idea', 2, '2026-09-10T00:00:00Z')
  insert.run(2, 'idea', 2, 'todo', 9, '2026-09-10T00:00:01Z')
  insert.run(3, 'todo', 10, 'todo', 2, '2026-09-10T00:00:02Z')
  const migration = await readFile(new URL('../src-tauri/migrations/009_item_links_canonical.sql', import.meta.url), 'utf8')
  db.exec(migration)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM item_links').get().count, 2)
  assert.deepEqual({ ...db.prepare('SELECT source_type, source_id, target_type, target_id FROM item_links WHERE id = 3').get() }, {
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

test('四类关联支持创建、双向读取、反向去重与删除', async () => {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE item_links(id INTEGER PRIMARY KEY, source_type TEXT NOT NULL, source_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(source_type, source_id, target_type, target_id));')
  db.exec(await readFile(new URL('../src-tauri/migrations/009_item_links_canonical.sql', import.meta.url), 'utf8'))
  const adapter = {
    execute: async (sql, params) => db.prepare(sql).run(...params),
    select: async (sql, params) => db.prepare(sql).all(...params),
  }
  const todoIdea = await createOrGetLink(adapter, 'todo', 1, 'idea', 2)
  const voiceClipboard = await createOrGetLink(adapter, 'voice', 3, 'clipboard', 4)
  assert.equal((await createOrGetLink(adapter, 'idea', 2, 'todo', 1)).id, todoIdea.id)
  assert.equal((await createOrGetLink(adapter, 'clipboard', 4, 'voice', 3)).id, voiceClipboard.id)

  const byItem = (type, id) => db.prepare(`SELECT id FROM item_links
    WHERE (source_type = ?1 AND source_id = ?2) OR (target_type = ?1 AND target_id = ?2)`).all(type, id)
  assert.equal(byItem('todo', 1)[0].id, todoIdea.id)
  assert.equal(byItem('idea', 2)[0].id, todoIdea.id)
  assert.equal(byItem('voice', 3)[0].id, voiceClipboard.id)
  assert.equal(byItem('clipboard', 4)[0].id, voiceClipboard.id)

  db.prepare('DELETE FROM item_links WHERE id = ?').run(todoIdea.id)
  assert.equal(byItem('todo', 1).length, 0)
  assert.equal(byItem('idea', 2).length, 0)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM item_links').get().count, 1)
})

test('共享关联面板提供真实 CRUD 与四类路由', async () => {
  const source = await readFile(new URL('../src/components/links/LinkPanel.tsx', import.meta.url), 'utf8')
  const searchSource = await readFile(new URL('../src/services/searchService.ts', import.meta.url), 'utf8')
  for (const name of ['globalSearch', 'linksByItem', 'linkCreate', 'linkDelete']) {
    assert.match(source, new RegExp(`\\b${name}\\b`))
  }
  assert.match(source, /todo:\s*['"]\/['"]/)
  assert.match(source, /idea:\s*['"]\/idea['"]/)
  assert.match(source, /voice:\s*['"]\/voice['"]/)
  assert.match(source, /clipboard:\s*['"]\/clipboard['"]/)
  assert.match(source, /highlight=\$\{target\.type\}-\$\{target\.id\}/)
  assert.match(searchSource, /SearchResultType\s*=\s*LinkableType/)
})

test('四类页面消费 highlight，四类详情或卡片接入关联入口', async () => {
  const paths = [
    '../src/pages/TodoPage.tsx',
    '../src/pages/IdeaPage.tsx',
    '../src/pages/VoicePage.tsx',
    '../src/pages/ClipboardPage.tsx',
  ]
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /useSearchParams/)
    assert.match(source, /highlight/)
    assert.match(source, /scrollIntoView/)
  }
  for (const path of [
    '../src/components/todo/TodoDetailModal.tsx',
    '../src/pages/IdeaPage.tsx',
    '../src/pages/VoicePage.tsx',
    '../src/pages/ClipboardPage.tsx',
  ]) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /LinkPanel/)
  }
})
