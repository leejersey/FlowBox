# 番茄钟 Mini 模式设计

## 目标

将当前“仅缩小主窗口”的半成品改为真正的主窗口紧凑模式。Mini 模式专注于计时控制，不承载导航或任务编辑；退出后完整恢复进入前的窗口和应用壳状态。

## 行为

### 进入 Mini

- 仅允许从主窗口的番茄页进入。
- 保存当前窗口尺寸、位置、是否可缩放、置顶及最大化状态。若当前已最大化，先取状态、再取消最大化并记录恢复后的普通窗口几何信息。
- 隐藏 AppShell 的 TitleBar、Sidebar、全局搜索、Butler、每日回顾和截图 OCR 等非计时区域，并移除内容区常规边距与尺寸约束。
- 将窗口调整为 `340 × 160`、设为不可缩放并保持置顶。
- 显示持续同步的剩余时间、当前任务名、开始/暂停按钮和恢复按钮。活动任务以 `PomodoroState.related_todo_id` 为真值，不使用页面当前选中项代替。
- 切换不会创建、结束或重置番茄会话。

### 退出 Mini

- 恢复进入前保存的窗口尺寸、位置、可缩放和置顶状态；原来已最大化时，最后恢复最大化，而不是写死为某个默认尺寸。
- 恢复完整 AppShell 和番茄工作台。
- 页面卸载、路由变化或窗口操作失败时，不遗留紧凑壳状态。

### 失败处理

窗口属性不具备真正的原子事务，因此按可回滚顺序切换，失败时逆序尽力恢复已改变的属性并合并报告原错误与回滚错误。手动进入/退出只在原生操作全部成功后提交 React 模式，保证 UI 原子性。路由变化或页面卸载引发强制清理时，无论原生恢复是否成功，都先退出 Mini 壳并提示错误，避免用户留在无导航界面。

进入、退出和强制清理共用一条串行队列，防止快速重复点击交错修改窗口属性。

## 实现边界

- 在现有主窗口中切换，不创建第二个 Tauri 窗口，不接入 macOS 私有面板 API。
- 由 AppShell 作为 Mini 唯一 owner，持有 `isMini` 与窗口快照，通过现有 Outlet context 暴露 `{ isMini, enterMini, exitMini }`。AppShell 监听 `location.pathname`，离开 `/pomodoro` 时执行强制清理；PomodoroPage 只根据 `isMini` 选择普通/Mini 视图，不用 DOM 查询或自己管理窗口模式。
- 将 `pomodoroService` 的 tick/complete 单回调槽改为 `Set` 多订阅者，注册函数返回 unsubscribe。PomodoroPage 仅在页面 owner 处各订阅一次并在 cleanup 取消，普通视图与 Mini 视图共用同一份页面 state；StatusBar 保留独立订阅且不再相互覆盖。
- 将原生窗口切换收敛为一个纯 `.ts` 事务函数，依赖可注入的最小 window adapter；AppShell 只负责串行调用和提交 UI 状态。不引入新依赖或状态库。
- 窗口快照只保存在当前运行期内；应用重启后使用正常主窗口。
- Tauri capability 仅向 `main` 窗口授予所需权限：在已有 `set-size` / `set-always-on-top` 上增加 `set-position`、`set-resizable`、`maximize` 和 `unmaximize`；getter 沿用现有 `core:default`。

## 预计改动

- `src/components/layout/AppShell.tsx`：Mini owner、Outlet context、路由清理与壳切换。
- `src/pages/PomodoroPage.tsx`：共享计时状态的普通/Mini 视图，任务名从活动会话派生。
- `src/services/pomodoroService.ts` 与 `src/components/layout/StatusBar.tsx`：可解订的多订阅者通知。
- 一个纯 TypeScript 窗口事务模块及一个 `node:test` 回归文件。
- `src-tauri/capabilities/pomodoro-window-main.json`：补齐上述 main-only 窗口权限。

## 验收

- 进入 Mini 后不存在 Sidebar、TitleBar 或正常内容容器占位。
- 倒计时和开始/暂停状态与完整番茄页一致。
- 退出后恢复原窗口属性和完整工作台。
- 原生操作失败时 UI 不进入半切换状态，并对已改变的窗口属性执行 best-effort 回滚。
- 从最大化主窗口进入 Mini 后，退出能恢复最大化及原普通窗口几何信息。
- 离开番茄页后不留下 Mini 壳；恢复失败也不会隐藏导航。
- 浏览器预览不会调用 Tauri window API。
- 用现有 `node:test` 覆盖多订阅者解订、每个前向失败点、逆序回滚、回滚失败、最大化恢复和并发点击；通过 TypeScript、ESLint、Node 与 Rust 检查。若主分支已有无关失败，须单独记录基线。
