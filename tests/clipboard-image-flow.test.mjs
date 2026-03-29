import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Rust 剪贴板事件载荷应包含 image_path', async () => {
  const source = await readFile(new URL('../src-tauri/src/services/clipboard_watcher.rs', import.meta.url), 'utf8')

  assert.ok(
    source.includes('pub image_path: Option<String>'),
    'ClipboardPayload 缺少 image_path，前端无法保存图片记录'
  )
  assert.ok(
    source.includes('text_content: Option<String>'),
    'ClipboardPayload 的 text_content 应可空，才能支持图片事件'
  )
})

test('前端剪贴板监听应透传 image_path 到 clipCreate', async () => {
  const source = await readFile(new URL('../src/hooks/useClipboardWatcher.ts', import.meta.url), 'utf8')

  assert.ok(
    source.includes('image_path'),
    'useClipboardWatcher 未处理 image_path 字段'
  )
  assert.ok(
    source.includes('image_path: image_path'),
    '图片事件没有透传 image_path 给 clipCreate'
  )
})
