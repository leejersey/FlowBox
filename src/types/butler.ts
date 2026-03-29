export type MessageRole = 'user' | 'assistant' | 'system';
export type ButlerActionId = 'polish' | 'translate' | 'summarize' | 'fix_code' | 'analyze_img';

export interface ButlerHistoryMessage {
  role: Exclude<MessageRole, 'system'>;
  content: string;
}

export interface ButlerRequestContext {
  input: string;
  actionId: ButlerActionId | null;
  promptTemplate: string;
  history: ButlerHistoryMessage[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface ButlerState {
  messages: ChatMessage[];
  currentModel: string;
  promptTemplate: string;
  isLoading: boolean;
  lastRequest: ButlerRequestContext | null;
}
