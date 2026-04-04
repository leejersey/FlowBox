/**
 * SkillsPage — 技能管理页面
 * 卡片式展示所有 Butler 技能，按分类分组
 */

import { useCallback, useEffect, useState } from 'react'
import { Plus, Puzzle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLucideIcon } from '@/lib/icons'
import { showToast } from '@/store/useToastStore'
import * as skillService from '@/services/skillService'
import type { ButlerSkill } from '@/types/skill'
import { SKILL_CATEGORIES } from '@/types/skill'
import { SkillEditPanel } from '@/components/skills/SkillEditPanel'

export function SkillsPage() {
  const [skills, setSkills] = useState<ButlerSkill[]>([])
  const [editingSkill, setEditingSkill] = useState<ButlerSkill | null>(null)
  const [isNewSkill, setIsNewSkill] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  const fetchSkills = useCallback(async () => {
    try {
      const data = await skillService.loadSkills()
      setSkills(data)
    } catch (err) {
      showToast(`加载技能失败: ${String(err)}`, 'error')
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const handleEdit = useCallback((skill: ButlerSkill) => {
    setEditingSkill(skill)
    setIsNewSkill(false)
    setPanelOpen(true)
  }, [])

  const handleNew = useCallback(() => {
    setEditingSkill(null)
    setIsNewSkill(true)
    setPanelOpen(true)
  }, [])

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false)
    setEditingSkill(null)
  }, [])

  const handlePanelSaved = useCallback(() => {
    setPanelOpen(false)
    setEditingSkill(null)
    fetchSkills()
  }, [fetchSkills])

  // 按分类分组
  const grouped = SKILL_CATEGORIES.map((cat) => ({
    category: cat,
    items: skills.filter((s) => s.category === cat),
  }))

  // 不在标准分类中的技能
  const otherSkills = skills.filter(
    (s) => !SKILL_CATEGORIES.includes(s.category as typeof SKILL_CATEGORIES[number])
  )

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">技能管理</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                自定义 Butler 快捷指令和 Prompt 模板
              </p>
            </div>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            新建技能
          </button>
        </div>

        {/* 分类分组 */}
        {grouped.map(({ category, items }) => (
          <div key={category} className="mb-8">
            <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              {category}
              <span className="text-on-surface-variant/50 font-normal normal-case">({items.length})</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((skill) => (
                <SkillCard key={skill.id} skill={skill} onClick={() => handleEdit(skill)} />
              ))}
            </div>
            {items.length === 0 && (
              <div className="text-sm text-on-surface-variant/50 py-6 text-center border border-dashed border-surface-container-highest rounded-2xl">
                暂无「{category}」技能
              </div>
            )}
          </div>
        ))}

        {/* 其他分类 */}
        {otherSkills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40" />
              其他
              <span className="text-on-surface-variant/50 font-normal normal-case">({otherSkills.length})</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {otherSkills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} onClick={() => handleEdit(skill)} />
              ))}
            </div>
          </div>
        )}

        {/* 新建技能占位卡 */}
        <button
          onClick={handleNew}
          className="w-full py-8 rounded-2xl border-2 border-dashed border-surface-container-highest hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center gap-2 text-on-surface-variant/50 hover:text-primary group"
        >
          <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">创建自定义技能</span>
        </button>
      </div>

      {/* 编辑面板 */}
      {panelOpen && (
        <SkillEditPanel
          skill={editingSkill}
          isNew={isNewSkill}
          onClose={handlePanelClose}
          onSaved={handlePanelSaved}
        />
      )}
    </div>
  )
}

// ─── 技能卡片 ────────────────────────────────────────

function SkillCard({ skill, onClick }: { skill: ButlerSkill; onClick: () => void }) {
  const Icon = getLucideIcon(skill.icon)
  const isBuiltin = Boolean(skill.is_builtin)

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-200',
        'bg-surface-container-low border-surface-container-highest',
        'hover:bg-surface-container hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5',
      )}
    >
      {/* 图标 */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${skill.color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color: skill.color }} />
      </div>

      {/* 名称 */}
      <span className="text-sm font-medium text-on-surface text-center leading-tight">
        {skill.name}
      </span>

      {/* 内置标记 */}
      {isBuiltin && (
        <span className="absolute top-2 right-2 text-[10px] font-medium text-primary/60 bg-primary/8 px-1.5 py-0.5 rounded-md">
          内置
        </span>
      )}
    </button>
  )
}
