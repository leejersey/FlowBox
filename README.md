# 🧊 FlowBox — AI 桌面效率工具

![Version](https://img.shields.io/badge/version-v0.8.0-blue?style=flat-square)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Tech](https://img.shields.io/badge/stack-Tauri%20v2%20%2B%20React%2019-purple?style=flat-square)

> **Local-First · AI-Powered · Privacy-Centric**
>
> FlowBox 是一款面向个人开发者和知识工作者的 macOS 桌面 AI 效率工具，集成待办管理、灵感速记、番茄专注、智能剪贴板、语音备忘录、效率分析、Dev Trending 七大核心模块，并提供可在任意应用内呼出的全局浮窗，所有数据本地存储，AI 能力按需接入。

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
- 25/5/15 分钟番茄钟，可关联待办任务，支持 Mini 置顶小窗与禅模式（`Esc` 快速退出）
- 自动记录每次专注时长
- **联动 macOS 专注模式**：专注开始 / 结束时自动运行指定的「快捷指令」（如开关勿扰）

### 📎 智能剪贴板
- 后台自动监听系统剪贴板变化
- 文本/图片分类存储，一键回填
- 固定常用条目
- **批量勾选 + 拼接复制**：多选剪贴板记录，一键合并为完整文本
- **Diff 对比**：选中两条记录，并排高亮差异（类似 Git Diff）

### 🎙️ 语音备忘录
- **一键录音**：Tauri 原生录音，浏览器 MediaRecorder 作为兼容兜底，支持实时计时 + 脉冲动画
- **AI 转写**：火山引擎 ASR（推荐） / OpenAI Whisper（兜底）
- **智能摘要**：DeepSeek / OpenAI 自动提取摘要和待办事项
- 原声回放，导出文本

### 🔥 Dev Trending（GitHub 热点榜）
- **四维排行榜**：支持「今日飙升 / 每周高星 / 月度热榜 / 新秀黑马（近 14 天刚开源高星）」切换（数据源：OSS Insight API + GitHub Search API），并支持按高星飙升、综合热度、社区活跃排序
- **板块分类独立排名 + 技术订阅雷达**：内置 6 大领域板块（AI & Agent、开发工具 & CLI、前端 & UI、后端 & 基础设施、桌面 & 效率、安全 & 网络）+ 自定义关键词雷达订阅（命中自动高亮，支持专属雷达命中筛选）
- **Master-Detail 项目速读工作台**：无需跳转浏览器即可在右侧面板预览仓库 README 原文，或一键生成 **AI 结构化项目速读卡**（一句话说透、核心痛点、3 大亮点、上手门槛、同类对比）
- **生产力闭环**：支持一键「收藏灵感」、一键「加入待办」、一键「问 Butler（带入项目速读与 README 上下文）」以及一键导出本期「热点周报」到 Obsidian / 剪贴板
- 本地 SQLite 分周期独立缓存，支持离线浏览，14 天自动清理

### 📊 效率分析看板
- 今日专注时长、本周番茄数、待办完成率、灵感总数，支持天 / 周 / 月周期联动切换
- 专注时长趋势折线图（Recharts）
- **应用使用追踪**：每 5 秒采样前台应用，按周期增量写入使用时长，饼图展示使用分布
- 每日专注时段热力图
- **AI 周报生成**：聚合本周待办、专注、灵感与热点，支持职场周报 / 个人复盘两种风格，一键复制或导出 Obsidian

### ⚡ 全局浮窗（任意应用内可用）
- **`⌥⇧A` 选中文字 AI 处理**：在任意应用选中文字，用 Butler 技能或自定义指令润色 / 翻译 / 修代码，`Enter` 直接替换原文，原剪贴板自动恢复
- **`⌥⇧Space` 快速记录**：零摩擦记下灵感或待办，`Tab` 切换类型、`#标签` 自动提取，保存后焦点回到原应用
- **`⇧⌘V` 剪贴板快选**：搜索历史剪贴板，回车直接粘贴到原应用
- 以上功能均可从顶部菜单栏托盘呼出；自动粘贴 / 替换需授予「辅助功能」权限

### 💾 数据备份与恢复
- 每日自动备份（保留 7 份）+ 应用升级前自动快照，基于 SQLite Online Backup，运行中也能得到一致快照
- 设置 → 隐私与安全 中手动备份、一键恢复（恢复前自动为当前数据留存快照，可撤销）

### 🔍 全局搜索与快捷心流
- `Cmd+/` 唤出毛玻璃命令面板，跨待办 / 灵感 / 语音 / 剪贴板实时模糊搜索并执行快捷指令
- 结果按模块分组高亮，键盘 `↑↓` 自动跟随滚动导航，`Enter` 一键跳转；支持 `Cmd+1~7` 极速切换主模块
- 与 AI Butler 浮层原子互斥，删除/清空等破坏性操作均带轻确认防误触

### 🧲 跨模块智能关联
- 通用 `item_links` 多对多关联表，待办、灵感、语音、剪贴板四类入口均可双向查看、跳转、删除关联
- 删除任一实体时同步清理两端关联

### 📸 截图 OCR → 灵感 / 待办
- 使用系统截图后，从剪贴板自动捕获图片
- **分流识别**：OpenAI 直接使用 Vision；DeepSeek / Ollama 先经 macOS Vision OCR 提取文本，再由文本模型整理标题和标签
- 一键选择存为灵感笔记或待办事项

### 🌙 AI 每日回顾
- 每晚自动弹窗（默认 21:00，可自定义），聚合全天数据
- 待办完成率、番茄数、灵感数、语音数、剪贴板数一览
- **滞留提醒**：高优先级待办超 3 天未处理，温和提醒
- **AI 洞察**：流式生成个性化总结 + 明日行动建议
- 回顾历史自动保存（最近 30 天）

### 🤖 AI Butler（全局智能管家 · Local Agent）
- `Shift + Space` 全局呼出（可在设置中自定义），`Cmd + K` 应用内唤起
- **本地工作区上下文挂载**：一键勾选 `@剪贴板 / @待办 / @灵感 / @热榜 / @本周` 实时注入本地 SQLite 数据，支持从 GitHub 热点页一键带入项目上下文深度追问
- **可执行本地动作卡片**：AI 回复自动识别创建待办、保存灵感、开启番茄钟意图，渲染可一键确认执行（或批量执行）的动作卡片，全模型通用（DeepSeek / OpenAI / Ollama）
- **多会话历史管理**：基于 SQLite `butler_sessions` & `butler_messages` 表支持新建对话、历史切换、删除会话与首句自动命名
- **多轮对话与流式控制**：自适应多行输入（`Enter` 发送 / `Shift+Enter` 换行），流式输出支持随时点击停止中断
- **技能系统与自定义模板**：8 个内置技能 + 设置内自定义 Prompt / System Prompt，底栏随时切换全局上下文
- **Markdown 渲染**：AI 回复原生支持标题、列表、代码块、表格等富文本排版，ESC / 点击遮罩关闭

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
│  │ voice/ocr  │ │ voice_recorder     │   │
│  │ screenshot │ │ voice_transcribe   │   │
│  │ secrets    │ │ ocr/secrets        │   │
│  └───────────┘ └────────────────────┘   │
│  Plugins: sql · shortcut · log · autostart│
│       SQLite (flowbox.db) · Keychain     │
├─────────────────────────────────────────┤
│           React + TypeScript            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Pages  │ │  Hooks   │ │ Services │ │
│  │10 pages │ │ 12 hooks │ │ 22 svc   │ │
│  └─────────┘ └──────────┘ └──────────┘ │
│  Vite · TailwindCSS · Recharts · Zustand│
└─────────────────────────────────────────┘
```

| 层级 | 技术 | 说明 |
|------|------|------|
| **桌面壳** | Tauri v2 + Rust | 窗口管理、全局快捷键、原生录音/截图、macOS Vision OCR、后台线程 |
| **数据库** | SQLite (tauri-plugin-sql) | 13 张核心表（含 `trending_repos`、`butler_skills`、`item_links`），本地优先 |
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

- **Node.js** ≥ 20.19
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

### 构建生产包与自动发布

```bash
# 本地构建生产包
npm run tauri build

# 触发 GitHub Actions 自动构建、Ed25519 签名并发布 Release（支持应用内自动更新）
git tag v0.6.0
git push origin v0.6.0
```

> 桌面端内置 `tauri-plugin-updater`：启动后静默检测 GitHub Releases 的 `latest.json`，支持在 **设置 → 关于 FlowBox** 中一键下载更新包、验签并自动重启生效，无需每次手动下载 DMG。
>
> **macOS 首次下载 DMG 安装提示**：因开源项目暂未接入付费 Apple Developer 公证，首次从浏览器下载安装若提示「“FlowBox”已损坏，无法打开」，将应用拖入「应用程序」后在终端执行一次以下命令即可正常打开（后续应用内自动更新无需重复执行）：
> ```bash
> xattr -cr /Applications/FlowBox.app
> ```

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
│   │   ├── TrendingPage.tsx      # Dev Trending（GitHub 热门仓库）
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
│   │   │   ├── TodoDetailPanel.tsx   # 待办右侧详情工作台
│   │   │   └── TodoDetailModal.tsx   # 待办详情弹窗（含关联）
│   │   ├── trending/             # GitHub 热点组件
│   │   │   └── TrendingDetailPanel.tsx # 项目速读卡与 README 预览工作台
│   │   └── ui/                   # 通用 UI 组件
│   │       ├── ConfirmIconButton.tsx # 二次轻确认删除按钮
│   │       ├── DatePicker.tsx       # 日期选择器
│   │       ├── Select.tsx           # 下拉选择
│   │       └── ToastContainer.tsx   # Toast 通知
│   ├── hooks/                    # 自定义 Hooks（12 个）
│   │   ├── useDatabase.ts        # DB 初始化（含 Skills 种子）
│   │   ├── useTodos.ts           # 待办 CRUD
│   │   ├── useIdeas.ts           # 灵感 CRUD
│   │   ├── useSettings.ts        # 设置管理
│   │   ├── useTrending.ts        # Dev Trending 数据 + 筛选
│   │   ├── useVoiceRecorder.ts   # 录音控制
│   │   ├── useVoiceTranscribe.ts # AI 转写 + 摘要
│   │   ├── useClipboardWatcher.ts # 剪贴板监听
│   │   ├── useAppUsageTracker.ts # 应用追踪事件监听
│   │   ├── useDailyReview.ts     # 每日回顾数据聚合
│   │   ├── useDebounce.ts        # 通用防抖
│   │   └── useScreenshotOcr.ts   # 截图 OCR 流程
│   ├── services/                 # 数据服务层（22 个）
│   │   ├── aiService.ts          # AI 引擎（对话 / 转写 / 摘要 / Vision）
│   │   ├── butlerService.ts      # Butler 指令编排（Skill + 上下文 + 动作协议）
│   │   ├── butlerContextService.ts # 本地工作区上下文聚合（@剪贴板/@待办/@灵感/@热榜/@本周）
│   │   ├── butlerActionService.ts  # Butler 本地可执行动作执行器
│   │   ├── butlerDbService.ts    # Butler 多会话 SQLite 持久化
│   │   ├── skillService.ts       # Butler 技能 CRUD + 预设种子
│   │   ├── trendingService.ts    # Dev Trending（API + 缓存 + AI 摘要）
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
│   │   ├── appInitializationService.ts # 主窗口初始化
│   │   ├── backgroundSettingsService.ts # 后台设置同步
│   │   ├── secretService.ts      # Keychain 凭据桥接
│   │   └── database.ts           # SQLite 连接单例
│   ├── lib/                      # 工具库
│   │   ├── utils.ts              # 通用工具（cn 等）
│   │   ├── trendingCategory.ts   # GitHub 热点板块分类、雷达与周报生成引擎
│   │   ├── butlerActions.ts      # Butler 可执行动作块解析器
│   │   ├── butlerSession.ts      # Butler 会话标题自动提炼
│   │   └── icons.ts              # Lucide 图标动态映射
│   ├── stores/                   # Zustand 全局状态
│   │   ├── useAppStore.ts        # 应用级状态（Butler 开关等）
│   │   └── butlerStore.ts        # Butler 对话持久化（含 activeSkillId）
│   ├── store/                    # 轻量状态（主题、Toast）
│   └── types/                    # TypeScript 类型定义（9 个）
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs                # 主入口（插件注册、快捷键）
│   │   ├── commands/             # IPC 命令（8 个）
│   │   │   ├── butler.rs         # AI Butler 窗口控制
│   │   │   ├── app_usage.rs      # 应用追踪开关
│   │   │   ├── clipboard.rs      # 剪贴板监听
│   │   │   ├── obsidian.rs       # Obsidian vault 路径检测
│   │   │   ├── voice.rs          # 录音启停 + 转写
│   │   │   ├── screenshot.rs     # 截图捕获（剪贴板→BMP）
│   │   │   ├── ocr.rs            # macOS Vision OCR
│   │   │   └── secrets.rs        # macOS Keychain
│   │   └── services/             # 后台服务（8 个）
│   │       ├── clipboard_watcher.rs   # 剪贴板轮询
│   │       ├── app_usage_tracker.rs   # 应用使用追踪
│   │       ├── butler_shortcut.rs     # 全局快捷键管理
│   │       ├── obsidian_export.rs     # Obsidian 文件导出
│   │       ├── voice_recorder.rs      # 原生录音
│   │       ├── voice_transcribe.rs    # 火山引擎 ASR 转写
│   │       ├── ocr.rs                 # Vision 文字识别
│   │       └── secrets.rs             # Keychain 读写
│   ├── migrations/               # 数据库迁移（12 个）
│   │   ├── 001_init.sql          # 核心表结构
│   │   ├── 002_error_logs.sql    # 错误日志表
│   │   ├── 003_butler_messages.sql # Butler 对话持久化表
│   │   ├── 004_cross_link.sql    # 跨模块关联表
│   │   ├── 005_butler_skills.sql # Butler 技能管理表
│   │   ├── 006_trending.sql      # Dev Trending 热门仓库缓存表
│   │   ├── 007–010               # 番茄恢复、usage 去重、关联规范化与清理
│   │   ├── 011_trending_v2.sql   # 热点多周期索引、板块分类、AI 速读与 README 缓存
│   │   └── 012_butler_sessions.sql # Butler 多会话管理表与消息会话关联
│   ├── capabilities/             # Tauri 安全能力声明
│   └── tauri.conf.json           # 窗口 / CSP / 权限配置
├── docs/                         # 架构与功能文档
├── docs/ui_assets/               # UI 参考素材
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

## 🔐 隐私设计

- **Local-First**：业务数据默认存储在本地 SQLite；仅在启用云端 AI / ASR 时发送完成请求所需的内容
- **安全凭据**：AI 与 ASR 凭据（API Key、AppID、Token）存入 macOS Keychain；旧配置迁移成功后会删除 SQLite 中的明文
- **开机自启动**：使用 Tauri 官方 autostart 插件，并以插件实际状态回写设置
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
- [x] 截图 OCR → 灵感 / 待办（OpenAI Vision / macOS Vision OCR）
- [x] AI 每日回顾（数据聚合 + 流式总结）
- [x] 剪贴板批量拼接 + Diff 对比
- [x] Rust 原生录音 + 火山引擎 ASR 转写
- [x] Butler Skills 技能管理系统（8 预设 + 自定义 Prompt 模板）
- [x] Dev Trending v2/v3 — 日/周/月/新秀黑马四榜 + 6 大板块排名 + 技术雷达 + 应用内 README 预览与 AI 项目速读卡 + 一键转待办/问 Butler/导出 Obsidian 周报
- [x] AI Butler v2（Local Agent）— `@剪贴板/@待办/@灵感/@热榜/@本周` 上下文挂载 + 可执行动作卡片 + 多会话历史管理
- [x] 应用内自动更新（`tauri-plugin-updater` + GitHub Releases 自动签名发版，原地更新重启生效）
- [x] 桌面端 UI/交互全面打磨（1280×820 窗口适配、过渡动效、防误触轻确认、浮层互斥、Butler 多行输入与流式停止）
- [x] AI 周报自动生成（基于效率分析数据）
- [x] 全局浮窗：选中文字 AI 处理（`⌥⇧A`）、快速记录（`⌥⇧Space`）、剪贴板快选自动粘贴（`⇧⌘V`）
- [x] 本地数据库自动备份与一键恢复
- [x] 番茄钟联动 macOS 专注模式
- [ ] Obsidian Vault 自动导出集成
- [ ] Flow 模式（沉浸式心流引擎 + 应用偏离提醒）
- [ ] 情绪追踪 + AI 洞察
- [ ] 多语言 i18n 支持
- [ ] Windows / Linux 跨平台适配

---

## 📌 版本记录

完整版本更新日志请查看 [CHANGELOG.md](./CHANGELOG.md)（当前最新版本：**v0.8.0**）。

---

## 📜 License

MIT

---

<p align="center">
  <strong>FlowBox</strong> — 让每一分钟都有意义 ⏱️
</p>
