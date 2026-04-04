# 🧊 FlowBox — AI 桌面效率工具

![Version](https://img.shields.io/badge/version-v0.4.0-blue?style=flat-square)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Tech](https://img.shields.io/badge/stack-Tauri%20v2%20%2B%20React%2019-purple?style=flat-square)

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
- **批量勾选 + 拼接复制**：多选剪贴板记录，一键合并为完整文本
- **Diff 对比**：选中两条记录，并排高亮差异（类似 Git Diff）

### 🎙️ 语音备忘录
- **一键录音**：浏览器 MediaRecorder API，实时计时 + 脉冲动画
- **AI 转写**：火山引擎 ASR（推荐） / OpenAI Whisper（兜底）
- **智能摘要**：DeepSeek / OpenAI 自动提取摘要和待办事项
- 原声回放，导出文本

### 📊 效率分析看板
- 今日专注时长、本周番茄数、待办完成率、灵感总数
- 专注时长趋势折线图（Recharts）
- **应用使用追踪**：自动记录前台应用切换，饼图展示使用分布
- 每日专注时段热力图
- AI 周报生成（占位）

### 🔍 全局搜索
- `Cmd+/` 唤出毛玻璃浮层，跨待办 / 灵感 / 语音 / 剪贴板实时模糊搜索
- 结果按模块分组高亮，键盘 `↑↓` 导航，`Enter` 一键跳转
- 250ms 防抖，丝滑搜索体验

### 🧲 跨模块智能关联
- 通用 `item_links` 多对多关联表，任意模块间双向链接
- 灵感可关联待办，语音转写可关联灵感，剪贴板可关联待办
- 详情页展示关联条目列表，点击即跳转

### 📸 截图 OCR → 灵感 / 待办
- 使用系统截图后，从剪贴板自动捕获图片
- **AI Vision 识别**：GPT-4o / DeepSeek 提取文字 + 推荐标题和标签
- 一键选择存为灵感笔记或待办事项

### 🌙 AI 每日回顾
- 每晚自动弹窗（默认 21:00，可自定义），聚合全天数据
- 待办完成率、番茄数、灵感数、语音数、剪贴板数一览
- **滞留提醒**：高优先级待办超 3 天未处理，温和提醒
- **AI 洞察**：流式生成个性化总结 + 明日行动建议
- 回顾历史自动保存（最近 30 天）

### 🤖 AI Butler（全局智能管家）
- `Shift + Space` 全局呼出（可在设置中自定义），`Cmd + K` 应用内唤起
- **多轮对话**：基于 DeepSeek / OpenAI 的实时 AI 对话，上下文自动携带
- **技能系统**：8 个内置技能（润色、翻译、摘要、修复代码、分析截图、解释代码、写周报、头脑风暴）
- **自定义技能**：在设置→Butler 技能中创建/编辑自定义 Prompt 模板，支持专属 System Prompt
- **Prompt 选择器联动**：Butler 底栏可切换技能的 System Prompt 作为全局上下文
- **Markdown 渲染**：AI 回复原生支持标题、列表、代码块、表格等富文本排版
- **对话持久化**：基于 SQLite `butler_messages` 表，关闭窗口不丢失历史
- 毛玻璃悬浮面板，ESC / 点击遮罩关闭

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────┐
│              Tauri v2 (Rust)            │
│  ┌───────────┐ ┌────────────────────┐   │
│  │  Commands  │ │     Services       │   │
│  │ butler     │ │ clipboard_watcher  │   │
│  │ app_usage  │ │ app_usage_tracker  │   │
│  │ clipboard  │ │ butler_shortcut    │   │
│  │ obsidian   │ │ obsidian_export    │   │
│  │ voice      │ │ voice_recorder     │   │
│  │ screenshot │ │ voice_transcribe   │   │
│  └───────────┘ └────────────────────┘   │
│  Plugins: sql · global-shortcut · log   │
│              SQLite (flowbox.db)         │
├─────────────────────────────────────────┤
│           React + TypeScript            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Pages  │ │  Hooks   │ │ Services │ │
│  │ 9 pages │ │ 10 hooks │ │ 18 svc   │ │
│  └─────────┘ └──────────┘ └──────────┘ │
│  Vite · TailwindCSS · Recharts · Zustand│
└─────────────────────────────────────────┘
```

| 层级 | 技术 | 说明 |
|------|------|------|
| **桌面壳** | Tauri v2 + Rust | 窗口管理、全局快捷键、原生录音/截图、后台线程 |
| **数据库** | SQLite (tauri-plugin-sql) | 12 张核心表（含 `butler_skills`、`item_links`、`butler_messages`），本地优先 |
| **前端框架** | React 19 + TypeScript | 页面组件 + Hooks 架构 |
| **样式** | TailwindCSS v4 + @tailwindcss/typography | Material Design 3 色彩体系 |
| **状态管理** | Zustand (persist) | 主题、Toast、Butler 对话历史 |
| **图表** | Recharts | 折线图、饼图 |
| **Markdown** | react-markdown + remark-gfm + Turndown | AI 回复渲染 + HTML→MD 转换 |
| **AI** | DeepSeek / OpenAI / Ollama | 对话、摘要、OCR、剪贴板分类、每日回顾 |
| **语音 ASR** | 火山引擎 / OpenAI Whisper | 语音转文字（Rust 原生调用） |

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
│   │   ├── ClipboardPage.tsx     # 智能剪贴板（批量选择 + Diff）
│   │   ├── VoicePage.tsx         # 语音备忘录
│   │   ├── StatsPage.tsx         # 效率分析
│   │   ├── MarkdownPage.tsx      # Markdown 转换器
│   │   ├── SettingsPage.tsx      # 偏好设置
│   │   └── ButlerPage.tsx        # AI Butler 独立窗口入口
│   ├── components/               # UI 组件
│   │   ├── butler/               # Butler 对话组件
│   │   │   ├── ButlerWorkbench.tsx  # 主工作台（输入、消息列表、技能栏）
│   │   │   ├── ChatMessageItem.tsx  # 气泡渲染（Markdown / 纯文本）
│   │   │   └── ButlerFooter.tsx     # 底部状态栏（模型、Prompt 选择器、清空）
│   │   ├── skills/               # 技能管理组件
│   │   │   └── SkillEditPanel.tsx   # 技能编辑侧滑面板
│   │   ├── clipboard/            # 剪贴板增强组件
│   │   │   └── ClipDiffModal.tsx    # 并排 Diff 对比弹窗
│   │   ├── layout/               # 布局组件
│   │   │   ├── AppShell.tsx         # 应用主壳
│   │   │   ├── Sidebar.tsx          # 侧边栏导航
│   │   │   ├── TitleBar.tsx         # 标题栏
│   │   │   ├── ButlerOverlay.tsx    # Butler 浮层
│   │   │   └── GlobalSearchBar.tsx  # 全局搜索浮层
│   │   ├── review/               # 每日回顾组件
│   │   │   └── DailyReviewModal.tsx # AI 每日回顾弹窗
│   │   ├── screenshot/           # 截图 OCR 组件
│   │   │   └── ScreenshotOcrPanel.tsx # 截图识别面板
│   │   ├── todo/                 # 待办子组件
│   │   │   └── TodoDetailModal.tsx   # 待办详情弹窗（含关联）
│   │   └── ui/                   # 通用 UI 组件
│   │       ├── DatePicker.tsx       # 日期选择器
│   │       ├── Select.tsx           # 下拉选择
│   │       └── ToastContainer.tsx   # Toast 通知
│   ├── hooks/                    # 自定义 Hooks（10 个）
│   │   ├── useDatabase.ts        # DB 初始化（含 Skills 种子）
│   │   ├── useTodos.ts           # 待办 CRUD
│   │   ├── useIdeas.ts           # 灵感 CRUD
│   │   ├── useSettings.ts        # 设置管理
│   │   ├── useVoiceRecorder.ts   # 录音控制
│   │   ├── useVoiceTranscribe.ts # AI 转写 + 摘要
│   │   ├── useClipboardWatcher.ts # 剪贴板监听
│   │   ├── useAppUsageTracker.ts # 应用追踪事件监听
│   │   ├── useDailyReview.ts     # 每日回顾数据聚合
│   │   └── useScreenshotOcr.ts   # 截图 OCR 流程
│   ├── services/                 # 数据服务层（18 个）
│   │   ├── aiService.ts          # AI 引擎（对话 / 转写 / 摘要 / Vision）
│   │   ├── butlerService.ts      # Butler 指令编排（Skill 驱动）
│   │   ├── butlerDbService.ts    # Butler 对话 SQLite 持久化
│   │   ├── skillService.ts       # Butler 技能 CRUD + 预设种子
│   │   ├── todoService.ts        # 待办 CRUD
│   │   ├── ideaService.ts        # 灵感 CRUD
│   │   ├── pomodoroService.ts    # 番茄钟 CRUD
│   │   ├── clipboardService.ts   # 剪贴板 CRUD
│   │   ├── voiceService.ts       # 语音记录 CRUD
│   │   ├── statsService.ts       # 统计聚合
│   │   ├── appUsageService.ts    # 应用使用时长
│   │   ├── settingsService.ts    # 设置读写
│   │   ├── obsidianService.ts    # Obsidian 导出桥接
│   │   ├── searchService.ts      # 全局跨模块搜索
│   │   ├── linkService.ts        # 跨模块关联（item_links）
│   │   ├── dailyReviewService.ts # AI 每日回顾
│   │   ├── screenshotOcrService.ts # 截图 OCR
│   │   └── database.ts           # SQLite 连接单例
│   ├── lib/                      # 工具库
│   │   ├── utils.ts              # 通用工具（cn 等）
│   │   └── icons.ts              # Lucide 图标动态映射
│   ├── stores/                   # Zustand 全局状态
│   │   ├── useAppStore.ts        # 应用级状态（Butler 开关等）
│   │   └── butlerStore.ts        # Butler 对话持久化（含 activeSkillId）
│   ├── store/                    # 轻量状态（主题、Toast）
│   └── types/                    # TypeScript 类型定义（8 个）
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs                # 主入口（插件注册、快捷键）
│   │   ├── commands/             # IPC 命令（6 个）
│   │   │   ├── butler.rs         # AI Butler 窗口控制
│   │   │   ├── app_usage.rs      # 应用追踪开关
│   │   │   ├── clipboard.rs      # 剪贴板监听
│   │   │   ├── obsidian.rs       # Obsidian vault 路径检测
│   │   │   ├── voice.rs          # 录音启停 + 转写
│   │   │   └── screenshot.rs     # 截图捕获（剪贴板→BMP）
│   │   └── services/             # 后台服务（6 个）
│   │       ├── clipboard_watcher.rs   # 剪贴板轮询
│   │       ├── app_usage_tracker.rs   # 应用使用追踪
│   │       ├── butler_shortcut.rs     # 全局快捷键管理
│   │       ├── obsidian_export.rs     # Obsidian 文件导出
│   │       ├── voice_recorder.rs      # 原生录音
│   │       └── voice_transcribe.rs    # 火山引擎 ASR 转写
│   ├── migrations/               # 数据库迁移（5 个）
│   │   ├── 001_init.sql          # 核心表结构
│   │   ├── 002_error_logs.sql    # 错误日志表
│   │   ├── 003_butler_messages.sql # Butler 对话持久化表
│   │   ├── 004_cross_link.sql    # 跨模块关联表
│   │   └── 005_butler_skills.sql # Butler 技能管理表
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

语音转写推荐使用**火山引擎 ASR**（需在语音技术控制台申请 AppID + Token），如需更高精度可切换到 OpenAI Whisper。

---

## 📝 Markdown 双向转换器

- **网页 → Markdown**：粘贴富文本 / HTML，自动转为结构化 Markdown（基于 Turndown）
- **Markdown → 富文本**：输入 Markdown，实时渲染为精美排版（基于 react-markdown + @tailwindcss/typography）
- **一键复制富文本**：复制后可直接粘贴到 Word、飞书、Notion、微信公众号等，样式完美保留
- 顶部一键方向切换按钮
- Obsidian Vault 导出桥接

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
- [x] 火山引擎 ASR 语音转写集成
- [x] Markdown 双向转换 + 富文本复制
- [x] 剪贴板复制反馈 + 待办"进行中"状态标识
- [x] 暗色模式 UI 全面适配（Sidebar / 按钮 / 图标去底色）
- [x] 跨模块智能关联 + 全局搜索（`Cmd+/`）
- [x] 截图 OCR → 灵感 / 待办（AI Vision）
- [x] AI 每日回顾（数据聚合 + 流式总结）
- [x] 剪贴板批量拼接 + Diff 对比
- [x] Rust 原生录音 + 火山引擎 ASR 转写
- [x] Butler Skills 技能管理系统（8 预设 + 自定义 Prompt 模板）
- [ ] Obsidian Vault 自动导出集成
- [ ] AI 周报自动生成（基于效率分析数据）
- [ ] Flow 模式（沉浸式心流引擎 + 应用偏离提醒）
- [ ] 情绪追踪 + AI 洞察
- [ ] 多语言 i18n 支持
- [ ] Windows / Linux 跨平台适配

---

## 📌 版本记录

### v0.4.0 — 2026-04-04

> Butler Skills 技能管理系统

- ✨ **Butler 技能系统**：将硬编码的 5 个快捷指令升级为可管理的 Skills 系统，8 个内置技能 + 无限自定义
- ✨ **自定义 Prompt 模板**：在设置→Butler 技能中创建/编辑技能，支持专属 System Prompt + 颜色/图标/分类
- ✨ **Prompt 选择器**：Butler 底栏“Prompt 默认助手”变为可交互下拉菜单，选择技能后其 System Prompt 自动生效
- ✨ **技能快捷栏升级**：动态加载 + 「更多」弹出网格面板，轻松访问所有技能
- 🔧 **数据库迁移**：新增 005（`butler_skills` 表）
- 🔧 **图标动态映射**：新增 `icons.ts` 支持 30 个 Lucide 图标名到组件的映射

### v0.3.0 — 2026-03-30

> 智能关联 · 截图 OCR · AI 每日回顾 · 剪贴板工作流

- ✨ **全局搜索**：`Cmd+/` 唤出毛玻璃浮层，跨模块实时搜索 + 键盘导航跳转
- ✨ **跨模块智能关联**：`item_links` 多对多关联表，灵感↔待办↔语音↔剪贴板任意链接
- ✨ **截图 OCR → 灵感/待办**：系统截图 → AI Vision 识别 → 一键存储，Rust 原生 BMP 编码
- ✨ **AI 每日回顾**：每晚自动弹窗，聚合全天数据 + 滞留提醒 + 流式 AI 洞察（保留 30 天历史）
- ✨ **剪贴板 Diff 对比**：选中两条记录并排对比，新旧版本一目了然
- ✨ **剪贴板批量拼接**：多选 + 一键合并复制
- 🔧 **Butler SQLite 持久化**：对话历史从 localStorage 迁移至 `butler_messages` 表
- 🔧 **Rust 原生录音**：`voice_recorder.rs` + `voice_transcribe.rs` 替代浏览器 API
- 🔧 **数据库迁移**：新增 003（Butler 消息表）、004（跨模块关联表）

### v0.2.0 — 2026-03-29

> 双向转换 · ASR 集成 · 暗色模式全面适配

- ✨ **Markdown 双向转换器**：新增 MD → 富文本 模式，实时排版预览 + 一键复制带样式富文本
- ✨ **火山引擎 ASR**：语音转写接入火山引擎语音识别 REST API，替换不稳定的 Web Speech API
- 🎨 **暗色模式修复**：Sidebar 激活态、导出按钮对比度、应用图标去白底
- 🔧 **剪贴板复制优化**：复制操作增加 Toast 反馈
- 🔧 **待办进行中状态**：卡片标题旁新增 `🏃 进行中` 标签
- 🔧 **CSP 策略更新**：放行 `openspeech.bytedance.com` API 请求

### v0.1.0 — 2026-03-28

> 核心功能上线

- 🎉 六大功能模块上线：待办、灵感、番茄、剪贴板、语音、效率分析
- 🤖 AI Butler 多轮对话 + Markdown 渲染
- 📊 效率分析看板 + 应用使用追踪
- 🔐 Local-First 隐私设计

---

## 📜 License

MIT

---

<p align="center">
  <strong>FlowBox</strong> — 让每一分钟都有意义 ⏱️
</p>
