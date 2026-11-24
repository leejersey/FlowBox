/**
 * 跨窗口数据变更通知
 *
 * 浮窗（快速记录、Butler）与主窗口各自持有独立的 React 状态，
 * 写库后广播 `flowbox:data-changed`，主窗口列表据此刷新。
 */

import { isTauri } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'

export type DataEntity = 'todo' | 'idea'

const DATA_CHANGED_EVENT = 'flowbox:data-changed'

export function emitDataChanged(entity: DataEntity): void {
  if (!isTauri()) return
  void emit(DATA_CHANGED_EVENT, { entity }).catch(() => {})
}

/** 订阅指定实体的变更，返回取消订阅函数（可直接作为 useEffect 清理函数） */
export function onDataChanged(entity: DataEntity, callback: () => void): () => void {
  if (!isTauri()) return () => {}
  let disposed = false
  let unlisten: (() => void) | undefined
  void listen<{ entity: DataEntity }>(DATA_CHANGED_EVENT, event => {
    if (event.payload?.entity === entity) callback()
  }).then(
    fn => (disposed ? fn() : (unlisten = fn)),
    () => {},
  )
  return () => {
    disposed = true
    unlisten?.()
  }
}
