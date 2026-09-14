import { memo, useMemo } from 'react';
import type { ChatMessage } from '@/types/butler';
import { Bot, Copy, Sparkles, RefreshCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { CodeBlock } from '@/components/ui/CodeBlock';

interface ChatMessageItemProps {
  message: ChatMessage;
  onCopy?: (message: ChatMessage) => void;
  onOptimize?: (message: ChatMessage) => void;
  onRegenerate?: (message: ChatMessage) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  onCopy,
  onOptimize,
  onRegenerate,
}: ChatMessageItemProps) {
  const isUser = message.role === 'user';

  const markdownComponents = useMemo<Components>(
    () => ({
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const codeText = String(children).replace(/\n$/, '');
        const isInline = !match && !codeText.includes('\n');

        if (isInline) {
          return (
            <code
              className="px-1.5 py-0.5 rounded-md bg-surface-container-highest text-primary font-mono text-[13px] border border-outline-variant/30"
              {...props}
            >
              {children}
            </code>
          );
        }

        return (
          <CodeBlock
            language={match ? match[1] : ''}
            value={codeText}
          />
        );
      },
      table({ children }) {
        return (
          <div className="overflow-x-auto my-3 rounded-xl border border-outline-variant/30">
            <table className="min-w-full divide-y divide-outline-variant/30 text-xs">
              {children}
            </table>
          </div>
        );
      },
    }),
    []
  );

  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <div className="flex items-start gap-3 max-w-[90%] sm:max-w-[85%]">
        {/* Avatar for AI */}
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 text-primary border border-primary/20 shadow-sm">
            <Bot className="w-4 h-4" />
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            'px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed select-text',
            isUser
              ? 'bg-primary text-white rounded-tr-sm shadow-md whitespace-pre-wrap'
              : 'bg-surface-container-low text-on-surface rounded-tl-sm border border-outline-variant/40 shadow-sm'
          )}
        >
          {isUser ? (
            message.content
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-1.5 prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* AI Message Actions */}
      {!isUser && (
        <div className="flex items-center gap-2 ml-11">
          <button
            onClick={() => onCopy?.(message)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-surface-container text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <Copy className="w-3 h-3 group-hover:text-primary transition-colors" />
            <span>复制</span>
          </button>
          <button
            onClick={() => onOptimize?.(message)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-surface-container text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 group-hover:text-primary transition-colors" />
            <span>优化</span>
          </button>
          <button
            onClick={() => onRegenerate?.(message)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-surface-container text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <RefreshCcw className="w-3 h-3 group-hover:text-primary transition-colors" />
            <span>重新生成</span>
          </button>
        </div>
      )}
    </div>
  );
});
