# Recon Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将远勘板块进一步打磨为统一、顺滑、低负担的成熟工作台体验，同时保持既有功能与模块边界不变。

**Architecture:** 继续以 `src/components/PentestPanel.tsx` 为主入口，不新增业务依赖，优先通过统一工作台头部、模式导航、主次内容区和状态反馈系统来收口三种模式的体验。先重构结构与通用渲染块，再细化各模式布局，最后跑诊断与构建验证。

**Tech Stack:** React, TypeScript, existing Tauri invoke/event flow, current AI runtime

---

### Task 1: 统一工作台外壳

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Read: `docs/plans/2026-05-15-recon-polish-design.md`

**Step 1: 写最小失败检查**

- 目标：确认当前 `PentestPanel.tsx` 中三种模式仍各自维护不同的头部与布局骨架，尚未形成统一工作台外壳。

**Step 2: 整理通用头部与导航数据**

- 提炼统一的页面头部信息结构：
  - 标题
  - 副标题
  - 状态摘要
  - 主动作区
- 将 `公网远勘 / 深度远勘 / 内网扫描` 的导航配置整理成统一的数据驱动结构。

**Step 3: 重排外层骨架**

- 将 `PentestPanel.tsx` 外层调整为：
  - 统一工作台头部
  - 统一模式导航
  - 模式主内容区
  - 全局反馈区

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 2: 收口公网远勘工作流节奏

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Read: `src/lib/webRecon.ts`

**Step 1: 写最小失败检查**

- 目标：确认公网远勘第一页仍然同时堆叠输入、说明、进度、结果，节奏还不够稳定。

**Step 2: 重排主次区域**

- 第一屏只保留：
  - 模式定位
  - 目标输入
  - 采集深度
  - 开始远勘
  - 当前进度或概览
- 将技术细节与报告草稿下沉到次级区域。

**Step 3: 强化重点目标区**

- 让右侧重点目标卡更像主阅读区：
  - 结论优先
  - 技术细节次之
  - “带入深度远勘”保持高优先级动作

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 3: 收口深度远勘工作台结构

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认深度远勘仍更像“表单 + 对话堆叠”，还不够像专业工作台。

**Step 2: 统一左输右读布局**

- 左侧固定为：
  - 目标
  - 案件说明
  - 已知线索
  - 证据池
  - 侦查重点
  - 主操作按钮
- 右侧固定为：
  - 会话记录
  - 结构化结论
  - 报告草稿

**Step 3: 统一状态反馈**

- 深度远勘状态统一落在头部摘要或主状态块中
- 避免把状态散落在多个区域

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 4: 收口内网扫描的工作台语言

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认内网扫描虽然功能完整，但视觉上仍与前两者不像同一系统。

**Step 2: 重排第一屏**

- 第一屏聚焦：
  - 连接
  - 上传
  - 执行
- 结构化输出与原始输出放入次级区域。

**Step 3: 对齐卡片层级**

- 统一卡片外壳、标题层级、状态块和留白
- 保持其底层上传与执行逻辑不改

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 5: 统一状态、空态与反馈

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认 `message`、进度、空态、成功态的表达还不统一。

**Step 2: 统一状态块**

- 为三种模式统一：
  - 空状态文案
  - 运行中文案
  - 成功态摘要
  - 异常态反馈

**Step 3: 收口全局消息区**

- 保留全局 `message`
- 但提升为更稳定的系统通知样式，不破坏整体视觉节奏

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 6: 验证

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 编辑器诊断**

Run: 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
Expected: 无诊断错误

**Step 2: 运行构建**

Run: `npm run build`
Expected: 构建通过

**Step 3: 人工回归清单**

- 检查 `公网远勘 / 深度远勘 / 内网扫描` 三种模式切换
- 检查公网远勘仍可启动
- 检查重点目标仍可带入深度远勘
- 检查深度远勘仍可开始、追问、停止、导出
- 检查内网扫描连接、上传、执行区仍存在

