import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Cpu, Keyboard, Cloud, ShieldCheck, User, ChevronRight, UploadCloud, Download, AlertTriangle, Plus } from 'lucide-react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/useThemeStore'
import { useSettings } from '@/hooks/useSettings'
import { showToast } from '@/store/useToastStore'

const menuItems = [
  { id: 'general', label: '通用设置', icon: SettingsIcon },
  { id: 'account', label: '账号与云同步', icon: Cloud },
  { id: 'ai', label: 'AI 模型配置', icon: Cpu },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard },
  { id: 'privacy', label: '隐私与安全', icon: ShieldCheck },
  { id: 'about', label: '关于 FlowBox', icon: User },
]

const DEFAULT_BUTLER_SHORTCUT = 'Shift+Space'

const shortcutList = [
  { action: '记录新全局灵感 / 待办', mac: '⇧ ⌘ N', win: 'Shift Ctrl N' },
  { action: '新建组件页内的记录', mac: '⌘ Enter', win: 'Ctrl Enter' },
  { action: '开始/停止番茄钟', mac: '⌘ P', win: 'Ctrl P' },
  { action: '打开剪贴板历史', mac: '⇧ ⌘ V', win: 'Shift Ctrl V' },
]

const isTauriApp = isTauri()

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        "w-12 h-6 rounded-full relative transition-colors shadow-sm outline-none",
        enabled ? "bg-primary" : "bg-surface-container-highest border border-black/5 flex-shrink-0"
      )}
    >
      <span className={cn(
        "absolute top-1 w-4 h-4 rounded-full shadow-sm transition-all",
        enabled ? "right-1 bg-white" : "left-1 bg-on-surface-variant"
      )} />
    </button>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center px-2 py-1 text-xs font-mono font-medium text-on-surface bg-surface-container-highest border border-white/10 rounded-md shadow-[0_2px_0_rgba(0,0,0,0.1)]">
      {children}
    </kbd>
  )
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('ai')
  const [localApiKey, setLocalApiKey] = useState('')
  const [butlerShortcut, setButlerShortcut] = useState(DEFAULT_BUTLER_SHORTCUT)
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore()
  const { settings, saved, setSetting, toggleSetting } = useSettings()

  // Sync apiKey from settings to local state when settings load
  useEffect(() => {
    if (settings['ai.openai_api_key']) {
      setLocalApiKey(settings['ai.openai_api_key'])
    }
  }, [settings['ai.openai_api_key']])

  useEffect(() => {
    setButlerShortcut(settings['shortcuts.butler_hotkey'] || DEFAULT_BUTLER_SHORTCUT)
  }, [settings['shortcuts.butler_hotkey']])

  const saveApiKey = async () => {
    await setSetting('ai.openai_api_key', localApiKey)
  }

  const saveButlerShortcut = async () => {
    const shortcut = butlerShortcut.trim() || DEFAULT_BUTLER_SHORTCUT

    try {
      if (isTauriApp) {
        const appliedShortcut = await invoke<string>('butler_set_shortcut', { shortcut })
        await setSetting('shortcuts.butler_hotkey', appliedShortcut)
        setButlerShortcut(appliedShortcut)
        return
      }

      await setSetting('shortcuts.butler_hotkey', shortcut)
      setButlerShortcut(shortcut)
    } catch (err) {
      showToast(`保存 Butler 快捷键失败: ${String(err)}`, 'error')
    }
  }

  const aiProvider = settings['ai.provider'] ?? 'deepseek'

  return (
    <div className="flex flex-col h-full animate-fade-in w-full max-w-5xl mx-auto pb-10">

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold text-on-surface">偏好设置</h1>
        {saved && (
          <span className="text-sm font-medium text-green-600 bg-green-500/10 px-4 py-1.5 rounded-full animate-fade-in">
            ✓ 已保存
          </span>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8 flex-1 overflow-y-auto md:overflow-hidden pb-10 md:pb-0">

        {/* Left Menu */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center justify-between w-full px-4 py-3 rounded-2xl transition-all font-medium text-[15px]",
                activeTab === item.id
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-on-surface hover:bg-surface-container-highest"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4" />
                {item.label}
              </div>
              {activeTab !== item.id && <ChevronRight className="w-4 h-4 opacity-50" />}
            </button>
          ))}
        </aside>

        {/* Right Content */}
        <div className="flex-1 bg-surface-container-low rounded-[32px] p-8 md:p-10 border border-white/20 overflow-y-auto">
          <div className="max-w-xl">

            {activeTab === 'ai' && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">AI 模型配置</h2>
                <p className="text-sm text-on-surface-variant mb-8">调整 FlowBox 内部的 AI 引擎行为与数据源访问权限。</p>

                {/* Model Provider */}
                <section className="mb-10">
                  <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wider">默认推理服务</h3>
                  <div className="flex flex-col gap-3">
                    <label
                      onClick={() => setSetting('ai.provider', 'deepseek')}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all",
                        aiProvider === 'deepseek' ? "border border-primary/30 bg-primary/5" : "border border-transparent bg-surface hover:bg-surface-container-highest"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-5 h-5 rounded-full shrink-0", aiProvider === 'deepseek' ? "border-[5px] border-primary" : "border-2 border-on-surface-variant/30")} />
                        <div className="flex flex-col -mt-0.5">
                          <span className="font-bold text-on-surface text-[15px]">DeepSeek</span>
                          <span className="text-xs text-on-surface-variant font-medium">推荐，中文能力强，价格极低</span>
                        </div>
                      </div>
                      {settings['ai.openai_api_key'] && aiProvider === 'deepseek' && (
                        <div className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-xs font-bold">已连接</div>
                      )}
                    </label>

                    <label
                      onClick={() => setSetting('ai.provider', 'openai')}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all group",
                        aiProvider === 'openai' ? "border border-primary/30 bg-primary/5" : "border border-transparent bg-surface hover:bg-surface-container-highest"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-5 h-5 rounded-full shrink-0", aiProvider === 'openai' ? "border-[5px] border-primary" : "border-2 border-on-surface-variant/30 group-hover:border-primary/50 transition-colors")} />
                        <div className="flex flex-col -mt-0.5">
                          <span className="font-bold text-on-surface text-[15px]">OpenAI (GPT-4o)</span>
                          <span className="text-xs text-on-surface-variant font-medium">速度与质量最优平衡，支持 Whisper 转写</span>
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => setSetting('ai.provider', 'ollama')}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all group",
                        aiProvider === 'ollama' ? "border border-primary/30 bg-primary/5" : "border border-transparent bg-surface hover:bg-surface-container-highest"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-5 h-5 rounded-full shrink-0", aiProvider === 'ollama' ? "border-[5px] border-primary" : "border-2 border-on-surface-variant/30 group-hover:border-primary/50 transition-colors")} />
                        <div className="flex flex-col -mt-0.5">
                          <span className="font-bold text-on-surface text-[15px]">Ollama (Local Llama 3)</span>
                          <span className="text-xs text-on-surface-variant font-medium">完全离线，隐私最高</span>
                        </div>
                      </div>
                    </label>
                  </div>
                </section>

                {/* API Key */}
                <section className="mb-10">
                  <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wider">API 密钥</h3>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-on-surface-variant">{aiProvider === 'deepseek' ? 'DeepSeek' : 'OpenAI'} API Key</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="password"
                        value={localApiKey}
                        onChange={e => setLocalApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="flex-1 h-11 bg-surface-container px-4 rounded-xl text-sm text-on-surface border border-transparent focus:border-primary/50 focus:outline-none transition-all font-mono"
                      />
                      <button
                        onClick={saveApiKey}
                        className="h-11 px-6 rounded-xl bg-surface-container hover:bg-surface-container-highest transition-colors font-medium text-sm text-on-surface"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                </section>

                {/* Toggles */}
                <section>
                  <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wider">自动化行为</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                      <div className="flex flex-col -mt-0.5 max-w-[80%]">
                        <span className="font-bold text-on-surface text-[15px]">自动总结语音转写</span>
                        <span className="text-xs text-on-surface-variant leading-relaxed mt-0.5">录音结束后，自动使用 AI 模型提取待办事项和摘要。</span>
                      </div>
                      <Toggle
                        enabled={settings['ai.auto_voice_summary'] === 'true'}
                        onChange={() => toggleSetting('ai.auto_voice_summary')}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                      <div className="flex flex-col -mt-0.5 max-w-[80%]">
                        <span className="font-bold text-on-surface text-[15px]">剪贴板智能分类</span>
                        <span className="text-xs text-on-surface-variant leading-relaxed mt-0.5">新内容入库时自动调用 AI 分析类别（代码/文档/链接/命令等）。</span>
                      </div>
                      <Toggle
                        enabled={settings['clipboard.auto_classify'] !== 'false'}
                        onChange={() => toggleSetting('clipboard.auto_classify')}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                      <div className="flex flex-col -mt-0.5 max-w-[80%]">
                        <span className="font-bold text-on-surface text-[15px]">剪贴板后台 OCR</span>
                        <span className="text-xs text-on-surface-variant leading-relaxed mt-0.5">开启后将消耗更多系统内存用于图像识别。</span>
                      </div>
                      <Toggle
                        enabled={settings['ai.clipboard_ocr'] === 'true'}
                        onChange={() => toggleSetting('ai.clipboard_ocr')}
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">通用设置</h2>
                <p className="text-sm text-on-surface-variant mb-8">基础应用行为配置。</p>

                <section className="mb-10">
                  <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wider">外观主题</h3>
                  <div className="flex gap-4">
                    {(['light', 'dark', 'system'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setThemeMode(m)}
                        className={cn(
                          "flex-1 py-3 px-4 rounded-2xl border-2 font-bold text-sm transition-all",
                          themeMode === m 
                            ? "border-primary bg-primary/5 text-primary" 
                            : "border-transparent bg-surface hover:bg-surface-container-highest text-on-surface-variant"
                        )}
                      >
                        {m === 'light' ? '浅色模式 ☀️' : m === 'dark' ? '深色模式 🌙' : '跟随系统 💻'}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wider">系统行为</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                      <div className="flex flex-col max-w-[80%]">
                        <span className="font-bold text-on-surface text-[15px]">开机自启动</span>
                        <span className="text-xs text-on-surface-variant mt-0.5">系统启动时自动运行 FlowBox</span>
                      </div>
                      <Toggle
                        enabled={settings['general.autostart'] === 'true'}
                        onChange={() => toggleSetting('general.autostart')}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                      <div className="flex flex-col max-w-[80%]">
                        <span className="font-bold text-on-surface text-[15px]">剪贴板自动监听</span>
                        <span className="text-xs text-on-surface-variant leading-relaxed mt-0.5">开启后将在后台持续捕获系统剪贴板变化并记录到历史。</span>
                      </div>
                      <Toggle
                        enabled={settings['clipboard.auto_watch'] === 'true'}
                        onChange={() => toggleSetting('clipboard.auto_watch')}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                      <div className="flex flex-col max-w-[80%]">
                        <span className="font-bold text-on-surface text-[15px]">应用使用追踪</span>
                        <span className="text-xs text-on-surface-variant leading-relaxed mt-0.5">记录你在各应用之间的切换和使用时长，用于效率分析看板。</span>
                      </div>
                      <Toggle
                        enabled={settings['general.app_tracking'] === 'true'}
                        onChange={async () => {
                          const newVal = settings['general.app_tracking'] !== 'true'
                          await toggleSetting('general.app_tracking')
                          try {
                            const { invoke } = await import('@tauri-apps/api/core')
                            await invoke('app_usage_set_tracking', { enabled: newVal })
                          } catch { /* browser fallback */ }
                        }}
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">账号与云同步</h2>
                <p className="text-sm text-on-surface-variant mb-8">FlowBox 是“本地优先”架构，但你可选择将数据加密同步到云端。</p>

                <section className="mb-8">
                  <div className="flex items-center gap-4 p-5 bg-surface rounded-2xl border border-white/10">
                    <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                      <User className="w-8 h-8 text-on-surface-variant/50" />
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="font-bold text-on-surface text-[15px] mb-1">未登录</span>
                      <span className="text-sm text-on-surface-variant">登录后体验跨设备无缝同步同步。</span>
                    </div>
                    <button className="px-5 py-2 rounded-xl bg-surface-container font-medium text-sm text-on-surface hover:bg-surface-container-highest transition-colors">
                      去登录
                    </button>
                  </div>
                </section>

                <section className="mb-10">
                  <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wider">数据导出与同步</h3>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => showToast('同步服务端尚未就绪', 'info')}
                      className="flex items-center justify-between p-4 bg-surface hover:bg-surface-container-highest rounded-2xl transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                          <UploadCloud className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface text-[15px]">手动触发云同步</span>
                          <span className="text-xs text-on-surface-variant mt-0.5">将本地最新变动推送到 FlowBox 云。</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-on-surface-variant/50" />
                    </button>

                    <button 
                      onClick={() => showToast('数据导出功能开发中', 'info')}
                      className="flex items-center justify-between p-4 bg-surface hover:bg-surface-container-highest rounded-2xl transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0">
                          <Download className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface text-[15px]">本地导出数据包 (JSON)</span>
                          <span className="text-xs text-on-surface-variant mt-0.5">下载你本地 SQLite 中的全部结构化数据。</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-on-surface-variant/50" />
                    </button>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">快捷键清单</h2>
                <p className="text-sm text-on-surface-variant mb-8">熟练掌握快捷键能极大提升生产力。全局快捷键可以在任意界面生效。</p>

                <div className="mb-6 p-5 rounded-2xl bg-surface border border-white/10">
                  <div className="flex flex-col gap-2 mb-4">
                    <span className="font-bold text-on-surface text-[15px]">AI Butler 全局唤起键</span>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      默认值为 <code className="font-mono">Shift+Space</code>。请输入 Tauri 支持的组合格式，例如 <code className="font-mono">Shift+Space</code>、<code className="font-mono">Alt+Space</code>、<code className="font-mono">CommandOrControl+Space</code>。
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={butlerShortcut}
                      onChange={(e) => setButlerShortcut(e.target.value)}
                      placeholder={DEFAULT_BUTLER_SHORTCUT}
                      className="flex-1 h-11 bg-surface-container px-4 rounded-xl text-sm text-on-surface border border-transparent focus:border-primary/50 focus:outline-none transition-all font-mono"
                    />
                    <button
                      onClick={saveButlerShortcut}
                      className="h-11 px-6 rounded-xl bg-primary text-white hover:opacity-90 transition-opacity text-sm font-medium"
                    >
                      保存
                    </button>
                  </div>
                </div>
                
                <div className="bg-surface rounded-2xl border border-white/10 overflow-hidden text-sm">
                  {shortcutList.map((sc, idx) => (
                    <div key={idx} className={cn("flex justify-between items-center p-4", idx !== 0 && "border-t border-white/5")}>
                      <span className="font-medium text-on-surface">{sc.action}</span>
                      <div className="flex items-center gap-2">
                        {sc.mac.split(' ').map(key => <Kbd key={key}>{key}</Kbd>)}
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={async () => {
                    setButlerShortcut(DEFAULT_BUTLER_SHORTCUT)
                    try {
                      if (isTauriApp) {
                        await invoke<string>('butler_set_shortcut', { shortcut: DEFAULT_BUTLER_SHORTCUT })
                      }
                      await setSetting('shortcuts.butler_hotkey', DEFAULT_BUTLER_SHORTCUT)
                    } catch (err) {
                      showToast(`恢复默认 Butler 快捷键失败: ${String(err)}`, 'error')
                    }
                  }}
                  className="mt-6 flex items-center justify-center w-full gap-2 p-3 border border-dashed border-on-surface-variant/30 text-on-surface-variant rounded-xl hover:bg-surface-container-low transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> 恢复默认 Butler 快捷键
                </button>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">隐私与安全</h2>
                <p className="text-sm text-on-surface-variant mb-8">我们严肃对待你的数据。默认情况下，你的所有记录仅保存在本机设备上。</p>

                <section className="mb-10">
                  <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wider">本地存储存储位置</h3>
                  <div className="bg-surface p-4 rounded-2xl border border-white/10">
                    <p className="text-sm text-on-surface-variant mb-3 leading-relaxed">
                      应用的所有状态与文本均存储在加密的本地 SQLite 数据库文件中：
                    </p>
                    <code className="block p-3 bg-surface-container-highest rounded-xl text-xs font-mono text-on-surface-variant/80 break-all select-all">
                      ~/.local/share/com.flowbox.app/flowbox.db
                    </code>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-red-500 mb-4 uppercase tracking-wider">危险区域</h3>
                  <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-5 relative overflow-hidden">
                    <div className="relative z-10 flex flex-col gap-4">
                      <div>
                        <span className="block font-bold text-red-500 text-[15px] mb-1">清除所有本地数据</span>
                        <span className="text-xs text-red-500/70 leading-relaxed max-w-[90%] block">
                          此操作会重置你的偏好设置，并抹除 SQLite 中的所有 Todo, Idea 和 Pomodoro 记录。此操作无法撤销。
                        </span>
                      </div>
                      <button 
                        onClick={() => showToast('暂时无法直接删除，请手动至文件系统清理 DB', 'error')}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors self-start shadow-md shadow-red-500/20"
                      >
                        我已知晓风险，清空数据
                      </button>
                    </div>
                    <AlertTriangle className="absolute -right-6 -bottom-6 w-32 h-32 text-red-500/5 rotate-12 pointer-events-none" />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">关于 FlowBox</h2>
                <div className="mt-8 space-y-4 text-sm text-on-surface-variant">
                  <p><strong className="text-on-surface block mb-1">当前版本</strong> 0.1.0 (Alpha 构建版)</p>
                  <p><strong className="text-on-surface block mb-1">构建时间</strong> 2024.10.25</p>
                  <p><strong className="text-on-surface block mt-6 mb-1">开源组件与许可</strong> 本软件使用 Rust 构建后端，并应用了 Tauri 2.0 框架。前端由 React 驱动。代码由 MIT 许可授权。</p>
                </div>

                <div className="mt-12 pt-8 border-t border-white/10 flex items-center justify-center gap-6">
                  <a href="#" className="text-sm font-medium text-primary hover:underline">官网主页</a>
                  <a href="#" className="text-sm font-medium text-primary hover:underline">提交 Issue</a>
                  <a href="#" className="text-sm font-medium text-primary hover:underline">使用条款</a>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
