import type { ChatMessage } from '@/types/butler';
import { Bot, Copy, Sparkles, RefreshCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface ChatMessageItemProps {
  message: ChatMessage;
  onCopy?: (message: ChatMessage) => void;
  onOptimize?: (message: ChatMessage) => void;
  onRegenerate?: (message: ChatMessage) => void;
}

export function ChatMessageItem({ message, onCopy, onOptimize, onRegenerate }: ChatMessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <div className="flex items-start gap-3 max-w-[85%]">
        {/* Avatar for AI */}
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 text-primary">
            <Bot className="w-4 h-4" />
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            'px-5 py-3 rounded-2xl text-[15px] leading-relaxed',
            isUser
              ? 'bg-primary text-white rounded-tr-sm shadow-md whitespace-pre-wrap'
              : 'bg-surface-container-low text-on-surface rounded-tl-sm border border-surface-container-highest shadow-sm'
          )}
        >
          {isUser ? (
            message.content
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-1 prose-pre:bg-surface-container-highest prose-pre:p-4 prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Avatar for User (Optional, omitting for clean look like design) */}
      </div>

      {/* AI Message Actions */}
      {!isUser && (
        <div className="flex items-center gap-2 ml-11">
          <button
            onClick={() => onCopy?.(message)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-container text-xs font-medium text-on-surface-variant transition-colors group"
          >
            <Copy className="w-3 h-3 group-hover:text-primary transition-colors" />
            <span>复制</span>
          </button>
          <button
            onClick={() => onOptimize?.(message)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-container text-xs font-medium text-on-surface-variant transition-colors group"
          >
            <Sparkles className="w-3 h-3 group-hover:text-primary transition-colors" />
            <span>优化</span>
          </button>
          <button
            onClick={() => onRegenerate?.(message)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-container text-xs font-medium text-on-surface-variant transition-colors group"
          >
            <RefreshCcw className="w-3 h-3 group-hover:text-primary transition-colors" />
            <span>重新生成</span>
          </button>
        </div>
      )}
    </div>
  );
}
