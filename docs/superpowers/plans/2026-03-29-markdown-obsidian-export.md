# Markdown Obsidian Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Markdown 转换页可以把粘贴内容还原为 Markdown，并将结果作为独立笔记写入 Obsidian Vault 的 `Inbox/` 目录。

**Architecture:** 前端继续使用现有 `MarkdownPage` 作为入口，补强 Markdown 清洗与默认文件名生成逻辑；Rust 侧新增 Obsidian 导出命令，负责创建 `Inbox/` 目录、清洗文件名并写入 `.md` 文件。前端通过 Tauri invoke 调用该命令，并将 Vault 路径持久化到设置表。

**Tech Stack:** React 19, TypeScript, Turndown, Tauri 2, Rust std::fs

---

### Task 1: 锁定导出命令与默认文件名行为

**Files:**
- Create: `tests/markdown-obsidian-export.test.mjs`
- Create: `tests/tauri-obsidian-export-command.test.mjs`

- [ ] **Step 1: 写失败测试**
- [ ] **Step 2: 运行测试并确认失败**

### Task 2: 实现 Rust 侧 Obsidian 导出命令

**Files:**
- Create: `src-tauri/src/commands/obsidian.rs`
- Create: `src-tauri/src/services/obsidian_export.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 新增导出命令与服务**
- [ ] **Step 2: 实现 `Inbox/` 写入、文件名清洗与去重**
- [ ] **Step 3: 注册 Tauri invoke handler**

### Task 3: 接通 Markdown 页面导出流程

**Files:**
- Modify: `src/pages/MarkdownPage.tsx`
- Create: `src/services/obsidianService.ts`

- [ ] **Step 1: 接入 Tauri 导出命令**
- [ ] **Step 2: 生成默认文件名 `YYYY-MM-DD HHmmss + 首行标题清洗.md`**
- [ ] **Step 3: 增强 Markdown 清洗与纯文本兜底**
- [ ] **Step 4: 成功后提示实际写入路径**

### Task 4: 验证

**Files:**
- Verify only

- [ ] **Step 1: 运行 `node --test`**
- [ ] **Step 2: 运行 `npm run build`**
- [ ] **Step 3: 运行 `cargo check`**
