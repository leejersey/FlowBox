import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('截图 OCR 的两个入口都会忽略过期请求，关闭和卸载会使请求失效', async () => {
  const source = await readFile(new URL('../src/hooks/useScreenshotOcr.ts', import.meta.url), 'utf8')

  assert.equal(source.match(/const requestId = \+\+requestIdRef\.current/g)?.length, 2)
  assert.ok((source.match(/if \(requestId !== requestIdRef\.current\) return/g)?.length ?? 0) >= 5)
  assert.ok(source.includes('const close = useCallback(() => {\n    requestIdRef.current += 1'))
  assert.ok(source.includes('return () => {\n      requestIdRef.current += 1'))
})
