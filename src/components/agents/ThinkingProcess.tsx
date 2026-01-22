import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Terminal, Check, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { translations, Language } from "../../translations";

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

  // Auto-collapse when finished, auto-expand when new steps added (if not finished)
  useEffect(() => {
    if (isFinished) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  }, [isFinished]);

  if (steps.length === 0) return null;

  return (
    <div className="my-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-3 bg-slate-100 hover:bg-slate-200/80 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-slate-500" />
        ) : (
          <ChevronRight size={16} className="text-slate-500" />
        )}
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="flex items-center gap-1.5">
            {isFinished ? (
              <Check size={14} className="text-green-600" />
            ) : (
              <Loader2 size={14} className="animate-spin text-blue-600" />
            )}
            {t.thinking_process}
          </span>
          <span className="text-xs font-normal text-slate-500">
            ({steps.length} {steps.length === 1 ? 'step' : 'steps'})
          </span>
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

  return (
    <div className="mt-1 border border-slate-200 rounded-md overflow-hidden bg-white">
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
            <div className={`p-2 overflow-x-auto text-[10px] font-mono whitespace-pre-wrap max-h-60 custom-scrollbar ${
              isError ? "text-red-600 bg-red-50/30" : "text-slate-600 bg-slate-50/30"
            }`}>
              {output}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
