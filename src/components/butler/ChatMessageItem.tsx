import { memo, useMemo, useState } from 'react';
import type { ChatMessage } from '@/types/butler';
import {
  Bot, Copy, Sparkles, RefreshCcw, CheckSquare, Lightbulb,
  Timer, Check, Loader2, Play
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { extractButlerActions, type ButlerAction } from '@/lib/butlerActions';
import { executeButlerAction } from '@/services/butlerActionService';
import { showToast } from '@/store/useToastStore';

interface ChatMessageItemProps {
  message: ChatMessage;
  onCopy?: (message: ChatMessage) => void;
  onOptimize?: (message: ChatMessage) => void;
  onRegenerate?: (message: ChatMessage) => void;
}

const PRIORITY_TEXT: Record<number, string> = { 0: '普通', 1: '低优', 2: '中优', 3: '高优' };

function ButlerActionCard({
  action,
  executed,
  executing,
  onExecute,
}: {
  action: ButlerAction;
  executed: boolean;
  executing: boolean;
  onExecute: () => void;
}) {
  const icon =
    action.type === 'create_todo' ? (
      <CheckSquare className="w-4 h-4 text-blue-500" />
    ) : action.type === 'create_idea' ? (
      <Lightbulb className="w-4 h-4 text-amber-500" />
    ) : (
      <Timer className="w-4 h-4 text-rose-500" />
    );

  const badge =
    action.type === 'create_todo'
      ? `创建待办 · ${PRIORITY_TEXT[action.priority]}`
      : action.type === 'create_idea'
      ? '保存灵感'
      : `开启番茄 · ${action.duration_minutes} 分钟`;

  const title =
    action.type === 'create_todo'
      ? action.title
      : action.type === 'create_idea'
      ? action.content.slice(0, 72)
      : action.label || `${action.duration_minutes} 分钟专注心流`;

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl border transition-all',
      executed
        ? 'bg-emerald-500/10 border-emerald-500/25'
        : 'bg-surface-container border-outline-variant/30 hover:border-primary/40',
    )}>
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center shrink-0 mt-0.5 border border-outline-variant/20">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-on-surface-variant">{badge}</div>
          <div className="text-xs font-semibold text-on-surface truncate mt-0.5">{title}</div>
          {'tags' in action && action.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-1">
              {action.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={executed || executing}
        onClick={onExecute}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all',
          executed
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default'
            : 'bg-primary text-white hover:opacity-90 cursor-pointer disabled:opacity-50',
        )}
      >
        {executing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : executed ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3 h-3 fill-current" />
        )}
        <span>{executed ? '已执行' : executing ? '执行中' : '执行'}</span>
      </button>
    </div>
  );
}

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  onCopy,
  onOptimize,
  onRegenerate,
}: ChatMessageItemProps) {
  const isUser = message.role === 'user';
  const [executedIndices, setExecutedIndices] = useState<Set<number>>(() => new Set());
  const [executingIdx, setExecutingIdx] = useState<number | null>(null);

  const parsed = useMemo(
    () => (isUser ? { displayContent: message.content, actions: [] } : extractButlerActions(message.content)),
    [isUser, message.content],
  );

  const handleRunAction = async (idx: number, action: ButlerAction) => {
    setExecutingIdx(idx);
    try {
      const result = await executeButlerAction(action);
      setExecutedIndices(prev => new Set(prev).add(idx));
      showToast(result.summary, 'success');
    } catch (err) {
      showToast(`执行失败: ${String(err)}`, 'error');
    } finally {
      setExecutingIdx(curr => (curr === idx ? null : curr));
    }
  };

  const handleRunAll = async () => {
    for (let i = 0; i < parsed.actions.length; i++) {
      if (executedIndices.has(i)) continue;
      await handleRunAction(i, parsed.actions[i]);
    }
  };

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
                {parsed.displayContent || (parsed.actions.length > 0 ? '已为你准备好以下可执行操作：' : '')}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* 可执行本地动作卡片 */}
      {!isUser && parsed.actions.length > 0 && (
        <div className="ml-11 w-full max-w-[calc(90%-44px)] sm:max-w-[calc(85%-44px)] space-y-2 animate-fade-in">
          {parsed.actions.length > 1 && executedIndices.size < parsed.actions.length && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-on-surface-variant">
                可执行动作 ({executedIndices.size}/{parsed.actions.length})
              </span>
              <button
                type="button"
                onClick={() => void handleRunAll()}
                disabled={executingIdx !== null}
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
              >
                全部执行
              </button>
            </div>
          )}
          {parsed.actions.map((action, idx) => (
            <ButlerActionCard
              key={idx}
              action={action}
              executed={executedIndices.has(idx)}
              executing={executingIdx === idx}
              onExecute={() => void handleRunAction(idx, action)}
            />
          ))}
        </div>
      )}

      {/* AI Message Actions */}
      {!isUser && (
        <div className="flex items-center gap-2 ml-11">
          <button
            onClick={() => onCopy?.({ ...message, content: parsed.displayContent })}
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
