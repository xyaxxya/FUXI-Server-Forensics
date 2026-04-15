import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Command,
  FileSearch,
  Globe,
  Hash,
  History,
  Plus,
  RotateCcw,
  SquareTerminal,
  Sparkles,
  Star,
} from "lucide-react";
import { AISettings } from "../../lib/ai";
import { AIPlanStatus, AIPlanTask, AIPromptSnippet, AIWorkspaceEvent, AIWorkspaceSnapshot } from "../../lib/aiWorkspaceStore";
import { Language } from "../../translations";

interface ContextAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  actions: ContextAction[];
}

export interface SlashCommandItem {
  id: string;
  command: string;
  title: string;
  description: string;
  category?: string;
  insertText?: string;
  onSelect?: () => void;
}

export function getSlashCommandMatches(input: string, commands: SlashCommandItem[]) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return [];
  }
  const query = trimmed.slice(1).toLowerCase();
  return commands.filter((item) => {
    if (!query) {
      return true;
    }
    return [item.command, item.title, item.description, item.category].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
}

export function getSlashCommandCompletion(input: string, commands: SlashCommandItem[]) {
  const [first] = getSlashCommandMatches(input, commands);
  return first?.command || null;
}

export function getExactSlashCommand(input: string, commands: SlashCommandItem[]) {
  const trimmed = input.trim();
  return commands.find((item) => item.command.toLowerCase() === trimmed.toLowerCase()) || null;
}

function formatLargeNumber(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

function byLanguage(language: Language, zh: string, en: string) {
  return language === "zh" ? zh : en;
}

function buildPreviewTitle(language: Language, value: string) {
  return value.trim() || byLanguage(language, "详细内容", "Details");
}

export function PreviewDialog({
  title,
  content,
  onClose,
}: {
  title: string;
  content: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ui-shell max-h-[86vh] w-full max-w-3xl rounded-[1.8rem] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">{title}</div>
          </div>
          <button onClick={onClose} className="ui-button ui-pressable rounded-xl px-3 py-2 text-sm text-slate-600">
            关闭
          </button>
        </div>
        <div className="custom-scrollbar mt-4 max-h-[68vh] overflow-auto whitespace-pre-wrap rounded-[1.4rem] bg-slate-50/70 p-4 text-sm leading-7 text-slate-700">
          {content}
        </div>
      </div>
    </div>
  );
}

export function EditDialog({
  title,
  nameLabel,
  contentLabel,
  initialName = "",
  initialContent = "",
  namePlaceholder,
  contentPlaceholder,
  saveLabel,
  cancelLabel,
  onSave,
  onClose,
}: {
  title: string;
  nameLabel?: string;
  contentLabel: string;
  initialName?: string;
  initialContent?: string;
  namePlaceholder?: string;
  contentPlaceholder?: string;
  saveLabel: string;
  cancelLabel: string;
  onSave: (input: { name: string; content: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ui-shell w-full max-w-2xl rounded-[1.8rem] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <button onClick={onClose} className="ui-button ui-pressable rounded-xl px-3 py-2 text-sm text-slate-600">
            {cancelLabel}
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {nameLabel && (
            <label className="block">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{nameLabel}</div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={namePlaceholder}
                className="ui-input-base w-full rounded-xl px-3 py-2.5 text-sm text-slate-700"
              />
            </label>
          )}
          <label className="block">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{contentLabel}</div>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={contentPlaceholder}
              className="ui-input-base min-h-[160px] w-full resize-y rounded-xl px-3 py-2.5 text-sm text-slate-700"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="ui-button ui-pressable rounded-xl px-4 py-2 text-sm text-slate-600">
            {cancelLabel}
          </button>
          <button
            onClick={() => onSave({ name, content })}
            disabled={!content.trim()}
            className="ui-button-primary ui-pressable rounded-xl px-4 py-2 text-sm text-white disabled:bg-slate-300 disabled:border-slate-300"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FloatingContextMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuState | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!menu) {
      return;
    }

    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu, onClose]);

  if (!menu) {
    return null;
  }

  return (
    <div
      className="fixed z-[150] min-w-[180px] rounded-[1.2rem] border border-slate-200 bg-white/95 p-2 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.28)] backdrop-blur-md"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.actions.map((action) => (
        <button
          key={action.label}
          onClick={() => {
            action.onClick();
            onClose();
          }}
          className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
            action.danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function WorkbenchStatusBar({
  language,
  title,
  aiSettings,
  extraItems,
}: {
  language: Language;
  title: string;
  aiSettings: AISettings;
  extraItems?: Array<{ label: string; value: string }>;
}) {
  const config = aiSettings.configs[aiSettings.activeProvider];
  const usage = aiSettings.tokenUsage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  const items = [
    { icon: BrainCircuit, label: byLanguage(language, "模型", "Model"), value: `${config.name} · ${config.model}` },
    {
      icon: Hash,
      label: byLanguage(language, "总 Token", "Total Tokens"),
      value: formatLargeNumber(usage.total_tokens),
    },
    {
      icon: Sparkles,
      label: byLanguage(language, "最大循环", "Max Loops"),
      value: String(aiSettings.maxLoops ?? 25),
    },
    ...(extraItems || []).map((item) => ({ icon: Star, ...item })),
  ];

  return (
    <div className="ui-subtle-surface rounded-[1.6rem] p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs text-slate-500">
            {byLanguage(language, "借鉴 Claude Code 的状态栏思路，集中显示当前工作上下文。", "Inspired by Claude Code style status awareness.")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={`${item.label}-${item.value}`} className="ui-chip rounded-2xl px-3 py-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <Icon size={14} />
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WorkspaceHeader({
  language,
  icon: Icon,
  title,
  description,
  aiSettings,
  extraItems,
  sessionInfo,
  actions,
  children,
}: {
  language: Language;
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  aiSettings: AISettings;
  extraItems?: Array<{ label: string; value: string }>;
  sessionInfo?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const config = aiSettings.configs[aiSettings.activeProvider];
  const usage = aiSettings.tokenUsage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  const items = [
    { label: byLanguage(language, "模型", "Model"), value: `${config.name} · ${config.model}` },
    { label: byLanguage(language, "总 Token", "Total Tokens"), value: formatLargeNumber(usage.total_tokens) },
    { label: byLanguage(language, "最大循环", "Max Loops"), value: String(aiSettings.maxLoops ?? 25) },
    ...(extraItems || []),
    ...(sessionInfo ? [{ label: byLanguage(language, "当前会话", "Current"), value: sessionInfo }] : []),
  ];

  return (
    <div className="border-b border-slate-200/70 px-4 py-4 md:px-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-blue-100 via-white to-indigo-100 text-blue-700 shadow-[0_16px_30px_-22px_rgba(37,99,235,0.45)]">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 md:text-lg">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div key={`${item.label}-${item.value}`} className="ui-chip rounded-2xl px-3 py-2 text-xs text-slate-600 sm:text-sm">
              <span className="text-slate-500">{item.label}</span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="font-semibold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
        {children ? <div className="pt-1">{children}</div> : null}
      </div>
    </div>
  );
}

export function PlannerPanel({
  language,
  tasks,
  onClear,
  onUpdateTaskStatus,
  onRemoveTask,
  onAddTask,
  onEditTask,
}: {
  language: Language;
  tasks: AIPlanTask[];
  onClear?: () => void;
  onUpdateTaskStatus?: (id: string, status: AIPlanStatus) => void;
  onRemoveTask?: (id: string) => void;
  onAddTask?: (content: string) => void;
  onEditTask?: (id: string, content: string) => void;
}) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [taskEditor, setTaskEditor] = useState<{ mode: "create" | "edit"; id?: string; content: string } | null>(null);

  return (
    <>
      <section className="ui-shell flex min-h-0 flex-col overflow-hidden rounded-[1.7rem]">
        <div className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <ClipboardList size={17} />
                {byLanguage(language, "执行计划", "Execution Plan")}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {byLanguage(language, "任务清单与当前状态", "Task list with explicit status")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onAddTask && (
                <button
                  onClick={() => setTaskEditor({ mode: "create", content: "" })}
                  className="ui-button ui-pressable rounded-xl px-3 py-2 text-xs text-slate-600"
                >
                  {byLanguage(language, "新增", "Add")}
                </button>
              )}
              {onClear && tasks.length > 0 && (
                <button onClick={onClear} className="ui-button ui-pressable rounded-xl px-3 py-2 text-xs text-slate-600">
                  {byLanguage(language, "清空", "Clear")}
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="ui-chip rounded-2xl px-3 py-2 text-xs text-slate-600">
              {byLanguage(language, "任务", "Tasks")} · <span className="font-semibold text-slate-900">{tasks.length}</span>
            </div>
            <div className="ui-chip rounded-2xl px-3 py-2 text-xs text-slate-600">
              {byLanguage(language, "进行中", "Running")} · <span className="font-semibold text-slate-900">{inProgress}</span>
            </div>
            <div className="ui-chip rounded-2xl px-3 py-2 text-xs text-slate-600">
              {byLanguage(language, "完成", "Done")} · <span className="font-semibold text-slate-900">{completed}</span>
            </div>
          </div>
        </div>
        <div className="custom-scrollbar max-h-[24rem] space-y-3 overflow-auto p-4">
          {tasks.length === 0 && (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500">
              {byLanguage(language, "暂无任务", "No tasks yet")}
            </div>
          )}
          {tasks.map((task, index) => {
            const done = task.status === "completed";
            const running = task.status === "in_progress";
            return (
              <motion.div
                key={`${task.id}-${task.updatedAt}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onDoubleClick={() => setPreview({ title: buildPreviewTitle(language, task.content), content: task.content })}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({
                    x: event.clientX,
                    y: event.clientY,
                    actions: [
                      {
                        label: byLanguage(language, "查看详情", "Preview"),
                        onClick: () => setPreview({ title: buildPreviewTitle(language, task.content), content: task.content }),
                      },
                      {
                        label: byLanguage(language, "复制内容", "Copy"),
                        onClick: () => void navigator.clipboard.writeText(task.content),
                      },
                      ...(onEditTask
                        ? [
                            {
                              label: byLanguage(language, "编辑任务", "Edit Task"),
                              onClick: () => setTaskEditor({ mode: "edit", id: task.id, content: task.content }),
                            },
                          ]
                        : []),
                      ...(onUpdateTaskStatus
                        ? [
                            { label: byLanguage(language, "标记待处理", "Mark Pending"), onClick: () => onUpdateTaskStatus(task.id, "pending") },
                            { label: byLanguage(language, "标记进行中", "Mark In Progress"), onClick: () => onUpdateTaskStatus(task.id, "in_progress") },
                            { label: byLanguage(language, "标记已完成", "Mark Completed"), onClick: () => onUpdateTaskStatus(task.id, "completed") },
                          ]
                        : []),
                      ...(onRemoveTask
                        ? [
                            {
                              label: byLanguage(language, "删除任务", "Delete Task"),
                              onClick: () => onRemoveTask(task.id),
                              danger: true,
                            },
                          ]
                        : []),
                    ],
                  });
                }}
                className={`rounded-[1.35rem] px-4 py-3 ${
                  done ? "bg-emerald-50 border border-emerald-200" : running ? "bg-blue-50 border border-blue-200" : "ui-subtle-surface"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-emerald-700" : running ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                    {done ? <CheckCircle2 size={14} /> : running ? <Clock3 size={14} /> : <span className="text-xs font-semibold">{index + 1}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800">{task.content}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
      <FloatingContextMenu menu={menu} onClose={() => setMenu(null)} />
      {preview && <PreviewDialog title={preview.title} content={preview.content} onClose={() => setPreview(null)} />}
      {taskEditor && (
        <EditDialog
          title={taskEditor.mode === "create" ? byLanguage(language, "新增任务", "Add Task") : byLanguage(language, "编辑任务", "Edit Task")}
          contentLabel={byLanguage(language, "任务内容", "Task Content")}
          initialContent={taskEditor.content}
          contentPlaceholder={byLanguage(language, "输入任务内容", "Enter task content")}
          saveLabel={taskEditor.mode === "create" ? byLanguage(language, "创建", "Create") : byLanguage(language, "保存", "Save")}
          cancelLabel={byLanguage(language, "取消", "Cancel")}
          onClose={() => setTaskEditor(null)}
          onSave={({ content }) => {
            if (taskEditor.mode === "create") {
              onAddTask?.(content);
            } else if (taskEditor.id) {
              onEditTask?.(taskEditor.id, content);
            }
            setTaskEditor(null);
          }}
        />
      )}
    </>
  );
}

export function PromptDeck({
  language,
  title,
  promptHistory,
  promptSnippets,
  onUsePrompt,
  onSaveCurrent,
  onRemoveSnippet,
  onTogglePin,
  onSaveHistoryPrompt,
  onCreateSnippet,
  onEditSnippet,
  currentInput,
}: {
  language: Language;
  title: string;
  promptHistory: string[];
  promptSnippets: AIPromptSnippet[];
  onUsePrompt: (value: string) => void;
  onSaveCurrent?: () => void;
  onRemoveSnippet?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onSaveHistoryPrompt?: (value: string) => void;
  onCreateSnippet?: (title: string, content: string, pinned?: boolean) => void;
  onEditSnippet?: (id: string, input: { title?: string; content?: string; pinned?: boolean }) => void;
  currentInput?: string;
}) {
  const orderedSnippets = [...promptSnippets].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [snippetEditor, setSnippetEditor] = useState<{ mode: "create" | "edit"; id?: string; title: string; content: string } | null>(null);

  return (
    <>
      <section className="ui-shell flex min-h-0 flex-col overflow-hidden rounded-[1.7rem]">
        <div className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <BookOpenText size={17} />
                {title}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {byLanguage(language, "可复用提示词与历史输入", "Reusable snippets and recent prompts")}
              </div>
            </div>
            {(onSaveCurrent && currentInput?.trim()) || onCreateSnippet ? (
              <button
                onClick={() => {
                  if (onCreateSnippet) {
                    setSnippetEditor({ mode: "create", title: "", content: currentInput || "" });
                    return;
                  }
                  onSaveCurrent?.();
                }}
                className="ui-button ui-pressable rounded-xl px-3 py-2 text-xs text-slate-600"
              >
                <span className="inline-flex items-center gap-1">
                  <Plus size={13} />
                  {byLanguage(language, "新增模板", "New Snippet")}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="custom-scrollbar max-h-[30rem] space-y-4 overflow-auto p-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {byLanguage(language, "置顶模板", "Pinned Snippets")}
            </div>
            <div className="flex flex-wrap gap-2">
              {orderedSnippets.filter((item) => item.pinned).map((snippet) => (
                <motion.button
                  key={snippet.id}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => onUsePrompt(snippet.content)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({
                      x: event.clientX,
                      y: event.clientY,
                      actions: [
                        { label: byLanguage(language, "查看详情", "Preview"), onClick: () => setPreview({ title: snippet.title, content: snippet.content }) },
                        { label: byLanguage(language, "复制内容", "Copy"), onClick: () => void navigator.clipboard.writeText(snippet.content) },
                        ...(onEditSnippet
                          ? [
                              {
                                label: byLanguage(language, "编辑模板", "Edit Snippet"),
                                onClick: () => setSnippetEditor({ mode: "edit", id: snippet.id, title: snippet.title, content: snippet.content }),
                              },
                            ]
                          : []),
                      ],
                    });
                  }}
                  className="ui-chip-active ui-pressable rounded-2xl px-3 py-2 text-left text-sm"
                >
                  {snippet.title}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {byLanguage(language, "最近输入", "Recent Prompts")}
            </div>
            <div className="space-y-2">
              {promptHistory.slice(0, 5).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onUsePrompt(prompt)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({
                      x: event.clientX,
                      y: event.clientY,
                      actions: [
                        { label: byLanguage(language, "查看详情", "Preview"), onClick: () => setPreview({ title: buildPreviewTitle(language, prompt), content: prompt }) },
                        { label: byLanguage(language, "复制内容", "Copy"), onClick: () => void navigator.clipboard.writeText(prompt) },
                        ...(onSaveHistoryPrompt
                          ? [
                              {
                                label: byLanguage(language, "保存为模板", "Save as Snippet"),
                                onClick: () => onSaveHistoryPrompt(prompt),
                              },
                            ]
                          : []),
                      ],
                    });
                  }}
                  className="ui-subtle-surface block w-full rounded-[1.2rem] px-3.5 py-3 text-left text-sm text-slate-600 transition hover:text-slate-900"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {orderedSnippets.filter((item) => !item.pinned).length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {byLanguage(language, "模板库", "Snippet Library")}
              </div>
              <div className="space-y-2">
                {orderedSnippets
                  .filter((item) => !item.pinned)
                  .slice(0, 6)
                  .map((snippet) => (
                    <div
                      key={snippet.id}
                      className="ui-subtle-surface rounded-[1.2rem] p-3"
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setMenu({
                          x: event.clientX,
                          y: event.clientY,
                          actions: [
                            { label: byLanguage(language, "查看详情", "Preview"), onClick: () => setPreview({ title: snippet.title, content: snippet.content }) },
                            { label: byLanguage(language, "复制内容", "Copy"), onClick: () => void navigator.clipboard.writeText(snippet.content) },
                            ...(onEditSnippet
                              ? [
                                  {
                                    label: byLanguage(language, "编辑模板", "Edit Snippet"),
                                    onClick: () => setSnippetEditor({ mode: "edit", id: snippet.id, title: snippet.title, content: snippet.content }),
                                  },
                                ]
                              : []),
                            ...(onTogglePin
                              ? [
                                  {
                                    label: snippet.pinned ? byLanguage(language, "取消置顶", "Unpin") : byLanguage(language, "置顶模板", "Pin"),
                                    onClick: () => onTogglePin(snippet.id),
                                  },
                                ]
                              : []),
                            ...(onRemoveSnippet
                              ? [
                                  {
                                    label: byLanguage(language, "删除模板", "Delete"),
                                    onClick: () => onRemoveSnippet(snippet.id),
                                    danger: true,
                                  },
                                ]
                              : []),
                          ],
                        });
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => onUsePrompt(snippet.content)} className="min-w-0 flex-1 text-left">
                          <div className="text-sm font-medium text-slate-800">{snippet.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{snippet.content}</div>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <FloatingContextMenu menu={menu} onClose={() => setMenu(null)} />
      {preview && <PreviewDialog title={preview.title} content={preview.content} onClose={() => setPreview(null)} />}
      {snippetEditor && (
        <EditDialog
          title={snippetEditor.mode === "create" ? byLanguage(language, "新增模板", "New Snippet") : byLanguage(language, "编辑模板", "Edit Snippet")}
          nameLabel={byLanguage(language, "标题", "Title")}
          contentLabel={byLanguage(language, "内容", "Content")}
          initialName={snippetEditor.title}
          initialContent={snippetEditor.content}
          namePlaceholder={byLanguage(language, "输入标题", "Enter title")}
          contentPlaceholder={byLanguage(language, "输入模板内容", "Enter snippet content")}
          saveLabel={snippetEditor.mode === "create" ? byLanguage(language, "创建", "Create") : byLanguage(language, "保存", "Save")}
          cancelLabel={byLanguage(language, "取消", "Cancel")}
          onClose={() => setSnippetEditor(null)}
          onSave={({ name, content }) => {
            if (snippetEditor.mode === "create") {
              onCreateSnippet?.(name, content, false);
            } else if (snippetEditor.id) {
              onEditSnippet?.(snippetEditor.id, { title: name, content });
            }
            setSnippetEditor(null);
          }}
        />
      )}
    </>
  );
}

export function CheckpointPanel({
  language,
  snapshots,
  onCreate,
  onRestore,
  onRemove,
}: {
  language: Language;
  snapshots: AIWorkspaceSnapshot[];
  onCreate?: () => void;
  onRestore?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  return (
    <>
      <section className="ui-shell flex min-h-0 flex-col overflow-hidden rounded-[1.7rem]">
        <div className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <History size={17} />
                {byLanguage(language, "工作台快照", "Workspace Snapshots")}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {byLanguage(language, "保存当前线索、计划和提示词状态，便于回滚与续接。", "Save clues, plans and prompts as checkpoints.")}
              </div>
            </div>
            {onCreate && (
              <button onClick={onCreate} className="ui-button ui-pressable rounded-xl px-3 py-2 text-xs text-slate-600">
                {byLanguage(language, "创建快照", "Create")}
              </button>
            )}
          </div>
        </div>
        <div className="custom-scrollbar max-h-[20rem] space-y-3 overflow-auto p-4">
          {snapshots.length === 0 && (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500">
              {byLanguage(language, "还没有保存工作台快照。", "No workspace snapshots yet.")}
            </div>
          )}
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="ui-subtle-surface rounded-[1.3rem] p-3"
              onDoubleClick={() =>
                setPreview({
                  title: snapshot.title,
                  content: `${byLanguage(language, "线索", "Clues")}：${snapshot.records.length}\n${byLanguage(language, "任务", "Tasks")}：${snapshot.tasks.length}\n${byLanguage(language, "模板", "Snippets")}：${snapshot.promptSnippets.length}\n${new Date(snapshot.createdAt).toLocaleString()}`,
                })
              }
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({
                  x: event.clientX,
                  y: event.clientY,
                  actions: [
                    {
                      label: byLanguage(language, "查看详情", "Preview"),
                      onClick: () =>
                        setPreview({
                          title: snapshot.title,
                          content: `${byLanguage(language, "线索", "Clues")}：${snapshot.records.length}\n${byLanguage(language, "任务", "Tasks")}：${snapshot.tasks.length}\n${byLanguage(language, "模板", "Snippets")}：${snapshot.promptSnippets.length}\n${new Date(snapshot.createdAt).toLocaleString()}`,
                        }),
                    },
                    ...(onRestore
                      ? [
                          {
                            label: byLanguage(language, "恢复到此快照", "Restore Snapshot"),
                            onClick: () => onRestore(snapshot.id),
                          },
                        ]
                      : []),
                    ...(onRemove
                      ? [
                          {
                            label: byLanguage(language, "删除快照", "Delete Snapshot"),
                            onClick: () => onRemove(snapshot.id),
                            danger: true,
                          },
                        ]
                      : []),
                  ],
                });
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{snapshot.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(snapshot.createdAt).toLocaleString()}</div>
                </div>
                <div className="ui-chip rounded-xl px-2 py-1 text-[11px] text-slate-500">
                  {snapshot.records.length}/{snapshot.tasks.length}/{snapshot.promptSnippets.length}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <FloatingContextMenu menu={menu} onClose={() => setMenu(null)} />
      {preview && <PreviewDialog title={preview.title} content={preview.content} onClose={() => setPreview(null)} />}
    </>
  );
}

export function TimelinePanel({
  language,
  events,
}: {
  language: Language;
  events: AIWorkspaceEvent[];
}) {
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  return (
    <>
      <section className="ui-shell flex min-h-0 flex-col overflow-hidden rounded-[1.7rem]">
        <div className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <History size={17} />
            {byLanguage(language, "调查时间线", "Investigation Timeline")}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {byLanguage(language, "记录线索沉淀、计划变化、模板保存和快照操作。", "Tracks clues, plans, snippets and snapshot actions.")}
          </div>
        </div>
        <div className="custom-scrollbar max-h-[24rem] space-y-3 overflow-auto p-4">
          {events.length === 0 && (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500">
              {byLanguage(language, "还没有工作台事件。", "No workspace events yet.")}
            </div>
          )}
          {events.map((event) => (
            <div
              key={event.id}
              className="ui-subtle-surface rounded-[1.3rem] p-3"
              onDoubleClick={() => setPreview({ title: event.title, content: event.detail || event.title })}
              onContextMenu={(evt) => {
                evt.preventDefault();
                setMenu({
                  x: evt.clientX,
                  y: evt.clientY,
                  actions: [
                    {
                      label: byLanguage(language, "查看详情", "Preview"),
                      onClick: () => setPreview({ title: event.title, content: event.detail || event.title }),
                    },
                    {
                      label: byLanguage(language, "复制内容", "Copy"),
                      onClick: () => void navigator.clipboard.writeText(`${event.title}\n${event.detail}`.trim()),
                    },
                  ],
                });
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="ui-chip rounded-xl px-2 py-1 text-[11px] text-slate-500">{event.type}</span>
                    <span className="ui-chip rounded-xl px-2 py-1 text-[11px] text-slate-500">{event.source}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-900">{event.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{event.detail || event.source}</div>
                </div>
                <div className="text-[11px] text-slate-400">{new Date(event.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <FloatingContextMenu menu={menu} onClose={() => setMenu(null)} />
      {preview && <PreviewDialog title={preview.title} content={preview.content} onClose={() => setPreview(null)} />}
    </>
  );
}

export function SlashCommandMenu({
  language,
  input,
  commands,
  onUse,
}: {
  language: Language;
  input: string;
  commands: SlashCommandItem[];
  onUse: (command: SlashCommandItem) => void;
}) {
  const isOpen = input.trim().startsWith("/");
  const filtered = getSlashCommandMatches(input, commands);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="ui-shell mt-3 overflow-hidden rounded-[1.5rem]">
      <div className="border-b border-slate-200/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Command size={15} />
          {byLanguage(language, "命令面板", "Command Palette")}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {byLanguage(language, "输入 / 触发快捷工作流，按 Tab 自动补全。", "Type / to trigger workflow shortcuts and press Tab to complete.")}
        </div>
      </div>
      <div className="custom-scrollbar max-h-64 overflow-auto p-2">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-sm text-slate-400">{byLanguage(language, "没有匹配的命令。", "No matching commands.")}</div>
        )}
        {filtered.map((item) => {
          const icon =
            item.command.includes("web") ? Globe :
            item.command.includes("snapshot") ? History :
            item.command.includes("context") ? FileSearch :
            item.command.includes("terminal") ? SquareTerminal :
            item.command.includes("restore") ? RotateCcw :
            Sparkles;
          const Icon = icon;
          return (
            <button
              key={item.id}
              onClick={() => onUse(item)}
              className={`flex w-full items-start gap-3 rounded-[1.15rem] px-3 py-3 text-left hover:bg-slate-100 ${
                filtered[0]?.id === item.id ? "bg-slate-100/80" : ""
              }`}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Icon size={15} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <span>{item.command}</span>
                  {filtered[0]?.id === item.id && (
                    <span className="ui-chip rounded-xl px-2 py-1 text-[11px] text-slate-500">Tab</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{item.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
