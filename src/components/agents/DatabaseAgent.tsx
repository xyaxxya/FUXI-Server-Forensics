import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  Bot,
  Braces,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Copy,
  Database,
  Edit3,
  FileSearch,
  History,
  KeyRound,
  Layers3,
  Loader2,
  Network,
  Pin,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { Language } from "../../translations";
import { AIMessage, AISettings, Tool, ToolCall, buildToolDisplayText, shouldTreatAssistantMessageAsThinking } from "../../lib/ai";
import { buildContextSections, buildWorkspacePromptContext } from "../../lib/aiContext";
import { applyUsageToSettings, runConversationLoop } from "../../lib/aiRuntime";
import { executeResearchTool, researchTools } from "../../lib/aiResearchTools";
import { useAIWorkspaceStore } from "../../lib/aiWorkspaceStore";
import { DBConfig, useDbStore } from "../../lib/dbStore";
import ConnectionForm from "../database/ConnectionForm";
import DataTable from "../DataTable";
import { ChatTranscriptMessage } from "./ChatTranscriptMessage";

interface DbQueryResult {
  headers: string[];
  rows: string[][];
  affected_rows: number;
  last_insert_id: number | null;
}

interface DatabaseAgentProps {
  language: Language;
  aiSettings: AISettings;
  onOpenSettings?: () => void;
  onAiSettingsChange?: (settings: AISettings) => void;
  generalInfo?: string;
  chatUserProfile?: {
    qq?: string | null;
    avatar?: string | null;
  };
}

interface ThinkingToolCallView {
  command: string;
  args: Record<string, unknown>;
  output?: string;
  isLoading?: boolean;
  isError?: boolean;
}

interface ThinkingStepView {
  id: string;
  title: string;
  toolCall?: ThinkingToolCallView;
}

type DisplayItem =
  | { type: "message"; message: AIMessage }
  | { type: "thinking"; steps: ThinkingStepView[]; isFinished: boolean };

type WorkspaceMode = "sql" | "ai";

interface QueryTab {
  id: string;
  title: string;
  sql: string;
  result: DbQueryResult | null;
  error: string;
  loading: boolean;
  schema: string;
}

interface DbObjects {
  tables: string[];
  views: string[];
  functions: string[];
}

interface ExplorerSelection {
  database: string;
  objectType: "table" | "view" | "function";
  objectName: string;
}

interface QueryHistoryItem {
  id: string;
  sql: string;
  database: string | null;
  createdAt: number;
  pinned: boolean;
}

interface SlashCommandItem {
  id: string;
  command: string;
  title: string;
  description: string;
  insertText?: string;
  onSelect?: () => void;
}

function byLanguage(language: Language, zh: string, en: string) {
  return language === "zh" ? zh : en;
}

function quoteIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function quoteSqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function formatCount(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeSqlForGuard(query: string) {
  return query
    .trim()
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/#[^\n\r]*/g, " ")
    .replace(/^[\s(]+/, "")
    .toLowerCase();
}

function isReadOnlyQuery(query: string) {
  const normalized = normalizeSqlForGuard(query);
  if (!/^(select|show|desc|describe|explain|with)\b/.test(normalized)) {
    return false;
  }

  const withoutTrailingSemicolon = normalized.replace(/;+\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    return false;
  }

  if (/\binto\s+(out|dump)file\b|\bfor\s+update\b/.test(normalized)) {
    return false;
  }

  if (/^(select|with|explain)\b/.test(normalized)) {
    return !/\b(insert|update|delete|drop|alter|create|truncate|replace|grant|revoke|rename|call|handler|lock|unlock|kill)\b/.test(normalized);
  }

  return true;
}

function createQueryTab(index = 1): QueryTab {
  return {
    id: crypto.randomUUID(),
    title: `Query ${index}`,
    sql: "",
    result: null,
    error: "",
    loading: false,
    schema: "",
  };
}

function splitSlashCommandInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { commandToken: null, bodyText: "" };
  }

  const firstWhitespace = trimmed.search(/\s/);
  if (firstWhitespace === -1) {
    return { commandToken: trimmed, bodyText: "" };
  }

  return {
    commandToken: trimmed.slice(0, firstWhitespace),
    bodyText: trimmed.slice(firstWhitespace).trim(),
  };
}

function getSlashCommandMatches(input: string, commands: SlashCommandItem[]) {
  const { commandToken } = splitSlashCommandInput(input);
  if (!commandToken) {
    return [];
  }
  const query = commandToken.slice(1).toLowerCase();
  return commands.filter((item) => {
    if (!query) {
      return true;
    }
    return [item.command, item.title, item.description].join(" ").toLowerCase().includes(query);
  });
}

function getSlashCommandCompletion(input: string, commands: SlashCommandItem[]) {
  return getSlashCommandMatches(input, commands)[0]?.command || null;
}

function resolveSlashCommandInput(input: string, commands: SlashCommandItem[]) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return {
      matchedCommand: null as SlashCommandItem | null,
      sendText: trimmed,
      displayText: trimmed,
      shouldExecuteImmediately: false,
    };
  }

  const matchedCommand = [...commands]
    .sort((a, b) => b.command.length - a.command.length)
    .find((item) => {
      const command = item.command.toLowerCase();
      const candidate = trimmed.toLowerCase();
      return candidate === command || candidate.startsWith(`${command} `);
    }) || null;

  if (!matchedCommand) {
    return {
      matchedCommand: null as SlashCommandItem | null,
      sendText: null as string | null,
      displayText: null as string | null,
      shouldExecuteImmediately: false,
    };
  }

  const bodyText = trimmed.slice(matchedCommand.command.length).trim();
  if (matchedCommand.onSelect) {
    return {
      matchedCommand,
      sendText: null as string | null,
      displayText: null as string | null,
      shouldExecuteImmediately: true,
    };
  }

  const preset = matchedCommand.insertText || matchedCommand.command;
  return {
    matchedCommand,
    sendText: bodyText ? `${preset}\n\n${bodyText}` : preset,
    displayText: bodyText ? `已使用 ${matchedCommand.command}: ${bodyText}` : `已使用 ${matchedCommand.command}`,
    shouldExecuteImmediately: false,
  };
}

function buildDisplayItems(messages: AIMessage[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let thinkingSteps: ThinkingStepView[] = [];

  const flush = (isFinished: boolean) => {
    if (thinkingSteps.length > 0) {
      items.push({ type: "thinking", steps: [...thinkingSteps], isFinished });
      thinkingSteps = [];
    }
  };

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === "system") continue;

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
            title: typeof args.query === "string" ? args.query : display.title,
            toolCall: {
              command:
                typeof args.query === "string"
                  ? args.query
                  : typeof args.database === "string"
                    ? `${display.command}(${args.database})`
                    : display.command,
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
        step.toolCall.isError = /Execution failed|Exit:\s*[1-9]|只允许只读|Only read-only/i.test(message.content);
      }
    }
  }

  flush(false);
  return items;
}

const dbTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "list_databases",
      description: "列出当前数据库连接中可访问的数据库。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tables",
      description: "列出指定数据库中的表、视图和函数，供后续取证查询使用。",
      parameters: {
        type: "object",
        properties: {
          database: { type: "string", description: "数据库名" },
        },
        required: ["database"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_schema",
      description: "读取指定表或视图的建表结构。",
      parameters: {
        type: "object",
        properties: {
          database: { type: "string", description: "数据库名" },
          tables: { type: "array", items: { type: "string" }, description: "数据表或视图名称列表" },
        },
        required: ["database", "tables"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_sql",
      description: "执行只读 SQL 查询，只允许 SELECT、SHOW、DESC、DESCRIBE、EXPLAIN、WITH。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "只读 SQL" },
          database: { type: "string", description: "数据库名，可选" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_context_info",
      description: "将数据库账号、敏感配置、异常用户、交易线索等沉淀到共享上下文。",
      parameters: {
        type: "object",
        properties: {
          info: { type: "string", description: "要保存的关键线索" },
        },
        required: ["info"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_plan",
      description: "维护数据库调查计划，把待办、进行中、已完成步骤同步到计划面板。",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                content: { type: "string" },
                status: { type: "string", enum: ["pending", "in_progress", "completed"] },
              },
              required: ["content", "status"],
            },
          },
        },
        required: ["tasks"],
      },
    },
  },
  ...researchTools,
];

export default function DatabaseAgent({
  language,
  aiSettings,
  onAiSettingsChange,
  generalInfo = "",
}: DatabaseAgentProps) {
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
  const {
    connections,
    activeConnectionId,
    activeDatabase,
    databases,
    addConnection,
    updateConnection,
    removeConnection,
    setActiveConnection,
    setActiveDatabase,
    setDatabases,
  } = useDbStore();

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [formConfig, setFormConfig] = useState<DBConfig | null>(null);
  const [dbObjects, setDbObjects] = useState<Record<string, DbObjects>>({});
  const [expandedDbs, setExpandedDbs] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, string[]>>({});
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("sql");
  const [objectFilter, setObjectFilter] = useState("");
  const initialQueryTab = useMemo(() => createQueryTab(), []);
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>(() => [initialQueryTab]);
  const [activeTabId, setActiveTabId] = useState<string>(() => initialQueryTab.id);
  const [selection, setSelection] = useState<ExplorerSelection | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const aiListEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const text = (zh: string, en: string) => byLanguage(language, zh, en);
  const config = aiSettings.configs[aiSettings.activeProvider];
  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);
  const activeConnection = connections.find((item) => item.id === activeConnectionId) || null;
  const activeTab = queryTabs.find((item) => item.id === activeTabId) || queryTabs[0];
  const activeObjects = activeDatabase ? dbObjects[activeDatabase] : null;
  const currentObjectTotal = (activeObjects?.tables.length || 0) + (activeObjects?.views.length || 0) + (activeObjects?.functions.length || 0);
  const lastRows = activeTab.result?.rows.length || 0;
  const pinnedHistory = queryHistory.filter((item) => item.pinned);
  const pinnedSnippets = promptSnippets.filter((item) => item.pinned);

  const slashCommands = useMemo<SlashCommandItem[]>(
    () => [
      {
        id: "plan",
        command: "/plan",
        title: byLanguage(language, "生成数据库调查计划", "Create database plan"),
        description: byLanguage(language, "先规划，再逐步列库、列表、看结构和查证据", "Plan first, then inspect databases, tables, schema and evidence"),
        insertText: byLanguage(
          language,
          "请先给出一份数据库取证调查计划，再按计划列库、列表示意、查看结构，并逐步给出安全只读 SQL。",
          "Create a database investigation plan first, then inspect databases, tables, schema and evidence step by step.",
        ),
      },
      {
        id: "schema",
        command: "/schema",
        title: byLanguage(language, "优先梳理结构", "Inspect schema first"),
        description: byLanguage(language, "先识别关键表、字段、索引和关联关系", "Understand key tables, fields, indexes and relations first"),
        insertText: byLanguage(
          language,
          "请先梳理当前数据库的表结构、关键字段和可能的取证入口，再告诉我下一步最值得执行的只读 SQL。",
          "Inspect the current schema and key fields first, then suggest the next read-only SQL to run.",
        ),
      },
      {
        id: "hunt",
        command: "/hunt",
        title: byLanguage(language, "敏感线索排查", "Hunt sensitive evidence"),
        description: byLanguage(language, "围绕账号、令牌、密钥、权限、订单和日志做排查", "Focus on accounts, tokens, secrets, privilege, orders and logs"),
        insertText: byLanguage(
          language,
          "请围绕后台账号、权限变化、令牌密钥、敏感配置、异常交易和近期登录记录生成一组只读排查 SQL。",
          "Generate safe read-only SQL for admin accounts, privilege changes, tokens, secrets, suspicious transactions and recent logins.",
        ),
      },
      {
        id: "clear",
        command: "/clear",
        title: byLanguage(language, "清空 AI 会话", "Clear AI session"),
        description: byLanguage(language, "只清空本页 AI 对话，保留连接、SQL 和历史", "Clear AI chat while keeping connections, SQL tabs and history"),
        onSelect: () => {
          setMessages([]);
          setAiInput("");
          setStatus("");
          setWorkspaceMode("ai");
        },
      },
    ],
    [language],
  );

  const slashMatches = useMemo(() => getSlashCommandMatches(aiInput, slashCommands), [aiInput, slashCommands]);
  const resolvedAiSlashInput = useMemo(() => resolveSlashCommandInput(aiInput, slashCommands), [aiInput, slashCommands]);
  const canSendAi = !!aiInput.trim() && !aiLoading && (!aiInput.trim().startsWith("/") || !!resolvedAiSlashInput.matchedCommand);

  useEffect(() => {
    aiListEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [displayItems.length, aiLoading, messages.length, status]);

  useEffect(() => {
    if (activeConnectionId) {
      void loadDatabases(activeConnectionId, activeConnection?.database);
    } else {
      setDbObjects({});
      setExpandedDbs([]);
      setExpandedGroups({});
      setSelection(null);
    }
  }, [activeConnectionId]);

  const updateTab = (tabId: string, updater: (tab: QueryTab) => QueryTab) => {
    setQueryTabs((prev) => prev.map((tab) => (tab.id === tabId ? updater(tab) : tab)));
  };

  const loadDatabases = async (connectionId: string, preferredDatabase?: string | null) => {
    try {
      const response = await invoke<DbQueryResult>("exec_sql", {
        id: connectionId,
        query: "SHOW DATABASES;",
      });
      const dbList = response.rows.map((row) => row[0]).filter(Boolean);
      setDatabases(dbList);
      const nextDatabase = preferredDatabase && dbList.includes(preferredDatabase) ? preferredDatabase : dbList[0] || null;
      setActiveDatabase(nextDatabase);
      if (nextDatabase) {
        await loadDbObjects(nextDatabase, connectionId);
      }
    } catch (error) {
      setStatus(String(error));
      setDatabases([]);
      setActiveDatabase(null);
    }
  };

  const loadDbObjects = async (database: string, connectionId = activeConnectionId || undefined) => {
    if (!connectionId) return;
    try {
      const response = await invoke<DbQueryResult>("exec_sql", {
        id: connectionId,
        query: `SHOW FULL TABLES FROM ${quoteIdentifier(database)};`,
      });
      const nextObjects: DbObjects = { tables: [], views: [], functions: [] };
      response.rows.forEach((row) => {
        if (row[1] === "VIEW") {
          nextObjects.views.push(row[0]);
        } else {
          nextObjects.tables.push(row[0]);
        }
      });
      try {
        const functionResponse = await invoke<DbQueryResult>("exec_sql", {
          id: connectionId,
          query: `SHOW FUNCTION STATUS WHERE Db = ${quoteSqlString(database)};`,
        });
        nextObjects.functions = functionResponse.rows.map((row) => row[1]).filter(Boolean);
      } catch {
        nextObjects.functions = [];
      }
      setDbObjects((prev) => ({ ...prev, [database]: nextObjects }));
      setExpandedDbs((prev) => (prev.includes(database) ? prev : [...prev, database]));
      setExpandedGroups((prev) => ({
        ...prev,
        [database]: prev[database] || ["tables"],
      }));
    } catch (error) {
      setStatus(String(error));
    }
  };

  const handleSaveConnection = (nextConfig: DBConfig) => {
    const exists = connections.some((item) => item.id === nextConfig.id);
    if (exists) {
      updateConnection(nextConfig);
    } else {
      addConnection(nextConfig);
    }
    setFormConfig(null);
    setStatus(text("连接配置已保存", "Connection saved"));
  };

  const handleDeleteConnection = async (id: string) => {
    if (activeConnectionId === id) {
      try {
        await invoke("disconnect_db", { id });
      } catch {
        // Keep local cleanup deterministic even if backend was already disconnected.
      }
      setActiveConnection(null);
      setDatabases([]);
      setActiveDatabase(null);
      setDbObjects({});
      setSelection(null);
    }
    removeConnection(id);
    setFormConfig(null);
    setStatus(text("连接已删除", "Connection deleted"));
  };

  const handleConnect = async (connection: DBConfig) => {
    setConnectingId(connection.id);
    setStatus(text(`正在连接 ${connection.name}...`, `Connecting ${connection.name}...`));
    try {
      await invoke("connect_db", {
        id: connection.id,
        host: connection.host,
        port: connection.port,
        user: connection.user,
        pass: connection.pass,
        database: connection.database || "mysql",
        sshConfig: connection.useSsh ? connection.ssh : undefined,
      });
      setActiveConnection(connection.id);
      await loadDatabases(connection.id, connection.database);
      setStatus(text("数据库连接成功", "Database connected"));
    } catch (error) {
      setStatus(String(error));
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async () => {
    if (!activeConnectionId) return;
    try {
      await invoke("disconnect_db", { id: activeConnectionId });
    } catch {
      // noop
    }
    setActiveConnection(null);
    setDatabases([]);
    setActiveDatabase(null);
    setDbObjects({});
    setSelection(null);
    setStatus(text("数据库连接已断开", "Database disconnected"));
  };

  const runManualQuery = async (tabId: string, sqlOverride?: string) => {
    if (!activeConnectionId) {
      setStatus(text("请先连接数据库。", "Connect a database first."));
      return;
    }

    const currentTab = queryTabs.find((tab) => tab.id === tabId);
    if (!currentTab && !sqlOverride) return;
    const sql = (sqlOverride ?? currentTab?.sql ?? "").trim();
    if (!sql) {
      setStatus(text("请输入 SQL。", "Enter a SQL query."));
      return;
    }
    if (!isReadOnlyQuery(sql)) {
      updateTab(tabId, (tab) => ({
        ...tab,
        error: text("只允许执行只读 SQL。", "Only read-only SQL is allowed."),
        result: null,
      }));
      setStatus(text("已拦截非只读 SQL。", "Blocked non-read-only SQL."));
      return;
    }

    updateTab(tabId, (tab) => ({ ...tab, loading: true, error: "" }));
    try {
      const result = await invoke<DbQueryResult>("exec_sql", {
        id: activeConnectionId,
        query: sql,
        db: activeDatabase || activeConnection?.database || undefined,
      });
      updateTab(tabId, (tab) => ({
        ...tab,
        sql,
        result,
        loading: false,
        error: "",
      }));
      setQueryHistory((prev) => {
        const entry: QueryHistoryItem = {
          id: crypto.randomUUID(),
          sql,
          database: activeDatabase || activeConnection?.database || null,
          createdAt: Date.now(),
          pinned: prev.find((item) => item.sql === sql)?.pinned || false,
        };
        return [entry, ...prev.filter((item) => item.sql !== sql || item.database !== entry.database)].slice(0, 24);
      });
      setStatus(text(`查询完成，返回 ${result.rows.length} 行`, `Query complete, ${result.rows.length} rows`));
    } catch (error) {
      updateTab(tabId, (tab) => ({
        ...tab,
        sql,
        result: null,
        loading: false,
        error: String(error),
      }));
      setStatus(String(error));
    }
  };

  const loadObjectDefinitionIntoTab = async (
    tabId: string,
    database: string,
    objectName: string,
    objectType: ExplorerSelection["objectType"],
  ) => {
    if (!activeConnectionId) return;
    const query =
      objectType === "function"
        ? `SHOW CREATE FUNCTION ${quoteIdentifier(database)}.${quoteIdentifier(objectName)};`
        : `SHOW CREATE TABLE ${quoteIdentifier(database)}.${quoteIdentifier(objectName)};`;
    try {
      const response = await invoke<DbQueryResult>("exec_sql", {
        id: activeConnectionId,
        query,
      });
      const schema = response.rows[0]?.[1] || response.rows[0]?.[2] || "";
      updateTab(tabId, (tab) => ({ ...tab, schema }));
    } catch (error) {
      updateTab(tabId, (tab) => ({ ...tab, schema: String(error) }));
    }
  };

  const openObject = async (database: string, objectName: string, objectType: ExplorerSelection["objectType"]) => {
    setSelection({ database, objectName, objectType });
    setWorkspaceMode("sql");
    setActiveDatabase(database);

    const title = `${database}.${objectName}`;
    const sql =
      objectType === "function"
        ? `SHOW CREATE FUNCTION ${quoteIdentifier(database)}.${quoteIdentifier(objectName)};`
        : `SELECT * FROM ${quoteIdentifier(database)}.${quoteIdentifier(objectName)} LIMIT 100;`;
    const existing = queryTabs.find((tab) => tab.title === title);

    if (existing) {
      setActiveTabId(existing.id);
      await loadObjectDefinitionIntoTab(existing.id, database, objectName, objectType);
      if (!existing.result) {
        await runManualQuery(existing.id, sql);
      }
      return;
    }

    const nextTab: QueryTab = {
      id: crypto.randomUUID(),
      title,
      sql,
      result: null,
      error: "",
      loading: false,
      schema: "",
    };
    setQueryTabs((prev) => [...prev, nextTab]);
    setActiveTabId(nextTab.id);
    await loadObjectDefinitionIntoTab(nextTab.id, database, objectName, objectType);
    await runManualQuery(nextTab.id, nextTab.sql);
  };

  const executeToolCall = async (toolCall: ToolCall) => {
    const researchResult = await executeResearchTool(toolCall, language);
    if (researchResult) {
      return researchResult;
    }

    if (!activeConnectionId) {
      return {
        role: "tool",
        content: text("当前没有活动数据库连接。", "No active database connection."),
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    let args: {
      database?: string;
      info?: string;
      query?: string;
      tables?: string[];
    } = {};
    try {
      args = JSON.parse(toolCall.function.arguments) as typeof args;
    } catch {
      args = {};
    }

    if (toolCall.function.name === "update_context_info") {
      if (args.info) {
        appendRecord({
          content: args.info,
          source: "database-agent",
        });
      }
      return {
        role: "tool",
        content: text("共享线索池已更新。", "Shared clue pool updated."),
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    if (toolCall.function.name === "update_plan") {
      const planArgs = JSON.parse(toolCall.function.arguments) as {
        tasks?: Array<{
          id?: string;
          content: string;
          status: "pending" | "in_progress" | "completed";
        }>;
      };
      syncTasks(planArgs.tasks || [], "planner");
      return {
        role: "tool",
        content: text("执行计划已更新。", "Execution plan updated."),
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    if (toolCall.function.name === "list_databases") {
      const response = await invoke<DbQueryResult>("exec_sql", {
        id: activeConnectionId,
        query: "SHOW DATABASES;",
      });
      setDatabases(response.rows.map((row) => row[0]).filter(Boolean));
      return {
        role: "tool",
        content: JSON.stringify({ headers: ["database"], rows: response.rows }),
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    if (toolCall.function.name === "list_tables") {
      const database = args.database || activeDatabase || activeConnection?.database || "mysql";
      const response = await invoke<DbQueryResult>("exec_sql", {
        id: activeConnectionId,
        query: `SHOW FULL TABLES FROM ${quoteIdentifier(database)};`,
      });
      const nextObjects: DbObjects = { tables: [], views: [], functions: [] };
      response.rows.forEach((row) => {
        if (row[1] === "VIEW") {
          nextObjects.views.push(row[0]);
        } else {
          nextObjects.tables.push(row[0]);
        }
      });
      setDbObjects((prev) => ({ ...prev, [database]: nextObjects }));
      return {
        role: "tool",
        content: JSON.stringify(response),
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    if (toolCall.function.name === "get_schema") {
      const database = args.database || activeDatabase || activeConnection?.database || "mysql";
      const tables = args.tables || [];
      const schemaBlocks = await Promise.all(
        tables.map(async (table) => {
          const response = await invoke<DbQueryResult>("exec_sql", {
            id: activeConnectionId,
            query: `SHOW CREATE TABLE ${quoteIdentifier(database)}.${quoteIdentifier(table)};`,
          });
          return response.rows[0]?.[1] || `${table}: empty`;
        }),
      );
      return {
        role: "tool",
        content: schemaBlocks.join("\n\n"),
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    if (toolCall.function.name === "run_sql") {
      const query = args.query || "";
      if (!isReadOnlyQuery(query)) {
        return {
          role: "tool",
          content: text("只允许执行只读 SQL。", "Only read-only SQL is allowed."),
          tool_call_id: toolCall.id,
        } as AIMessage;
      }
      const response = await invoke<DbQueryResult>("exec_sql", {
        id: activeConnectionId,
        query,
        db: args.database || activeDatabase || activeConnection?.database || undefined,
      });
      return {
        role: "tool",
        content: JSON.stringify(response),
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    return {
      role: "tool",
      content: text("未知工具调用。", "Unknown tool call."),
      tool_call_id: toolCall.id,
    } as AIMessage;
  };

  const handleStopAi = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAiLoading(false);
    setStatus(text("已停止", "Stopped"));
  };

  const handleSendAi = async (rawInput = aiInput) => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput || aiLoading) return;
    if (!activeConnection) {
      setStatus(text("请先连接数据库。", "Connect a database first."));
      return;
    }
    if (!config.apiKey.trim()) {
      setStatus(text("请先在设置中配置 AI Key。", "Configure the AI key first."));
      return;
    }

    const resolvedSlash = resolveSlashCommandInput(trimmedInput, slashCommands);
    if (trimmedInput.startsWith("/") && !resolvedSlash.matchedCommand) {
      setStatus(text("未识别的快捷命令。", "Unknown slash command."));
      return;
    }
    if (resolvedSlash.shouldExecuteImmediately && resolvedSlash.matchedCommand?.onSelect) {
      resolvedSlash.matchedCommand.onSelect();
      return;
    }

    const prompt = resolvedSlash.sendText ?? trimmedInput;

    addPromptHistory(trimmedInput);
    const nextUserMessage: AIMessage = { role: "user", content: prompt, uiContent: resolvedSlash.displayText ?? trimmedInput };
    const nextHistory = [...messages, nextUserMessage];
    setMessages(nextHistory);
    setAiInput("");
    setAiLoading(true);
    setWorkspaceMode("ai");
    setStatus(text("数据库智查正在分析...", "Database intelligence is analyzing..."));

    const workspaceInfo = buildWorkspacePromptContext(generalInfo, records);
    const objectSummary = activeObjects
      ? `tables=${activeObjects.tables.length}, views=${activeObjects.views.length}, functions=${activeObjects.functions.length}`
      : "objects not loaded";
    const promptContext = buildContextSections([
      { title: "当前连接", content: `${activeConnection.name} (${activeConnection.host}:${activeConnection.port})` },
      { title: "当前数据库", content: activeDatabase || activeConnection.database || "未指定" },
      { title: "当前对象统计", content: objectSummary },
      { title: "当前选中对象", content: selection ? `${selection.database}.${selection.objectName} (${selection.objectType})` : "未选择" },
      { title: "共享线索池", content: workspaceInfo || "暂无" },
      {
        title: "工作约束",
        content:
          "你是数据库取证智查助手。复杂问题先调用 update_plan 输出 3-6 步计划；必须优先列库、列表、读结构，再执行只读 SQL。只允许 SELECT、SHOW、DESC、DESCRIBE、EXPLAIN、WITH。发现后台管理员账号、密钥令牌、异常交易、数据库凭据或敏感配置时，立即调用 update_context_info 保存线索。",
      },
    ]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const finalHistory = await runConversationLoop({
        initialHistory: nextHistory,
        settings: aiSettings,
        tools: dbTools,
        generalInfo: promptContext,
        signal: abortController.signal,
        executeToolCall: async ({ toolCall }) => executeToolCall(toolCall),
        callbacks: {
          onAssistantMessage: (_, history) => setMessages(history),
          onToolResult: (_, __, history) => {
            setMessages(history);
            setStatus(text("正在处理查询结果...", "Processing query result..."));
          },
          onUsage: (usage) => {
            onAiSettingsChange?.(applyUsageToSettings(aiSettings, usage));
          },
        },
      });
      setMessages(finalHistory);
      finalizeTasks("all");
      setStatus(text("分析完成", "Done"));
    } catch (error) {
      setStatus(String(error));
    } finally {
      setAiLoading(false);
      abortControllerRef.current = null;
    }
  };

  const toggleDbExpand = async (database: string) => {
    setExpandedDbs((prev) => (prev.includes(database) ? prev.filter((item) => item !== database) : [...prev, database]));
    if (!dbObjects[database]) {
      await loadDbObjects(database);
    }
  };

  const toggleGroup = (database: string, group: string) => {
    setExpandedGroups((prev) => {
      const current = prev[database] || [];
      const next = current.includes(group) ? current.filter((item) => item !== group) : [...current, group];
      return { ...prev, [database]: next };
    });
  };

  const selectDatabase = async (database: string | null) => {
    setActiveDatabase(database);
    if (database) {
      await loadDbObjects(database);
    }
  };

  const refreshDatabaseContext = async () => {
    if (!activeConnectionId) {
      setStatus(text("请先连接数据库。", "Connect a database first."));
      return;
    }
    await loadDatabases(activeConnectionId, activeDatabase || activeConnection?.database);
    setStatus(text("数据库结构已刷新", "Database structure refreshed"));
  };

  const addQueryTab = () => {
    const next = createQueryTab(queryTabs.length + 1);
    setQueryTabs((prev) => [...prev, next]);
    setActiveTabId(next.id);
    setWorkspaceMode("sql");
  };

  const closeQueryTab = (tabId: string) => {
    if (queryTabs.length <= 1) return;
    const nextTabs = queryTabs.filter((item) => item.id !== tabId);
    setQueryTabs(nextTabs);
    if (activeTabId === tabId && nextTabs[0]) {
      setActiveTabId(nextTabs[0].id);
    }
  };

  const pinActiveSql = () => {
    const sql = activeTab.sql.trim();
    if (!sql) {
      setStatus(text("当前 SQL 为空。", "Current SQL is empty."));
      return;
    }
    setQueryHistory((prev) => {
      const entry: QueryHistoryItem = {
        id: crypto.randomUUID(),
        sql,
        database: activeDatabase || activeConnection?.database || null,
        createdAt: Date.now(),
        pinned: true,
      };
      return [entry, ...prev.filter((item) => item.sql !== sql || item.database !== entry.database)].slice(0, 24);
    });
    setStatus(text("SQL 已收藏", "SQL pinned"));
  };

  const copyToClipboard = async (value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setStatus(text("已复制到剪贴板", "Copied to clipboard"));
  };

  const setAiDraft = (prompt: string) => {
    setWorkspaceMode("ai");
    setAiInput(prompt);
  };

  const explainActiveSql = () => {
    setAiDraft(`Explain this read-only SQL and identify useful forensic evidence.\n\n${activeTab.sql || "-- empty SQL tab"}`);
  };

  const optimizeActiveSql = () => {
    setAiDraft(`Optimize this read-only SQL for clarity and performance. Keep it safe.\n\n${activeTab.sql || "-- empty SQL tab"}`);
  };

  const generateInvestigationSql = () => {
    const target = selection ? `${selection.database}.${selection.objectName}` : activeDatabase || activeConnection?.database || "current database";
    setAiDraft(`Generate 5 safe read-only investigation SQL queries for ${target}. Focus on admin accounts, secrets, auth tokens, suspicious transactions, and recent changes.`);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ scope?: string; type?: string; value?: string }>;
      if (customEvent.detail?.scope !== "agent-database") {
        return;
      }

      if (customEvent.detail.type === "append-input" && customEvent.detail.value) {
        setWorkspaceMode("ai");
        setAiInput((current) => `${current}${current.trim() ? "\n" : ""}${customEvent.detail?.value}`);
      }

      if (customEvent.detail.type === "clear-input") {
        setAiInput("");
      }

      if (customEvent.detail.type === "send-input") {
        setWorkspaceMode("ai");
        void handleSendAi();
      }
    };

    window.addEventListener("fuxi-scope-context-action", handler as EventListener);
    return () => window.removeEventListener("fuxi-scope-context-action", handler as EventListener);
  }, [handleSendAi]);

  const renderThinking = (item: Extract<DisplayItem, { type: "thinking" }>, index: number) => (
    <motion.div
      key={`thinking-${index}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.25rem] border border-blue-100 bg-blue-50/60 p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
          <Sparkles size={14} />
          {text("智查过程", "Investigation trace")}
        </div>
        {!item.isFinished && <Loader2 size={14} className="animate-spin text-blue-600" />}
      </div>
      <div className="space-y-2">
        {item.steps.map((step) => (
          <div key={step.id} className="rounded-2xl bg-white/80 px-3 py-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <CircleDot size={12} className="mt-1 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <div className="break-words font-medium text-slate-800">{step.toolCall?.command || step.title}</div>
                {step.toolCall?.output && (
                  <div className={`mt-1 line-clamp-3 break-words font-mono text-[11px] ${step.toolCall.isError ? "text-rose-600" : "text-slate-500"}`}>
                    {step.toolCall.output}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );

  const renderAiFeed = (compact = false) => (
    <div className={`custom-scrollbar min-h-0 flex-1 overflow-auto ${compact ? "space-y-3 p-3" : "space-y-4 p-4 md:p-5"}`}>
      {messages.length === 0 && displayItems.length === 0 && (
        <div className="rounded-[1.35rem] border border-dashed border-blue-200 bg-white/78 px-5 py-8 text-sm leading-6 text-slate-500">
          {text(
            "可以直接描述调查目标，例如：找出后台管理员账号、定位保存密钥的配置表、排查近期异常订单或登录记录。",
            "Describe an investigation goal, for example: find admin accounts, locate secret-bearing config tables, or review suspicious orders and logins.",
          )}
        </div>
      )}
      {displayItems.map((item, index) =>
        item.type === "thinking" ? renderThinking(item, index) : <ChatTranscriptMessage key={`message-${index}`} message={item.message} language={language} />,
      )}
      {status && (
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-3 py-1.5 text-[11px] text-slate-500 shadow-[0_18px_34px_-30px_rgba(37,99,235,0.4)]">
          <span className={`h-2 w-2 rounded-full ${aiLoading ? "animate-pulse bg-blue-500" : "bg-slate-300"}`} />
          {aiLoading && <Loader2 size={12} className="animate-spin" />}
          <span className="truncate">{status}</span>
        </div>
      )}
      <div ref={aiListEndRef} />
    </div>
  );

  const renderAiComposer = (large = false) => (
    <div className="border-t border-slate-200/70 bg-white/82 p-3 backdrop-blur-xl">
      <div className="rounded-[1.35rem] border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Bot size={15} className="text-blue-600" />
            {text("AI 智查指令", "AI Intel Prompt")}
          </div>
          <div className="flex items-center gap-2">
            {aiLoading && (
              <button
                type="button"
                onClick={handleStopAi}
                className="ui-button-danger ui-pressable inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs"
              >
                <Square size={12} />
                {text("停止", "Stop")}
              </button>
            )}
            <button
              type="button"
              onClick={() => savePromptSnippet({ content: aiInput, pinned: true })}
              disabled={!aiInput.trim()}
              className="ui-button ui-pressable rounded-xl px-2.5 py-1.5 text-xs text-slate-600 disabled:opacity-45"
            >
              <Pin size={12} />
            </button>
          </div>
        </div>
        <textarea
          value={aiInput}
          onChange={(event) => setAiInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Tab" && aiInput.trim().startsWith("/")) {
              const completion = getSlashCommandCompletion(aiInput, slashCommands);
              if (completion) {
                event.preventDefault();
                setAiInput(completion);
              }
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSendAi();
            }
          }}
          placeholder={text("输入数据库调查问题，或输入 / 打开快捷命令", "Ask a database question, or type / for commands")}
          className={`ui-input-base w-full resize-none rounded-[1.15rem] border-white/0 bg-white/78 px-3 py-2.5 text-sm text-slate-700 shadow-inner ${large ? "min-h-[120px]" : "min-h-[88px]"}`}
        />
        {aiInput.trim().startsWith("/") && (
          <div className="mt-2 overflow-hidden rounded-[1.1rem] border border-slate-200 bg-white">
            {slashMatches.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400">{text("没有匹配的命令", "No matching command")}</div>
            ) : (
              slashMatches.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => {
                    if (command.onSelect) {
                      command.onSelect();
                      return;
                    }
                    setAiInput(command.command);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-blue-50"
                >
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-blue-600" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-900">{command.command} · {command.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{command.description}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => void handleSendAi()}
          disabled={!canSendAi}
          className="ui-button-primary ui-pressable mt-2 flex w-full items-center justify-center gap-2 rounded-[1.05rem] px-3 py-2.5 text-sm font-medium disabled:bg-slate-300 disabled:border-slate-300"
        >
          {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {text("发送到智查", "Send to AI")}
        </button>
      </div>
    </div>
  );

  const objectGroups = [
    { key: "tables" as const, label: text("数据表", "Tables"), type: "table" as const, items: activeObjects?.tables || [] },
    { key: "views" as const, label: text("视图", "Views"), type: "view" as const, items: activeObjects?.views || [] },
    { key: "functions" as const, label: text("函数", "Functions"), type: "function" as const, items: activeObjects?.functions || [] },
  ];

  return (
    <div className="h-full min-h-0 rounded-[2rem] bg-gradient-to-br from-white via-sky-50/55 to-blue-100/40 p-3 text-slate-900" data-context-scope="agent-database">
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[270px_minmax(0,1fr)] 2xl:grid-cols-[270px_minmax(0,1fr)_360px]">
        <aside className="ui-shell min-h-0 overflow-hidden rounded-[1.55rem] border-blue-100/70 bg-white/86">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-slate-200/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Database size={16} className="text-blue-700" />
                    {text("数据库连接", "Connections")}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {activeConnection ? `${activeConnection.host}:${activeConnection.port}` : text("选择资产后开始智查", "Select an asset to start")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormConfig({
                      id: crypto.randomUUID(),
                      name: text("新建连接", "New Connection"),
                      user: "root",
                      pass: "",
                      host: "127.0.0.1",
                      port: 3306,
                      database: "",
                      useSsh: false,
                      ssh: { ip: "", port: 22, user: "root", pass: "" },
                    })
                  }
                  className="ui-button-primary ui-pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  title={text("新增连接", "New connection")}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-auto p-3">
              <div className="space-y-2">
                {connections.length === 0 && (
                  <div className="rounded-[1.25rem] border border-dashed border-blue-200 bg-blue-50/50 px-4 py-6 text-center text-sm text-slate-500">
                    {text("还没有保存的数据库连接", "No saved database connections")}
                  </div>
                )}
                {connections.map((connection) => {
                  const isActive = connection.id === activeConnectionId;
                  const isConnecting = connectingId === connection.id;
                  return (
                    <motion.div
                      key={connection.id}
                      whileHover={{ y: -1 }}
                      className={`rounded-[1.25rem] border p-3 transition ${
                        isActive ? "border-blue-200 bg-blue-50/70 shadow-[0_18px_38px_-30px_rgba(37,99,235,0.55)]" : "border-slate-200/80 bg-white/78 hover:border-blue-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                            <div className="truncate text-sm font-semibold text-slate-900">{connection.name}</div>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 truncate font-mono text-[11px] text-slate-500">
                            <Network size={12} />
                            {connection.host}:{connection.port}
                          </div>
                          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] text-slate-500">
                            <KeyRound size={11} />
                            {connection.useSsh ? text("SSH 隧道", "SSH tunnel") : text("直连", "Direct")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormConfig(connection)}
                          className="ui-button ui-pressable rounded-xl p-2 text-slate-500"
                          title={text("编辑", "Edit")}
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => void handleDisconnect()}
                            className="ui-button-danger ui-pressable flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                          >
                            <Unplug size={14} />
                            {text("断开", "Disconnect")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleConnect(connection)}
                            disabled={!!connectingId}
                            className="ui-button-primary ui-pressable flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold disabled:bg-slate-300 disabled:border-slate-300"
                          >
                            {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                            {text("连接", "Connect")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteConnection(connection.id)}
                          className="ui-button ui-pressable rounded-xl p-2 text-slate-500 hover:text-rose-600"
                          title={text("删除", "Delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="rounded-[1.35rem] border border-blue-100 bg-gradient-to-br from-white to-blue-50/60 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Layers3 size={15} className="text-blue-700" />
                      {text("资产导航", "Asset Explorer")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{text("库、表、视图、函数", "Databases, tables, views, functions")}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshDatabaseContext()}
                    className="ui-button ui-pressable rounded-xl p-2 text-slate-500"
                    title={text("刷新结构", "Refresh structure")}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                <select
                  value={activeDatabase || ""}
                  onChange={(event) => void selectDatabase(event.target.value || null)}
                  disabled={!activeConnectionId || databases.length === 0}
                  className="ui-input-base w-full rounded-xl px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
                >
                  {!activeDatabase && <option value="">{text("选择数据库", "Select database")}</option>}
                  {databases.map((database) => (
                    <option key={database} value={database}>
                      {database}
                    </option>
                  ))}
                </select>

                <div className="relative mt-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={objectFilter}
                    onChange={(event) => setObjectFilter(event.target.value)}
                    placeholder={text("过滤对象", "Filter objects")}
                    className="ui-input-base w-full rounded-xl py-2 pl-8 pr-3 text-xs text-slate-700"
                  />
                </div>

                <div className="mt-3 space-y-2">
                  {!activeDatabase && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-5 text-center text-xs text-slate-500">
                      {text("连接后显示数据库结构", "Connect to load structure")}
                    </div>
                  )}
                  {activeDatabase && (
                    <div className="rounded-[1.15rem] bg-white/72 p-2">
                      <button
                        type="button"
                        onClick={() => void toggleDbExpand(activeDatabase)}
                        className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{activeDatabase}</div>
                          <div className="text-[11px] text-slate-500">
                            {activeObjects ? `${activeObjects.tables.length} tables · ${activeObjects.views.length} views` : text("点击加载对象", "Click to load objects")}
                          </div>
                        </div>
                        <ChevronDown className={`transition-transform ${expandedDbs.includes(activeDatabase) ? "rotate-180" : ""}`} size={15} />
                      </button>

                      {expandedDbs.includes(activeDatabase) && (
                        <div className="mt-1 space-y-2">
                          {objectGroups.map((group) => {
                            const isGroupExpanded = (expandedGroups[activeDatabase] || []).includes(group.key);
                            const items = group.items.filter((item) => item.toLowerCase().includes(objectFilter.trim().toLowerCase()));
                            return (
                              <div key={group.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(activeDatabase, group.key)}
                                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700"
                                >
                                  <span>{group.label}</span>
                                  <span className="flex items-center gap-1 text-slate-400">
                                    {items.length}
                                    <ChevronDown className={`transition-transform ${isGroupExpanded ? "rotate-180" : ""}`} size={13} />
                                  </span>
                                </button>
                                {isGroupExpanded && (
                                  <div className="mt-1 max-h-48 space-y-1 overflow-auto pr-1 custom-scrollbar">
                                    {items.length === 0 && <div className="px-2 py-2 text-xs text-slate-400">{text("暂无对象", "No objects")}</div>}
                                    {items.map((item) => (
                                      <button
                                        key={item}
                                        type="button"
                                        onClick={() => void openObject(activeDatabase, item, group.type)}
                                        className={`ui-pressable flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                                          selection?.database === activeDatabase && selection.objectName === item
                                            ? "bg-blue-600 text-white shadow-[0_12px_24px_-18px_rgba(37,99,235,0.75)]"
                                            : "text-slate-600 hover:bg-white"
                                        }`}
                                      >
                                        <Table2 size={13} className="shrink-0" />
                                        <span className="truncate">{item}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {status && (
                <div className="rounded-[1.1rem] border border-slate-200 bg-white/82 px-3 py-2 text-xs leading-5 text-slate-500">
                  {status}
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="ui-shell min-h-0 overflow-hidden rounded-[1.55rem] border-blue-100/70 bg-white/88">
          <div className="flex h-full min-h-0 flex-col">
            <header className="border-b border-slate-200/70 bg-gradient-to-r from-white via-blue-50/60 to-white px-4 py-3 md:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_18px_34px_-24px_rgba(37,99,235,0.9)]">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-950">{text("数据库智查中枢", "Database Intel Workbench")}</h2>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {text("只读 SQL、结构梳理、敏感线索和 AI 协同分析集中在一个工作台", "Read-only SQL, schema review, evidence hunting and AI analysis in one workspace")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["sql", "ai"] as WorkspaceMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setWorkspaceMode(mode)}
                      className={`ui-pressable rounded-2xl px-4 py-2 text-sm font-semibold ${
                        workspaceMode === mode ? "bg-blue-600 text-white shadow-[0_16px_28px_-20px_rgba(37,99,235,0.75)]" : "bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
                      }`}
                    >
                      {mode === "sql" ? text("SQL 工作台", "SQL Workspace") : text("AI 智查", "AI Intel")}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void refreshDatabaseContext()}
                    className="ui-button ui-pressable inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-slate-600"
                  >
                    <RefreshCw size={15} />
                    {text("刷新", "Refresh")}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                {[
                  { label: text("连接", "Connection"), value: activeConnection?.name || "-" },
                  { label: text("数据库", "Database"), value: activeDatabase || "-" },
                  { label: text("对象", "Objects"), value: formatCount(currentObjectTotal) },
                  { label: text("结果行", "Rows"), value: formatCount(lastRows) },
                  { label: text("只读保护", "Read-only"), value: text("开启", "On") },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.05rem] border border-blue-100 bg-white/76 px-3 py-2">
                    <div className="text-[11px] font-medium text-slate-400">{item.label}</div>
                    <div className="mt-1 truncate text-sm font-bold text-slate-900">{item.value}</div>
                  </div>
                ))}
              </div>
            </header>

            {workspaceMode === "sql" ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-slate-200/75 bg-white/78">
                  <div className="border-b border-slate-200/70 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2 overflow-x-auto custom-scrollbar">
                      {queryTabs.map((tab, index) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTabId(tab.id)}
                          className={`group flex max-w-[220px] shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                            tab.id === activeTabId ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          <span className="truncate">{tab.title || `Query ${index + 1}`}</span>
                          {queryTabs.length > 1 && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                closeQueryTab(tab.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  closeQueryTab(tab.id);
                                }
                              }}
                              className="rounded-full p-0.5 opacity-70 hover:bg-white/20 hover:opacity-100"
                            >
                              <X size={12} />
                            </span>
                          )}
                        </button>
                      ))}
                      <button type="button" onClick={addQueryTab} className="ui-button ui-pressable rounded-xl p-2 text-slate-600">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid min-h-0 flex-1 grid-rows-[minmax(220px,0.46fr)_minmax(260px,0.54fr)] gap-3 p-3">
                    <div className="flex min-h-0 flex-col rounded-[1.2rem] border border-blue-100 bg-gradient-to-br from-white to-blue-50/40 p-3">
                      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                            <Braces size={15} className="text-blue-700" />
                            {text("只读 SQL 编辑器", "Read-only SQL Editor")}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{text("允许 SELECT / SHOW / DESC / DESCRIBE / EXPLAIN / WITH", "Allowed: SELECT / SHOW / DESC / DESCRIBE / EXPLAIN / WITH")}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void copyToClipboard(activeTab.sql)} className="ui-button ui-pressable inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-slate-600">
                            <Copy size={13} />
                            {text("复制", "Copy")}
                          </button>
                          <button type="button" onClick={pinActiveSql} className="ui-button ui-pressable inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-slate-600">
                            <Pin size={13} />
                            {text("收藏", "Pin")}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTab(activeTab.id, (tab) => ({ ...tab, sql: "", error: "", result: null }))}
                            className="ui-button ui-pressable rounded-xl px-3 py-2 text-xs text-slate-600"
                          >
                            {text("清空", "Clear")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void runManualQuery(activeTab.id)}
                            disabled={activeTab.loading}
                            className="ui-button-primary ui-pressable inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold disabled:bg-slate-300 disabled:border-slate-300"
                          >
                            {activeTab.loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                            {text("运行", "Run")}
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={activeTab.sql}
                        onChange={(event) => updateTab(activeTab.id, (tab) => ({ ...tab, sql: event.target.value }))}
                        className="ui-input-base min-h-0 flex-1 resize-none rounded-[1.15rem] border-white/0 bg-white/86 px-4 py-3 font-mono text-sm leading-6 text-slate-800 shadow-inner"
                        placeholder="SELECT * FROM users LIMIT 100;"
                        spellCheck={false}
                      />
                    </div>

                    <div className="min-h-0 overflow-hidden rounded-[1.2rem] border border-slate-200/75 bg-white">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <Table2 size={15} className="text-blue-700" />
                          {text("查询结果", "Query Result")}
                        </div>
                        <div className="text-xs text-slate-500">{activeTab.result ? `${activeTab.result.headers.length} cols · ${activeTab.result.rows.length} rows` : text("等待查询", "Waiting")}</div>
                      </div>
                      <div className="custom-scrollbar h-[calc(100%-49px)] overflow-auto p-3">
                        {activeTab.error && (
                          <div className="flex items-start gap-2 rounded-[1.15rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <span className="break-words">{activeTab.error}</span>
                          </div>
                        )}
                        {!activeTab.error && activeTab.result && (
                          <DataTable headers={activeTab.result.headers} rows={activeTab.result.rows} language={language} title={text("结果集", "Result Set")} />
                        )}
                        {!activeTab.error && !activeTab.result && (
                          <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center text-sm text-slate-500">
                            {text("运行只读 SQL 后，这里会显示结果。", "Run a read-only SQL query to see results here.")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <aside className="hidden min-h-0 flex-col gap-3 overflow-hidden xl:flex">
                  <div className="rounded-[1.35rem] border border-blue-100 bg-white/82 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <FileSearch size={15} className="text-blue-700" />
                      {text("智查动作", "Intel Actions")}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <button type="button" onClick={generateInvestigationSql} className="ui-pressable flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-left text-sm font-semibold text-blue-800 hover:bg-blue-100">
                        <Sparkles size={15} />
                        {text("生成排查 SQL", "Generate investigation SQL")}
                      </button>
                      <button type="button" onClick={explainActiveSql} className="ui-pressable flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <Bot size={15} />
                        {text("解释当前 SQL", "Explain current SQL")}
                      </button>
                      <button type="button" onClick={optimizeActiveSql} className="ui-pressable flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <CheckCircle2 size={15} />
                        {text("优化当前 SQL", "Optimize current SQL")}
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden rounded-[1.35rem] border border-slate-200/75 bg-white/82">
                    <div className="border-b border-slate-200/70 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Braces size={15} className="text-blue-700" />
                        {text("结构预览", "Schema Preview")}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {selection ? `${selection.database}.${selection.objectName}` : text("从左侧选择表或视图", "Select an object from the left")}
                      </div>
                    </div>
                    <pre className="custom-scrollbar h-[calc(100%-58px)] overflow-auto whitespace-pre-wrap bg-slate-50/80 p-4 font-mono text-xs leading-6 text-slate-700">
                      {activeTab.schema || text("打开对象后会显示建表结构。", "Open an object to see schema here.")}
                    </pre>
                  </div>

                  <div className="max-h-56 overflow-hidden rounded-[1.35rem] border border-slate-200/75 bg-white/82">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <History size={15} className="text-blue-700" />
                        {text("SQL 历史", "SQL History")}
                      </div>
                      <div className="text-xs text-slate-400">{queryHistory.length}</div>
                    </div>
                    <div className="custom-scrollbar max-h-[168px] space-y-2 overflow-auto p-3">
                      {queryHistory.length === 0 && <div className="text-xs text-slate-400">{text("运行查询后自动记录", "Runs are recorded automatically")}</div>}
                      {queryHistory.slice(0, 6).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            updateTab(activeTab.id, (tab) => ({ ...tab, sql: item.sql }));
                            if (item.database) {
                              setActiveDatabase(item.database);
                            }
                          }}
                          className={`block w-full rounded-xl px-3 py-2 text-left text-xs ${item.pinned ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                        >
                          <div className="line-clamp-2 font-mono">{item.sql}</div>
                          <div className="mt-1 text-[11px] text-slate-400">{item.database || "-"} · {formatTime(item.createdAt)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                {renderAiFeed(false)}
                {renderAiComposer(true)}
              </div>
            )}
          </div>
        </main>

        <aside className="ui-shell hidden min-h-0 overflow-hidden rounded-[1.55rem] border-blue-100/70 bg-white/88 2xl:block">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-slate-200/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Bot size={16} className="text-blue-700" />
                    {text("数据库 AI 智查", "Database AI Intel")}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{text("计划、提示词和线索协同", "Plans, prompts and evidence")}</div>
                </div>
                {aiLoading && <Loader2 size={16} className="animate-spin text-blue-600" />}
              </div>
            </div>

            {workspaceMode === "sql" && <div className="min-h-[230px] border-b border-slate-200/70">{renderAiComposer(false)}</div>}

            <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-auto p-3">
              <div className="rounded-[1.25rem] border border-blue-100 bg-blue-50/55 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <ClipboardList size={15} className="text-blue-700" />
                    {text("执行计划", "Execution Plan")}
                  </div>
                  {tasks.length > 0 && (
                    <button type="button" onClick={() => clearTasks()} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-white">
                      {text("清空", "Clear")}
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {tasks.length === 0 && <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 px-3 py-5 text-xs text-slate-500">{text("AI 生成计划后会显示在这里", "AI-generated plans appear here")}</div>}
                  {tasks.slice(0, 8).map((task, index) => {
                    const done = task.status === "completed";
                    const running = task.status === "in_progress";
                    return (
                      <div key={task.id} className={`rounded-xl border px-3 py-2 ${done ? "border-emerald-200 bg-emerald-50" : running ? "border-blue-200 bg-white" : "border-slate-200 bg-white/78"}`}>
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => updateTaskStatus(task.id, done ? "pending" : "completed")}
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                              done ? "bg-emerald-100 text-emerald-700" : running ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {done ? <CheckCircle2 size={13} /> : index + 1}
                          </button>
                          <div className="min-w-0 flex-1 text-xs leading-5 text-slate-700">{task.content}</div>
                          <button type="button" onClick={() => removeTask(task.id)} className="rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-200/75 bg-white/82 p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <History size={15} className="text-blue-700" />
                  {text("常用提问", "Prompt Library")}
                </div>
                <div className="mt-3 space-y-2">
                  {[...pinnedSnippets.map((item) => item.content), ...promptHistory, ...pinnedHistory.map((item) => item.sql)].slice(0, 6).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setWorkspaceMode("ai");
                        setAiInput(prompt);
                      }}
                      className="block w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-xs leading-5 text-slate-600 transition hover:bg-blue-50 hover:text-blue-800"
                    >
                      <span className="line-clamp-2">{prompt}</span>
                    </button>
                  ))}
                  {promptHistory.length === 0 && pinnedSnippets.length === 0 && pinnedHistory.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-5 text-xs text-slate-400">
                      {text("收藏 SQL 或发送 AI 提问后会显示", "Pinned SQL and AI prompts appear here")}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-200/75 bg-white/82 p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <ShieldCheck size={15} className="text-blue-700" />
                  {text("取证约束", "Forensic Guardrails")}
                </div>
                <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">{text("默认只读，不执行写入、删除、DDL 或多语句。", "Read-only by default; no writes, deletes, DDL or multi-statements.")}</div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">{text("优先看结构，再取样数据，最后沉淀线索。", "Inspect schema first, sample data second, preserve evidence last.")}</div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">{text(`共享线索：${records.length} 条`, `Shared clues: ${records.length}`)}</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {formConfig && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/30 p-3 backdrop-blur-md sm:p-6" onClick={() => setFormConfig(null)}>
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="ui-shell max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[2rem] p-4 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <ConnectionForm
              initialConfig={formConfig}
              onSave={handleSaveConnection}
              onCancel={() => setFormConfig(null)}
              onDelete={handleDeleteConnection}
              language={language}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
