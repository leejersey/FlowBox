# 🧊 FlowBox — AI 桌面效率工具

> **Local-First · AI-Powered · Privacy-Centric**
>
> FlowBox 是一款面向个人开发者和知识工作者的 macOS 桌面 AI 效率工具，集成待办管理、灵感速记、番茄专注、智能剪贴板、语音备忘录、效率分析六大核心模块，所有数据本地存储，AI 能力按需接入。

---

## ✨ 核心功能

### 📋 待办管理
- 创建、编辑、归档待办事项，支持优先级排序
- 标签系统，批量管理

### 💡 灵感速记
- 随时捕获灵感，支持标签分类（内联编辑 / 颜色标记）
- 瀑布流卡片浏览，长文自动截断预览
- 点击卡片弹窗查看完整详情（来源、时间、标签）
- 支持手动输入、语音录入、剪贴板捕获三种来源

### 🍅 番茄专注
- 25/5 分钟番茄钟，可关联待办任务
- 自动记录每次专注时长

### 📎 智能剪贴板
- 后台自动监听系统剪贴板变化
- 文本/图片分类存储，一键回填
- 固定常用条目

### 🎙️ 语音备忘录
- **一键录音**：浏览器 MediaRecorder API，实时计时 + 脉冲动画
- **AI 转写**：浏览器 Web Speech API（免费） / OpenAI Whisper（兜底）
- **智能摘要**：DeepSeek / OpenAI 自动提取摘要和待办事项
- 原声回放，导出文本

### 📊 效率分析看板
- 今日专注时长、本周番茄数、待办完成率、灵感总数
- 专注时长趋势折线图（Recharts）
- **应用使用追踪**：自动记录前台应用切换，饼图展示使用分布
- 每日专注时段热力图
- AI 周报生成（占位）

### 🤖 AI Butler（全局智能管家）
- `Shift + Space` 全局呼出（可在设置中自定义），`Cmd + K` 应用内唤起
- **多轮对话**：基于 DeepSeek / OpenAI 的实时 AI 对话，上下文自动携带
- **快捷指令**：一键润色文本、翻译、摘要、修复代码、分析截图
- **Markdown 渲染**：AI 回复原生支持标题、列表、代码块、表格等富文本排版
- **对话持久化**：基于 Zustand + localStorage，关闭窗口不丢失历史
- 毛玻璃悬浮面板，ESC / 点击遮罩关闭

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────┐
│              Tauri v2 (Rust)            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Commands│ │ Services │ │ Plugins  │ │
│  │ butler  │ │ clipboard│ │ sql      │ │
│  │ app_use │ │ app_usage│ │ shortcut │ │
│  │ clip    │ │ tracker  │ │ log      │ │
│  │ obsidian│ │ voice    │ │          │ │
│  └─────────┘ └──────────┘ └──────────┘ │
│              SQLite (flowbox.db)        │
├─────────────────────────────────────────┤
│           React + TypeScript            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Pages  │ │  Hooks   │ │ Services │ │
│  │ 9 pages │ │ 8 hooks  │ │ 12 svc   │ │
│  └─────────┘ └──────────┘ └──────────┘ │
│  Vite · TailwindCSS · Recharts · Zustand│
└─────────────────────────────────────────┘
```

| 层级 | 技术 | 说明 |
|------|------|------|
| **桌面壳** | Tauri v2 + Rust | 窗口管理、全局快捷键、后台线程 |
| **数据库** | SQLite (tauri-plugin-sql) | 9 张核心表，本地优先 |
| **前端框架** | React 19 + TypeScript | 页面组件 + Hooks 架构 |
| **样式** | TailwindCSS v4 + @tailwindcss/typography | Material Design 3 色彩体系 |
| **状态管理** | Zustand (persist) | 主题、Toast、Butler 对话历史 |
| **图表** | Recharts | 折线图、饼图 |
| **Markdown** | react-markdown + remark-gfm | AI 回复富文本渲染 |
| **AI** | DeepSeek / OpenAI / Ollama | 对话、摘要提取、语音转写、剪贴板分类 |

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18
- **Rust** ≥ 1.77（通过 [rustup](https://rustup.rs) 安装）
- **Xcode Command Line Tools**（macOS）

### 安装依赖

```bash
# 前端依赖
npm install

# Rust 依赖（自动处理）
```

### 开发模式

```bash
# 启动 Tauri 桌面应用（前端 + Rust 同时编译）
npm run tauri dev
```

> 首次运行会编译 Rust 依赖，可能需要 3-5 分钟。后续增量编译极快。

### 构建生产包

```bash
npm run tauri build
```

---

## 📁 项目结构

```
FlowBox/
├── src/                          # 前端源码
│   ├── pages/                    # 页面组件（9 个）
│   │   ├── TodoPage.tsx          # 待办管理
│   │   ├── IdeaPage.tsx          # 灵感速记（含详情弹窗）
│   │   ├── PomodoroPage.tsx      # 番茄专注
│   │   ├── ClipboardPage.tsx     # 智能剪贴板
│   │   ├── VoicePage.tsx         # 语音备忘录
│   │   ├── StatsPage.tsx         # 效率分析
│   │   ├── MarkdownPage.tsx      # Markdown 转换器
│   │   ├── SettingsPage.tsx      # 偏好设置
│   │   └── ButlerPage.tsx        # AI Butler 独立窗口入口
│   ├── components/               # UI 组件
│   │   ├── butler/               # Butler 对话组件
│   │   │   ├── ButlerWorkbench.tsx  # 主工作台（输入、消息列表、快捷指令）
│   │   │   ├── ChatMessageItem.tsx  # 气泡渲染（Markdown / 纯文本）
│   │   │   └── ButlerFooter.tsx     # 底部状态栏（模型、Prompt、清空）
│   │   ├── layout/               # 布局组件（Sidebar、ButlerOverlay）
│   │   ├── todo/                 # 待办子组件
│   │   └── ui/                   # 通用 UI 组件
│   ├── hooks/                    # 自定义 Hooks（8 个）
│   │   ├── useDatabase.ts        # DB 初始化
│   │   ├── useTodos.ts           # 待办 CRUD
│   │   ├── useIdeas.ts           # 灵感 CRUD
│   │   ├── useSettings.ts        # 设置管理
│   │   ├── useVoiceRecorder.ts   # 录音控制
│   │   ├── useVoiceTranscribe.ts # AI 转写 + 摘要
│   │   ├── useClipboardWatcher.ts # 剪贴板监听
│   │   └── useAppUsageTracker.ts # 应用追踪事件监听
│   ├── services/                 # 数据服务层（12 个）
│   │   ├── aiService.ts          # AI 引擎（对话 / 转写 / 摘要 / 分类）
│   │   ├── butlerService.ts      # Butler 指令编排
│   │   ├── todoService.ts        # 待办 CRUD
│   │   ├── ideaService.ts        # 灵感 CRUD
│   │   ├── pomodoroService.ts    # 番茄钟 CRUD
│   │   ├── clipboardService.ts   # 剪贴板 CRUD
│   │   ├── voiceService.ts       # 语音记录 CRUD
│   │   ├── statsService.ts       # 统计聚合
│   │   ├── appUsageService.ts    # 应用使用时长
│   │   ├── settingsService.ts    # 设置读写
│   │   ├── obsidianService.ts    # Obsidian 导出桥接
│   │   └── database.ts           # SQLite 连接单例
│   ├── stores/                   # Zustand 全局状态
│   │   ├── useAppStore.ts        # 应用级状态（Butler 开关等）
│   │   └── butlerStore.ts        # Butler 对话持久化
│   ├── store/                    # 轻量状态（主题、Toast）
│   └── types/                    # TypeScript 类型定义（7 个）
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs                # 主入口（插件注册、快捷键）
│   │   ├── commands/             # IPC 命令
│   │   │   ├── butler.rs         # AI Butler 窗口控制
│   │   │   ├── app_usage.rs      # 应用追踪开关
│   │   │   ├── clipboard.rs      # 剪贴板监听
│   │   │   ├── obsidian.rs       # Obsidian vault 路径检测
│   │   │   └── voice.rs          # 录音文件管理
│   │   └── services/             # 后台服务
│   │       ├── clipboard_watcher.rs
│   │       └── app_usage_tracker.rs
│   ├── migrations/               # 数据库迁移
│   │   ├── 001_init.sql          # 核心表结构
│   │   └── 002_error_logs.sql    # 错误日志表
│   ├── capabilities/             # Tauri 安全能力声明
│   └── tauri.conf.json           # 窗口 / CSP / 权限配置
└── package.json
```

---

## ⚙️ AI 配置

FlowBox 支持多种 AI 提供商，在 **设置 → AI 模型配置** 中切换：

| 提供商 | 用途 | 说明 |
|--------|------|------|
| **DeepSeek**（默认推荐） | Butler 对话、摘要提取、剪贴板分类 | 中文能力强，价格极低 |
| **OpenAI** | Butler 对话、摘要、Whisper 转写、截图分析 | 质量最优，支持 Vision |
| **Ollama** | Butler 对话、本地推理 | 完全离线，隐私最高 |

语音转写默认使用浏览器内置 Web Speech API（免费），如需更高精度可切换到 OpenAI Whisper。

---

## 📝 Markdown 转换器

- 粘贴富文本 / HTML，自动转为结构化 Markdown（基于 Turndown）
- 实时预览 + 手动编辑
- Obsidian Vault 导出桥接（占位，待完善）

---

## 🔐 隐私设计

- **Local-First**：所有数据存储在本地 SQLite，不上传任何服务器
- **AI 可选**：AI 功能完全可关闭，不影响核心使用
- **macOS Private API**：用于透明窗口（Butler），不影响功能安全性
- **无遥测**：不收集任何用户行为数据

---

## 🗺️ Roadmap

- [x] Butler 流式输出（Streaming SSE）
- [x] Butler 对话历史从 localStorage 迁移至 SQLite
- [ ] Obsidian Vault 自动导出集成
- [ ] AI 周报自动生成（基于效率分析数据）
- [ ] 多语言 i18n 支持
- [ ] Windows / Linux 跨平台适配

---

## 📜 License

MIT

---

<p align="center">
  <strong>FlowBox</strong> — 让每一分钟都有意义 ⏱️
</p>
