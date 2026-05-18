import { invoke } from "@tauri-apps/api/core";
import type { AIMessage, Tool, ToolCall } from "./ai";
import type { Language } from "../translations";
import type { WebReconBatchResult } from "./webRecon";

interface WebSearchItem {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
}

interface WebPageResult {
  url: string;
  title: string;
  content: string;
}

interface WebSearchToolResult {
  type: "web_search_results";
  query: string;
  result_count: number;
  items: WebSearchItem[];
}

interface WebPageToolResult extends WebPageResult {
  type: "web_page";
}

interface LocalWebHeader {
  name: string;
  value: string;
}

interface LocalWebRequestToolResult {
  requestUrl: string;
  finalUrl: string;
  method: string;
  status: number;
  redirected: boolean;
  title?: string | null;
  contentType?: string | null;
  headers: LocalWebHeader[];
  bodyExcerpt: string;
  textExcerpt: string;
  truncated: boolean;
  cookieNames: string[];
}

interface HtmlLinkFinding {
  href: string;
  text: string;
  sameOrigin: boolean;
  source: string;
}

interface HtmlFormFinding {
  action: string;
  method: string;
  fieldNames: string[];
  hiddenFields: string[];
  passwordFields: string[];
  fileFields: string[];
  submitLabels: string[];
  csrfLikeFields: string[];
}

interface HtmlScriptFinding {
  src: string;
  sameOrigin: boolean;
}

interface HtmlHiddenInputFinding {
  name: string;
  valueExcerpt: string;
}

interface HtmlAnalysisToolResult {
  type: "html_analysis";
  title: string | null;
  baseUrl: string | null;
  generator: string | null;
  forms: HtmlFormFinding[];
  links: HtmlLinkFinding[];
  scripts: HtmlScriptFinding[];
  hiddenInputs: HtmlHiddenInputFinding[];
  apiCandidates: string[];
  routeHints: string[];
  metaRefreshTargets: string[];
  inlineScriptHints: string[];
  comments: string[];
  textClues: string[];
}

const HTML_ANALYSIS_DEFAULT_LIMIT = 24;

function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clipText(value: string, maxLength = 120) {
  const normalized = normalizeInlineText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function dedupeStrings(values: Array<string | null | undefined>, limit = HTML_ANALYSIS_DEFAULT_LIMIT) {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    const normalized = typeof value === "string" ? value.trim() : "";
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(normalized);
    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

function dedupeByKey<T>(values: T[], getKey: (value: T) => string, limit = HTML_ANALYSIS_DEFAULT_LIMIT) {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const value of values) {
    const key = getKey(value).trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(value);
    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

function shouldSkipUrlCandidate(value: string) {
  return /^(?:#|javascript:|mailto:|tel:|data:)/i.test(value.trim());
}

function isPathLikeCandidate(value: string) {
  return /^(?:https?:\/\/|\/|\.\.?\/)/i.test(value.trim());
}

function resolveUrlCandidate(value: string, baseUrl?: string | null) {
  const trimmed = value.trim();
  if (!trimmed || shouldSkipUrlCandidate(trimmed)) {
    return null;
  }

  try {
    if (baseUrl) {
      return new URL(trimmed, baseUrl).toString();
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).toString();
    }
  } catch {
    return null;
  }

  return isPathLikeCandidate(trimmed) ? trimmed : null;
}

function isSameOriginUrl(value: string, baseUrl?: string | null) {
  if (!baseUrl) {
    return false;
  }

  try {
    return new URL(value, baseUrl).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

function scoreRouteHint(value: string) {
  const lower = value.toLowerCase();
  let score = 0;
  if (lower.includes("/admin") || lower.includes("/manage")) score += 40;
  if (lower.includes("/api") || lower.includes("/graphql")) score += 34;
  if (lower.includes("login") || lower.includes("auth")) score += 30;
  if (lower.includes("upload") || lower.includes("download")) score += 26;
  if (lower.includes("debug") || lower.includes("test") || lower.includes("dev")) score += 22;
  if (lower.includes("flag") || lower.includes("secret") || lower.includes("token")) score += 20;
  if (lower.includes("?")) score += 10;
  if (/^https?:\/\//i.test(lower)) score += 6;
  return score;
}

function extractQuotedPathCandidates(input: string, baseUrl?: string | null, limit = HTML_ANALYSIS_DEFAULT_LIMIT * 2) {
  const matches: string[] = [];
  const patterns = [
    /["'`](\/[^"'`\s<>{}]{1,200})["'`]/g,
    /["'`]((?:\.\.?\/)[^"'`\s<>{}]{1,200})["'`]/g,
    /["'`](https?:\/\/[^"'`\s<>{}]{1,200})["'`]/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(input)) !== null) {
      const resolved = resolveUrlCandidate(match[1], baseUrl);
      if (resolved) {
        matches.push(resolved);
      }
      if (matches.length >= limit * 4) {
        break;
      }
    }
    if (matches.length >= limit * 4) {
      break;
    }
  }

  return dedupeStrings(
    matches.sort((a, b) => scoreRouteHint(b) - scoreRouteHint(a) || a.localeCompare(b)),
    limit
  );
}

function extractCommentSnippets(doc: Document, limit = 8) {
  const comments: string[] = [];
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
  let current = walker.nextNode();
  while (current) {
    const text = clipText(current.textContent || "", 220);
    if (text.length >= 3) {
      comments.push(text);
    }
    if (comments.length >= limit * 3) {
      break;
    }
    current = walker.nextNode();
  }
  return dedupeStrings(comments, limit);
}

function extractTextClues(doc: Document, comments: string[], limit = 10) {
  const keyword = /\b(flag|admin|debug|token|secret|hint|todo|backup|upload|download|api|graphql|login|auth|internal|staging|test|dev)\b/i;
  const sources = [
    ...(doc.body?.textContent?.split(/[\r\n]+/) || []),
    ...comments,
  ];
  const clues = sources
    .map((item) => clipText(item, 220))
    .filter((item) => item.length >= 4 && keyword.test(item));
  return dedupeStrings(clues, limit);
}

function analyzeHtmlArtifacts(html: string, baseUrl?: string | null, maxItems = HTML_ANALYSIS_DEFAULT_LIMIT): HtmlAnalysisToolResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const titleText = normalizeInlineText(doc.querySelector("title")?.textContent || "");
  const generatorText = normalizeInlineText(doc.querySelector('meta[name="generator"]')?.getAttribute("content") || "");
  const fallbackAction = resolveUrlCandidate(baseUrl || "", baseUrl) || baseUrl?.trim() || "(same page)";

  const forms = dedupeByKey(
    Array.from(doc.querySelectorAll("form")).map((form) => {
      const action =
        resolveUrlCandidate(form.getAttribute("action") || "", baseUrl) ||
        fallbackAction;
      const method = (form.getAttribute("method") || "GET").toUpperCase();
      const fieldNames = dedupeStrings(
        Array.from(form.querySelectorAll("input[name], select[name], textarea[name], button[name]")).map((field) => field.getAttribute("name")),
        maxItems
      );
      const hiddenFields = dedupeStrings(
        Array.from(form.querySelectorAll('input[type="hidden"][name]')).map((field) => field.getAttribute("name")),
        maxItems
      );
      const passwordFields = dedupeStrings(
        Array.from(form.querySelectorAll('input[type="password"][name]')).map((field) => field.getAttribute("name")),
        maxItems
      );
      const fileFields = dedupeStrings(
        Array.from(form.querySelectorAll('input[type="file"][name]')).map((field) => field.getAttribute("name")),
        maxItems
      );
      const submitLabels = dedupeStrings(
        Array.from(form.querySelectorAll('button, input[type="submit"], input[type="button"]')).map((field) => {
          if (field instanceof HTMLInputElement) {
            return field.value || field.getAttribute("name") || "";
          }
          return field.textContent || field.getAttribute("name") || "";
        }),
        6
      );
      const csrfLikeFields = dedupeStrings(
        fieldNames.filter((name) => /csrf|xsrf|token|nonce|authenticity/i.test(name)),
        8
      );
      return {
        action,
        method,
        fieldNames,
        hiddenFields,
        passwordFields,
        fileFields,
        submitLabels,
        csrfLikeFields,
      };
    }),
    (item) => `${item.method} ${item.action} ${item.fieldNames.join("|")}`,
    maxItems
  );

  const links = dedupeByKey(
    Array.from(doc.querySelectorAll("a[href], iframe[src], frame[src]")).map((element) => {
      const attribute = element.hasAttribute("href") ? "href" : "src";
      const raw = element.getAttribute(attribute) || "";
      const href = resolveUrlCandidate(raw, baseUrl) || raw.trim();
      const text = clipText(element.textContent || element.getAttribute("title") || element.getAttribute("name") || "", 96);
      return {
        href,
        text,
        sameOrigin: isSameOriginUrl(href, baseUrl),
        source: element.tagName.toLowerCase(),
      };
    }).filter((item) => !!item.href && !shouldSkipUrlCandidate(item.href)),
    (item) => `${item.source} ${item.href}`,
    maxItems
  );

  const scripts = dedupeByKey(
    Array.from(doc.querySelectorAll("script[src]")).map((script) => {
      const src = resolveUrlCandidate(script.getAttribute("src") || "", baseUrl) || (script.getAttribute("src") || "").trim();
      return {
        src,
        sameOrigin: isSameOriginUrl(src, baseUrl),
      };
    }).filter((item) => !!item.src),
    (item) => item.src,
    maxItems
  );

  const hiddenInputs = dedupeByKey(
    Array.from(doc.querySelectorAll('input[type="hidden"][name]')).map((field) => ({
      name: field.getAttribute("name") || "",
      valueExcerpt: clipText((field.getAttribute("value") || "").replace(/\s+/g, " "), 80),
    })).filter((item) => item.name),
    (item) => item.name,
    maxItems
  );

  const metaRefreshTargets = dedupeStrings(
    Array.from(doc.querySelectorAll("meta[http-equiv]"))
      .filter((meta) => /refresh/i.test(meta.getAttribute("http-equiv") || ""))
      .map((meta) => {
        const content = meta.getAttribute("content") || "";
        const match = content.match(/url\s*=\s*([^;]+)/i);
        return resolveUrlCandidate(match?.[1] || "", baseUrl);
      }),
    8
  );

  const comments = extractCommentSnippets(doc, 8);
  const inlineScriptHints = dedupeStrings(
    Array.from(doc.querySelectorAll("script:not([src])"))
      .flatMap((script) => extractQuotedPathCandidates(script.textContent || "", baseUrl, 12)),
    16
  );

  const routeHints = dedupeStrings(
    [
      ...links.map((item) => item.href),
      ...scripts.map((item) => item.src),
      ...forms.map((item) => item.action),
      ...metaRefreshTargets,
      ...inlineScriptHints,
      ...extractQuotedPathCandidates(html, baseUrl, maxItems),
    ].sort((a, b) => scoreRouteHint(b) - scoreRouteHint(a) || a.localeCompare(b)),
    maxItems
  );

  const apiCandidates = dedupeStrings(
    routeHints.filter((item) => /\/(api|graphql|rest|auth|login|logout|user|admin|upload|download|export|debug|flag|secret|internal|private|v\d+)/i.test(item)),
    16
  );

  return {
    type: "html_analysis",
    title: titleText || null,
    baseUrl: baseUrl?.trim() || null,
    generator: generatorText || null,
    forms,
    links,
    scripts,
    hiddenInputs,
    apiCandidates,
    routeHints,
    metaRefreshTargets,
    inlineScriptHints,
    comments,
    textClues: extractTextClues(doc, comments, 10),
  };
}

export const researchTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "搜索互联网资料。只要用户明确要求查询资料、搜索文档、联网查信息、查公开情报、查组件说明、查漏洞说明，就应立即优先调用该工具。如果首轮结果不够相关，必须继续自主改写关键词重试，可加入 site:域名、官方站点名、年份、版本号、城市名、引号短语等约束，而不是向用户索要链接。查询 CVE、版本漏洞、攻击模式情报和工具文档时，应优先收敛到官方公告、权威安全站点、技术社区或官方文档。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索关键词" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_webpage",
      description:
        "抓取网页正文。拿到搜索结果后，如需阅读具体页面内容、提取说明、整理资料摘要，应继续调用该工具。若首个页面不够相关，应返回搜索结果继续选择其他候选页，而不是直接放弃。面对 CVE、版本安全公告和工具文档时，优先抓取官方页面或高质量技术来源正文。",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "要抓取的网页 URL" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_recon_batch",
      description:
        "批量对公开网站做安全远勘：解析 IP、DNS、RDAP/注册商、标题、技术栈、架构线索、业务功能、TLS 证书、favicon 哈希、标准站点产物、外部服务主机、页面与 JS 中的 API/后台路径、登录表单和弱口令风险信号。只做公开信息采集，不做口令尝试或暴力破解。",
      parameters: {
        type: "object",
        properties: {
          targets: {
            type: "array",
            items: { type: "string" },
            description: "要分析的域名或 URL 列表",
          },
          probe_admin_paths: {
            type: "boolean",
            description: "是否额外探测公开的后台/登录入口候选",
          },
          allow_private_targets: {
            type: "boolean",
            description: "是否允许扫描内网或保留地址",
          },
          timeout_ms: {
            type: "number",
            description: "单个站点的超时时间（毫秒）",
          },
          max_probe_paths: {
            type: "number",
            description: "单站点最多探测多少个候选路径",
          },
        },
        required: ["targets"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "local_web_request",
      description:
        "对本地 / Docker / 私网 Web 靶场发送单步 HTTP 请求，用于解题过程中的逐步验证。只允许 http/https 的本地训练目标，不允许公网目标。适合在 web_recon_batch 之后，对登录、路由、参数、上传、目录穿越、IDOR、模板注入、简单 SQLi 回显等路径做一跳一跳的验证。支持 method、headers、body、cookies、session_key、redirect 控制。多步登录或需要保持会话时，应复用同一个 session_key。",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "本地 / Docker / 私网 Web 靶场 URL" },
          method: { type: "string", description: "HTTP method, e.g. GET, POST, PUT" },
          headers: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "自定义请求头，例如 Content-Type 或 Authorization",
          },
          body: { type: "string", description: "请求体，可用于 form-urlencoded、JSON、XML 或原始 payload" },
          cookies: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "本次请求要附加的 cookies",
          },
          session_key: {
            type: "string",
            description: "可选的会话键。相同 session_key 会自动复用并更新 cookies，适合登录态或多步题目",
          },
          follow_redirects: {
            type: "boolean",
            description: "是否跟随 30x 跳转。默认 false，便于先观察原始响应",
          },
          max_body_bytes: {
            type: "number",
            description: "最多读取多少字节的响应体，默认约 24KB",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_html_artifacts",
      description:
        "解析本地 Web 靶场返回的 HTML 页面，提取 AI 继续打题需要的结构化线索：表单、隐藏字段、链接、脚本、注释、疑似 API / 后台路径和页面提示文字。local_web_request 返回 HTML 后应立即调用它。",
      parameters: {
        type: "object",
        properties: {
          html: {
            type: "string",
            description: "原始 HTML 内容，通常来自 local_web_request 的 bodyExcerpt",
          },
          base_url: {
            type: "string",
            description: "可选。最终 URL，用于解析相对链接、表单 action 和脚本路径",
          },
          max_items: {
            type: "number",
            description: "可选。最多提取多少条线索，默认 24。",
          },
        },
        required: ["html"],
      },
    },
  },
];

export async function executeResearchTool(toolCall: ToolCall, language: Language): Promise<AIMessage | null> {
  if (toolCall.function.name === "search_web") {
    const args = JSON.parse(toolCall.function.arguments) as { query?: string };
    const query = args.query?.trim();
    if (!query) {
      return {
        role: "tool",
        content: language === "zh" ? "搜索关键词为空。" : "Search query is empty.",
        tool_call_id: toolCall.id,
      };
    }

    const results = await invoke<WebSearchItem[]>("web_search", { query });
    const payload: WebSearchToolResult = {
      type: "web_search_results",
      query,
      result_count: results.length,
      items: results,
    };
    return {
      role: "tool",
      content: JSON.stringify(payload, null, 2),
      tool_call_id: toolCall.id,
    };
  }

  if (toolCall.function.name === "fetch_webpage") {
    const args = JSON.parse(toolCall.function.arguments) as { url?: string };
    const url = args.url?.trim();
    if (!url) {
      return {
        role: "tool",
        content: language === "zh" ? "网页地址为空。" : "Web page URL is empty.",
        tool_call_id: toolCall.id,
      };
    }

    const result = await invoke<WebPageResult>("fetch_webpage", { url });
    const payload: WebPageToolResult = {
      type: "web_page",
      ...result,
    };
    return {
      role: "tool",
      content: JSON.stringify(payload, null, 2),
      tool_call_id: toolCall.id,
    };
  }

  if (toolCall.function.name === "web_recon_batch") {
    const args = JSON.parse(toolCall.function.arguments) as {
      targets?: unknown;
      probe_admin_paths?: boolean;
      allow_private_targets?: boolean;
      timeout_ms?: number;
      max_probe_paths?: number;
    };
    const targets = Array.isArray(args.targets)
      ? args.targets.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];
    if (targets.length === 0) {
      return {
        role: "tool",
        content: language === "zh" ? "远勘目标列表为空。" : "Recon target list is empty.",
        tool_call_id: toolCall.id,
      };
    }

    const result = await invoke<WebReconBatchResult>("web_recon_batch", {
      targets,
      probeAdminPaths: args.probe_admin_paths ?? true,
      allowPrivateTargets: args.allow_private_targets ?? false,
      timeoutMs: args.timeout_ms ?? 12000,
      maxProbePaths: args.max_probe_paths ?? 12,
    });
    return {
      role: "tool",
      content: JSON.stringify(result, null, 2),
      tool_call_id: toolCall.id,
    };
  }

  if (toolCall.function.name === "analyze_html_artifacts") {
    const args = JSON.parse(toolCall.function.arguments) as {
      html?: string;
      base_url?: string;
      max_items?: number;
    };
    const html = typeof args.html === "string" ? args.html : "";
    if (!html.trim()) {
      return {
        role: "tool",
        content: language === "zh" ? "HTML 内容为空。" : "HTML content is empty.",
        tool_call_id: toolCall.id,
      };
    }

    const payload = analyzeHtmlArtifacts(
      html,
      typeof args.base_url === "string" ? args.base_url : undefined,
      Number.isFinite(args.max_items) ? Math.min(64, Math.max(8, Math.trunc(args.max_items!))) : HTML_ANALYSIS_DEFAULT_LIMIT
    );
    return {
      role: "tool",
      content: JSON.stringify(payload, null, 2),
      tool_call_id: toolCall.id,
    };
  }

  if (toolCall.function.name === "local_web_request") {
    const args = JSON.parse(toolCall.function.arguments) as {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      cookies?: Record<string, string>;
      session_key?: string;
      follow_redirects?: boolean;
      max_body_bytes?: number;
    };
    const url = args.url?.trim();
    if (!url) {
      return {
        role: "tool",
        content: language === "zh" ? "本地 Web 请求 URL 为空。" : "Local web request URL is empty.",
        tool_call_id: toolCall.id,
      };
    }

    const result = await invoke<LocalWebRequestToolResult>("local_web_request", {
      url,
      method: args.method,
      headers: args.headers,
      body: args.body,
      cookies: args.cookies,
      sessionKey: args.session_key,
      followRedirects: args.follow_redirects,
      maxBodyBytes: args.max_body_bytes,
    });

    return {
      role: "tool",
      content: JSON.stringify({ type: "local_web_response", ...result }, null, 2),
      tool_call_id: toolCall.id,
    };
  }

  return null;
}
