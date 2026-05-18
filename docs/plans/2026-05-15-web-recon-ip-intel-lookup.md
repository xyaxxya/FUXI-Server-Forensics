# Web Recon IP Intelligence Lookup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为公网远勘接入 IP 归属地/ASN/ISP 联网查询，让输入网址后能真实展示云厂商和属地。

**Architecture:** 后端 `recon.rs` 在解析 IP 后调用 IP intelligence 查询接口，写入 `ipIntelligence` 字段；前端 `webRecon.ts` 类型与画像 helper 优先消费该字段，UI 保持当前基础设施画像展示。

**Tech Stack:** Rust, reqwest, serde, TypeScript, React, Node test, Vite.

---

### Task 1: Backend IP intelligence field

**Files:**
- Modify: `src-tauri/src/recon.rs`

**Steps:**
1. 新增 `WebReconIpIntelligence` struct。
2. 给 `WebReconTargetReport` 增加 `ip_intelligence` 字段。
3. 初始化 report 时填空数组。

### Task 2: Backend lookup function

**Files:**
- Modify: `src-tauri/src/recon.rs`

**Steps:**
1. 新增 ip-api response struct。
2. 新增 `lookup_ip_intelligence`。
3. 对每个 resolved IP 查询，失败时返回 error 字段。
4. 在 resolved_ips 设置后写入 `report.ip_intelligence`。

### Task 3: Frontend types and helper

**Files:**
- Modify: `src/lib/webRecon.ts`
- Modify: `scripts/recon-workspace.test.mjs`

**Steps:**
1. 增加 `WebReconIpIntelligence` 类型。
2. `WebReconTargetReport` 增加 `ipIntelligence`。
3. 测试 ipIntelligence 优先级。
4. 修改 `buildWebReconInfrastructureInsight` 优先使用查询结果。

### Task 4: Verification

**Commands:**
- `node --test scripts/recon-workspace.test.mjs`
- `npm run build`
- `cargo check` or `npm run tauri build` 可用时运行较轻验证

**Expected:**
- Tests pass
- Diagnostics clean
- Build passes
