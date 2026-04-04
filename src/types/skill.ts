/** Butler Skill — 技能/指令模板 */
export interface ButlerSkill {
  id: string
  name: string
  icon: string
  prompt_prefix: string
  system_prompt: string
  is_builtin: boolean | number   // SQLite 返回 0/1
  sort_order: number
  color: string
  category: string
  created_at: string
  updated_at: string
}

/** 创建/编辑技能时的表单数据 */
export type SkillFormData = Pick<
  ButlerSkill,
  'name' | 'icon' | 'prompt_prefix' | 'system_prompt' | 'color' | 'category'
>

/** 技能分类 */
export const SKILL_CATEGORIES = ['写作', '代码', '分析'] as const
export type SkillCategory = typeof SKILL_CATEGORIES[number]

/** 可选图标列表（Lucide 图标名 → 显示名） */
export const SKILL_ICON_OPTIONS = [
  'sparkles', 'globe', 'file-text', 'code-2', 'image',
  'book-open', 'calendar', 'brain', 'zap', 'lightbulb',
  'pen-tool', 'message-square', 'search', 'shield', 'terminal',
  'trending-up', 'gift', 'heart', 'star', 'rocket',
  'compass', 'feather', 'mic', 'music', 'film',
  'coffee', 'briefcase', 'graduation-cap', 'palette', 'wand-2',
] as const

/** 预设颜色 */
export const SKILL_COLOR_OPTIONS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#64748b', // slate
] as const
