import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ResizablePanelProps {
  id: string
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  children: React.ReactNode
  className?: string
}

export function ResizablePanel({
  id,
  defaultWidth = 380,
  minWidth = 280,
  maxWidth = 580,
  children,
  className,
}: ResizablePanelProps) {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem(`panel_width_${id}`)
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        return parsed
      }
    }
    return defaultWidth
  })

  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    isDraggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleDoubleClick = () => {
    setWidth(defaultWidth)
    localStorage.setItem(`panel_width_${id}`, String(defaultWidth))
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const deltaX = e.clientX - startXRef.current
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, minWidth), maxWidth)
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setWidth(curr => {
        localStorage.setItem(`panel_width_${id}`, String(curr))
        return curr
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [id, minWidth, maxWidth])

  return (
    <div
      style={{ '--panel-width': `${width}px` } as React.CSSProperties}
      className={cn(
        "relative shrink-0 flex flex-col h-full w-full lg:w-[var(--panel-width)]",
        isDragging && "select-none transition-none",
        className
      )}
    >
      {children}

      {/* 垂直拖拽分割手柄 (仅在 lg 及以上桌面视口显示) */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title="双击恢复默认宽度，拖拽调节分栏"
        className={cn(
          "hidden lg:flex absolute top-0 -right-2.5 bottom-0 w-5 cursor-col-resize z-30 group items-center justify-center select-none",
          isDragging ? "pointer-events-auto" : ""
        )}
      >
        <div
          className={cn(
            "w-[2px] h-full transition-all duration-150 rounded-full",
            isDragging
              ? "bg-primary w-[3px] shadow-sm shadow-primary/50"
              : "bg-transparent group-hover:bg-primary/50"
          )}
        />
      </div>
    </div>
  )
}
