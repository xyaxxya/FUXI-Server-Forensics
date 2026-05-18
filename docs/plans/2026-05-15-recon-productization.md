# Recon Productization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 仅修改远勘智能体，将输入体验、交互完成度和报告成品感一起提升到更成熟的产品级状态。

**Architecture:** 继续以 `src/components/PentestPanel.tsx` 为主要落点，不扩散到其他模块。优先重构输入区、结果卡、报告块和状态反馈，再通过少量远勘专用 helper 与测试保证结构可回归。

**Tech Stack:** React, TypeScript, Tailwind, existing Tauri invoke/listen flow, existing AI runtime, Node test

---

### Task 1: 提炼产品化展示基础块

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Modify: `src/lib/reconWorkspace.ts`
- Test: `scripts/recon-workspace.test.mjs`

**Step 1: 写失败测试**

- 为远勘展示 helper 增加一个与成品化展示相关的最小测试，例如报告段落或状态分层的稳定输出。

**Step 2: 验证失败**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: FAIL，且失败点落在新增 helper 尚未实现

**Step 3: 最小实现**

- 在远勘专用 helper 中补足成品化展示所需的结构数据

**Step 4: 验证通过**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: PASS

### Task 2: 优化公网远勘的输入体验与成品阅读

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认公网远勘输入区和报告区仍偏“能用”，但还不够像成品工作台。

**Step 2: 优化输入区**

- 增加输入辅助信息、数量感知、主动作聚焦
- 让备注、采集深度、开始动作之间关系更清晰

**Step 3: 优化结果区**

- 强化逐目标卡的选中态和操作层级
- 让重点目标区更像正式研判摘要块

**Step 4: 优化报告成品感**

- 将报告预览改得更像正式研判稿阅读块

**Step 5: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 3: 优化深度远勘的录入与研判工作台

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Modify: `src/lib/reconWorkspace.ts`
- Test: `scripts/recon-workspace.test.mjs`

**Step 1: 写失败测试**

- 为深度远勘成品化报告或结构化区块增加最小失败测试

**Step 2: 验证失败**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: FAIL

**Step 3: 最小实现**

- 优化左侧录入区的分组与说明
- 优化右侧结论块、对话块和报告块的层级
- 强化继续追问和主控制区的专业感

**Step 4: 验证通过**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: PASS

**Step 5: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 4: 优化内网扫描的流程感与结果摘要

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认内网扫描虽然已有摘要层，但连接、上传、执行的流程感仍可更强。

**Step 2: 重排流程提示**

- 更明确地标出连接前提、上传前提、执行前提
- 让首页更像操作链，而不是若干功能块并列

**Step 3: 强化摘要成品感**

- 让扫描摘要更像正式总览结论
- 保持端口和原始输出后置

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 5: 统一微交互与系统反馈

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认当前选中态、折叠态、反馈态仍不够成品级统一。

**Step 2: 优化交互完成度**

- 增强卡片选中态
- 增强折叠区展开感
- 增强局部状态和全局消息的一致性

**Step 3: 视觉收口**

- 加少量专业感过渡和高亮，不做花哨动画
- 保持未来感但不影响阅读

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 6: 验证

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Modify: `src/lib/reconWorkspace.ts`
- Test: `scripts/recon-workspace.test.mjs`

**Step 1: 运行测试**

Run: `node --test scripts/recon-workspace.test.mjs`
Expected: PASS

**Step 2: 编辑器诊断**

Run: 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx` 与 `src/lib/reconWorkspace.ts`
Expected: 无诊断错误

**Step 3: 运行构建**

Run: `npm run build`
Expected: 构建通过

**Step 4: 人工回归**

- 仅远勘智能体变化
- 公网远勘输入、执行、结果、报告链路正常
- 深度远勘开始、追问、停止、导出正常
- 内网扫描连接、上传、执行、摘要显示正常

