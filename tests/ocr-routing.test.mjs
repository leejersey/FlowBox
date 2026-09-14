import test from 'node:test'
import assert from 'node:assert/strict'
import { ocrRoute, normalizeOcrResult } from '../src/lib/ocrRouting.ts'

test('仅 OpenAI 直接接收图片，其他 provider 先走本地文字识别', () => {
  assert.equal(ocrRoute('openai'), 'vision')
  assert.equal(ocrRoute('deepseek'), 'local-text')
  assert.equal(ocrRoute('ollama'), 'local-text')
})

test('非 JSON 模型输出安全回退', () => {
  assert.equal(normalizeOcrResult('plain text').rawText, 'plain text')
})
