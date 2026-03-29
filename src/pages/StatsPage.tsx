import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ArrowUpRight, TrendingUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as statsService from '@/services/statsService'
import type { DashboardStats, HourlyFocus, FocusTrend, UsageDistribution } from '@/services/statsService'
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

export function StatsPage() {
  const [stats, setStats] = useState<DashboardStats>({
    today_focus_minutes: 0, week_pomodoro_count: 0, todo_completion_rate: 0, idea_count: 0,
  })
  const [hourly, setHourly] = useState<HourlyFocus[]>(Array.from({ length: 24 }, (_, i) => ({ hour: i, minutes: 0 })))
  const [trend, setTrend] = useState<FocusTrend[]>([])
  const [usage, setUsage] = useState<UsageDistribution[]>([])
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')

  const load = useCallback(async () => {
    if (!isTauri) return
    try {
      const [s, h, t, u] = await Promise.all([
        statsService.getDashboardStats(),
        statsService.getHourlyFocus(),
        statsService.getFocusTrend(7),
        statsService.getUsageDistribution(),
      ])
      setStats(s)
      setHourly(h)
      setTrend(t)
      setUsage(u)
    } catch { /* browser fallback */ }
  }, [])

  useEffect(() => { load() }, [load])

  const focusHours = Math.floor(stats.today_focus_minutes / 60)
  const focusMins = stats.today_focus_minutes % 60
  const maxMinutes = Math.max(...hourly.map(h => h.minutes), 1)

  return (
    <div className="flex flex-col h-full animate-fade-in w-full max-w-5xl mx-auto pb-10 overflow-y-auto overflow-x-hidden">

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold text-on-surface">分析与洞察</h1>
        <div className="bg-surface-container rounded-full p-1 flex items-center text-sm font-medium">
          {(['day', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-1.5 rounded-full transition-colors",
                period === p ? "bg-surface shadow-sm text-on-surface" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {p === 'day' ? '天' : p === 'week' ? '周' : '月'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-container hover:bg-surface-container-highest transition-colors rounded-3xl p-6">
          <p className="text-sm font-medium text-on-surface-variant mb-3 flex items-center justify-between">
            <span>今日专注</span>
            {stats.today_focus_minutes > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-md">
                <ArrowUpRight className="w-3 h-3" /> 进行中
              </span>
            )}
          </p>
          <p className="text-3xl font-display font-bold text-on-surface">
            {focusHours > 0 && <>{focusHours}h </>}{focusMins}m
          </p>
        </div>

        <div className="bg-surface-container hover:bg-surface-container-highest transition-colors rounded-3xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-sm font-medium text-on-surface-variant mb-3">本周番茄 🍅</p>
            <p className="text-3xl font-display font-bold text-on-surface">
              {stats.week_pomodoro_count} <span className="text-base text-on-surface-variant font-medium font-body">个</span>
            </p>
          </div>
          <div className="absolute inset-0 top-1/2 opacity-20">
            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full text-primary fill-current stroke-current stroke-2">
              <path d="M0 50 L0 30 L20 40 L40 10 L60 25 L80 5 L100 15 L100 50 Z" />
            </svg>
          </div>
        </div>

        <div className="bg-surface-container hover:bg-surface-container-highest transition-colors rounded-3xl p-6 flex flex-col">
          <p className="text-sm font-medium text-on-surface-variant mb-3">待办完成率</p>
          <div className="flex items-end justify-between mt-auto">
            <p className="text-3xl font-display font-bold text-on-surface">{stats.todo_completion_rate}%</p>
            <div className="w-10 h-10 relative flex items-center justify-center rounded-full bg-surface-container-highest">
              <svg className="w-full h-full -rotate-90 text-primary">
                <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="none"
                  strokeDasharray="100" strokeDashoffset={100 - stats.todo_completion_rate} className="opacity-80" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-surface-container hover:bg-surface-container-highest transition-colors rounded-3xl p-6">
          <p className="text-sm font-medium text-on-surface-variant mb-3">灵感记录 💡</p>
          <p className="text-3xl font-display font-bold text-on-surface">
            {stats.idea_count} <span className="text-base text-on-surface-variant font-medium font-body">条</span>
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-surface-container-low border border-white/20 rounded-3xl p-6 h-80 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> 专注时长趋势
            </h2>
          </div>
          <div className="flex-1 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: 'var(--color-on-surface)' }}
                  formatter={(value: any) => [`${value} 分钟`, '专注时长']}
                  labelStyle={{ color: 'var(--color-on-surface-variant)', marginBottom: '4px' }}
                />
                <Line type="monotone" dataKey="minutes" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, fill: '#4F46E5', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container-low border border-white/20 rounded-3xl p-6 h-80 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-on-surface">应用使用分布</h2>
          </div>
          <div className="flex-1 w-full flex items-center justify-center relative">
            {usage.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={usage}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {usage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
                      itemStyle={{ color: 'var(--color-on-surface)', fontWeight: 'bold' }}
                      formatter={(value: any, name: any) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom Legend */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                  {usage.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name} ({item.value})
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <span className="text-sm font-medium text-on-surface-variant/50">暂无数据</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly Heatmap */}
        <div className="bg-surface-container rounded-3xl p-6 min-h-[220px]">
          <h2 className="text-base font-bold text-on-surface mb-6">每日专注时段分布</h2>
          <div className="flex items-end justify-between h-32 gap-1.5 px-2">
            {hourly.map(h => (
              <div key={h.hour} className="flex-1 bg-primary/10 rounded-t-sm flex flex-col justify-end overflow-hidden">
                <div
                  className={cn("w-full rounded-t-sm transition-all", h.minutes > 0 ? "bg-primary" : "bg-primary/20")}
                  style={{ height: `${Math.max(5, (h.minutes / maxMinutes) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-bold text-on-surface-variant mt-2 px-1">
            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
        </div>

        {/* AI Weekly */}
        <div className="bg-surface-container rounded-3xl p-6 relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-on-surface">本周 AI 效率报告</h2>
          </div>
          <div className="flex flex-col gap-2 relative z-10 flex-1">
            <p className="text-sm text-on-surface leading-relaxed flex items-start gap-2">
              <span className="text-base mt-0.5">🎯</span>
              本周共完成 {stats.week_pomodoro_count} 个番茄钟
            </p>
            <p className="text-sm text-on-surface leading-relaxed flex items-start gap-2">
              <span className="text-base mt-0.5">📈</span>
              待办完成率 {stats.todo_completion_rate}%
            </p>
            <p className="text-sm text-on-surface leading-relaxed flex items-start gap-2">
              <span className="text-base mt-0.5">💡</span>
              已收集 {stats.idea_count} 条灵感
            </p>
          </div>
          <button className="mt-4 primary-gradient-button px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 relative z-10">
            生成完整周报 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
