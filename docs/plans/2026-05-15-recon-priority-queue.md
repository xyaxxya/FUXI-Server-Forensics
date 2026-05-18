# Recon Priority Queue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将公网远勘结果收敛为优先目标队列，提升实用性和阅读爽感。

**Architecture:** 在 `reconWorkspace.ts` 增加优先级队列 helper，在 `PentestPanel.tsx` 中替换原有逐目标大卡片展示。保留任务台、重点目标详情、技术细节和报告区。

**Tech Stack:** React, TypeScript, Node test, Vite.

---

### Task 1: Priority queue helper

**Files:**
- Modify: `scripts/recon-workspace.test.mjs`
- Modify: `src/lib/reconWorkspace.ts`

**Steps:**
1. 为 `buildPriorityQueueLabel` 写失败测试。
2. 运行 `node --test scripts/recon-workspace.test.mjs` 确认失败。
3. 实现 helper。
4. 重新运行测试确认通过。

### Task 2: Public result queue UI

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Steps:**
1. 引入 `buildPriorityQueueLabel`。
2. 增加目标队列渲染。
3. 删除公网结果中的独立研判概览强卡片。
4. 将逐目标大卡片替换为紧凑队列行。

### Task 3: Verification

**Commands:**
- `node --test scripts/recon-workspace.test.mjs`
- `npm run build`

**Expected:**
- Tests pass
- Diagnostics clean
- Build passes
