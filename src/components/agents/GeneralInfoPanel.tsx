import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { Cpu, Database, Globe, Loader2, Send, Square, Trash2 } from "lucide-react";
import { Language } from "../../translations";
import { AIMessage, AISettings, ToolCall, buildServerForensicsToolExecution, buildToolDisplayText, shouldTreatAssistantMessageAsThinking } from "../../lib/ai";
import { buildContextSections, buildServerContextSummary, buildWorkspacePromptContext } from "../../lib/aiContext";
import { applyUsageToSettings, runConversationLoop } from "../../lib/aiRuntime";
import { executeResearchTool } from "../../lib/aiResearchTools";
import { useAIWorkspaceStore } from "../../lib/aiWorkspaceStore";
import { useCommandStore } from "../../store/CommandContext";
import ThinkingProcess, { ThinkingStep } from "./ThinkingProcess";
import { ChatTranscriptMessage } from "./ChatTranscriptMessage";
import {
  FloatingContextMenu,
  PlannerPanel,
  PreviewDialog,
  PromptDeck,
  SlashCommandMenu,
  WorkspaceHeader,
  getSlashCommandCompletion,
  resolveSlashCommandInput,
} from "./WorkbenchWidgets";

interface GeneralInfoPanelProps {
  language: Language;
  generalInfo: string;
  setGeneralInfo: (info: string | ((prev: string) => string)) => void;
  aiSettings: AISettings;
  onAiSettingsChange?: (settings: AISettings) => void;
}

type DisplayItem =
  | { type: "message"; message: AIMessage }
  | { type: "thinking"; steps: ThinkingStep[]; isFinished: boolean };

interface RemoteSession {
  id: string;
  ip: string;
  user: string;
}

interface QuickAction {
  id: string;
  icon: typeof Cpu;
  title: { zh: string; en: string };
  desc: { zh: string; en: string };
  prompt: string;
}

const quickActions: QuickAction[] = [
  {
    id: "system",
    icon: Cpu,
    title: { zh: "自动获取系统信息", en: "Auto System Info" },
    desc: { zh: "主机、账号、进程、网络与版本信息", en: "Host, accounts, processes and version info" },
    prompt: `你现在负责自动获取系统关键信息。
只做只读分析，目标是收集：
1. 操作系统版本、内核、主机名、时间与时区
2. 当前登录用户、可登录用户、sudo 权限
3. 关键进程、监听端口、已建立连接
4. 机器用途判断所需的核心证据

优先使用简洁命令，避免高负载扫描。
完成后输出结构化结论，并将关键事实调用 update_context_info 沉淀到共享线索池。`,
  },
  {
    id: "web",
    icon: Globe,
    title: { zh: "自动获取网站配置", en: "Auto Web Config" },
    desc: { zh: "Nginx/Apache/Tomcat/站点目录/配置文件", en: "Nginx, Apache, Tomcat and site paths" },
    prompt: `你现在负责自动获取网站配置信息。
只做只读分析，目标是收集：
1. 正在运行的 Web 中间件与端口
2. 主要配置文件位置
3. 站点根目录、虚拟主机、反向代理关系
4. 应用框架、JAR/WAR、PHP 站点或容器线索

优先定位真实有效的配置路径与业务入口。
完成后输出结构化结论，并将关键路径、配置和访问入口调用 update_context_info 沉淀到共享线索池。`,
  },
  {
    id: "database",
    icon: Database,
    title: { zh: "自动获取数据库账号", en: "Auto DB Credentials" },
    desc: { zh: "应用配置中的数据库主机、端口、用户名与密码", en: "DB host, port, username and password from configs" },
    prompt: `你现在负责自动获取数据库账号信息。
只做只读分析，目标是收集：
1. 应用配置文件中的数据库连接串
2. MySQL/PostgreSQL/Redis 等服务配置中的账号信息
3. .env、application.yml、properties、php 配置中的凭据
4. 连接目标主机、端口、数据库名与中间件类型

必须优先从实际配置中提取证据，禁止凭空猜测。
完成后输出结构化结论，并将可复用的数据库凭据调用 update_context_info 沉淀到共享线索池。`,
  },
];

function byLanguage(language: Language, text: { zh: string; en: string }) {
  return language === "zh" ? text.zh : text.en;
}

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

export default function GeneralInfoPanel({
  language,
  generalInfo,
  aiSettings,
  onAiSettingsChange,
}: GeneralInfoPanelProps) {
  const { currentSession, sessions, selectedSessionIds } = useCommandStore();
  const records = useAIWorkspaceStore((state) => state.records);
  const tasks = useAIWorkspaceStore((state) => state.tasks);
  const promptHistory = useAIWorkspaceStore((state) => state.promptHistory);
  const promptSnippets = useAIWorkspaceStore((state) => state.promptSnippets);
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
  const removeRecord = useAIWorkspaceStore((state) => state.removeRecord);
  const clearRecords = useAIWorkspaceStore((state) => state.clearRecords);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [cluePreview, setCluePreview] = useState<{ title: string; content: string } | null>(null);
  const [clueMenu, setClueMenu] = useState<{ x: number; y: number; actions: Array<{ label: string; onClick: () => void; danger?: boolean }> } | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);
  const config = aiSettings.configs[aiSettings.activeProvider];

  const executeToolCall = async (toolCall: ToolCall) => {
    if (toolCall.function.name === "update_context_info") {
      const args = JSON.parse(toolCall.function.arguments) as { info?: string };
      if (args.info) {
        appendRecord({
          content: args.info,
          source: "system",
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

    const resultBlocks = await Promise.all(
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
      content: limitOutput(resultBlocks.join("\n\n----------------------------------------\n\n")),
      tool_call_id: toolCall.id,
    } as AIMessage;
  };

  const runCollectionPrompt = async (prompt: string, actionId?: string, displayText?: string, historyText?: string) => {
    if (loading) {
      return;
    }
    if (!config.apiKey.trim()) {
      setStatus(language === "zh" ? "请先在设置中配置 AI Key。" : "Configure the AI key first.");
      return;
    }
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      return;
    }

    const baseMessage: AIMessage = {
      role: "user",
      content: normalizedPrompt,
      uiContent: displayText,
    };
    const nextHistory = [baseMessage];
    addPromptHistory((historyText || normalizedPrompt).trim());
    setMessages(nextHistory);
    setLoading(true);
    setActiveActionId(actionId || "manual");
    setStatus(language === "zh" ? "正在自动采集关键上下文..." : "Collecting key context...");

    const serverInfo = buildServerContextSummary(sessions, selectedSessionIds, currentSession);
    const workspaceInfo = buildWorkspacePromptContext(generalInfo, records);
    const actionTitle = quickActions.find((item) => item.id === actionId)?.title;
    const context = buildContextSections([
      { title: "当前任务", content: `上下文面板自动采集：${actionTitle ? byLanguage(language, actionTitle) : language === "zh" ? "自定义采集" : "Custom collection"}` },
      { title: "服务器会话", content: serverInfo },
      { title: "共享线索池", content: workspaceInfo || "暂无" },
      {
        title: "约束",
        content: "仅保留系统信息、网站配置、数据库账号这三类关键事实。先调用 update_plan 输出计划，再精炼执行，并及时调用 update_context_info 保存有用结论。",
      },
    ]);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const finalHistory = await runConversationLoop({
        initialHistory: nextHistory,
        settings: aiSettings,
        generalInfo: context,
        signal: abortController.signal,
        executeToolCall: async ({ toolCall }) => executeToolCall(toolCall),
        callbacks: {
          onAssistantMessage: (_, history) => setMessages(history),
          onToolResult: (_, __, history) => {
            setMessages(history);
            setStatus(language === "zh" ? "正在归纳有效信息..." : "Summarizing useful findings...");
          },
          onUsage: (usage) => {
            onAiSettingsChange?.(applyUsageToSettings(aiSettings, usage));
          },
        },
      });
      setMessages(finalHistory);
      finalizeTasks("all");
      setStatus(language === "zh" ? "采集完成" : "Done");
      queueMicrotask(() => {
        listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    } catch (error) {
      setStatus(String(error));
    } finally {
      setLoading(false);
      setActiveActionId(null);
      abortControllerRef.current = null;
    }
  };

  const runQuickAction = async (action: QuickAction) => {
    await runCollectionPrompt(action.prompt, action.id);
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setActiveActionId(null);
    setStatus(language === "zh" ? "已停止采集" : "Collection stopped");
  };

  const slashCommands = useMemo(
    () => [
      {
        id: "database",
        command: "/database",
        title: language === "zh" ? "采集数据库账号" : "Collect DB credentials",
        description: language === "zh" ? "提取配置中的数据库主机、账号、密码等线索" : "Extract DB hosts, accounts and secrets from configs",
        onSelect: () => {
          void runQuickAction(quickActions[2]);
          setInput("");
        },
      },
      {
        id: "search",
        command: "/search",
        title: language === "zh" ? "搜索网页资料" : "Search the web",
        description: language === "zh" ? "搜索公开网页、文档或公告后再继续采集" : "Search public pages before continuing collection",
        insertText:
          language === "zh"
            ? "请先搜索与当前服务器、网站组件或数据库配置有关的网页资料，再结合采集结果分析。"
            : "Search public pages related to this server, web stack or database configuration before analyzing the collected evidence.",
      },
      {
        id: "plan",
        command: "/plan",
        title: language === "zh" ? "先生成采集计划" : "Create collection plan",
        description: language === "zh" ? "先规划采集步骤，再执行只读验证" : "Plan the collection workflow first",
        insertText:
          language === "zh"
            ? "请先给出一份上下文采集计划，再按计划收集系统信息、网站配置和数据库凭据。"
            : "Create a context collection plan first, then gather system, web and database evidence step by step.",
      },
      {
        id: "clear",
        command: "/clear",
        title: language === "zh" ? "清空当前结果" : "Clear results",
        description: language === "zh" ? "清空采集结果与输入框，保留工作台数据" : "Clear results and input while keeping workspace data",
        onSelect: () => {
          setMessages([]);
          setInput("");
          setStatus("");
        },
      },
    ],
    [language],
  );
  const resolvedSlashInput = useMemo(() => resolveSlashCommandInput(input, slashCommands), [input, slashCommands]);
  const canSend = !!input.trim() && !loading && (!input.trim().startsWith("/") || !!resolvedSlashInput.matchedCommand);

  const handleSend = async (rawInput = input) => {
    const trimmedInput = rawInput.trim();
    if (loading || !trimmedInput) {
      return;
    }

    const resolvedSlash = resolveSlashCommandInput(trimmedInput, slashCommands);
    if (trimmedInput.startsWith("/") && !resolvedSlash.matchedCommand) {
      return;
    }
    if (resolvedSlash.shouldExecuteImmediately && resolvedSlash.matchedCommand?.onSelect) {
      resolvedSlash.matchedCommand.onSelect();
      return;
    }

    const prompt = resolvedSlash.sendText ?? trimmedInput;
    setInput("");
    await runCollectionPrompt(prompt, undefined, resolvedSlash.displayText ?? trimmedInput, trimmedInput);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ scope?: string; type?: string; value?: string }>;
      if (customEvent.detail?.scope !== "agent-context") {
        return;
      }

      if (customEvent.detail.type === "append-input" && customEvent.detail.value) {
        setInput((current) => `${current}${current.trim() ? "\n" : ""}${customEvent.detail?.value}`);
      }

      if (customEvent.detail.type === "clear-input") {
        setInput("");
      }

      if (customEvent.detail.type === "send-input") {
        void handleSend();
      }
    };

    window.addEventListener("fuxi-scope-context-action", handler as EventListener);
    return () => window.removeEventListener("fuxi-scope-context-action", handler as EventListener);
  }, [handleSend]);

  return (
    <div className="h-full grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="ui-shell order-1 min-h-0 rounded-[2rem] flex flex-col overflow-hidden" data-context-scope="agent-context">
        <WorkspaceHeader
          language={language}
          icon={Cpu}
          title={language === "zh" ? "上下文面板" : "Context Panel"}
          description={
            language === "zh"
              ? "一键采集系统信息、网站配置和数据库账号，并同步沉淀共享线索。"
              : "Collect system, web and database evidence and retain it as shared clues."
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
            { label: language === "zh" ? "任务" : "Tasks", value: String(tasks.length) },
            { label: language === "zh" ? "会话" : "Sessions", value: String(selectedSessionIds.length || (currentSession ? 1 : 0)) },
          ]}
          actions={
            <>
              {loading && (
                <motion.button
                  onClick={handleStop}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  className="ui-button-danger ui-pressable rounded-2xl px-4 py-2.5 text-sm font-medium"
                >
                  <Square size={16} />
                  {language === "zh" ? "停止" : "Stop"}
                </motion.button>
              )}
              <motion.button
                onClick={() => {
                  setMessages([]);
                  setInput("");
                  setStatus("");
                }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                className="ui-button ui-pressable rounded-2xl px-4 py-2.5 text-sm text-slate-600"
              >
                <Trash2 size={15} />
                {language === "zh" ? "清空" : "Clear"}
              </motion.button>
            </>
          }
        />

        <div className="flex-1 min-h-0 overflow-auto bg-slate-50/40 px-4 py-4 md:px-6 md:py-5">
          <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const isActive = activeActionId === action.id;
              return (
                <motion.button
                  key={action.id}
                  onClick={() => void runQuickAction(action)}
                  disabled={loading}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.985 }}
                  className={`ui-hover-lift ui-pressable rounded-[1.5rem] p-4 text-left transition-all ${
                    isActive ? "ui-chip-active" : "ui-surface"
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-[0_16px_28px_-22px_rgba(37,99,235,0.45)]">
                      {isActive ? <Loader2 size={17} className="animate-spin" /> : <Icon size={17} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{byLanguage(language, action.title)}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{byLanguage(language, action.desc)}</div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
          {messages.length === 0 && (
            <div className="ui-surface rounded-[1.7rem] border-dashed px-6 py-10 text-center text-slate-500">
              {language === "zh"
                ? "点击上方任一动作后，AI 会自动读取关键证据、展示思考流程，并将有效线索沉淀到共享线索池。"
                : "Start a quick action to collect evidence, show the process and retain useful clues."}
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
            {status && (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 font-mono text-[11px] text-slate-500 shadow-[0_18px_34px_-32px_rgba(15,23,42,0.55)]">
                <span className={`h-2 w-2 rounded-full ${loading ? "bg-blue-500 animate-pulse" : "bg-slate-400"}`} />
                {loading && <Loader2 size={13} className="animate-spin" />}
                {status}
              </div>
            )}
            <div ref={listEndRef} />
          </div>
        </div>
        <div className="sticky bottom-0 z-20 border-t border-slate-200/70 bg-white/78 p-4 backdrop-blur-xl">
          <div className="ui-subtle-surface rounded-[1.8rem] border border-white/70 bg-white/90 p-3 shadow-[0_30px_60px_-34px_rgba(15,23,42,0.26)] sm:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{language === "zh" ? "自定义采集指令" : "Custom Collection Prompt"}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {language === "zh"
                    ? "输入自定义采集目标，或使用 / 打开命令面板。"
                    : "Type a custom collection goal or use / to open the command palette."}
                </div>
              </div>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => void handleSend()}
                disabled={!canSend}
                className="ui-button-primary ui-pressable inline-flex items-center justify-center gap-2 rounded-[1.2rem] px-4 py-2.5 text-sm font-medium disabled:bg-slate-300 disabled:border-slate-300 sm:self-start"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {language === "zh" ? "开始采集" : "Run"}
              </motion.button>
            </div>
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
                  void handleSend();
                }
              }}
              placeholder={
                language === "zh"
                  ? "例如：请先给出一份采集计划，再自动收集当前服务器的网站配置和数据库连接信息。"
                  : "Example: create a collection plan first, then gather web config and database connection evidence."
              }
              className="ui-input-base min-h-[104px] w-full resize-none rounded-[1.4rem] border-white/0 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 shadow-inner"
            />
            <SlashCommandMenu
              language={language}
              input={input}
              commands={slashCommands}
              onUse={(command) => {
                if (command.onSelect) {
                  command.onSelect();
                  return;
                }
                setInput(command.command);
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
          title={language === "zh" ? "上下文提示词库" : "Context Prompt Deck"}
          promptHistory={promptHistory}
          promptSnippets={promptSnippets}
          currentInput={input}
          onUsePrompt={(value) => setInput(value)}
          onSaveCurrent={() => savePromptSnippet({ content: input, pinned: false })}
          onSaveHistoryPrompt={(value) => savePromptSnippet({ content: value, pinned: false })}
          onRemoveSnippet={removePromptSnippet}
          onTogglePin={togglePromptSnippetPin}
        />
        <div className="ui-shell min-h-0 rounded-[2rem] overflow-hidden flex flex-col">
        <div className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {language === "zh" ? "共享线索池" : "Shared Clue Pool"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {language === "zh" ? "仅保留对后续分析有价值的关键信息。" : "Only keep findings useful for later analysis."}
              </p>
            </div>
            <motion.button
              onClick={() => clearRecords()}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              className="ui-button ui-pressable rounded-2xl px-3 py-2 text-sm text-slate-600"
            >
              <Trash2 size={15} />
              {language === "zh" ? "清空" : "Clear"}
            </motion.button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {records.length === 0 && (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500">
              {language === "zh" ? "暂无线索。" : "No clues yet."}
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
                      label: language === "zh" ? "删除线索" : "Delete",
                      onClick: () => removeRecord(record.id),
                      danger: true,
                    },
                  ],
                });
              }}
              className="ui-subtle-surface rounded-[1.4rem] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{record.title}</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{record.content}</div>
                </div>
                <motion.button
                  onClick={() => removeRecord(record.id)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="ui-button ui-pressable rounded-xl p-2 text-slate-500"
                >
                  <Trash2 size={15} />
                </motion.button>
              </div>
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
