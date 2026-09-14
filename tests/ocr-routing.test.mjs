import test from 'node:test'
import assert from 'node:assert/strict'
import { ocrRoute, normalizeOcrResult } from '../src/lib/ocrRouting.ts'

test('仅 OpenAI 直接接收图片，其他 provider 先走本地文字识别', () => {
  assert.equal(ocrRoute('openai'), 'vision')
  assert.equal(ocrRoute('deepseek'), 'local-text')
  assert.equal(ocrRoute('ollama'), 'local-text')
})

test('非 JSON 模型输出保留本地 OCR 原文', () => {
  const result = normalizeOcrResult('model prose', '本地 OCR 原文')
  assert.equal(result.rawText, '本地 OCR 原文')
  assert.equal(result.suggestedTitle, '本地 OCR 原文')
})

test('JSON 缺少有效 rawText 时保留本地 OCR 原文', () => {
  const result = normalizeOcrResult('{"rawText":"  ","suggestedTags":[]}', '本地 OCR 原文')
  assert.equal(result.rawText, '本地 OCR 原文')
  assert.equal(result.suggestedTitle, '本地 OCR 原文')
})
