export interface ReconWorkspaceSection {
  title: string;
  content: string;
}

export interface DeepReconSections {
  summary: ReconWorkspaceSection;
  evidence: ReconWorkspaceSection;
  nextSteps: ReconWorkspaceSection;
}

export type AgenticTraceStatus = "done" | "active" | "pending";

export interface AgenticTraceInput {
  id: string;
  title: string;
  detail: string;
  tool?: string;
}

export interface AgenticTraceItem extends AgenticTraceInput {
  status: AgenticTraceStatus;
}

export interface ReconDecisionInput {
  language: "zh" | "en";
  target?: string;
  riskScore: number;
  clueCount: number;
  reachable: boolean;
  primaryClue?: string;
}

export interface ReconDecision {
  headline: string;
  action: string;
  reason: string;
  confidenceLabel: string;
}

export type TaskDeskMode = "public" | "deep";

export interface TaskDeskActionInput {
  language: "zh" | "en";
  mode: TaskDeskMode;
  isRunning: boolean;
  hasInput: boolean;
  hasResult: boolean;
  hasPriorityTarget?: boolean;
}

export interface TaskDeskAction {
  eyebrow: string;
  primaryLabel: string;
  statusText: string;
  helperText: string;
}

export type PriorityQueueTone = "high" | "medium" | "low";

export interface PriorityQueueLabel {
  label: string;
  tone: PriorityQueueTone;
  rank: number;
}

export function buildPriorityQueueLabel(score: number, language: "zh" | "en"): PriorityQueueLabel {
  const isZh = language === "zh";
  if (score >= 70) {
    return { label: isZh ? "先处理" : "Handle first", tone: "high", rank: 1 };
  }
  if (score >= 35) {
    return { label: isZh ? "待核验" : "Verify", tone: "medium", rank: 2 };
  }
  return { label: isZh ? "可暂缓" : "Later", tone: "low", rank: 3 };
}

export function buildTaskDeskAction(input: TaskDeskActionInput): TaskDeskAction {
  const isZh = input.language === "zh";

  if (input.isRunning) {
    return {
      eyebrow: isZh ? "当前任务" : "Current task",
      primaryLabel: isZh ? "正在执行" : "Running",
      statusText: input.mode === "public"
        ? (isZh ? "正在采集公开信息" : "Collecting public signals")
        : (isZh ? "智能体正在研判" : "Agent is analyzing"),
      helperText: isZh ? "先等待本轮完成，再查看系统给出的主行动。" : "Wait for this run to finish, then review the primary action.",
    };
  }

  if (!input.hasInput) {
    return {
      eyebrow: isZh ? "当前任务" : "Current task",
      primaryLabel: input.mode === "public"
        ? (isZh ? "填写目标" : "Enter targets")
        : (isZh ? "补充材料" : "Add materials"),
      statusText: isZh ? "等待开始" : "Waiting to start",
      helperText: input.mode === "public"
        ? (isZh ? "先输入域名或 URL，系统会自动整理后续动作。" : "Enter domains or URLs first; the system will prepare the next action.")
        : (isZh ? "先补齐目标、背景或证据池，再启动深度远勘。" : "Add target, context, or evidence before starting deep recon."),
    };
  }

  if (input.hasResult) {
    return {
      eyebrow: isZh ? "当前任务" : "Current task",
      primaryLabel: input.mode === "public"
        ? (input.hasPriorityTarget ? (isZh ? "带入深度远勘" : "Promote to deep recon") : (isZh ? "查看重点目标" : "Review focus target"))
        : (isZh ? "导出研判报告" : "Export report"),
      statusText: input.mode === "public"
        ? (input.hasPriorityTarget ? (isZh ? "已形成优先目标" : "Priority target ready") : (isZh ? "已完成公开采集" : "Public recon complete"))
        : (isZh ? "已形成深度结论" : "Deep conclusion ready"),
      helperText: input.mode === "public"
        ? (isZh ? "先处理系统推荐的优先目标，其余线索可稍后展开。" : "Start with the recommended target; expand other clues later.")
        : (isZh ? "先查看结构化结论，再导出或继续追问。" : "Review the structured conclusion, then export or ask follow-up questions."),
    };
  }

  return {
    eyebrow: isZh ? "当前任务" : "Current task",
    primaryLabel: input.mode === "public"
      ? (isZh ? "开始公网远勘" : "Start public recon")
      : (isZh ? "开始深度远勘" : "Start deep recon"),
    statusText: isZh ? "已准备" : "Ready",
    helperText: isZh ? "点击主按钮开始，结果出来后先看系统推荐动作。" : "Click the primary action; after results, start with the recommended next step.",
  };
}

export function buildAgenticTrace(steps: AgenticTraceInput[], activeIndex: number): AgenticTraceItem[] {
  const normalizedActiveIndex = Math.max(0, Math.min(activeIndex, Math.max(steps.length - 1, 0)));
  return steps.map((step, index) => ({
    ...step,
    status: index < normalizedActiveIndex ? "done" : index === normalizedActiveIndex ? "active" : "pending",
  }));
}

export function buildReconDecision(input: ReconDecisionInput): ReconDecision {
  const isZh = input.language === "zh";
  const target = input.target?.trim() || (isZh ? "当前目标" : "current target");
  const primaryClue = input.primaryClue?.trim();
  const highPriority = input.riskScore >= 60 || input.clueCount >= 3;
  const mediumPriority = input.riskScore >= 30 || input.clueCount > 0 || input.reachable;

  if (highPriority) {
    return {
      headline: isZh ? `优先处理 ${target}` : `Prioritize ${target}`,
      action: isZh ? "先带入深度远勘，围绕可调证线索和后台控制面继续研判。" : "Promote it to deep recon first, focusing on actionable clues and backend control surfaces.",
      reason: primaryClue
        ? (isZh ? `已出现较强线索：${primaryClue}。` : `Strong clue observed: ${primaryClue}.`)
        : (isZh ? `风险分 ${input.riskScore}，线索数量 ${input.clueCount}，值得优先核验。` : `Risk score ${input.riskScore} with ${input.clueCount} clues deserves priority verification.`),
      confidenceLabel: isZh ? "高优先级" : "High priority",
    };
  }

  if (mediumPriority) {
    return {
      headline: isZh ? `先核验 ${target}` : `Verify ${target} first`,
      action: isZh ? "先查看关键依据，确认网站用途、部署线索和可调证信息是否成立。" : "Review the key evidence first and confirm purpose, deployment clues, and actionable evidence.",
      reason: primaryClue
        ? (isZh ? `已有线索：${primaryClue}。` : `Observed clue: ${primaryClue}.`)
        : (isZh ? "目标可访问或存在少量可用线索，适合先做人工核验。" : "The target is reachable or has limited usable signals, suitable for manual verification."),
      confidenceLabel: isZh ? "中优先级" : "Medium priority",
    };
  }

  return {
    headline: isZh ? "暂不建议立即深挖" : "Do not escalate immediately",
    action: isZh ? "先补充目标、案件背景或页面材料，再重新采集。" : "Add target context, case background, or page evidence before collecting again.",
    reason: isZh ? "当前线索不足，直接深挖容易造成噪声。" : "Current signals are too weak; deeper analysis would likely add noise.",
    confidenceLabel: isZh ? "低优先级" : "Low priority",
  };
}

export function buildRevealMotion(index: number, stepMs = 50, maxDelayMs = 240, durationMs = 280) {
  const normalizedIndex = Math.max(0, index);
  return {
    delayMs: Math.min(normalizedIndex * stepMs, maxDelayMs),
    durationMs,
  };
}

export function getReportPreviewColumnCount(sections: ReconWorkspaceSection[]) {
  if (sections.length <= 1) return 1;
  const hasLongSection = sections.some((section) => section.content.trim().length >= 280);
  if (hasLongSection) return 1;
  const combinedLength = sections.slice(0, 4).reduce((sum, section) => sum + section.content.trim().length, 0);
  return combinedLength >= 220 ? 1 : 2;
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase();
}

function extractSections(markdown: string) {
  const cleaned = markdown.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const matches = [...cleaned.matchAll(headingRegex)];

  if (matches.length === 0) {
    return [
      {
        title: "重点结论",
        content: cleaned,
      },
    ];
  }

  return matches.map((match, index) => {
    const title = match[1].trim();
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index || cleaned.length) : cleaned.length;
    const content = cleaned.slice(start, end).trim();

    return { title, content };
  });
}

export function extractMarkdownSections(markdown: string, fallbackTitle = "内容概览"): ReconWorkspaceSection[] {
  const sections = extractSections(markdown);
  if (sections.length === 0) {
    return [{ title: fallbackTitle, content: "" }];
  }

  return sections.map((section) => ({
    title: section.title.trim() || fallbackTitle,
    content: section.content.trim(),
  }));
}

function findSectionContent(sections: Array<{ title: string; content: string }>, keywords: string[]) {
  const found = sections.find((section) => {
    const title = normalizeTitle(section.title);
    return keywords.some((keyword) => title.includes(keyword));
  });

  return found?.content || "";
}

function fallbackContent(sections: Array<{ title: string; content: string }>, skipTitles: string[]) {
  const result = sections
    .filter((section) => {
      const title = normalizeTitle(section.title);
      return !skipTitles.some((keyword) => title.includes(keyword));
    })
    .map((section) => `## ${section.title}\n${section.content}`.trim())
    .join("\n\n")
    .trim();

  return result;
}

export function extractDeepReconSections(markdown: string): DeepReconSections {
  const sections = extractSections(markdown);

  const summaryKeywords = ["重点结论", "结论", "核心结论", "summary", "conclusion", "findings"];
  const evidenceKeywords = ["核心依据", "依据", "发现", "证据", "evidence", "basis"];
  const nextKeywords = ["后续建议", "建议", "下一步", "next", "action", "recommendation"];

  const summaryContent = findSectionContent(sections, summaryKeywords) || markdown.trim();
  const evidenceContent = findSectionContent(sections, evidenceKeywords) || fallbackContent(sections, [...summaryKeywords, ...nextKeywords]);
  const nextStepsContent = findSectionContent(sections, nextKeywords);

  return {
    summary: {
      title: "重点结论",
      content: summaryContent.trim(),
    },
    evidence: {
      title: "核心依据",
      content: evidenceContent.trim() || "暂无补充依据。",
    },
    nextSteps: {
      title: "后续建议",
      content: nextStepsContent.trim() || "建议继续围绕现有线索做人工核验与拓线。",
    },
  };
}
