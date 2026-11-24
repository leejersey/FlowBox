/**
 * 选中文字 AI 处理：组装提示词与清洗替换结果
 */

import type { ButlerSkill } from '@/types/skill'

/** 依赖截图等非文本输入的技能不适用于选中文字 */
const UNSUPPORTED_SKILL_IDS = new Set(['builtin-analyze-img'])

const REPLACE_GUARD =
  '你正在处理用户在其他应用中选中的一段文本，结果可能直接替换原文。' +
  '只输出处理后的结果本身，不要任何解释、前言、结尾客套，也不要用 Markdown 代码块包裹整个结果。'

export function filterTextSkills(skills: ButlerSkill[]): ButlerSkill[] {
  return skills.filter(skill => !UNSUPPORTED_SKILL_IDS.has(skill.id))
}

export type TextInstruction =
  | { kind: 'skill'; skill: Pick<ButlerSkill, 'prompt_prefix' | 'system_prompt'> }
  | { kind: 'custom'; instruction: string }

export function buildTextActionPrompt(instruction: TextInstruction, selected: string): { systemPrompt: string; input: string } {
  if (instruction.kind === 'custom') {
    return {
      systemPrompt: REPLACE_GUARD,
      input: `${instruction.instruction.trim()}\n\n${selected}`,
    }
  }
  const { prompt_prefix, system_prompt } = instruction.skill
  return {
    systemPrompt: [system_prompt?.trim(), REPLACE_GUARD].filter(Boolean).join('\n\n'),
    input: `${prompt_prefix ?? ''}${selected}`,
  }
}

const FENCE_PATTERN = /^```[\w-]*\n([\s\S]*?)\n?```$/

/** 去掉模型多余包裹的整段代码块；原文本身就是代码块时保持原样 */
export function cleanReplacement(result: string, original: string): string {
  const trimmed = result.trim()
  if (original.trim().startsWith('```')) return trimmed
  const match = trimmed.match(FENCE_PATTERN)
  return match ? match[1] : trimmed
}
