/**
 * TextActionPage — 选中文字一键 AI 处理浮窗（⌥⇧A）
 *
 * Rust 侧先读取前台应用的选中文字再弹出本浮窗：
 * 选择 Butler 技能或输入自定义指令 → 流式生成 → 回车替换原文 / ⌘C 复制结果。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { AlertTriangle, CornerDownLeft, Loader2, Wand2 } from 'lucide-react'
import * as skillService from '@/services/skillService'
import { chatWithAssistantStream } from '@/services/aiService'
import { getLucideIcon } from '@/lib/icons'
import { buildTextActionPrompt, cleanReplacement, filterTextSkills, type TextInstruction } from '@/lib/textAction'
import { cn } from '@/lib/utils'
import type { ButlerSkill } from '@/types/skill'

const isTauriApp = isTauri()

type SelectionStatus = 'ok' | 'empty' | 'needs_permission'
type Phase = 'pick' | 'running' | 'done' | 'error'

interface SelectionSnapshot {
  status: SelectionStatus
  text: string
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="px-1 py-0.5 rounded bg-surface-container font-mono border border-outline-variant/30">{children}</kbd>
)

export function TextActionPage() {
  const [selection, setSelection] = useState<SelectionSnapshot>({ status: 'empty', text: '' })
  const [manualText, setManualText] = useState('')
  const [skills, setSkills] = useState<ButlerSkill[]>([])
  const [customInstruction, setCustomInstruction] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('pick')
  const [result, setResult] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const instructionRef = useRef<HTMLInputElement>(null)
  const manualRef = useRef<HTMLTextAreaElement>(null)

  const sourceText = selection.status === 'ok' ? selection.text : manualText

  const hide = useCallback((restoreFocus: boolean) => {
    abortRef.current?.abort()
    if (isTauriApp) invoke('text_action_hide', { restoreFocus }).catch(() => {})
  }, [])

  const reset = useCallback(async () => {
    abortRef.current?.abort()
    setPhase('pick')
    setResult('')
    setError(null)
    setCustomInstruction('')
    setSelectedIdx(0)
    setManualText('')
    if (!isTauriApp) return
    const [snapshot, list] = await Promise.all([
      invoke<SelectionSnapshot>('text_action_get_selection'),
      skillService.loadSkills().catch(() => [] as ButlerSkill[]),
    ])
    setSelection(snapshot)
    setSkills(filterTextSkills(list))
    window.setTimeout(() => {
      if (snapshot.status === 'empty') manualRef.current?.focus()
      else instructionRef.current?.focus()
    }, 30)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void reset(), 0)
    const handleFocus = () => void reset()
    const handleBlur = () => {
      if (!isTauriApp) return
      window.setTimeout(() => {
        if (!document.hasFocus()) hide(false)
      }, 150)
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [hide, reset])

  const run = useCallback(async (instruction: TextInstruction) => {
    if (!sourceText.trim()) {
      setError('没有可处理的文字')
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('running')
    setResult('')
    setError(null)
    try {
      const { systemPrompt, input } = buildTextActionPrompt(instruction, sourceText)
      const full = await chatWithAssistantStream({
        input,
        systemPrompt,
        temperature: 0.3,
        signal: controller.signal,
        onToken: token => setResult(prev => prev + token),
      })
      setResult(cleanReplacement(full, sourceText))
      setPhase('done')
    } catch (err) {
      if (controller.signal.aborted) return
      setError(String(err))
      setPhase('error')
    }
  }, [sourceText])

  const runSelected = useCallback(() => {
    const custom = customInstruction.trim()
    if (custom) {
      void run({ kind: 'custom', instruction: custom })
    } else if (skills[selectedIdx]) {
      void run({ kind: 'skill', skill: skills[selectedIdx] })
    }
  }, [customInstruction, run, selectedIdx, skills])

  const applyResult = useCallback(async () => {
    if (!result) return
    try {
      await invoke<string>('text_action_apply', { text: result })
    } catch (err) {
      setError(String(err))
      setPhase('error')
    }
  }, [result])

  const copyResult = useCallback(async () => {
    if (!result) return
    await invoke('clipboard_write_text', { text: result }).catch(() => {})
    hide(true)
  }, [hide, result])

  const backToPick = useCallback(() => {
    abortRef.current?.abort()
    setPhase('pick')
    setResult('')
    setError(null)
    window.setTimeout(() => instructionRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return
      const typingManual = document.activeElement === manualRef.current

      if (e.key === 'Escape') {
        e.preventDefault()
        if (phase === 'running') backToPick()
        else hide(true)
        return
      }

      if (phase === 'pick') {
        if (typingManual && !(e.key === 'Enter' && (e.metaKey || e.ctrlKey))) return
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIdx(i => Math.min(i + 1, Math.max(0, skills.length - 1)))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIdx(i => Math.max(i - 1, 0))
        } else if (e.key === 'Enter') {
          e.preventDefault()
          runSelected()
        } else if (!customInstruction && /^[1-9]$/.test(e.key) && skills[Number(e.key) - 1]) {
          e.preventDefault()
          void run({ kind: 'skill', skill: skills[Number(e.key) - 1] })
        }
      } else if (phase === 'done') {
        if (e.key === 'Enter') {
          e.preventDefault()
          void applyResult()
        } else if (e.key === 'c' && (e.metaKey || e.ctrlKey) && !window.getSelection()?.toString()) {
          e.preventDefault()
          void copyResult()
        } else if (e.key === 'Tab') {
          e.preventDefault()
          backToPick()
        }
      } else if (phase === 'error' && e.key === 'Tab') {
        e.preventDefault()
        backToPick()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [applyResult, backToPick, copyResult, customInstruction, hide, phase, run, runSelected, skills])

  const preview = useMemo(() => sourceText.replace(/\s+/g, ' ').trim(), [sourceText])

  if (selection.status === 'needs_permission') {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <p className="text-sm font-semibold text-on-surface">需要「辅助功能」权限才能读取选中文字</p>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            请在 系统设置 → 隐私与安全性 → 辅助功能 中允许 FlowBox，然后重新按 ⌥⇧A。
          </p>
        </div>
        <Footer hints={[['Esc', '关闭']]} />
      </Shell>
    )
  }

  return (
    <Shell>
      {/* 原文 */}
      <div className="px-4 pt-3 pb-2 border-b border-outline-variant/15 shrink-0">
        {selection.status === 'ok' ? (
          <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed" title={selection.text}>
            <span className="font-semibold text-primary mr-1.5">选中 {selection.text.length} 字</span>
            {preview}
          </p>
        ) : (
          <textarea
            ref={manualRef}
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            rows={2}
            placeholder="未检测到选中文字，可在此粘贴或输入要处理的内容（⌘↵ 执行）"
            className="w-full resize-none bg-transparent text-xs leading-relaxed text-on-surface placeholder:text-on-surface-variant/50 outline-none"
          />
        )}
      </div>

      {phase === 'pick' ? (
        <>
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-outline-variant/15 shrink-0">
            <Wand2 className="w-4 h-4 text-primary shrink-0" />
            <input
              ref={instructionRef}
              value={customInstruction}
              onChange={e => setCustomInstruction(e.target.value)}
              placeholder="输入自定义指令，例如「改成更正式的语气」，或用 ↑↓ / 数字键选择技能"
              className="flex-1 bg-transparent text-sm font-medium text-on-surface placeholder:text-on-surface-variant/45 outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {skills.map((skill, idx) => {
              const Icon = getLucideIcon(skill.icon)
              const active = !customInstruction && idx === selectedIdx
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => void run({ kind: 'skill', skill })}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-left transition-all cursor-pointer',
                    active ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-surface-container',
                  )}
                >
                  <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${skill.color}22`, color: skill.color }}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className={cn('flex-1 text-sm', active ? 'text-primary font-semibold' : 'text-on-surface font-medium')}>
                    {skill.name}
                  </span>
                  {idx < 9 && <span className="text-[10px] font-mono text-on-surface-variant/60">{idx + 1}</span>}
                  {active && <CornerDownLeft className="w-3.5 h-3.5 text-primary opacity-80" />}
                </button>
              )
            })}
          </div>
          <Footer hints={[['↑↓', '选择'], ['1-9', '快速执行'], ['↵', '执行'], ['Esc', '关闭']]} />
        </>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
            {phase === 'error' ? (
              <p className="text-sm text-red-500 break-words">{error}</p>
            ) : (
              <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed select-text">
                {result}
                {phase === 'running' && <Loader2 className="inline w-3.5 h-3.5 ml-1 animate-spin text-primary" />}
              </p>
            )}
          </div>
          {phase === 'running' && <Footer hints={[['Esc', '停止']]} />}
          {phase === 'done' && <Footer hints={[['↵', '替换原文'], ['⌘C', '复制结果'], ['Tab', '重选'], ['Esc', '关闭']]} />}
          {phase === 'error' && <Footer hints={[['Tab', '返回'], ['Esc', '关闭']]} />}
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-full p-3 select-none" style={{ background: 'transparent' }}>
      <div className="w-full h-full bg-surface/95 backdrop-blur-3xl border border-outline-variant/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  )
}

function Footer({ hints }: { hints: [string, string][] }) {
  return (
    <div className="px-4 py-2 border-t border-outline-variant/15 bg-surface-container-low/40 flex items-center justify-between text-[10px] text-on-surface-variant/70 shrink-0">
      <div className="flex items-center gap-3">
        {hints.map(([key, label]) => (
          <span key={key}><Kbd>{key}</Kbd> {label}</span>
        ))}
      </div>
      <span>⌥⇧A AI 处理选中文字</span>
    </div>
  )
}
