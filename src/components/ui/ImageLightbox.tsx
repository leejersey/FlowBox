import React, { useEffect } from 'react'
import { X, Copy, Download } from 'lucide-react'
import { showToast } from '@/store/useToastStore'

export interface ImageLightboxProps {
  src: string | null
  alt?: string
  onClose: () => void
}

export function ImageLightbox({ src, alt = 'Preview', onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [src, onClose])

  if (!src) return null

  const handleCopy = async () => {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ])
      showToast('图片已复制到剪贴板', 'success')
    } catch {
      showToast('直接复制图片二进制受限，建议右键保存', 'info')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-xl animate-fade-in select-none"
      onClick={onClose}
    >
      {/* 顶部控制栏 */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleCopy}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title="复制图片"
        >
          <Copy className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title="关闭 (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 图片主体 */}
      <div
        className="relative max-w-full max-h-full flex items-center justify-center animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-white/10"
        />
      </div>
    </div>
  )
}
