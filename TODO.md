# FUXI-Server-Forensics 优化与重构计划

## 1. 架构重构 (Architecture Refactoring)
当前 `AgentPanel.tsx` 承担了过多的职责（UI、状态管理、工具执行、AI 交互），导致代码难以维护且扩展性差。

- [ ] **提取工具执行逻辑 (`ToolManager`)**
  - 创建 `src/lib/ai/ToolManager.ts`。
  - 将 `run_shell_command`、`jadx_*` 等工具的执行逻辑从组件中剥离。
  - 实现工具的动态注册机制，允许插件 (`src/plugins/`) 导出自己的 AI 工具。

- [ ] **统一插件接口 (`Unified Plugin Interface`)**
  - 扩展 `src/plugins/types.ts`，增加 `AiTool` 定义。
  - 使现有的 `PluginCommand` (UI 按钮) 与 AI 工具 (Function Calling) 能够复用底层逻辑。

- [ ] **状态管理优化**
  - 使用 Context 或 Zustand 管理全局 Agent 状态（如当前运行的任务、历史记录），避免 `AgentPanel` props 层级过深。

## 2. JADX-MCP 深度集成 (Deep Integration)
目前的集成方式是基于简单的命令行调用，缺乏交互性和持久化管理。

- [ ] **JADX 服务化管理 (`JadxService`)**
  - 在前端或 Tauri 后端实现一个 `JadxService`，负责管理 `jadx-mcp-server` 进程的生命周期（启动、停止、重启）。
  - 实现健康检查，确保分析时服务可用。

- [ ] **Artifacts UI (分析结果可视化)**
  - **现状**: 代码和分析结果直接以文本形式堆积在聊天窗口。
  - **方案**: 引入 "Artifacts" 概念。当 JADX 返回 Java 源码或 Manifest 时，在右侧面板（或弹窗）中以语法高亮的编辑器形式展示，而不是挤在对话框中。

- [ ] **自动化分析剧本 (Playbooks)**
  - 创建 "Java 分析预设模式"。
  - 一键执行标准流程：`Load JAR` -> `Check Manifest` -> `Scan for Hardcoded Secrets` -> `Find Vulnerable Dependencies`。
  - 减少用户需要手动输入 "请分析这个..." 的重复操作。

## 3. 后端与安全 (Backend & Security)
`exec_local_command` 提供了强大的能力，但也带来了安全风险。

- [ ] **安全加固**
  - 为 `exec_local_command` 添加**白名单机制**或**确认弹窗**（对于敏感操作）。
  - 记录所有本地命令执行日志到审计文件。

- [ ] **异步任务管理**
  - 对于大型 JAR 包的分析，可能会导致前端卡顿。
  - 在 Rust 后端实现异步命令执行，通过 Tauri Event (`emit`) 推送进度和结果，而不是 `await` 等待整个过程。

## 4. 用户体验 (UX Improvements)

- [ ] **拖拽分析**
  - 允许用户直接将 JAR/APK 文件拖入 `AgentPanel`，自动触发 JADX 分析流程。

- [ ] **上下文感知**
  - 当用户切换到 "Java" 问题类型时，自动检查 JADX Server 状态，如果未启动则提示一键启动。

## 5. 代码质量 (Code Quality)

- [ ] **TypeScript 类型补全**
  - 完善 `AgentPanel` 中 `any` 类型的使用，特别是 `tool_calls` 和 `args` 的解析部分。
- [ ] **错误处理**
  - 统一 AI 调用失败、工具执行失败、网络超时的错误提示 UI。
