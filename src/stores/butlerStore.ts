/**
 * Butler Store — 多会话对话状态管理
 * 内存优先 + 异步落盘策略：
 * - UI 始终从 Zustand 内存状态读取（保证流式输出流畅）
 * - 支持新建对话、切换历史会话、删除会话与首句自动命名
 */

import { create } from 'zustand';
import type { ChatMessage, ButlerRequestContext, ButlerState, ButlerDraftContext, ButlerSession } from '@/types/butler';
import * as butlerDb from '@/services/butlerDbService';
import { DEFAULT_SESSION_TITLE, deriveSessionTitle } from '@/lib/butlerSession';

interface ButlerStore extends ButlerState {
  /** 是否已从 DB 初始化 */
  initialized: boolean;
  /** 外部模块注入的临时上下文（如 GitHub 热点一键问 Butler） */
  draftContext: ButlerDraftContext | null;
  setDraftContext: (ctx: ButlerDraftContext | null) => void;
  /** 从 SQLite 加载会话列表与当前会话历史 */
  initFromDb: () => Promise<void>;
  /** 新建空白对话 */
  createSession: () => void;
  /** 切换到指定历史会话 */
  switchSession: (sessionId: string) => Promise<void>;
  /** 删除指定会话 */
  deleteSession: (sessionId: string) => Promise<void>;
  /** 添加消息（自动生成 ID，同步写 DB 并更新会话标题） */
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  /** 添加消息（指定 ID，用于流式输出占位，不立即写 DB） */
  addMessageWithId: (id: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  /** 追加 token 到消息（仅内存，不写 DB） */
  appendToMessage: (id: string, delta: string) => void;
  /** 流式结束后，将完整消息落盘到 SQLite */
  finalizeMessage: (id: string) => void;
  /** 清空当前会话对话 */
  clearMessages: () => void;
  setModel: (model: string) => void;
  setPromptTemplate: (template: string) => void;
  setActiveSkillId: (skillId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setLastRequest: (request: ButlerRequestContext | null) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

function createDefaultSession(id: string = butlerDb.DEFAULT_SESSION_ID): ButlerSession {
  const now = Date.now();
  return {
    id,
    title: DEFAULT_SESSION_TITLE,
    created_at: now,
    updated_at: now,
  };
}

export const useButlerStore = create<ButlerStore>()((set, get) => ({
  // State
  messages: [],
  sessions: [createDefaultSession()],
  activeSessionId: butlerDb.DEFAULT_SESSION_ID,
  currentModel: 'DeepSeek - deepseek-chat',
  promptTemplate: '默认助手',
  activeSkillId: null,
  isLoading: false,
  lastRequest: null,
  initialized: false,
  draftContext: null,
  setDraftContext: (draftContext) => set({ draftContext }),

  // ─── Init ─────────────────────────────────
  initFromDb: async () => {
    if (get().initialized) return;
    try {
      const state = await butlerDb.loadButlerState();
      set({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        messages: state.messages,
        currentModel: state.currentModel,
        promptTemplate: state.promptTemplate,
        lastRequest: state.lastRequest,
        initialized: true,
      });
    } catch (err) {
      console.error('[Butler] 加载历史失败:', err);
      set({ initialized: true });
    }
  },

  // ─── Sessions ─────────────────────────────
  createSession: () => {
    const newSession = createDefaultSession(`sess-${generateId()}`);
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: newSession.id,
      messages: [],
      lastRequest: null,
    }));
    butlerDb.upsertSession(newSession).catch(console.error);
    butlerDb.saveStateValue('activeSessionId', newSession.id).catch(console.error);
  },

  switchSession: async (sessionId) => {
    if (get().activeSessionId === sessionId) return;
    set({ activeSessionId: sessionId, lastRequest: null });
    butlerDb.saveStateValue('activeSessionId', sessionId).catch(console.error);
    try {
      const messages = await butlerDb.loadMessages(sessionId);
      if (get().activeSessionId === sessionId) {
        set({ messages });
      }
    } catch (err) {
      console.error('[Butler] 切换会话失败:', err);
      set({ messages: [] });
    }
  },

  deleteSession: async (sessionId) => {
    const { sessions, activeSessionId } = get();
    const remaining = sessions.filter((s) => s.id !== sessionId);
    butlerDb.deleteSession(sessionId).catch(console.error);

    if (remaining.length === 0) {
      const fresh = createDefaultSession(`sess-${generateId()}`);
      set({
        sessions: [fresh],
        activeSessionId: fresh.id,
        messages: [],
        lastRequest: null,
      });
      butlerDb.upsertSession(fresh).catch(console.error);
      butlerDb.saveStateValue('activeSessionId', fresh.id).catch(console.error);
      return;
    }

    if (activeSessionId === sessionId) {
      const nextId = remaining[0].id;
      set({ sessions: remaining, activeSessionId: nextId, lastRequest: null });
      butlerDb.saveStateValue('activeSessionId', nextId).catch(console.error);
      try {
        const messages = await butlerDb.loadMessages(nextId);
        if (get().activeSessionId === nextId) set({ messages });
      } catch {
        set({ messages: [] });
      }
    } else {
      set({ sessions: remaining });
    }
  },

  // ─── Messages ─────────────────────────────
  addMessage: (message) => {
    const { activeSessionId, sessions } = get();
    const now = Date.now();
    const msg: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: now,
      session_id: activeSessionId,
    };

    const currentSession = sessions.find((s) => s.id === activeSessionId) ?? createDefaultSession(activeSessionId);
    const shouldAutoTitle =
      message.role === 'user' &&
      (currentSession.title === DEFAULT_SESSION_TITLE || !currentSession.title.trim());

    const updatedSession: ButlerSession = {
      ...currentSession,
      title: shouldAutoTitle ? deriveSessionTitle(message.content) : currentSession.title,
      updated_at: now,
    };

    const nextSessions = [
      updatedSession,
      ...sessions.filter((s) => s.id !== activeSessionId),
    ];

    set((state) => ({
      messages: [...state.messages, msg],
      sessions: nextSessions,
    }));

    butlerDb.upsertSession(updatedSession).catch(console.error);
    butlerDb.saveMessage(msg, activeSessionId).catch(console.error);
  },

  addMessageWithId: (id, message) => {
    const { activeSessionId } = get();
    set((state) => ({
      messages: [
        ...state.messages,
        { ...message, id, timestamp: Date.now(), session_id: activeSessionId },
      ],
    }));
  },

  appendToMessage: (id, delta) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content: msg.content + delta } : msg
      ),
    }));
  },

  finalizeMessage: (id) => {
    const { messages, activeSessionId, sessions } = get();
    const msg = messages.find((m) => m.id === id);
    if (msg && msg.content) {
      const targetSessionId = msg.session_id || activeSessionId;
      butlerDb.saveMessage(msg, targetSessionId).catch(console.error);
      const sess = sessions.find((s) => s.id === targetSessionId);
      if (sess) {
        const updated = { ...sess, updated_at: Date.now() };
        set({
          sessions: [updated, ...sessions.filter((s) => s.id !== targetSessionId)],
        });
        butlerDb.upsertSession(updated).catch(console.error);
      }
    }
  },

  clearMessages: () => {
    const { activeSessionId } = get();
    set({ messages: [], lastRequest: null });
    butlerDb.deleteAllMessages(activeSessionId).catch(console.error);
    butlerDb.saveStateValue('lastRequest', '').catch(console.error);
  },

  // ─── Settings ─────────────────────────────
  setModel: (model) => {
    set({ currentModel: model });
    butlerDb.saveStateValue('currentModel', model).catch(console.error);
  },

  setPromptTemplate: (template) => {
    set({ promptTemplate: template });
    butlerDb.saveStateValue('promptTemplate', template).catch(console.error);
  },

  setActiveSkillId: (skillId) => {
    set({ activeSkillId: skillId });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setLastRequest: (request) => {
    set({ lastRequest: request });
    butlerDb.saveStateValue('lastRequest', JSON.stringify(request ?? '')).catch(console.error);
  },
}));
