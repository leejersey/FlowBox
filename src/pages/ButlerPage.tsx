/**
 * ButlerPage — 全局 Butler 独立窗口
 *
 * 由 Tauri 独立透明窗口承载，复用主应用内的 ButlerWorkbench。
 */

import { useCallback, useEffect } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { ButlerWorkbench } from '@/components/butler/ButlerWorkbench'

const isTauriApp = isTauri()

export function ButlerPage() {
  const hideButler = useCallback(() => {
    if (isTauriApp) {
      invoke('hide_butler').catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handleBlur = () => {
      if (!isTauriApp) return

      setTimeout(() => {
        if (!document.hasFocus()) {
          hideButler()
        }
      }, 150)
    }

    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [hideButler])

  useEffect(() => {
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        hideButler()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [hideButler])

  return (
    <div
      className="w-full h-full flex items-start justify-center pt-4 px-4"
      style={{ background: 'transparent' }}
    >
      <ButlerWorkbench />
    </div>
  )
}
