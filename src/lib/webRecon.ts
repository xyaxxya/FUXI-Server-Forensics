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
