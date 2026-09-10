import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyTodoOptimisticUpdate,
  rollbackTodoOptimisticUpdate,
} from '../src/lib/todoOptimisticUpdate.ts'

const todo = (id, title) => ({
  id,
  title,
  content: 'content',
  priority: 0,
  status: 'pending',
  source: 'manual',
  source_id: null,
  due_date: null,
  tags: '["old"]',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  completed_at: null,
})

test('乐观更新忽略 undefined，并序列化已定义的 tags', () => {
  const original = todo(1, 'old')
  const unchanged = applyTodoOptimisticUpdate([original], {
    id: 1,
    title: undefined,
    content: undefined,
    tags: undefined,
  })
  const tagged = applyTodoOptimisticUpdate(unchanged, { id: 1, tags: ['new'] })

  assert.equal(unchanged[0].title, 'old')
  assert.equal(unchanged[0].content, 'content')
  assert.equal(unchanged[0].tags, '["old"]')
  assert.equal(tagged[0].tags, '["new"]')
})

test('较早失败只回滚目标 id，不覆盖其他 id 的较晚更新', () => {
  const original = [todo(1, 'one'), todo(2, 'two')]
  const first = applyTodoOptimisticUpdate(original, { id: 1, title: 'one updated' })
  const second = applyTodoOptimisticUpdate(first, { id: 2, title: 'two updated' })

  const rolledBack = rollbackTodoOptimisticUpdate(second, original, 1, first[0])

  assert.equal(rolledBack[0].title, 'one')
  assert.equal(rolledBack[1].title, 'two updated')
})

test('同一 id 已再次更新时忽略陈旧失败', () => {
  const original = [todo(1, 'old')]
  const first = applyTodoOptimisticUpdate(original, { id: 1, title: 'first' })
  const second = applyTodoOptimisticUpdate(first, { id: 1, title: 'second' })

  const rolledBack = rollbackTodoOptimisticUpdate(second, original, 1, first[0])

  assert.equal(rolledBack[0].title, 'second')
})
