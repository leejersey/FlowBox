/**
 * Skill Service — Butler 技能 CRUD + 预设种子
 */

import { getDb } from './database'
import type { ButlerSkill, SkillFormData } from '@/types/skill'

// ─── UUID 生成 ─────────────────────────────────────
function uuid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).substring(2, 15)
}

// ─── 预设技能种子数据 ───────────────────────────────
const BUILTIN_SKILLS: Omit<ButlerSkill, 'created_at' | 'updated_at'>[] = [
  {
    id: 'builtin-polish',
    name: '润色文本',
    icon: 'sparkles',
    prompt_prefix: '帮我润色这段文字：\n\n',
    system_prompt: '',
    is_builtin: 1,
    sort_order: 0,
    color: '#8b5cf6',
    category: '写作',
  },
  {
    id: 'builtin-translate',
    name: '翻译',
    icon: 'globe',
    prompt_prefix: '帮我把这段话翻译成中文或英文：\n\n',
    system_prompt: '',
    is_builtin: 1,
    sort_order: 1,
    color: '#3b82f6',
    category: '写作',
  },
  {
    id: 'builtin-summarize',
    name: '提取摘要',
    icon: 'file-text',
    prompt_prefix: '提取这段文本的摘要：\n\n',
    system_prompt: '',
    is_builtin: 1,
    sort_order: 2,
    color: '#22c55e',
    category: '写作',
  },
  {
    id: 'builtin-fix-code',
    name: '修复代码',
    icon: 'code-2',
    prompt_prefix: '分析并修复这段代码的问题：\n\n',
    system_prompt: '',
    is_builtin: 1,
    sort_order: 3,
    color: '#f97316',
    category: '代码',
  },
  {
    id: 'builtin-analyze-img',
    name: '分析截图',
    icon: 'image',
    prompt_prefix: '请分析最近一张截图，说明关键内容、可能问题和下一步建议：\n\n',
    system_prompt: '',
    is_builtin: 1,
    sort_order: 4,
    color: '#ec4899',
    category: '分析',
  },
  {
    id: 'builtin-explain-code',
    name: '解释代码',
    icon: 'book-open',
    prompt_prefix: '逐行解释这段代码的逻辑：\n\n',
    system_prompt: '',
    is_builtin: 1,
    sort_order: 5,
    color: '#06b6d4',
    category: '代码',
  },
  {
    id: 'builtin-weekly-report',
    name: '写周报',
    icon: 'calendar',
    prompt_prefix: '根据以下工作内容，生成一份简洁的周报：\n\n',
    system_prompt: '',
    is_builtin: 1,
    sort_order: 6,
    color: '#eab308',
    category: '写作',
  },
  {
    id: 'builtin-brainstorm',
    name: '头脑风暴',
    icon: 'brain',
    prompt_prefix: '就以下话题进行头脑风暴，给出 5 个创意思路：\n\n',
    system_prompt: '',
    is_builtin: 1,
    sort_order: 7,
    color: '#f43f5e',
    category: '分析',
  },
]

// ─── CRUD ───────────────────────────────────────────

/** 加载所有技能，按 sort_order 排序 */
export async function loadSkills(): Promise<ButlerSkill[]> {
  const db = await getDb()
  return db.select<ButlerSkill[]>(
    'SELECT * FROM butler_skills ORDER BY sort_order ASC, created_at ASC'
  )
}

/** 获取单个技能 */
export async function getSkill(id: string): Promise<ButlerSkill | null> {
  const db = await getDb()
  const rows = await db.select<ButlerSkill[]>(
    'SELECT * FROM butler_skills WHERE id = $1',
    [id]
  )
  return rows[0] ?? null
}

/** 创建自定义技能 */
export async function createSkill(data: SkillFormData): Promise<ButlerSkill> {
  const db = await getDb()
  const id = uuid()

  // 获取当前最大 sort_order
  const maxRows = await db.select<{ max_sort: number | null }[]>(
    'SELECT MAX(sort_order) as max_sort FROM butler_skills'
  )
  const nextSort = (maxRows[0]?.max_sort ?? -1) + 1

  await db.execute(
    `INSERT INTO butler_skills (id, name, icon, prompt_prefix, system_prompt, is_builtin, sort_order, color, category)
     VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8)`,
    [id, data.name, data.icon, data.prompt_prefix, data.system_prompt, nextSort, data.color, data.category]
  )

  return (await getSkill(id))!
}

/** 更新技能 */
export async function updateSkill(id: string, data: Partial<SkillFormData>): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const values: unknown[] = []
  let paramIdx = 1

  if (data.name !== undefined) { sets.push(`name = $${paramIdx++}`); values.push(data.name) }
  if (data.icon !== undefined) { sets.push(`icon = $${paramIdx++}`); values.push(data.icon) }
  if (data.prompt_prefix !== undefined) { sets.push(`prompt_prefix = $${paramIdx++}`); values.push(data.prompt_prefix) }
  if (data.system_prompt !== undefined) { sets.push(`system_prompt = $${paramIdx++}`); values.push(data.system_prompt) }
  if (data.color !== undefined) { sets.push(`color = $${paramIdx++}`); values.push(data.color) }
  if (data.category !== undefined) { sets.push(`category = $${paramIdx++}`); values.push(data.category) }

  if (sets.length === 0) return

  sets.push(`updated_at = datetime('now')`)
  values.push(id)

  await db.execute(
    `UPDATE butler_skills SET ${sets.join(', ')} WHERE id = $${paramIdx}`,
    values
  )
}

/** 删除技能（保护内置技能） */
export async function deleteSkill(id: string): Promise<boolean> {
  const db = await getDb()
  const result = await db.execute(
    'DELETE FROM butler_skills WHERE id = $1 AND is_builtin = 0',
    [id]
  )
  return (result.rowsAffected ?? 0) > 0
}

/** 批量更新排序 */
export async function reorderSkills(orderedIds: string[]): Promise<void> {
  const db = await getDb()
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute(
      'UPDATE butler_skills SET sort_order = $1, updated_at = datetime(\'now\') WHERE id = $2',
      [i, orderedIds[i]]
    )
  }
}

// ─── 种子数据（幂等） ─────────────────────────────────

/** 初始化预设技能 — 仅插入不存在的内置技能 */
export async function seedBuiltinSkills(): Promise<void> {
  const db = await getDb()

  for (const skill of BUILTIN_SKILLS) {
    await db.execute(
      `INSERT OR IGNORE INTO butler_skills (id, name, icon, prompt_prefix, system_prompt, is_builtin, sort_order, color, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [skill.id, skill.name, skill.icon, skill.prompt_prefix, skill.system_prompt, skill.is_builtin, skill.sort_order, skill.color, skill.category]
    )
  }
}
