import { isTauri } from '@tauri-apps/api/core'
import { emit, emitTo, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { createPomodoroBridge } from '@/lib/pomodoroBridge'
import { pomodoroStart } from './pomodoroService'

const MAIN_WINDOW = 'main'

const bridge = createPomodoroBridge({
  isMainWindow: () => !isTauri() || getCurrentWindow().label === MAIN_WINDOW,
  start: pomodoroStart,
  emit: (event, payload) => emit(event, payload),
  emitToMain: (event, payload) => emitTo(MAIN_WINDOW, event, payload),
  listen: (event, handler) => listen(event, e => handler(e.payload as never)),
})

export const requestPomodoroStart = bridge.requestStart
export const servePomodoroStartRequests = bridge.serveRequests
