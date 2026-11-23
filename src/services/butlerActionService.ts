/**
 * Butler 动作执行器 — 将用户确认的动作卡片真实写入 FlowBox 本地服务
 */

import * as todoService from './todoService'
import * as ideaService from './ideaService'
import * as pomodoroService from './pomodoroService'
import type { ButlerAction } from '@/lib/butlerActions'

export interface ActionExecutionResult {
  summary: string
  navigateTo?: string
}

export async function executeButlerAction(action: ButlerAction): Promise<ActionExecutionResult> {
  if (action.type === 'create_todo') {
    const created = await todoService.todoCreate({
      title: action.title,
      content: action.content ?? '',
      priority: action.priority,
      due_date: action.due_date,
      source: 'manual',
      tags: action.tags,
    })
    return {
      summary: `已创建待办：${action.title}`,
      navigateTo: `/?highlight=todo-${created.id}`,
    }
  }

  if (action.type === 'create_idea') {
    const created = await ideaService.ideaCreate(action.content, action.tags)
    return {
      summary: '已保存到灵感便签',
      navigateTo: `/idea?highlight=idea-${created.id}`,
    }
  }

  await pomodoroService.pomodoroStart({
    type: action.mode,
    duration_minutes: action.duration_minutes,
  })
  const modeLabel = action.mode === 'focus' ? '专注' : action.mode === 'short_break' ? '短休息' : '长休息'
  return {
    summary: `已开启 ${action.duration_minutes} 分钟${modeLabel}`,
    navigateTo: '/pomodoro',
  }
}
