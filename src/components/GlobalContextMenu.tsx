import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clipboard, Code2, Command, Copy, Eraser, FolderSync, PanelRight, Play, Settings2, Sparkles, SquareTerminal, Upload } from "lucide-react";
import { Language } from "../translations";

type MenuAction = {
  label: string;
  icon: typeof Copy;
  onClick: () => void | Promise<void>;
  danger?: boolean;
  group?: string;
};

type MenuState = {
  x: number;
  y: number;
  title: string;
  actions: MenuAction[];
};

function isEditableTarget(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function getSelectionText() {
  return window.getSelection()?.toString().trim() || "";
}

async function copyText(value: string) {
  if (!value.trim()) {
    return;
  }
  await navigator.clipboard.writeText(value);
}

async function pasteIntoElement(target: HTMLElement | null) {
  const text = await navigator.clipboard.readText();
  if (!text) {
    return;
  }

  if (isEditableTarget(target)) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    target.setRangeText(text, start, end, "end");
    target.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    document.execCommand("insertText", false, text);
  }
}

function buildLabels(language: Language) {
  return language === "zh"
    ? {
        terminal: "终端",
        ftp: "FTP 文件区",
        ai: "智能体工作区",
        commandCenter: "命令中心",
        general: "快捷菜单",
        copy: "复制选中内容",
        paste: "粘贴",
        selectAll: "全选输入内容",
        openSettings: "打开设置",
        ftpRefresh: "刷新目录",
        ftpUpload: "上传文件",
        ftpCopyPath: "复制当前路径",
        terminalPaste: "粘贴到终端",
        terminalToggle: "展开 / 收起 FTP",
        terminalClear: "清屏",
        terminalCopyOutput: "复制终端输出",
        aiCopyAnswer: "复制最近回答",
        aiCopyCode: "复制代码块",
        aiAppendSelection: "追加选中内容到输入框",
        aiSendInput: "发送当前输入",
        aiClearInput: "清空当前输入",
        groupQuick: "快捷操作",
        groupEdit: "编辑",
        groupSystem: "系统",
      }
    : {
        terminal: "Terminal",
        ftp: "FTP",
        ai: "AI Workspace",
        commandCenter: "Command Center",
        general: "Quick Menu",
        copy: "Copy Selection",
        paste: "Paste",
        selectAll: "Select All",
        openSettings: "Open Settings",
        ftpRefresh: "Refresh Directory",
        ftpUpload: "Upload File",
        ftpCopyPath: "Copy Current Path",
        terminalPaste: "Paste to Terminal",
        terminalToggle: "Toggle FTP",
        terminalClear: "Clear Terminal",
        terminalCopyOutput: "Copy Terminal Output",
        aiCopyAnswer: "Copy Latest Answer",
        aiCopyCode: "Copy Code Block",
        aiAppendSelection: "Append Selection to Input",
        aiSendInput: "Send Current Input",
        aiClearInput: "Clear Current Input",
        groupQuick: "Quick Actions",
        groupEdit: "Editing",
        groupSystem: "System",
      };
}

export default function GlobalContextMenu({
  language,
  onOpenSettings,
}: {
  language: Language;
  onOpenSettings: () => void;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const labels = useMemo(() => buildLabels(language), [language]);

  useEffect(() => {
    const closeMenu = () => setMenu(null);

    const handleContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const selectionText = getSelectionText();
      const scopeElement = target?.closest<HTMLElement>("[data-context-scope]");
      const scope = scopeElement?.dataset.contextScope || "general";
      const actions: MenuAction[] = [];
      const nearestCodeBlock = target?.closest<HTMLElement>("[data-code-block]");
      const latestAssistantMessage = scopeElement?.querySelectorAll<HTMLElement>('[data-message-role="assistant"][data-message-content]');
      const lastAssistantContent = latestAssistantMessage && latestAssistantMessage.length > 0
        ? latestAssistantMessage[latestAssistantMessage.length - 1].dataset.messageContent || ""
        : "";
      const nearestCode = nearestCodeBlock?.dataset.codeBlock || "";
      const currentFtpPath = scopeElement?.dataset.ftpPath || "";

      const dispatchScopeAction = (type: string, value?: string) => {
        window.dispatchEvent(new CustomEvent("fuxi-scope-context-action", { detail: { scope, type, value } }));
      };

      if (scope === "terminal") {
        actions.push({
          label: labels.terminalPaste,
          icon: Command,
          group: labels.groupQuick,
          onClick: () => {
            window.dispatchEvent(new CustomEvent("fuxi-terminal-context-action", { detail: { type: "paste" } }));
          },
        });
        actions.push({
          label: labels.terminalToggle,
          icon: PanelRight,
          group: labels.groupQuick,
          onClick: () => {
            window.dispatchEvent(new CustomEvent("fuxi-terminal-context-action", { detail: { type: "toggle-ftp" } }));
          },
        });
        actions.push({
          label: labels.terminalClear,
          icon: Eraser,
          group: labels.groupQuick,
          onClick: () => {
            window.dispatchEvent(new CustomEvent("fuxi-terminal-context-action", { detail: { type: "clear" } }));
          },
        });
        actions.push({
          label: labels.terminalCopyOutput,
          icon: SquareTerminal,
          group: labels.groupEdit,
          onClick: () => {
            window.dispatchEvent(new CustomEvent("fuxi-terminal-context-action", { detail: { type: "copy-output" } }));
          },
        });
      }

      if (scope === "ftp") {
        actions.push({
          label: labels.ftpRefresh,
          icon: FolderSync,
          group: labels.groupQuick,
          onClick: () => {
            window.dispatchEvent(new CustomEvent("fuxi-ftp-context-action", { detail: { type: "refresh" } }));
          },
        });
        actions.push({
          label: labels.ftpUpload,
          icon: Upload,
          group: labels.groupQuick,
          onClick: () => {
            window.dispatchEvent(new CustomEvent("fuxi-ftp-context-action", { detail: { type: "upload" } }));
          },
        });
        if (currentFtpPath) {
          actions.push({
            label: labels.ftpCopyPath,
            icon: Copy,
            group: labels.groupEdit,
            onClick: () => copyText(currentFtpPath),
          });
        }
      }

      if (scope.startsWith("agent-")) {
        if (lastAssistantContent) {
          actions.push({
            label: labels.aiCopyAnswer,
            icon: Sparkles,
            group: labels.groupQuick,
            onClick: () => copyText(lastAssistantContent),
          });
        }
        if (nearestCode) {
          actions.push({
            label: labels.aiCopyCode,
            icon: Code2,
            group: labels.groupQuick,
            onClick: () => copyText(nearestCode),
          });
        }
        if (selectionText) {
          actions.push({
            label: labels.aiAppendSelection,
            icon: Clipboard,
            group: labels.groupEdit,
            onClick: () => dispatchScopeAction("append-input", selectionText),
          });
        }
        actions.push({
          label: labels.aiSendInput,
          icon: Play,
          group: labels.groupQuick,
          onClick: () => dispatchScopeAction("send-input"),
        });
        actions.push({
          label: labels.aiClearInput,
          icon: Eraser,
          group: labels.groupEdit,
          onClick: () => dispatchScopeAction("clear-input"),
        });
      }

      if (selectionText) {
        actions.push({
          label: labels.copy,
          icon: Copy,
          group: labels.groupEdit,
          onClick: () => copyText(selectionText),
        });
      }

      if (isEditableTarget(target) || target?.isContentEditable) {
        actions.push({
          label: labels.paste,
          icon: Clipboard,
          group: labels.groupEdit,
          onClick: () => pasteIntoElement(target),
        });
        actions.push({
          label: labels.selectAll,
          icon: Copy,
          group: labels.groupEdit,
          onClick: () => {
            if (isEditableTarget(target)) {
              target.select();
            } else {
              document.execCommand("selectAll");
            }
          },
        });
      }

      actions.push({
        label: labels.openSettings,
        icon: Settings2,
        group: labels.groupSystem,
        onClick: onOpenSettings,
      });

      if (actions.length === 0) {
        return;
      }

      event.preventDefault();
      setMenu({
        x: Math.min(event.clientX, window.innerWidth - 220),
        y: Math.min(event.clientY, window.innerHeight - 220),
        title:
          scope === "terminal"
            ? labels.terminal
            : scope === "ftp"
              ? labels.ftp
              : scope.startsWith("agent-")
                ? labels.ai
                : scope === "command-center"
                  ? labels.commandCenter
                  : labels.general,
        actions,
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [labels, onOpenSettings]);

  return createPortal(
    <AnimatePresence>
      {menu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 4 }}
          transition={{ duration: 0.16 }}
          className="fixed z-[220] min-w-[250px] overflow-hidden rounded-[1.25rem] border border-white/80 bg-white/90 p-2 shadow-[0_30px_60px_-24px_rgba(15,23,42,0.24)] backdrop-blur-2xl"
          style={{ left: menu.x, top: menu.y }}
        >
          <div className="mb-2 overflow-hidden rounded-[0.95rem] border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {menu.title}
            </div>
          </div>
          <div className="space-y-1">
            {menu.actions.map((action, index) => {
              const Icon = action.icon;
              const previousGroup = index > 0 ? menu.actions[index - 1].group : null;
              return (
                <div key={action.label}>
                  {action.group && action.group !== previousGroup && (
                    <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                      {action.group}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      void action.onClick();
                      setMenu(null);
                    }}
                    className={`flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-left text-sm transition-all ${
                      action.danger
                        ? "text-rose-600 hover:bg-rose-50"
                        : "text-slate-700 hover:bg-slate-100/90 hover:shadow-[0_16px_28px_-24px_rgba(15,23,42,0.16)]"
                    }`}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.85rem] border border-slate-200/80 bg-white text-slate-500">
                      <Icon size={14} />
                    </span>
                    <span className="font-medium">{action.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
