/**
 * QuickCapturePage — 全局快速记录浮窗（⌥⇧Space）
 *
 * 任意应用内呼出：输入后回车存为灵感 / 待办，Tab 切换目标，`#标签` 自动提取；
 * 保存或 Esc 后收起浮窗并把焦点还给原应用。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { Check, CheckSquare, Lightbulb } from 'lucide-react'
import * as ideaService from '@/services/ideaService'
import * as todoService from '@/services/todoService'
import { emitDataChanged } from '@/lib/dataEvents'
import { parseCaptureText, splitTodoText, type CaptureTarget } from '@/lib/quickCapture'
import { cn } from '@/lib/utils'

const isTauriApp = isTauri()
const SAVED_FLASH_MS = 450

const TARGETS: { id: CaptureTarget; label: string; icon: typeof Lightbulb }[] = [
  { id: 'idea', label: '灵感', icon: Lightbulb },
  { id: 'todo', label: '待办', icon: CheckSquare },
]

export function QuickCapturePage() {
  const [text, setText] = useState('')
  const [target, setTarget] = useState<CaptureTarget>('idea')
  const [saving, setSaving] = useState(false)
  const [savedLabel, setSavedLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const hide = useCallback((restoreFocus: boolean) => {
    if (isTauriApp) {
      invoke('hide_quick_capture', { restoreFocus }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const focusInput = () => window.setTimeout(() => inputRef.current?.focus(), 40)
    const handleFocus = () => {
      setSavedLabel(null)
      setError(null)
      focusInput()
    }
    const handleBlur = () => {
      if (!isTauriApp) return
      window.setTimeout(() => {
        // 用户点击了其他应用：直接收起，不抢回焦点；草稿保留到下次呼出
        if (!document.hasFocus()) hide(false)
      }, 150)
    }
    focusInput()
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [hide])

  const save = useCallback(async () => {
    const { body, tags } = parseCaptureText(text)
    if (!body || saving) return
    setSaving(true)
    setError(null)
    try {
      if (target === 'todo') {
        const { title, content } = splitTodoText(body)
        await todoService.todoCreate({ title, content, tags, source: 'manual' })
        emitDataChanged('todo')
      } else {
        await ideaService.ideaCreate(body, tags)
        emitDataChanged('idea')
      }
      setText('')
      setSavedLabel(target === 'todo' ? '已加入待办' : '已存入灵感')
      window.setTimeout(() => {
        setSavedLabel(null)
        hide(true)
      }, SAVED_FLASH_MS)
    } catch (err) {
      setError(`保存失败：${String(err)}`)
    } finally {
      setSaving(false)
    }
  }, [hide, saving, target, text])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 输入法组字中的回车用于上屏，不触发保存
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Escape') {
      e.preventDefault()
      hide(true)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setTarget(t => (t === 'idea' ? 'todo' : 'idea'))
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void save()
    }
  }

  const { tags } = parseCaptureText(text)

  return (
    <div className="w-full h-full p-3 select-none" style={{ background: 'transparent' }}>
      <div className="w-full h-full bg-surface/95 backdrop-blur-3xl border border-outline-variant/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-surface-container">
            {TARGETS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTarget(id)
                  inputRef.current?.focus()
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                  target === id ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          {tags.length > 0 && (
            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
              {tags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold truncate">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex-1 px-4 py-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={target === 'todo' ? '要做什么？首行为标题，Shift+↵ 换行写备注' : '记下此刻的想法…  #标签 自动归类'}
            className="w-full h-full resize-none bg-transparent text-[15px] leading-relaxed text-on-surface placeholder:text-on-surface-variant/45 outline-none select-text"
          />
          {savedLabel && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/90 animate-fade-in">
              <span className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
                <Check className="w-4 h-4" /> {savedLabel}
              </span>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-outline-variant/15 bg-surface-container-low/40 flex items-center justify-between text-[10px] text-on-surface-variant/70 shrink-0">
          {error ? (
            <span className="text-red-500 truncate">{error}</span>
          ) : (
            <div className="flex items-center gap-3">
              <span><kbd className="px-1 py-0.5 rounded bg-surface-container font-mono border border-outline-variant/30">↵</kbd> 保存</span>
              <span><kbd className="px-1 py-0.5 rounded bg-surface-container font-mono border border-outline-variant/30">Tab</kbd> 切换</span>
              <span><kbd className="px-1 py-0.5 rounded bg-surface-container font-mono border border-outline-variant/30">Esc</kbd> 关闭</span>
            </div>
          )}
          <span className="shrink-0">⌥⇧Space 快速记录</span>
        </div>
      </div>
    </div>
  )
}
