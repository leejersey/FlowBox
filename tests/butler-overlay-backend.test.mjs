import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('共享 ButlerWorkbench 应接入真实后端而不是 setTimeout 模拟回复', async () => {
  const source = await readFile(new URL('../src/components/butler/ButlerWorkbench.tsx', import.meta.url), 'utf8').catch(() => '')

  assert.ok(
    !source.includes('setTimeout(() => {'),
    'ButlerWorkbench 仍然使用 setTimeout 返回模拟 AI 回复'
  )
  assert.ok(
    source.includes('sendButlerMessage'),
    'ButlerWorkbench 应调用 sendButlerMessage 接入真实 Butler 后端'
  )
})

test('ButlerOverlay 应复用共享 ButlerWorkbench', async () => {
  const source = await readFile(new URL('../src/components/layout/ButlerOverlay.tsx', import.meta.url), 'utf8')

  assert.ok(
    source.includes('ButlerWorkbench'),
    'ButlerOverlay 应复用共享 ButlerWorkbench'
  )
})

test('Butler store 应保存 loading 状态和最近一次请求', async () => {
  const source = await readFile(new URL('../src/stores/butlerStore.ts', import.meta.url), 'utf8')

  assert.ok(
    source.includes('isLoading'),
    'butlerStore 缺少 isLoading，无法驱动发送中状态'
  )
  assert.ok(
    source.includes('lastRequest'),
    'butlerStore 缺少 lastRequest，无法支持重新生成'
  )
})

test('ChatMessageItem 应提供复制、优化、重新生成的真实回调入口', async () => {
  const source = await readFile(new URL('../src/components/butler/ChatMessageItem.tsx', import.meta.url), 'utf8')

  assert.ok(
    source.includes('onCopy'),
    'ChatMessageItem 应支持 onCopy 回调'
  )
  assert.ok(
    source.includes('onOptimize'),
    'ChatMessageItem 应支持 onOptimize 回调'
  )
  assert.ok(
    source.includes('onRegenerate'),
    'ChatMessageItem 应支持 onRegenerate 回调'
  )
})

test('Butler 独立窗口应复用同一套对话型 Butler 面板', async () => {
  const source = await readFile(new URL('../src/pages/ButlerPage.tsx', import.meta.url), 'utf8')

  assert.ok(
    source.includes('ButlerWorkbench'),
    'ButlerPage 应复用统一的 ButlerWorkbench，而不是保留旧的快捷启动器实现'
  )
})
