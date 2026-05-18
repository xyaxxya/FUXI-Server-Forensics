export type CtfLabCategory = "web" | "pwn" | "reverse" | "crypto" | "forensics" | "misc";

export interface CtfLabInput {
  category: CtfLabCategory;
  target: string;
  challenge: string;
  artifacts: string;
  notes: string;
  toolOutput: string;
  scopeConfirmed: boolean;
}

export interface CtfLabScopeAssessment {
  allowed: boolean;
  normalizedTargets: string[];
  blockedTargets: string[];
  reasons: string[];
}

const CATEGORY_LABELS: Record<CtfLabCategory, string> = {
  web: "Web",
  pwn: "Pwn",
  reverse: "Reverse",
  crypto: "Crypto",
  forensics: "Forensics",
  misc: "Misc",
};

function splitLines(value: string) {
  return value
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPrivateIpv4(host: string) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((item) => item < 0 || item > 255)) return false;
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
}

function isLocalHost(host: string) {
  const normalized = host.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized === "host.docker.internal" ||
    normalized.endsWith(".local") ||
    isPrivateIpv4(normalized) ||
    /^[a-z0-9][a-z0-9-]{0,62}$/i.test(normalized)
  );
}

function looksLikeLocalPath(value: string) {
  return (
    /^[a-z]:\\/i.test(value) ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("/") ||
    value.includes("\\") ||
    /\.(zip|tar|gz|7z|pcap|pcapng|jar|war|apk|exe|dll|so|py|php|js|java|go|rs|c|cpp)$/i.test(value)
  );
}

function parseTargetHost(target: string) {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : `http://${target}`;
  try {
    return new URL(candidate).hostname;
  } catch {
    return "";
  }
}

export function assessCtfLabScope(input: CtfLabInput): CtfLabScopeAssessment {
  const targets = splitLines(input.target);
  const normalizedTargets: string[] = [];
  const blockedTargets: string[] = [];
  const reasons: string[] = [];

  for (const target of targets) {
    if (looksLikeLocalPath(target)) {
      normalizedTargets.push(target);
      continue;
    }

    const host = parseTargetHost(target);
    if (host && isLocalHost(host)) {
      normalizedTargets.push(target);
    } else {
      blockedTargets.push(target);
    }
  }

  if (!input.scopeConfirmed) {
    reasons.push("Scope confirmation is required before generating an actionable CTF/Lab plan.");
  }
  if (blockedTargets.length > 0) {
    reasons.push("Only localhost, private IP ranges, container hostnames, .local names, and local artifact paths are accepted in CTF/Lab mode.");
  }
  if (targets.length === 0 && !input.artifacts.trim() && !input.challenge.trim()) {
    reasons.push("Add a local target, artifact path, or challenge description.");
  }

  return {
    allowed: reasons.length === 0,
    normalizedTargets,
    blockedTargets,
    reasons,
  };
}

function bulletList(values: string[], empty: string) {
  if (values.length === 0) return `- ${empty}`;
  return values.map((item) => `- ${item}`).join("\n");
}

type CtfLabLanguage = "zh" | "en";

function getCategoryHypotheses(category: CtfLabCategory, language: CtfLabLanguage = "en") {
  if (category === "web") {
    if (language === "zh") {
      return [
        "先把网站地图建出来：首页、跳转、Cookie、robots.txt、sitemap.xml、静态 JS、表单、API 路径、后台路径、上传点和可下载文件。",
        "一次只选一条最可能的路线：源码泄露、认证绕过、越权、文件上传、目录穿越/LFI、模板注入、SQL/NoSQL 注入、SSRF、反序列化、命令注入或业务逻辑绕过。",
        "每一步都按“证据 -> 具体动作 -> 看到的结果 -> 下一分支”记录，最后才能给小白解释完整路径，而不是只甩 payload。",
      ];
    }
    return [
      "Build the site map first: homepage, redirects, cookies, robots.txt, sitemap.xml, static JavaScript, forms, API paths, admin paths, upload points, and downloadable files.",
      "Pick one likely solve path at a time: source leak, auth bypass, IDOR, file upload, path traversal/LFI, SSTI, SQL/NoSQL injection, SSRF, deserialization, command injection, or business-logic bypass.",
      "For every step, keep the beginner-visible chain as evidence -> exact action -> observed result -> next branch, so the final answer can explain the path instead of only showing payloads.",
    ];
  }
  if (category === "pwn") {
    if (language === "zh") {
      return [
        "先确认架构、保护、输入点、交互协议、崩溃点、泄露点和可控点。",
        "优先做文件类型、checksec、strings、动态运行和最小可控证明，再写最终脚本。",
        "记录偏移、泄露值、libc 判断和失败的崩溃条件。",
      ];
    }
    return [
      "Identify architecture, protections, input surface, protocol, crash primitive, leak primitive, and control primitive.",
      "Prioritize file type, checksec, strings, dynamic tracing, fuzzing, and minimal proof-of-control before writing a final solve script.",
      "Keep offsets, leaks, libc guesses, and failed crash conditions in the context pool.",
    ];
  }
  if (category === "reverse") {
    if (language === "zh") {
      return [
        "先确认文件格式、壳/混淆、反调试迹象、关键函数、输入校验路径和 flag 拼接逻辑。",
        "优先看字符串、导入表、控制流标记、反编译证据和小范围动态验证。",
        "把已确认约束和猜测分开，避免直接瞎爆破。",
      ];
    }
    return [
      "Identify format, packing, anti-debug hints, key functions, input validation path, and flag construction logic.",
      "Prioritize strings, imports, control-flow landmarks, decompiler evidence, and small dynamic checks.",
      "Separate confirmed constraints from guessed constraints before solving.",
    ];
  }
  if (category === "crypto") {
    if (language === "zh") {
      return [
        "先识别密码原语、参数、随机数复用、弱模数、oracle 行为、编码层和已知明文结构。",
        "优先找数学不变量和可复现小脚本，不要一上来盲目爆破。",
        "记录熵、模数大小、padding 和消息格式这些假设。",
      ];
    }
    return [
      "Identify primitive, parameters, reused randomness, weak modulus, oracle behavior, encoding layers, and known-plaintext structure.",
      "Prioritize mathematical invariants and small reproducible scripts over blind brute force.",
      "Track assumptions on entropy, modulus size, padding, and message format.",
    ];
  }
  if (category === "forensics") {
    if (language === "zh") {
      return [
        "先确认容器格式、时间线、内嵌文件、元数据、压缩层、网络流和异常熵变化。",
        "优先做非破坏性提取、哈希保全、字符串、文件雕刻、PCAP 流还原和时间线关联。",
        "每个提取物都记录来源偏移或数据包位置。",
      ];
    }
    return [
      "Identify container type, timeline, embedded files, metadata, compression, network streams, and suspicious entropy changes.",
      "Prioritize non-destructive extraction, hash preservation, strings, binwalk-like carving, PCAP stream reconstruction, and timestamp correlation.",
      "Record every extracted artifact with source offset or packet reference.",
    ];
  }
  if (language === "zh") {
    return [
      "先判断题目机制、输入输出、文件、可见规则、隐藏状态和 flag 格式。",
      "优先做小范围可逆实验，用证据缩小范围，不要泛猜。",
      "把每条线索转换成可验证的假设。",
    ];
  }
  return [
    "Classify the challenge mechanics, observable inputs, scoring/flag format, hidden state, and likely puzzle constraints.",
    "Prefer small reversible experiments and evidence tracking over broad guessing.",
    "Convert every clue into a testable hypothesis.",
  ];
}

function getSuggestedToolPlan(category: CtfLabCategory, language: CtfLabLanguage = "en") {
  if (category === "web") {
    if (language === "zh") {
      return [
        "第 1 步：用 web_recon_batch 收集首页、robots.txt、sitemap.xml、常见后台路径、静态 JS、表单、Cookie、响应头和可见链接。",
        "第 2 步：用 local_web_request 一步一步请求；涉及登录态或 Cookie 时固定使用 session_key: web-lab-main。",
        "第 3 步：只要响应是 HTML，就把 bodyExcerpt 和 finalUrl 交给 analyze_html_artifacts，提取表单、隐藏字段、注释、路由、脚本和 API 线索。",
        "第 4 步：把 URL、表单 action、参数、Cookie、API、上传字段和隐藏字段都变成可测试节点。",
        "第 5 步：确认 flag 路线后，输出从入口到 flag 的完整点击/请求步骤，并解释每一步为什么有效。",
      ];
    }
    return [
      "Step 1 intake: use web_recon_batch on /, /robots.txt, /sitemap.xml, common admin paths, static JavaScript, forms, cookies, response headers, and visible links.",
      "Step 2 stateful requests: use local_web_request one step at a time and keep one stable session_key such as web-lab-main for login or cookie-driven flows.",
      "Step 3 HTML parsing: whenever a response is HTML, pass bodyExcerpt plus finalUrl into analyze_html_artifacts to extract forms, hidden inputs, comments, route hints, scripts, and API clues.",
      "Step 4 route map: turn every URL, form action, query parameter, cookie, API path, upload field, and hidden input into a testable node.",
      "Step 5 solve path: once the flag route is confirmed, write the exact click/request sequence and why each step worked.",
    ];
  }
  if (category === "pwn") {
    if (language === "zh") {
      return [
        "查看二进制元数据、保护、符号、字符串和链接库。",
        "用受控输入长度做本地崩溃定位并记录偏移。",
        "确认泄露或控制原语后再构造最小 exploit 模型。",
      ];
    }
    return [
      "Inspect binary metadata, protections, symbols, strings, and linked libraries.",
      "Run local crash triage with controlled input lengths and record offsets.",
      "Build a minimal exploit model only after confirming leak/control primitives.",
    ];
  }
  if (category === "reverse") {
    if (language === "zh") {
      return [
        "查看字符串、导入表、段信息并定位输入校验函数。",
        "用反编译或跟踪结果提取约束。",
        "约束确认后再写小型 solver。",
      ];
    }
    return [
      "Inspect strings/imports/sections and locate input validation functions.",
      "Use decompiler or tracing output to extract constraints.",
      "Write a small solver when constraints are confirmed.",
    ];
  }
  if (category === "crypto") {
    if (language === "zh") {
      return [
        "解析所有数字、编码、密文、公钥参数和 oracle 交互记录。",
        "检查常见弱点：复用、小参数、坏 padding、可预测随机数和代数捷径。",
        "写一个可复现 solver，并把每一步和证据对应起来。",
      ];
    }
    return [
      "Parse all numbers, encodings, ciphertexts, public parameters, and oracle transcript data.",
      "Check common weaknesses: reuse, small parameters, bad padding, predictable randomness, and algebraic shortcuts.",
      "Write a reproducible solver with comments tying each step to evidence.",
    ];
  }
  if (category === "forensics") {
    if (language === "zh") {
      return [
        "保留哈希并识别文件/容器格式。",
        "提取元数据、字符串、内嵌文件、时间线和网络流。",
        "关联恢复出的证据并重建 flag 路线。",
      ];
    }
    return [
      "Preserve hashes and identify file/container formats.",
      "Extract metadata, strings, embedded artifacts, timelines, and streams.",
      "Correlate recovered artifacts and reconstruct the flag path.",
    ];
  }
  if (language === "zh") {
    return [
      "盘点输入、输出、文件和可见规则。",
      "建立假设表并做小范围可逆测试。",
      "把确认后的约束整理成解题路径。",
    ];
  }
  return [
    "Inventory inputs, outputs, files, and visible rules.",
    "Build a hypothesis table and run small reversible tests.",
    "Turn confirmed constraints into a solve path.",
  ];
}

function getWeaknessDirections(category: CtfLabCategory, language: CtfLabLanguage = "en") {
  if (category === "web") {
    if (language === "zh") {
      return [
        "登录与会话逻辑",
        "IDOR / 越权访问",
        "文件上传与文件处理",
        "目录穿越与本地文件包含",
        "模板注入与代码注入",
        "SQL / NoSQL 注入",
        "SSRF 与内部请求逻辑",
        "反序列化与解析器混淆",
        "业务逻辑绕过与状态机缺陷",
      ];
    }
    return [
      "Auth and session logic",
      "IDOR and object authorization",
      "File upload and file handling",
      "Path traversal and local file inclusion",
      "Template injection and code injection",
      "SQL / NoSQL injection",
      "SSRF and internal fetch logic",
      "Deserialization and parser confusion",
      "Business-logic bypass and state machine flaws",
    ];
  }
  if (category === "pwn") {
    if (language === "zh") {
      return [
        "栈或堆破坏",
        "格式化字符串",
        "整数溢出或有符号问题",
        "UAF / double free",
        "信息泄露加控制原语",
        "ROP / ret2libc 控制流劫持",
      ];
    }
    return [
      "Stack or heap corruption",
      "Format string issues",
      "Integer and signedness bugs",
      "Use-after-free / double free",
      "Info leak plus control primitive",
      "ROP / ret2libc style control flow",
    ];
  }
  if (category === "reverse") {
    if (language === "zh") {
      return [
        "输入校验与隐藏分支",
        "flag 拼接逻辑",
        "反调试 / 反篡改",
        "程序内部的加密或编码层",
        "依赖状态的解锁条件",
      ];
    }
    return [
      "Input checks and hidden branches",
      "Flag assembly logic",
      "Anti-debug / anti-tamper hints",
      "Crypto or encoding layers inside the binary",
      "State-dependent unlock conditions",
    ];
  }
  if (category === "crypto") {
    if (language === "zh") {
      return [
        "密钥复用与弱随机数",
        "错误 padding 或可篡改性",
        "小参数或弱模数",
        "oracle 行为",
        "数学捷径与不变量提取",
      ];
    }
    return [
      "Key reuse and weak randomness",
      "Bad padding or malleability",
      "Small parameter or weak modulus settings",
      "Oracle behavior",
      "Math shortcuts and invariant extraction",
    ];
  }
  if (category === "forensics") {
    if (language === "zh") {
      return [
        "时间线重建",
        "元数据和容器格式滥用",
        "内嵌文件与文件雕刻",
        "日志和数据包关联",
        "隐藏字符串或标记恢复",
      ];
    }
    return [
      "Timeline reconstruction",
      "Metadata and container abuse",
      "Embedded files and carving",
      "Log and packet correlation",
      "Recovery of hidden strings or markers",
    ];
  }
  if (language === "zh") {
    return [
      "隐藏状态发现",
      "规则还原",
      "输入输出差异分析",
      "从证据中提取约束并求解",
    ];
  }
  return [
    "Hidden state discovery",
    "Rule reconstruction",
    "Input-output differential analysis",
    "Constraint solving from evidence",
  ];
}

export function buildCtfLabAgentPrompt(input: CtfLabInput, language: CtfLabLanguage = "zh") {
  const scope = assessCtfLabScope(input);
  const targets = scope.normalizedTargets.length > 0 ? scope.normalizedTargets.join("\n") : "(artifact-only or not provided)";
  const artifacts = splitLines(input.artifacts);
  const isWeb = input.category === "web";
  const isZh = language === "zh";

  return [
    isWeb
      ? (isZh
          ? "你是 FUXI Web 靶场自动打题智能体，面向新手，专门解决合法 Web CTF、本地 Docker 靶场、内网训练靶场。"
          : "You are FUXI Web Lab Autopilot, a beginner-friendly AI agent for solving legal Web CTF, local Docker labs, private-range labs, and training targets only.")
      : (isZh
          ? "你是 FUXI CTF/Lab 智能体，用 PentestGPT 风格帮助用户解决合法 CTF、本地实验、Docker 靶场和训练题。"
          : "You are FUXI CTF/Lab Agent, modeled as a PentestGPT-style workflow for legal CTF, local lab, Docker, and training targets only."),
    "",
    isZh ? "硬性范围规则：" : "Hard scope rules:",
    isZh ? "- 只能处理下面确认过的本地/靶场范围。" : "- Work only on the confirmed local/lab scope listed below.",
    isZh ? "- 如果目标是公网真实站点，或范围不清楚，必须停止并要求用户提供本地/靶场目标或附件。" : "- If a target is public internet or scope is unclear, stop and ask for a local/lab target or artifact.",
    isZh ? "- 不提供真实世界持久化、隐蔽、绕过第三方防护、后渗透控制等操作指导。" : "- Do not provide persistence, real-world stealth, WAF evasion against third-party services, or post-compromise operational guidance.",
    isZh ? "- 对确认的 CTF/靶场目标，可以给出必要的验证请求、命令和 payload，但必须服务于解题。" : "- For confirmed CTF/lab targets, concrete verification commands and payloads are allowed when they are necessary to solve the challenge.",
    isZh ? "- 没有看到 flag 或最终证明前，不能声称已经打通。" : "- Never claim the challenge is solved unless the flag or the final proof condition is present in the provided evidence.",
    "",
    isWeb ? (isZh ? "自动打题流程：" : "Autopilot workflow:") : (isZh ? "智能体结构：" : "Architecture:"),
    isWeb
      ? (isZh ? "1. 收集：总结目标、可访问页面、表单、Cookie、响应头、路由、API 线索、静态文件和附件。" : "1. Intake: summarize the target, reachable pages, forms, cookies, headers, routes, API hints, static files, and supplied artifacts.")
      : (isZh ? "1. 推理：维护任务状态、排序假设并决定下一步。" : "1. Reasoning module: maintain task state, rank hypotheses, and decide the next action."),
    isWeb
      ? (isZh ? "2. 排路：根据证据排序最可能的解题路线，并用新手能懂的话解释。" : "2. Path ranking: rank likely solve paths by evidence and explain them in beginner language.")
      : (isZh ? "2. 工具：提出或解读本地工具动作，保持最小、可复现。" : "2. Tool module: propose or interpret local-only tool actions and keep them minimal and reproducible."),
    isWeb
      ? (isZh ? "3. 单步循环：一次只给一个下一步点击/请求/命令，然后根据工具输出再分支。" : "3. One-action loop: output exactly one next click/request/command, then wait for the user/tool output before branching.")
      : (isZh ? "3. 解析：把工具输出整理成证据、约束和阻塞点。" : "3. Parsing module: summarize tool output into evidence, constraints, and blockers."),
    isWeb
      ? (isZh ? "4. 解析：把每次响应转换为确认事实、排除猜测、账号、路由、参数、文件和阻塞点。" : "4. Parsing: convert every response into confirmed facts, rejected guesses, credentials, routes, parameters, files, and blockers.")
      : (isZh ? "4. 线索池：保留目标、题目给的账号、路由、偏移、文件路径、flag、失败尝试和假设。" : "4. Context pool: preserve targets, credentials intentionally supplied by the challenge, routes, offsets, file paths, flags, failed attempts, and assumptions."),
    isWeb
      ? (isZh ? "5. 解题路径：确认后输出从第一个页面到 flag 的完整新手版路径。" : "5. Solve path: when proven, output the full beginner-readable path from first page to flag.")
      : (isZh ? "5. 报告：生成包含证据、路径和 flag 占位的简洁 writeup。" : "5. Report module: generate a concise writeup with evidence, solve path, and final flag placeholder."),
    ...(isWeb
      ? [
          "",
          isZh ? "Web 工具循环：" : "Web tool loop:",
          isZh ? "- 目标能通过 HTTP(S) 访问时，先用 web_recon_batch 做入口收集。" : "- Start with web_recon_batch for intake when the target is reachable over HTTP(S).",
          isZh ? "- 逐步验证时，用 local_web_request，并固定使用 session_key: web-lab-main。" : "- For step-by-step verification, use local_web_request with one stable session_key: web-lab-main.",
          isZh ? "- local_web_request 只要返回 HTML，就立刻把 bodyExcerpt 和 finalUrl 交给 analyze_html_artifacts，再决定下一步。" : "- Whenever local_web_request returns HTML, immediately run analyze_html_artifacts on bodyExcerpt with base_url set to finalUrl before choosing the next action.",
          isZh ? "- 根据提取出的表单、隐藏字段、注释、路由、脚本和 API 候选，决定下一个精确请求。" : "- Use the extracted forms, hidden inputs, comments, route hints, scripts, and API candidates to decide the next exact request.",
          "",
          isZh ? "小白输出规则：" : "Beginner-mode output rules:",
          isZh ? "- 优先给浏览器步骤、curl 命令或 Burp 风格请求说明，新手能照着做。" : "- Prefer direct browser steps, curl commands, or Burp-style request notes that a new learner can copy.",
          isZh ? "- 每一步用一句短话解释为什么要做。" : "- Explain why the step matters in one short sentence.",
          isZh ? "- 如果给 payload，必须说明它对应哪条本地靶场假设，以及成功/失败应该看到什么。" : "- If a payload is suggested, keep it tied to the local lab hypothesis and state the expected success/failure signal.",
          isZh ? "- 涉及登录或多步状态时，相关 local_web_request 都继续使用 session_key: web-lab-main，除非有明确理由换。" : "- When the challenge involves login or multi-step state, keep using the same session_key: web-lab-main for related local_web_request calls unless a different one is justified.",
          isZh ? "- 持续维护路径图：入口 -> 线索 -> 弱点 -> 验证 -> flag 路线。" : "- Keep a visible path map: entry -> clue -> weakness -> verification -> flag route.",
        ]
      : []),
    "",
    `${isZh ? "题目类型" : "Challenge category"}: ${CATEGORY_LABELS[input.category]}`,
    `${isZh ? "范围已确认" : "Scope confirmed"}: ${input.scopeConfirmed ? (isZh ? "是" : "yes") : (isZh ? "否" : "no")}`,
    `${isZh ? "范围状态" : "Scope status"}: ${scope.allowed ? (isZh ? "允许" : "allowed") : (isZh ? "阻止" : "blocked")}`,
    `${isZh ? "目标" : "Targets"}:\n${targets}`,
    `${isZh ? "附件" : "Artifacts"}:\n${artifacts.length > 0 ? artifacts.map((item) => `- ${item}`).join("\n") : (isZh ? "- 无" : "- none")}`,
    "",
    isZh ? "题目说明：" : "Challenge description:",
    input.challenge.trim() || (isZh ? "(未提供)" : "(not provided)"),
    "",
    isZh ? "操作者备注：" : "Operator notes:",
    input.notes.trim() || (isZh ? "(无)" : "(none)"),
    "",
    isZh ? "最近工具输出：" : "Recent tool output:",
    input.toolOutput.trim() || (isZh ? "(无)" : "(none)"),
    "",
    isZh ? "必须严格返回这些小节：" : "Return exactly these sections:",
    isWeb ? (isZh ? "## 范围" : "## Scope") : (isZh ? "## 状态" : "## State"),
    isWeb ? (isZh ? "## 当前发现" : "## Current Findings") : (isZh ? "## 证据" : "## Evidence"),
    isWeb ? (isZh ? "## 最可能解题路线" : "## Likely Solve Path") : (isZh ? "## 假设" : "## Hypotheses"),
    isWeb ? (isZh ? "## 下一步点击或请求" : "## Next Click Or Command") : (isZh ? "## 下一步工具动作" : "## Next Tool Actions"),
    isWeb ? (isZh ? "## 如何判断结果" : "## How To Read The Result") : (isZh ? "## 预期分支" : "## Expected Branches"),
    isWeb ? (isZh ? "## 更新后的解题路径" : "## Updated Writeup Path") : (isZh ? "## Writeup 更新" : "## Writeup Delta"),
    "",
    isWeb
      ? (isZh ? "用简洁中文解释，下一步必须绑定证据；不要一次丢多个互相竞争的命令，除非它们是明确分支。" : "Use concise beginner-friendly language. Tie the next action to evidence, and do not output multiple competing commands unless they are mutually exclusive branches.")
      : (isZh ? "用简洁中文输出。每个下一步动作都必须绑定证据或假设。" : "Use concise, technical language. Tie every next action to evidence or a hypothesis."),
  ].join("\n");
}

export function buildCtfLabReportMarkdown(input: CtfLabInput, language: CtfLabLanguage = "zh") {
  const scope = assessCtfLabScope(input);
  const targets = scope.normalizedTargets.length > 0 ? scope.normalizedTargets : [language === "zh" ? "仅附件 / 未填写目标" : "Artifact-only / not provided"];
  const artifacts = splitLines(input.artifacts);
  const hypotheses = getCategoryHypotheses(input.category, language);
  const toolPlan = getSuggestedToolPlan(input.category, language);
  const weaknessDirections = getWeaknessDirections(input.category, language);
  const isWeb = input.category === "web";
  const isZh = language === "zh";

  if (isZh) {
    return [
      isWeb ? "# Web 靶场自动打题路径" : "# CTF / Lab 解题计划",
      "",
      `- 题目类型：${CATEGORY_LABELS[input.category]}`,
      `- 范围确认：${input.scopeConfirmed ? "已确认" : "未确认"}`,
      `- 范围状态：${scope.allowed ? "允许执行" : "已阻止"}`,
      ...(isWeb
        ? [
            "- 模式：小白可读的自动打题循环",
            "- 目标：给出下一步明确点击/请求/命令，最终解释从入口到 flag 的完整路径",
          ]
        : []),
      "",
      "## 1. 范围检查",
      scope.allowed ? "- 已通过：只会处理本地、Docker、内网或 CTF 靶场范围。" : bulletList(scope.reasons, "未发现范围问题"),
      scope.blockedTargets.length > 0 ? `- 被拦截目标：${scope.blockedTargets.join(", ")}` : "- 被拦截目标：无",
      "",
      "## 2. 目标",
      bulletList(targets, "未填写目标"),
      "",
      "## 3. 源码 / 附件",
      bulletList(artifacts, "未填写附件"),
      "",
      "## 4. 题目说明",
      input.challenge.trim() || "未填写题目说明。",
      "",
      "## 5. 已知信息",
      input.notes.trim() || "暂无已知信息。",
      "",
      "## 6. 最近证据",
      input.toolOutput.trim() || "暂无工具输出。",
      "",
      ...(isWeb
        ? [
            "## 7. 小白自动打题流程",
            "- 1. 线索收集：先收集首页、跳转、Cookie、响应头、robots.txt、sitemap.xml、链接、表单、JS、API 和后台候选。",
            "- 2. 单步请求：用 local_web_request 发一个请求看一个结果；登录态或 Cookie 流固定使用 session_key: web-lab-main。",
            "- 3. 页面解析：响应是 HTML 时，用 analyze_html_artifacts 提取表单、隐藏字段、注释、脚本、路由和 API 线索。",
            "- 4. 地图整理：把路由、参数、Cookie、表单字段、上传字段、隐藏字段和敏感文件都列成可测试节点。",
            "- 5. 选择路线：只根据证据排序最可能的漏洞方向。",
            "- 6. 验证路线：每次只做一步本地/靶场请求或浏览器动作。",
            "- 7. 分支判断：如果信号符合预期就继续；不符合就标记为失败路线，换下一个假设。",
            "- 8. 输出路径：找到 flag 后，用“入口 -> 线索 -> 弱点 -> 验证 -> flag”写清楚。",
            "",
            "## 8. 你现在应该怎么点",
            "- 如果还没收集：点左侧“1. 收集页面线索”。",
            "- 如果已经收集：点“2. 交给 AI 自动打”。",
            "- 如果你有源码或 Docker 目录：填到“源码 / 附件路径”，AI 能更快对应路由和代码。",
            "- 如果你手动试过 Burp/curl：把输出贴到“工具输出 / 证据池”。",
            "",
          ]
        : []),
      isWeb ? "## 9. 当前假设队列" : "## 7. 当前假设队列",
      bulletList(hypotheses, "暂无假设"),
      "",
      isWeb ? "## 10. 重点漏洞方向" : "## 8. 重点方向",
      bulletList(weaknessDirections, "暂无方向"),
      "",
      isWeb ? "## 11. 下一步工具计划" : "## 9. 下一步工具计划",
      bulletList(toolPlan, "暂无工具计划"),
      "",
      isWeb ? "## 12. 智能体循环规则" : "## 10. 智能体循环规则",
      "- 推理：选最高价值假设，并说明什么证据能确认或否定它。",
      "- 工具：只执行一个本地/靶场动作，输出保持可读。",
      "- 解析：提取事实、约束、错误、路由、文件、token 和失败分支。",
      "- 上下文：把确认线索留下，清掉过期猜测。",
      "- 重复直到看到 flag 或最终证明。",
      "",
      isWeb ? "## 13. Writeup 模板" : "## 11. Writeup 模板",
      "1. 题目概述",
      "2. 初始观察",
      "3. 漏洞或弱点",
      "4. 验证步骤",
      "5. 利用或解题逻辑",
      "6. Flag",
      "7. 失败路线和收获",
    ].join("\n");
  }

  return [
    isWeb ? "# Web Lab Autopilot Solve Path" : "# CTF / Lab Recon and Solve Plan",
    "",
    `- Category: ${CATEGORY_LABELS[input.category]}`,
    `- Scope confirmed: ${input.scopeConfirmed ? "yes" : "no"}`,
    `- Scope status: ${scope.allowed ? "allowed" : "blocked"}`,
    ...(isWeb
      ? [
          "- Mode: beginner-friendly auto-solve loop",
          "- Goal: produce the next exact click/request/command and finally explain the complete path to the flag",
        ]
      : []),
    "",
    "## Scope Gate",
    scope.allowed ? "- CTF/Lab scope accepted." : bulletList(scope.reasons, "No scope issue detected"),
    scope.blockedTargets.length > 0 ? `- Blocked targets: ${scope.blockedTargets.join(", ")}` : "- Blocked targets: none",
    "",
    "## Target Inventory",
    bulletList(targets, "No target"),
    "",
    "## Artifact Inventory",
    bulletList(artifacts, "No artifacts listed"),
    "",
    "## Challenge Brief",
    input.challenge.trim() || "No challenge description provided.",
    "",
    "## Current Context",
    input.notes.trim() || "No operator notes yet.",
    "",
    "## Recent Evidence",
    input.toolOutput.trim() || "No tool output pasted yet.",
    "",
    ...(isWeb
      ? [
          "## Beginner Auto Path",
          "- 1. Intake: collect homepage, redirects, cookies, headers, robots.txt, sitemap.xml, visible links, forms, JavaScript, API hints, and admin candidates.",
          "- 2. Request: use local_web_request with session_key web-lab-main so cookies persist across the solve loop.",
          "- 3. Parse: whenever the response is HTML, run analyze_html_artifacts on bodyExcerpt and finalUrl to extract forms, hidden fields, comments, scripts, route hints, and API clues.",
          "- 4. Map: list every route, parameter, cookie, form field, upload field, hidden input, and interesting file.",
          "- 5. Choose: rank the most likely weakness from the evidence, not from guesswork.",
          "- 6. Verify: run one local/lab request or browser action and paste the output back here.",
          "- 7. Branch: if the signal matches, continue down that path; if not, mark it rejected and try the next ranked path.",
          "- 8. Explain: once the flag is found, output the full path as entry -> clue -> weakness -> verification -> flag.",
          "",
          "## First Actions For A Web Lab",
          "- Run Web Autopilot Intake in this panel when a reachable local URL is provided.",
          "- If source code or a Docker folder is available, add it under Artifact Inventory so the agent can correlate routes with implementation.",
          "- Keep one stable solve session called web-lab-main when login state or cookies matter.",
          "- Paste any browser/Burp/curl output into Recent Evidence before copying the Auto-Solve prompt again.",
          "",
        ]
      : []),
    "## Hypothesis Queue",
    bulletList(hypotheses, "No hypotheses generated"),
    "",
    "## Weakness Directions",
    bulletList(weaknessDirections, "No weakness directions generated"),
    "",
    "## Next Tool Plan",
    bulletList(toolPlan, "No tool plan generated"),
    "",
    "## Agent Loop",
    "- Reasoning: choose the highest-value hypothesis and define what evidence would confirm or kill it.",
    "- Tool: run one local/lab action and keep the output small enough to parse.",
    "- Parsing: extract facts, constraints, errors, routes, offsets, files, tokens, and failed branches.",
    "- Context: update the report with confirmed evidence and remove stale guesses.",
    "- Repeat until the flag path is proven.",
    "",
    "## Writeup Template",
    "1. Challenge summary",
    "2. Initial observations",
    "3. Vulnerability or weakness",
    "4. Verification steps",
    "5. Exploit or solve logic",
    "6. Flag",
    "7. Failed branches and lessons",
  ].join("\n");
}
