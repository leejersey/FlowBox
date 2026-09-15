# Settings Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将左侧设置入口精简为可访问的小齿轮，并通过 macOS FlowBox 原生“设置…”菜单安全打开现有主窗口设置页。

**Architecture:** 保留默认原生菜单，在应用子菜单插入初始禁用的设置项；Rust readiness command 仅接受真实 main 调用窗口。main webview 的进程级监听先注册、再启用菜单，以一个 pending boolean 暂存 Router 未就绪的请求；Router 内桥接调用现有 navigate，Mini 恢复继续由 AppShell 路由清理负责。

**Tech Stack:** React 19、React Router 7、TypeScript 5.9、Node 24 node:test、Tauri 2.10.3/Rust；不新增依赖。

---

## 工作目录、依据与范围

所有命令在 `/Users/lizexi/Documents/AI/AiCode/FlowBox/.worktrees/settings-access` 执行。规格：`docs/superpowers/specs/2026-09-14-settings-access-design.md`。执行时使用 @superpowers:test-driven-development，完成前使用 @superpowers:verification-before-completion。

已核对本地 crate `/Users/lizexi/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tauri-2.10.3/src/`：

- `menu/menu.rs`：`Menu::default(&AppHandle)`、`items()`；macOS 默认第一项为应用 Submenu，保留 About/Services/Hide/Quit，以及 Edit 等其他子菜单。
- `menu/mod.rs`：`MenuItemKind::as_submenu()`；`menu/submenu.rs`：`insert(&dyn IsMenuItem, usize)`。Menu::get 仅查当前层，设置项必须从第一项应用 Submenu::get 查找，不能从根 menu.get 递归查找。
- `menu/normal.rs`：`MenuItem::with_id(manager,id,text,enabled,accelerator)`、`set_enabled(bool)`；`app.rs`：App/AppHandle 菜单事件 handler 与 `set_menu`。
- `webview/webview_window.rs`：`WebviewWindow` 的 CommandArg 从实际 IPC message 注入；`show()`、`unminimize()`、`set_focus()`。
- `lib.rs`：`Emitter::emit_to` 支持 `EventTarget::WebviewWindow { label }`。JS `listen` 默认 target Any，可接收定向 main 的事件。

当前结构：Sidebar 的 navSections 已无设置，底部仍有文字设置 NavLink；App 在 DB ready 前不挂 BrowserRouter；AppShell 的 pathname effect 已负责 Mini 强制恢复；Butler 在独立 `/butler` 路由。不要将监听放进 AppShell effect，不能复用会随 React cleanup 解订的 `registerMainWindowListener`。

文件职责：

- 修改 `src/components/layout/Sidebar.tsx`：仅底部图标入口，必要时将 `NavItem.icon: any` 改为 `LucideIcon` 以通过该触及文件 lint。
- 新增 `src-tauri/src/settings_menu.rs`；修改 `src-tauri/src/lib.rs`：原生菜单、固定 ID/事件、readiness 与 handler；不新增 commands 目录模块。
- 新增 `src/lib/settingsNavigation.ts`：无平台依赖的最小 pending/handler/初始化单例逻辑，直接运行 Node 行为测试。
- 新增 `src/services/settingsNavigationService.ts`：Tauri 与 main/macOS 过滤、进程 singleton。
- 修改 `src/main.tsx`、`src/App.tsx`：启动监听，并在 App 内用轻量 Router 桥接组件导航。
- 修改 `src/components/layout/AppShell.tsx`：仅 macOS Tauri 的 Cmd+, 让原生 accelerator 唯一负责；浏览器/其他平台保留 DOM fallback，其他快捷键及 Mini 清理不变。
- 新增 `tests/settings-access.test.mjs`、`tests/settings-menu.test.mjs`、`tests/settings-navigation.test.mjs`：各任务的回归。

不改 README、设置页面、capability、Mini controller、package.json/lock；不新增窗口、deep link、业务 store。`package-lock.json` 不应改变。新 Rust command 默认可调用，但须在 Rust 验证真实窗口；无需为了 Rust 发事件/窗口操作增加前端 setter 权限。

### Task 1: Sidebar 图标入口

**Files:** Modify `src/components/layout/Sidebar.tsx`；Create/Test `tests/settings-access.test.mjs`。

- [ ] **Step 1: 写 Node 源码合同测试**

用 `readFile(new URL('../src/components/layout/Sidebar.tsx', import.meta.url),'utf8')` 检查：navSections 不含 `/settings`；唯一设置 NavLink 含 title、aria-label、focus-visible；全文不再含“系统设置”；入口不存在 `!collapsed` 文字分支；齿轮与 collapsed toggle 是两个独立控件。

```js
assert.doesNotMatch(sidebar, /系统设置/)
assert.match(sidebar, /aria-label="打开偏好设置"/)
assert.match(sidebar, /title="偏好设置 \(⌘,\)"/)
assert.match(sidebar, /focus-visible:ring-2/)
```

- [ ] **Step 2: RED** Run `node --test tests/settings-access.test.mjs`；预期失败于旧文字入口/缺少 aria-label，不接受语法错误作为 RED。
- [ ] **Step 3: 最小替换底部设置 NavLink**

```tsx
<NavLink to="/settings" title="偏好设置 (⌘,)" aria-label="打开偏好设置"
  className={({ isActive }) => cn(
    'self-start p-2.5 rounded-xl text-on-surface-variant hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    collapsed && 'self-center', isActive && 'text-primary bg-primary/10',
  )}>
  <Settings className="w-4 h-4" aria-hidden="true" />
</NavLink>
```

保持折叠按钮与导航不变。lucide import 增加 `type LucideIcon`，仅将 `icon: any` 替换为 `icon: LucideIcon`，不重构 Sidebar。

- [ ] **Step 4: GREEN** Run `node --test tests/settings-access.test.mjs && npx eslint src/components/layout/Sidebar.tsx && npx tsc -b`；预期退出 0。
- [ ] **Step 5: 小提交** Run `git add src/components/layout/Sidebar.tsx tests/settings-access.test.mjs && git commit -m "feat: simplify settings sidebar access"`。

### Task 2: 保留默认 macOS 菜单与 main readiness

**Files:** Create `src-tauri/src/settings_menu.rs`、`tests/settings-menu.test.mjs`；Modify `src-tauri/src/lib.rs`。

- [ ] **Step 1: 写 RED 合同与 Rust 最小单测骨架**

Node 源码测试检查 module/command 注册、setup 的 `settings_menu::install(app)?`、`Menu::default` 而非清空重建菜单、disabled `false`、固定 accelerator、实际 window label、定向 WebviewWindow main、show → unminimize → focus → emit 顺序及错误 logging。测试读取尚不存在文件时明确失败。随后在 `src-tauri/src/lib.rs` 先加入 `pub mod settings_menu;`，再建立仅常量/授权函数测试骨架，使该模块进入 Rust 编译并因尚未定义授权函数而失败；generate_handler 与 setup 接入仍留到 Step 3。

```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn readiness_only_accepts_main() {
        assert!(authorize_ready("main").is_ok());
        assert!(authorize_ready("butler").is_err());
        assert!(authorize_ready("").is_err());
    }
    #[test]
    fn only_settings_id_is_handled() {
        assert_eq!(SETTINGS_ID, "flowbox-settings");
        assert_ne!(SETTINGS_ID, "quit");
    }
}
```

- [ ] **Step 2: RED** Run `node --test tests/settings-menu.test.mjs`；预期缺少实现合同失败。建立已由 lib.rs 声明的 Rust 骨架后 Run `cargo test --manifest-path src-tauri/Cargo.toml settings_menu::tests`；预期编译失败于未定义 `authorize_ready`/常量，而不是成功运行 0 项测试。
- [ ] **Step 3: 实现同一模块的最小菜单/command**

模块公共常量及授权（全平台可编译）：

```rust
pub const SETTINGS_ID: &str = "flowbox-settings";
pub const SETTINGS_EVENT: &str = "flowbox:open-settings";

fn authorize_ready(label: &str) -> Result<(), String> {
    if label == "main" { Ok(()) } else { Err("settings readiness requires main".into()) }
}

#[tauri::command]
pub fn settings_menu_ready(window: tauri::WebviewWindow) -> Result<(), String> {
    authorize_ready(window.label())?;
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        let menu = window.app_handle().menu()
            .ok_or_else(|| "menu not installed".to_string())?;
        let items = menu.items().map_err(|error| error.to_string())?;
        let submenu = items.first().and_then(|item| item.as_submenu())
            .ok_or_else(|| "application submenu missing".to_string())?;
        let item = submenu.get(&SETTINGS_ID)
            .ok_or_else(|| "settings menu not installed".to_string())?;
        let item = item.as_menuitem().ok_or_else(|| "invalid settings menu item".to_string())?;
        item.set_enabled(true).map_err(|error| error.to_string())?;
    }
    Ok(())
}
```

macOS 安装函数与非 macOS 空安装函数：

```rust
#[cfg(target_os = "macos")]
pub fn install(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{Emitter, EventTarget, Manager};
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    let menu = Menu::default(app.handle())?;
    let items = menu.items()?;
    let submenu = items.first().and_then(|item| item.as_submenu())
        .ok_or_else(|| std::io::Error::other("default application submenu missing"))?;
    let settings = MenuItem::with_id(app, SETTINGS_ID, "设置…", false, Some("CmdOrCtrl+,"))?;
    submenu.insert(&settings, 2)?;
    submenu.insert(&PredefinedMenuItem::separator(app)?, 3)?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id().as_ref() != SETTINGS_ID { return; }
        let result = (|| -> tauri::Result<()> {
            let window = app.get_webview_window("main")
                .ok_or_else(|| std::io::Error::other("main window missing"))?;
            window.show()?;
            window.unminimize()?;
            window.set_focus()?;
            app.emit_to(EventTarget::WebviewWindow { label: "main".into() }, SETTINGS_EVENT, ())?;
            Ok(())
        })();
        if let Err(error) = result { log::error!("open settings failed: {error}"); }
    });
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn install(_app: &tauri::App) -> tauri::Result<()> { Ok(()) }
```

保留 Step 1 已加入的 `pub mod settings_menu;`，在 lib.rs 的 generate_handler 增加 `settings_menu::settings_menu_ready`，setup 开头增加 `settings_menu::install(app)?;`。所有安装错误传播启动失败；不要 `.ok()` 吞错。菜单 command 不能接收客户端提供的 label 字符串。

- [ ] **Step 4: GREEN** Run `node --test tests/settings-menu.test.mjs && cargo test --manifest-path src-tauri/Cargo.toml settings_menu::tests::readiness_only_accepts_main -- --exact && cargo test --manifest-path src-tauri/Cargo.toml settings_menu::tests::only_settings_id_is_handled -- --exact && cargo check --manifest-path src-tauri/Cargo.toml`；预期 Node 合同及两个精确命名的 Rust 测试分别通过，而不是 0 tests。运行宿主为 macOS，可实际类型检查 cfg macOS 分支；不能把源码测试声称为 NSMenu 真机测试。
- [ ] **Step 5: 小提交** Run `git add src-tauri/src/settings_menu.rs src-tauri/src/lib.rs tests/settings-menu.test.mjs && git commit -m "feat: add native settings menu readiness"`。

### Task 3: main 进程监听与 Router 桥接

**Files:** Create `src/lib/settingsNavigation.ts`、`src/services/settingsNavigationService.ts`、`tests/settings-navigation.test.mjs`；Modify `src/main.tsx`、`src/App.tsx`、`src/components/layout/AppShell.tsx`。

- [ ] **Step 1: 写可执行 RED 行为测试与接入合同**

Node 直接 import 纯 `.ts` 模块（Node 24）；fake listen 使用可控 promise，保存实际 request 回调；fake readiness 记录调用。不创建一份测试专用状态机。测试：

1. listen 未完成时 readiness 为 0，request 在无 Router 时重复只保留一次；绑定后只 navigate 一次。
2. 并发/重复 start 只注册一次；注册失败不调用 readiness，随后可重试；readiness 失败重试不得重复注册 listener。
3. bind → cleanup → request → rebind 的 StrictMode 模拟消费一次；旧 handler cleanup 不移除较新 handler。
4. Router 晚挂载可消费请求；解绑不调用底层 unlisten；Router handler 在已绑定时即时执行。
5. 源码合同：bootstrap 不在 React effect，平台 main/macOS 判断在 listen/readiness 之前；Butler/浏览器不调用 Tauri 监听；桥在 BrowserRouter 内、Routes 外、main-only。
6. AppShell 原 pathname forceExit 流程保留，Mini 时原生入口仍可 navigate；macOS Tauri DOM comma 分支不重复 native 导航，浏览器/其他平台 fallback 保留。

```js
const nav = createSettingsNavigation()
nav.request(); nav.request()
const calls = []
const cleanup = nav.bind(() => calls.push('/settings'))
assert.deepEqual(calls, ['/settings'])
cleanup(); nav.request()
nav.bind(() => calls.push('/settings'))
assert.equal(calls.length, 2)
```

- [ ] **Step 2: RED** Run `node --test tests/settings-navigation.test.mjs`；预期 missing module 或缺少接入合同失败。
- [ ] **Step 3: 实现纯最小导航实例**

```ts
export function createSettingsNavigation() {
  let pending = false
  let handler: (() => void) | undefined
  let registration: Promise<unknown> | undefined
  const flush = () => {
    if (pending && handler) { pending = false; handler() }
  }
  return {
    request() { pending = true; flush() },
    bind(next: () => void) {
      handler = next
      flush()
      return () => { if (handler === next) handler = undefined }
    },
    async start(subscribe: () => Promise<unknown>, ready: () => Promise<unknown>) {
      registration ??= Promise.resolve().then(subscribe).catch(error => {
        registration = undefined
        throw error
      })
      await registration
      await ready()
    },
  }
}
```

pending 在 navigate 前清空，避免同步桥接重放重复消费；底层订阅 Promise 独立于 readiness，因此启用失败可以重试而不重复监听。

- [ ] **Step 4: 连接平台 service 与进程 lifetime**

service 使用现有 Tauri core/event/window imports 与纯 helper。`supportsNativeSettingsMenu()` 返回 `isTauri() && /Mac/.test(navigator.platform)`（本功能 desktop macOS）；不可把 iOS 当 macOS。用下列 singleton 保存跨开发 HMR 的同一个实例，不使用业务 store：

```ts
const root = globalThis as typeof globalThis & {
  __flowboxSettingsNavigation?: ReturnType<typeof createSettingsNavigation>
}
export const settingsNavigation = root.__flowboxSettingsNavigation ??=
  createSettingsNavigation()

export async function initializeSettingsNavigation() {
  if (!supportsNativeSettingsMenu() || getCurrentWindow().label !== 'main') return
  await settingsNavigation.start(
    () => listen('flowbox:open-settings', () => settingsNavigation.request()),
    () => invoke('settings_menu_ready'),
  )
}
```

生产 main.tsx 在 createRoot 前 `void initializeSettingsNavigation().catch(error => console.error('Settings menu initialization failed', error))`。失败不启用菜单；可重复调用供开发 HMR/显式重试，不能在 StrictMode cleanup 解除进程监听。其注册的 unlisten 返回值由进程 singleton 的 registration Promise 持有，webview 销毁时平台清理；React 不拥有它。

- [ ] **Step 5: Router 接入和 Cmd+, 单一归属**

```tsx
function SettingsNavigationBridge() {
  const navigate = useNavigate()
  useEffect(() => settingsNavigation.bind(() => navigate('/settings')), [navigate])
  return null
}
```

App.tsx import 桥接，在 `<BrowserRouter>` 内 `<Routes>` 前插入 `{windowLabel === 'main' && <SettingsNavigationBridge />}`。DB ready 前没有桥，pending 保留；不要改 DB ready gating、SuspendedOutlet context 或 AppShell controller。

AppShell import `supportsNativeSettingsMenu`，仅修改已有 comma 分支：

```tsx
else if (e.key === ',' && !supportsNativeSettingsMenu()) {
  e.preventDefault(); navigate('/settings')
}
```

macOS Tauri accelerator 独占，Mini 内 DOM handler 原来早退也不阻止原生菜单；其他快捷键不变。Settings 页与 Router 导航保持复用。

- [ ] **Step 6: GREEN** Run `node --test tests/settings-navigation.test.mjs tests/settings-access.test.mjs tests/settings-menu.test.mjs tests/pomodoro-mini-mode.test.mjs tests/daily-review-owner.test.mjs tests/route-loading.test.mjs && npx tsc -b && npx eslint src/lib/settingsNavigation.ts src/services/settingsNavigationService.ts src/main.tsx src/App.tsx src/components/layout/AppShell.tsx`；预期退出 0。若源码合同依赖精确形状，仅随实际接入更新本任务新增测试，不放宽无关既有断言。
- [ ] **Step 7: 小提交** Run `git add src/lib/settingsNavigation.ts src/services/settingsNavigationService.ts src/main.tsx src/App.tsx src/components/layout/AppShell.tsx tests/settings-navigation.test.mjs && git commit -m "feat: bridge native settings navigation"`。

### Task 4: 集成验收与真机 handoff

**Files:** 不新增生产文件；仅在所属任务测试文件补充发现的回归，失败先定位，不顺手修无关代码。

- [ ] **Step 1: 完整自动验收** Run `npm test && npx tsc -b && npx eslint src/components/layout/Sidebar.tsx src/lib/settingsNavigation.ts src/services/settingsNavigationService.ts src/main.tsx src/App.tsx src/components/layout/AppShell.tsx && npm run check:rust && git diff --check`；预期全通过，Rust check/test 都执行。
- [ ] **Step 2: 构建与基线分离** Run `npm run build`；预期成功。另 Run `npm run lint`，已知全仓 a695 无关失败单独列出，不能声称全仓 lint clean，也不要修改未触及文件或 chunk 阈值。
- [ ] **Step 3: 真机检查** Run `npx tauri dev`，在 macOS 验证展开/折叠齿轮 keyboard focus 与激活；应用菜单 Settings 及原有 About/Services/Hide/Quit/Edit；主窗口最小化后菜单可 show/unminimize/focus；Butler 前台点击 Settings 主窗口跳转而 Butler 不改页；Cmd+, 单次导航不产生重复 history；Mini 内菜单跳转恢复原物理几何/置顶/可缩放/最大化并显示完整导航。
- [ ] **Step 4: 时序与错误检查** 自动 fake 延迟 listen 覆盖菜单未 ready、DB/Router 延迟 pending、StrictMode bridge replay、listen/ready 失败；真机冷启动观察 ready 前菜单禁用。找不到 main 时只记录错误、不创建窗口；菜单安装错误从 setup 传播。不要把 fake/源码合同代替原生窗口 smoke；缺 GUI 权限/环境时明确 handoff 未验项目，不擅自写 done。
- [ ] **Step 5: 如有集成修复，保持 TDD 小提交** 先新增所属测试 → RED → 根因最小修复 → GREEN；仅暂存本计划文件清单内实际改动，Run `git commit -m "fix: harden settings access integration"`。没有修复则不创建空提交。
- [ ] **Step 6: 交付** Run `git status --short && git log -3 --oneline`；确认 `package-lock.json` 未改变，报告自动验收/真机边界与各 commit。不要 push、改 README 或清理其他工作区。
