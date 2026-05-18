# Recon Lightweight Details Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 轻量化公网重点详情与深度远勘结果区，让远勘结果更实用、更好读。

**Architecture:** 保留现有数据与 helper，只调整 `PentestPanel.tsx` 展示层级。公网重点详情改为三行式摘要，深度远勘把对话与报告默认后置折叠。

**Tech Stack:** React, TypeScript, Vite.

---

### Task 1: Public focused target details

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Steps:**
1. 将重点目标大卡片改成轻详情。
2. 保留结论、依据、动作三条主信息。
3. 将站点类型、业务画像、IP、风险分压缩为元信息条。
4. 保留带入深度远勘按钮。

### Task 2: Deep result hierarchy

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Steps:**
1. 将结构化结论改成更聚焦的最终结论区。
2. 对话记录默认折叠。
3. 报告草稿默认折叠。
4. 保持导出和追问能力。

### Task 3: Verification

**Commands:**
- `node --test scripts/recon-workspace.test.mjs`
- `npm run build`

**Expected:**
- Tests pass
- Diagnostics clean
- Build passes
