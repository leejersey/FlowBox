import { useCallback, useEffect, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { BellOff, Play, RefreshCw } from 'lucide-react'
import { showToast } from '@/store/useToastStore'
import * as settingsService from '@/services/settingsService'
import { listMacosShortcuts, runMacosShortcut } from '@/services/focusModeService'
import { FOCUS_SHORTCUT_OFF_KEY, FOCUS_SHORTCUT_ON_KEY } from '@/lib/pomodoroFocusMode'

const isTauriApp = isTauri()
const NONE = ''

const SLOTS = [
  { key: FOCUS_SHORTCUT_ON_KEY, label: '专注开始时运行', hint: '例如：打开「勿扰模式」' },
  { key: FOCUS_SHORTCUT_OFF_KEY, label: '专注结束 / 暂停时运行', hint: '例如：关闭「勿扰模式」' },
] as const

/** 设置页 · 番茄钟联动 macOS 专注模式（通过系统「快捷指令」） */
export function FocusModeSection() {
  const [shortcuts, setShortcuts] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadShortcuts = useCallback(async () => {
    if (!isTauriApp) return
    try {
      setShortcuts(await listMacosShortcuts())
      setLoadError(null)
    } catch (err) {
      setLoadError(String(err))
    }
  }, [])

  useEffect(() => {
    if (!isTauriApp) return
    listMacosShortcuts().then(
      list => setShortcuts(list),
      err => setLoadError(String(err)),
    )
    void Promise.all(SLOTS.map(async ({ key }) => [key, (await settingsService.settingsGet(key)) ?? NONE] as const))
      .then(entries => setValues(Object.fromEntries(entries)))
  }, [])

  const update = async (key: string, name: string) => {
    setValues(v => ({ ...v, [key]: name }))
    try {
      if (name) {
        await settingsService.settingsSet(key, name)
      } else {
        await settingsService.settingsDelete(key)
      }
    } catch (err) {
      showToast(`保存失败: ${String(err)}`, 'error')
    }
  }

  const test = async (name: string) => {
    try {
      await runMacosShortcut(name)
      showToast(`已运行「${name}」`, 'success')
    } catch (err) {
      showToast(String(err), 'error')
    }
  }

  return (
    <section className="mt-10">
      <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wider flex items-center gap-2">
        <BellOff className="w-4 h-4 text-primary" /> 番茄钟联动专注模式
      </h3>
      <div className="bg-surface p-4 rounded-2xl flex flex-col gap-4">
        <p className="text-xs text-on-surface-variant leading-relaxed">
          macOS 未开放直接控制专注模式的接口。请在「快捷指令」App 中新建两个指令，分别使用「设定专注模式」动作打开和关闭勿扰，
          然后在下方选择。番茄专注开始时自动运行第一个，结束、暂停或中断时运行第二个。
        </p>

        {SLOTS.map(({ key, label, hint }) => {
          const value = values[key] ?? NONE
          const options = value && !shortcuts.includes(value) ? [value, ...shortcuts] : shortcuts
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="flex flex-col w-40 shrink-0">
                <span className="text-sm font-semibold text-on-surface">{label}</span>
                <span className="text-[11px] text-on-surface-variant/70">{hint}</span>
              </div>
              <select
                value={value}
                onChange={e => void update(key, e.target.value)}
                disabled={!isTauriApp}
                className="flex-1 h-10 bg-surface-container px-3 rounded-xl text-sm text-on-surface border border-transparent focus:border-primary/50 focus:outline-none"
              >
                <option value={NONE}>不联动</option>
                {options.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void test(value)}
                disabled={!value}
                title="立即运行一次以测试"
                className="h-10 px-3 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-40 flex items-center gap-1.5 text-xs font-medium"
              >
                <Play className="w-3.5 h-3.5" /> 测试
              </button>
            </div>
          )
        })}

        <div className="flex items-center justify-between text-[11px] text-on-surface-variant/70">
          <span>{loadError ? `读取快捷指令失败：${loadError}` : `已找到 ${shortcuts.length} 个快捷指令`}</span>
          <button
            type="button"
            onClick={() => void loadShortcuts()}
            disabled={!isTauriApp}
            className="flex items-center gap-1 hover:text-on-surface transition-colors disabled:opacity-40"
          >
            <RefreshCw className="w-3 h-3" /> 刷新列表
          </button>
        </div>
      </div>
    </section>
  )
}
