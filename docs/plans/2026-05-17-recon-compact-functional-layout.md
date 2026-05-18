# Recon Compact Functional Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将远勘智能体从介绍/标签占主导的界面改为强压缩、结果优先、功能优先的工作台布局。

**Architecture:** 主要修改 `src/components/PentestPanel.tsx` 的公网远勘和深度远勘渲染结构。新增紧凑 UI helper 替代大 Hero、大任务台和大状态卡，同时保持现有数据流、远勘命令、报告导出、深度远勘会话逻辑不变。

**Tech Stack:** React, TypeScript, Tailwind CSS, Vite, Tauri command integration.

---

### Task 1: 建立紧凑布局 helper

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 添加紧凑操作栏 helper**

在 `renderWorkspaceHero` 附近新增一个 `renderCompactToolbar` helper，用于显示模式名、状态、输入控件和右侧动作按钮。

**Step 2: 添加薄信息行 helper**

新增 `renderCompactInsightRow` 或等价 helper，用于替代重点目标详情中的多张 `renderStatusBanner`。

**Step 3: 添加紧凑行动条 helper**

将 `renderTaskDesk` 的视觉压缩为单行或双行操作条，保留核心结论和主按钮，删除 eyebrow、大标题、大段说明和重复状态标签。

**Step 4: 运行诊断**

Run: `npm run build`
Expected: TypeScript/Vite build succeeds.

---

### Task 2: 重构公网远勘布局

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 移除公网大 Hero**

在 `renderPublicRecon` 中移除 `renderWorkspaceHero` 调用。

**Step 2: 合并任务输入和执行控制**

把原来的“任务输入”和“执行控制”两张大卡合并为一条紧凑操作栏：
- 目标 textarea 保留但高度降低
- 案件备注放入 details
- 深度选择压缩为小型 select
- 开始、停止、导出、带入深度远勘集中在右侧或下方紧凑按钮组

**Step 3: 结果优先展示**

结果存在时优先展示：
- 优先目标队列
- 重点目标详情

过程轨迹、批量摘要、报告草稿全部放到折叠区。

**Step 4: 空状态压缩**

没有结果时只展示一个小型空状态，不展示长说明和多标签。

**Step 5: 运行测试**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: all tests pass.

---

### Task 3: 重构深度远勘布局

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 移除深度远勘大 Hero**

在 `renderDeepRecon` 中移除 `renderWorkspaceHero` 调用。

**Step 2: 将深度远勘任务台压缩为操作栏**

顶部只保留：
- 目标输入
- 开始/停止/导出
- 当前状态短文本

**Step 3: 结构化结论提前**

默认优先展示结构化结论，继续追问输入紧随其后。

**Step 4: 材料和过程折叠**

把侦查输入、证据池、智能体过程、对话记录、报告草稿全部放入折叠区。

**Step 5: 运行构建**

Run: `npm run build`
Expected: build succeeds.

---

### Task 4: 清理冗余视觉和验证

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 清理未使用 helper 或 import**

移除公网和深度远勘不再使用的大型 helper 依赖，若内网扫描仍使用则保留。

**Step 2: 获取诊断**

Run diagnostics for `src/components/PentestPanel.tsx`.
Expected: no TypeScript diagnostics caused by this change.

**Step 3: 运行最终测试**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: all tests pass.

**Step 4: 运行最终构建**

Run: `npm run build`
Expected: build succeeds. Existing bundle-size warnings are acceptable if no new errors appear.
