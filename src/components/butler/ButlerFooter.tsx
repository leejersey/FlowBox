import { ChevronDown, Check, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getLucideIcon } from '@/lib/icons';
import type { ButlerSkill } from '@/types/skill';
import type { ButlerSession } from '@/types/butler';

interface ButlerFooterProps {
  onClear: () => void;
  currentModel?: string;
  skills?: ButlerSkill[];
  activeSkillId?: string | null;
  onSkillSelect?: (id: string | null) => void;
  sessions?: ButlerSession[];
  activeSessionId?: string;
  onNewSession?: () => void;
  onSelectSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
}

function formatSessionTime(ts: number): string {
  const diffMins = Math.floor((Date.now() - ts) / 60000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}m前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h前`;
  return `${Math.floor(diffHours / 24)}d前`;
}

export function ButlerFooter({
  onClear,
  currentModel,
  skills = [],
  activeSkillId,
  onSkillSelect,
  sessions = [],
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
}: ButlerFooterProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sessionsRef = useRef<HTMLDivElement>(null);

  // 找到当前激活的技能与会话
  const activeSkill = skills.find(s => s.id === activeSkillId);
  const promptLabel = activeSkill?.name ?? '默认助手';
  const activeSession = sessions.find(s => s.id === activeSessionId) ?? sessions[0];

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (sessionsRef.current && !sessionsRef.current.contains(e.target as Node)) {
        setSessionsOpen(false);
      }
    };
    if (dropdownOpen || sessionsOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen, sessionsOpen]);

  return (
    <div className="flex items-center justify-between gap-2 px-6 py-3 bg-surface border-t border-surface-container-highest text-[13px] text-on-surface-variant">
      <div className="flex items-center gap-3 min-w-0">
        {/* 多会话选择器 */}
        <div className="relative" ref={sessionsRef}>
          <button
            type="button"
            onClick={() => {
              setSessionsOpen(v => !v);
              setDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 hover:text-on-surface transition-colors py-1 px-2 -ml-2 rounded-md hover:bg-surface-container-low cursor-pointer max-w-[170px]"
            title="切换或新建对话"
          >
            <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate font-medium">{activeSession?.title ?? '新对话'}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform', sessionsOpen && 'rotate-180')} />
          </button>

          {sessionsOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-surface border border-surface-container-highest rounded-xl shadow-xl py-1.5 z-50 animate-fade-in">
              <div className="px-2 pb-1.5 border-b border-surface-container-highest flex items-center justify-between">
                <span className="text-[11px] font-bold text-on-surface-variant px-1">历史会话 ({sessions.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    onNewSession?.();
                    setSessionsOpen(false);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/12 text-primary hover:bg-primary/20 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  新对话
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto py-1">
                {sessions.map((sess) => {
                  const isActive = sess.id === activeSessionId;
                  return (
                    <div
                      key={sess.id}
                      className={cn(
                        'group flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors cursor-pointer',
                        isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface hover:bg-surface-container-low',
                      )}
                      onClick={() => {
                        onSelectSession?.(sess.id);
                        setSessionsOpen(false);
                      }}
                    >
                      <span className="truncate flex-1">{sess.title}</span>
                      <span className="text-[10px] text-on-surface-variant/60 shrink-0 group-hover:hidden">
                        {formatSessionTime(sess.updated_at)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession?.(sess.id);
                        }}
                        className="hidden group-hover:inline-flex p-1 rounded hover:bg-red-500/15 hover:text-red-500 text-on-surface-variant cursor-pointer shrink-0"
                        title="删除此会话"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <span className="w-px h-3.5 bg-surface-container-highest shrink-0" />

        {/* Prompt Template Selector — 联动 Skills */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setSessionsOpen(false);
            }}
            className="flex items-center gap-1.5 hover:text-on-surface transition-colors py-1 px-2 rounded-md hover:bg-surface-container-low cursor-pointer"
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
      </div>

      {/* Model Selector / Status */}
      <button className="flex items-center gap-1.5 text-primary hover:bg-primary/5 py-1 px-3 rounded-full transition-colors border border-transparent hover:border-primary/20 bg-primary/5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-primary relative">
          <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75"></div>
        </div>
        <span className="font-medium">{currentModel}</span>
      </button>

      {/* Footer Meta / Esc */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onNewSession}
          className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
          title="新建对话"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onClear}
          className="hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
          title="清空当前对话消息"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded-sm bg-surface-container-low border border-surface-container shadow-[0_1px_1px_rgba(0,0,0,0.1)] text-xs font-sans">Esc</kbd>
          <span className="ml-0.5">关闭</span>
        </div>
      </div>
    </div>
  );
}
