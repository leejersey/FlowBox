# Butler 后端能力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Butler 对话 UI 从 mock 回复接成真实 AI 能力，并补齐截图分析、复制、优化、重新生成。

**Architecture:** 以前端服务层为主，`ButlerOverlay` 负责 UI，`butlerService` 负责编排，`aiService` 提供通用文本/图片聊天接口，`butlerStore` 保存加载态和最近请求上下文。复用现有剪贴板图片存储能力，不新增 Rust Butler 命令。

**Tech Stack:** React, Zustand, Tauri Web APIs, fetch, Node test

---

### Task 1: 先写 Butler 行为失败测试

**Files:**
- Create: `tests/butler-overlay-backend.test.mjs`
- Create: `tests/butler-service-image-analysis.test.mjs`
- Test: `tests/butler-overlay-backend.test.mjs`
- Test: `tests/butler-service-image-analysis.test.mjs`

- [ ] **Step 1: Write the failing test**

断言：

- `ButlerOverlay.tsx` 不再包含 `setTimeout` 模拟回复
- `ButlerOverlay.tsx` 应调用 `sendButlerMessage`
- `butlerService.ts` 应读取最近图片并提供截图分析入口

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/butler-overlay-backend.test.mjs tests/butler-service-image-analysis.test.mjs`
Expected: FAIL，提示 Butler 仍未接入真实后端

- [ ] **Step 3: Write minimal implementation**

创建 `src/services/butlerService.ts` 并在 `ButlerOverlay.tsx` 接入。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/butler-overlay-backend.test.mjs tests/butler-service-image-analysis.test.mjs`
Expected: PASS

### Task 2: 扩展 AI 服务支持通用聊天与图片分析

**Files:**
- Modify: `src/services/aiService.ts`
- Create: `src/services/butlerService.ts`
- Test: `tests/butler-service-image-analysis.test.mjs`

- [ ] **Step 1: Write the failing test**

断言：

- `aiService.ts` 导出通用聊天方法
- `butlerService.ts` 调用该方法处理文本
- `butlerService.ts` 调用带图片输入的方法处理截图分析

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/butler-service-image-analysis.test.mjs`
Expected: FAIL，提示缺少 Butler service 或图片分析入口

- [ ] **Step 3: Write minimal implementation**

补齐：

- 通用文本聊天
- 图片聊天
- API Key/provider 错误处理
- 快捷动作 prompt 组装

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/butler-service-image-analysis.test.mjs`
Expected: PASS

### Task 3: 扩展 Butler store 支持 loading 和重新生成

**Files:**
- Modify: `src/stores/butlerStore.ts`
- Modify: `src/types/butler.ts`
- Test: `tests/butler-overlay-backend.test.mjs`

- [ ] **Step 1: Write the failing test**

断言：

- store 包含 `isLoading`
- store 包含 `lastRequest`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/butler-overlay-backend.test.mjs`
Expected: FAIL，提示 Butler store 状态不足

- [ ] **Step 3: Write minimal implementation**

为 store 增加加载态与最近请求记录接口。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/butler-overlay-backend.test.mjs`
Expected: PASS

### Task 4: 接通 ButlerOverlay 与消息操作

**Files:**
- Modify: `src/components/layout/ButlerOverlay.tsx`
- Modify: `src/components/butler/ChatMessageItem.tsx`
- Test: `tests/butler-overlay-backend.test.mjs`

- [ ] **Step 1: Write the failing test**

断言：

- 发送消息时调用真实后端
- 快捷动作会携带 action 类型
- `ChatMessageItem` 暴露复制/优化/重新生成回调

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/butler-overlay-backend.test.mjs`
Expected: FAIL，提示交互仍为静态行为

- [ ] **Step 3: Write minimal implementation**

接通：

- `handleSend`
- `handleQuickAction`
- 消息操作按钮
- 加载中禁用发送

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/butler-overlay-backend.test.mjs`
Expected: PASS

### Task 5: 全量验证

**Files:**
- Modify: `src/components/layout/ButlerOverlay.tsx`
- Modify: `src/components/butler/ChatMessageItem.tsx`
- Modify: `src/services/aiService.ts`
- Modify: `src/services/butlerService.ts`
- Modify: `src/stores/butlerStore.ts`
- Modify: `src/types/butler.ts`

- [ ] **Step 1: Run targeted tests**

Run: `node --test tests/butler-overlay-backend.test.mjs tests/butler-service-image-analysis.test.mjs`
Expected: PASS

- [ ] **Step 2: Run broader regression tests**

Run: `node --test`
Expected: PASS

- [ ] **Step 3: Run app build**

Run: `npm run build`
Expected: PASS
