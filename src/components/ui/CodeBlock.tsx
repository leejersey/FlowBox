import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CodeBlockProps {
  language?: string
  value: string
  className?: string
}

export function CodeBlock({ language, value, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const lines = value.split('\n')

  return (
    <div
      className={cn(
        'relative my-4 rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container-highest/70 shadow-sm font-mono text-xs text-on-surface',
        className
      )}
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-highest border-b border-outline-variant/20 select-none">
        <span className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-500 font-semibold">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>复制代码</span>
            </>
          )}
        </button>
      </div>

      {/* 代码内容与行号 */}
      <div className="overflow-x-auto p-4 flex gap-4 text-xs leading-relaxed custom-scrollbar">
        {lines.length > 1 && (
          <div className="select-none text-on-surface-variant/35 text-right flex flex-col font-mono pr-2 border-r border-outline-variant/15">
            {lines.map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        )}
        <pre className="flex-1 font-mono m-0 p-0 bg-transparent overflow-visible">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  )
}
