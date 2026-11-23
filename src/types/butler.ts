export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * @deprecated 旧的硬编码 actionId，仅用于兼容
 * 新代码统一使用 skill.id (string)
 */
export type ButlerActionId = 'polish' | 'translate' | 'summarize' | 'fix_code' | 'analyze_img';

export interface ButlerHistoryMessage {
  role: Exclude<MessageRole, 'system'>;
  content: string;
}

export type ButlerContextSourceId = 'clipboard' | 'todos' | 'ideas' | 'trending' | 'weekly';

/** 从其他模块（如 GitHub 热点）一键带入 Butler 的预置上下文 */
export interface ButlerDraftContext {
  title: string;
  content: string;
  suggestedPrompt?: string;
}

export interface ButlerRequestContext {
  input: string;
  /** 技能 ID — 可以是 builtin-* 或自定义 UUID */
  skillId: string | null;
  /** 运行时解析的 prompt 前缀 */
  promptPrefix: string;
  promptTemplate: string;
  /** 技能专属 system prompt（空则用全局默认） */
  skillSystemPrompt: string;
  /** 注入的本地工作区上下文（@剪贴板/@待办/@热榜/项目速读等） */
  localContext?: string;
  history: ButlerHistoryMessage[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  session_id?: string;
}

export interface ButlerSession {
  id: string;
  title: string;
  updated_at: number;
  created_at: number;
}

export interface ButlerState {
  messages: ChatMessage[];
  sessions: ButlerSession[];
  activeSessionId: string;
  currentModel: string;
  promptTemplate: string;
  /** 当前激活的技能 ID（用于 system prompt 联动） */
  activeSkillId: string | null;
  isLoading: boolean;
  lastRequest: ButlerRequestContext | null;
}
