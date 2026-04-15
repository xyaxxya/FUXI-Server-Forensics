import { Children, isValidElement, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Language, translations } from "../../translations";
import type { AIMessage } from "../../lib/ai";

function normalizeCodeText(value: unknown): string {
  if (typeof value === "string") {
    return value.replace(/\n$/, "");
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCodeText(item)).join("");
  }
  if (value == null) {
    return "";
  }
  return String(value).replace(/\n$/, "");
}

function extractCodePayload(children: ReactNode) {
  const firstChild = Children.toArray(children)[0];
  if (!isValidElement(firstChild)) {
    return null;
  }

  const props = firstChild.props as { className?: string; children?: unknown };
  const className = typeof props.className === "string" ? props.className : "";
  const languageMatch = /language-([\w-]+)/.exec(className);
  return {
    code: normalizeCodeText(props.children),
    language: languageMatch?.[1] || "text",
  };
}

function countCodeLines(value: string) {
  return value ? value.split(/\r?\n/).length : 0;
}

function CopyButton({
  value,
  language,
  className,
}: {
  value: string;
  language: Language;
  className?: string;
}) {
  const t = translations[language];
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value.trim()) {
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={className || "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700"}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? t.copy_done_label : t.copy_label}
    </button>
  );
}

function CodeBlock({ code, language, uiLanguage }: { code: string; language: string; uiLanguage: Language }) {
  const t = translations[uiLanguage];
  const [collapsed, setCollapsed] = useState(countCodeLines(code) > 18);
  const lineCount = useMemo(() => countCodeLines(code), [code]);

  return (
    <div className="my-3 overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-950 text-slate-100 shadow-[0_28px_54px_-36px_rgba(15,23,42,0.55)]" data-code-block={code}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900/90 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-medium text-slate-200">{language}</span>
          <span>{lineCount} {t.rows_label}</span>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton
            value={code}
            language={uiLanguage}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          />
          {lineCount > 8 && (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <ChevronDown size={11} className={`transition-transform ${collapsed ? "" : "rotate-180"}`} />
              {collapsed ? t.expand_code_label : t.collapse_code_label}
            </button>
          )}
        </div>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${collapsed ? "max-h-52" : "max-h-[960px]"}`}>
        <pre className="overflow-auto px-4 py-4 text-[12px] leading-6 text-slate-100 custom-scrollbar whitespace-pre-wrap">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export function ChatTranscriptMessage({ message, language }: { message: AIMessage; language: Language }) {
  const isUser = message.role === "user";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`neo-msg-wrap ${isUser ? "pt-1" : "pl-6"}`}>
      {isUser ? (
        <div className="neo-msg-card neo-msg-user group rounded-[1.25rem] px-4 py-3 transition-all duration-200 hover:-translate-y-0.5" data-message-role="user" data-message-content={message.content}>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[11px] text-slate-600">
              &gt;
            </span>
            {translations[language].user_label}
          </div>
          <div className="whitespace-pre-wrap text-[14px] leading-7 tracking-[0.01em] text-slate-800/95">{message.content}</div>
        </div>
      ) : (
        <div className="neo-msg-card neo-msg-assistant group relative overflow-hidden rounded-[1.3rem] px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5" data-message-role="assistant" data-message-content={message.content}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.14)]" />
              {translations[language].assistant_label}
            </div>
            <CopyButton
              value={message.content}
              language={language}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-500 opacity-0 transition-all hover:border-slate-300 hover:text-slate-700 group-hover:opacity-100"
            />
          </div>
          <div className="relative pl-3 before:absolute before:bottom-1 before:left-0 before:top-1 before:w-px before:rounded-full before:bg-gradient-to-b before:from-cyan-200 before:via-slate-200 before:to-transparent">
            <div className="prose prose-sm max-w-none text-[14px] leading-7 text-slate-700 prose-p:my-2 prose-headings:mb-3 prose-headings:mt-5 prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0 prose-code:text-slate-700 prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-strong:text-slate-900">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children }) {
                    const payload = extractCodePayload(children);
                    if (!payload) {
                      return <pre>{children}</pre>;
                    }
                    return <CodeBlock code={payload.code} language={payload.language} uiLanguage={language} />;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function StickyPromptBar({ prompt, language }: { prompt: string; language: Language }) {
  if (!prompt.trim()) {
    return null;
  }

  return (
    <div className="sticky top-0 z-20 mb-4">
      <div className="rounded-[1.05rem] border border-slate-200/80 bg-white/88 p-3 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.28)] backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-[11px] font-semibold text-slate-500">
            &gt;
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{translations[language].current_question_label}</div>
            <div className="mt-1 line-clamp-2 whitespace-pre-wrap font-mono text-[13px] leading-6 text-slate-800">{prompt}</div>
          </div>
          <CopyButton
            value={prompt}
            language={language}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700"
          />
        </div>
      </div>
    </div>
  );
}
