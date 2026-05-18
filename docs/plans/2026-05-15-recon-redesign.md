# Recon Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构远程勘查板块为更轻量的公网远勘与独立深度远勘智能体，并保持内网扫描与其他模块不受影响。

**Architecture:** 以 `PentestPanel.tsx` 为主入口，仅重构远勘板块内部视图和状态；公网远勘继续复用现有 `web_recon_batch` 数据链路，深度远勘新建独立 AI 会话与专属提示词，不复用 `GeneralAgent`。优先做最小隔离实现，必要时新增少量辅助状态或子组件，但不改动服务器取证和通用智能体。

**Tech Stack:** React, TypeScript, Tauri invoke/event, existing AI runtime (`sendToAI`, `runConversationLoop`)

---

### Task 1: 重构模式与命名

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 写最小失败检查**

- 目标：确认文件中仍存在 `CTF / Lab`、`题目类型`、`自动打题` 等旧语义入口。

**Step 2: 替换模式枚举与标题**

- 将 `ctf` 模式重命名为 `deep`
- 顶部标签更新为 `公网远勘`、`深度远勘`、`内网扫描`
- 深度远勘页面不再出现 `CTF`、`Lab`、`flag`、`题目类型`

**Step 3: 运行诊断**

- 使用编辑器诊断确认无类型错误

### Task 2: 精简公网远勘界面

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 收敛输入区**

- 保留目标网址输入
- 新增侦查备注与采集深度
- 将次要参数折叠为简洁选项

**Step 2: 收敛结果区**

- 删除高密度指标卡和大段说明
- 改为摘要卡 + 逐目标分析卡
- 默认只突出首个重点目标

**Step 3: 保留导出**

- 保留 Markdown / JSON 导出
- 保留复制报告能力

### Task 3: 优化公网远勘逐目标分析

**Files:**
- Modify: `src/lib/webRecon.ts`
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 调整目标分析模板**

- 为每个目标生成固定的 6 段结论：
  - 网站用途判断
  - 技术架构画像
  - 重点风险方向
  - 可调证线索
  - 同源拓线建议
  - 人工核验建议

**Step 2: 调整总报告摘要**

- 保留全局摘要
- 重点突出单目标研判内容

**Step 3: 在页面中以卡片方式展示**

- 页面展示与导出模板保持一致心智

### Task 4: 新增独立深度远勘智能体

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Modify: `src/lib/webRecon.ts` (如需复用提示词或报告拼装辅助函数)
- Read: `src/lib/ai.ts`
- Read: `src/lib/aiRuntime.ts`

**Step 1: 新建深度远勘输入模型**

- 目标网址 / 域名
- 案件说明
- 已知线索
- 补充证据
- 侦查重点

**Step 2: 新建独立会话状态**

- 独立消息数组
- 独立 loading / status / abort 控制
- 独立报告文本

**Step 3: 接入 AI 运行时**

- 通过 `runConversationLoop` 发起对话
- 使用专属系统约束和上下文
- 初期不对接 `GeneralAgent`

**Step 4: 结果结构化展示**

- 重点发现
- 数据库 / 泄露信息线索
- 嫌疑人关联信息
- 后台与站点控制研判
- 可调证信息
- 后续侦查建议

### Task 5: 校验隔离边界

**Files:**
- Modify: `src/components/PentestPanel.tsx`

**Step 1: 删除旧耦合**

- 去掉 `PENDING_GENERAL_AGENT_INPUT_KEY`
- 去掉打开 `agent-general` 的逻辑
- 去掉深度远勘写入通用工作区记录的耦合

**Step 2: 保持内网扫描不变**

- 不修改其底层执行逻辑
- 仅确保 UI 切换不影响现有功能

### Task 6: 验证

**Files:**
- Modify: `src/components/PentestPanel.tsx`
- Modify: `src/lib/webRecon.ts`

**Step 1: 运行类型/诊断检查**

- 使用 `GetDiagnostics` 检查改动文件

**Step 2: 如有需要执行构建**

- 运行项目已有的构建或校验命令

**Step 3: 人工回归**

- 检查远勘视图切换
- 检查公网远勘报告生成
- 检查深度远勘独立智能体发送消息
- 检查内网扫描页面仍可进入
