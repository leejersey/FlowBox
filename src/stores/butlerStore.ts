/**
 * Butler Store — 对话状态管理
 * 内存优先 + 异步落盘策略：
 * - UI 始终从 Zustand 内存状态读取（保证流式输出流畅）
 * - addMessage / finalizeMessage / clearMessages / setModel / setPromptTemplate 异步写入 SQLite
 * - appendToMessage 仅更新内存（不触发 DB 写入）
 * - initFromDb 在应用启动时从 SQLite 加载历史
 */

import { create } from 'zustand';
import type { ChatMessage, ButlerRequestContext, ButlerState } from '@/types/butler';
import * as butlerDb from '@/services/butlerDbService';

interface ButlerStore extends ButlerState {
  /** 是否已从 DB 初始化 */
  initialized: boolean;
  /** 从 SQLite 加载历史，仅在组件挂载时调用一次 */
  initFromDb: () => Promise<void>;
  /** 添加消息（自动生成 ID，同步写 DB） */
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  /** 添加消息（指定 ID，用于流式输出占位，不立即写 DB） */
  addMessageWithId: (id: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  /** 追加 token 到消息（仅内存，不写 DB） */
  appendToMessage: (id: string, delta: string) => void;
  /** 流式结束后，将完整消息落盘到 SQLite */
  finalizeMessage: (id: string) => void;
  /** 清空所有对话 */
  clearMessages: () => void;
  setModel: (model: string) => void;
  setPromptTemplate: (template: string) => void;
  setLoading: (loading: boolean) => void;
  setLastRequest: (request: ButlerRequestContext | null) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useButlerStore = create<ButlerStore>()((set, get) => ({
  // State
  messages: [],
  currentModel: 'DeepSeek - deepseek-chat',
  promptTemplate: '默认助手',
  isLoading: false,
  lastRequest: null,
  initialized: false,

  // ─── Init ─────────────────────────────────
  initFromDb: async () => {
    if (get().initialized) return;
    try {
      const state = await butlerDb.loadButlerState();
      set({
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

  // ─── Messages ─────────────────────────────
  addMessage: (message) => {
    const msg: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, msg] }));
    // 异步落盘（用户消息立即持久化）
    butlerDb.saveMessage(msg).catch(console.error);
  },

  addMessageWithId: (id, message) => {
    // 流式占位：先放内存，不写 DB（内容为空）
    set((state) => ({
      messages: [
        ...state.messages,
        { ...message, id, timestamp: Date.now() },
      ],
    }));
  },

  appendToMessage: (id, delta) => {
    // 纯内存操作，不触发 DB 写入
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content: msg.content + delta } : msg
      ),
    }));
  },

  finalizeMessage: (id) => {
    // 流式结束后，找到完整消息并写入 SQLite
    const msg = get().messages.find((m) => m.id === id);
    if (msg && msg.content) {
      butlerDb.saveMessage(msg).catch(console.error);
    }
  },

  clearMessages: () => {
    set({ messages: [], lastRequest: null });
    butlerDb.deleteAllMessages().catch(console.error);
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

  setLoading: (loading) => set({ isLoading: loading }),

  setLastRequest: (request) => {
    set({ lastRequest: request });
    butlerDb.saveStateValue('lastRequest', JSON.stringify(request ?? '')).catch(console.error);
  },
}));
