import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, ListChecks, Loader2, Play, Square, Trash2, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Language } from "../../translations";
import { AIMessage, AISettings, ToolCall, buildServerForensicsToolExecution, buildToolDisplayText, shouldTreatAssistantMessageAsThinking } from "../../lib/ai";
import { buildContextSections, buildServerContextSummary, buildWorkspacePromptContext } from "../../lib/aiContext";
import { applyUsageToSettings, runConversationLoop } from "../../lib/aiRuntime";
import { executeResearchTool } from "../../lib/aiResearchTools";
import { useAIWorkspaceStore } from "../../lib/aiWorkspaceStore";
import { useCommandStore } from "../../store/CommandContext";
import ThinkingProcess, { ThinkingStep } from "./ThinkingProcess";
import { ChatTranscriptMessage } from "./ChatTranscriptMessage";
import { FloatingContextMenu, PlannerPanel, PreviewDialog, PromptDeck, SlashCommandMenu, WorkspaceHeader, getExactSlashCommand, getSlashCommandCompletion } from "./WorkbenchWidgets";

interface AgentPanelProps {
  language?: Language;
  aiSettings?: AISettings;
  onAiSettingsChange?: (settings: AISettings) => void;
  generalInfo?: string;
  chatUserProfile?: {
    qq?: string | null;
    avatar?: string | null;
  };
}

type BatchStatus = "pending" | "running" | "completed" | "error";

interface BatchItem {
  id: string;
  question: string;
  status: BatchStatus;
  messages: AIMessage[];
  answer: string;
  error: string;
}

type DisplayItem =
  | { type: "message"; message: AIMessage }
  | { type: "thinking"; steps: ThinkingStep[]; isFinished: boolean };

interface RemoteSession {
  id: string;
  ip: string;
  user: string;
}

const batchPromptPresets = {
  zh: [
    "请逐题分析，并先维护一份整体计划。",
    "所有答案只保留结论与关键证据，不要解释常识。",
    "如果发现共享线索池中已有证据，请优先复用。",
  ],
  en: [
    "Analyze each question and maintain a shared plan first.",
    "Return concise conclusions with supporting evidence only.",
    "Reuse the shared clue pool before running more commands.",
  ],
};

function buildDisplayItems(messages: AIMessage[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let thinkingSteps: ThinkingStep[] = [];

  const flush = (isFinished: boolean) => {
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
      flush(true);
      items.push({ type: "message", message });
      continue;
    }
    if (message.role === "assistant") {
      const isThinking = shouldTreatAssistantMessageAsThinking(messages, index, thinkingSteps.length > 0);
      if (isThinking) {
        if (message.content.trim()) {
          thinkingSteps.push({ id: `thought-${index}`, title: message.content });
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
        flush(true);
        items.push({ type: "message", message });
      }
      continue;
    }
    if (message.role === "tool") {
      const step = thinkingSteps.find((item) => item.id === message.tool_call_id);
      if (step?.toolCall) {
        step.toolCall.output = message.content;
        step.toolCall.isLoading = false;
        step.toolCall.isError = /Execution failed|Exit:\s*[1-9]/.test(message.content);
      }
    }
  }

  flush(false);
  return items;
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

function extractAnswer(messages: AIMessage[]) {
  const assistantMessages = messages.filter(
    (message) => message.role === "assistant" && !message.tool_calls?.length && message.content.trim(),
  );
  return assistantMessages[assistantMessages.length - 1]?.content || "";
}

export default function AgentPanel({
  language = "zh",
  aiSettings,
  onAiSettingsChange,
  generalInfo = "",
}: AgentPanelProps) {
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
  const [questionInput, setQuestionInput] = useState("");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; actions: Array<{ label: string; onClick: () => void; danger?: boolean }> } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const config = aiSettings?.configs[aiSettings.activeProvider];
  const totalCompleted = items.filter((item) => item.status === "completed").length;

  const executeToolCall = async (toolCall: ToolCall) => {
    if (toolCall.function.name === "update_context_info") {
      const args = JSON.parse(toolCall.function.arguments) as { info?: string };
      if (args.info) {
        appendRecord({
          content: args.info,
          source: "batch-agent",
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

    const outputs = await Promise.all(
      targetSessions.map(async (session) => {
        const result = await invoke<{ stdout: string; stderr: string; exit_code: number }>("exec_command", {
          cmd: command,
          sessionId: session.id,
        });
        const body = [result.stdout.trim(), result.stderr.trim(), `Exit: ${result.exit_code}`].filter(Boolean).join("\n");
        return `[${session.user}@${session.ip}]\n${body || (language === "zh" ? "无输出" : "No output")}`;
      }),
    );

    return {
      role: "tool",
      content: outputs.join("\n\n----------------------------------------\n\n"),
      tool_call_id: toolCall.id,
    } as AIMessage;
  };

  const updateItem = (id: string, updater: (item: BatchItem) => BatchItem) => {
    setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const handleStart = async () => {
    if (running || !aiSettings || !config) {
      return;
    }
    if (!config.apiKey.trim()) {
      setStatus(language === "zh" ? "请先在设置中配置 AI Key。" : "Configure the AI key first.");
      return;
    }

    const questions = questionInput
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (questions.length === 0) {
      setStatus(language === "zh" ? "请先输入至少一个问题。" : "Enter at least one question.");
      return;
    }

    addPromptHistory(questionInput);
    const batchItems: BatchItem[] = questions.map((question) => ({
      id: crypto.randomUUID(),
      question,
      status: "pending",
      messages: [{ role: "user", content: question }],
      answer: "",
      error: "",
    }));

    setItems(batchItems);
    setRunning(true);
    setStatus(language === "zh" ? "批量问答执行中..." : "Running batch QA...");

    const workspaceInfo = buildWorkspacePromptContext(generalInfo, records);
    const serverInfo = buildServerContextSummary(sessions, selectedSessionIds, currentSession);
    const batchContext = buildContextSections([
      { title: "当前任务", content: "主答题面板批量问答" },
      { title: "服务器会话", content: serverInfo },
      { title: "共享线索池", content: workspaceInfo || "暂无" },
      {
        title: "约束",
        content:
          "逐题分析，必要时主动执行只读命令。每一题都给出明确答案。开始前先调用 update_plan 制定共享计划，并在执行过程中更新计划状态。发现可复用线索时，立即调用 update_context_info 保存到共享线索池。",
      },
    ]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const maxConcurrent = Math.max(1, aiSettings.maxConcurrentTasks ?? 3);
      let currentIndex = 0;
      const worker = async () => {
        while (!abortController.signal.aborted) {
          const batchItem = batchItems[currentIndex];
          currentIndex += 1;
          if (!batchItem) {
            return;
          }

          updateItem(batchItem.id, (item) => ({ ...item, status: "running", error: "" }));
          setStatus(
            language === "zh"
              ? `正在处理：${batchItem.question}`
              : `Processing: ${batchItem.question}`,
          );

          try {
            const finalHistory = await runConversationLoop({
              initialHistory: [{ role: "user", content: batchItem.question }],
              settings: aiSettings,
              generalInfo: batchContext,
              signal: abortController.signal,
              executeToolCall: async ({ toolCall }) => executeToolCall(toolCall),
              callbacks: {
                onAssistantMessage: (_, history) => {
                  updateItem(batchItem.id, (item) => ({ ...item, messages: history }));
                },
                onToolResult: (_, __, history) => {
                  updateItem(batchItem.id, (item) => ({ ...item, messages: history }));
                },
                onUsage: (usage) => {
                  onAiSettingsChange?.(applyUsageToSettings(aiSettings, usage));
                },
              },
            });

            updateItem(batchItem.id, (item) => ({
              ...item,
              status: "completed",
              messages: finalHistory,
              answer: extractAnswer(finalHistory),
            }));
          } catch (error) {
            updateItem(batchItem.id, (item) => ({
              ...item,
              status: "error",
              error: String(error),
            }));
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(maxConcurrent, batchItems.length) }, () => worker()));
      finalizeTasks("all");
      setStatus(language === "zh" ? "批量问答执行完成" : "Batch QA completed");
    } finally {
      abortControllerRef.current = null;
      setRunning(false);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setRunning(false);
    setStatus(language === "zh" ? "已停止批量执行" : "Batch execution stopped");
  };

  const summaryText = useMemo(() => {
    if (items.length === 0) {
      return language === "zh" ? "尚未开始批量问答。" : "Batch QA has not started.";
    }
    return language === "zh"
      ? `已完成 ${totalCompleted} / ${items.length} 题`
      : `${totalCompleted} / ${items.length} completed`;
  }, [items.length, language, totalCompleted]);

  const slashCommands = useMemo(
    () => [
      {
        id: "plan",
        command: "/plan",
        title: language === "zh" ? "生成批量计划" : "Create batch plan",
        description: language === "zh" ? "先规划批量问答步骤，再逐题执行" : "Plan the batch workflow before answering",
        insertText:
          language === "zh"
            ? "请先给出一份适用于全部问题的共享计划，再按计划逐题分析并同步状态。"
            : "Create a shared plan for all questions first, then answer each question step by step.",
      },
      {
        id: "web",
        command: "/web",
        title: language === "zh" ? "联网补充资料" : "Search the web",
        description: language === "zh" ? "为整批问题补充公开资料、文档或漏洞说明" : "Gather public references for the batch",
        insertText:
          language === "zh"
            ? "请先联网搜索与这些问题相关的公开资料，再结合搜索结果统一回答。"
            : "Search the public web for references related to these questions before answering them.",
      },
      {
        id: "context",
        command: "/context",
        title: language === "zh" ? "复用共享线索" : "Reuse shared clues",
        description: language === "zh" ? "优先复用共享线索池中的证据回答全部问题" : "Answer from the shared clue pool first",
        insertText:
          language === "zh"
            ? "请先复用共享线索池中的证据回答这些问题，仅在必要时再补充新的验证。"
            : "Reuse the shared clue pool first and only add new verification when necessary.",
      },
      {
        id: "clear",
        command: "/clear",
        title: language === "zh" ? "清空批量结果" : "Clear batch results",
        description: language === "zh" ? "清空问题输入与当前批量结果" : "Clear current input and batch output",
        onSelect: () => {
          setItems([]);
          setQuestionInput("");
          setStatus("");
        },
      },
    ],
    [language],
  );

  return (
    <div className="h-full grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="ui-shell h-full rounded-[2rem] overflow-hidden flex flex-col">
      <WorkspaceHeader
        language={language}
        icon={ListChecks}
        title={language === "zh" ? "主答题面板" : "Main Answer Panel"}
        description={
          language === "zh"
            ? "批量传入问题，逐条输出答案与可见思考流程。"
            : "Send multiple questions and get answers with visible execution flow."
        }
        aiSettings={aiSettings!}
        sessionInfo={
          currentSession
            ? `${currentSession.user}@${currentSession.ip}`
            : language === "zh"
              ? "未连接 SSH 会话"
              : "No SSH session"
        }
        extraItems={[
          { label: language === "zh" ? "并发" : "Concurrency", value: String(aiSettings?.maxConcurrentTasks ?? 3) },
          { label: language === "zh" ? "任务" : "Tasks", value: String(tasks.length) },
          { label: language === "zh" ? "线索" : "Clues", value: String(records.length) },
          { label: language === "zh" ? "会话标题" : "Session", value: `${sessionTitle} · ${language === "zh" ? "批量模式" : "Batch Mode"}` },
        ]}
        actions={
          <>
            {running && (
              <motion.button
                onClick={handleStop}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                className="ui-button-danger ui-pressable rounded-2xl px-4 py-2.5 text-sm font-medium text-amber-700"
              >
                <Square size={16} />
                {language === "zh" ? "停止" : "Stop"}
              </motion.button>
            )}
            <motion.button
              onClick={() => {
                setItems([]);
                setQuestionInput("");
                setStatus("");
              }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              className="ui-button ui-pressable rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-600"
            >
              <Trash2 size={16} />
              {language === "zh" ? "清空" : "Clear"}
            </motion.button>
          </>
        }
      />
      <div className="px-5 py-4 md:px-6">
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
          <textarea
            value={questionInput}
            onChange={(event) => setQuestionInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Tab" && questionInput.trim().startsWith("/")) {
                const completion = getSlashCommandCompletion(questionInput, slashCommands);
                if (completion) {
                  event.preventDefault();
                  setQuestionInput(completion);
                }
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && questionInput.trim().startsWith("/")) {
                event.preventDefault();
                const exactCommand = getExactSlashCommand(questionInput, slashCommands);
                if (exactCommand) {
                  if (exactCommand.onSelect) {
                    exactCommand.onSelect();
                  } else {
                    setQuestionInput(exactCommand.insertText || exactCommand.command);
                  }
                }
              }
            }}
            placeholder={
              language === "zh"
                ? "每行一个问题，或输入 / 打开命令面板，例如：\n当前服务器主要业务是什么？\n网站配置文件在哪里？\n数据库管理员账号有哪些？"
                : "One question per line, or type / to open the command palette."
            }
            className="ui-input-base min-h-[132px] resize-none rounded-[1.7rem] px-4 py-3 text-sm text-slate-700"
          />
          <div className="ui-subtle-surface rounded-[1.7rem] p-4 flex flex-col justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">{summaryText}</div>
              <div className="mt-2 text-sm text-slate-500">{status || (language === "zh" ? "等待开始" : "Waiting")}</div>
            </div>
            <motion.button
              onClick={() => void handleStart()}
              disabled={running || !questionInput.trim() || questionInput.trim().startsWith("/")}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              className="ui-button-primary ui-pressable mt-4 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-white disabled:bg-slate-300 disabled:border-slate-300"
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {language === "zh" ? "开始批量问答" : "Start Batch"}
            </motion.button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {batchPromptPresets[language].map((prompt) => (
            <motion.button
              key={prompt}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => setQuestionInput((prev) => (prev ? `${prev}\n${prompt}` : prompt))}
              className="ui-chip ui-pressable rounded-2xl px-3 py-2 text-sm text-slate-600"
            >
              <span className="inline-flex items-center gap-2">
                <Wand2 size={14} />
                {prompt}
              </span>
            </motion.button>
          ))}
        </div>
        <SlashCommandMenu
          language={language}
          input={questionInput}
          commands={slashCommands}
          onUse={(command) => {
            if (command.onSelect) {
              command.onSelect();
              return;
            }
            setQuestionInput(command.insertText || "");
          }}
        />
      </div>

      <div className="flex-1 overflow-auto bg-slate-50/40 px-4 py-4 md:px-6 md:py-5 space-y-4">
        {items.length === 0 && (
          <div className="ui-surface rounded-[1.7rem] border-dashed px-6 py-10 text-center text-slate-500">
            {language === "zh"
              ? "批量问题会在这里展示答案。每一题都能看到执行过程与最终结果。"
              : "Batch answers will appear here with their visible process."}
          </div>
        )}
        {items.map((item) => {
          const displayItems = buildDisplayItems(item.messages);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onDoubleClick={() => setPreview({ title: item.question, content: item.answer || item.error || item.question })}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({
                  x: event.clientX,
                  y: event.clientY,
                  actions: [
                    {
                      label: language === "zh" ? "查看详情" : "Preview",
                      onClick: () => setPreview({ title: item.question, content: item.answer || item.error || item.question }),
                    },
                    {
                      label: language === "zh" ? "复制问题" : "Copy Question",
                      onClick: () => void navigator.clipboard.writeText(item.question),
                    },
                    ...(item.answer
                      ? [
                          {
                            label: language === "zh" ? "复制答案" : "Copy Answer",
                            onClick: () => void navigator.clipboard.writeText(item.answer),
                          },
                        ]
                      : []),
                  ],
                });
              }}
              className="ui-surface rounded-[1.7rem] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {language === "zh" ? "问题" : "Question"}
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900">{item.question}</div>
                </div>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm font-medium ${
                    item.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : item.status === "error"
                        ? "bg-rose-50 text-rose-700"
                        : item.status === "running"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.status === "completed"
                    ? language === "zh"
                      ? "已完成"
                      : "Completed"
                    : item.status === "error"
                      ? language === "zh"
                        ? "失败"
                        : "Error"
                      : item.status === "running"
                        ? language === "zh"
                          ? "处理中"
                          : "Running"
                        : language === "zh"
                          ? "排队中"
                          : "Pending"}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {displayItems.map((displayItem, index) =>
                  displayItem.type === "thinking" ? (
                    <ThinkingProcess
                      key={`thinking-${index}`}
                      steps={displayItem.steps}
                      isFinished={displayItem.isFinished}
                      language={language}
                    />
                  ) : (
                    displayItem.message.role !== "user" && (
                      <ChatTranscriptMessage key={`message-${index}`} message={displayItem.message} language={language} />
                    )
                  ),
                )}
                {item.answer && (
                  <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50/95 px-4 py-3 shadow-[0_18px_30px_-24px_rgba(16,185,129,0.35)]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 size={16} />
                      {language === "zh" ? "最终答案" : "Final Answer"}
                    </div>
                    <div className="mt-2 prose prose-sm max-w-none text-slate-700">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.answer}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {item.error && <div className="text-sm text-rose-600">{item.error}</div>}
              </div>
            </motion.div>
          );
        })}
      </div>
      </div>
      <aside className="custom-scrollbar max-h-full overflow-auto pr-1 space-y-4">
        <PlannerPanel
          language={language}
          tasks={tasks}
          onClear={() => clearTasks()}
          onUpdateTaskStatus={updateTaskStatus}
          onRemoveTask={removeTask}
        />
        <PromptDeck
          language={language}
          title={language === "zh" ? "批量提示词库" : "Batch Prompt Deck"}
          promptHistory={promptHistory}
          promptSnippets={promptSnippets}
          currentInput={questionInput}
          onUsePrompt={(value) => setQuestionInput((prev) => (prev ? `${prev}\n${value}` : value))}
          onSaveCurrent={() => savePromptSnippet({ content: questionInput, pinned: false })}
          onSaveHistoryPrompt={(value) => savePromptSnippet({ content: value, pinned: false })}
          onRemoveSnippet={removePromptSnippet}
          onTogglePin={togglePromptSnippetPin}
        />
      </aside>
      <FloatingContextMenu menu={menu} onClose={() => setMenu(null)} />
      {preview && <PreviewDialog title={preview.title} content={preview.content} onClose={() => setPreview(null)} />}
    </div>
  );
}
