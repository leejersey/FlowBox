import React, { useEffect, useRef, useLayoutEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  onClick?: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ left: x, top: y })

  // 视口边界碰撞检测与位置修正
  useLayoutEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const padding = 12
    let nextLeft = x
    let nextTop = y

    if (x + rect.width > window.innerWidth - padding) {
      nextLeft = Math.max(padding, x - rect.width)
    }
    if (y + rect.height > window.innerHeight - padding) {
      nextTop = Math.max(padding, y - rect.height)
    }

    setCoords({ left: nextLeft, top: nextTop })
  }, [x, y])

  // 点击外部与按 Esc 键关闭
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // 监听滚动与窗口失焦自动关闭
    const handleScrollOrBlur = () => onClose()

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScrollOrBlur, true)
    window.addEventListener('blur', handleScrollOrBlur)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScrollOrBlur, true)
      window.removeEventListener('blur', handleScrollOrBlur)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      style={{ left: `${coords.left}px`, top: `${coords.top}px` }}
      className="fixed z-50 min-w-[180px] bg-surface/95 dark:bg-surface-container/95 backdrop-blur-2xl border border-outline-variant/30 shadow-2xl rounded-2xl p-1.5 flex flex-col gap-0.5 text-xs animate-fade-in select-none"
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item) => {
        if (item.separator) {
          return <div key={item.key} className="h-[1px] bg-outline-variant/20 my-1 mx-1" />
        }

        const Icon = item.icon

        return (
          <button
            key={item.key}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.()
              onClose()
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-1.5 rounded-xl transition-all text-left cursor-pointer group",
              item.danger
                ? "text-red-500 hover:bg-red-500/10 hover:text-red-600"
                : "text-on-surface hover:bg-primary/10 hover:text-primary",
              item.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
            )}
          >
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-3.5 h-3.5 shrink-0 opacity-75 group-hover:opacity-100" />}
              <span className="font-medium">{item.label}</span>
            </div>

            {item.shortcut && (
              <kbd className="text-[10px] font-mono opacity-50 px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                {item.shortcut}
              </kbd>
            )}
          </button>
        )
      })}
    </div>
  )
}
