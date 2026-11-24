/**
 * usePomodoroFocusMode — 番茄专注开始/结束时运行用户配置的 macOS 快捷指令（开关专注模式）
 *
 * 仅在主窗口挂载；每次跨越边界时实时读取设置，修改配置无需重启。
 */

import { useEffect, useRef } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { pomodoroGetState, pomodoroOnTick } from '@/services/pomodoroService'
import { runMacosShortcut } from '@/services/focusModeService'
import * as settingsService from '@/services/settingsService'
import { showToast } from '@/store/useToastStore'
import {
  FOCUS_SHORTCUT_OFF_KEY,
  FOCUS_SHORTCUT_ON_KEY,
  focusModeTransition,
  isFocusActive,
} from '@/lib/pomodoroFocusMode'

export function usePomodoroFocusMode() {
  const activeRef = useRef(isFocusActive(pomodoroGetState()))

  useEffect(() => {
    if (!isTauri()) return
    return pomodoroOnTick(state => {
      const action = focusModeTransition(activeRef.current, state)
      if (!action) return
      activeRef.current = action === 'on'

      const key = action === 'on' ? FOCUS_SHORTCUT_ON_KEY : FOCUS_SHORTCUT_OFF_KEY
      void (async () => {
        const name = (await settingsService.settingsGet(key))?.trim()
        if (!name) return
        try {
          await runMacosShortcut(name)
        } catch (err) {
          showToast(`专注模式联动失败: ${String(err)}`, 'error')
        }
      })()
    })
  }, [])
}
