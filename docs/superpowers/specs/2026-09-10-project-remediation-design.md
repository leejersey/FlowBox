# FlowBox 全项目修复设计

## 目标

修复审计发现的全部正确性、安全性、质量、性能与文档问题，并补齐 README 已承诺但未落地的跨模块关联、开机自启动和 DeepSeek 截图 OCR。保持现有 React + Tauri + SQLite 架构，不做无关重构。

## 实施原则

- 分阶段交付，每阶段都能独立验证和回滚。
- 修复共享根因，不在每个调用方重复打补丁。
- 先写会失败的行为测试，再写最小实现。
- 优先使用浏览器、SQLite、Tauri 和 macOS 原生能力；仅安全存储、自启动等平台能力确有需要时增加依赖。
- 删除没有调用者、没有发布价值的代码和资产。

## 一、质量基线

### 脚本与检查

在 `package.json` 增加：

- `test`：执行 Node 行为测试。
- `check`：依次执行 TypeScript 构建、ESLint 和测试。
- `check:rust`：执行 Cargo check 与 test。

ESLint 仅扫描产品源码与配置，忽略 `.worktrees/**`、`src-tauri/target/**`、生成物和第三方代码。

增加 GitHub Actions，在 macOS runner 上执行 npm clean install、前端检查和 Rust 检查。macOS runner 是必要条件，因为 Rust 后端调用 macOS 系统 API。

### 测试策略

现有源码字符串断言可以保留少量架构守卫，但关键路径改为行为测试：

- 本地日期边界。
- 番茄钟状态转换。
- 每日回顾触发判断。
- 应用追踪时间结算。
- 设置到 Rust 后台状态的同步。
- OCR provider 分流。
- 跨模块关联 CRUD。

Rust 为纯逻辑提取小函数并写模块内单元测试，不引入额外测试框架。

## 二、核心数据正确性

### 番茄钟

新会话写入 `running`，停止后才写入 `completed` 或 `interrupted`。新增迁移把 `ended_at IS NULL AND actual_minutes IS NULL` 的历史伪 completed 记录修正为 `interrupted`，避免继续污染完成数。

计时状态仍由现有前端服务维护；本轮不新增跨进程持久化状态机。应用退出后，遗留的 `running` 会话在下次初始化时结算为 `interrupted`。

### 本地日期

新增一个小型日期工具，输出本地 `YYYY-MM-DD`、本地日界和本地周一，不再使用 `toISOString().slice(...)` 推导业务日期。所有统计、回顾、Trending、应用追踪和页面分组统一调用它。

数据库继续保存 ISO 时间戳；查询“今日”时使用明确的本地起止 ISO 时间范围，避免 SQLite `DATE()` 对带时区字符串的隐式解释。

### 每日回顾

把触发条件改为“当前本地分钟数大于等于目标分钟数，且今天未显示”，因此应用晚于设定时间启动仍会触发。提取纯函数测试跨小时和无效配置。

## 三、后台服务生命周期

### 统一启动同步

应用数据库就绪后读取设置并调用 Rust 命令恢复：

- `clipboard.auto_watch`，默认开启。
- `general.app_tracking`，默认关闭。

设置页切换时先调用对应 Rust 命令，成功后再持久化实际状态；失败时保持原 UI 值并提示错误。剪贴板页面只负责订阅和显示，不再负责全局设置初始化。

### 应用使用追踪

Rust tracker 改为固定周期上报增量，而不是只在应用切换时上报整段时间。每个 tick 最多记录一个轮询周期，避免退出、停用或长时间不切换造成整段丢失。切换应用时自然开始记录新应用；关闭追踪时不再产生增量。

数据库按 `(app_name, recorded_date, hour)` 原子 upsert，并增加唯一索引，删除“先查再更新”的竞态窗口。日期和小时由事件发生时的本地时间生成。

### 事件监听

所有异步 `listen()` effect 增加取消标记；若组件已卸载后监听才注册完成，立即调用返回的 unlisten，避免泄漏。

## 四、安全存储与 CSP

### Keychain

增加最小 Rust secret commands，使用 macOS Keychain 存取以下值：

- AI API Key。
- 火山引擎 AppID。
- 火山引擎 Access Token。

前端设置服务为敏感键提供专用 get/set，不把新值写入 SQLite。首次读取时若 Keychain 无值但 SQLite 有旧值，则写入 Keychain，确认成功后删除旧设置。UI 只显示掩码，不把已保存密钥重新放入普通文本状态。

当前产品仅声明支持 macOS，因此本轮不设计 Windows/Linux 凭据后端；未来跨平台发布时再扩展同一 Rust command 接口。

### CSP

移除没有运行需要的 `script-src 'unsafe-inline'`。保留 Tailwind/React 当前确需的内联样式权限。Google Fonts 加载失败时使用系统字体回退。

## 五、补齐承诺功能

### 跨模块关联

保留现有 `item_links` 表和 `linkService`，增加可复用的关联面板：

- 搜索 todo、idea、voice、clipboard。
- 创建规范化关系。
- 双向查询并展示。
- 删除关系。
- 点击结果跳转到对应模块并传递 highlight 参数。

关系在写入前按稳定顺序规范化两端，避免 A→B 与 B→A 重复。新增迁移清理已有反向重复并增加无向唯一约束所需的规范化字段或表达式索引。

关联面板接入 Todo 和 Idea 详情；Voice、Clipboard 当前没有独立详情页，因此在各自卡片操作区提供“关联”入口并复用同一面板。只实现现有四种实体，不增加抽象插件系统。

### 开机自启动

使用官方 Tauri autostart 插件。应用初始化读取插件真实状态回写 UI；切换成功后持久化设置。数据库值仅作用户偏好记录，插件真实状态为最终依据。

### DeepSeek 截图 OCR

OpenAI 路径继续直接发送图片给 Vision 模型。DeepSeek/Ollama 不假设支持图片输入：先通过 macOS Vision 框架做本地文字识别，再把识别文本交给当前文本模型整理标题、标签和 idea/todo 类型。

Rust 暴露 `ocr_recognize_text(image_path)`，仅允许读取应用截图/剪贴板图片目录内文件，拒绝任意路径。无文字时返回明确错误。前端 `recognizeScreenshot` 根据 provider 选择 OpenAI Vision 或本地 OCR + 文本模型。

## 六、前端质量和性能

- 修复全部 ESLint error/warning：Hook 依赖、render 期间 ref 写入、动态组件创建、无效 catch 参数和 `any`。
- 页面通过 `React.lazy` 路由级加载；公共壳、Toast 和 Butler 必需共享组件保持同步加载。
- 把 Google Fonts `@import` 移到样式文件顶部，消除构建警告。
- 不为消除 React lint 而创建额外状态管理层；能计算的状态直接计算。

目标：`npm run lint` 为 0 error / 0 warning，构建不再产生单个主 chunk 超限警告。

## 七、删除死代码

确认无调用后删除：

- 未路由且与设置页技能管理重复的 `src/pages/SkillsPage.tsx`。
- 未导入的 `src/App.css`。
- Vite/React 示例资产和未使用的 hero 图。
- `src-tauri/src/services/mod_placeholder.rs`。
- 未使用的 Rust models 与 errors 模块。
- 无调用且无依赖声明的 `remove_bg.py`。

`docs/ui_assets` 是设计参考，不属于运行时代码，本轮保留；后续若仓库体积成为问题再单独归档。

## 八、依赖、版本和文档

- 升级 React Router 到无已知 high/critical 漏洞的兼容版本。
- 增加官方 autostart 与 macOS Keychain/OCR 所需的最少依赖。
- 统一 npm、Cargo、Tauri 和 README 版本为 `0.5.0`。
- README 与实际行为保持一致，说明密钥进入 Keychain、DeepSeek 采用本地 OCR + 文本整理、跨模块关联入口和自启动实现。
- 更新 Roadmap，删除已经完成或互相矛盾的描述。

## 错误处理

- 后台设置同步失败必须回滚 UI，不静默伪装成功。
- 统计和核心数据写入失败显示 Toast，并保留可重试路径。
- 非关键 AI 分类、旧缓存清理仍允许失败降级，但记录开发日志。
- Keychain 迁移只有在安全写入成功后才删除 SQLite 旧值。
- OCR 明确区分“没有文本”“文件不可读”“模型整理失败”。

## 验收标准

1. `npm run check`、`npm run check:rust` 全部通过。
2. ESLint 0 error / 0 warning。
3. Rust 不再是 0 tests，关键纯逻辑有真实单元测试。
4. `npm audit --omit=dev` 无 high/critical。
5. 本地凌晨、周切换和每日回顾跨小时行为正确。
6. 新建番茄钟不是 completed，结束后状态和统计正确。
7. 重启后剪贴板、应用追踪、自启动状态与设置一致。
8. 持续停留单一应用仍周期性累计使用时间。
9. SQLite 中不存在 AI/ASR 明文密钥。
10. 四类实体可建立、反向查看、跳转和删除关联。
11. OpenAI 与 DeepSeek 均能完成截图 OCR 流程。
12. 生产构建无字体规则和主 chunk 超限警告。
13. 所有版本号与 README 一致。
