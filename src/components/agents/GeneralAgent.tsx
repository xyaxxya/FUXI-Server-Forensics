import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { Bot, BookOpenText, BrainCircuit, ClipboardList, FileSearch, Loader2, Send, Square, Trash2, Wand2 } from "lucide-react";
import { useCommandStore } from "../../store/CommandContext";
import { AIMessage, AISettings, ToolCall, buildServerForensicsToolExecution, buildToolDisplayText, shouldTreatAssistantMessageAsThinking } from "../../lib/ai";
import { buildContextSections, buildServerContextSummary, buildWorkspacePromptContext } from "../../lib/aiContext";
import { applyUsageToSettings, runConversationLoop } from "../../lib/aiRuntime";
import { executeResearchTool } from "../../lib/aiResearchTools";
import { useAIWorkspaceStore } from "../../lib/aiWorkspaceStore";
import { Language } from "../../translations";
import { SKILL_REGISTRY, buildSkillPackPrompt, detectAutoSkillRouting, getSkillById, getSkillsByIds } from "../../skills/registry";
import { ChatTranscriptMessage } from "./ChatTranscriptMessage";
import ThinkingProcess, { ThinkingStep } from "./ThinkingProcess";
import SkillPanel from "./SkillPanel";
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

type InspectorTab = "skills" | "plan" | "prompts" | "clues";

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
  const manualSkillIds = useAIWorkspaceStore((state) => state.manualSkillIds);
  const autoSkillIds = useAIWorkspaceStore((state) => state.autoSkillIds);
  const activeSkillIds = useAIWorkspaceStore((state) => state.activeSkillIds);
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
  const setAutoSkillIds = useAIWorkspaceStore((state) => state.setAutoSkillIds);
  const enableSkill = useAIWorkspaceStore((state) => state.enableSkill);
  const toggleSkill = useAIWorkspaceStore((state) => state.toggleSkill);
  const clearManualSkills = useAIWorkspaceStore((state) => state.clearManualSkills);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [cluePreview, setCluePreview] = useState<{ title: string; content: string } | null>(null);
  const [clueMenu, setClueMenu] = useState<{ x: number; y: number; actions: Array<{ label: string; onClick: () => void; danger?: boolean }> } | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("skills");
  const abortControllerRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);
  const config = aiSettings.configs[aiSettings.activeProvider];
  const activeSkills = useMemo(() => getSkillsByIds(activeSkillIds), [activeSkillIds]);
  const activeSkillNames = useMemo(() => activeSkills.map((skill) => skill.name.zh), [activeSkills]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [displayItems.length, loading, messages.length, status]);

  useEffect(() => {
    const routing = detectAutoSkillRouting(messages, generalInfo);
    setAutoSkillIds(routing.selectedSkillIds);
  }, [generalInfo, messages, setAutoSkillIds]);

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
            cmd: command,
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

  const enableSkillFromQuery = useCallback((value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    const matchedSkill = SKILL_REGISTRY.find((skill) => {
      const fields = [skill.id, skill.name.zh, skill.name.en, ...skill.triggers].join(" ").toLowerCase();
      return fields.includes(normalized) || normalized.includes(skill.id.toLowerCase());
    }) || null;
    if (matchedSkill) {
      enableSkill(matchedSkill.id);
      setInput(language === "zh" ? `请调用 ${matchedSkill.name.zh} 技能继续分析。` : `Use the ${matchedSkill.name.en} skill to continue the investigation.`);
      setStatus(language === "zh" ? `已启用技能：${matchedSkill.name.zh}` : `Enabled skill: ${matchedSkill.name.en}`);
      return true;
    }
    setStatus(language === "zh" ? `未找到匹配技能：${value}` : `No matching skill: ${value}`);
    return false;
  }, [enableSkill, language]);

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
        id: "search",
        command: "/search",
        title: language === "zh" ? "搜索网页资料" : "Search the web",
        description: language === "zh" ? "主动搜索公开网页、文档、公告或漏洞说明" : "Search public pages, docs, advisories or vulnerability references",
        insertText: language === "zh" ? "请先搜索相关网页资料，并基于搜索结果给我结论。" : "Search relevant web pages first and answer from those results.",
      },
      {
        id: "context",
        command: "/context",
        title: language === "zh" ? "基于共享线索继续分析" : "Use shared clue pool",
        description: language === "zh" ? "优先复用共享线索池中的内容继续分析" : "Continue analysis from the shared clue pool first",
        insertText: language === "zh" ? "请先基于共享线索池中的内容继续推理，并告诉我下一步最值得验证的点。" : "Use the shared clue pool first and tell me the next best evidence to verify.",
      },
      {
        id: "skills",
        command: "/skills",
        title: language === "zh" ? "查看可调用技能" : "Show callable skills",
        description: language === "zh" ? "列出当前技能运行时、自动路由与手动技能" : "List runtime skills, auto routing and manual skills",
        insertText:
          language === "zh"
            ? `请说明当前可调用技能、已自动路由技能、手动启用技能，并建议下一步应该调用哪些技能。当前启用：${activeSkillNames.join("、") || "暂无"}`
            : `Explain callable skills, auto-routed skills, manual skills, and suggest what to invoke next. Active: ${activeSkillNames.join(", ") || "none"}`,
      },
      {
        id: "skill",
        command: "/skill",
        title: language === "zh" ? "按名称启用技能" : "Enable Skill By Name",
        description: language === "zh" ? "用法：/skill webshell、/skill mysql、/skill docker" : "Usage: /skill webshell, /skill mysql, /skill docker",
        insertText: language === "zh" ? "请说明我想调用哪个技能，并给出可用技能名称。" : "Ask which skill to invoke and list available skill names.",
      },
      {
        id: "skill-webshell",
        command: "/skill webshell",
        title: language === "zh" ? "启用 Webshell 排查" : "Enable Webshell Hunting",
        description: language === "zh" ? "手动启用 Webshell 排查技能" : "Manually enable the webshell hunting skill",
        onSelect: () => {
          enableSkill("webshell_hunting");
          setInput(language === "zh" ? "请调用 Webshell 排查技能，围绕网站目录、上传点和近期变更文件进行分析。" : "Use the Webshell Hunting skill to analyze web roots, upload paths and recent file changes.");
        },
      },
      {
        id: "skill-springboot",
        command: "/skill springboot",
        title: language === "zh" ? "启用 SpringBoot" : "Enable SpringBoot",
        description: language === "zh" ? "手动启用 SpringBoot 与 Java 运行时技能" : "Manually enable SpringBoot and Java runtime skills",
        onSelect: () => {
          enableSkill("springboot_forensics");
          enableSkill("java_runtime");
          setInput(language === "zh" ? "请调用 SpringBoot 技能，识别 Actuator、profiles、配置来源、数据源和异常定时任务。" : "Use the SpringBoot skill to inspect Actuator, profiles, config sources, datasources and suspicious schedules.");
        },
      },
      {
        id: "triage",
        command: "/triage",
        title: language === "zh" ? "启动初始排查" : "Start Triage",
        description: language === "zh" ? "启用 Linux 基线、Web 服务与证据整理技能" : "Enable Linux baseline, web middleware and evidence summary skills",
        onSelect: () => {
          enableSkill("linux_baseline");
          enableSkill("web_middleware");
          enableSkill("evidence_summary");
          setInput(language === "zh" ? "请启动初始排查：先建立调查计划，再采集系统基线、Web 服务信息和关键证据。" : "Start initial triage: create a plan, collect system baseline, web service details and key evidence.");
        },
      },
      {
        id: "report",
        command: "/report",
        title: language === "zh" ? "生成事件报告" : "Generate Report",
        description: language === "zh" ? "启用事件报告和证据整理技能" : "Enable incident report and evidence summary skills",
        onSelect: () => {
          enableSkill("incident_report");
          enableSkill("evidence_summary");
          setInput(language === "zh" ? "请基于共享线索池生成事件报告，包含执行摘要、时间线、证据、影响评估、未确认假设和后续建议。" : "Generate an incident report from the shared clue pool with summary, timeline, evidence, impact, assumptions and recommendations.");
        },
      },
      {
        id: "evidence",
        command: "/evidence",
        title: language === "zh" ? "整理证据" : "Summarize Evidence",
        description: language === "zh" ? "把共享线索整理为事实、假设、IOC 和下一步" : "Turn shared clues into facts, hypotheses, IOCs and next steps",
        onSelect: () => {
          enableSkill("evidence_summary");
          setInput(language === "zh" ? "请整理共享线索池：区分已证实事实、合理假设、待验证问题、IOC、MITRE 映射和下一步采集动作。" : "Summarize the shared clue pool into facts, hypotheses, open questions, IOCs, MITRE mapping and next collection steps.");
        },
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
    [activeSkillNames, enableSkill, handleClear, language],
  );
  const resolvedSlashInput = useMemo(() => resolveSlashCommandInput(input, slashCommands), [input, slashCommands]);
  const canSend = !!input.trim() && !loading && (!input.trim().startsWith("/") || !!resolvedSlashInput.matchedCommand);

  const handleSend = async (rawInput = input) => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput || loading) {
      return;
    }
    if (!config.apiKey.trim()) {
      setStatus(language === "zh" ? "请先在设置中配置 AI Key。" : "Configure the AI key first.");
      return;
    }

    const resolvedSlash = resolveSlashCommandInput(trimmedInput, slashCommands);
    if (trimmedInput.startsWith("/") && !resolvedSlash.matchedCommand) {
      return;
    }
    if (resolvedSlash.matchedCommand?.id === "skill" && resolvedSlash.bodyText) {
      enableSkillFromQuery(resolvedSlash.bodyText);
      return;
    }
    if (resolvedSlash.shouldExecuteImmediately && resolvedSlash.matchedCommand?.onSelect) {
      resolvedSlash.matchedCommand.onSelect();
      return;
    }

    const prompt = resolvedSlash.sendText ?? trimmedInput;

    const nextUserMessage: AIMessage = {
      role: "user",
      content: prompt,
      uiContent: resolvedSlash.displayText ?? trimmedInput,
    };
    addPromptHistory(trimmedInput);
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
      {
        title: "当前启用技能",
        content: activeSkillIds.length > 0 ? buildSkillPackPrompt(activeSkillIds, language) : "暂无手动或自动启用技能。",
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

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ scope?: string; type?: string; value?: string }>;
      if (customEvent.detail?.scope !== "agent-general") {
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
      <section className="ui-shell order-1 min-h-0 rounded-[2rem] flex flex-col overflow-hidden" data-context-scope="agent-general">
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
            { label: language === "zh" ? "技能" : "Skills", value: String(activeSkillIds.length) },
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
          <div className="mb-4 rounded-[1.5rem] border border-slate-200/70 bg-white/82 p-3 shadow-[0_22px_48px_-38px_rgba(15,23,42,0.45)]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                <BrainCircuit size={14} />
                {language === "zh" ? "当前技能" : "Active Skills"}
              </div>
              <button onClick={() => setActiveInspectorTab("skills")} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                {language === "zh" ? "管理技能" : "Manage"}
              </button>
            </div>
            {activeSkills.length === 0 ? (
              <div className="text-sm text-slate-500">
                {language === "zh" ? "输入 /triage 或在右侧技能页启用技能。" : "Type /triage or enable skills from the right panel."}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeSkills.slice(0, 8).map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => setInput(language === "zh" ? `请调用 ${skill.name.zh} 技能继续分析。` : `Use the ${skill.name.en} skill to continue the investigation.`)}
                    className={`rounded-2xl px-3 py-1.5 text-xs font-semibold ${manualSkillIds.includes(skill.id) ? "bg-slate-900 text-white" : "border border-blue-100 bg-blue-50 text-blue-700"}`}
                  >
                    {language === "zh" ? skill.name.zh : skill.name.en}
                  </button>
                ))}
                {activeSkills.length > 8 && <span className="rounded-2xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500">+{activeSkills.length - 8}</span>}
              </div>
            )}
          </div>

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
                    void handleSend();
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
                disabled={!canSend}
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
                setInput(command.command);
              }}
            />
          </div>
        </div>
      </section>

      <aside className="order-2 min-h-0 overflow-hidden rounded-[2rem] border border-white/70 bg-white/76 shadow-[0_30px_80px_-52px_rgba(15,23,42,0.45)] backdrop-blur-xl flex flex-col">
        <div className="border-b border-slate-200/70 p-3">
          <div className="grid grid-cols-4 gap-1 rounded-[1.2rem] bg-slate-100/70 p-1">
            {[
              { id: "skills" as const, label: language === "zh" ? "技能" : "Skills", icon: BrainCircuit, count: activeSkillIds.length },
              { id: "plan" as const, label: language === "zh" ? "计划" : "Plan", icon: ClipboardList, count: tasks.length },
              { id: "prompts" as const, label: language === "zh" ? "提示" : "Prompts", icon: BookOpenText, count: promptSnippets.length },
              { id: "clues" as const, label: language === "zh" ? "线索" : "Clues", icon: FileSearch, count: records.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeInspectorTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveInspectorTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-[0.95rem] px-2 py-2 text-xs font-semibold transition ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <span className="inline-flex items-center gap-1">
                    <Icon size={14} />
                    {tab.label}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-slate-900 text-white" : "bg-white/80 text-slate-500"}`}>{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-auto p-3">
          {activeInspectorTab === "skills" && (
            <SkillPanel
              language={language}
              activeSkillIds={activeSkillIds}
              autoSkillIds={autoSkillIds}
              manualSkillIds={manualSkillIds}
              onToggleSkill={toggleSkill}
              onClearManualSkills={clearManualSkills}
              onUseSkill={(id) => {
                const skill = getSkillById(id);
                if (skill) {
                  setInput(language === "zh" ? `请调用 ${skill.name.zh} 技能继续分析。` : `Use the ${skill.name.en} skill to continue the investigation.`);
                }
              }}
            />
          )}

          {activeInspectorTab === "plan" && (
            <PlannerPanel
              language={language}
              tasks={tasks}
              onClear={() => clearTasks()}
              onUpdateTaskStatus={updateTaskStatus}
              onRemoveTask={removeTask}
            />
          )}

          {activeInspectorTab === "prompts" && (
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
          )}

          {activeInspectorTab === "clues" && (
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
                    {language === "zh" ? "暂时还没有沉淀线索。分析过程中可调用 update_context_info 自动写入。" : "No clues yet. The agent can write findings here while analyzing."}
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
          )}
        </div>
        <FloatingContextMenu menu={clueMenu} onClose={() => setClueMenu(null)} />
        {cluePreview && <PreviewDialog title={cluePreview.title} content={cluePreview.content} onClose={() => setCluePreview(null)} />}
      </aside>
    </div>
  );
}
