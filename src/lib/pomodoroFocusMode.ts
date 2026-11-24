/**
 * 番茄钟 → macOS 专注模式联动的状态判定
 *
 * 仅「专注」类型且正在计时视为专注中；暂停、结束、休息都视为退出专注。
 */

import type { PomodoroState } from '@/types/pomodoro'

export const FOCUS_SHORTCUT_ON_KEY = 'pomodoro.focus_shortcut_on'
export const FOCUS_SHORTCUT_OFF_KEY = 'pomodoro.focus_shortcut_off'

export function isFocusActive(state: PomodoroState): boolean {
  return state.is_running && state.type === 'focus' && state.elapsed_seconds < state.total_seconds
}

/** 返回需要触发的动作；状态未跨越边界时返回 null */
export function focusModeTransition(wasActive: boolean, state: PomodoroState): 'on' | 'off' | null {
  const active = isFocusActive(state)
  if (active === wasActive) return null
  return active ? 'on' : 'off'
}
