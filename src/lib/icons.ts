/**
 * Lucide 图标名 → React 组件的动态映射
 * 用于 Skills 模块根据数据库中的 icon 字段名渲染图标
 */

import {
  Sparkles, Globe, FileText, Code2, Image as ImageIcon,
  BookOpen, Calendar, Brain, Zap, Lightbulb,
  PenTool, MessageSquare, Search, Shield, Terminal,
  TrendingUp, Gift, Heart, Star, Rocket,
  Compass, Feather, Mic, Music, Film,
  Coffee, Briefcase, GraduationCap, Palette, Wand2,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  'sparkles': Sparkles,
  'globe': Globe,
  'file-text': FileText,
  'code-2': Code2,
  'image': ImageIcon,
  'book-open': BookOpen,
  'calendar': Calendar,
  'brain': Brain,
  'zap': Zap,
  'lightbulb': Lightbulb,
  'pen-tool': PenTool,
  'message-square': MessageSquare,
  'search': Search,
  'shield': Shield,
  'terminal': Terminal,
  'trending-up': TrendingUp,
  'gift': Gift,
  'heart': Heart,
  'star': Star,
  'rocket': Rocket,
  'compass': Compass,
  'feather': Feather,
  'mic': Mic,
  'music': Music,
  'film': Film,
  'coffee': Coffee,
  'briefcase': Briefcase,
  'graduation-cap': GraduationCap,
  'palette': Palette,
  'wand-2': Wand2,
}

/** 根据图标名获取 Lucide 图标组件，找不到则返回 HelpCircle */
export function getLucideIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? HelpCircle
}
