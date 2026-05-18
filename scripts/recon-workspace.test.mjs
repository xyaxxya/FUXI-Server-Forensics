import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { build } from "esbuild";

async function loadTsModule(tsFilePath) {
  const outfile = path.join(
    os.tmpdir(),
    `recon-workspace-test-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`
  );

  await build({
    entryPoints: [tsFilePath],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    sourcemap: false,
    write: true,
  });

  return import(`file:///${outfile.replace(/\\/g, "/")}`);
}

test("extractDeepReconSections splits analysis into conclusion, evidence, and next actions", async () => {
  const modulePath = path.resolve("src/lib/reconWorkspace.ts");
  const { extractDeepReconSections } = await loadTsModule(modulePath);

  const sections = extractDeepReconSections(`
## 重点结论
- 站点存在后台控制线索

## 核心依据
- 发现 /admin 与客服 ID

## 后续建议
- 优先调证支付与客服账号
`);

  assert.equal(sections.summary.title, "重点结论");
  assert.match(sections.summary.content, /后台控制线索/);
  assert.equal(sections.evidence.title, "核心依据");
  assert.match(sections.evidence.content, /客服 ID/);
  assert.equal(sections.nextSteps.title, "后续建议");
  assert.match(sections.nextSteps.content, /支付与客服账号/);
});

test("extractMarkdownSections preserves ordered report sections for productized previews", async () => {
  const modulePath = path.resolve("src/lib/reconWorkspace.ts");
  const { extractMarkdownSections } = await loadTsModule(modulePath);

  const sections = extractMarkdownSections(`
## 一、目标概况
站点为博彩仿盘。

## 二、可调证线索
客服ID、支付账号、证书同源域名。

## 三、后续建议
先调证支付渠道，再顺证书拓线。
`);

  assert.equal(sections.length, 3);
  assert.equal(sections[0].title, "一、目标概况");
  assert.match(sections[1].content, /客服ID/);
  assert.equal(sections[2].title, "三、后续建议");
});

test("buildRevealMotion returns capped stagger timings for restrained motion", async () => {
  const modulePath = path.resolve("src/lib/reconWorkspace.ts");
  const { buildRevealMotion } = await loadTsModule(modulePath);

  assert.deepEqual(buildRevealMotion(0), { delayMs: 0, durationMs: 280 });
  assert.deepEqual(buildRevealMotion(2), { delayMs: 100, durationMs: 280 });
  assert.deepEqual(buildRevealMotion(99), { delayMs: 240, durationMs: 280 });
});

test("getReportPreviewColumnCount falls back to single column for long sections", async () => {
  const modulePath = path.resolve("src/lib/reconWorkspace.ts");
  const { getReportPreviewColumnCount } = await loadTsModule(modulePath);

  assert.equal(getReportPreviewColumnCount([{ title: "短", content: "短内容" }]), 1);
  assert.equal(getReportPreviewColumnCount([{ title: "长", content: "x".repeat(320) }]), 1);
  assert.equal(getReportPreviewColumnCount([
    { title: "A", content: "短" },
    { title: "B", content: "x".repeat(120) },
    { title: "C", content: "x".repeat(120) },
  ]), 1);
});

test("buildAgenticTrace marks previous steps done and current step active", async () => {
  const modulePath = path.resolve("src/lib/reconWorkspace.ts");
  const { buildAgenticTrace } = await loadTsModule(modulePath);

  const trace = buildAgenticTrace([
    { id: "context", title: "收集上下文", detail: "采集公开信息" },
    { id: "analyze", title: "研判线索", detail: "归纳风险与调证点" },
    { id: "verify", title: "核验建议", detail: "生成后续动作" },
  ], 1);

  assert.equal(trace[0].status, "done");
  assert.equal(trace[1].status, "active");
  assert.equal(trace[2].status, "pending");
});

test("buildReconDecision converts noisy target signals into one next action", async () => {
  const modulePath = path.resolve("src/lib/reconWorkspace.ts");
  const { buildReconDecision } = await loadTsModule(modulePath);

  const decision = buildReconDecision({
    language: "zh",
    target: "https://case.example",
    riskScore: 72,
    clueCount: 5,
    reachable: true,
    primaryClue: "客服ID: mq-10086",
  });

  assert.match(decision.headline, /case\.example/);
  assert.match(decision.action, /带入深度远勘/);
  assert.match(decision.reason, /客服ID/);
  assert.equal(decision.confidenceLabel, "高优先级");
});

test("buildTaskDeskAction chooses one primary action for the current workspace state", async () => {
  const modulePath = path.resolve("src/lib/reconWorkspace.ts");
  const { buildTaskDeskAction } = await loadTsModule(modulePath);

  const action = buildTaskDeskAction({
    language: "zh",
    mode: "public",
    isRunning: false,
    hasInput: true,
    hasResult: true,
    hasPriorityTarget: true,
  });

  assert.equal(action.eyebrow, "当前任务");
  assert.match(action.primaryLabel, /带入深度远勘/);
  assert.match(action.statusText, /已形成优先目标/);
});

test("buildPriorityQueueLabel maps scores to practical queue labels", async () => {
  const modulePath = path.resolve("src/lib/reconWorkspace.ts");
  const { buildPriorityQueueLabel } = await loadTsModule(modulePath);

  assert.deepEqual(buildPriorityQueueLabel(82, "zh"), { label: "先处理", tone: "high", rank: 1 });
  assert.deepEqual(buildPriorityQueueLabel(45, "zh"), { label: "待核验", tone: "medium", rank: 2 });
  assert.deepEqual(buildPriorityQueueLabel(12, "zh"), { label: "可暂缓", tone: "low", rank: 3 });
});

test("buildWebReconInfrastructureInsight summarizes JD Cloud IP ownership", async () => {
  const modulePath = path.resolve("src/lib/webRecon.ts");
  const { buildWebReconInfrastructureInsight } = await loadTsModule(modulePath);

  const insight = buildWebReconInfrastructureInsight({
    resolvedIps: ["114.67.219.167"],
    rdap: { name: "Jingdong Cloud Network", registrar: "JD Cloud", country: "CN" },
    dnsRecords: [],
    architecture: { edge: [], server: [], frontend: [], backend: [], database: [], deployment: [] },
    externalHosts: [],
  }, "zh");

  assert.equal(insight.primaryIp, "114.67.219.167");
  assert.match(insight.provider, /京东云/);
  assert.match(insight.location, /中国|广东|广州/);
  assert.equal(insight.cdnDetected, false);
});

test("buildWebReconInfrastructureInsight detects Cloudflare CDN from DNS and edge hints", async () => {
  const modulePath = path.resolve("src/lib/webRecon.ts");
  const { buildWebReconInfrastructureInsight } = await loadTsModule(modulePath);

  const insight = buildWebReconInfrastructureInsight({
    resolvedIps: ["104.21.10.10", "172.67.1.1"],
    ipIntelligence: [],
    rdap: { name: "Cloudflare, Inc.", registrar: "Cloudflare", country: "US" },
    dnsRecords: [{ recordType: "CNAME", name: "www.example.com", value: "example.cloudflare.net" }],
    architecture: { edge: ["Cloudflare"], server: [], frontend: [], backend: [], database: [], deployment: [] },
    externalHosts: [],
  }, "zh");

  assert.equal(insight.cdnDetected, true);
  assert.match(insight.cdnProvider, /Cloudflare/);
  assert.match(insight.provider, /Cloudflare/);
});

test("buildWebReconInfrastructureInsight prefers online IP intelligence lookup results", async () => {
  const modulePath = path.resolve("src/lib/webRecon.ts");
  const { buildWebReconInfrastructureInsight } = await loadTsModule(modulePath);

  const insight = buildWebReconInfrastructureInsight({
    resolvedIps: ["114.67.219.167"],
    ipIntelligence: [{
      ip: "114.67.219.167",
      country: "中国",
      region: "广东省",
      city: "广州市",
      isp: "京东云",
      organization: "Jingdong Cloud",
      asn: "AS45090",
      asName: "CNNIC-JDCloud",
      source: "ip-api",
      error: null,
    }],
    rdap: null,
    dnsRecords: [],
    architecture: { edge: [], server: [], frontend: [], backend: [], database: [], deployment: [] },
    externalHosts: [],
  }, "zh");

  assert.equal(insight.primaryIp, "114.67.219.167");
  assert.equal(insight.location, "中国 广东省 广州市");
  assert.match(insight.provider, /Jingdong Cloud|京东云/);
  assert.match(insight.evidence.join("\n"), /AS45090/);
});
