/**
 * 跨窗口番茄钟启动桥
 *
 * 番茄钟计时状态只存在于主窗口（托盘倒计时、专注模式联动都订阅它）。
 * Butler 等浮窗不能直接调用 pomodoroStart，否则计时只跑在浮窗自己的内存里；
 * 改为向主窗口发起请求并等待执行结果，失败信息仍能回到浮窗的动作卡片。
 */

import type { StartPomodoroPayload } from '@/types/pomodoro'

export const POMODORO_START_REQUEST = 'flowbox:pomodoro-start-request'
export const POMODORO_START_RESULT = 'flowbox:pomodoro-start-result'
const DEFAULT_TIMEOUT_MS = 5000

interface StartRequest {
  id: string
  payload: StartPomodoroPayload
}

interface StartResult {
  id: string
  ok: boolean
  error?: string
}

type Unlisten = () => void

export interface PomodoroBridgeDeps {
  isMainWindow: () => boolean
  start: (payload: StartPomodoroPayload) => Promise<unknown>
  emit: (event: string, payload: unknown) => Promise<void>
  emitToMain: (event: string, payload: unknown) => Promise<void>
  listen: <T>(event: string, handler: (payload: T) => void) => Promise<Unlisten>
  timeoutMs?: number
}

export function createPomodoroBridge(deps: PomodoroBridgeDeps) {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let seq = 0

  /** 在任意窗口启动番茄钟：主窗口直接执行，其他窗口转发给主窗口 */
  async function requestStart(payload: StartPomodoroPayload): Promise<void> {
    if (deps.isMainWindow()) {
      await deps.start(payload)
      return
    }

    const id = `${Date.now()}-${++seq}`
    let unlisten: Unlisten | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await new Promise<StartResult>((resolve, reject) => {
        deps.listen<StartResult>(POMODORO_START_RESULT, res => {
          if (res?.id === id) resolve(res)
        }).then(fn => {
          unlisten = fn
          timer = setTimeout(() => reject(new Error('主窗口未响应，番茄钟启动超时')), timeoutMs)
          return deps.emitToMain(POMODORO_START_REQUEST, { id, payload } satisfies StartRequest)
        }).catch(reject)
      })
      if (!result.ok) throw new Error(result.error ?? '番茄钟启动失败')
    } finally {
      if (timer) clearTimeout(timer)
      unlisten?.()
    }
  }

  /** 仅在主窗口调用：处理来自其他窗口的启动请求 */
  function serveRequests(): Promise<Unlisten> {
    return deps.listen<StartRequest>(POMODORO_START_REQUEST, req => {
      if (!req?.id) return
      void deps.start(req.payload).then(
        () => deps.emit(POMODORO_START_RESULT, { id: req.id, ok: true } satisfies StartResult),
        err => deps.emit(POMODORO_START_RESULT, { id: req.id, ok: false, error: String(err) } satisfies StartResult),
      ).catch(() => {})
    })
  }

  return { requestStart, serveRequests }
}
