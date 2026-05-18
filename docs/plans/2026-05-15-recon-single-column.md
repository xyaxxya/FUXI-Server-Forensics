# Recon Single Column Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 仅修改远勘智能体，将结果区收敛为主内容单列，解决最终结果界面放不下的问题。

**Architecture:** 继续以 `src/components/PentestPanel.tsx` 为主修改点，通过重排公网远勘和深度远勘的渲染顺序、压缩并排区域、增强折叠和高度约束来降低空间压力。只保留必要的辅助 helper，不影响其他模块。

**Tech Stack:** React, TypeScript, Tailwind, existing Tauri invoke/listen flow, Node test

---

### Task 1: 提炼结果区单列布局 helper

**Files:**
- Modify: `src/lib/reconWorkspace.ts`
- Test: `scripts/recon-workspace.test.mjs`

**Step 1: 写失败测试**

- 为报告预览或结果布局新增一个能体现“内容过长时退回单列”的最小测试

**Step 2: 验证失败**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: FAIL

**Step 3: 最小实现**

- 在 `src/lib/reconWorkspace.ts` 中新增对应 helper

**Step 4: 验证通过**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: PASS

### Task 2: 重排公网远勘结果区

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认公网远勘当前的详情区与结果区并排，导致内容拥挤

**Step 2: 改为单列阅读流**

- 概览在前
- 逐目标列表在中
- 当前选中目标详情下沉到列表下方
- 技术细节继续下沉
- 报告区保留在底部

**Step 3: 收紧技术细节**

- 默认更克制
- 优先使用折叠和单列信息块

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无错误

### Task 3: 重排深度远勘结果区

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认深度远勘当前左右双栏在长内容场景下过于拥挤

**Step 2: 改为单列工作流**

- 输入区放在最前
- 工作重点下沉在输入后
- 结构化结论、对话、报告按顺序排开

**Step 3: 控制长内容高度**

- 对话区和报告区保留明确的滚动高度
- 避免页面无限拉长但仍保证主结果宽度充足

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无错误

### Task 4: 收口报告预览和整体密度

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Modify: `src/lib/reconWorkspace.ts`
- Test: `scripts/recon-workspace.test.mjs`

**Step 1: 写失败测试**

- 为报告预览相关 helper 增加最小失败测试

**Step 2: 验证失败**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: FAIL

**Step 3: 最小实现**

- 调整报告预览布局，让长内容更偏向单列
- 收紧部分栅格密度，减少结果区横向挤压

**Step 4: 验证通过**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: PASS

### Task 5: 验证

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Modify: `src/lib/reconWorkspace.ts`
- Test: `scripts/recon-workspace.test.mjs`

**Step 1: 运行测试**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: PASS

**Step 2: 编辑器诊断**

Run: 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx` 和 `src/lib/reconWorkspace.ts`
Expected: 无诊断错误

**Step 3: 运行构建**

Run: `npm run build`
Expected: 构建通过

**Step 4: 人工回归**

- 仅远勘智能体发生变化
- 公网远勘结果区更容易完整显示
- 深度远勘结果区更容易完整显示
- 报告区不再挤占主要阅读层

