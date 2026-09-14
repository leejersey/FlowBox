import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'

export interface VirtualListProps<T> {
  items: T[]
  estimateHeight?: number
  buffer?: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
}

interface VirtualListRowProps {
  index: number
  top: number
  children: React.ReactNode
  observe: (index: number, element: HTMLDivElement | null) => void
}

function VirtualListRow({ index, top, children, observe }: VirtualListRowProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    observe(index, element)
    return () => observe(index, null)
  }, [index, observe])

  return (
    <div
      ref={elementRef}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: 0,
        right: 0,
      }}
    >
      {children}
    </div>
  )
}

export function VirtualList<T>({
  items,
  estimateHeight = 110,
  buffer = 4,
  renderItem,
  className,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)

  // 记录每个 item 的实测高度
  const [heights, setHeights] = useState<Map<number, number>>(() => new Map())
  const rowObserversRef = useRef<Map<number, ResizeObserver>>(new Map())

  const updateHeight = useCallback((index: number, height: number) => {
    if (height <= 0) return
    setHeights(current => {
      if (current.get(index) === height) return current
      const next = new Map(current)
      next.set(index, height)
      return next
    })
  }, [])

  const observeRow = useCallback((index: number, element: HTMLDivElement | null) => {
    const existingObserver = rowObserversRef.current.get(index)
    existingObserver?.disconnect()
    rowObserversRef.current.delete(index)

    if (!element) return

    updateHeight(index, element.getBoundingClientRect().height)
    const observer = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height ?? element.getBoundingClientRect().height
      updateHeight(index, height)
    })
    observer.observe(element)
    rowObserversRef.current.set(index, observer)
  }, [updateHeight])

  useEffect(() => () => {
    for (const observer of rowObserversRef.current.values()) observer.disconnect()
    rowObserversRef.current.clear()
  }, [])

  // 计算位置前缀和
  const positions = useMemo(() => {
    const pos: number[] = [0]
    for (let i = 0; i < items.length; i++) {
      const h = heights.get(i) ?? estimateHeight
      pos.push(pos[i] + h)
    }
    return pos
  }, [items.length, estimateHeight, heights])

  const totalHeight = positions[items.length] || 0

  // 监听容器视口高度与滚动
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateViewport = () => {
      setViewportHeight(container.clientHeight)
    }

    updateViewport()
    const resizeObserver = new ResizeObserver(updateViewport)
    resizeObserver.observe(container)

    const handleScroll = () => {
      setScrollTop(container.scrollTop)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      resizeObserver.disconnect()
      container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // 二分查找第一个可视索引
  const startIndex = useMemo(() => {
    let low = 0
    let high = items.length - 1
    let ans = 0

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (positions[mid] <= scrollTop) {
        ans = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    return Math.max(0, ans - buffer)
  }, [positions, scrollTop, items.length, buffer])

  // 计算结束索引
  const endIndex = useMemo(() => {
    const targetBottom = scrollTop + viewportHeight
    let high = items.length
    for (let i = startIndex; i < items.length; i++) {
      if (positions[i] >= targetBottom) {
        high = i
        break
      }
    }
    return Math.min(items.length - 1, high + buffer)
  }, [startIndex, positions, scrollTop, viewportHeight, items.length, buffer])

  const visibleItems = useMemo(() => {
    const list: { item: T; index: number; top: number }[] = []
    for (let i = startIndex; i <= endIndex && i < items.length; i++) {
      list.push({
        item: items[i],
        index: i,
        top: positions[i],
      })
    }
    return list
  }, [startIndex, endIndex, items, positions])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflowY: 'auto', position: 'relative' }}
    >
      <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
        {visibleItems.map(({ item, index, top }) => (
          <VirtualListRow
            key={index}
            index={index}
            top={top}
            observe={observeRow}
          >
            {renderItem(item, index)}
          </VirtualListRow>
        ))}
      </div>
    </div>
  )
}
