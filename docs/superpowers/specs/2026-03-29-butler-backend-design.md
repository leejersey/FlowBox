# Butler 后端能力设计

**日期：** 2026-03-29

## 目标

在不改现有 Butler 对话 UI 的前提下，补齐真实后台能力，替换当前 mock 回复，并让快捷动作、截图分析、复制/优化/重新生成进入可用状态。

## 现状

- 对话 UI 已在 [ButlerOverlay.tsx](/Users/lizexi/Documents/AI/AiCode/FlowBox/src/components/layout/ButlerOverlay.tsx) 实现。
- 消息持久化 store 已存在，但只保存消息、模型名和 prompt 模板。
- AI 能力目前只覆盖语音摘要和剪贴板分类，没有通用对话接口。
- `handleSend()` 仍使用 `setTimeout` 返回模拟回复。
- 剪贴板历史已支持图片持久化，具备“分析最近截图”的数据基础。

## 方案

### 1. 前端主控，服务层封装

保持 Butler 为前端驱动：

- `ButlerOverlay` 负责交互与渲染
- `butlerStore` 负责消息、加载态、最近请求上下文
- `butlerService` 负责组装请求、调用 AI、处理截图分析和消息操作
- `aiService` 扩展为通用聊天入口

不新增 Rust Butler 命令。当前能力完全可以在前端服务层闭环，成本更低，也更符合项目现有 AI 服务模式。

### 2. 对话与快捷动作

Butler 发送消息时按两种路径执行：

- 普通输入：直接调用通用聊天接口
- 快捷动作：把预设前缀与用户输入组合后调用聊天接口

快捷动作保留现有五项：

- 润色文本
- 翻译
- 摘要
- 修复代码
- 分析截图

其中“分析截图”不走纯文本链路，而是读取最近一张剪贴板图片，调用带图片输入的聊天接口。

### 3. 图片分析策略

优先复用剪贴板历史表中的最新图片记录：

- 查询 `clipboard_items`
- 取最近一条 `content_type = image`
- 使用图片路径构造模型输入

失败场景明确处理：

- 没有最近图片：提示“没有最近截图可分析”
- 未配置 API Key：提示需要配置
- 当前 provider/model 不支持图片：提示切换到支持图片的模型
- 图片文件不存在：提示重新复制图片

### 4. 消息操作

AI 回复气泡下的操作补齐为真实能力：

- 复制：复制当前回复内容到系统剪贴板
- 优化：将当前回复作为输入，再次调用“润色文本”
- 重新生成：基于最近一次请求上下文重新请求

“重新生成”以最后一次用户请求为单位，不按某一条 assistant 消息单独追溯。

### 5. 状态设计

`butlerStore` 增加：

- `isLoading`
- `lastRequest`

`lastRequest` 至少包含：

- 原始用户输入
- 快捷动作类型
- 是否截图分析

用于支持重新生成。

### 6. 错误处理

Butler 不再返回假回复。所有失败都以明确错误提示处理：

- UI 中停止 loading
- Toast 展示错误原因
- 不写入假的 assistant 消息

### 7. 测试策略

先补行为测试，再写实现：

- `ButlerOverlay` 不应再使用模拟回复
- `butlerService` 应能组装快捷动作 prompt
- `butlerService` 分析截图时应读取最近图片
- `ButlerOverlay` 应调用 service 发送请求

## 不在本次范围

- Prompt 模板下拉的真实配置化
- 多轮上下文裁剪策略
- 流式输出
- Tauri 原生 Butler 命令
- AI 自动执行待办/灵感/番茄钟等业务动作
