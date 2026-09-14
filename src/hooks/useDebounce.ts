import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * 防抖值 Hook
 * @param value 原始值
 * @param delay 延迟毫秒数，默认 250ms
 */
export function useDebounce<T>(value: T, delay: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * 防抖函数回调 Hook
 * @param callback 要防抖的函数
 * @param delay 延迟毫秒数，默认 250ms
 */
export function useDebouncedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number = 250
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay]
  )
}
