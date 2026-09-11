import test from 'node:test'
import assert from 'node:assert/strict'
import { updateTodoAndRefresh } from '../src/lib/todoOptimisticUpdate.ts'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function updateHarness() {
  let stored = 'old'
  let visible = 'old'
  const start = title => {
    const request = deferred()
    const operation = updateTodoAndRefresh(
      1,
      async () => {
        await request.promise
        stored = title
        return title
      },
      async () => { visible = stored },
    )
    return { request, operation }
  }
  return { start, visible: () => visible }
}

test('同一 id 的两次更新依次失败后保留原值', async () => {
  const state = updateHarness()
  const first = state.start('first')
  const second = state.start('second')

  first.request.reject(new Error('first failed'))
  await assert.rejects(first.operation)
  second.request.reject(new Error('second failed'))
  await assert.rejects(second.operation)

  assert.equal(state.visible(), 'old')
})

test('同一 id 第一次成功、第二次失败后显示第一次的服务端结果', async () => {
  const state = updateHarness()
  const first = state.start('first')
  const second = state.start('second')

  first.request.resolve()
  await first.operation
  second.request.reject(new Error('second failed'))
  await assert.rejects(second.operation)

  assert.equal(state.visible(), 'first')
})

test('同一 id 第一次失败、第二次成功后显示第二次的服务端结果', async () => {
  const state = updateHarness()
  const first = state.start('first')
  const second = state.start('second')

  first.request.reject(new Error('first failed'))
  await assert.rejects(first.operation)
  second.request.resolve()
  await second.operation

  assert.equal(state.visible(), 'second')
})

test('同一 id 的较新更新等待较早 refresh，避免陈旧响应覆盖', async () => {
  const firstRefresh = deferred()
  let secondStarted = false
  const first = updateTodoAndRefresh(
    1,
    async () => 'first',
    async () => { await firstRefresh.promise },
  )

  const second = updateTodoAndRefresh(
    1,
    async () => {
      secondStarted = true
      return 'second'
    },
    async () => {},
  )

  await Promise.resolve()
  assert.equal(secondStarted, false)

  firstRefresh.resolve()
  assert.equal(await first, 'first')
  assert.equal(await second, 'second')
})

test('不同 id 的更新互不阻塞', async () => {
  const blocked = deferred()
  const first = updateTodoAndRefresh(
    1,
    async () => {
      await blocked.promise
      throw new Error('first failed')
    },
    async () => {},
  )
  const second = updateTodoAndRefresh(
    2,
    async () => 'second',
    async () => {},
  )

  assert.equal(await second, 'second')
  blocked.resolve()
  await assert.rejects(first)
})
