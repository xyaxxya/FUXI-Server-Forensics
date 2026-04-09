import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Terminal, Check, Loader2, Search, Globe, ExternalLink, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { translations, Language } from "../../translations";
import DataTable from "../DataTable";

export interface ThinkingStep {
  id: string;
  title: string; // The "thought" or description
  content?: string; // Detailed content (optional)
  toolCall?: {
    command: string;
    args: any;
    output?: string;
    isError?: boolean;
    isLoading?: boolean;
  };
}

interface ThinkingProcessProps {
  steps: ThinkingStep[];
  isFinished: boolean;
  language: Language;
}

interface WebSearchItem {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
}

interface WebSearchResultPayload {
  type: "web_search_results";
  query?: string;
  result_count?: number;
  items: WebSearchItem[];
}

interface WebPageResultPayload {
  type: "web_page";
  url: string;
  title: string;
  content: string;
}

type ToolKind = "search_web" | "fetch_webpage" | "other";

interface StepTraceEntry {
  stepId: string;
  kind: Exclude<ToolKind, "other">;
  round: number;
  label: string;
  isLoading: boolean;
  isError: boolean;
}

type ParsedToolOutput =
  | { kind: "table"; data: { headers: string[]; rows: string[][] } }
  | { kind: "web_search"; data: WebSearchResultPayload }
  | { kind: "web_page"; data: WebPageResultPayload }
  | { kind: "text" };

function parseToolOutput(output?: string, isError?: boolean): ParsedToolOutput {
  if (!output || isError) {
    return { kind: "text" };
  }

  try {
    const parsed = JSON.parse(output) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { headers?: unknown[] }).headers) &&
      Array.isArray((parsed as { rows?: unknown[] }).rows)
    ) {
      return { kind: "table", data: parsed as { headers: string[]; rows: string[][] } };
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { type?: string }).type === "web_search_results" &&
      Array.isArray((parsed as { items?: unknown[] }).items)
    ) {
      return { kind: "web_search", data: parsed as WebSearchResultPayload };
    }

    if (
      Array.isArray(parsed) &&
      parsed.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof (item as { title?: string }).title === "string" &&
          typeof (item as { url?: string }).url === "string",
      )
    ) {
      return {
        kind: "web_search",
        data: {
          type: "web_search_results",
          items: parsed as WebSearchItem[],
          result_count: parsed.length,
        },
      };
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      ((parsed as { type?: string }).type === "web_page" ||
        (typeof (parsed as { url?: string }).url === "string" &&
          typeof (parsed as { title?: string }).title === "string" &&
          typeof (parsed as { content?: string }).content === "string"))
    ) {
      return { kind: "web_page", data: parsed as WebPageResultPayload };
    }
  } catch {
    return { kind: "text" };
  }

  return { kind: "text" };
}

function getToolKind(args?: Record<string, unknown>, command?: string): ToolKind {
  if (typeof args?.query === "string" || command === "search_web") {
    return "search_web";
  }
  if (typeof args?.url === "string" || command === "fetch_webpage") {
    return "fetch_webpage";
  }
  return "other";
}

function buildToolArgsSummary(args?: Record<string, unknown>) {
  if (!args) {
    return "";
  }

  if (typeof args.query === "string" && args.query.trim()) {
    return args.query.trim();
  }

  if (typeof args.url === "string" && args.url.trim()) {
    return args.url.trim();
  }

  if (typeof args.path === "string" && typeof args.pattern === "string") {
    return `${args.path} · ${args.pattern}`;
  }

  if (typeof args.path === "string" && args.path.trim()) {
    return args.path.trim();
  }

  if (typeof args.pattern === "string" && args.pattern.trim()) {
    return args.pattern.trim();
  }

  if (Array.isArray(args.search_paths) && args.search_paths.length > 0) {
    const values = args.search_paths.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return values.slice(0, 2).join(" · ");
  }

  return "";
}

function getStepTraceEntries(steps: ThinkingStep[]): StepTraceEntry[] {
  let searchRound = 0;
  let fetchRound = 0;

  return steps.reduce<StepTraceEntry[]>((entries, step) => {
    if (!step.toolCall) {
      return entries;
    }

    const args = (step.toolCall.args ?? {}) as Record<string, unknown>;
    const kind = getToolKind(args, step.toolCall.command);
    if (kind === "search_web" && typeof args.query === "string") {
      searchRound += 1;
      entries.push({
        stepId: step.id,
        kind,
        round: searchRound,
        label: args.query,
        isLoading: !!step.toolCall.isLoading,
        isError: !!step.toolCall.isError,
      });
      return entries;
    }

    if (kind === "fetch_webpage" && typeof args.url === "string") {
      fetchRound += 1;
      entries.push({
        stepId: step.id,
        kind,
        round: fetchRound,
        label: args.url,
        isLoading: !!step.toolCall.isLoading,
        isError: !!step.toolCall.isError,
      });
      return entries;
    }

    return entries;
  }, []);
}

function getLatestStepSummary(steps: ThinkingStep[]) {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step.toolCall?.isLoading) {
      return step.title || step.toolCall.command;
    }
  }

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step.title?.trim()) {
      return step.title.trim();
    }
  }

  return "";
}

function shouldRenderStepTitle(step: ThinkingStep) {
  if (!step.title?.trim()) {
    return false;
  }
  if (!step.toolCall) {
    return true;
  }

  const normalizedTitle = step.title.replace(/\s+/g, " ").trim();
  const normalizedCommand = step.toolCall.command.replace(/\s+/g, " ").trim();
  return normalizedTitle !== normalizedCommand;
}

export default function ThinkingProcess({ steps = [], isFinished, language }: ThinkingProcessProps) {
  const [isExpanded, setIsExpanded] = useState(!isFinished);
  const t = translations[language];
  const traceEntries = getStepTraceEntries(steps);
  const latestStepSummary = useMemo(() => getLatestStepSummary(steps), [steps]);

  // Check if any step has a table
  const hasTable = (steps || []).some((step) => parseToolOutput(step.toolCall?.output, step.toolCall?.isError).kind === "table");

  useEffect(() => {
    if (!isFinished) {
      setIsExpanded(true);
    } else {
        setIsExpanded(false);
    }
  }, [isFinished]);

  if (steps.length === 0) return null;

  return (
    <div className="my-5 w-full max-w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative w-full overflow-hidden rounded-[1.1rem] border px-4 py-3 text-left transition-all duration-300 ${
          isExpanded
            ? "border-slate-300 bg-white shadow-[0_24px_48px_-36px_rgba(15,23,42,0.24)]"
            : "border-slate-200 bg-white/85 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_26px_54px_-34px_rgba(59,130,246,0.18)]"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
        {!isFinished && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
          </div>
        )}
        <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
          isFinished ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-300 bg-slate-50 text-slate-600"
        }`}>
          {isFinished ? (
            <Check size={16} strokeWidth={2.5} />
          ) : (
            <Loader2 size={15} className="animate-spin" />
          )}
        </div>
        
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold tracking-[0.12em] text-slate-900">
              {isFinished ? t.thinking_done_label : t.thinking_live_label}
            </span>
            {!isFinished && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                {t.processing_label}
              </span>
            )}
            {hasTable && (
               <span className="flex items-center gap-1 rounded-full border border-purple-100 bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-600">
                   <Terminal size={10} />
                   {t.data_label}
               </span>
            )}
          </div>
          <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
            {latestStepSummary || t.thinking_process}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {steps.length} {steps.length === 1 ? t.thinking_step : t.thinking_steps} {t.thinking_analysis}
          </div>
        </div>

        <div className={`mt-0.5 rounded-lg p-1.5 transition-all duration-200 ${
          isExpanded ? "rotate-180 bg-slate-100 text-slate-600" : "text-slate-400"
        }`}>
          <ChevronDown size={16} />
        </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mx-1 mt-2 space-y-3 border-l border-slate-200 px-4 py-3">
              {!isFinished && latestStepSummary && (
                <div className="flex items-center gap-2 rounded-[0.95rem] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-[0_20px_40px_-38px_rgba(59,130,246,0.45)]">
                  <Loader2 size={14} className="shrink-0 animate-spin text-slate-500" />
                  <span className="line-clamp-2">{latestStepSummary}</span>
                </div>
              )}

              {traceEntries.length > 0 && (
                <div className="rounded-[0.95rem] border border-slate-200 bg-slate-50/90 p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
                    <Search size={15} />
                    {t.search_trace_label}
                  </div>
                  <div className="mt-3 space-y-2">
                    {traceEntries.map((entry) => (
                      <div
                        key={`${entry.stepId}-${entry.kind}-${entry.round}`}
                        className="flex items-center gap-3 rounded-[0.8rem] border border-slate-100 bg-white px-3 py-2 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-[0_16px_32px_-28px_rgba(59,130,246,0.28)]"
                      >
                        <span
                          className={`rounded-full px-2 py-1 font-medium ${
                            entry.kind === "search_web"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {entry.kind === "search_web"
                            ? `${t.search_round_label} ${entry.round}`
                            : `${t.fetch_round_label} ${entry.round}`}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-600">{entry.label}</span>
                        <span
                          className={`rounded-full px-2 py-1 ${
                            entry.isLoading
                              ? "bg-indigo-50 text-indigo-600"
                              : entry.isError
                                ? "bg-rose-50 text-rose-600"
                                : "bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          {entry.isLoading ? t.processing_label : entry.isError ? t.search_status_failed : t.search_status_done}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {steps.map((step, idx) => (
                <motion.div 
                  key={step.id || idx} 
                  initial={{ opacity: 0, x: -10, y: 8 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.28, ease: "easeOut" }}
                  className="relative pl-5"
                >
                  {idx > 0 && (
                    <div className="mb-3 h-px w-full bg-gradient-to-r from-slate-200 via-slate-100 to-transparent" />
                  )}
                  <div className={`absolute -left-[22px] top-1 h-3 w-3 rounded-full border-2 bg-white transition-colors duration-300 ${
                    step.toolCall?.isLoading 
                      ? "border-slate-500 animate-pulse" 
                      : step.toolCall?.isError
                        ? "border-red-400"
                        : "border-emerald-400"
                  }`} />

                  <div className="group/step">
                    {shouldRenderStepTitle(step) && (
                      <div className="mb-2 text-sm leading-6 text-slate-700 prose prose-sm max-w-none prose-p:my-0 prose-ul:my-0 prose-li:my-0 prose-strong:text-slate-900 prose-code:text-slate-700 prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-medium">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {step.title}
                        </ReactMarkdown>
                      </div>
                    )}

                    {step.toolCall && (
                      <ToolExecutionBlock 
                        command={step.toolCall.command} 
                        args={step.toolCall.args}
                        output={step.toolCall.output} 
                        isError={step.toolCall.isError}
                        isLoading={step.toolCall.isLoading}
                        language={language}
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolExecutionBlock({
  command,
  args,
  output,
  isError,
  isLoading,
  language,
}: {
  command: string;
  args?: Record<string, unknown>;
  output?: string;
  isError?: boolean;
  isLoading?: boolean;
  language: Language;
}) {
  const [showOutput, setShowOutput] = useState(false);
  const t = translations[language];
  const parsedOutput = parseToolOutput(output, isError);
  const tableData = parsedOutput.kind === "table" ? parsedOutput.data : null;
  const webSearchData = parsedOutput.kind === "web_search" ? parsedOutput.data : null;
  const webPageData = parsedOutput.kind === "web_page" ? parsedOutput.data : null;
  const query = typeof args?.query === "string" ? args.query : webSearchData?.query;
  const targetUrl = typeof args?.url === "string" ? args.url : webPageData?.url;
  const summaryText = buildToolArgsSummary(args) || targetUrl || query || "";
  const toolKind = getToolKind(args, command);
  const hasStructuredOutput = parsedOutput.kind === "table" || parsedOutput.kind === "web_search" || parsedOutput.kind === "web_page";
  const compactCommand = command.trim();

  useEffect(() => {
    if (hasStructuredOutput) {
        setShowOutput(true);
    }
  }, [hasStructuredOutput, output, isError]);
  
  return (
    <div className={`overflow-hidden rounded-[1rem] border transition-all duration-200 ${
      isError 
        ? "border-red-100 bg-red-50/20 shadow-[0_18px_36px_-34px_rgba(239,68,68,0.22)]" 
        : "border-slate-200 bg-white shadow-[0_18px_36px_-34px_rgba(15,23,42,0.16)] hover:border-slate-300 hover:shadow-[0_22px_42px_-32px_rgba(59,130,246,0.14)]"
    }`}>
      <button 
        onClick={() => setShowOutput(!showOutput)}
        className="group/cmd flex w-full items-start gap-3 p-3 text-left transition-colors"
      >
        <div className={`mt-0.5 rounded-md p-1.5 ${
          isError ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
        }`}>
          <Terminal size={14} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={`font-mono text-[12px] leading-6 ${isError ? "text-red-700" : "text-slate-800"}`}>
            {compactCommand}
          </div>
          {summaryText && summaryText !== compactCommand && (
            <div className="mt-1 truncate font-mono text-[10px] text-slate-500">
              {summaryText}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
            <Loader2 size={10} className="animate-spin" />
            {t.executing_label}
          </div>
        )}
        
        {tableData && (
             <span className="flex items-center gap-1.5 text-[10px] text-purple-600 bg-purple-50 border border-purple-100 px-2 py-1 rounded-md font-medium">
                 <Terminal size={10} />
                 {tableData.rows.length} {t.rows_label}
             </span>
        )}

        {webSearchData && (
          <span className="flex items-center gap-1.5 text-[10px] text-sky-600 bg-sky-50 border border-sky-100 px-2 py-1 rounded-md font-medium">
            <Search size={10} />
            {webSearchData.result_count ?? webSearchData.items.length} {t.search_results_label}
          </span>
        )}

        {webPageData && (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md font-medium">
            <Globe size={10} />
            {t.web_page_label}
          </span>
        )}

        {toolKind === "search_web" && !webSearchData && (
          <span className="flex items-center gap-1.5 text-[10px] text-sky-600 bg-sky-50 border border-sky-100 px-2 py-1 rounded-md font-medium">
            <Search size={10} />
            {t.search_round_label}
          </span>
        )}

        {toolKind === "fetch_webpage" && !webPageData && (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md font-medium">
            <Globe size={10} />
            {t.fetch_round_label}
          </span>
        )}
        
        {output && (
            <div className={`p-1 rounded-md transition-all ${
              showOutput 
                ? "bg-slate-200/50 text-slate-600 rotate-180" 
                : "text-slate-400 hover:bg-slate-100"
            }`}>
               <ChevronDown size={14} />
            </div>
        )}
      </button>

      <AnimatePresence>
        {showOutput && output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100"
          >
            {tableData ? (
                <div className="p-3 bg-white">
                    <DataTable 
                        headers={tableData.headers} 
                        rows={tableData.rows} 
                        language={language}
                        title={t.result_set}
                    />
                </div>
            ) : webSearchData ? (
                <div className="space-y-3 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                      <Search size={12} />
                      {t.search_results_panel}
                    </span>
                    {query && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                        {t.search_query_label}：{query}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                      {webSearchData.result_count ?? webSearchData.items.length} {t.search_results_label}
                    </span>
                  </div>

                  {webSearchData.items.length > 0 ? (
                    <div className="space-y-3">
                      {webSearchData.items.map((item, index) => (
                        <a
                          key={`${item.url}-${index}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-[1rem] border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/50 hover:shadow-[0_20px_40px_-32px_rgba(14,165,233,0.24)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span className="rounded-full bg-white px-2 py-0.5">{item.engine || t.search_source_default}</span>
                                <span className="truncate">{item.url}</span>
                              </div>
                            </div>
                            <ExternalLink size={14} className="mt-0.5 shrink-0 text-slate-400" />
                          </div>
                          {item.snippet && <div className="mt-3 text-xs leading-6 text-slate-600">{item.snippet}</div>}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-xs text-slate-500">
                      {t.search_no_results}
                    </div>
                  )}
                </div>
            ) : webPageData ? (
                <div className="space-y-3 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      <FileText size={12} />
                      {t.web_page_label}
                    </span>
                    {targetUrl && (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
                      >
                        <span className="truncate">{targetUrl}</span>
                        <ExternalLink size={11} className="shrink-0" />
                      </a>
                    )}
                  </div>
                  {webPageData.title && <div className="text-sm font-semibold text-slate-900">{webPageData.title}</div>}
                  <div className="max-h-80 overflow-auto rounded-[1rem] bg-slate-50 p-4 text-xs leading-6 text-slate-700 custom-scrollbar whitespace-pre-wrap shadow-inner">
                    {webPageData.content}
                  </div>
                </div>
            ) : (
                <div className={`p-4 overflow-x-auto text-[11px] font-mono leading-relaxed whitespace-pre-wrap max-h-80 custom-scrollbar ${
                isError ? "text-red-600 bg-red-50/30" : "text-slate-600 bg-slate-50"
                }`}>
                {output}
                </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
