import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { Bot, Loader2, Send, Square, Trash2, Wand2 } from "lucide-react";
import { useCommandStore } from "../../store/CommandContext";
import { AIMessage, AISettings, ToolCall, buildServerForensicsToolExecution, buildToolDisplayText, shouldTreatAssistantMessageAsThinking } from "../../lib/ai";
import { buildContextSections, buildServerContextSummary, buildWorkspacePromptContext } from "../../lib/aiContext";
import { applyUsageToSettings, runConversationLoop } from "../../lib/aiRuntime";
import { executeResearchTool } from "../../lib/aiResearchTools";
import { useAIWorkspaceStore } from "../../lib/aiWorkspaceStore";
import { Language } from "../../translations";
import { ChatTranscriptMessage } from "./ChatTranscriptMessage";
import ThinkingProcess, { ThinkingStep } from "./ThinkingProcess";
import { FloatingContextMenu, PlannerPanel, PreviewDialog, PromptDeck, SlashCommandMenu, WorkspaceHeader, getExactSlashCommand, getSlashCommandCompletion } from "./WorkbenchWidgets";

interface GeneralAgentProps {
  language: Language;
  aiSettings: AISettings;
  onOpenSettings?: () => void;
  generalInfo: string;
  setGeneralInfo: (info: string | ((prev: string) => string)) => void;
  onAiSettingsChange?: (settings: AISettings) => void;
  chatUserProfile?: {
    qq?: string | null;
    avatar?: string | null;
  };
}

type DisplayItem =
  | { type: "message"; message: AIMessage }
  | { type: "thinking"; steps: ThinkingStep[]; isFinished: boolean };

interface RemoteSession {
  id: string;
  ip: string;
  user: string;
}

const quickPrompts = {
  zh: [
    "先给出一份调查计划，再按计划分析当前服务器。",
    "识别当前服务器的网站业务、启动方式、配置入口和可疑点。",
    "从已知共享线索出发，告诉我下一步最值得验证的证据。",
    "只输出高价值发现，并同步维护执行计划。",
  ],
  en: [
    "Create an investigation plan first, then analyze the current server.",
    "Identify the web stack, config paths and suspicious entry points.",
    "Use the shared clue pool and tell me the next evidence to verify.",
    "Return only high-value findings and keep the execution plan updated.",
  ],
};

function buildDisplayItems(messages: AIMessage[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let thinkingSteps: ThinkingStep[] = [];

  const pushThinking = (isFinished: boolean) => {
    if (thinkingSteps.length > 0) {
      items.push({ type: "thinking", steps: [...thinkingSteps], isFinished });
      thinkingSteps = [];
    }
  };

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === "system") {
      continue;
    }
    if (message.role === "user") {
      pushThinking(true);
      items.push({ type: "message", message });
      continue;
    }
    if (message.role === "assistant") {
      const isThinking = shouldTreatAssistantMessageAsThinking(messages, index, thinkingSteps.length > 0);
      if (isThinking) {
        if (message.content.trim()) {
          thinkingSteps.push({
            id: `thought-${index}`,
            title: message.content,
          });
        }
        message.tool_calls?.forEach((toolCall) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          } catch {
            args = { raw: toolCall.function.arguments };
          }
          const display = buildToolDisplayText(toolCall);
          thinkingSteps.push({
            id: toolCall.id,
            title: display.title,
            toolCall: {
              command: display.command,
              args,
              isLoading: true,
            },
          });
        });
      } else {
        pushThinking(true);
        items.push({ type: "message", message });
      }
      continue;
    }
    if (message.role === "tool") {
      const matchedStep = thinkingSteps.find((step) => step.id === message.tool_call_id);
      if (matchedStep?.toolCall) {
        matchedStep.toolCall.output = message.content;
        matchedStep.toolCall.isLoading = false;
        matchedStep.toolCall.isError = /Execution failed|Exit:\s*[1-9]/.test(message.content);
      } else {
        thinkingSteps.push({
          id: `tool-${index}`,
          title: "Tool Output",
          toolCall: {
            command: "Unknown Tool",
            args: {},
            output: message.content,
            isLoading: false,
          },
        });
      }
    }
  }

  pushThinking(false);
  return items;
}

function limitOutput(value: string) {
  return value.length > 12000 ? `${value.slice(0, 12000)}\n\n...[truncated]...` : value;
}

function resolveTargetSessions(
  sessions: RemoteSession[],
  selectedSessionIds: string[],
  currentSession: RemoteSession | null,
  targetIds?: string[],
) {
  if (targetIds && targetIds.length > 0) {
    return sessions.filter((session) => targetIds.includes(session.id));
  }
  const selected = sessions.filter((session) => selectedSessionIds.includes(session.id));
  if (selected.length > 0) {
    return selected;
  }
  return currentSession ? [currentSession] : [];
}

export default function GeneralAgent({
  language,
  aiSettings,
  generalInfo,
  onAiSettingsChange,
}: GeneralAgentProps) {
  const { currentSession, sessions, selectedSessionIds } = useCommandStore();
  const records = useAIWorkspaceStore((state) => state.records);
  const tasks = useAIWorkspaceStore((state) => state.tasks);
  const promptHistory = useAIWorkspaceStore((state) => state.promptHistory);
  const promptSnippets = useAIWorkspaceStore((state) => state.promptSnippets);
  const sessionTitle = useAIWorkspaceStore((state) => state.sessionTitle);
  const appendRecord = useAIWorkspaceStore((state) => state.appendRecord);
  const syncTasks = useAIWorkspaceStore((state) => state.syncTasks);
  const finalizeTasks = useAIWorkspaceStore((state) => state.finalizeTasks);
  const updateTaskStatus = useAIWorkspaceStore((state) => state.updateTaskStatus);
  const removeTask = useAIWorkspaceStore((state) => state.removeTask);
  const clearTasks = useAIWorkspaceStore((state) => state.clearTasks);
  const addPromptHistory = useAIWorkspaceStore((state) => state.addPromptHistory);
  const savePromptSnippet = useAIWorkspaceStore((state) => state.savePromptSnippet);
  const removePromptSnippet = useAIWorkspaceStore((state) => state.removePromptSnippet);
  const togglePromptSnippetPin = useAIWorkspaceStore((state) => state.togglePromptSnippetPin);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [cluePreview, setCluePreview] = useState<{ title: string; content: string } | null>(null);
  const [clueMenu, setClueMenu] = useState<{ x: number; y: number; actions: Array<{ label: string; onClick: () => void; danger?: boolean }> } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);
  const config = aiSettings.configs[aiSettings.activeProvider];

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [displayItems.length, loading, messages.length, status]);

  const executeToolCall = async (toolCall: ToolCall) => {
    if (toolCall.function.name === "update_context_info") {
      const args = JSON.parse(toolCall.function.arguments) as { info?: string };
      if (args.info) {
        appendRecord({
          content: args.info,
          source: "general-agent",
        });
      }
      return {
        role: "tool",
        content: language === "zh" ? "共享线索池已更新。" : "Shared clue pool updated.",
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    if (toolCall.function.name === "update_plan") {
      const args = JSON.parse(toolCall.function.arguments) as {
        tasks?: Array<{
          id?: string;
          content: string;
          status: "pending" | "in_progress" | "completed";
        }>;
      };
      syncTasks(args.tasks || [], "planner");
      return {
        role: "tool",
        content: language === "zh" ? "执行计划已更新。" : "Execution plan updated.",
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    const researchResult = await executeResearchTool(toolCall, language);
    if (researchResult) {
      return researchResult;
    }

    const serverToolExecution = buildServerForensicsToolExecution(toolCall);
    const args = JSON.parse(toolCall.function.arguments) as {
      command?: string;
      target_ids?: string[];
    };
    const command = serverToolExecution?.command ?? args.command;
    const targetIds = serverToolExecution?.targetIds ?? args.target_ids;
    if (!command) {
      return {
        role: "tool",
        content: language === "zh" ? "工具参数不完整，缺少可执行内容。" : "Tool arguments are incomplete.",
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    const targetSessions = resolveTargetSessions(sessions, selectedSessionIds, currentSession, targetIds);

    if (targetSessions.length === 0) {
      return {
        role: "tool",
        content: language === "zh" ? "当前没有可执行的 SSH 会话。" : "No SSH session is available.",
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    if (targetSessions.length === 1) {
      const session = targetSessions[0];
      setStatus(`${language === "zh" ? "执行中" : "Running"}：${session.user}@${session.ip}`);
      const result = await invoke<{ stdout: string; stderr: string; exit_code: number }>("exec_command", {
          cmd: command,
        sessionId: session.id,
      });
      const output = [result.stdout.trim(), result.stderr.trim(), `Exit: ${result.exit_code}`].filter(Boolean).join("\n");
      return {
        role: "tool",
        content: limitOutput(output || (language === "zh" ? "无输出" : "No output")),
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    const parts = await Promise.all(
      targetSessions.map(async (session) => {
        try {
          const result = await invoke<{ stdout: string; stderr: string; exit_code: number }>("exec_command", {
            cmd: args.command,
            sessionId: session.id,
          });
          const body = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
          return `[${session.user}@${session.ip}] Exit: ${result.exit_code}\n${body || (language === "zh" ? "无输出" : "No output")}`;
        } catch (error) {
          return `[${session.user}@${session.ip}] ${String(error)}`;
        }
      }),
    );

    return {
      role: "tool",
      content: limitOutput(parts.join("\n\n----------------------------------------\n\n")),
      tool_call_id: toolCall.id,
    } as AIMessage;
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setStatus(language === "zh" ? "已停止" : "Stopped");
  };

  const handleClear = () => {
    if (loading) {
      return;
    }
    setMessages([]);
    setStatus("");
  };

  const slashCommands = useMemo(
    () => [
      {
        id: "plan",
        command: "/plan",
        title: language === "zh" ? "生成调查计划" : "Create investigation plan",
        description: language === "zh" ? "先生成 3-6 步调查计划再开始分析" : "Generate a 3-6 step plan before analysis",
        insertText: language === "zh" ? "请先给出一份清晰的调查计划，再按计划逐步执行分析。" : "Create a clear investigation plan first, then execute it step by step.",
      },
      {
        id: "web",
        command: "/web",
        title: language === "zh" ? "联网查询资料" : "Search the web",
        description: language === "zh" ? "主动搜索公开资料、文档或漏洞说明" : "Search public docs, references or vulnerability information",
        insertText: language === "zh" ? "请联网搜索相关公开资料，并基于搜索结果给我结论。" : "Search the public web for relevant references and answer from those results.",
      },
      {
        id: "context",
        command: "/context",
        title: language === "zh" ? "基于共享线索继续分析" : "Use shared clue pool",
        description: language === "zh" ? "优先复用共享线索池中的内容继续分析" : "Continue analysis from the shared clue pool first",
        insertText: language === "zh" ? "请先基于共享线索池中的内容继续推理，并告诉我下一步最值得验证的点。" : "Use the shared clue pool first and tell me the next best evidence to verify.",
      },
      {
        id: "clear",
        command: "/clear",
        title: language === "zh" ? "清空当前会话" : "Clear session",
        description: language === "zh" ? "清空当前对话消息，保留工作台数据" : "Clear current chat while preserving workspace data",
        onSelect: () => {
          handleClear();
          setInput("");
        },
      },
    ],
    [handleClear, language],
  );

  const handleSend = async () => {
    if (!input.trim() || loading) {
      return;
    }
    if (!config.apiKey.trim()) {
      setStatus(language === "zh" ? "请先在设置中配置 AI Key。" : "Configure the AI key first.");
      return;
    }

    const nextUserMessage: AIMessage = {
      role: "user",
      content: input.trim(),
    };
    addPromptHistory(input);
    const nextHistory = [...messages, nextUserMessage];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    setStatus(language === "zh" ? "智能体正在分析..." : "Agent is analyzing...");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const serverInfo = buildServerContextSummary(sessions, selectedSessionIds, currentSession);
    const workspaceInfo = buildWorkspacePromptContext(generalInfo, records);
    const conversationContext = buildContextSections([
      { title: "当前任务", content: "通用智能体对话分析与线索沉淀" },
      { title: "服务器会话", content: serverInfo },
      { title: "共享线索池", content: workspaceInfo || "暂无" },
      {
        title: "执行计划要求",
        content: "复杂问题先调用 update_plan 给出 3-6 步计划；过程中持续更新 pending / in_progress / completed 状态。",
      },
    ]);

    try {
      const finalHistory = await runConversationLoop({
        initialHistory: nextHistory,
        settings: aiSettings,
        generalInfo: conversationContext,
        signal: abortController.signal,
        executeToolCall: async ({ toolCall }) => executeToolCall(toolCall),
        callbacks: {
          onAssistantMessage: (_, history) => {
            setMessages(history);
          },
          onToolResult: (_, __, history) => {
            setMessages(history);
            setStatus(language === "zh" ? "正在处理工具结果..." : "Processing tool output...");
          },
          onUsage: (usage) => {
            onAiSettingsChange?.(applyUsageToSettings(aiSettings, usage));
          },
        },
      });
      setMessages(finalHistory);
      finalizeTasks("all");
      setStatus(language === "zh" ? "分析完成" : "Done");
    } catch (error) {
      setStatus(String(error));
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="h-full grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="ui-shell order-1 min-h-0 rounded-[2rem] flex flex-col overflow-hidden">
        <WorkspaceHeader
          language={language}
          icon={Bot}
          title={language === "zh" ? "通用智能体" : "General Agent"}
          description={
            language === "zh"
              ? "围绕当前服务器对话分析、提炼结论并沉淀共享线索。"
              : "Analyze the current servers, summarize findings and retain shared clues."
          }
          aiSettings={aiSettings}
          sessionInfo={
            currentSession
              ? `${currentSession.user}@${currentSession.ip}`
              : language === "zh"
                ? "未连接 SSH 会话"
                : "No SSH session"
          }
          extraItems={[
            { label: language === "zh" ? "线索" : "Clues", value: String(records.length) },
            { label: language === "zh" ? "计划任务" : "Tasks", value: String(tasks.length) },
            { label: language === "zh" ? "服务器" : "Servers", value: String(selectedSessionIds.length || (currentSession ? 1 : 0)) },
            { label: language === "zh" ? "会话标题" : "Session", value: sessionTitle },
          ]}
          actions={
            <>
              {loading && (
                <motion.button
                  onClick={handleStop}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  className="ui-button-danger ui-pressable ui-focus-ring inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-amber-700"
                >
                  <Square size={16} />
                  {language === "zh" ? "停止" : "Stop"}
                </motion.button>
              )}
              <motion.button
                onClick={handleClear}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                className="ui-button ui-pressable ui-focus-ring inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-600"
              >
                <Trash2 size={16} />
                {language === "zh" ? "清空会话" : "Clear"}
              </motion.button>
            </>
          }
        />

        <div className="flex-1 min-h-0 overflow-auto bg-slate-50/40 px-4 py-4 md:px-6 md:py-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {quickPrompts[language].map((prompt) => (
              <motion.button
                key={prompt}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setInput(prompt)}
                className="ui-chip ui-pressable rounded-2xl px-3 py-2 text-sm text-slate-600"
              >
                <span className="inline-flex items-center gap-2">
                  <Wand2 size={14} />
                  {prompt}
                </span>
              </motion.button>
            ))}
          </div>
          {messages.length === 0 && (
            <div className="ui-surface rounded-[1.7rem] border-dashed px-6 py-10 text-center text-slate-500">
              {language === "zh"
                ? "开始提问，智能体会在需要时主动执行命令并把关键线索沉淀进共享线索池。"
                : "Ask a question to let the agent investigate and retain key clues."}
            </div>
          )}
          <div className="space-y-4">
            {displayItems.map((item, index) =>
              item.type === "thinking" ? (
                <ThinkingProcess
                  key={`thinking-${index}`}
                  steps={item.steps}
                  isFinished={item.isFinished}
                  language={language}
                />
              ) : (
                <ChatTranscriptMessage key={`message-${index}`} message={item.message} language={language} />
              ),
            )}
            {loading && (
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 pl-4 font-mono text-[11px] text-slate-500 shadow-[0_18px_34px_-32px_rgba(15,23,42,0.55)] w-fit">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <Loader2 size={14} className="animate-spin" />
                {status || (language === "zh" ? "处理中..." : "Processing...")}
              </div>
            )}
            {!loading && status && (
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100/90 px-3 py-1.5 font-mono text-[11px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                {status}
              </div>
            )}
            <div ref={listEndRef} />
          </div>
        </div>

        <div className="sticky bottom-0 z-20 border-t border-slate-200/70 bg-white/78 p-4 backdrop-blur-xl">
          <div className="mb-3 text-xs text-slate-400">
            {language === "zh"
              ? "支持像 Claude Code 一样维护计划、复用历史提示词、沉淀共享线索。"
              : "Supports Claude Code style plan tracking, prompt reuse and shared clues."}
          </div>
          <div className="rounded-[1.8rem] border border-white/70 bg-white/90 p-3 shadow-[0_30px_60px_-34px_rgba(15,23,42,0.26)] backdrop-blur-sm">
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Tab" && input.trim().startsWith("/")) {
                    const completion = getSlashCommandCompletion(input, slashCommands);
                    if (completion) {
                      event.preventDefault();
                      setInput(completion);
                    }
                    return;
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (input.trim().startsWith("/")) {
                      const exactCommand = getExactSlashCommand(input, slashCommands);
                      if (exactCommand) {
                        if (exactCommand.onSelect) {
                          exactCommand.onSelect();
                        } else {
                          setInput(exactCommand.insertText || exactCommand.command);
                        }
                      }
                    } else {
                      void handleSend();
                    }
                  }
                }}
                placeholder={
                  language === "zh"
                    ? "输入问题，或输入 / 打开命令面板。"
                    : "Ask a question, or type / to open the command palette."
                }
                className="ui-input-base min-h-[104px] flex-1 resize-none rounded-[1.55rem] border-white/0 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 shadow-inner"
              />
              <motion.button
                onClick={() => void handleSend()}
                disabled={loading || !input.trim() || input.trim().startsWith("/")}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                className="ui-button-primary ui-pressable rounded-[1.35rem] inline-flex h-12 w-12 items-center justify-center disabled:bg-slate-300 disabled:border-slate-300"
              >
                <Send size={18} />
              </motion.button>
            </div>
            <SlashCommandMenu
              language={language}
              input={input}
              commands={slashCommands}
              onUse={(command) => {
                if (command.onSelect) {
                  command.onSelect();
                  return;
                }
                setInput(command.insertText || "");
              }}
            />
          </div>
        </div>
      </section>

      <aside className="order-2 min-h-0 custom-scrollbar overflow-auto pr-1 flex flex-col gap-4">
        <PlannerPanel
          language={language}
          tasks={tasks}
          onClear={() => clearTasks()}
          onUpdateTaskStatus={updateTaskStatus}
          onRemoveTask={removeTask}
        />
        <PromptDeck
          language={language}
          title={language === "zh" ? "提示词面板" : "Prompt Deck"}
          promptHistory={promptHistory}
          promptSnippets={promptSnippets}
          currentInput={input}
          onUsePrompt={(value) => setInput(value)}
          onSaveCurrent={() => {
            savePromptSnippet({ content: input, pinned: true });
          }}
          onSaveHistoryPrompt={(value) => savePromptSnippet({ content: value, pinned: false })}
          onRemoveSnippet={removePromptSnippet}
          onTogglePin={togglePromptSnippetPin}
        />
        <div className="ui-shell min-h-0 rounded-[2rem] overflow-hidden flex flex-col">
          <div className="border-b border-slate-200/70 px-5 py-4">
            <h3 className="text-base font-bold text-slate-900">
              {language === "zh" ? "共享线索池" : "Shared Clue Pool"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {language === "zh"
                ? "所有 AI 面板都会把有效信息沉淀到这里，并自动参与后续推理。"
                : "All AI panels retain useful findings here for later reasoning."}
            </p>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {records.length === 0 && (
              <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500">
                {language === "zh" ? "暂时还没有沉淀线索。" : "No clues have been retained yet."}
              </div>
            )}
            {records.map((record) => (
              <motion.div
                key={record.id}
                whileHover={{ y: -2 }}
                onDoubleClick={() => setCluePreview({ title: record.title, content: record.content })}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setClueMenu({
                    x: event.clientX,
                    y: event.clientY,
                    actions: [
                      {
                        label: language === "zh" ? "查看详情" : "Preview",
                        onClick: () => setCluePreview({ title: record.title, content: record.content }),
                      },
                      {
                        label: language === "zh" ? "复制内容" : "Copy",
                        onClick: () => void navigator.clipboard.writeText(record.content),
                      },
                      {
                        label: language === "zh" ? "存为提示词模板" : "Save as Prompt Snippet",
                        onClick: () => savePromptSnippet({ content: record.content, title: record.title, pinned: false }),
                      },
                      {
                        label: language === "zh" ? "发送到输入框" : "Send to Input",
                        onClick: () => setInput(record.content),
                      },
                    ],
                  });
                }}
                className="ui-subtle-surface rounded-[1.4rem] p-4"
              >
                <div className="text-sm font-semibold text-slate-900">{record.title}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{record.content}</div>
                <div className="mt-3 text-xs text-slate-400">
                  {language === "zh" ? "来源" : "Source"} · {record.source}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <FloatingContextMenu menu={clueMenu} onClose={() => setClueMenu(null)} />
        {cluePreview && <PreviewDialog title={cluePreview.title} content={cluePreview.content} onClose={() => setCluePreview(null)} />}
      </aside>
    </div>
  );
}
