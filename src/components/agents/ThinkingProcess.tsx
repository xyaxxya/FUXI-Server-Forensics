import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Terminal, Check, Loader2 } from "lucide-react";
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

export default function ThinkingProcess({ steps, isFinished, language }: ThinkingProcessProps) {
  const [isExpanded, setIsExpanded] = useState(!isFinished);
  const t = translations[language];

  // Check if any step has a table
  const hasTable = steps.some(step => {
    if (!step.toolCall?.output || step.toolCall.isError) return false;
    try {
        const parsed = JSON.parse(step.toolCall.output);
        return parsed && Array.isArray(parsed.headers) && Array.isArray(parsed.rows);
    } catch { return false; }
  });

  // Initial expand state logic
  // If loading (not finished), expand.
  // If finished, collapse by default.
  // We removed the forced expansion effect to respect user toggle.
  useEffect(() => {
    if (!isFinished) {
      setIsExpanded(true);
    } else {
        // Optional: Auto-collapse on finish?
        // Let's leave it as is (user can close it manually) or collapse it if it was auto-expanded.
        // For now, let's auto-collapse on finish to keep UI clean, UNLESS user opened it?
        // Actually, best UX: Expand while thinking. Collapse when done.
        // User complained "can't go back", so we must allow collapse.
        setIsExpanded(false);
    }
  }, [isFinished]);

  if (steps.length === 0) return null;

  return (
    <div className="my-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 w-full max-w-full">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-3 bg-slate-100 hover:bg-slate-200/80 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
        )}
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 flex-1 overflow-hidden">
          <span className="flex items-center gap-1.5 flex-shrink-0">
            {isFinished ? (
              <Check size={14} className="text-green-600" />
            ) : (
              <Loader2 size={14} className="animate-spin text-blue-600" />
            )}
            {t.thinking_process}
          </span>
          <span className="text-xs font-normal text-slate-500 flex-shrink-0">
            ({steps.length} {steps.length === 1 ? 'step' : 'steps'})
          </span>
          {hasTable && (
             <span className="ml-auto flex items-center gap-1 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 flex-shrink-0">
                 <Terminal size={10} />
                 Data Table
             </span>
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-3 space-y-3 border-t border-slate-200">
              {steps.map((step, idx) => (
                <div key={step.id || idx} className="relative pl-4 pb-2 last:pb-0">
                  {/* Vertical Line */}
                  {idx !== steps.length - 1 && (
                    <div className="absolute left-[7px] top-6 bottom-0 w-px bg-slate-200" />
                  )}
                  
                  {/* Dot */}
                  <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                    step.toolCall?.isLoading 
                      ? "border-blue-500 bg-white animate-pulse" 
                      : step.toolCall?.isError
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300 bg-slate-50"
                  }`} />

                  {/* Step Content */}
                  <div className="space-y-2">
                    {/* Thought Text */}
                    {step.title && (
                      <div className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-p:my-0 prose-ul:my-0 prose-li:my-0">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {step.title}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Tool Execution */}
                    {step.toolCall && (
                      <ToolExecutionBlock 
                        command={step.toolCall.command} 
                        output={step.toolCall.output} 
                        isError={step.toolCall.isError}
                        isLoading={step.toolCall.isLoading}
                        language={language}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolExecutionBlock({ command, output, isError, isLoading, language }: { command: string, output?: string, isError?: boolean, isLoading?: boolean, language: Language }) {
  const [showOutput, setShowOutput] = useState(false);
  const t = translations[language];

  // Try to parse output as DbQueryResult
  let tableData = null;
  if (output && !isError) {
      try {
          const parsed = JSON.parse(output);
          if (parsed && Array.isArray(parsed.headers) && Array.isArray(parsed.rows)) {
              tableData = parsed;
          }
      } catch (e) {
          // Not a JSON table, normal text output
      }
  }

  // Auto-expand if table detected
  useEffect(() => {
    if (tableData) {
        setShowOutput(true);
    }
  }, [tableData]);
  
  return (
    <div className="mt-1 border border-slate-200 rounded-md overflow-hidden bg-white w-full max-w-full min-w-0">
      {/* Command Bar */}
      <button 
        onClick={() => setShowOutput(!showOutput)}
        className={`w-full flex items-center gap-2 p-2 text-xs font-mono text-left transition-colors ${
          isError ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
        }`}
      >
        <Terminal size={12} className={isError ? "text-red-500" : "text-slate-500"} />
        <span className="flex-1 truncate">{command}</span>
        {isLoading && <Loader2 size={12} className="animate-spin text-blue-500" />}
        {tableData && (
             <span className="text-[10px] text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-semibold">
                 Table: {tableData.rows.length} rows
             </span>
        )}
        {output && (
            <span className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
                {showOutput ? t.hide_output : t.show_output}
            </span>
        )}
      </button>

      {/* Output Area */}
      <AnimatePresence>
        {showOutput && output && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="border-t border-slate-100"
          >
            {tableData ? (
                <div className="p-2 bg-slate-50/30">
                    <DataTable 
                        headers={tableData.headers} 
                        rows={tableData.rows} 
                        language={language}
                        title="Result Set"
                    />
                </div>
            ) : (
                <div className={`p-2 overflow-x-auto text-[10px] font-mono whitespace-pre-wrap max-h-60 custom-scrollbar ${
                isError ? "text-red-600 bg-red-50/30" : "text-slate-600 bg-slate-50/30"
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
