import { ChevronDown, Settings2 } from 'lucide-react';
import { useButlerStore } from '@/stores/butlerStore';

interface ButlerFooterProps {
  onClear: () => void;
  currentModel?: string;
}

export function ButlerFooter({ onClear, currentModel: currentModelProp }: ButlerFooterProps) {
  const { currentModel, promptTemplate } = useButlerStore();
  const modelLabel = currentModelProp ?? currentModel

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-surface border-t border-surface-container-highest text-[13px] text-on-surface-variant">
      {/* Prompt Template Selector */}
      <button className="flex items-center gap-1.5 hover:text-on-surface transition-colors py-1 px-2 -ml-2 rounded-md hover:bg-surface-container-low">
        <span>Prompt {promptTemplate}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {/* Model Selector / Status */}
      <button className="flex items-center gap-1.5 text-primary hover:bg-primary/5 py-1 px-3 rounded-full transition-colors border border-transparent hover:border-primary/20 bg-primary/5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary relative">
          <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75"></div>
        </div>
        <span className="font-medium">{modelLabel}</span>
      </button>

      {/* Footer Meta / Esc */}
      <div className="flex items-center gap-3">
        <button
          onClick={onClear}
          className="hover:text-red-400 transition-colors flex items-center gap-1"
          title="清空历史对话"
        >
           <Settings2 className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded-sm bg-surface-container-low border border-surface-container shadow-[0_1px_1px_rgba(0,0,0,0.1)] text-xs font-sans">Esc</kbd>
          <span className="ml-0.5">关闭</span>
        </div>
      </div>
    </div>
  );
}
