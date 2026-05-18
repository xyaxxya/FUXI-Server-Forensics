# Recon Task Desk Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将远勘智能体首屏收敛为任务台，让用户一眼知道当前该做什么。

**Architecture:** 在 `reconWorkspace.ts` 增加任务台动作 helper，在 `PentestPanel.tsx` 复用统一任务台组件渲染公网远勘和深度远勘首屏。保留现有数据链路与 Agent 过程，只调整展示层级。

**Tech Stack:** React, TypeScript, Tauri, Node test, esbuild.

---

### Task 1: Task desk helper

**Files:**
- Modify: `scripts/recon-workspace.test.mjs`
- Modify: `src/lib/reconWorkspace.ts`

**Steps:**
1. 为 `buildTaskDeskAction` 写失败测试。
2. 运行 `node --test scripts/recon-workspace.test.mjs` 确认失败。
3. 实现 helper。
4. 重新运行测试确认通过。

### Task 2: Public recon task desk

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Steps:**
1. 引入 `buildTaskDeskAction` 类型与函数。
2. 基于公网远勘状态生成 `publicTaskDeskAction`。
3. 新增统一 `renderTaskDesk`。
4. 用任务台替代公网首屏行动卡和过程卡平铺。
5. 将过程轨迹放入折叠区。

### Task 3: Deep recon task desk

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Steps:**
1. 基于深度远勘状态生成 `deepTaskDeskAction`。
2. 用任务台替代深度远勘首屏行动卡。
3. 将智能体过程轨迹默认折叠。
4. 保持结构化结论作为主阅读区。

### Task 4: Verification

**Commands:**
- `node --test scripts/recon-workspace.test.mjs`
- `npm run build`

**Expected:**
- Tests pass
- Diagnostics clean
- Build passes
