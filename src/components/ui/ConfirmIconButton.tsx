import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmIconButtonProps {
  onConfirm: () => void
  title?: string
  confirmLabel?: string
  className?: string
  iconClassName?: string
  timeoutMs?: number
}

export function ConfirmIconButton({
  onConfirm,
  title = '删除',
  confirmLabel = '确认删除',
  className,
  iconClassName = 'w-3.5 h-3.5',
  timeoutMs = 2500,
}: ConfirmIconButtonProps) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), timeoutMs)
    return () => window.clearTimeout(timer)
  }, [confirming, timeoutMs])

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (confirming) {
          setConfirming(false)
          onConfirm()
        } else {
          setConfirming(true)
        }
      }}
      onBlur={() => setConfirming(false)}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-all cursor-pointer shrink-0',
        confirming
          ? 'opacity-100 px-2 py-1 bg-red-500 text-white text-[10px] font-bold shadow-xs hover:bg-red-600'
          : className,
      )}
      title={confirming ? '再次点击确认删除' : title}
      aria-label={confirming ? confirmLabel : title}
    >
      {confirming ? <span>{confirmLabel}</span> : <Trash2 className={iconClassName} />}
    </button>
  )
}
