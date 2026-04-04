/**
 * SkillEditPanel — 技能编辑侧滑面板
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Trash2, Save, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/store/useToastStore'
import * as skillService from '@/services/skillService'
import type { ButlerSkill, SkillFormData } from '@/types/skill'
import { SKILL_CATEGORIES, SKILL_ICON_OPTIONS, SKILL_COLOR_OPTIONS } from '@/types/skill'
import { getLucideIcon } from '@/lib/icons'

interface SkillEditPanelProps {
  skill: ButlerSkill | null
  isNew: boolean
  onClose: () => void
  onSaved: () => void
}

export function SkillEditPanel({ skill, isNew, onClose, onSaved }: SkillEditPanelProps) {
  const [form, setForm] = useState<SkillFormData>({
    name: '',
    icon: 'zap',
    prompt_prefix: '',
    system_prompt: '',
    color: '#6366f1',
    category: '写作',
  })
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const isBuiltin = skill ? Boolean(skill.is_builtin) : false

  useEffect(() => {
    if (skill) {
      setForm({
        name: skill.name,
        icon: skill.icon,
        prompt_prefix: skill.prompt_prefix,
        system_prompt: skill.system_prompt,
        color: skill.color,
        category: skill.category,
      })
    } else {
      setForm({
        name: '',
        icon: 'zap',
        prompt_prefix: '',
        system_prompt: '',
        color: '#6366f1',
        category: '写作',
      })
    }
  }, [skill])

  const updateField = useCallback(<K extends keyof SkillFormData>(key: K, value: SkillFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      showToast('请输入技能名称', 'error')
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        await skillService.createSkill(form)
        showToast('技能创建成功', 'success')
      } else if (skill) {
        await skillService.updateSkill(skill.id, form)
        showToast('技能已更新', 'success')
      }
      onSaved()
    } catch (err) {
      showToast(`保存失败: ${String(err)}`, 'error')
    } finally {
      setSaving(false)
    }
  }, [form, isNew, skill, onSaved])

  const handleDelete = useCallback(async () => {
    if (!skill || isBuiltin) return
    const ok = await skillService.deleteSkill(skill.id)
    if (ok) {
      showToast('技能已删除', 'success')
      onSaved()
    } else {
      showToast('删除失败', 'error')
    }
  }, [skill, isBuiltin, onSaved])

  const previewText = useMemo(() => {
    let text = ''
    if (form.system_prompt.trim()) {
      text += `【System Prompt】\n${form.system_prompt.trim()}\n\n`
    }
    text += `【用户输入预览】\n${form.prompt_prefix}你的输入内容...`
    return text
  }, [form.prompt_prefix, form.system_prompt])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 侧滑面板 */}
      <div className="relative w-full max-w-lg bg-surface border-l border-surface-container-highest shadow-2xl flex flex-col animate-slide-in-right">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-container-highest">
          <h2 className="text-lg font-semibold text-on-surface">
            {isNew ? '新建技能' : '编辑技能'}
          </h2>
          <div className="flex items-center gap-2">
            {!isNew && !isBuiltin && (
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                title="删除技能"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 表单 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* 名称 */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">技能名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="如：润色文本"
              className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-highest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>

          {/* 分类 */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">分类</label>
            <div className="flex gap-2">
              {SKILL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => updateField('category', cat)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all border',
                    form.category === cat
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-surface-container-low text-on-surface-variant border-surface-container-highest hover:bg-surface-container'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 图标选择 */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">图标</label>
            <div className="grid grid-cols-10 gap-1.5">
              {SKILL_ICON_OPTIONS.map((iconName) => {
                const Icon = getLucideIcon(iconName)
                return (
                  <button
                    key={iconName}
                    onClick={() => updateField('icon', iconName)}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                      form.icon === iconName
                        ? 'bg-primary/15 text-primary ring-2 ring-primary/30'
                        : 'text-on-surface-variant hover:bg-on-surface/10'
                    )}
                    title={iconName}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* 颜色选择 */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">颜色</label>
            <div className="flex gap-2">
              {SKILL_COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateField('color', color)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all',
                    form.color === color
                      ? 'scale-110'
                      : 'hover:scale-110'
                  )}
                  style={{
                    backgroundColor: color,
                    boxShadow: form.color === color ? `0 0 0 2px var(--md-sys-color-surface, #1c1b1f), 0 0 0 4px ${color}` : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Prompt 前缀 */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              Prompt 前缀
              <span className="text-on-surface-variant/60 font-normal ml-1">（注入到用户输入之前）</span>
            </label>
            <textarea
              value={form.prompt_prefix}
              onChange={(e) => updateField('prompt_prefix', e.target.value)}
              placeholder="如：帮我润色这段文字：\n\n"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-highest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none font-mono text-sm"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              System Prompt
              <span className="text-on-surface-variant/60 font-normal ml-1">（可选，不填则使用全局默认）</span>
            </label>
            <textarea
              value={form.system_prompt}
              onChange={(e) => updateField('system_prompt', e.target.value)}
              placeholder="自定义 AI 角色设定..."
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-highest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none font-mono text-sm"
            />
          </div>

          {/* 预览 */}
          <div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              {showPreview ? '收起预览' : '预览完整 Prompt'}
            </button>
            {showPreview && (
              <pre className="mt-3 px-4 py-3 rounded-xl bg-surface-container-low border border-surface-container-highest text-on-surface-variant text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                {previewText}
              </pre>
            )}
          </div>

          {isBuiltin && (
            <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-primary">
              📌 内置技能可以编辑但不能删除
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-container-highest">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-on-surface/10 transition-colors text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className={cn(
              'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all',
              saving || !form.name.trim()
                ? 'bg-surface-container-highest text-on-surface-variant/50 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary/90 shadow-sm hover:shadow-md'
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
