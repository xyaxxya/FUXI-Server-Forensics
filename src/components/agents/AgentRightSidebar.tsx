import { useState, type ComponentType, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Clock3, Copy, MessageSquareText, MoreHorizontal, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import type { AIMessage } from "../../lib/ai";
import type { AIConversationSession } from "../../lib/aiWorkspaceStore";
import { Language } from "../../translations";

export interface AgentSidebarTab<T extends string = string> {
  id: T;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  count?: number;
  content: ReactNode;
}

function formatRelativeTime(timestamp: number, language: Language) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return language === "zh" ? "刚刚" : "Just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return language === "zh" ? `${minutes} 分钟前` : `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return language === "zh" ? `${hours} 小时前` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return language === "zh" ? `${days} 天前` : `${days}d ago`;
}

function countUserMessages(messages: AIMessage[]) {
  return messages.filter((message) => message.role === "user").length;
}

export function ConversationHistoryPanel({
  language,
  sessions,
  activeSessionId,
  onCreate,
  onOpen,
  onDelete,
  onRename,
  onTogglePin,
}: {
  language: Language;
  sessions: AIConversationSession[];
  activeSessionId?: string;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onTogglePin?: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200/70 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <MessageSquareText size={17} />
              {language === "zh" ? "历史对话" : "Conversation History"}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {language === "zh" ? "点击会话即可恢复上下文；新建窗口用于并行问询。" : "Open past chats or create a parallel AI task."}
            </div>
          </div>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
            onClick={onCreate}
            className="ui-button-primary ui-pressable inline-flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-xs"
          >
            <Plus size={14} />
            {language === "zh" ? "新窗口" : "New"}
          </motion.button>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {sessions.length === 0 && (
          <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white/75 p-5 text-sm leading-6 text-slate-500">
            {language === "zh" ? "还没有历史会话。创建新窗口后即可并行保留多个 AI 任务。" : "No saved conversations yet."}
          </div>
        )}
        {sessions.map((session) => {
          const active = session.id === activeSessionId;
          const questionCount = countUserMessages(session.messages);
          return (
            <motion.div
              key={session.id}
              layout
              whileHover={{ y: -2 }}
              className={`group relative overflow-hidden rounded-[1.35rem] border p-3.5 transition ${
                active
                  ? "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 shadow-[0_18px_32px_-26px_rgba(0,120,212,0.35)]"
                  : "border-slate-200/80 bg-white/72 hover:border-blue-200 hover:bg-white/90"
              }`}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent opacity-70" />
              <div className="flex items-start gap-3">
                <button onClick={() => onOpen(session.id)} className="min-w-0 flex-1 text-left">
                  {editingId === session.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          onRename?.(session.id, editingTitle);
                          setEditingId(null);
                        }
                        if (event.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      onBlur={() => {
                        onRename?.(session.id, editingTitle);
                        setEditingId(null);
                      }}
                      className="ui-input-base w-full rounded-xl px-2.5 py-1.5 text-sm"
                    />
                  ) : (
                    <div className="truncate text-sm font-semibold text-slate-900">{session.title}</div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-2 py-1">
                      <Clock3 size={11} />
                      {formatRelativeTime(session.updatedAt, language)}
                    </span>
                    <span className="rounded-full bg-slate-100/80 px-2 py-1">
                      {questionCount} {language === "zh" ? "轮问询" : "turns"}
                    </span>
                    {session.pinned && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-700">
                        {language === "zh" ? "置顶" : "Pinned"}
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1 opacity-75 transition group-hover:opacity-100">
                  <button
                    onClick={() => onTogglePin?.(session.id)}
                    className="ui-button ui-pressable rounded-xl p-2 text-slate-500"
                    title={language === "zh" ? "置顶" : "Pin"}
                  >
                    {session.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(session.id);
                      setEditingTitle(session.title);
                    }}
                    className="ui-button ui-pressable rounded-xl p-2 text-slate-500"
                    title={language === "zh" ? "重命名" : "Rename"}
                  >
                    <MoreHorizontal size={13} />
                  </button>
                  <button
                    onClick={() => onDelete(session.id)}
                    className="ui-button ui-pressable rounded-xl p-2 text-rose-500"
                    title={language === "zh" ? "删除" : "Delete"}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

export function AgentRightSidebar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  footer,
}: {
  tabs: AgentSidebarTab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  footer?: ReactNode;
}) {
  return (
    <aside className="order-2 flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white/76 shadow-[0_30px_80px_-52px_rgba(15,23,42,0.45)] backdrop-blur-[34px]">
      <div className="border-b border-slate-200/70 p-3">
        <div className="grid gap-1 rounded-[1.2rem] bg-slate-100/70 p-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, tabs.length)}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[0.95rem] px-2 py-2 text-xs font-semibold transition ${
                  active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span className="inline-flex max-w-full items-center gap-1 truncate">
                  <Icon size={14} />
                  <span className="truncate">{tab.label}</span>
                </span>
                {typeof tab.count === "number" && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-slate-900 text-white" : "bg-white/80 text-slate-500"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
      {footer && <div className="border-t border-slate-200/70 p-3">{footer}</div>}
    </aside>
  );
}

export function SidebarMiniMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="ui-subtle-surface flex items-center gap-3 rounded-[1.15rem] p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

export function SidebarCopyButton({ value, language }: { value: string; language: Language }) {
  return (
    <button
      onClick={() => void navigator.clipboard.writeText(value)}
      className="ui-button ui-pressable inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-600"
    >
      <Copy size={13} />
      {language === "zh" ? "复制" : "Copy"}
    </button>
  );
}
