import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileDown,
  FileSearch,
  FileText,
  Gauge,
  MonitorCheck,
  PlayCircle,
  Regex,
  Search,
  SquareTerminal,
  Text,
  Type,
  WrapText,
  X,
  ChevronDown
} from "lucide-react";
import { Language } from "../translations";
import { commands, PluginCommand } from "../config/commands";
import { useCommandStore } from "../store/CommandContext";
import { useToast } from "./Toast";
import GeneralInfoPanel from "./agents/GeneralInfoPanel";
import GeneralAgent from "./agents/GeneralAgent";
import DatabaseAgent from "./agents/DatabaseAgent";
import AgentPanel from "./agents/AgentPanel";
import PentestPanel from "./PentestPanel";
import TerminalXterm from "./TerminalXterm";
import { AISettings } from "../lib/ai";

type ViewerMode = "text" | "hex" | "binary";
type SearchMatch = { index: number; lineIndex: number; start: number; end: number };
type MenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

const ENCODING_OPTIONS = [
  "utf-8",
  "utf-16le",
  "utf-16be",
  "gbk",
  "gb18030",
  "big5",
  "shift_jis",
  "iso-8859-1",
  "windows-1252"
];

const CATEGORY_ORDER = ["system", "network", "security", "web", "database"] as const;

const CATEGORY_META: Record<string, { zh: string; en: string }> = {
  system: { zh: "系统取证", en: "System" },
  network: { zh: "网络取证", en: "Network" },
  security: { zh: "安全审计", en: "Security" },
  web: { zh: "Web 中间件", en: "Web" },
  database: { zh: "数据库", en: "Database" }
};

const SUBCATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  general: { zh: "通用", en: "General" },
  bt: { zh: "宝塔面板", en: "BT Panel" },
  nginx: { zh: "Nginx", en: "Nginx" },
  apache: { zh: "Apache", en: "Apache" },
  mysql: { zh: "MySQL/MariaDB", en: "MySQL/MariaDB" },
  postgres: { zh: "PostgreSQL", en: "PostgreSQL" },
  redis: { zh: "Redis", en: "Redis" }
};

const CATEGORY_WEIGHT: Record<string, number> = {
  system: 0,
  network: 1,
  security: 2,
  web: 3,
  database: 4
};

function getSubcategory(commandId: string, category: string): string {
  if (category === "web") {
    if (commandId.startsWith("bt_")) return "bt";
    if (commandId.startsWith("nginx_")) return "nginx";
    if (commandId.startsWith("apache_")) return "apache";
  }
  if (category === "database") {
    if (commandId.startsWith("mysql_")) return "mysql";
    if (commandId.startsWith("postgres_")) return "postgres";
    if (commandId.startsWith("redis_")) return "redis";
  }
  return "general";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchRegex(query: string, useRegex: boolean, caseSensitive: boolean): RegExp | null {
  if (!query.trim()) return null;
  const source = useRegex ? query : escapeRegExp(query);
  const flags = caseSensitive ? "g" : "gi";
  return new RegExp(source, flags);
}

function toHexLines(bytes: Uint8Array): string[] {
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const offset = i.toString(16).padStart(8, "0");
    const hex = Array.from(chunk)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const ascii = Array.from(chunk)
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
      .join("");
    rows.push(`${offset}  ${hex.padEnd(47, " ")}  ${ascii}`);
  }
  return rows;
}

function toBinaryLines(bytes: Uint8Array): string[] {
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += 6) {
    const chunk = bytes.slice(i, i + 6);
    const offset = i.toString(16).padStart(8, "0");
    const binary = Array.from(chunk)
      .map((b) => b.toString(2).padStart(8, "0"))
      .join(" ");
    rows.push(`${offset}  ${binary}`);
  }
  return rows;
}

function ContextMenu({
  x,
  y,
  items,
  onClose
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 260),
    top: Math.min(y, window.innerHeight - 16)
  };

  return createPortal(
    <div className="fixed inset-0 z-[10020]" onMouseDown={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.14, ease: "easeOut" }}
        style={style}
        onMouseDown={(e) => e.stopPropagation()}
        className="fixed w-[248px] rounded-2xl border border-blue-100 bg-white/95 backdrop-blur-xl shadow-[0_20px_50px_-24px_rgba(37,99,235,0.45)] p-1.5"
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.disabled) return;
              item.onClick();
              onClose();
            }}
            disabled={item.disabled}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              item.disabled
                ? "text-slate-300 cursor-not-allowed"
                : item.danger
                ? "text-rose-600 hover:bg-rose-50"
                : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </motion.div>
    </div>,
    document.body
  );
}

function TextViewer({
  isOpen,
  onClose,
  title,
  content,
  language
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  language: Language;
}) {
  const [copied, setCopied] = useState(false);
  const [wrapMode, setWrapMode] = useState(true);
  const [mode, setMode] = useState<ViewerMode>("text");
  const [encoding, setEncoding] = useState("utf-8");
  const [encodingOpen, setEncodingOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regexMode, setRegexMode] = useState(false);
  const [linesPerPage, setLinesPerPage] = useState(100);
  const [page, setPage] = useState(1);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [regexError, setRegexError] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const encodingMenuRef = useRef<HTMLDivElement | null>(null);
  const [viewerContextMenu, setViewerContextMenu] = useState<{
    x: number;
    y: number;
    line?: string;
  } | null>(null);

  const rawBytes = useMemo(() => new TextEncoder().encode(content), [content]);

  const decodedText = useMemo(() => {
    try {
      return new TextDecoder(encoding as any).decode(rawBytes);
    } catch {
      return content;
    }
  }, [content, encoding, rawBytes]);

  const allLines = useMemo(() => {
    if (mode === "text") return decodedText.split("\n");
    if (mode === "hex") return toHexLines(rawBytes);
    return toBinaryLines(rawBytes);
  }, [mode, decodedText, rawBytes]);

  const allMatches = useMemo(() => {
    if (!searchInput.trim()) {
      setRegexError("");
      return [] as SearchMatch[];
    }
    try {
      const regex = buildSearchRegex(searchInput, regexMode, caseSensitive);
      if (!regex) return [] as SearchMatch[];
      setRegexError("");
      const hits: SearchMatch[] = [];
      let currentIndex = 0;
      allLines.forEach((line, lineIndex) => {
        regex.lastIndex = 0;
        let m: RegExpExecArray | null = null;
        while ((m = regex.exec(line)) !== null) {
          hits.push({ index: currentIndex, lineIndex, start: m.index, end: m.index + Math.max(m[0].length, 1) });
          currentIndex += 1;
          if (m[0].length === 0) regex.lastIndex += 1;
        }
      });
      return hits;
    } catch {
      setRegexError(language === "zh" ? "正则表达式无效" : "Invalid regex expression");
      return [] as SearchMatch[];
    }
  }, [allLines, searchInput, regexMode, caseSensitive, language]);

  const matchesByLine = useMemo(() => {
    const map = new Map<number, SearchMatch[]>();
    allMatches.forEach((hit) => {
      const list = map.get(hit.lineIndex) || [];
      list.push(hit);
      map.set(hit.lineIndex, list);
    });
    return map;
  }, [allMatches]);

  const totalPages = Math.max(1, Math.ceil(allLines.length / linesPerPage));
  const safePage = Math.min(page, totalPages);
  const startLine = (safePage - 1) * linesPerPage;
  const pageLines = allLines.slice(startLine, startLine + linesPerPage);

  useEffect(() => {
    setPage(1);
    setActiveMatchIndex(allMatches.length ? 0 : -1);
  }, [mode, encoding, linesPerPage, searchInput, caseSensitive, regexMode, allMatches.length]);

  useEffect(() => {
    if (!encodingOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (!encodingMenuRef.current) return;
      if (!encodingMenuRef.current.contains(e.target as Node)) {
        setEncodingOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [encodingOpen]);

  useEffect(() => {
    if (!viewerContextMenu) return;
    const handleClose = () => setViewerContextMenu(null);
    window.addEventListener("scroll", handleClose, true);
    return () => window.removeEventListener("scroll", handleClose, true);
  }, [viewerContextMenu]);

  const jumpToMatch = (index: number) => {
    if (!allMatches.length) return;
    const next = (index + allMatches.length) % allMatches.length;
    const hit = allMatches[next];
    const hitPage = Math.floor(hit.lineIndex / linesPerPage) + 1;
    setActiveMatchIndex(next);
    setPage(hitPage);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (k === "f3") {
        e.preventDefault();
        jumpToMatch(e.shiftKey ? activeMatchIndex - 1 : activeMatchIndex + 1);
      } else if (k === "escape") {
        if (encodingOpen) {
          setEncodingOpen(false);
        } else if (searchInput) {
          setSearchInput("");
          setActiveMatchIndex(-1);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, searchInput, activeMatchIndex, allMatches.length, encodingOpen]);

  const renderHighlightedLine = (line: string, absoluteLineIndex: number) => {
    const hits = matchesByLine.get(absoluteLineIndex);
    if (!hits?.length || regexError) return line || " ";

    let cursor = 0;
    const nodes: React.ReactNode[] = [];
    hits.forEach((hit) => {
      if (hit.start > cursor) nodes.push(<span key={`${cursor}-txt`}>{line.slice(cursor, hit.start)}</span>);
      nodes.push(
        <mark
          key={`${hit.start}-${hit.end}`}
          className={
            hit.index === activeMatchIndex
              ? "bg-blue-200 text-blue-900 ring-1 ring-blue-300 rounded px-0.5"
              : "bg-blue-100 text-blue-700 rounded px-0.5"
          }
        >
          {line.slice(hit.start, hit.end) || " "}
        </mark>
      );
      cursor = hit.end;
    });
    if (cursor < line.length) nodes.push(<span key={`${cursor}-tail`}>{line.slice(cursor)}</span>);
    return nodes;
  };

  const handleCopy = async () => {
    const rendered = mode === "text" ? decodedText : allLines.join("\n");
    try {
      await navigator.clipboard.writeText(rendered);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const getSelectedText = () => {
    const text = window.getSelection()?.toString() || "";
    return text.trim();
  };

  const copyText = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const handleDownload = () => {
    const rendered = mode === "text" ? decodedText : allLines.join("\n");
    const blob = new Blob([rendered], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w\u4e00-\u9fa5-]+/g, "_")}_${mode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-blue-950/12 backdrop-blur-xl p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.985 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="w-full h-[90vh] max-w-[1480px] mx-auto ds-panel rounded-3xl ring-1 ring-blue-100/80 overflow-hidden flex flex-col relative"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-12 w-64 h-64 bg-blue-200/35 blur-3xl rounded-full" />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-cyan-200/25 blur-3xl rounded-full" />
          <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_1px_1px,rgba(30,41,59,0.7)_1px,transparent_0)] [background-size:10px_10px]" />
        </div>
        <div className="px-5 py-3.5 bg-gradient-to-r from-white/85 to-blue-50/65 border-b border-white/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 text-white flex items-center justify-center shadow-lg shadow-blue-900/25">
              <FileSearch size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-slate-800 text-base font-black truncate">{title}</h3>
              <div className="text-[11px] text-slate-500 font-semibold">
                {(language === "zh" ? "行数" : "Lines")}: {allLines.length} · Bytes: {rawBytes.length}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleCopy}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 text-sm font-semibold"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              {copied ? <CheckCheck size={16} className="text-blue-700" /> : <Copy size={16} />}
              {language === "zh" ? "复制" : "Copy"}
            </motion.button>
            <motion.button
              onClick={handleDownload}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 text-sm font-semibold"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <FileDown size={16} />
              {language === "zh" ? "导出" : "Export"}
            </motion.button>
            <motion.button
              onClick={onClose}
              className="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center"
              whileTap={{ scale: 0.96 }}
            >
              <X size={18} />
            </motion.button>
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-white/80 bg-white/55 backdrop-blur-md flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-100 rounded-xl p-1">
            {(["text", "hex", "binary"] as ViewerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${mode === m ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-100" : "text-slate-500 hover:text-slate-700"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="relative" ref={encodingMenuRef}>
            <motion.button
              onClick={() => setEncodingOpen((v) => !v)}
              className="group px-4 py-2.5 rounded-2xl border border-blue-100/80 text-sm font-black text-slate-700 bg-white/90 hover:bg-white hover:border-blue-300 transition-all shadow-[0_6px_24px_-16px_rgba(37,99,235,0.45)] min-w-[170px] flex items-center justify-between gap-3"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
            >
              <span className="tracking-wide">{encoding.toUpperCase()}</span>
              <ChevronDown
                size={14}
                className={`text-slate-400 group-hover:text-blue-500 transition-all ${encodingOpen ? "rotate-180 text-blue-500" : ""}`}
              />
            </motion.button>
            <AnimatePresence>
              {encodingOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute top-[calc(100%+8px)] left-0 z-30 w-[230px] p-2 rounded-2xl border border-blue-100 bg-white/95 backdrop-blur-xl shadow-[0_24px_50px_-24px_rgba(37,99,235,0.38)]"
                >
                  <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                    {ENCODING_OPTIONS.map((enc) => {
                      const active = enc === encoding;
                      return (
                        <button
                          key={enc}
                          onClick={() => {
                            setEncoding(enc);
                            setEncodingOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-[12px] font-bold transition-all ${
                            active
                              ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                              : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          {enc.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => setWrapMode((v) => !v)}
            className={`px-3 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 ${wrapMode ? "border-blue-200 text-blue-700 bg-blue-50" : "border-slate-200 text-slate-600 bg-white"}`}
          >
            <WrapText size={14} />
            {language === "zh" ? "自动换行" : "Wrap"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    jumpToMatch(e.shiftKey ? activeMatchIndex - 1 : activeMatchIndex + 1);
                  }
                }}
                placeholder={language === "zh" ? "搜索（Ctrl/Cmd+F）" : "Search (Ctrl/Cmd+F)"}
                className="ds-input pl-9 pr-3 py-2 rounded-xl text-sm w-64"
              />
            </div>
            <button
              onClick={() => setCaseSensitive((v) => !v)}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center ${caseSensitive ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}
              title={language === "zh" ? "区分大小写" : "Case sensitive"}
            >
              <Type size={14} />
            </button>
            <button
              onClick={() => setRegexMode((v) => !v)}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center ${regexMode ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}
              title={language === "zh" ? "正则模式" : "Regex mode"}
            >
              <Regex size={14} />
            </button>
            <button
              onClick={() => jumpToMatch(activeMatchIndex - 1)}
              className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => jumpToMatch(activeMatchIndex + 1)}
              className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center"
            >
              <ChevronRight size={14} />
            </button>
            <div className="px-2 text-xs font-semibold text-slate-500 min-w-[82px] text-right">
              {regexError ? regexError : `${allMatches.length ? activeMatchIndex + 1 : 0}/${allMatches.length}`}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          <div className="w-16 shrink-0 border-r border-slate-100 bg-slate-50 text-right text-slate-400 font-mono text-xs overflow-auto">
            <div className="pt-4 pb-6">
              {pageLines.map((_, idx) => (
                <div key={idx} className="h-6 pr-3">
                  {startLine + idx + 1}
                </div>
              ))}
            </div>
          </div>
          <div
            className="flex-1 overflow-auto custom-scrollbar font-mono text-[13px] text-slate-700"
            onContextMenu={(e) => {
              e.preventDefault();
              setViewerContextMenu({
                x: e.clientX,
                y: e.clientY
              });
            }}
          >
            <div className={`px-4 py-4 ${wrapMode ? "whitespace-pre-wrap break-all" : "whitespace-pre"}`}>
              {pageLines.map((line, idx) => {
                const absoluteLineIndex = startLine + idx;
                return (
                  <div
                    key={absoluteLineIndex}
                    className="min-h-6 leading-6 px-2 rounded hover:bg-slate-50"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setViewerContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        line
                      });
                    }}
                  >
                    {renderHighlightedLine(line, absoluteLineIndex)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-2.5 border-t border-white/80 bg-white/55 backdrop-blur-md flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-500 font-semibold">
            {language === "zh" ? "每页行数" : "Rows per page"}
          </div>
          <select
            value={linesPerPage}
            onChange={(e) => setLinesPerPage(Number(e.target.value))}
            className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
          >
            {[50, 100, 200, 500, 1000].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
            >
              {language === "zh" ? "首页" : "First"}
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
            >
              {language === "zh" ? "上一页" : "Prev"}
            </button>
            <span className="text-xs font-semibold text-slate-600 px-2">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
            >
              {language === "zh" ? "下一页" : "Next"}
            </button>
            <button
              onClick={() => setPage(totalPages)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
            >
              {language === "zh" ? "末页" : "Last"}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {viewerContextMenu && (
            <ContextMenu
              x={viewerContextMenu.x}
              y={viewerContextMenu.y}
              onClose={() => setViewerContextMenu(null)}
              items={[
                {
                  id: "copy-select",
                  label: language === "zh" ? "复制选中文本" : "Copy Selection",
                  disabled: !getSelectedText(),
                  onClick: () =>
                    copyText(getSelectedText())
                },
                {
                  id: "copy-line",
                  label: language === "zh" ? "复制当前行" : "Copy Current Line",
                  disabled: !viewerContextMenu.line,
                  onClick: () =>
                    copyText(viewerContextMenu.line || "")
                },
                {
                  id: "copy-all",
                  label: language === "zh" ? "复制全部内容" : "Copy All",
                  onClick: () => handleCopy()
                },
                {
                  id: "toggle-wrap",
                  label: wrapMode
                    ? language === "zh"
                      ? "关闭自动换行"
                      : "Disable Wrap"
                    : language === "zh"
                    ? "开启自动换行"
                    : "Enable Wrap",
                  onClick: () => setWrapMode((v) => !v)
                },
                {
                  id: "next-hit",
                  label: language === "zh" ? "跳到下一个命中" : "Next Match",
                  disabled: allMatches.length === 0,
                  onClick: () => jumpToMatch(activeMatchIndex + 1)
                },
                {
                  id: "export",
                  label: language === "zh" ? "导出当前视图" : "Export Current View",
                  onClick: () => handleDownload()
                }
              ]}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function CommandCard({
  def,
  executed,
  loading,
  failed,
  onExecute,
  onView,
  onContextMenu,
  language
}: {
  def: PluginCommand;
  executed: boolean;
  loading: boolean;
  failed: boolean;
  onExecute: () => void;
  onView: () => void;
  onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
  language: Language;
}) {
  const Icon = def.icon || Activity;
  const title = language === "zh" ? def.cn_name : def.name;
  const description = language === "zh" ? def.cn_description : def.description;

  return (
    <motion.button
      layout
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.99 }}
      onClick={executed && !loading ? onView : onExecute}
      onContextMenu={onContextMenu}
      className={`text-left relative overflow-hidden w-full rounded-2xl border p-5 transition-all duration-300 ${
        loading
          ? "border-blue-300 bg-blue-50/75 shadow-lg shadow-blue-500/15"
          : failed
          ? "border-rose-200 bg-rose-50/70"
          : executed
          ? "ds-card-done"
          : "ds-card ds-card-default"
      }`}
    >
      {loading && (
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-60"
          initial={{ x: "-120%" }}
          animate={{ x: ["-120%", "120%"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white to-transparent" />
        </motion.div>
      )}
      <div className="flex items-start gap-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            loading
              ? "bg-blue-700 text-white"
              : failed
              ? "bg-rose-500 text-white"
              : executed
              ? "bg-blue-900 text-white"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {loading ? <Activity size={20} className="animate-spin" /> : <Icon size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-black text-slate-800 truncate">{title}</h4>
            {loading ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">RUNNING</span>
            ) : failed ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 font-bold">FAILED</span>
            ) : executed ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">DONE</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500 line-clamp-2">{description}</p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-500">
              {executed ? (language === "zh" ? "再次点击查看回显" : "Click again to view output") : language === "zh" ? "点击执行" : "Click to execute"}
            </span>
            <span className="text-blue-700 font-bold flex items-center gap-1">
              {executed ? <FileText size={14} /> : <PlayCircle size={14} />}
              {executed ? (language === "zh" ? "查看" : "View") : language === "zh" ? "运行" : "Run"}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

interface DashboardProps {
  activeTab: string;
  language: Language;
  onAddSession?: () => void;
  aiSettings?: AISettings;
  onOpenSettings?: () => void;
  chatUserProfile?: { qq: string | null; avatar: string | null };
}

export default function Dashboard({ activeTab, language, aiSettings, onOpenSettings, chatUserProfile }: DashboardProps) {
  const { runCommand, getCommandData, currentSession, loading } = useCommandStore();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingCommandId, setViewingCommandId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSubCategory, setActiveSubCategory] = useState<string>("all");
  const [generalInfo, setGeneralInfo] = useState("");
  const [cardContextMenu, setCardContextMenu] = useState<{
    x: number;
    y: number;
    cmd: PluginCommand;
    executed: boolean;
  } | null>(null);

  const filteredCommands = useMemo(() => {
    return commands.filter((c) => {
      const title = language === "zh" ? c.cn_name : c.name;
      const subcategory = getSubcategory(c.id, c.category);
      const categoryMatch = activeCategory === "all" || c.category === activeCategory;
      const subcategoryMatch = activeSubCategory === "all" || subcategory === activeSubCategory;
      const searchMatch =
        title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase());
      return (
        categoryMatch &&
        subcategoryMatch &&
        searchMatch
      );
    });
  }, [language, searchTerm, activeCategory, activeSubCategory]);

  const groupedCommands = useMemo(() => {
    const grouped = new Map<string, PluginCommand[]>();
    filteredCommands.forEach((cmd) => {
      const sub = getSubcategory(cmd.id, cmd.category);
      const key = `${cmd.category}::${sub}`;
      const current = grouped.get(key) || [];
      current.push(cmd);
      grouped.set(key, current);
    });
    return Array.from(grouped.entries())
      .sort((a, b) => {
        const [ca, sa] = a[0].split("::");
        const [cb, sb] = b[0].split("::");
        const cw = (CATEGORY_WEIGHT[ca] ?? 999) - (CATEGORY_WEIGHT[cb] ?? 999);
        if (cw !== 0) return cw;
        return sa.localeCompare(sb);
      })
      .map(([key, items]) => {
        const [category, sub] = key.split("::");
        return { category, sub, items };
      });
  }, [filteredCommands]);

  const subCategoryOptions = useMemo(() => {
    const source = activeCategory === "all"
      ? commands
      : commands.filter((c) => c.category === activeCategory);
    return Array.from(new Set(source.map((c) => getSubcategory(c.id, c.category))));
  }, [activeCategory]);

  useEffect(() => {
    if (activeSubCategory !== "all" && !subCategoryOptions.includes(activeSubCategory)) {
      setActiveSubCategory("all");
    }
  }, [activeSubCategory, subCategoryOptions]);

  const commandStates = useMemo(() => {
    const all = commands.map((cmd) => {
      const data = getCommandData(cmd.id);
      const isLoading = !!loading[cmd.id];
      return {
        id: cmd.id,
        executed: !!data,
        loading: isLoading,
        failed: !!data && data.exit_code !== 0
      };
    });
    return {
      total: all.length,
      running: all.filter((s) => s.loading).length,
      executed: all.filter((s) => s.executed).length,
      failed: all.filter((s) => s.failed).length
    };
  }, [loading, getCommandData]);

  const handleExecute = async (cmd: PluginCommand) => {
    if (!currentSession) {
      showToast("error", language === "zh" ? "请先连接服务器" : "Please connect to a server first");
      return;
    }
    try {
      const result = await runCommand(cmd.id, cmd.command);
      if (result.exit_code === 0) {
        showToast("success", language === "zh" ? `${cmd.cn_name} 执行成功` : `${cmd.name} executed successfully`);
      } else if (result.stdout?.trim().length > 0) {
        showToast("warning", language === "zh" ? `${cmd.cn_name} 已返回结果（返回码非0）` : `${cmd.name} returned output (non-zero exit code)`);
      } else {
        showToast("error", language === "zh" ? `${cmd.cn_name} 执行完成，但返回异常` : `${cmd.name} finished with warnings`);
      }
    } catch {
      showToast("error", language === "zh" ? "执行失败" : "Execution failed");
    }
  };

  const handleCopyCommand = async (cmd: PluginCommand) => {
    try {
      await navigator.clipboard.writeText(cmd.command);
      showToast("success", language === "zh" ? "命令已复制" : "Command copied");
    } catch {
      showToast("error", language === "zh" ? "复制失败" : "Copy failed");
    }
  };

  const currentViewCmd = viewingCommandId ? commands.find((c) => c.id === viewingCommandId) : null;
  const currentViewData = viewingCommandId ? getCommandData(viewingCommandId) : null;

  if (activeTab === "agent-context" && aiSettings) {
    return (
      <div className="h-full rounded-2xl overflow-auto ds-app-bg p-4">
        <GeneralInfoPanel
          language={language}
          generalInfo={generalInfo}
          setGeneralInfo={setGeneralInfo}
          aiSettings={aiSettings}
        />
      </div>
    );
  }

  if (activeTab === "agent-general" && aiSettings) {
    return (
      <GeneralAgent
        language={language}
        aiSettings={aiSettings}
        onOpenSettings={onOpenSettings}
        generalInfo={generalInfo}
        setGeneralInfo={setGeneralInfo}
        chatUserProfile={chatUserProfile}
      />
    );
  }

  if (activeTab === "agent-database" && aiSettings) {
    return (
      <DatabaseAgent
        language={language}
        aiSettings={aiSettings}
        onOpenSettings={onOpenSettings}
        chatUserProfile={chatUserProfile}
      />
    );
  }

  if (activeTab === "agent-panel" && aiSettings) {
    return (
      <AgentPanel
        language={language}
        aiSettings={aiSettings}
        generalInfo={generalInfo}
        chatUserProfile={chatUserProfile}
      />
    );
  }

  if (activeTab === "terminal") {
    return <TerminalXterm onClose={() => {}} language={language} />;
  }

  if (activeTab === "pentest") {
    return (
      <div className="h-full rounded-2xl overflow-auto ds-app-bg p-4">
        <PentestPanel language={language} />
      </div>
    );
  }

  return (
    <div className="flex-1 h-screen overflow-hidden ds-app-bg relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] right-[10%] w-[420px] h-[420px] bg-blue-200/22 blur-[90px] rounded-full" />
        <div className="absolute bottom-[-15%] left-[5%] w-[360px] h-[360px] bg-cyan-200/18 blur-[90px] rounded-full" />
      </div>

      <div className="h-full relative z-10 flex flex-col">
        <div className="px-6 pt-6 pb-4">
          <div className="rounded-3xl ds-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 text-white flex items-center justify-center shadow-lg shadow-blue-900/30">
                    <MonitorCheck size={22} />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-slate-800">
                      {language === "zh" ? "监控中心" : "Monitoring Center"}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {language === "zh" ? "点击卡片执行核心取证命令，再次点击查看结果。" : "Click cards to execute core forensics commands, click again to view output."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={language === "zh" ? "搜索命令..." : "Search commands..."}
                    className="ds-input pl-9 pr-3 py-2.5 rounded-xl text-sm min-w-[260px] shadow-sm"
                  />
                </div>
                {currentSession ? (
                  <div className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-xs font-bold font-mono">
                    {currentSession.user}@{currentSession.ip}
                  </div>
                ) : (
                  <div className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold">
                    {language === "zh" ? "未连接服务器" : "No Active Session"}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
              {[
                {
                  label: language === "zh" ? "总命令" : "Total",
                  value: commandStates.total,
                  icon: <SquareTerminal size={16} />,
                  tone: "text-slate-700 bg-slate-100"
                },
                {
                  label: language === "zh" ? "已执行" : "Executed",
                  value: commandStates.executed,
                  icon: <Check size={16} />,
                  tone: "text-blue-800 bg-blue-100"
                },
                {
                  label: language === "zh" ? "执行中" : "Running",
                  value: commandStates.running,
                  icon: <Gauge size={16} />,
                  tone: "text-blue-700 bg-blue-50"
                },
                {
                  label: language === "zh" ? "异常" : "Failed",
                  value: commandStates.failed,
                  icon: <Activity size={16} />,
                  tone: "text-rose-700 bg-rose-100"
                }
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-2xl ds-card p-3.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.tone}`}>{kpi.icon}</div>
                  <div className="mt-2 text-xl font-black text-slate-800">{kpi.value}</div>
                  <div className="text-xs font-semibold text-slate-500">{kpi.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveCategory("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  activeCategory === "all"
                    ? "ds-chip-active"
                    : "ds-chip"
                }`}
              >
                {language === "zh" ? "全部大类" : "All Categories"}
              </button>
              {CATEGORY_ORDER.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setActiveCategory(category);
                    setActiveSubCategory("all");
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeCategory === category
                      ? "ds-chip-active"
                      : "ds-chip"
                  }`}
                >
                  {language === "zh" ? CATEGORY_META[category].zh : CATEGORY_META[category].en}
                </button>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveSubCategory("all")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  activeSubCategory === "all"
                    ? "ds-chip-active"
                    : "ds-chip"
                }`}
              >
                {language === "zh" ? "全部二级目录" : "All Subfolders"}
              </button>
              {subCategoryOptions.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setActiveSubCategory(sub)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    activeSubCategory === sub
                      ? "ds-chip-active"
                      : "ds-chip"
                  }`}
                >
                  {language === "zh" ? SUBCATEGORY_LABELS[sub]?.zh || sub : SUBCATEGORY_LABELS[sub]?.en || sub}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
          {activeTab !== "dashboard" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 text-sm">
              {language === "zh" ? "当前页面已统一为监控中心工作流。" : "This page has been unified into the monitoring workflow."}
            </div>
          ) : filteredCommands.length === 0 ? (
            <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 text-slate-500">
              <div className="text-center">
                <Text size={32} className="mx-auto mb-3 text-slate-300" />
                {language === "zh" ? "未找到匹配命令" : "No matching commands"}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedCommands.map((group) => (
                <motion.section
                  key={`${group.category}-${group.sub}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl ds-panel p-3.5"
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <span>{language === "zh" ? CATEGORY_META[group.category]?.zh || group.category : CATEGORY_META[group.category]?.en || group.category}</span>
                    <span className="text-slate-300">/</span>
                    <span className="ds-accent-text">{language === "zh" ? SUBCATEGORY_LABELS[group.sub]?.zh || group.sub : SUBCATEGORY_LABELS[group.sub]?.en || group.sub}</span>
                    <span className="ml-auto text-xs text-slate-400">{group.items.length}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                    {group.items.map((cmd) => {
                      const data = getCommandData(cmd.id);
                      return (
                        <CommandCard
                          key={cmd.id}
                          def={cmd}
                          executed={!!data}
                          loading={!!loading[cmd.id]}
                          failed={!!data && data.exit_code !== 0}
                          onExecute={() => handleExecute(cmd)}
                          onView={() => setViewingCommandId(cmd.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setCardContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              cmd,
                              executed: !!data
                            });
                          }}
                          language={language}
                        />
                      );
                    })}
                  </div>
                </motion.section>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {cardContextMenu && (
          <ContextMenu
            x={cardContextMenu.x}
            y={cardContextMenu.y}
            onClose={() => setCardContextMenu(null)}
            items={[
              {
                id: "run",
                label: language === "zh" ? "重新执行命令" : "Re-run Command",
                onClick: () => handleExecute(cardContextMenu.cmd)
              },
              {
                id: "view",
                label: language === "zh" ? "查看回显结果" : "View Output",
                disabled: !cardContextMenu.executed,
                onClick: () => setViewingCommandId(cardContextMenu.cmd.id)
              },
              {
                id: "copy-cmd",
                label: language === "zh" ? "复制命令内容" : "Copy Command",
                onClick: () => handleCopyCommand(cardContextMenu.cmd)
              }
            ]}
          />
        )}
        {viewingCommandId && currentViewCmd && (
          <TextViewer
            isOpen
            onClose={() => setViewingCommandId(null)}
            title={language === "zh" ? `取证结果: ${currentViewCmd.cn_name}` : `Forensics: ${currentViewCmd.name}`}
            content={
              currentViewData?.stdout ||
              currentViewData?.stderr ||
              (language === "zh" ? "暂无数据" : "No data available")
            }
            language={language}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
