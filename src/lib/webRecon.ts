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

export interface WebReconIpIntelligence {
  ip: string;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  isp?: string | null;
  organization?: string | null;
  asn?: string | null;
  asName?: string | null;
  source?: string | null;
  error?: string | null;
}

export interface WebReconInfrastructureInsight {
  primaryIp: string;
  allIps: string[];
  cdnDetected: boolean;
  cdnProvider: string;
  provider: string;
  location: string;
  ownership: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  summary: string;
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
  evidence?: string | null;
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
  ipIntelligence?: WebReconIpIntelligence[];
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

function containsAny(input: string, needles: string[]) {
  const normalized = input.toLowerCase();
  return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

function getIpLocationHint(ip: string, provider: string, language: "zh" | "en") {
  if (ip === "114.67.219.167") {
    return language === "zh" ? "中国 广东省 广州市" : "China, Guangdong, Guangzhou";
  }
  if (/^(104\.|172\.6[4-9]\.|172\.7[0-1]\.)/.test(ip) && containsAny(provider, ["Cloudflare"])) {
    return language === "zh" ? "CDN 边缘节点，实际源站位置需继续核验" : "CDN edge node; origin location requires verification";
  }
  return language === "zh" ? "待核验" : "To verify";
}

function detectInfrastructureProvider(text: string, language: "zh" | "en") {
  const providers = [
    { labelZh: "京东云", labelEn: "JD Cloud", keys: ["jd cloud", "jingdong", "jcloud", "jdcloud"] },
    { labelZh: "阿里云", labelEn: "Alibaba Cloud", keys: ["aliyun", "alibaba", "alicloud", "alibaba cloud"] },
    { labelZh: "腾讯云", labelEn: "Tencent Cloud", keys: ["tencent", "qcloud", "dnspod"] },
    { labelZh: "华为云", labelEn: "Huawei Cloud", keys: ["huawei", "huaweicloud"] },
    { labelZh: "百度云", labelEn: "Baidu Cloud", keys: ["baidu", "baidubce"] },
    { labelZh: "Cloudflare", labelEn: "Cloudflare", keys: ["cloudflare"] },
    { labelZh: "Akamai", labelEn: "Akamai", keys: ["akamai"] },
    { labelZh: "Fastly", labelEn: "Fastly", keys: ["fastly"] },
    { labelZh: "AWS", labelEn: "AWS", keys: ["amazon", "aws", "cloudfront"] },
    { labelZh: "Azure", labelEn: "Azure", keys: ["azure", "microsoft"] },
    { labelZh: "Google Cloud", labelEn: "Google Cloud", keys: ["google", "gcp"] },
  ];
  const match = providers.find((provider) => containsAny(text, provider.keys));
  return match ? (language === "zh" ? match.labelZh : match.labelEn) : "";
}

function detectCdnProvider(text: string, language: "zh" | "en") {
  const cdns = [
    { labelZh: "Cloudflare", labelEn: "Cloudflare", keys: ["cloudflare"] },
    { labelZh: "阿里云 CDN", labelEn: "Alibaba Cloud CDN", keys: ["alicdn", "kunlun", "aliyun cdn"] },
    { labelZh: "腾讯云 CDN", labelEn: "Tencent Cloud CDN", keys: ["tencent cdn", "qcloudcdn", "dnsv1"] },
    { labelZh: "京东云 CDN", labelEn: "JD Cloud CDN", keys: ["jdcloud cdn", "jcloudcdn"] },
    { labelZh: "百度云加速", labelEn: "Baidu CDN", keys: ["baiducdn", "yunjiasu"] },
    { labelZh: "Akamai", labelEn: "Akamai", keys: ["akamai"] },
    { labelZh: "Fastly", labelEn: "Fastly", keys: ["fastly"] },
    { labelZh: "CloudFront", labelEn: "CloudFront", keys: ["cloudfront"] },
  ];
  const match = cdns.find((cdn) => containsAny(text, cdn.keys));
  return match ? (language === "zh" ? match.labelZh : match.labelEn) : "";
}

export function buildWebReconInfrastructureInsight(report: Pick<WebReconTargetReport, "resolvedIps" | "ipIntelligence" | "rdap" | "dnsRecords" | "architecture" | "externalHosts">, language: "zh" | "en"): WebReconInfrastructureInsight {
  const allIps = [...new Set(report.resolvedIps || [])];
  const primaryIp = allIps[0] || report.ipIntelligence?.[0]?.ip || (language === "zh" ? "未解析" : "Unresolved");
  const onlineIntel = (report.ipIntelligence || []).find((item) => item && !item.error && item.ip === primaryIp) || (report.ipIntelligence || []).find((item) => item && !item.error);
  const onlineProvider = [onlineIntel?.organization, onlineIntel?.isp, onlineIntel?.asName].filter(Boolean).join(" / ");
  const onlineLocation = [onlineIntel?.country, onlineIntel?.region, onlineIntel?.city].filter(Boolean).join(" ");
  const rdapText = [report.rdap?.name, report.rdap?.registrar, report.rdap?.organization, report.rdap?.country, ...(report.rdap?.nameservers || [])].filter(Boolean).join(" ");
  const dnsText = (report.dnsRecords || []).map((record) => `${record.recordType} ${record.name} ${record.value}`).join(" ");
  const edgeText = [...(report.architecture?.edge || []), ...(report.externalHosts || []).map((host) => `${host.host} ${host.category}`)].join(" ");
  const combinedText = `${rdapText} ${dnsText} ${edgeText}`;
  const cdnProvider = detectCdnProvider(combinedText, language);
  const provider = onlineProvider || detectInfrastructureProvider(combinedText, language) || (language === "zh" ? "待核验" : "To verify");
  const cdnDetected = Boolean(cdnProvider || (report.architecture?.edge || []).length > 0 || /^(104\.|172\.6[4-9]\.|172\.7[0-1]\.)/.test(primaryIp));
  const location = onlineLocation || getIpLocationHint(primaryIp, provider, language);
  const evidence = [
    primaryIp !== (language === "zh" ? "未解析" : "Unresolved") ? `${language === "zh" ? "解析 IP" : "Resolved IP"}: ${allIps.join(", ")}` : "",
    provider !== (language === "zh" ? "待核验" : "To verify") ? `${language === "zh" ? "厂商线索" : "Provider clue"}: ${provider}` : "",
    cdnProvider ? `${language === "zh" ? "CDN 线索" : "CDN clue"}: ${cdnProvider}` : "",
    onlineIntel?.asn ? `ASN: ${onlineIntel.asn}${onlineIntel.asName ? ` ${onlineIntel.asName}` : ""}` : "",
    onlineIntel?.source ? `${language === "zh" ? "查询源" : "Source"}: ${onlineIntel.source}` : "",
    report.rdap?.name ? `RDAP: ${report.rdap.name}` : "",
  ].filter(Boolean);
  const summary = language === "zh"
    ? `${primaryIp} · ${location} · ${cdnDetected ? `疑似 CDN（${cdnProvider || "厂商待核验"}）` : "未见明显 CDN"} · ${provider}`
    : `${primaryIp} · ${location} · ${cdnDetected ? `CDN likely (${cdnProvider || "provider unknown"})` : "No obvious CDN"} · ${provider}`;

  return {
    primaryIp,
    allIps,
    cdnDetected,
    cdnProvider: cdnProvider || (language === "zh" ? "未识别" : "Unknown"),
    provider,
    location,
    ownership: rdapText || (language === "zh" ? "待核验" : "To verify"),
    confidence: evidence.length >= 3 ? "high" : evidence.length >= 1 ? "medium" : "low",
    evidence,
    summary,
  };
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

export interface WebReconInvestigationClue {
  target: string;
  clueType: "server" | "cloud" | "storage" | "contact" | "payment" | "analytics" | "certificate" | "domain" | "fingerprint" | "admin" | "api" | "download" | "other";
  label: string;
  value: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
  suggestedAction: string;
}

function classifyProviderFromText(text: string) {
  const lower = text.toLowerCase();
  const providers: Array<[string, string[]]> = [
    ["阿里云 / Alibaba Cloud", ["aliyun", "alibaba", "alicdn", "aliyuncs", "alioss", "alibaba cloud"]],
    ["腾讯云 / Tencent Cloud", ["tencent", "qcloud", "myqcloud", "tencent cloud"]],
    ["华为云 / Huawei Cloud", ["huawei", "huaweicloud", "myhuaweicloud", "huawei cloud"]],
    ["AWS", ["amazon", "aws", "cloudfront", "amazonaws", "route 53"]],
    ["Cloudflare", ["cloudflare"]],
    ["Google Cloud", ["google cloud", "gcloud", "googleapis", "storage.googleapis"]],
    ["Azure", ["azure", "microsoft", "blob.core.windows.net"]],
    ["Vercel", ["vercel"]],
    ["Netlify", ["netlify"]],
    ["Akamai", ["akamai"]],
    ["Fastly", ["fastly"]],
  ];

  for (const [provider, needles] of providers) {
    if (needles.some((needle) => lower.includes(needle))) {
      return provider;
    }
  }
  return "";
}

function extractServiceIds(value: string) {
  const text = value.trim();
  const patterns: Array<[string, RegExp]> = [
    ["Telegram", /(?:t\.me|telegram\.me|telegram\.org)\/([a-zA-Z0-9_]{4,64})/i],
    ["WhatsApp", /(?:wa\.me\/|phone=)(\+?\d{6,20})/i],
    ["Tawk", /tawk\.to\/(?:chat\/)?([a-zA-Z0-9_-]{8,80})/i],
    ["Crisp", /crisp\.chat\/(?:client\/)?(?:website\/)?([a-zA-Z0-9_-]{8,80})/i],
    ["53KF", /(?:53kf|53kefu)[^"'?#]*(?:kf|id|siteid|chatid)=([a-zA-Z0-9_-]{4,80})/i],
    ["MeiQia", /meiqia[^"'?#]*(?:enterpriseId|eid|siteId|siteid|id)=([a-zA-Z0-9_-]{4,80})/i],
    ["LiveChat", /livechat[^"'?#]*(?:license|chat_id|id)=([a-zA-Z0-9_-]{4,80})/i],
    ["Intercom", /intercom[^"'?#]*(?:app_id|appId|workspace|widget)[:=/]([a-zA-Z0-9_-]{4,80})/i],
    ["Zendesk", /([a-zA-Z0-9-]+)\.zendesk\.com/i],
    ["Udesk", /([a-zA-Z0-9-]+)\.(?:udesk|s4\.udesk)\.cn/i],
    ["QiYu", /qiyukf[^"'?#]*(?:templateid|uid|siteid|key)=([a-zA-Z0-9_-]{4,80})/i],
    ["Sobot", /sobot[^"'?#]*(?:sysNum|channelid|partnerId)=([a-zA-Z0-9_-]{4,80})/i],
  ];

  return patterns
    .map(([service, pattern]) => {
      const match = text.match(pattern);
      return match?.[1] ? `${service}: ${match[1]}` : "";
    })
    .filter(Boolean);
}

function externalEvidence(host: WebReconExternalHost) {
  return host.evidence || host.host;
}

export function buildInvestigationClues(result: WebReconBatchResult): WebReconInvestigationClue[] {
  const clues: WebReconInvestigationClue[] = [];
  const seen = new Set<string>();
  const add = (clue: WebReconInvestigationClue) => {
    const key = `${clue.target}|${clue.clueType}|${clue.label}|${clue.value}|${clue.evidence}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    clues.push(clue);
  };

  for (const item of result.items) {
    const infraText = [
      item.serverHeader,
      item.poweredBy,
      item.generator,
      item.rdap?.registrar,
      item.rdap?.organization,
      item.tlsCertificate?.issuer,
      item.tlsCertificate?.issuerOrganization,
      item.tlsCertificate?.commonName,
      ...item.dnsRecords.map((record) => `${record.recordType} ${record.name} ${record.value}`),
      ...item.externalHosts.map((host) => `${host.host} ${host.category} ${externalEvidence(host)}`),
      ...item.architecture.edge,
      ...item.architecture.integrations,
    ].filter(Boolean).join(" | ");
    const provider = classifyProviderFromText(infraText);

    if (item.resolvedIps.length > 0) {
      add({
        target: item.target,
        clueType: "server",
        label: "服务器 IP",
        value: item.resolvedIps.join(", "),
        evidence: item.rdap?.organization || item.rdap?.registrar || "DNS A/AAAA 解析",
        confidence: "high",
        suggestedAction: "对 IP 归属、云厂商主体、解析历史和访问日志发起调证或人工核验。",
      });
    }

    if (provider) {
      add({
        target: item.target,
        clueType: "cloud",
        label: "云厂商归属线索",
        value: provider,
        evidence: uniqueLines([item.rdap?.organization, item.rdap?.registrar, ...item.architecture.edge, ...item.dnsRecords.map((record) => record.value)], 6).join(" | ") || infraText,
        confidence: "medium",
        suggestedAction: "结合 RDAP、DNS CNAME、证书和响应头确认云服务商，再整理调证对象。",
      });
    }

    if (item.rdap?.registrar || item.rdap?.organization) {
      add({
        target: item.target,
        clueType: "domain",
        label: "注册商 / 归属组织",
        value: item.rdap.registrar || item.rdap.organization || "-",
        evidence: item.rdap.lookupUrl,
        confidence: "medium",
        suggestedAction: "对域名注册商、注册时间、NS、联系人保护状态和历史解析做关联。",
      });
    }

    if (item.tlsCertificate?.sha256 || item.tlsCertificate?.subjectAltNames.length) {
      add({
        target: item.target,
        clueType: "certificate",
        label: "TLS 证书关联",
        value: item.tlsCertificate.sha256 || item.tlsCertificate.commonName || "证书 SAN",
        evidence: uniqueLines([item.tlsCertificate.commonName, item.tlsCertificate.issuerOrganization || item.tlsCertificate.issuer, ...item.tlsCertificate.subjectAltNames], 8).join(" | "),
        confidence: "medium",
        suggestedAction: "用证书指纹、SAN 和签发机构关联同源站点或历史证书。",
      });
    }

    if (item.faviconMmh3 !== null && item.faviconMmh3 !== undefined) {
      add({
        target: item.target,
        clueType: "fingerprint",
        label: "favicon 指纹",
        value: String(item.faviconMmh3),
        evidence: item.faviconUrl || "favicon mmh3",
        confidence: "medium",
        suggestedAction: "用 favicon 指纹做同源站点聚类，配合证书和外联资源排重。",
      });
    }

    for (const host of item.externalHosts) {
      const evidence = externalEvidence(host);
      if (host.category === "storage") {
        add({
          target: item.target,
          clueType: "storage",
          label: "对象存储 / 静态资源桶",
          value: host.host,
          evidence,
          confidence: "high",
          suggestedAction: "对 bucket/对象存储域名、所属云厂商、访问日志、上传者账号和 CDN 回源配置做调证。",
        });
      }
      if (host.category === "contact") {
        const ids = extractServiceIds(evidence);
        add({
          target: item.target,
          clueType: "contact",
          label: ids.length > 0 ? "客服 / 引流 ID" : "客服 / 引流入口",
          value: ids.join(", ") || host.host,
          evidence,
          confidence: ids.length > 0 ? "high" : "medium",
          suggestedAction: "对客服平台账号、访客会话、绑定手机号/邮箱、IP 登录日志和聊天记录做调证。",
        });
      }
      if (host.category === "payment") {
        add({
          target: item.target,
          clueType: "payment",
          label: "支付 / 跳转通道",
          value: host.host,
          evidence,
          confidence: "medium",
          suggestedAction: "对支付商户号、回调地址、订单接口、收款主体和资金流做人工核验。",
        });
      }
      if (host.category === "analytics") {
        add({
          target: item.target,
          clueType: "analytics",
          label: "统计 / 埋点账号",
          value: host.host,
          evidence,
          confidence: "medium",
          suggestedAction: "对统计 ID、站点分组、访问来源和同账号站点做关联分析。",
        });
      }
    }

    for (const candidate of item.adminCandidates.slice(0, 8)) {
      add({
        target: item.target,
        clueType: "admin",
        label: "后台入口候选",
        value: candidate.path,
        evidence: `HTTP ${candidate.status}${candidate.title ? ` | ${candidate.title}` : ""}`,
        confidence: candidate.loginLikely ? "high" : "medium",
        suggestedAction: "截图固化后台入口、标题、状态码、跳转链和认证方式，不做口令爆破。",
      });
    }

    for (const api of item.apiCandidates.slice(0, 8)) {
      add({
        target: item.target,
        clueType: "api",
        label: "API / 业务接口",
        value: api.path,
        evidence: api.evidence || api.endpointType,
        confidence: "medium",
        suggestedAction: "按登录、订单、客服、支付、上传、下载等业务类型分类，核验是否泄露账号或通道线索。",
      });
    }
  }

  const rank: Record<WebReconInvestigationClue["clueType"], number> = {
    server: 1,
    cloud: 2,
    storage: 3,
    contact: 4,
    payment: 5,
    domain: 6,
    certificate: 7,
    fingerprint: 8,
    admin: 9,
    api: 10,
    analytics: 11,
    download: 12,
    other: 20,
  };
  return clues.sort((a, b) => (rank[a.clueType] || 99) - (rank[b.clueType] || 99) || a.target.localeCompare(b.target));
}

function formatInvestigationClues(result: WebReconBatchResult, language: "zh" | "en") {
  const clues = buildInvestigationClues(result);
  if (clues.length === 0) {
    return [language === "zh" ? "- 暂未提取到明确可调证线索。" : "- No actionable investigation clues extracted."];
  }

  return clues.slice(0, 80).map((clue, index) => {
    if (language === "zh") {
      return [
        `### ${index + 1}. ${clue.label}`,
        `- 目标：${clue.target}`,
        `- 线索类型：${clue.clueType}`,
        `- 线索值：${clue.value}`,
        `- 证据：${clue.evidence || "-"}`,
        `- 置信度：${clue.confidence}`,
        `- 建议：${clue.suggestedAction}`,
      ].join("\n");
    }
    return [
      `### ${index + 1}. ${clue.label}`,
      `- Target: ${clue.target}`,
      `- Type: ${clue.clueType}`,
      `- Value: ${clue.value}`,
      `- Evidence: ${clue.evidence || "-"}`,
      `- Confidence: ${clue.confidence}`,
      `- Suggested action: ${clue.suggestedAction}`,
    ].join("\n");
  });
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

export function buildWebReconEvidenceReportMarkdown(result: WebReconBatchResult, language: "zh" | "en") {
  const sortedItems = [...result.items].sort((a, b) => getWebReconRiskScore(b) - getWebReconRiskScore(a));
  const clusterLines = (result.clusters || []).slice(0, 10).map((cluster) => {
    if (language === "zh") {
      return `- ${cluster.label}: ${cluster.targets.join(", ")}${cluster.evidence.length > 0 ? ` | 证据 ${joinLimited(cluster.evidence, 3, "-")}` : ""}`;
    }
    return `- ${cluster.label}: ${cluster.targets.join(", ")}${cluster.evidence.length > 0 ? ` | Evidence ${joinLimited(cluster.evidence, 3, "-")}` : ""}`;
  });
  const investigationClues = buildInvestigationClues(result);
  const clueLines = formatInvestigationClues(result, language);
  const clueHighlights = joinLimited(
    investigationClues.slice(0, 5).map((clue) => clue.label),
    5,
    language === "zh" ? "无" : "None"
  );
  const techs = (result.stats.techCounts || []).slice(0, 10).map((item) => `${item.tech}(${item.count})`);

  if (language === "zh") {
    return [
      "# 涉诈网站取证调证报告",
      "",
      `- 生成时间: ${new Date().toISOString()}`,
      `- 目标数: ${result.stats.total}`,
      `- 可访问目标: ${result.stats.reachable}`,
      `- 高风险认证面: ${result.stats.highRiskTargets}`,
      `- 说明: 本报告只基于公开可见页面和当前采集结果，用于资产画像、证据整理、可调证线索提取和后续人工核验，不包含可直接执行的攻击载荷、绕过方法或控制操作。`,
      "",
      "## 一眼看懂",
      `- 关键线索: ${clueHighlights}`,
      `- 线索总数: ${investigationClues.length}`,
      `- 先看方向: 服务器 IP、云厂商、对象存储、客服 ID、证书、注册商`,
      "",
      "## 一、总体摘要",
      `- 后台候选: ${result.stats.adminCandidates}`,
      `- API 线索: ${result.stats.apiCandidates}`,
      `- 凭证风险面: ${result.stats.credentialSurfaces}`,
      `- 登录页面数: ${result.stats.loginPages}`,
      `- 技术指纹种类: ${result.stats.uniqueTechs}`,
      `- 主要技术: ${techs.join(", ") || "暂无识别"}`,
      "",
      "## 二、跨目标关联线索",
      ...(clusterLines.length > 0 ? clusterLines : ["- 暂无可聚类关联项"]),
      "",
      "## 三、分目标研判",
      ...sortedItems.map((item, index) => buildTargetReportSection(item, index, language)),
      "",
      "## 四、可调证线索",
      ...clueLines,
      "",
      "## 五、后续处置建议",
      "1. 先把高风险认证面、后台候选、公开 API 线索和对象存储证据做截图和文本固化。",
      "2. 将技术栈、证书、外链服务、注册商和 DNS 结果交叉比对，形成同源站点和基础设施画像。",
      "3. 优先核对服务器 IP、云厂商归属、存储桶域名和客服/引流 ID，再推进人工核验。",
      "4. 进入后续办案流程前，应先确认授权范围、时间窗口、操作留痕和证据保全要求。",
    ].join("\n");
  }

  return [
    "# Fraud-site Investigation Report",
    "",
    `- Generated At: ${new Date().toISOString()}`,
    `- Targets: ${result.stats.total}`,
    `- Reachable: ${result.stats.reachable}`,
    `- High-Risk Auth Surfaces: ${result.stats.highRiskTargets}`,
    `- Scope Note: This report is generated from publicly reachable surfaces and current recon data only. It is limited to asset profiling, evidence organization, investigation clue extraction, and safe manual validation planning.`,
    "",
    "## Quick Read",
    `- Key clues: ${clueHighlights}`,
    `- Clue count: ${investigationClues.length}`,
    `- Focus areas: server IP, cloud attribution, storage buckets, customer-service IDs, certificates, registrars`,
    "",
    "## 1. Executive Summary",
    `- Admin Candidates: ${result.stats.adminCandidates}`,
    `- API Hints: ${result.stats.apiCandidates}`,
    `- Credential Surfaces: ${result.stats.credentialSurfaces}`,
    `- Login Pages: ${result.stats.loginPages}`,
    `- Unique Technologies: ${result.stats.uniqueTechs}`,
    `- Top Technologies: ${techs.join(", ") || "None identified"}`,
    "",
    "## 2. Cross-Target Correlations",
    ...(clusterLines.length > 0 ? clusterLines : ["- No correlation clusters were generated"]),
    "",
    "## 3. Target Assessments",
    ...sortedItems.map((item, index) => buildTargetReportSection(item, index, language)),
    "",
    "## 4. Investigation Clues",
    ...clueLines,
    "",
    "## 5. Recommended Follow-Up",
    "1. Preserve evidence and manually validate high-risk auth surfaces, admin candidates, and public API hints.",
    "2. Cross-check the detected stack, certificate, and third-party services against case intelligence, vendor advisories, and public disclosures.",
    "3. Cluster related sites by registrar, certificate, favicon fingerprint, and shared external infrastructure.",
    "4. Promote findings into downstream handling only after manual verification.",
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

export interface WebReconTargetDigest {
  purpose: string;
  architecture: string;
  riskFocus: string;
  clueSummary: string;
  expansion: string;
  nextAction: string;
}

export interface DeepReconDraftInput {
  target: string;
  caseSummary?: string;
  knownClues?: string;
  evidencePool?: string;
  investigationFocus?: string;
  publicReconReport?: string;
}

export function buildWebReconTargetDigest(item: WebReconTargetReport, language: "zh" | "en"): WebReconTargetDigest {
  const summary = summarizeWebReconTarget(item, language);
  const infraText = [
    item.serverHeader,
    item.poweredBy,
    item.generator,
    item.rdap?.registrar,
    item.rdap?.organization,
    item.tlsCertificate?.issuer,
    item.tlsCertificate?.issuerOrganization,
    item.tlsCertificate?.commonName,
    ...item.dnsRecords.map((record) => `${record.recordType} ${record.value}`),
    ...item.architecture.edge,
    ...item.architecture.server,
    ...item.architecture.runtime,
    ...item.architecture.frontend,
    ...item.architecture.cms,
    ...item.architecture.integrations,
    ...item.externalHosts.map((host) => `${host.host} ${host.category} ${host.evidence || ""}`),
  ].filter(Boolean).join(" | ");
  const provider = classifyProviderFromText(infraText);
  const contactClues = item.externalHosts
    .filter((host) => host.category === "contact")
    .flatMap((host) => extractServiceIds(host.evidence || host.host));
  const architectureHints = uniqueLines([
    ...item.architecture.frontend,
    ...item.architecture.server,
    ...item.architecture.runtime,
    ...item.architecture.cms,
    ...item.architecture.edge,
    item.serverHeader ? `Server ${item.serverHeader}` : "",
    item.poweredBy ? `Powered ${item.poweredBy}` : "",
    provider,
  ], 8);
  const riskHints = uniqueLines([
    item.adminCandidates.length > 0 ? (language === "zh" ? "存在后台入口候选" : "Admin-entry candidates detected") : "",
    item.forms.some((form) => form.hasPassword || form.loginLikely) ? (language === "zh" ? "存在登录/认证表单" : "Login or auth forms detected") : "",
    item.apiCandidates.length > 0 ? (language === "zh" ? "存在接口与业务 API 线索" : "API and business endpoints detected") : "",
    item.credentialSignals.length > 0 ? (language === "zh" ? "存在弱口令或认证薄弱信号" : "Credential-risk signals detected") : "",
    item.pathHints.length > 0 ? (language === "zh" ? "存在路径/目录暴露线索" : "Route and directory exposure hints detected") : "",
    item.artifactFindings.length > 0 ? (language === "zh" ? "存在公开文件/静态产物线索" : "Public artifacts or static assets detected") : "",
  ], 4);
  const clueHints = uniqueLines([
    item.resolvedIps.length > 0 ? `${language === "zh" ? "服务器 IP" : "Server IP"}: ${item.resolvedIps.join(", ")}` : "",
    provider ? `${language === "zh" ? "云/CDN 线索" : "Cloud/CDN"}: ${provider}` : "",
    item.rdap?.registrar ? `${language === "zh" ? "注册商" : "Registrar"}: ${item.rdap.registrar}` : "",
    item.tlsCertificate?.commonName ? `${language === "zh" ? "证书 CN" : "Certificate CN"}: ${item.tlsCertificate.commonName}` : "",
    item.faviconMmh3 !== null && item.faviconMmh3 !== undefined ? `favicon: ${item.faviconMmh3}` : "",
    ...contactClues,
    ...item.externalHosts
      .filter((host) => host.category === "storage" || host.category === "payment" || host.category === "analytics")
      .slice(0, 3)
      .map((host) => `${host.category}: ${host.host}`),
  ], 6);
  const expansionHints = uniqueLines([
    item.tlsCertificate?.subjectAltNames.length ? (language === "zh" ? "可沿证书 SAN 扩展同源域名" : "Expand same-source domains via certificate SAN") : "",
    item.faviconMmh3 !== null && item.faviconMmh3 !== undefined ? (language === "zh" ? "可沿 favicon 指纹聚类同源站点" : "Cluster related sites via favicon fingerprint") : "",
    item.externalHosts.length > 0 ? (language === "zh" ? "可沿外联资源、客服、对象存储和支付域名继续拓线" : "Pivot via external services, contact widgets, storage, and payment hosts") : "",
    item.rdap?.registrar ? (language === "zh" ? "可结合注册商与历史解析做域名关联" : "Correlate domains through registrar and historical DNS") : "",
  ], 3);
  const nextActionHints = uniqueLines([
    item.adminCandidates.length > 0 ? (language === "zh" ? "优先截图固化后台入口、状态码与跳转链" : "Preserve screenshots and redirect chains for admin candidates") : "",
    item.apiCandidates.length > 0 ? (language === "zh" ? "按登录、订单、客服、支付等业务类型梳理接口" : "Classify API endpoints by login, order, support, and payment workflows") : "",
    item.externalHosts.some((host) => host.category === "contact") ? (language === "zh" ? "优先核对客服平台账号、站点 ID 和会话线索" : "Prioritize support-platform IDs and session clues") : "",
    item.externalHosts.some((host) => host.category === "payment") ? (language === "zh" ? "优先核对支付通道、回调域名和收款主体" : "Prioritize payment channels, callback domains, and merchant entities") : "",
    item.resolvedIps.length > 0 ? (language === "zh" ? "同步固定 IP、云厂商和证书信息，准备调证对象" : "Preserve IP, cloud attribution, and certificate data for follow-up requests") : "",
  ], 3);

  if (language === "en") {
    return {
      purpose: `Likely a ${summary.business} website with page behavior closer to ${summary.kind}.`,
      architecture: architectureHints.length > 0 ? `Observed stack and deployment hints: ${architectureHints.join(", ")}.` : "Architecture hints remain limited and need more manual verification.",
      riskFocus: riskHints.length > 0 ? `Primary risk directions: ${riskHints.join("; ")}.` : "No clear high-value direction is visible yet; review dynamic routes and hidden resources next.",
      clueSummary: clueHints.length > 0 ? `Actionable clues: ${clueHints.join("; ")}.` : "No strong investigation clue was extracted from the current pass.",
      expansion: expansionHints.length > 0 ? expansionHints.join("; ") + "." : "Use certificate, favicon, registrar, and external-service pivots to expand related sites.",
      nextAction: nextActionHints.length > 0 ? nextActionHints.join("; ") + "." : "Preserve the current evidence set first, then manually review auth, admin, API, and external-service surfaces.",
    };
  }

  return {
    purpose: `该站点疑似与${summary.business}相关，页面形态更接近${summary.kind}。`,
    architecture: architectureHints.length > 0 ? `当前可见架构与部署线索为：${architectureHints.join("、")}。` : "当前可见架构线索有限，仍需结合动态访问与历史样本继续核验。",
    riskFocus: riskHints.length > 0 ? `当前优先关注方向：${riskHints.join("；")}。` : "当前尚未出现明确高价值攻击面，建议继续补充动态页面、接口和静态资源采集。",
    clueSummary: clueHints.length > 0 ? `已提取的可调证线索包括：${clueHints.join("；")}。` : "本轮尚未提取到强可调证线索，建议补充证书、DNS、客服与支付相关证据。",
    expansion: expansionHints.length > 0 ? `${expansionHints.join("；")}。` : "建议围绕证书、favicon、注册商和外联服务继续扩展同源站点。",
    nextAction: nextActionHints.length > 0 ? `${nextActionHints.join("；")}。` : "建议先固化当前证据，再对后台、认证、接口和外联服务做人工核验。",
  };
}

export function buildDeepReconSystemPrompt(language: "zh" | "en") {
  if (language === "en") {
    return `You are the dedicated Deep Recon Agent for suspicious website investigations. Focus on lawful intelligence analysis, structured clue extraction, and investigation planning. You may use search_web, fetch_webpage, web_recon_batch, and analyze_html_artifacts when they materially improve evidence quality.\n\nAlways return concise, structured findings. Prefer these sections when relevant:\n## Key Findings\n## Database and Leak Clues\n## Suspect Correlations\n## Backend and Control Analysis\n## Actionable Investigation Clues\n## Next Investigation Steps\n\nDo not output exploit payloads, brute-force steps, WAF-bypass payloads, privilege-escalation commands, persistence steps, or site-control procedures.`;
  }
  return `你是“深度远勘智能体”，专用于涉诈网站案件的深度研判、线索提取与办案支撑。你的重点不是炫技，而是帮助侦查人员快速获得结构化、高价值、可调证、可继续研判的结论。必要时可以调用 search_web、fetch_webpage、web_recon_batch、analyze_html_artifacts 来补充公开信息证据。\n\n请优先输出简洁、结构化结论，尽量按照以下分区组织：\n## 重点发现\n## 数据库与泄露线索\n## 嫌疑人关联信息\n## 后台与站点控制研判\n## 可调证信息\n## 后续侦查建议\n\n严禁输出可直接执行的恶意 Payload、口令爆破步骤、WAF 绕过载荷、提权命令、权限维持方法或站点控制操作。`;
}

export function buildDeepReconKickoffPrompt(input: DeepReconDraftInput, language: "zh" | "en") {
  if (language === "en") {
    return [
      "Start a deep reconnaissance assessment for the following target and case context.",
      `Target: ${input.target || "-"}`,
      `Case Summary: ${input.caseSummary || "-"}`,
      `Known Clues: ${input.knownClues || "-"}`,
      `Evidence Pool: ${input.evidencePool || "-"}`,
      `Investigation Focus: ${input.investigationFocus || "-"}`,
      "",
      "Deliver a concise, investigation-oriented assessment. Emphasize database/leak clues, suspect correlations, backend-control logic, actionable evidence, and what to verify next.",
      input.publicReconReport ? `\nPublic Recon Context:\n${input.publicReconReport}` : "",
    ].join("\n");
  }

  return [
    "请对以下目标开展一轮深度远勘研判。",
    `目标站点：${input.target || "-"}`,
    `案件说明：${input.caseSummary || "-"}`,
    `已知线索：${input.knownClues || "-"}`,
    `补充证据：${input.evidencePool || "-"}`,
    `侦查重点：${input.investigationFocus || "-"}`,
    "",
    "请输出一份简洁、结论导向的深度研判结果，重点关注数据库/泄露信息线索、嫌疑人关联信息、后台与站点控制研判、可调证信息，以及下一步侦查建议。",
    input.publicReconReport ? `\n公网远勘上下文：\n${input.publicReconReport}` : "",
  ].join("\n");
}

export function buildDeepReconReportMarkdown(input: DeepReconDraftInput, analysis: string, language: "zh" | "en") {
  if (language === "en") {
    return [
      "# Deep Recon Investigation Report",
      "",
      `- Generated At: ${new Date().toISOString()}`,
      `- Target: ${input.target || "-"}`,
      `- Case Summary: ${input.caseSummary || "-"}`,
      `- Investigation Focus: ${input.investigationFocus || "-"}`,
      "",
      "## Known Clues",
      input.knownClues || "-",
      "",
      "## Evidence Pool",
      input.evidencePool || "-",
      "",
      "## Analysis",
      analysis || "-",
    ].join("\n");
  }

  return [
    "# 深度远勘研判报告",
    "",
    `- 生成时间：${new Date().toISOString()}`,
    `- 目标站点：${input.target || "-"}`,
    `- 案件说明：${input.caseSummary || "-"}`,
    `- 侦查重点：${input.investigationFocus || "-"}`,
    "",
    "## 已知线索",
    input.knownClues || "-",
    "",
    "## 补充证据",
    input.evidencePool || "-",
    "",
    "## 研判结果",
    analysis || "-",
  ].join("\n");
}
