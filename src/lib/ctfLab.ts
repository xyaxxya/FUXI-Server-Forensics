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

function getCategoryHypotheses(category: CtfLabCategory) {
  if (category === "web") {
    return [
      "Map routes, parameters, cookies, upload points, static assets, and API calls before choosing an exploit path.",
      "Prioritize auth logic, IDOR, file upload, path traversal, template injection, deserialization, SSRF, SQL/NoSQL injection, and source disclosure hypotheses.",
      "Track each hypothesis as evidence -> verification -> result -> next branch, so failed attempts still reduce the search space.",
    ];
  }
  if (category === "pwn") {
    return [
      "Identify architecture, protections, input surface, protocol, crash primitive, leak primitive, and control primitive.",
      "Prioritize file type, checksec, strings, dynamic tracing, fuzzing, and minimal proof-of-control before writing a final solve script.",
      "Keep offsets, leaks, libc guesses, and failed crash conditions in the context pool.",
    ];
  }
  if (category === "reverse") {
    return [
      "Identify format, packing, anti-debug hints, key functions, input validation path, and flag construction logic.",
      "Prioritize strings, imports, control-flow landmarks, decompiler evidence, and small dynamic checks.",
      "Separate confirmed constraints from guessed constraints before solving.",
    ];
  }
  if (category === "crypto") {
    return [
      "Identify primitive, parameters, reused randomness, weak modulus, oracle behavior, encoding layers, and known-plaintext structure.",
      "Prioritize mathematical invariants and small reproducible scripts over blind brute force.",
      "Track assumptions on entropy, modulus size, padding, and message format.",
    ];
  }
  if (category === "forensics") {
    return [
      "Identify container type, timeline, embedded files, metadata, compression, network streams, and suspicious entropy changes.",
      "Prioritize non-destructive extraction, hash preservation, strings, binwalk-like carving, PCAP stream reconstruction, and timestamp correlation.",
      "Record every extracted artifact with source offset or packet reference.",
    ];
  }
  return [
    "Classify the challenge mechanics, observable inputs, scoring/flag format, hidden state, and likely puzzle constraints.",
    "Prefer small reversible experiments and evidence tracking over broad guessing.",
    "Convert every clue into a testable hypothesis.",
  ];
}

function getSuggestedToolPlan(category: CtfLabCategory) {
  if (category === "web") {
    return [
      "Baseline HTTP: status, headers, cookies, redirects, robots/sitemap, static JS, forms, and route inventory.",
      "Source review when artifacts exist: grep routes, controllers, templates, upload handlers, auth middleware, serializers, and config.",
      "Dynamic validation in lab only: replay requests, compare roles/states, test benign traversal markers, upload handling, and parser differentials.",
    ];
  }
  if (category === "pwn") {
    return [
      "Inspect binary metadata, protections, symbols, strings, and linked libraries.",
      "Run local crash triage with controlled input lengths and record offsets.",
      "Build a minimal exploit model only after confirming leak/control primitives.",
    ];
  }
  if (category === "reverse") {
    return [
      "Inspect strings/imports/sections and locate input validation functions.",
      "Use decompiler or tracing output to extract constraints.",
      "Write a small solver when constraints are confirmed.",
    ];
  }
  if (category === "crypto") {
    return [
      "Parse all numbers, encodings, ciphertexts, public parameters, and oracle transcript data.",
      "Check common weaknesses: reuse, small parameters, bad padding, predictable randomness, and algebraic shortcuts.",
      "Write a reproducible solver with comments tying each step to evidence.",
    ];
  }
  if (category === "forensics") {
    return [
      "Preserve hashes and identify file/container formats.",
      "Extract metadata, strings, embedded artifacts, timelines, and streams.",
      "Correlate recovered artifacts and reconstruct the flag path.",
    ];
  }
  return [
    "Inventory inputs, outputs, files, and visible rules.",
    "Build a hypothesis table and run small reversible tests.",
    "Turn confirmed constraints into a solve path.",
  ];
}

function getWeaknessDirections(category: CtfLabCategory) {
  if (category === "web") {
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
    return [
      "Input checks and hidden branches",
      "Flag assembly logic",
      "Anti-debug / anti-tamper hints",
      "Crypto or encoding layers inside the binary",
      "State-dependent unlock conditions",
    ];
  }
  if (category === "crypto") {
    return [
      "Key reuse and weak randomness",
      "Bad padding or malleability",
      "Small parameter or weak modulus settings",
      "Oracle behavior",
      "Math shortcuts and invariant extraction",
    ];
  }
  if (category === "forensics") {
    return [
      "Timeline reconstruction",
      "Metadata and container abuse",
      "Embedded files and carving",
      "Log and packet correlation",
      "Recovery of hidden strings or markers",
    ];
  }
  return [
    "Hidden state discovery",
    "Rule reconstruction",
    "Input-output differential analysis",
    "Constraint solving from evidence",
  ];
}

export function buildCtfLabAgentPrompt(input: CtfLabInput) {
  const scope = assessCtfLabScope(input);
  const targets = scope.normalizedTargets.length > 0 ? scope.normalizedTargets.join("\n") : "(artifact-only or not provided)";
  const artifacts = splitLines(input.artifacts);

  return [
    "You are FUXI CTF/Lab Agent, modeled as a PentestGPT-style workflow for legal CTF, local lab, Docker, and training targets only.",
    "",
    "Hard scope rules:",
    "- Work only on the confirmed local/lab scope listed below.",
    "- If a target is public internet or scope is unclear, stop and ask for a local/lab target or artifact.",
    "- Do not provide persistence, real-world stealth, WAF evasion against third-party services, or post-compromise operational guidance.",
    "- For confirmed CTF/lab targets, concrete verification commands and payloads are allowed when they are necessary to solve the challenge.",
    "",
    "Architecture:",
    "1. Reasoning module: maintain task state, rank hypotheses, and decide the next action.",
    "2. Tool module: propose or interpret local-only tool actions and keep them minimal and reproducible.",
    "3. Parsing module: summarize tool output into evidence, constraints, and blockers.",
    "4. Context pool: preserve targets, credentials intentionally supplied by the challenge, routes, offsets, file paths, flags, failed attempts, and assumptions.",
    "5. Report module: generate a concise writeup with evidence, solve path, and final flag placeholder.",
    "",
    `Challenge category: ${CATEGORY_LABELS[input.category]}`,
    `Scope confirmed: ${input.scopeConfirmed ? "yes" : "no"}`,
    `Scope status: ${scope.allowed ? "allowed" : "blocked"}`,
    `Targets:\n${targets}`,
    `Artifacts:\n${artifacts.length > 0 ? artifacts.map((item) => `- ${item}`).join("\n") : "- none"}`,
    "",
    "Challenge description:",
    input.challenge.trim() || "(not provided)",
    "",
    "Operator notes:",
    input.notes.trim() || "(none)",
    "",
    "Recent tool output:",
    input.toolOutput.trim() || "(none)",
    "",
    "Return exactly these sections:",
    "## State",
    "## Evidence",
    "## Hypotheses",
    "## Next Tool Actions",
    "## Expected Branches",
    "## Writeup Delta",
    "",
    "Use concise, technical language. Tie every next action to evidence or a hypothesis.",
  ].join("\n");
}

export function buildCtfLabReportMarkdown(input: CtfLabInput) {
  const scope = assessCtfLabScope(input);
  const targets = scope.normalizedTargets.length > 0 ? scope.normalizedTargets : ["Artifact-only / not provided"];
  const artifacts = splitLines(input.artifacts);
  const hypotheses = getCategoryHypotheses(input.category);
  const toolPlan = getSuggestedToolPlan(input.category);
  const weaknessDirections = getWeaknessDirections(input.category);

  return [
    "# CTF / Lab Recon and Solve Plan",
    "",
    `- Category: ${CATEGORY_LABELS[input.category]}`,
    `- Scope confirmed: ${input.scopeConfirmed ? "yes" : "no"}`,
    `- Scope status: ${scope.allowed ? "allowed" : "blocked"}`,
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
