# Web Recon Infrastructure Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 增强公网远勘基础设施画像，让输入网址后能展示 IP、CDN/云厂商和归属地等办案可用信息。

**Architecture:** 在 `src/lib/webRecon.ts` 增加前端画像 helper，基于现有 resolvedIps、DNS、RDAP、架构信息生成统一 `WebReconInfrastructureInsight`。在 `PentestPanel.tsx` 的目标队列和重点详情中展示该画像。后端查询能力后续可接入统一字段，不破坏现有数据链路。

**Tech Stack:** TypeScript, React, Node test, Vite.

---

### Task 1: Infrastructure insight helper

**Files:**
- Modify: `src/lib/webRecon.ts`
- Modify: `scripts/recon-workspace.test.mjs` or create targeted test script if needed

**Steps:**
1. 写失败测试：京东云 IP 示例应输出云厂商与属地提示。
2. 写失败测试：Cloudflare DNS/CDN 特征应识别 CDN。
3. 实现 `buildWebReconInfrastructureInsight`。
4. 运行测试确认通过。

### Task 2: UI integration

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Steps:**
1. 引入 helper。
2. 优先目标队列显示主 IP、CDN 状态、厂商。
3. 重点目标轻详情显示基础设施画像。
4. 将画像加入深度远勘带入线索。

### Task 3: Verification

**Commands:**
- `node --test scripts/recon-workspace.test.mjs`
- `npm run build`

**Expected:**
- Tests pass
- Diagnostics clean
- Build passes
