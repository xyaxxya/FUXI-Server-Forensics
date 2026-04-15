import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AIWorkspaceSource =
  | "manual"
  | "general-agent"
  | "database-agent"
  | "batch-agent"
  | "system"
  | "planner";

export interface AIWorkspaceRecord {
  id: string;
  title: string;
  content: string;
  source: AIWorkspaceSource;
  createdAt: number;
  updatedAt: number;
}

export type AIPlanStatus = "pending" | "in_progress" | "completed";

export interface AIPlanTask {
  id: string;
  content: string;
  status: AIPlanStatus;
  source: AIWorkspaceSource;
  updatedAt: number;
}

export interface AIPromptSnippet {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AIWorkspaceSnapshot {
  id: string;
  title: string;
  createdAt: number;
  manualContext: string;
  records: AIWorkspaceRecord[];
  tasks: AIPlanTask[];
  promptHistory: string[];
  promptSnippets: AIPromptSnippet[];
  sessionTitle: string;
}

export interface AIWorkspaceEvent {
  id: string;
  type: "record" | "task" | "snippet" | "snapshot" | "system";
  title: string;
  detail: string;
  source: AIWorkspaceSource | "workspace";
  createdAt: number;
}

export function buildWorkspaceContext(manualContext: string, records: AIWorkspaceRecord[]): string {
  const sections: string[] = [];
  const normalizedManual = manualContext.trim();

  if (normalizedManual) {
    sections.push(`【人工整理上下文】\n${normalizedManual}`);
  }

  if (records.length > 0) {
    const recordText = records
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((record, index) => `### 线索 ${index + 1}｜${record.title}\n${record.content.trim()}`)
      .join("\n\n");

    sections.push(`【AI 已沉淀线索】\n${recordText}`);
  }

  return sections.join("\n\n").trim();
}

interface AIWorkspaceState {
  manualContext: string;
  records: AIWorkspaceRecord[];
  tasks: AIPlanTask[];
  promptHistory: string[];
  promptSnippets: AIPromptSnippet[];
  snapshots: AIWorkspaceSnapshot[];
  events: AIWorkspaceEvent[];
  sessionTitle: string;
  setManualContext: (value: string | ((prev: string) => string)) => void;
  setSessionTitle: (value: string) => void;
  appendRecord: (input: {
    content: string;
    title?: string;
    source?: AIWorkspaceSource;
  }) => AIWorkspaceRecord | null;
  syncTasks: (
    tasks: Array<{
      id?: string;
      content: string;
      status: AIPlanStatus;
      source?: AIWorkspaceSource;
    }>,
    source?: AIWorkspaceSource,
  ) => AIPlanTask[];
  addTask: (input: {
    content: string;
    status?: AIPlanStatus;
    source?: AIWorkspaceSource;
  }) => AIPlanTask | null;
  finalizeTasks: (mode?: "running_only" | "all") => void;
  updateTaskStatus: (id: string, status: AIPlanStatus) => void;
  updateTaskContent: (id: string, content: string) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
  addPromptHistory: (prompt: string) => void;
  savePromptSnippet: (input: {
    content: string;
    title?: string;
    pinned?: boolean;
  }) => AIPromptSnippet | null;
  removePromptSnippet: (id: string) => void;
  updatePromptSnippet: (id: string, input: { title?: string; content?: string; pinned?: boolean }) => void;
  togglePromptSnippetPin: (id: string) => void;
  createSnapshot: (title?: string) => AIWorkspaceSnapshot;
  restoreSnapshot: (id: string) => boolean;
  removeSnapshot: (id: string) => void;
  pushEvent: (input: {
    type: AIWorkspaceEvent["type"];
    title: string;
    detail: string;
    source?: AIWorkspaceEvent["source"];
  }) => AIWorkspaceEvent | null;
  removeRecord: (id: string) => void;
  updateRecord: (id: string, input: { title?: string; content?: string }) => void;
  clearRecords: () => void;
  clearAll: () => void;
  getCombinedContext: () => string;
}

function sanitizeContextText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function deriveRecordTitle(content: string): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return (firstLine || "关键线索").slice(0, 48);
}

function normalizePrompt(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export const useAIWorkspaceStore = create<AIWorkspaceState>()(
  persist(
    (set, get) => ({
      manualContext: "",
      records: [],
      tasks: [],
      promptHistory: [],
      promptSnippets: [],
      snapshots: [],
      events: [],
      sessionTitle: "取证工作台",
      setManualContext: (value) => {
        set((state) => ({
          manualContext: typeof value === "function" ? value(state.manualContext) : value,
        }));
      },
      setSessionTitle: (value) => {
        const nextValue = value.trim();
        set({
          sessionTitle: nextValue || "取证工作台",
        });
      },
      appendRecord: ({ content, title, source = "system" }) => {
        const normalizedContent = sanitizeContextText(content);
        if (!normalizedContent) {
          return null;
        }

        const existing = get().records.find(
          (record) => sanitizeContextText(record.content) === normalizedContent,
        );

        if (existing) {
          const updated = {
            ...existing,
            title: title?.trim() || existing.title,
            source,
            updatedAt: Date.now(),
          };

          set((state) => ({
            records: state.records.map((record) => (record.id === existing.id ? updated : record)),
          }));
          get().pushEvent({
            type: "record",
            title: `更新线索 · ${updated.title}`,
            detail: updated.content,
            source,
          });

          return updated;
        }

        const now = Date.now();
        const nextRecord: AIWorkspaceRecord = {
          id: crypto.randomUUID(),
          title: title?.trim() || deriveRecordTitle(normalizedContent),
          content: normalizedContent,
          source,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          records: [nextRecord, ...state.records].slice(0, 80),
        }));
        get().pushEvent({
          type: "record",
          title: `新增线索 · ${nextRecord.title}`,
          detail: nextRecord.content,
          source,
        });

        return nextRecord;
      },
      syncTasks: (tasks, source = "planner") => {
        const now = Date.now();
        const normalizedTasks = tasks
          .map((task, index) => {
            const content = sanitizeContextText(task.content);
            if (!content) {
              return null;
            }
            return {
              id: task.id?.trim() || String(index + 1),
              content,
              status: task.status,
              source: task.source || source,
              updatedAt: now,
            } satisfies AIPlanTask;
          })
          .filter((task): task is AIPlanTask => task !== null)
          .slice(0, 20);

        set({
          tasks: normalizedTasks,
        });
        if (normalizedTasks.length > 0) {
          get().pushEvent({
            type: "task",
            title: `同步计划 · ${normalizedTasks.length} 项`,
            detail: normalizedTasks.map((task) => `${task.status} · ${task.content}`).join("\n"),
            source,
          });
        }

        return normalizedTasks;
      },
      addTask: ({ content, status = "pending", source = "manual" }) => {
        const normalized = sanitizeContextText(content);
        if (!normalized) {
          return null;
        }
        const now = Date.now();
        const nextTask: AIPlanTask = {
          id: crypto.randomUUID(),
          content: normalized,
          status,
          source,
          updatedAt: now,
        };
        set((state) => ({
          tasks: [nextTask, ...state.tasks].slice(0, 20),
        }));
        get().pushEvent({
          type: "task",
          title: `新增任务 · ${nextTask.content}`,
          detail: nextTask.status,
          source,
        });
        return nextTask;
      },
      finalizeTasks: (mode = "running_only") => {
        const now = Date.now();
        set((state) => ({
          tasks: state.tasks.map((task) => {
            const shouldComplete = mode === "all" ? task.status !== "completed" : task.status === "in_progress";
            if (!shouldComplete) {
              return task;
            }

            return {
              ...task,
              status: "completed",
              updatedAt: now,
            };
          }),
        }));
      },
      updateTaskStatus: (id, status) => {
        const current = get().tasks.find((task) => task.id === id);
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status,
                  updatedAt: Date.now(),
                }
              : task,
          ),
        }));
        if (current) {
          get().pushEvent({
            type: "task",
            title: `任务状态更新 · ${current.content}`,
            detail: status,
            source: current.source,
          });
        }
      },
      updateTaskContent: (id, content) => {
        const normalized = sanitizeContextText(content);
        if (!normalized) {
          return;
        }
        const current = get().tasks.find((task) => task.id === id);
        if (!current) {
          return;
        }
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  content: normalized,
                  updatedAt: Date.now(),
                }
              : task,
          ),
        }));
        get().pushEvent({
          type: "task",
          title: `编辑任务 · ${normalized.slice(0, 48)}`,
          detail: normalized,
          source: current.source,
        });
      },
      removeTask: (id) => {
        const current = get().tasks.find((task) => task.id === id);
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));
        if (current) {
          get().pushEvent({
            type: "task",
            title: `删除任务 · ${current.content}`,
            detail: current.content,
            source: current.source,
          });
        }
      },
      clearTasks: () => {
        set({ tasks: [] });
      },
      addPromptHistory: (prompt) => {
        const normalizedPrompt = normalizePrompt(prompt);
        if (!normalizedPrompt) {
          return;
        }
        set((state) => ({
          promptHistory: [normalizedPrompt, ...state.promptHistory.filter((item) => item !== normalizedPrompt)].slice(0, 16),
        }));
      },
      savePromptSnippet: ({ content, title, pinned = false }) => {
        const normalizedContent = normalizePrompt(content);
        if (!normalizedContent) {
          return null;
        }

        const existing = get().promptSnippets.find((item) => normalizePrompt(item.content) === normalizedContent);
        if (existing) {
          const updated: AIPromptSnippet = {
            ...existing,
            title: title?.trim() || existing.title,
            pinned,
            updatedAt: Date.now(),
          };
          set((state) => ({
            promptSnippets: state.promptSnippets.map((item) => (item.id === existing.id ? updated : item)),
          }));
          return updated;
        }

        const now = Date.now();
        const snippet: AIPromptSnippet = {
          id: crypto.randomUUID(),
          title: title?.trim() || deriveRecordTitle(normalizedContent),
          content: normalizedContent,
          pinned,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          promptSnippets: [snippet, ...state.promptSnippets].slice(0, 20),
        }));
        get().pushEvent({
          type: "snippet",
          title: `保存模板 · ${snippet.title}`,
          detail: snippet.content,
          source: "manual",
        });

        return snippet;
      },
      removePromptSnippet: (id) => {
        set((state) => ({
          promptSnippets: state.promptSnippets.filter((item) => item.id !== id),
        }));
      },
      updatePromptSnippet: (id, input) => {
        const current = get().promptSnippets.find((item) => item.id === id);
        if (!current) {
          return;
        }
        const nextTitle = typeof input.title === "string" ? input.title.trim() : current.title;
        const nextContent =
          typeof input.content === "string" ? normalizePrompt(input.content) : current.content;
        if (!nextContent) {
          return;
        }
        const nextPinned = typeof input.pinned === "boolean" ? input.pinned : current.pinned;
        set((state) => ({
          promptSnippets: state.promptSnippets.map((item) =>
            item.id === id
              ? {
                  ...item,
                  title: nextTitle || deriveRecordTitle(nextContent),
                  content: nextContent,
                  pinned: nextPinned,
                  updatedAt: Date.now(),
                }
              : item,
          ),
        }));
        get().pushEvent({
          type: "snippet",
          title: `编辑模板 · ${(nextTitle || deriveRecordTitle(nextContent)).slice(0, 48)}`,
          detail: nextContent,
          source: "manual",
        });
      },
      togglePromptSnippetPin: (id) => {
        set((state) => ({
          promptSnippets: state.promptSnippets.map((item) =>
            item.id === id
              ? {
                  ...item,
                  pinned: !item.pinned,
                  updatedAt: Date.now(),
                }
              : item,
          ),
        }));
      },
      createSnapshot: (title) => {
        const state = get();
        const snapshot: AIWorkspaceSnapshot = {
          id: crypto.randomUUID(),
          title: title?.trim() || `${state.sessionTitle} ${new Date().toLocaleString()}`,
          createdAt: Date.now(),
          manualContext: state.manualContext,
          records: state.records,
          tasks: state.tasks,
          promptHistory: state.promptHistory,
          promptSnippets: state.promptSnippets,
          sessionTitle: state.sessionTitle,
        };
        set((currentState) => ({
          snapshots: [snapshot, ...currentState.snapshots].slice(0, 12),
        }));
        get().pushEvent({
          type: "snapshot",
          title: `创建快照 · ${snapshot.title}`,
          detail: `${snapshot.records.length} 条线索 / ${snapshot.tasks.length} 项任务`,
          source: "workspace",
        });
        return snapshot;
      },
      restoreSnapshot: (id) => {
        const snapshot = get().snapshots.find((item) => item.id === id);
        if (!snapshot) {
          return false;
        }
        set({
          manualContext: snapshot.manualContext,
          records: snapshot.records,
          tasks: snapshot.tasks,
          promptHistory: snapshot.promptHistory,
          promptSnippets: snapshot.promptSnippets,
          sessionTitle: snapshot.sessionTitle,
        });
        get().pushEvent({
          type: "snapshot",
          title: `恢复快照 · ${snapshot.title}`,
          detail: `${snapshot.records.length} 条线索 / ${snapshot.tasks.length} 项任务`,
          source: "workspace",
        });
        return true;
      },
      removeSnapshot: (id) => {
        const snapshot = get().snapshots.find((item) => item.id === id);
        set((state) => ({
          snapshots: state.snapshots.filter((item) => item.id !== id),
        }));
        if (snapshot) {
          get().pushEvent({
            type: "snapshot",
            title: `删除快照 · ${snapshot.title}`,
            detail: snapshot.title,
            source: "workspace",
          });
        }
      },
      pushEvent: ({ type, title, detail, source = "workspace" }) => {
        const normalizedTitle = sanitizeContextText(title);
        const normalizedDetail = sanitizeContextText(detail);
        if (!normalizedTitle) {
          return null;
        }
        const event: AIWorkspaceEvent = {
          id: crypto.randomUUID(),
          type,
          title: normalizedTitle,
          detail: normalizedDetail,
          source,
          createdAt: Date.now(),
        };
        set((state) => ({
          events: [event, ...state.events].slice(0, 120),
        }));
        return event;
      },
      removeRecord: (id) => {
        const record = get().records.find((item) => item.id === id);
        set((state) => ({
          records: state.records.filter((record) => record.id !== id),
        }));
        if (record) {
          get().pushEvent({
            type: "record",
            title: `删除线索 · ${record.title}`,
            detail: record.content,
            source: record.source,
          });
        }
      },
      updateRecord: (id, input) => {
        const current = get().records.find((item) => item.id === id);
        if (!current) {
          return;
        }
        const nextTitle = typeof input.title === "string" ? input.title.trim() : current.title;
        const nextContent =
          typeof input.content === "string" ? sanitizeContextText(input.content) : current.content;
        if (!nextContent) {
          return;
        }
        set((state) => ({
          records: state.records.map((record) =>
            record.id === id
              ? {
                  ...record,
                  title: nextTitle || deriveRecordTitle(nextContent),
                  content: nextContent,
                  updatedAt: Date.now(),
                }
              : record,
          ),
        }));
        get().pushEvent({
          type: "record",
          title: `编辑线索 · ${(nextTitle || deriveRecordTitle(nextContent)).slice(0, 48)}`,
          detail: nextContent,
          source: current.source,
        });
      },
      clearRecords: () => {
        set({ records: [] });
      },
      clearAll: () => {
        set({ manualContext: "", records: [], tasks: [], promptHistory: [], promptSnippets: [], snapshots: [], events: [], sessionTitle: "取证工作台" });
      },
      getCombinedContext: () => buildWorkspaceContext(get().manualContext, get().records),
    }),
    {
      name: "ai-workspace-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        manualContext: state.manualContext,
        records: state.records,
        tasks: state.tasks,
        promptHistory: state.promptHistory,
        promptSnippets: state.promptSnippets,
        snapshots: state.snapshots,
        events: state.events,
        sessionTitle: state.sessionTitle,
      }),
    },
  ),
);
