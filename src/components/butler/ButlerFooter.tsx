import { ChevronDown, Settings2, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getLucideIcon } from '@/lib/icons';
import type { ButlerSkill } from '@/types/skill';

interface ButlerFooterProps {
  onClear: () => void;
  currentModel?: string;
  skills?: ButlerSkill[];
  activeSkillId?: string | null;
  onSkillSelect?: (id: string | null) => void;
}

export function ButlerFooter({ onClear, currentModel, skills = [], activeSkillId, onSkillSelect }: ButlerFooterProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 找到当前激活的技能
  const activeSkill = skills.find(s => s.id === activeSkillId);
  const promptLabel = activeSkill?.name ?? '默认助手';

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-surface border-t border-surface-container-highest text-[13px] text-on-surface-variant">
      {/* Prompt Template Selector — 联动 Skills */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 hover:text-on-surface transition-colors py-1 px-2 -ml-2 rounded-md hover:bg-surface-container-low"
        >
          <span>Prompt {promptLabel}</span>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', dropdownOpen && 'rotate-180')} />
        </button>

        {/* 下拉列表 */}
        {dropdownOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-56 bg-surface border border-surface-container-highest rounded-xl shadow-xl py-1 z-50 max-h-64 overflow-y-auto">
            {/* 默认助手 */}
            <button
              onClick={() => { onSkillSelect?.(null); setDropdownOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-container-low transition-colors',
                !activeSkillId && 'text-primary font-medium'
              )}
            >
              {!activeSkillId && <Check className="w-3.5 h-3.5" />}
              <span className={cn(!activeSkillId ? 'ml-0' : 'ml-5.5')}>默认助手</span>
            </button>

            <div className="h-px bg-surface-container-highest mx-2 my-1" />

            {/* 技能列表 */}
            {skills.filter(s => s.system_prompt?.trim()).map((skill) => {
              const Icon = getLucideIcon(skill.icon);
              const isActive = activeSkillId === skill.id;
              return (
                <button
                  key={skill.id}
                  onClick={() => { onSkillSelect?.(skill.id); setDropdownOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-container-low transition-colors',
                    isActive && 'text-primary font-medium'
                  )}
                >
                  {isActive ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5 ml-0.5" style={{ color: skill.color }} />}
                  <span>{skill.name}</span>
                </button>
              );
            })}

            {skills.filter(s => s.system_prompt?.trim()).length === 0 && (
              <div className="px-3 py-2 text-xs text-on-surface-variant/50 text-center">
                暂无带 System Prompt 的技能
              </div>
            )}
          </div>
        )}
      </div>

      {/* Model Selector / Status */}
      <button className="flex items-center gap-1.5 text-primary hover:bg-primary/5 py-1 px-3 rounded-full transition-colors border border-transparent hover:border-primary/20 bg-primary/5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary relative">
          <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75"></div>
        </div>
        <span className="font-medium">{currentModel}</span>
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
