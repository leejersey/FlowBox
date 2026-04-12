# Dev Trending — GitHub 热门仓库新闻板块设计文档

> 创建日期：2026-04-12
> 状态：✅ 已确认

## 1. 目标

为 FlowBox 新增一个「Dev Trending」模块，每日自动获取一周 GitHub 热门仓库，AI 自动生成中文摘要，支持离线浏览和一键收藏到灵感。

## 2. 背景

FlowBox 定位为面向个人开发者和知识工作者的 macOS 桌面 AI 效率工具。GitHub 热门资讯是开发者群体的高频信息需求，将其集成到 FlowBox 中形成"信息输入 → AI 处理 → 知识沉淀（灵感收藏）"的闭环。

## 3. 设计决策

### 3.1 数据源选择

**已确认：OSS Insight API 为主数据源**

经调研和实测对比三种方案：

| 方案 | 优势 | 劣势 |
|------|------|------|
| **OSS Insight API** ✅ | 无需认证、返回字段丰富（stars/forks/PR/score）、原生支持 `period=past_week`、基于真实 GitHub 事件计算 | Beta 状态 |
| GitHub Search API | 官方稳定 | 只能查新建仓库、字段冗余、需认证才有合理速率 |
| HackerNews API | 无限速 | 需 N+1 请求、偏讨论型非项目趋势 |

API 端点：`GET https://api.ossinsight.io/v1/trends/repos?period=past_week&language=All`

### 3.2 更新策略

**已确认：每天一次**

- 每次打开页面时检查 `settings` 表中的 `trending.last_fetched`
- 若与当天日期不同，则自动触发刷新
- 支持手动强制刷新按钮
- 数据缓存到本地 SQLite，支持离线浏览

### 3.3 AI 摘要方案

**已确认：AI 自动生成中文摘要**

- 复用现有 `aiService.chatWithAssistant()` 接口
- 采用 batch prompt 一次性处理 top 20 仓库，节省 ~95% token 开销
- 摘要存入 `ai_summary_zh` 字段，持久化到 SQLite
- 无 API Key 时优雅降级（显示原始英文描述）

## 4. 架构设计

### 4.1 数据层

新增 `trending_repos` 表（006 迁移）：

- `repo_id` + `fetched_date` 联合唯一索引（支持 upsert）
- `ai_summary_zh` 初始 NULL，异步回填
- `total_score` 索引支持按热度排序

### 4.2 服务层

`trendingService.ts` 负责：
- API 数据获取与缓存
- AI 摘要批量生成
- 过期数据清理（保留 7 天）
- 一键收藏到灵感（调用 `ideaCreate`）

### 4.3 Hook 层

`useTrending.ts` 封装：
- 自动加载 + 按需刷新逻辑
- 语言筛选 + 关键词搜索
- 摘要生成状态管理

### 4.4 页面层

`TrendingPage.tsx`：
- 卡片列表布局（复用现有 Material Design 3 设计体系）
- 排名徽章（🥇🥈🥉）
- 语言彩色标签
- AI 摘要紫色渐变区块
- 空状态 + 骨架屏加载

### 4.5 安全配置

CSP `connect-src` 新增 `https://api.ossinsight.io`

## 5. 数据流

```
用户打开页面
  → needsRefresh() 检查今日是否已获取
  → [未获取] 调用 OSS Insight API → 写入 SQLite → 更新 last_fetched
  → [已获取] 直接从 SQLite 读取缓存
  → 渲染卡片列表
  → [用户点击"生成摘要"] batch prompt → AI 返回 → 更新 ai_summary_zh → 刷新 UI
  → [用户点击"收藏"] 调用 ideaCreate → Toast 提示成功
```

## 6. 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| NEW | `src-tauri/migrations/006_trending.sql` | 数据库迁移 |
| NEW | `src/types/trending.ts` | 类型定义 |
| NEW | `src/services/trendingService.ts` | 核心服务 |
| NEW | `src/hooks/useTrending.ts` | 页面 Hook |
| NEW | `src/pages/TrendingPage.tsx` | 页面组件 |
| MODIFY | `src/App.tsx` | 新增路由 |
| MODIFY | `src/components/layout/Sidebar.tsx` | 新增导航 |
| MODIFY | `src-tauri/tauri.conf.json` | CSP 白名单 |

## 7. 非目标

- ❌ 不做完整的 RSS 阅读器
- ❌ 不做 HackerNews / Reddit 等多源聚合
- ❌ 不做后台定时任务（依赖用户打开页面触发）
- ❌ 不做推送通知
