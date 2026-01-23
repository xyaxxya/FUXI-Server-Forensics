import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Editor from "@monaco-editor/react";
import { X, Save, Loader2, FileCode, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FileEditorProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
}

export default function FileEditor({
  isOpen,
  onClose,
  fileName,
  initialContent,
  onSave,
}: FileEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [language, setLanguage] = useState("plaintext");

  useEffect(() => {
    setContent(initialContent);
    // Simple extension detection
    const ext = fileName.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      jsx: "javascript",
      tsx: "typescript",
      json: "json",
      html: "html",
      css: "css",
      md: "markdown",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      c: "c",
      cpp: "cpp",
      sh: "shell",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
      sql: "sql",
      php: "php",
      dockerfile: "dockerfile",
      ini: "ini",
    };
    setLanguage(langMap[ext || ""] || "plaintext");
  }, [fileName, initialContent, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 1000);
    } catch (e) {
      console.error("Save failed", e);
      // Parent handles error toast/alert usually, or we can add one here
    } finally {
      setIsSaving(false);
    }
  };

  // Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [content, onSave]); // Dependencies important for closure

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center pl-80 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-[#1e1e2e] w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-12 bg-[#2d2d3f] border-b border-slate-700 flex items-center justify-between px-4 select-none">
            <div className="flex items-center gap-3">
              <FileCode className="text-blue-400" size={18} />
              <span className="text-slate-200 font-mono font-medium text-sm">
                {fileName}
              </span>
              <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-800 rounded">
                {language}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save (Ctrl+S)
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 relative bg-[#1e1e2e]">
            <Editor
              height="100%"
              defaultLanguage={language}
              language={language}
              value={content}
              theme="vs-dark"
              onChange={(value) => setContent(value || "")}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                cursorBlinking: "smooth",
                smoothScrolling: true,
                contextmenu: true,
              }}
              loading={
                <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                  <Loader2 size={24} className="animate-spin" />
                  <span>Loading Editor...</span>
                </div>
              }
            />
          </div>

          {/* Footer Status */}
          <div className="h-6 bg-white/5 border-t border-white/10 flex items-center justify-end px-4 text-[10px] text-slate-500 select-none backdrop-blur-md font-mono">
            <span>Length: {content.length} chars</span>
          </div>

          {/* Success Toast */}
          <AnimatePresence>
            {showSuccessToast && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(5px)" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="absolute bottom-16 left-1/2 -translate-x-1/2 glass border border-emerald-500/30 text-emerald-100 px-6 py-2.5 rounded-full shadow-[0_8px_32px_rgba(16,185,129,0.2)] flex items-center gap-2.5 z-50 backdrop-blur-xl"
              >
                <div className="bg-emerald-500/20 p-1 rounded-full border border-emerald-500/30">
                  <Check size={12} strokeWidth={3} className="text-emerald-400" />
                </div>
                <span className="text-sm font-medium tracking-wide">Saved Successfully</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
