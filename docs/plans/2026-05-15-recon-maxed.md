# Recon Maxed Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 仅修改远勘智能体，将远勘工作台提升为更专业、更可信、并带适量未来感的高完成度研判系统。

**Architecture:** 继续以 `src/components/PentestPanel.tsx` 为唯一主修改点，在不改动其他模块的前提下，重构远勘结果的展示层、折叠层级、状态反馈与高级 UI 细节。先增强信息架构和交互分层，再补视觉和验证。

**Tech Stack:** React, TypeScript, Tailwind, existing Tauri invoke/listen flow, existing AI runtime

---

### Task 1: 提炼高完成度工作台基础块

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Read: `docs/plans/2026-05-15-recon-maxed-design.md`

**Step 1: 写最小失败检查**

- 目标：确认当前 `PentestPanel` 虽已统一外壳，但缺少更高级的状态条、折叠卡、结果分层块。

**Step 2: 提炼通用渲染块**

- 在 `PentestPanel.tsx` 内新增或增强以下渲染辅助：
  - 状态摘要条
  - 折叠/展开卡
  - 结果分层卡
  - 结构化信息块

**Step 3: 对齐视觉细节**

- 统一 hover、focus、selected、loading 等微交互
- 保持仅改远勘智能体，不碰别的模块

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 2: 强化公网远勘的摘要层与依据层

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Read: `src/lib/webRecon.ts`

**Step 1: 写最小失败检查**

- 目标：确认公网远勘当前仍偏“结果卡列表”，还不够像专业研判流。

**Step 2: 升级逐目标卡片**

- 将逐目标卡升级为：
  - 目标摘要头
  - 4 宫格结论区
  - 操作条
  - 可展开依据区

**Step 3: 升级重点目标区**

- 让重点目标区固定分为：
  - 结论块
  - 依据块
  - 下一步动作块

**Step 4: 下沉原始层**

- 将技术细节、报告草稿与其他较长内容进一步后置

**Step 5: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 3: 强化深度远勘的专业研判体验

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认深度远勘当前仍偏“输入区 + 聊天区 + 报告区”平铺，不够像专业分析台。

**Step 2: 重构右侧信息层级**

- 将右侧阅读区调整为：
  - 结构化结论
  - 依据与发现
  - 对话过程
  - 报告草稿

**Step 3: 为 AI 结论增加可信结构**

- 把 AI 输出放进固定语义块：
  - 重点结论
  - 核心依据
  - 可调证信息
  - 后续建议

**Step 4: 优化追问区和状态区**

- 让继续追问、停止、导出等动作更像工作台控制区，而不是散按钮

**Step 5: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 4: 收口内网扫描的总览体验

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认内网扫描当前结构化结果仍偏表格导向，首页摘要不够强。

**Step 2: 强化首页摘要层**

- 增加连接状态、上传状态、运行状态、结果概览摘要

**Step 3: 下沉详细层**

- 让表格和原始输出更明确地下沉到后续卡片

**Step 4: 运行诊断**

- 使用 `GetDiagnostics` 检查 `src/components/PentestPanel.tsx`
- 期望：无 TypeScript 诊断错误

### Task 5: 统一状态反馈与视觉完成度

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认当前的消息、空态、成功态、运行态还不够高级和统一。

**Step 2: 统一页面级状态表达**

- 调整 Hero 状态、局部状态条、全局通知条的风格和层级

**Step 3: 增加未来感但保持克制**

- 加入少量更高级的光效、高亮、边框、阴影、状态脉冲
- 不让视觉装饰影响阅读效率

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

- 仅远勘智能体页面发生变化
- 公网远勘仍可执行、选中目标、带入深度远勘
- 深度远勘仍可开始、追问、停止、导出
- 内网扫描仍可连接、上传、执行
- 结果展示层级比之前更清晰、更专业

