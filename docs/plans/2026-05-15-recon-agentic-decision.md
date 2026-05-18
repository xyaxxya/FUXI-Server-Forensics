# Recon Agentic Decision Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将远勘智能体从信息展示页升级为决策优先、过程可见的 Agent 工作台。

**Architecture:** 在远勘专属 helper 中生成行动建议和阶段轨迹，在 `PentestPanel` 中以行动卡与过程面板承载。保留现有远勘数据链路，只重排结果层级和展示方式。

**Tech Stack:** React, TypeScript, Tauri invoke/listen, Node test, esbuild.

---

### Task 1: Agentic helper tests

**Files:**
- Modify: `scripts/recon-workspace.test.mjs`
- Modify: `src/lib/reconWorkspace.ts`

**Steps:**
1. 为 `buildAgenticTrace` 写失败测试。
2. 为 `buildReconDecision` 写失败测试。
3. 运行 `node --test scripts/recon-workspace.test.mjs`，确认失败。
4. 实现 helper。
5. 再次运行测试确认通过。

### Task 2: Public recon decision-first UI

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Steps:**
1. 引入 helper 和图标。
2. 基于 `selectedTarget` 与 `reconInvestigationClues` 计算 `publicDecision`。
3. 基于采集进度生成 `publicAgentTrace`。
4. 增加 `renderDecisionCard` 和 `renderAgentTrace`。
5. 将公网远勘结果顺序改为行动卡、过程轨迹、折叠统计、目标结果、报告。

### Task 3: Deep recon agent process UI

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Steps:**
1. 基于输入、AI 运行状态和最终结论生成 `deepAgentTrace`。
2. 深度远勘顶部加入行动卡。
3. 将输入区收进折叠区域。
4. 保持结构化结论、对话、报告在主工作流中。

### Task 4: Verification

**Commands:**
- `node --test scripts/recon-workspace.test.mjs`
- `npm run build`

**Expected:**
- Tests pass
- Build passes
- `PentestPanel.tsx` and `reconWorkspace.ts` diagnostics are clean
