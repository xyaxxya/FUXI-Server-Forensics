# Recon Motion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 仅修改远勘智能体，为整体工作台补上克制专业的微交互与动画，并继续提升整体完成度。

**Architecture:** 继续以 `src/components/PentestPanel.tsx` 为主战场，通过 Tailwind 的 transition、transform、opacity、shadow 和少量 keyframes 完成模式切换、状态反馈、卡片选中、折叠展开和报告显现动效。保持低风险，不引入新依赖。

**Tech Stack:** React, TypeScript, Tailwind, existing Tauri invoke/listen flow, Node test

---

### Task 1: 提炼远勘动画基础样式

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Test: `scripts/recon-workspace.test.mjs`

**Step 1: 写最小失败测试**

- 为一个远勘展示 helper 增加最小测试，确保报告或结构区块数据仍稳定，避免在补动画时破坏展示结构。

**Step 2: 验证失败**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: FAIL

**Step 3: 最小实现**

- 补充或调整远勘展示 helper
- 在 `PentestPanel.tsx` 中抽出共用的过渡类或动画类使用点

**Step 4: 验证通过**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: PASS

### Task 2: 增强模式切换与页面区块过渡

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认三种模式切换和主要结果区块出现仍偏生硬。

**Step 2: 增加过渡**

- 模式切换加入轻微淡入和位移
- 主要区块加入更统一的显现节奏

**Step 3: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无错误

### Task 3: 增强卡片交互与状态反馈

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认逐目标卡、状态条、重点块仍有继续优化空间。

**Step 2: 增强交互**

- 强化 hover、selected、loading、success、warning 等状态过渡
- 为运行中和重点结论加入克制的视觉反馈

**Step 3: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无错误

### Task 4: 增强折叠展开与报告成品显现

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认当前折叠区与报告区虽然可用，但展开时不够顺滑。

**Step 2: 优化报告和折叠区**

- 增强分节预览块显现
- 增强 evidence/raw/report 折叠区的展开感

**Step 3: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无错误

### Task 5: 验证

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Test: `scripts/recon-workspace.test.mjs`

**Step 1: 运行测试**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: PASS

**Step 2: 编辑器诊断**

Run: 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
Expected: 无诊断错误

**Step 3: 运行构建**

Run: `npm run build`
Expected: 构建通过

**Step 4: 人工回归**

- 仅远勘智能体变化
- 模式切换更顺滑
- 卡片状态更成熟
- 报告区和折叠区更有成品感

