# Markdown 代码块主题切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `Markdown 转网页` 页面增加可记忆的亮色/暗色代码块主题切换，并让预览与复制富文本始终使用当前主题。

**Architecture:** 保留现有轻量代码高亮逻辑，但将颜色与容器样式从 `MarkdownPage.tsx` 中抽离为独立主题对象。页面自身维护 `light | dark` 状态并通过本地持久化恢复上次选择，预览渲染和“复制富文本”统一复用当前主题生成的内联样式。

**Tech Stack:** React, TypeScript, ReactMarkdown, localStorage, node:test, Vite

---

## 文件结构

- Create: `/Users/lizexi/Documents/AI/AiCode/FlowBox/src/features/markdown/codeThemes.ts`
  - 负责定义 `light` / `dark` 主题对象、类型和 token 颜色映射。
- Create: `/Users/lizexi/Documents/AI/AiCode/FlowBox/src/features/markdown/codeThemePreference.ts`
  - 负责读取、校验、保存页面级主题偏好。
- Modify: `/Users/lizexi/Documents/AI/AiCode/FlowBox/src/pages/MarkdownPage.tsx`
  - 负责主题状态、切换 UI、主题化预览渲染、主题化复制链路。
- Modify: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-wechat-code-style.test.mjs`
  - 现有回归测试改为验证“主题驱动的内联样式”，不再依赖硬编码暗色值。
- Create: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-code-theme-config.test.mjs`
  - 验证主题文件存在且包含 `light` / `dark` 的必要字段。
- Create: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-code-theme-preference.test.mjs`
  - 验证主题偏好键名、回退策略和合法值处理。
- Create: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-code-theme-toggle.test.mjs`
  - 验证 `MarkdownPage` 引入主题状态、切换控件和恢复逻辑。

## 实施约束

- 只覆盖 `/markdown` 页面，不改 Butler、剪贴板、灵感页等其他代码块展示区域。
- 不引入第三方重型高亮库。
- 不把主题配置接入设置页。
- 复制富文本必须继续依赖内联样式，不能退回 class 或 CSS 变量方案。

### Task 1: 抽出代码块主题对象

**Files:**
- Create: `/Users/lizexi/Documents/AI/AiCode/FlowBox/src/features/markdown/codeThemes.ts`
- Test: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-code-theme-config.test.mjs`

- [ ] **Step 1: 写失败测试，先锁定主题模块的公开结构**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('代码主题模块应提供 light/dark 两套主题定义', async () => {
  const source = await readFile(new URL('../src/features/markdown/codeThemes.ts', import.meta.url), 'utf8')

  assert.ok(source.includes("export type CodeThemeName = 'light' | 'dark'"))
  assert.ok(source.includes('export const codeThemes'))
  assert.ok(source.includes('light: {'))
  assert.ok(source.includes('dark: {'))
  assert.ok(source.includes('inlineCode'))
  assert.ok(source.includes('tokens'))
})
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `node --test tests/markdown-code-theme-config.test.mjs`  
Expected: FAIL，提示 `codeThemes.ts` 不存在或缺少 `light/dark` 主题定义。

- [ ] **Step 3: 以最小实现创建主题模块**

```ts
export type CodeThemeName = 'light' | 'dark'

export type CodeTheme = {
  block: {
    backgroundColor: string
    color: string
    border: string
    boxShadow: string
  }
  inlineCode: {
    backgroundColor: string
    color: string
    border: string
  }
  lineNumber: {
    color: string
  }
  tokens: {
    plain: string
    comment: string
    keyword: string
    string: string
    number: string
    operator: string
    builtin: string
    heading: string
  }
}

export const codeThemes: Record<CodeThemeName, CodeTheme> = {
  dark: { /* 迁移当前暗色值 */ },
  light: { /* 按参考图定义亮色值 */ },
}
```

- [ ] **Step 4: 运行测试，确认主题结构已经落地**

Run: `node --test tests/markdown-code-theme-config.test.mjs`  
Expected: PASS

- [ ] **Step 5: 提交本任务**

```bash
git add tests/markdown-code-theme-config.test.mjs src/features/markdown/codeThemes.ts
git commit -m "feat: add markdown code theme definitions"
```

### Task 2: 抽出主题偏好持久化逻辑

**Files:**
- Create: `/Users/lizexi/Documents/AI/AiCode/FlowBox/src/features/markdown/codeThemePreference.ts`
- Test: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-code-theme-preference.test.mjs`

- [ ] **Step 1: 写失败测试，先锁定持久化键名和回退规则**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('代码主题偏好应使用 markdown.codeTheme 键并对脏值回退 dark', async () => {
  const source = await readFile(new URL('../src/features/markdown/codeThemePreference.ts', import.meta.url), 'utf8')

  assert.ok(source.includes("const CODE_THEME_STORAGE_KEY = 'markdown.codeTheme'"))
  assert.ok(source.includes("return 'dark'"))
  assert.ok(source.includes("theme === 'light' || theme === 'dark'"))
})
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `node --test tests/markdown-code-theme-preference.test.mjs`  
Expected: FAIL，提示 `codeThemePreference.ts` 不存在。

- [ ] **Step 3: 实现最小偏好读写帮助函数**

```ts
import type { CodeThemeName } from './codeThemes'

const CODE_THEME_STORAGE_KEY = 'markdown.codeTheme'

export function normalizeCodeTheme(theme: string | null | undefined): CodeThemeName {
  return theme === 'light' || theme === 'dark' ? theme : 'dark'
}

export function loadCodeThemePreference(): CodeThemeName {
  if (typeof window === 'undefined') return 'dark'
  return normalizeCodeTheme(window.localStorage.getItem(CODE_THEME_STORAGE_KEY))
}

export function saveCodeThemePreference(theme: CodeThemeName) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CODE_THEME_STORAGE_KEY, theme)
}
```

- [ ] **Step 4: 运行测试，确认持久化逻辑已具备**

Run: `node --test tests/markdown-code-theme-preference.test.mjs`  
Expected: PASS

- [ ] **Step 5: 提交本任务**

```bash
git add tests/markdown-code-theme-preference.test.mjs src/features/markdown/codeThemePreference.ts
git commit -m "feat: persist markdown code theme preference"
```

### Task 3: 重构 Markdown 预览渲染为主题驱动

**Files:**
- Modify: `/Users/lizexi/Documents/AI/AiCode/FlowBox/src/pages/MarkdownPage.tsx`
- Modify: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-wechat-code-style.test.mjs`

- [ ] **Step 1: 写失败测试，先把回归断言改成“主题驱动渲染”**

```js
assert.ok(
  source.includes('function createMarkdownPreviewComponents'),
  'MarkdownPage 应提供主题化的 markdownPreviewComponents 工厂'
)
assert.ok(
  source.includes('theme.tokens[token.type]'),
  '代码高亮颜色应由当前主题提供，而不是硬编码常量'
)
assert.ok(
  source.includes('theme.block.backgroundColor'),
  '代码块容器背景色应从主题对象读取'
)
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `node --test tests/markdown-wechat-code-style.test.mjs`  
Expected: FAIL，提示仍在使用硬编码颜色或缺少主题工厂。

- [ ] **Step 3: 以最小改动把渲染器改成主题工厂**

```ts
function createMarkdownPreviewComponents(theme: CodeTheme): Components {
  return {
    pre: ({ children }) => <>{children}</>,
    code: ({ children, className }) => {
      // 继续复用 normalizeLanguage / inferCodeLanguage / tokenizeCodeLine
      // 只把 block、inlineCode、tokens 的颜色来源切换为 theme
    },
  }
}

function renderHighlightedCode(code: string, language: string, theme: CodeTheme) {
  return lines.map((line, lineIndex) => (
    <Fragment key={`${language}-${lineIndex}`}>
      {tokenizeCodeLine(line, language).map((token, tokenIndex) => (
        <span key={`${language}-${lineIndex}-${tokenIndex}`} style={{ color: theme.tokens[token.type] }}>
          {token.text}
        </span>
      ))}
    </Fragment>
  ))
}
```

- [ ] **Step 4: 运行测试，确认预览已切换为主题驱动**

Run: `node --test tests/markdown-wechat-code-style.test.mjs`  
Expected: PASS

- [ ] **Step 5: 提交本任务**

```bash
git add tests/markdown-wechat-code-style.test.mjs src/pages/MarkdownPage.tsx
git commit -m "refactor: theme markdown code preview rendering"
```

### Task 4: 接入页面主题状态、切换 UI 和恢复逻辑

**Files:**
- Modify: `/Users/lizexi/Documents/AI/AiCode/FlowBox/src/pages/MarkdownPage.tsx`
- Test: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-code-theme-toggle.test.mjs`

- [ ] **Step 1: 写失败测试，锁定状态、切换器和恢复入口**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('MarkdownPage 应提供页面内主题切换并恢复上次选择', async () => {
  const source = await readFile(new URL('../src/pages/MarkdownPage.tsx', import.meta.url), 'utf8')

  assert.ok(source.includes("const [codeThemeName, setCodeThemeName] = useState"))
  assert.ok(source.includes('loadCodeThemePreference'))
  assert.ok(source.includes('saveCodeThemePreference'))
  assert.ok(source.includes('亮色'))
  assert.ok(source.includes('暗色'))
})
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `node --test tests/markdown-code-theme-toggle.test.mjs`  
Expected: FAIL，提示页面尚未引入主题状态或切换按钮。

- [ ] **Step 3: 实现页面级状态和切换器**

```ts
const [codeThemeName, setCodeThemeName] = useState<CodeThemeName>(() => loadCodeThemePreference())
const activeCodeTheme = codeThemes[codeThemeName]
const markdownPreviewComponents = useMemo(
  () => createMarkdownPreviewComponents(activeCodeTheme),
  [activeCodeTheme]
)

const handleChangeCodeTheme = (nextTheme: CodeThemeName) => {
  setCodeThemeName(nextTheme)
  saveCodeThemePreference(nextTheme)
}
```

```tsx
<div className="inline-flex rounded-full border ...">
  <button onClick={() => handleChangeCodeTheme('light')}>亮色</button>
  <button onClick={() => handleChangeCodeTheme('dark')}>暗色</button>
</div>
```

- [ ] **Step 4: 运行测试，确认页面切换逻辑已接通**

Run: `node --test tests/markdown-code-theme-toggle.test.mjs`  
Expected: PASS

- [ ] **Step 5: 提交本任务**

```bash
git add tests/markdown-code-theme-toggle.test.mjs src/pages/MarkdownPage.tsx
git commit -m "feat: add markdown page code theme toggle"
```

### Task 5: 锁定复制富文本与当前主题一致

**Files:**
- Modify: `/Users/lizexi/Documents/AI/AiCode/FlowBox/src/pages/MarkdownPage.tsx`
- Create: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-copy-theme-export.test.mjs`

- [ ] **Step 1: 写失败测试，确保复制链路使用当前主题渲染结果**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('复制富文本应复用当前主题渲染后的代码块 HTML', async () => {
  const source = await readFile(new URL('../src/pages/MarkdownPage.tsx', import.meta.url), 'utf8')

  assert.ok(source.includes('previewRef.current.innerHTML'))
  assert.ok(source.includes('createMarkdownPreviewComponents(activeCodeTheme)'))
  assert.ok(source.includes("showToast('富文本排版已复制'"))
})
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `node --test tests/markdown-copy-theme-export.test.mjs`  
Expected: FAIL，提示页面尚未把当前主题渲染结果显式接入复制链路。

- [ ] **Step 3: 保持复制逻辑最小变更，只确保它依赖当前主题产出的预览 HTML**

```ts
const markdownPreviewComponents = useMemo(
  () => createMarkdownPreviewComponents(activeCodeTheme),
  [activeCodeTheme]
)

const htmlText = `<div style="font-family: var(--font-sans, sans-serif); color: inherit;">${previewRef.current.innerHTML}</div>`
```

Implementation note:
- 不要在 `handleCopyRichText` 中重复生成一套独立代码块主题。
- 只保证 `previewRef.current.innerHTML` 始终来自当前主题渲染结果。

- [ ] **Step 4: 运行测试，确认复制链路已和当前主题绑定**

Run: `node --test tests/markdown-copy-theme-export.test.mjs tests/markdown-wechat-code-style.test.mjs`  
Expected: PASS

- [ ] **Step 5: 提交本任务**

```bash
git add tests/markdown-copy-theme-export.test.mjs tests/markdown-wechat-code-style.test.mjs src/pages/MarkdownPage.tsx
git commit -m "feat: sync markdown rich-text copy with code theme"
```

### Task 6: 验证、构建和人工回归

**Files:**
- Modify: `/Users/lizexi/Documents/AI/AiCode/FlowBox/src/pages/MarkdownPage.tsx`（如验证后发现小缺口）
- Test: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-code-theme-config.test.mjs`
- Test: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-code-theme-preference.test.mjs`
- Test: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-code-theme-toggle.test.mjs`
- Test: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-copy-theme-export.test.mjs`
- Test: `/Users/lizexi/Documents/AI/AiCode/FlowBox/tests/markdown-wechat-code-style.test.mjs`

- [ ] **Step 1: 跑所有 Markdown 相关测试**

Run:

```bash
node --test \
  tests/markdown-code-theme-config.test.mjs \
  tests/markdown-code-theme-preference.test.mjs \
  tests/markdown-code-theme-toggle.test.mjs \
  tests/markdown-copy-theme-export.test.mjs \
  tests/markdown-wechat-code-style.test.mjs \
  tests/markdown-obsidian-export.test.mjs
```

Expected: PASS

- [ ] **Step 2: 跑生产构建**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 3: 人工验证页面行为**

Manual checklist:

- 在 `/markdown` 页面切换到 `亮色`，代码块预览立即变为浅色主题
- 切换到 `暗色`，现有暗色方案不回退
- 关闭页面再进入，恢复上次主题
- 点击“复制富文本”后粘贴到微信公众号编辑器，代码块外观与当前主题一致

- [ ] **Step 4: 处理验证中发现的小缺口并重新验证**

Run:

```bash
node --test tests/markdown-wechat-code-style.test.mjs tests/markdown-copy-theme-export.test.mjs
npm run build
```

Expected: PASS

- [ ] **Step 5: 提交最终整合结果**

```bash
git add \
  src/features/markdown/codeThemes.ts \
  src/features/markdown/codeThemePreference.ts \
  src/pages/MarkdownPage.tsx \
  tests/markdown-code-theme-config.test.mjs \
  tests/markdown-code-theme-preference.test.mjs \
  tests/markdown-code-theme-toggle.test.mjs \
  tests/markdown-copy-theme-export.test.mjs \
  tests/markdown-wechat-code-style.test.mjs
git commit -m "feat: add markdown code theme toggle"
```
