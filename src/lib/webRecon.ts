export interface WebReconRdapRecord {
  lookupUrl: string;
  handle?: string | null;
  name?: string | null;
  registrar?: string | null;
  organization?: string | null;
  country?: string | null;
  startAddress?: string | null;
  endAddress?: string | null;
  nameservers: string[];
  created?: string | null;
  updated?: string | null;
  expires?: string | null;
}

export interface WebReconDnsRecord {
  recordType: string;
  name: string;
  value: string;
  ttl?: number | null;
}

export interface WebReconSecurityHeader {
  name: string;
  value?: string | null;
  present: boolean;
}

export interface WebReconFormFinding {
  action: string;
  method: string;
  fields: string[];
  hasPassword: boolean;
  loginLikely: boolean;
}

export interface WebReconPathFinding {
  path: string;
  source: string;
  status: number;
  title?: string | null;
  loginLikely: boolean;
  redirectUrl?: string | null;
  snippet?: string | null;
}

export interface WebReconEndpointFinding {
  path: string;
  source: string;
  endpointType: string;
  status?: number | null;
  evidence?: string | null;
}

export interface WebReconBusinessProfile {
  category: string;
  confidence: number;
  keywords: string[];
  features: string[];
  evidence: string[];
}

export interface WebReconArchitectureProfile {
  edge: string[];
  server: string[];
  runtime: string[];
  frontend: string[];
  cms: string[];
  api: string[];
  integrations: string[];
  buildHints: string[];
}

export interface WebReconCredentialSignal {
  surface: string;
  risk: string;
  evidence: string;
  attempted: boolean;
}

export interface WebReconAuthSurface {
  hasAuthSurface: boolean;
  hasLoginForm: boolean;
  hasAdminEntry: boolean;
  hasApiAuthHint: boolean;
  riskLevel: "high" | "medium" | "low" | "none";
  riskScore: number;
  signals: string[];
  evidence: string[];
  suggestedNextStep: string;
}

export interface WebReconTlsCertificate {
  subject?: string | null;
  commonName?: string | null;
  organization?: string | null;
  issuer?: string | null;
  issuerOrganization?: string | null;
  serialNumber?: string | null;
  sha256?: string | null;
  notBefore?: string | null;
  notAfter?: string | null;
  subjectAltNames: string[];
  isWildcard: boolean;
  selfSigned: boolean;
}

export interface WebReconArtifactFinding {
  artifactType: string;
  url: string;
  status: number;
  contentType?: string | null;
  title?: string | null;
  evidence: string[];
}

export interface WebReconExternalHost {
  host: string;
  source: string;
  category: string;
}

export interface WebReconTargetReport {
  target: string;
  lookupHost: string;
  normalizedUrl: string;
  finalUrl?: string | null;
  redirectChain: string[];
  status?: number | null;
  blocked: boolean;
  error?: string | null;
  resolvedIps: string[];
  rdap?: WebReconRdapRecord | null;
  dnsRecords: WebReconDnsRecord[];
  serverHeader?: string | null;
  poweredBy?: string | null;
  contentType?: string | null;
  securityHeaders: WebReconSecurityHeader[];
  title?: string | null;
  metaDescription?: string | null;
  generator?: string | null;
  faviconUrl?: string | null;
  faviconMd5?: string | null;
  faviconMmh3?: number | null;
  techStack: string[];
  tlsCertificate?: WebReconTlsCertificate | null;
  artifactFindings: WebReconArtifactFinding[];
  externalHosts: WebReconExternalHost[];
  pathHints: string[];
  adminCandidates: WebReconPathFinding[];
  apiCandidates: WebReconEndpointFinding[];
  forms: WebReconFormFinding[];
  businessProfile: WebReconBusinessProfile;
  architecture: WebReconArchitectureProfile;
  authSurface: WebReconAuthSurface;
  credentialSignals: WebReconCredentialSignal[];
  siteKind: string;
  notes: string[];
}

export interface WebReconTechCount {
  tech: string;
  count: number;
}

export interface WebReconBatchStats {
  total: number;
  reachable: number;
  blocked: number;
  loginPages: number;
  adminCandidates: number;
  apiCandidates: number;
  credentialSurfaces: number;
  highRiskTargets: number;
  relatedClusters: number;
  uniqueTechs: number;
  techCounts: WebReconTechCount[];
}

export interface WebReconCorrelationCluster {
  clusterType: string;
  value: string;
  label: string;
  confidence: number;
  targets: string[];
  evidence: string[];
}

export interface WebReconBatchResult {
  stats: WebReconBatchStats;
  clusters: WebReconCorrelationCluster[];
  items: WebReconTargetReport[];
}

export interface WebReconProgressEvent {
  taskId: string;
  current: number;
  total: number;
  target?: string | null;
  stage: string;
  message: string;
  reachable: number;
  adminCandidates: number;
  apiCandidates: number;
  credentialSurfaces: number;
}

export const WEB_RECON_SITE_KIND_LABELS: Record<string, { zh: string; en: string }> = {
  "login-portal": { zh: "登录/后台门户", en: "Login Portal" },
  cms: { zh: "内容管理站点", en: "CMS Site" },
  api: { zh: "API 服务", en: "API Service" },
  ecommerce: { zh: "电商/交易站点", en: "E-commerce" },
  portal: { zh: "业务门户", en: "Portal" },
  content: { zh: "内容型站点", en: "Content Site" },
  static: { zh: "静态/展示站点", en: "Static Site" },
  "error-page": { zh: "错误/占位页", en: "Error/Placeholder" },
  "web-app": { zh: "通用 Web 应用", en: "Web App" },
  unknown: { zh: "未分类", en: "Unknown" },
};

export const WEB_RECON_BUSINESS_LABELS: Record<string, { zh: string; en: string }> = {
  "crypto-wallet": { zh: "虚拟币/钱包", en: "Crypto/Wallet" },
  investment: { zh: "投资理财", en: "Investment" },
  gambling: { zh: "博彩彩票", en: "Gambling" },
  "payment-merchant": { zh: "支付/商户", en: "Payment/Merchant" },
  loan: { zh: "贷款信贷", en: "Loan/Credit" },
  "task-rebate": { zh: "任务返利", en: "Task/Rebate" },
  ecommerce: { zh: "电商交易", en: "E-commerce" },
  "dating-social": { zh: "交友社交", en: "Dating/Social" },
  content: { zh: "内容资讯", en: "Content" },
  corporate: { zh: "企业展示", en: "Corporate" },
  unknown: { zh: "未知用途", en: "Unknown" },
};

export function getWebReconSiteKindLabel(kind: string, language: "zh" | "en") {
  return WEB_RECON_SITE_KIND_LABELS[kind]?.[language] || kind;
}

export function getWebReconBusinessLabel(kind: string, language: "zh" | "en") {
  return WEB_RECON_BUSINESS_LABELS[kind]?.[language] || kind;
}

export type WebReconRiskLevel = "high" | "medium" | "low" | "info";

export interface WebReconRiskTag {
  id: string;
  level: WebReconRiskLevel;
  label: { zh: string; en: string };
  description: { zh: string; en: string };
}

export function summarizeWebReconTarget(report: WebReconTargetReport, language: "zh" | "en") {
  const tech = report.techStack.length > 0 ? report.techStack.slice(0, 4).join(" / ") : (language === "zh" ? "未识别" : "Unknown");
  const ips = report.resolvedIps.length > 0 ? report.resolvedIps.join(", ") : (language === "zh" ? "未解析" : "Unresolved");
  const kind = getWebReconSiteKindLabel(report.siteKind, language);
  const business = getWebReconBusinessLabel(report.businessProfile?.category || "unknown", language);
  const registrar =
    report.rdap?.registrar ||
    report.rdap?.organization ||
    (language === "zh" ? "无" : "None");
  return {
    tech,
    ips,
    kind,
    business,
    registrar,
  };
}

export function getWebReconRiskTags(report: WebReconTargetReport): WebReconRiskTag[] {
  const tags: WebReconRiskTag[] = [];
  const adminText = report.adminCandidates.map((item) => `${item.path} ${item.title || ""} ${item.snippet || ""}`).join("\n").toLowerCase();
  const techText = report.techStack.join(" ").toLowerCase();
  const noteText = report.notes.join(" ").toLowerCase();

  if (report.blocked) {
    tags.push({
      id: "blocked-target",
      level: "medium",
      label: { zh: "目标受限", en: "Blocked" },
      description: { zh: "目标被本地策略或私有地址保护限制，未继续探测。", en: "The target was blocked by local policy or private-address protection." },
    });
  }

  if (report.adminCandidates.length > 0) {
    tags.push({
      id: "admin-candidate",
      level: "high",
      label: { zh: "发现后台", en: "Admin Found" },
      description: { zh: "发现公开可访问的后台或管理入口候选，建议在授权条件下优先核验。", en: "Public admin or management path candidates were found and should be verified with authorization." },
    });
  }

  if (report.forms.some((form) => form.loginLikely || form.hasPassword) || report.siteKind === "login-portal") {
    tags.push({
      id: "login-surface",
      level: "medium",
      label: { zh: "登录入口", en: "Login Surface" },
      description: { zh: "页面存在登录表单或疑似认证门户，存在弱口令风险识别价值。", en: "A login form or authentication portal was detected, useful for weak-password risk triage." },
    });
  }

  if (/phpmyadmin|pma|tomcat|jenkins|wp-admin|wp-login|manager\/html/.test(adminText) || /wordpress|tomcat|jenkins/.test(techText)) {
    tags.push({
      id: "default-password-risk",
      level: "high",
      label: { zh: "默认口令风险", en: "Default Cred Risk" },
      description: { zh: "发现常见管理组件或 CMS 后台线索；本模块仅提示风险，不自动尝试口令。", en: "Common admin components or CMS admin traces were found; this module only flags risk and does not try credentials." },
    });
  }

  if ((report.credentialSignals || []).length > 0) {
    tags.push({
      id: "credential-surfaces",
      level: "high",
      label: { zh: "弱口令面", en: "Credential Surface" },
      description: { zh: "发现登录表单或后台认证面；已记录风险信号，但不会自动爆破或尝试凭据。", en: "Login or admin authentication surfaces were found; risk is recorded without password attempts." },
    });
  }

  if (report.authSurface?.hasApiAuthHint) {
    tags.push({
      id: "auth-api-hint",
      level: report.authSurface.riskLevel === "high" ? "medium" : "low",
      label: { zh: "认证接口", en: "Auth API" },
      description: { zh: "发现疑似认证接口或会话入口，可辅助判断是否存在登录体系。", en: "Authentication API or session hints were found and can help confirm a login system." },
    });
  }

  if ((report.apiCandidates || []).length > 0) {
    tags.push({
      id: "api-candidates",
      level: "low",
      label: { zh: "API 线索", en: "API Hints" },
      description: { zh: "从页面、JS、robots 或 sitemap 中提取到 API/接口路径，可用于业务结构研判。", en: "API paths were extracted from pages, JavaScript, robots or sitemap for application mapping." },
    });
  }

  if (report.faviconMmh3 !== null && report.faviconMmh3 !== undefined) {
    tags.push({
      id: "favicon-fingerprint",
      level: "info",
      label: { zh: "图标指纹", en: "Favicon Fingerprint" },
      description: { zh: "已提取 favicon mmh3，可作为站点指纹证据。", en: "Favicon mmh3 was extracted as site fingerprint evidence." },
    });
  }

  if (report.pathHints.length > 0) {
    tags.push({
      id: "path-leak-hints",
      level: "low",
      label: { zh: "路径线索", en: "Path Hints" },
      description: { zh: "robots、sitemap 或表单中提取到路径线索，可辅助寻找业务入口。", en: "Path hints were extracted from robots, sitemap, or forms for entry-point discovery." },
    });
  }

  if (/server:|powered-by:|rdap:/.test(noteText) || report.serverHeader || report.poweredBy || report.generator) {
    tags.push({
      id: "stack-disclosure",
      level: "low",
      label: { zh: "栈信息暴露", en: "Stack Leak" },
      description: { zh: "响应头或页面元信息暴露了服务端、框架或生成器线索。", en: "Headers or page metadata reveal server, framework, or generator clues." },
    });
  }

  return tags;
}

export function getWebReconRiskScore(report: WebReconTargetReport) {
  return getWebReconRiskTags(report).reduce((score, tag) => {
    if (tag.level === "high") return score + 30;
    if (tag.level === "medium") return score + 18;
    if (tag.level === "low") return score + 8;
    return score + 3;
  }, 0);
}

export function getWebReconRiskTone(level: WebReconRiskLevel) {
  if (level === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  if (level === "low") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function getWebReconAuthRiskTone(level: WebReconAuthSurface["riskLevel"]) {
  if (level === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  if (level === "low") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function joinLimited(values: Array<string | null | undefined>, limit = 6, fallback = "-") {
  const normalized = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  if (normalized.length === 0) return fallback;
  return normalized.slice(0, limit).join(", ");
}

function uniqueLines(values: Array<string | null | undefined>, limit = 8) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function yesNo(value: boolean | null | undefined, language: "zh" | "en") {
  return language === "zh" ? (value ? "是" : "否") : value ? "Yes" : "No";
}

function getSecurityHeaderGaps(report: WebReconTargetReport) {
  return report.securityHeaders.filter((header) => !header.present).map((header) => header.name);
}

function buildManualValidationSteps(report: WebReconTargetReport, language: "zh" | "en") {
  const steps: string[] = [];

  if (language === "zh") {
    steps.push("对首页、标题、响应头、TLS 证书、DNS 解析结果留存截图或文本证据。");
    if (report.adminCandidates.length > 0 || report.forms.length > 0) {
      steps.push("对后台候选、登录表单、认证入口逐项做人工访问复核，记录状态码、跳转链和页面标识，不进行口令尝试。");
    }
    if (report.apiCandidates.length > 0) {
      steps.push("结合公开页面、脚本资源和接口命名，对 API 路径做人工功能归类，区分登录、业务、回调和静态配置接口。");
    }
    if (report.techStack.length > 0 || report.generator || report.poweredBy) {
      steps.push("将识别到的技术栈、CMS、组件线索与厂商公告和公开漏洞信息做版本侧核对，判断是否存在需重点关注的暴露面。");
    }
    if (report.externalHosts.length > 0) {
      steps.push("梳理外联主机与第三方服务类型，识别 CDN、支付、统计、对象存储、单点登录或短信邮件通道。");
    }
    if (getSecurityHeaderGaps(report).length > 0) {
      steps.push("记录缺失的安全响应头，作为站点安全基线薄弱的旁证。");
    }
    return steps;
  }

  steps.push("Preserve screenshots or text evidence for the landing page, headers, TLS certificate, and DNS resolution.");
  if (report.adminCandidates.length > 0 || report.forms.length > 0) {
    steps.push("Manually review admin candidates, login forms, and auth entries, recording status codes, redirects, and page markers without trying credentials.");
  }
  if (report.apiCandidates.length > 0) {
    steps.push("Classify API paths from public pages and scripts into login, business, callback, or configuration surfaces.");
  }
  if (report.techStack.length > 0 || report.generator || report.poweredBy) {
    steps.push("Cross-check identified stack and component hints against vendor advisories and public vulnerability disclosures.");
  }
  if (report.externalHosts.length > 0) {
    steps.push("Map external hosts to CDN, payment, analytics, storage, SSO, or messaging functions.");
  }
  if (getSecurityHeaderGaps(report).length > 0) {
    steps.push("Record missing security headers as supporting evidence of weak hardening.");
  }
  return steps;
}

function buildSafeTargetReportSection(report: WebReconTargetReport, index: number, language: "zh" | "en") {
  const summary = summarizeWebReconTarget(report, language);
  const riskTags = getWebReconRiskTags(report).map((tag) => tag.label[language]);
  const securityHeaderGaps = getSecurityHeaderGaps(report);
  const stackText = joinLimited([
    ...report.techStack,
    report.generator ? `generator:${report.generator}` : null,
    report.poweredBy ? `powered-by:${report.poweredBy}` : null,
  ], 10);
  const dnsText = joinLimited((report.dnsRecords || []).slice(0, 10).map((record) => `${record.recordType}:${record.value}`), 10);
  const artifactText = joinLimited((report.artifactFindings || []).map((artifact) => `${artifact.artifactType}(${artifact.status})`), 10);
  const externalText = joinLimited((report.externalHosts || []).map((host) => `${host.host}[${host.category}]`), 10);
  const adminText = joinLimited(report.adminCandidates.map((candidate) => `${candidate.path}(${candidate.status})`), 10);
  const apiText = joinLimited((report.apiCandidates || []).map((candidate) => candidate.path), 12);
  const credentialText = joinLimited((report.credentialSignals || []).map((signal) => `${signal.surface}[${signal.risk}]`), 12);
  const evidenceLines = uniqueLines([
    report.serverHeader ? `Server: ${report.serverHeader}` : null,
    report.rdap?.registrar ? `Registrar: ${report.rdap.registrar}` : null,
    report.tlsCertificate?.commonName ? `TLS CN: ${report.tlsCertificate.commonName}` : null,
    report.tlsCertificate?.issuerOrganization || report.tlsCertificate?.issuer
      ? `TLS Issuer: ${report.tlsCertificate?.issuerOrganization || report.tlsCertificate?.issuer}`
      : null,
    report.faviconMmh3 !== null && report.faviconMmh3 !== undefined ? `favicon mmh3: ${report.faviconMmh3}` : null,
    ...report.authSurface.evidence,
    ...report.notes,
  ], 8);
  const validationSteps = buildManualValidationSteps(report, language);

  if (language === "zh") {
    return [
      `### ${index + 1}. ${report.target}`,
      `- 访问地址: ${report.finalUrl || report.normalizedUrl}`,
      `- 状态信息: HTTP ${report.status ?? "-"} | 站点类型 ${summary.kind} | 业务用途 ${summary.business}`,
      `- 基础设施: IP ${summary.ips} | 注册商 ${summary.registrar} | TLS ${report.tlsCertificate?.commonName || report.tlsCertificate?.issuerOrganization || "-"}`,
      `- 技术画像: ${stackText}`,
      `- DNS 证据: ${dnsText}`,
      `- 风险标签: ${joinLimited(riskTags, 10, "无")}`,
      `- 认证面: 登录表单 ${yesNo(report.authSurface?.hasLoginForm, language)} / 后台入口 ${yesNo(report.authSurface?.hasAdminEntry, language)} / 认证接口 ${yesNo(report.authSurface?.hasApiAuthHint, language)} / 风险 ${report.authSurface?.riskLevel || "none"} (${report.authSurface?.riskScore ?? 0})`,
      `- 后台候选: ${adminText}`,
      `- API 线索: ${apiText}`,
      `- 凭证风险信号: ${credentialText}`,
      `- 站点产物: ${artifactText}`,
      `- 外联主机: ${externalText}`,
      `- 缺失安全头: ${joinLimited(securityHeaderGaps, 10, "无")}`,
      `- 证据摘录: ${evidenceLines.length > 0 ? evidenceLines.join(" | ") : "无"}`,
      `- 合规人工核验建议:`,
      ...validationSteps.map((step, stepIndex) => `  ${stepIndex + 1}. ${step}`),
    ].join("\n");
  }

  return [
    `### ${index + 1}. ${report.target}`,
    `- URL: ${report.finalUrl || report.normalizedUrl}`,
    `- Status: HTTP ${report.status ?? "-"} | Kind ${summary.kind} | Business ${summary.business}`,
    `- Infrastructure: IP ${summary.ips} | Registrar ${summary.registrar} | TLS ${report.tlsCertificate?.commonName || report.tlsCertificate?.issuerOrganization || "-"}`,
    `- Stack: ${stackText}`,
    `- DNS Evidence: ${dnsText}`,
    `- Risk Tags: ${joinLimited(riskTags, 10, "None")}`,
    `- Auth Surface: Login ${yesNo(report.authSurface?.hasLoginForm, language)} / Admin ${yesNo(report.authSurface?.hasAdminEntry, language)} / Auth API ${yesNo(report.authSurface?.hasApiAuthHint, language)} / Risk ${report.authSurface?.riskLevel || "none"} (${report.authSurface?.riskScore ?? 0})`,
    `- Admin Candidates: ${adminText}`,
    `- API Hints: ${apiText}`,
    `- Credential Signals: ${credentialText}`,
    `- Artifacts: ${artifactText}`,
    `- External Hosts: ${externalText}`,
    `- Missing Security Headers: ${joinLimited(securityHeaderGaps, 10, "None")}`,
    `- Evidence Notes: ${evidenceLines.length > 0 ? evidenceLines.join(" | ") : "None"}`,
    `- Safe Manual Validation:`,
    ...validationSteps.map((step, stepIndex) => `  ${stepIndex + 1}. ${step}`),
  ].join("\n");
}

export function buildWebReconReportMarkdown(result: WebReconBatchResult, language: "zh" | "en") {
  const sortedItems = [...result.items].sort((a, b) => getWebReconRiskScore(b) - getWebReconRiskScore(a));
  const clusterLines = (result.clusters || []).slice(0, 10).map((cluster) => {
    if (language === "zh") {
      return `- ${cluster.label}: ${cluster.targets.join(", ")}${cluster.evidence.length > 0 ? ` | 证据 ${joinLimited(cluster.evidence, 3, "-")}` : ""}`;
    }
    return `- ${cluster.label}: ${cluster.targets.join(", ")}${cluster.evidence.length > 0 ? ` | Evidence ${joinLimited(cluster.evidence, 3, "-")}` : ""}`;
  });

  if (language === "zh") {
    return [
      "# 远程勘查报告",
      "",
      `- 生成时间: ${new Date().toISOString()}`,
      `- 勘查目标数: ${result.stats.total}`,
      `- 可访问目标数: ${result.stats.reachable}`,
      `- 高风险认证面目标数: ${result.stats.highRiskTargets}`,
      `- 说明: 本报告仅基于公开可访问面与现有勘查结果生成，用于资产画像、证据整理与合规人工核验，不包含渗透利用、绕过或提权内容。`,
      "",
      "## 一、总体摘要",
      `- 后台候选: ${result.stats.adminCandidates}`,
      `- API 线索: ${result.stats.apiCandidates}`,
      `- 凭证风险面: ${result.stats.credentialSurfaces}`,
      `- 登录页数量: ${result.stats.loginPages}`,
      `- 技术指纹种类: ${result.stats.uniqueTechs}`,
      `- 主要技术分布: ${joinLimited((result.stats.techCounts || []).slice(0, 8).map((item) => `${item.tech}(${item.count})`), 8, "无")}`,
      "",
      "## 二、跨目标关联线索",
      ...(clusterLines.length > 0 ? clusterLines : ["- 暂无可聚类关联项"]),
      "",
      "## 三、分目标研判",
      ...sortedItems.map((item, index) => buildSafeTargetReportSection(item, index, language)),
      "",
      "## 四、处置建议",
      "1. 对高风险认证面、后台候选和公开接口做证据留存与人工复核。",
      "2. 将识别出的技术栈、组件、证书和外联服务与案件情报、厂商公告、公开漏洞信息做交叉比对。",
      "3. 对同注册商、同证书、同 favicon 指纹或同外联基础设施的站点做并案关联。",
      "4. 报告中的风险项应结合人工验证结果再进入后续办案流程。",
    ].join("\n");
  }

  return [
    "# Remote Reconnaissance Report",
    "",
    `- Generated At: ${new Date().toISOString()}`,
    `- Targets: ${result.stats.total}`,
    `- Reachable: ${result.stats.reachable}`,
    `- High-Risk Auth Surfaces: ${result.stats.highRiskTargets}`,
    `- Scope Note: This report is generated from publicly reachable surfaces and current recon data only. It is limited to asset profiling, evidence organization, and safe manual validation planning.`,
    "",
    "## 1. Executive Summary",
    `- Admin Candidates: ${result.stats.adminCandidates}`,
    `- API Hints: ${result.stats.apiCandidates}`,
    `- Credential Surfaces: ${result.stats.credentialSurfaces}`,
    `- Login Pages: ${result.stats.loginPages}`,
    `- Unique Technologies: ${result.stats.uniqueTechs}`,
    `- Top Technologies: ${joinLimited((result.stats.techCounts || []).slice(0, 8).map((item) => `${item.tech}(${item.count})`), 8, "None")}`,
    "",
    "## 2. Cross-Target Correlations",
    ...(clusterLines.length > 0 ? clusterLines : ["- No correlation clusters were generated"]),
    "",
    "## 3. Target Assessments",
    ...sortedItems.map((item, index) => buildSafeTargetReportSection(item, index, language)),
    "",
    "## 4. Recommended Follow-Up",
    "1. Preserve evidence and manually validate high-risk auth surfaces, admin candidates, and public API hints.",
    "2. Cross-check the detected stack, certificate, and third-party services against case intelligence, vendor advisories, and public disclosures.",
    "3. Cluster related sites by registrar, certificate, favicon fingerprint, and shared external infrastructure.",
    "4. Promote findings into downstream handling only after manual verification.",
  ].join("\n");
}

function formatEvidenceList(values: string[], empty: string) {
  if (values.length === 0) return `- ${empty}`;
  return values.map((value) => `- ${value}`).join("\n");
}

function buildTargetReportSection(item: WebReconTargetReport, index: number, language: "zh" | "en") {
  const summary = summarizeWebReconTarget(item, language);
  const tags = getWebReconRiskTags(item).map((tag) => tag.label[language]);
  const adminEvidence = item.adminCandidates.map((candidate) => `${candidate.path}（HTTP ${candidate.status}${candidate.title ? `，${candidate.title}` : ""}）`);
  const apiEvidence = item.apiCandidates.slice(0, 16).map((candidate) => `${candidate.path}（${candidate.endpointType}）`);
  const formEvidence = item.forms.map((form) => `${form.method.toUpperCase()} ${form.action}，字段：${form.fields.join("、") || "未识别"}`);
  const infraEvidence = [
    item.serverHeader ? `Server: ${item.serverHeader}` : "",
    item.poweredBy ? `X-Powered-By: ${item.poweredBy}` : "",
    item.generator ? `Generator: ${item.generator}` : "",
    item.faviconMmh3 !== null && item.faviconMmh3 !== undefined ? `favicon mmh3: ${item.faviconMmh3}` : "",
    item.tlsCertificate?.commonName ? `TLS CN: ${item.tlsCertificate.commonName}` : "",
  ].filter(Boolean);
  const missingHeaders = item.securityHeaders.filter((header) => !header.present).map((header) => header.name);
  const vulnerabilityDirections = [
    item.adminCandidates.length > 0 ? "后台入口暴露：核验访问控制、后台路径泄露、默认管理组件和管理端登录策略。" : "后台入口：当前未发现明确后台路径，建议结合页面链接、robots/sitemap 与历史快照继续核验。",
    item.forms.some((form) => form.hasPassword || form.loginLikely) ? "弱口令与认证风险：存在登录表单或认证门户，建议在授权条件下人工核验默认口令、弱口令策略、验证码、锁定策略和登录审计。" : "弱口令与认证风险：暂未发现明显密码表单，仍需关注 API 鉴权、第三方登录和隐藏认证入口。",
    item.apiCandidates.length > 0 ? "接口漏洞方向：围绕鉴权缺失、越权访问、敏感信息返回、参数校验缺陷、批量查询和导出接口做非破坏性验证。" : "接口漏洞方向：当前接口线索较少，建议优先分析前端资源、JS 路由、sitemap 与网络请求。",
    item.forms.length > 0 ? "输入点风险：围绕表单字段做 SQL 注入、XSS、SSRF、命令注入、模板注入和业务逻辑缺陷的安全验证，但不在报告中固化攻击载荷。" : "输入点风险：未发现明显表单，建议补充动态访问与业务页面采集。",
    item.artifactFindings.length > 0 || item.pathHints.length > 0 ? "文件与目录风险：核验 robots/sitemap、公开资源、备份文件、上传目录、目录遍历和敏感配置暴露。" : "文件与目录风险：当前公开产物线索有限，建议补充常规静态资源、备份命名和目录索引检查。",
    missingHeaders.length > 0 ? `安全头缺失：${missingHeaders.slice(0, 6).join("、")}，可作为会话保护、点击劫持、内容嗅探和跨域策略排查方向。` : "安全头：已识别到主要安全头配置，仍需结合实际策略有效性核验。",
  ];
  const validationPlan = [
    "确认授权范围、目标域名、解析 IP、时间窗口和取证留痕要求。",
    "复核首页、跳转链、证书、DNS、注册商、favicon、技术栈和外联服务，形成目标画像。",
    "对后台、登录面、API、表单、公开文件进行只读验证，记录状态码、标题、响应差异和截图证据。",
    "围绕认证、越权、输入校验、上传、目录访问、接口返回进行人工核验，优先使用低风险、非破坏性方法。",
    "将可疑接口、账号体系、资金通道、客服通道、下载分发和同源站点纳入案件线索池。",
  ];
  const protectionPlan = [
    "识别 CDN、WAF、验证码、速率限制、访问频控、地域限制和 IP 封禁策略。",
    "通过响应头、拦截页、状态码变化、TLS 证书、CNAME 和边缘节点特征判断防护链路。",
    "采用合规的低频人工验证和日志留痕方式排查误报，不提供绕过载荷或自动规避脚本。",
    "如需进一步验证，应在法定授权、目标范围和操作窗口内执行，并同步保全请求、响应和系统日志。",
  ];
  const controlRisk = [
    item.authSurface?.hasAdminEntry ? "存在后台入口线索，若认证策略薄弱或管理组件存在已知缺陷，可能导致后台权限被非法获取。" : "暂未发现明确后台入口，站点控制风险主要取决于隐藏管理端、接口鉴权和供应链组件。",
    item.authSurface?.hasApiAuthHint ? "存在认证接口线索，需重点核验登录态、Token 生命周期、接口越权和敏感数据返回。" : "认证接口线索不明显，建议补充动态流量和前端资源分析。",
    item.externalHosts.length > 0 ? "发现外联服务，后续可关联支付、客服、统计、CDN、对象存储和分发域名，拓展同源涉诈基础设施。" : "外联服务线索有限，可继续通过页面资源、证书 SAN、DNS 和 favicon 聚类拓线。",
  ];

  if (language === "en") {
    return [
      `### ${index + 1}. ${item.target}`,
      `- URL: ${item.finalUrl || item.normalizedUrl}`,
      `- Status: ${item.status ?? "-"}`,
      `- Site type: ${summary.kind}`,
      `- Business profile: ${summary.business} (${Math.round((item.businessProfile?.confidence || 0) * 100)}%)`,
      `- IP: ${summary.ips}`,
      `- Tech stack: ${summary.tech}`,
      `- Risk tags: ${tags.join(", ") || "None"}`,
      "",
      "#### Vulnerability directions",
      formatEvidenceList(vulnerabilityDirections, "No obvious direction identified"),
      "",
      "#### Key evidence",
      formatEvidenceList([...infraEvidence, ...adminEvidence, ...apiEvidence, ...formEvidence].slice(0, 28), "No key evidence collected"),
      "",
      "#### Authorized validation path",
      formatEvidenceList(validationPlan, "No validation path"),
      "",
      "#### Protection and WAF assessment",
      formatEvidenceList(protectionPlan, "No protection assessment"),
      "",
      "#### Control-risk analysis",
      formatEvidenceList(controlRisk, "No control-risk finding"),
    ].join("\n");
  }

  return [
    `### ${index + 1}. ${item.target}`,
    `- 目标 URL：${item.finalUrl || item.normalizedUrl}`,
    `- 访问状态：${item.status ?? "-"}`,
    `- 站点类型：${summary.kind}`,
    `- 业务形态：${summary.business}（置信度 ${Math.round((item.businessProfile?.confidence || 0) * 100)}%）`,
    `- 解析 IP：${summary.ips}`,
    `- 技术栈：${summary.tech}`,
    `- 风险标签：${tags.join("、") || "无"}`,
    "",
    "#### 潜在漏洞方向研判",
    formatEvidenceList(vulnerabilityDirections, "暂无明确漏洞方向"),
    "",
    "#### 关键证据摘录",
    formatEvidenceList([...infraEvidence, ...adminEvidence, ...apiEvidence, ...formEvidence].slice(0, 28), "暂无关键证据"),
    "",
    "#### 合法授权验证路径",
    formatEvidenceList(validationPlan, "暂无验证路径"),
    "",
    "#### WAF 与安全防护排查方向",
    formatEvidenceList(protectionPlan, "暂无防护排查方向"),
    "",
    "#### 权限风险与站点控制可行性分析",
    formatEvidenceList(controlRisk, "暂无权限风险线索"),
  ].join("\n");
}

export function buildWebReconInvestigationReport(result: WebReconBatchResult, language: "zh" | "en") {
  return buildWebReconReportMarkdown(result, language);
  const sortedItems = [...result.items].sort((a, b) => getWebReconRiskScore(b) - getWebReconRiskScore(a));
  const highRiskItems = sortedItems.filter((item) => item.authSurface?.riskLevel === "high");
  const adminTargets = sortedItems.filter((item) => item.adminCandidates.length > 0);
  const apiTargets = sortedItems.filter((item) => item.apiCandidates.length > 0);
  const credentialTargets = sortedItems.filter((item) => item.credentialSignals.length > 0);
  const techs = result.stats.techCounts.slice(0, 10).map((item) => `${item.tech}(${item.count})`);
  const clusters = result.clusters.slice(0, 8).map((cluster) => `${cluster.label}: ${cluster.targets.join("、")}`);
  const generatedAt = new Date().toLocaleString(language === "zh" ? "zh-CN" : "en-US");

  if (language === "en") {
    return [
      "# Authorized Fraud-Site Reconnaissance and Penetration Assessment Report",
      "",
      `Generated at: ${generatedAt}`,
      "",
      "## 1. Authorization and scope statement",
      "This report is generated for authorized law-enforcement investigation and technical assessment. It is limited to reconnaissance findings, vulnerability-direction analysis, non-destructive validation planning, evidence organization, and follow-up investigation guidance. It does not include executable malicious payloads, exploit code, WAF-bypass payloads, privilege-escalation commands, persistence methods, or site-control procedures.",
      "",
      "## 2. Executive summary",
      `- Targets: ${result.stats.total}`,
      `- Reachable: ${result.stats.reachable}`,
      `- High-risk auth surfaces: ${result.stats.highRiskTargets}`,
      `- Admin candidates: ${result.stats.adminCandidates}`,
      `- API candidates: ${result.stats.apiCandidates}`,
      `- Credential-risk surfaces: ${result.stats.credentialSurfaces}`,
      `- Related clusters: ${result.stats.relatedClusters}`,
      `- Main technologies: ${techs.join(", ") || "None identified"}`,
      "",
      "## 3. Priority targets",
      formatEvidenceList(sortedItems.slice(0, 8).map((item) => `${item.target}: risk score ${getWebReconRiskScore(item)}, auth risk ${item.authSurface?.riskLevel || "none"}`), "No priority target"),
      "",
      "## 4. Related infrastructure and same-source clues",
      formatEvidenceList(clusters, "No related cluster identified"),
      "",
      "## 5. High-value surfaces",
      `- Admin-entry targets: ${adminTargets.map((item) => item.target).join(", ") || "None"}`,
      `- API-surface targets: ${apiTargets.map((item) => item.target).join(", ") || "None"}`,
      `- Credential-risk targets: ${credentialTargets.map((item) => item.target).join(", ") || "None"}`,
      `- High-risk auth targets: ${highRiskItems.map((item) => item.target).join(", ") || "None"}`,
      "",
      "## 6. Target analysis",
      sortedItems.map((item, index) => buildTargetReportSection(item, index, language)).join("\n\n"),
      "",
      "## 7. Evidence preservation checklist",
      formatEvidenceList(["Preserve original URL, final URL, redirect chain, status code, title and timestamp.", "Preserve DNS, RDAP, TLS certificate, favicon hash and response-header evidence.", "Preserve admin/API/form screenshots or response summaries under authorization.", "Preserve operation scope, operator, time window and tool output hashes where applicable."], "No checklist"),
    ].join("\n");
  }

  return [
    "# 涉诈网站远程勘查与授权渗透研判报告",
    "",
    `生成时间：${generatedAt}`,
    "",
    "## 一、授权与范围声明",
    "本报告面向公安执法办案场景下的涉诈网站远程勘查与技术研判，仅用于已授权范围内的资产画像、漏洞方向研判、非破坏性验证规划、证据链整理与后续侦查建议。报告不包含可直接执行的恶意 Payload、攻击代码、WAF 绕过载荷、提权命令、权限维持方法或站点控制操作。",
    "",
    "## 二、执行摘要",
    `- 勘查目标数：${result.stats.total}`,
    `- 可访问目标数：${result.stats.reachable}`,
    `- 高风险认证面：${result.stats.highRiskTargets}`,
    `- 后台入口候选：${result.stats.adminCandidates}`,
    `- API/接口线索：${result.stats.apiCandidates}`,
    `- 口令风险面：${result.stats.credentialSurfaces}`,
    `- 同源/关联聚类：${result.stats.relatedClusters}`,
    `- 主要技术指纹：${techs.join("、") || "暂未识别"}`,
    "",
    "## 三、优先研判目标",
    formatEvidenceList(sortedItems.slice(0, 8).map((item) => `${item.target}：风险排序分 ${getWebReconRiskScore(item)}，认证面风险 ${item.authSurface?.riskLevel || "none"}`), "暂无优先目标"),
    "",
    "## 四、关联基础设施与同源拓线",
    formatEvidenceList(clusters, "暂未发现明确关联聚类"),
    "",
    "## 五、高价值攻击面与侦查入口",
    `- 后台入口目标：${adminTargets.map((item) => item.target).join("、") || "暂无"}`,
    `- API 接口目标：${apiTargets.map((item) => item.target).join("、") || "暂无"}`,
    `- 口令风险目标：${credentialTargets.map((item) => item.target).join("、") || "暂无"}`,
    `- 高风险认证目标：${highRiskItems.map((item) => item.target).join("、") || "暂无"}`,
    "",
    "## 六、逐目标技术研判",
    sortedItems.map((item, index) => buildTargetReportSection(item, index, language)).join("\n\n"),
    "",
    "## 七、证据保全清单",
    formatEvidenceList(["保全原始 URL、最终 URL、跳转链、状态码、页面标题和采集时间。", "保全 DNS、RDAP、TLS 证书、favicon 指纹和响应头证据。", "对后台、API、表单、公开文件线索进行截图或响应摘要固化。", "记录授权范围、操作人员、操作时间窗口、工具输出和关键文件哈希。", "对涉及资金通道、客服通道、下载分发、同源域名的线索纳入案件线索池。"], "暂无证据保全项"),
    "",
    "## 八、后续侦查建议",
    formatEvidenceList(["优先核验高风险认证面、后台候选、API 鉴权和业务越权风险。", "结合涉诈业务关键词、页面文案、客服入口、支付通道和下载链接开展资金流、信息流、人员流关联。", "围绕证书 SAN、favicon、注册商、DNS、外联资源和前端构建特征扩展同源站点。", "如需开展进一步授权测试，应明确目标范围、操作窗口、验证方法、留痕要求和回滚预案。"], "暂无后续建议"),
  ].join("\n");
}

export function buildWebReconAiPrompt(result: WebReconBatchResult, language: "zh" | "en") {
  const lines = result.items.map((item, index) => {
    const summary = summarizeWebReconTarget(item, language);
    const tags = getWebReconRiskTags(item).map((tag) => tag.label[language]).join(", ") || (language === "zh" ? "无" : "None");
    const architecture = [
      item.architecture?.edge?.length ? `Edge: ${item.architecture.edge.join(", ")}` : "",
      item.architecture?.server?.length ? `Server: ${item.architecture.server.join(", ")}` : "",
      item.architecture?.runtime?.length ? `Runtime: ${item.architecture.runtime.join(", ")}` : "",
      item.architecture?.frontend?.length ? `Frontend: ${item.architecture.frontend.join(", ")}` : "",
      item.architecture?.cms?.length ? `CMS: ${item.architecture.cms.join(", ")}` : "",
      item.architecture?.api?.length ? `API: ${item.architecture.api.slice(0, 8).join(", ")}` : "",
      item.architecture?.integrations?.length ? `Integrations: ${item.architecture.integrations.slice(0, 6).join(", ")}` : "",
    ].filter(Boolean).join(" | ") || "-";
    const dns = (item.dnsRecords || []).slice(0, 8).map((record) => `${record.recordType}:${record.value}`).join(", ") || "-";
    return [
      `${index + 1}. ${item.target}`,
      `URL: ${item.finalUrl || item.normalizedUrl}`,
      `Status: ${item.status ?? "-"}`,
      `Kind: ${summary.kind}`,
      `Business: ${summary.business} (${Math.round((item.businessProfile?.confidence || 0) * 100)}%)`,
      `Title: ${item.title || "-"}`,
      `IP: ${summary.ips}`,
      `DNS: ${dns}`,
      `Registrar: ${summary.registrar}`,
      `Tech: ${summary.tech}`,
      `Architecture: ${architecture}`,
      `TLS: ${item.tlsCertificate?.commonName || item.tlsCertificate?.issuerOrganization || "-"}`,
      `Favicon mmh3: ${item.faviconMmh3 ?? "-"}`,
      `Artifacts: ${(item.artifactFindings || []).map((artifact) => `${artifact.artifactType}(${artifact.status})`).join(", ") || "-"}`,
      `External hosts: ${(item.externalHosts || []).map((host) => `${host.host}[${host.category}]`).slice(0, 10).join(", ") || "-"}`,
      `Admin candidates: ${item.adminCandidates.map((candidate) => `${candidate.path}(${candidate.status})`).join(", ") || "-"}`,
      `API candidates: ${(item.apiCandidates || []).map((candidate) => candidate.path).slice(0, 12).join(", ") || "-"}`,
      `Auth surface: ${item.authSurface?.riskLevel || "none"} (${item.authSurface?.riskScore ?? 0}) | signals: ${(item.authSurface?.signals || []).join(", ") || "-"}`,
      `Credential surfaces: ${(item.credentialSignals || []).map((signal) => `${signal.surface}[${signal.risk}]`).slice(0, 12).join(", ") || "-"}; attempts: disabled`,
      `Forms: ${item.forms.length}`,
      `Risk tags: ${tags}`,
    ].join("\n");
  });

  if (language === "zh") {
    return `你是远勘研判智能体。请基于以下单次网站远勘结果，只做公开信息研判，不要建议或执行未授权爆破、漏洞利用或绕过行为。请输出：\n1. 站点用途与业务形态判断\n2. 高价值后台、登录入口与认证接口清单\n3. 技术栈、注册商、IP、favicon 等关键信息\n4. 弱口令风险信号与证据说明\n5. 下一步在授权条件下的人工验证建议\n\n${lines.join("\n\n")}`;
  }

  return `You are a recon analysis agent. Based on the following single-pass public web reconnaissance results, perform analysis only. Do not suggest or perform unauthorized brute force, exploitation, or bypass actions. Return:\n1. Likely site purpose and business model\n2. High-value admin, login, and authentication surfaces\n3. Key facts from tech stack, registrar, IP, favicon, TLS certificate, and external services\n4. Weak-password risk signals with evidence\n5. Safe manual validation steps under authorization\n\n${lines.join("\n\n")}`;
}
