import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Butler service 应提供统一消息发送和截图分析入口', async () => {
  const source = await readFile(new URL('../src/services/butlerService.ts', import.meta.url), 'utf8').catch(() => '')

  assert.ok(
    source.includes('export async function sendButlerMessage'),
    '缺少 sendButlerMessage，Butler 无法调用真实 AI'
  )
  assert.ok(
    source.includes('export async function analyzeLatestClipboardImage'),
    '缺少 analyzeLatestClipboardImage，分析截图按钮无法接通'
  )
})

test('Butler service 分析截图时应读取最近一张剪贴板图片', async () => {
  const source = await readFile(new URL('../src/services/butlerService.ts', import.meta.url), 'utf8').catch(() => '')

  assert.ok(
    source.includes("clipList({ content_type: 'image', limit: 1 })"),
    '分析截图应读取最近一张 image 类型剪贴板记录'
  )
  assert.ok(
    source.includes('chatWithVision'),
    '分析截图应调用图片聊天能力'
  )
})

test('AI service 应扩展通用文本聊天和图片聊天接口', async () => {
  const source = await readFile(new URL('../src/services/aiService.ts', import.meta.url), 'utf8')

  assert.ok(
    source.includes('export async function chatWithAssistant'),
    'aiService 应导出 chatWithAssistant'
  )
  assert.ok(
    source.includes('export async function chatWithVision'),
    'aiService 应导出 chatWithVision'
  )
})
