import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Terminal, Check, Loader2, BrainCircuit } from "lucide-react";
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

export default function ThinkingProcess({ steps = [], isFinished, language }: ThinkingProcessProps) {
  const [isExpanded, setIsExpanded] = useState(!isFinished);
  const t = translations[language];

  // Check if any step has a table
  const hasTable = (steps || []).some(step => {
    if (!step.toolCall?.output || step.toolCall.isError) return false;
    try {
        const parsed = JSON.parse(step.toolCall.output);
        return parsed && Array.isArray(parsed.headers) && Array.isArray(parsed.rows);
    } catch { return false; }
  });

  useEffect(() => {
    if (!isFinished) {
      setIsExpanded(true);
    } else {
        setIsExpanded(false);
    }
  }, [isFinished]);

  if (steps.length === 0) return null;

  return (
    <div className="my-6 w-full max-w-full group">
      {/* Header - Modern Card Style */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
          isExpanded 
            ? "bg-white border-indigo-100 shadow-md ring-1 ring-indigo-50" 
            : "bg-white/80 border-slate-200/60 hover:bg-white hover:border-indigo-200 hover:shadow-sm"
        }`}
      >
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
          isFinished 
            ? "bg-emerald-50 text-emerald-600" 
            : "bg-indigo-50 text-indigo-600"
        }`}>
          {isFinished ? (
            <Check size={16} strokeWidth={2.5} />
          ) : (
            <BrainCircuit size={16} className="animate-pulse" />
          )}
        </div>
        
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${isExpanded ? "text-indigo-900" : "text-slate-700"}`}>
              {t.thinking_process}
            </span>
            {!isFinished && (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100/50">
                <Loader2 size={10} className="animate-spin" />
                {t.processing_label}
              </span>
            )}
            {hasTable && (
               <span className="flex items-center gap-1 text-[10px] font-medium bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100/50">
                   <Terminal size={10} />
                   {t.data_label}
               </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 font-medium">
            {steps.length} {steps.length === 1 ? t.thinking_step : t.thinking_steps} {t.thinking_analysis}
          </div>
        </div>

        <div className={`p-1.5 rounded-lg transition-all duration-200 ${
          isExpanded ? "bg-indigo-50 text-indigo-500 rotate-180" : "text-slate-400 group-hover:text-indigo-400"
        }`}>
          <ChevronDown size={16} />
        </div>
      </button>

      {/* Content - Timeline Style */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mx-4 px-4 py-5 space-y-6 border-l-2 border-indigo-100/50 ml-8 mt-2">
              {steps.map((step, idx) => (
                <motion.div 
                  key={step.id || idx} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative pl-6"
                >
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[31px] top-1 w-5 h-5 rounded-full border-[3px] shadow-sm z-10 transition-colors duration-300 ${
                    step.toolCall?.isLoading 
                      ? "border-indigo-500 bg-white animate-pulse shadow-indigo-200" 
                      : step.toolCall?.isError
                        ? "border-red-400 bg-white shadow-red-100"
                        : "border-emerald-400 bg-white shadow-emerald-100"
                  }`} />

                  {/* Step Content Card */}
                  <div className="group/step">
                    {/* Thought Text */}
                    {step.title && (
                      <div className="text-sm text-slate-600 leading-relaxed mb-3 prose prose-sm max-w-none prose-p:my-0 prose-ul:my-0 prose-li:my-0 prose-strong:text-indigo-700 prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:font-medium">
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
                </motion.div>
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

  useEffect(() => {
    if (tableData) {
        setShowOutput(true);
    }
  }, [tableData]);
  
  return (
    <div className={`rounded-xl overflow-hidden border transition-all duration-200 ${
      isError 
        ? "bg-red-50/30 border-red-100" 
        : "bg-slate-50/50 border-slate-200/60 hover:border-indigo-200 hover:shadow-sm"
    }`}>
      {/* Command Bar */}
      <button 
        onClick={() => setShowOutput(!showOutput)}
        className="w-full flex items-center gap-3 p-3 text-xs font-mono text-left transition-colors group/cmd"
      >
        <div className={`p-1.5 rounded-md ${
          isError ? "bg-red-100 text-red-600" : "bg-slate-200/50 text-slate-500 group-hover/cmd:text-indigo-500 group-hover/cmd:bg-indigo-50"
        }`}>
          <Terminal size={14} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={`truncate font-medium ${isError ? "text-red-700" : "text-slate-700"}`}>
            {command}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded-md">
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

      {/* Output Area */}
      <AnimatePresence>
        {showOutput && output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100/50"
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
