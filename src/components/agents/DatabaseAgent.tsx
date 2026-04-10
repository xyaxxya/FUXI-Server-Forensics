import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import {
  ChevronDown,
  Database,
  Edit3,
  History,
  Loader2,
  Pin,
  Play,
  Plug,
  Plus,
  Send,
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
import ThinkingProcess, { ThinkingStep } from "./ThinkingProcess";
import { ChatTranscriptMessage } from "./ChatTranscriptMessage";
import { FloatingContextMenu, PlannerPanel, PreviewDialog, PromptDeck, SlashCommandMenu, WorkspaceHeader, getExactSlashCommand, getSlashCommandCompletion } from "./WorkbenchWidgets";

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

type DisplayItem =
  | { type: "message"; message: AIMessage }
  | { type: "thinking"; steps: ThinkingStep[]; isFinished: boolean };

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
      description: "列出指定数据库中的表和视图。",
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
      description: "读取指定表的建表语句。",
      parameters: {
        type: "object",
        properties: {
          database: { type: "string", description: "数据库名" },
          tables: { type: "array", items: { type: "string" }, description: "数据表列表" },
        },
        required: ["database", "tables"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_sql",
      description: "执行只读 SQL 查询，只允许 SELECT、SHOW、DESC、EXPLAIN、WITH。",
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
      description: "将数据库账号、异常表、管理员账号、关键配置等沉淀到共享线索池。",
      parameters: {
        type: "object",
        properties: {
          info: { type: "string", description: "要沉淀的关键线索" },
        },
        required: ["info"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_plan",
      description: "维护数据库调查计划，把当前待办、进行中、已完成步骤同步到计划面板。",
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
            title:
              typeof args.query === "string"
                ? args.query
                : display.title,
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
        step.toolCall.isError = /Execution failed|Exit:\s*[1-9]|仅允许只读/.test(message.content);
      }
    }
  }

  flush(false);
  return items;
}

function isReadOnlyQuery(query: string) {
  const normalized = query.trim().replace(/^[\s(]+/, "").toLowerCase();
  return /^(select|show|desc|describe|explain|with)\b/.test(normalized);
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
  const removePromptSnippet = useAIWorkspaceStore((state) => state.removePromptSnippet);
  const togglePromptSnippetPin = useAIWorkspaceStore((state) => state.togglePromptSnippetPin);
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
  const initialQueryTab = useMemo(() => createQueryTab(), []);
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>(() => [initialQueryTab]);
  const [activeTabId, setActiveTabId] = useState<string>(() => initialQueryTab.id);
  const [selection, setSelection] = useState<ExplorerSelection | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; actions: Array<{ label: string; onClick: () => void; danger?: boolean }> } | null>(null);
  const aiListEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const config = aiSettings.configs[aiSettings.activeProvider];
  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);
  const activeConnection = connections.find((item) => item.id === activeConnectionId) || null;
  const activeTab = queryTabs.find((item) => item.id === activeTabId) || queryTabs[0];
  const slashCommands = useMemo(
    () => [
      {
        id: "plan",
        command: "/plan",
        title: language === "zh" ? "生成数据库调查计划" : "Create database plan",
        description: language === "zh" ? "先输出调查步骤，再按步骤读库读表" : "Plan the database investigation first",
        insertText:
          language === "zh"
            ? "请先给出一份数据库调查计划，再按计划列库、列表示意、查看结构并逐步分析。"
            : "Create a database investigation plan first, then inspect databases, tables, schema and evidence step by step.",
      },
      {
        id: "schema",
        command: "/schema",
        title: language === "zh" ? "优先查看结构" : "Inspect schema first",
        description: language === "zh" ? "先梳理库表结构，再决定后续 SQL" : "Understand schema before querying data",
        insertText:
          language === "zh"
            ? "请先梳理当前数据库的库表结构和关键字段，再告诉我下一步最值得执行的只读 SQL。"
            : "Inspect the current schema and key fields first, then suggest the next read-only SQL to run.",
      },
      {
        id: "web",
        command: "/web",
        title: language === "zh" ? "联网查业务资料" : "Search the web",
        description: language === "zh" ? "结合公开资料理解库表含义或漏洞背景" : "Use public references to understand the database context",
        insertText:
          language === "zh"
            ? "请先联网搜索与当前数据库业务、字段命名或相关漏洞有关的公开资料，再结合数据库内容分析。"
            : "Search the public web for references about this database, naming conventions or related vulnerabilities before analyzing.",
      },
      {
        id: "clear",
        command: "/clear",
        title: language === "zh" ? "清空 AI 会话" : "Clear AI session",
        description: language === "zh" ? "清空数据库 AI 对话，保留连接与查询工作台" : "Clear AI chat while keeping connections and SQL tabs",
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

  const loadDatabases = async (connectionId: string, preferredDatabase?: string) => {
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
  };

  const loadDbObjects = async (database: string, connectionId = activeConnectionId || undefined) => {
    if (!connectionId) return;
    const response = await invoke<DbQueryResult>("exec_sql", {
      id: connectionId,
      query: `SHOW FULL TABLES FROM \`${database}\`;`,
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
        query: `SHOW FUNCTION STATUS WHERE Db = '${database}';`,
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
  };

  const handleSaveConnection = (nextConfig: DBConfig) => {
    const exists = connections.some((item) => item.id === nextConfig.id);
    if (exists) {
      updateConnection(nextConfig);
    } else {
      addConnection(nextConfig);
    }
    setFormConfig(null);
  };

  const handleDeleteConnection = async (id: string) => {
    if (activeConnectionId === id) {
      try {
        await invoke("disconnect_db", { id });
      } catch {
        // noop
      }
      setActiveConnection(null);
      setDatabases([]);
      setActiveDatabase(null);
      setDbObjects({});
      setSelection(null);
    }
    removeConnection(id);
    setFormConfig(null);
  };

  const handleConnect = async (connection: DBConfig) => {
    setConnectingId(connection.id);
    setStatus(language === "zh" ? `正在连接 ${connection.name}...` : `Connecting ${connection.name}...`);
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
      setStatus(language === "zh" ? "数据库连接成功" : "Database connected");
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
    setStatus(language === "zh" ? "数据库连接已断开" : "Database disconnected");
  };

  const runManualQuery = async (tabId: string, sqlOverride?: string) => {
    if (!activeConnectionId) {
      setStatus(language === "zh" ? "请先连接数据库。" : "Connect a database first.");
      return;
    }

    const currentTab = queryTabs.find((tab) => tab.id === tabId);
    if (!currentTab) return;
    const sql = (sqlOverride ?? currentTab.sql).trim();
    if (!sql) {
      setStatus(language === "zh" ? "请输入 SQL。" : "Enter a SQL query.");
      return;
    }
    if (!isReadOnlyQuery(sql)) {
      updateTab(tabId, (tab) => ({
        ...tab,
        error: language === "zh" ? "仅允许只读 SQL。" : "Only read-only SQL is allowed.",
        result: null,
      }));
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
        return [entry, ...prev.filter((item) => item.sql !== sql || item.database !== entry.database)].slice(0, 16);
      });
    } catch (error) {
      updateTab(tabId, (tab) => ({
        ...tab,
        sql,
        result: null,
        loading: false,
        error: String(error),
      }));
    }
  };

  const loadSchemaIntoTab = async (tabId: string, database: string, table: string) => {
    if (!activeConnectionId) return;
    try {
      const response = await invoke<DbQueryResult>("exec_sql", {
        id: activeConnectionId,
        query: `SHOW CREATE TABLE \`${database}\`.\`${table}\`;`,
      });
      const schema = response.rows[0]?.[1] || "";
      updateTab(tabId, (tab) => ({ ...tab, schema }));
    } catch (error) {
      updateTab(tabId, (tab) => ({ ...tab, schema: String(error) }));
    }
  };

  const openObject = async (database: string, objectName: string, objectType: ExplorerSelection["objectType"]) => {
    setSelection({ database, objectName, objectType });
    setWorkspaceMode("sql");
    setActiveDatabase(database);

    if (objectType === "table" || objectType === "view") {
      const existing = queryTabs.find((tab) => tab.title === `${database}.${objectName}`);
      if (existing) {
        setActiveTabId(existing.id);
        await loadSchemaIntoTab(existing.id, database, objectName);
        if (!existing.result) {
          await runManualQuery(existing.id, `SELECT * FROM \`${database}\`.\`${objectName}\` LIMIT 100;`);
        }
      } else {
        const nextTab: QueryTab = {
          id: crypto.randomUUID(),
          title: `${database}.${objectName}`,
          sql: `SELECT * FROM \`${database}\`.\`${objectName}\` LIMIT 100;`,
          result: null,
          error: "",
          loading: false,
          schema: "",
        };
        setQueryTabs((prev) => [...prev, nextTab]);
        setActiveTabId(nextTab.id);
        await loadSchemaIntoTab(nextTab.id, database, objectName);
        await runManualQuery(nextTab.id, nextTab.sql);
      }
    }
  };

  const executeToolCall = async (toolCall: ToolCall) => {
    const researchResult = await executeResearchTool(toolCall, language);
    if (researchResult) {
      return researchResult;
    }

    if (!activeConnectionId) {
      return {
        role: "tool",
        content: language === "zh" ? "当前没有活动数据库连接。" : "No active database connection.",
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    const args = JSON.parse(toolCall.function.arguments) as {
      database?: string;
      info?: string;
      query?: string;
      tables?: string[];
    };

    if (toolCall.function.name === "update_context_info") {
      if (args.info) {
        appendRecord({
          content: args.info,
          source: "database-agent",
        });
      }
      return {
        role: "tool",
        content: language === "zh" ? "共享线索池已更新。" : "Shared clue pool updated.",
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
        content: language === "zh" ? "执行计划已更新。" : "Execution plan updated.",
        tool_call_id: toolCall.id,
      } as AIMessage;
    }

    if (toolCall.function.name === "list_databases") {
      const response = await invoke<DbQueryResult>("exec_sql", {
        id: activeConnectionId,
        query: "SHOW DATABASES;",
      });
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
        query: `SHOW FULL TABLES FROM \`${database}\`;`,
      });
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
            query: `SHOW CREATE TABLE \`${database}\`.\`${table}\`;`,
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
          content: language === "zh" ? "仅允许只读 SQL。" : "Only read-only SQL is allowed.",
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
      content: language === "zh" ? "未知工具调用。" : "Unknown tool call.",
      tool_call_id: toolCall.id,
    } as AIMessage;
  };

  const handleStopAi = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAiLoading(false);
    setStatus(language === "zh" ? "已停止" : "Stopped");
  };

  const handleSendAi = async () => {
    if (!aiInput.trim() || aiLoading) return;
    if (!activeConnection) {
      setStatus(language === "zh" ? "请先连接数据库。" : "Connect a database first.");
      return;
    }
    if (!config.apiKey.trim()) {
      setStatus(language === "zh" ? "请先在设置中配置 AI Key。" : "Configure the AI key first.");
      return;
    }

    addPromptHistory(aiInput);
    const nextUserMessage: AIMessage = { role: "user", content: aiInput.trim() };
    const nextHistory = [...messages, nextUserMessage];
    setMessages(nextHistory);
    setAiInput("");
    setAiLoading(true);
    setWorkspaceMode("ai");
    setStatus(language === "zh" ? "数据库智能体正在分析..." : "Database agent is analyzing...");

    const workspaceInfo = buildWorkspacePromptContext(generalInfo, records);
    const promptContext = buildContextSections([
      { title: "当前连接", content: `${activeConnection.name} (${activeConnection.host}:${activeConnection.port})` },
      { title: "当前数据库", content: activeDatabase || activeConnection.database || "未指定" },
      { title: "共享线索池", content: workspaceInfo || "暂无" },
      {
        title: "约束",
        content:
          "你是数据库智查智能体。复杂问题先调用 update_plan 输出 3-6 步计划；必须优先列库、列表示意、读表结构，再执行只读 SQL。发现后台管理员账号、交易异常、数据库凭据或敏感配置时，立即调用 update_context_info 沉淀线索。",
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
            setStatus(language === "zh" ? "正在处理查询结果..." : "Processing query result...");
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
  return (
    <div className="h-full grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[280px_300px_minmax(0,1fr)]">
      <section className="ui-shell order-1 min-h-0 overflow-hidden rounded-[2rem] 2xl:order-3" data-context-scope="agent-database">
        <WorkspaceHeader
          language={language}
          icon={Database}
          title={language === "zh" ? "数据库智查" : "Database Intel"}
          description={
            language === "zh"
              ? "类似 Navicat 的对象浏览与 SQL 工作台，叠加 AI 智查能力。"
              : "A Navicat-like object browser and SQL workspace with AI investigation."
          }
          aiSettings={aiSettings}
          sessionInfo={
            activeConnection
              ? `${activeConnection.name} · ${activeConnection.host}:${activeConnection.port}`
              : language === "zh"
                ? "未连接数据库"
                : "No database"
          }
          extraItems={[
            { label: language === "zh" ? "库" : "DB", value: activeDatabase || "-" },
            { label: language === "zh" ? "线索" : "Clues", value: String(records.length) },
            { label: language === "zh" ? "任务" : "Tasks", value: String(tasks.length) },
            { label: language === "zh" ? "历史" : "History", value: String(queryHistory.length) },
          ]}
          actions={
            aiLoading ? (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                onClick={handleStopAi}
                className="ui-button-danger ui-pressable ui-focus-ring inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium"
              >
                <Square size={16} />
                {language === "zh" ? "停止" : "Stop"}
              </motion.button>
            ) : null
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            {(["sql", "ai"] as WorkspaceMode[]).map((mode) => {
              const active = workspaceMode === mode;
              return (
                <motion.button
                  key={mode}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => setWorkspaceMode(mode)}
                  className={`ui-pressable ui-focus-ring rounded-2xl px-4 py-2.5 text-sm font-medium ${
                    active ? "ui-chip-active" : "ui-chip text-slate-600"
                  }`}
                >
                  {mode === "sql" ? (language === "zh" ? "SQL 工作台" : "SQL Workspace") : language === "zh" ? "AI 智查" : "AI Intel"}
                </motion.button>
              );
            })}
            <div className="ml-auto flex items-center gap-2">
              <select
                value={activeDatabase || ""}
                onChange={async (event) => {
                  const database = event.target.value || null;
                  setActiveDatabase(database);
                  if (database) {
                    await loadDbObjects(database);
                  }
                }}
                className="ui-input-base rounded-2xl px-4 py-2.5 text-sm text-slate-700"
              >
                {!activeDatabase && <option value="">{language === "zh" ? "选择数据库" : "Select database"}</option>}
                {databases.map((database) => (
                  <option key={database} value={database}>
                    {database}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </WorkspaceHeader>

        {workspaceMode === "sql" ? (
          <div className="flex h-[calc(100%-169px)] flex-col">
            <div className="border-b border-slate-200/70 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {queryTabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`ui-pressable rounded-2xl px-3 py-2 text-sm font-medium ${
                      tab.id === activeTabId ? "ui-chip-active" : "ui-chip text-slate-600"
                    }`}
                  >
                    <span>{tab.title || `Query ${index + 1}`}</span>
                    {queryTabs.length > 1 && (
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          const nextTabs = queryTabs.filter((item) => item.id !== tab.id);
                          setQueryTabs(nextTabs);
                          if (activeTabId === tab.id && nextTabs[0]) {
                            setActiveTabId(nextTabs[0].id);
                          }
                        }}
                        className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-slate-200"
                      >
                        <X size={11} />
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const next = createQueryTab(queryTabs.length + 1);
                    setQueryTabs((prev) => [...prev, next]);
                    setActiveTabId(next.id);
                  }}
                  className="ui-button ui-pressable rounded-2xl px-3 py-2 text-sm font-medium text-slate-600"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="grid h-full grid-cols-1 gap-4 overflow-auto p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="flex min-h-0 flex-col gap-4">
                <div className="ui-surface flex min-h-[240px] flex-col rounded-[1.6rem] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{language === "zh" ? "SQL 编辑器" : "SQL Editor"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {language === "zh" ? "仅允许执行只读 SQL。" : "Only read-only SQL is allowed."}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() =>
                          setQueryHistory((prev) => {
                            const sql = activeTab.sql.trim();
                            if (!sql) {
                              return prev;
                            }
                            const entry: QueryHistoryItem = {
                              id: crypto.randomUUID(),
                              sql,
                              database: activeDatabase || activeConnection?.database || null,
                              createdAt: Date.now(),
                              pinned: true,
                            };
                            return [entry, ...prev.filter((item) => item.sql !== sql || item.database !== entry.database)].slice(0, 16);
                          })
                        }
                        className="ui-button ui-pressable rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-600"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Pin size={15} />
                          {language === "zh" ? "收藏 SQL" : "Pin SQL"}
                        </span>
                      </motion.button>
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => updateTab(activeTab.id, (tab) => ({ ...tab, sql: "" }))}
                        className="ui-button ui-pressable rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-600"
                      >
                        {language === "zh" ? "清空 SQL" : "Clear SQL"}
                      </motion.button>
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => void runManualQuery(activeTab.id)}
                        className="ui-button-primary ui-pressable rounded-2xl px-4 py-2.5 text-sm font-medium"
                      >
                        <span className="inline-flex items-center gap-2">
                          {activeTab.loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                          {language === "zh" ? "运行" : "Run"}
                        </span>
                      </motion.button>
                    </div>
                  </div>
                  <textarea
                    value={activeTab.sql}
                    onChange={(event) => updateTab(activeTab.id, (tab) => ({ ...tab, sql: event.target.value }))}
                    className="ui-input-base mt-4 min-h-[180px] flex-1 resize-none rounded-[1.4rem] px-4 py-4 font-mono text-sm text-slate-700"
                    placeholder={
                      language === "zh"
                        ? "例如：SELECT * FROM users LIMIT 100;"
                        : "Example: SELECT * FROM users LIMIT 100;"
                    }
                  />
                </div>

                <div className="ui-surface min-h-0 flex-1 rounded-[1.6rem] overflow-hidden">
                  <div className="border-b border-slate-200/70 px-4 py-3 text-sm font-semibold text-slate-900">
                    {language === "zh" ? "查询结果" : "Query Result"}
                  </div>
                  <div className="h-[calc(100%-49px)] overflow-auto p-4">
                    {activeTab.error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{activeTab.error}</div>}
                    {!activeTab.error && activeTab.result && (
                      <DataTable
                        headers={activeTab.result.headers}
                        rows={activeTab.result.rows}
                        language={language}
                        title={language === "zh" ? "结果集" : "Result Set"}
                      />
                    )}
                    {!activeTab.error && !activeTab.result && (
                      <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
                        {language === "zh" ? "运行 SQL 后，这里显示结果。" : "Run a query to see results here."}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col gap-4">
                <div className="ui-surface rounded-[1.6rem] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <History size={16} />
                    {language === "zh" ? "查询历史" : "Query History"}
                  </div>
                  <div className="mt-3 space-y-2">
                    {queryHistory.length === 0 && (
                      <div className="text-sm text-slate-400">{language === "zh" ? "运行 SQL 后自动记录。" : "History appears after running queries."}</div>
                    )}
                    {queryHistory.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          updateTab(activeTab.id, (tab) => ({ ...tab, sql: item.sql }));
                          if (item.database) {
                            setActiveDatabase(item.database);
                          }
                        }}
                        onDoubleClick={() => setPreview({ title: item.database || "SQL", content: item.sql })}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setMenu({
                            x: event.clientX,
                            y: event.clientY,
                            actions: [
                              {
                                label: language === "zh" ? "查看 SQL" : "Preview SQL",
                                onClick: () => setPreview({ title: item.database || "SQL", content: item.sql }),
                              },
                              {
                                label: language === "zh" ? "复制 SQL" : "Copy SQL",
                                onClick: () => void navigator.clipboard.writeText(item.sql),
                              },
                              {
                                label: item.pinned ? (language === "zh" ? "取消收藏" : "Unpin") : language === "zh" ? "收藏 SQL" : "Pin SQL",
                                onClick: () =>
                                  setQueryHistory((prev) =>
                                    prev.map((historyItem) =>
                                      historyItem.id === item.id ? { ...historyItem, pinned: !historyItem.pinned } : historyItem,
                                    ),
                                  ),
                              },
                            ],
                          });
                        }}
                        className={`block w-full rounded-[1.2rem] px-3.5 py-3 text-left text-sm ${
                          item.pinned ? "ui-chip-active" : "ui-subtle-surface text-slate-600"
                        }`}
                      >
                        <div className="line-clamp-2">{item.sql}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.database || "-"}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ui-surface rounded-[1.6rem] p-4">
                  <div className="text-sm font-semibold text-slate-900">{language === "zh" ? "对象信息" : "Object Info"}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    {selection
                      ? `${selection.database} / ${selection.objectType} / ${selection.objectName}`
                      : language === "zh"
                        ? "从左侧对象浏览器选择表或视图以快速预览。"
                        : "Choose a table or view from the explorer to preview it."}
                  </div>
                </div>
                <div className="ui-surface min-h-0 flex-1 rounded-[1.6rem] overflow-hidden">
                  <div className="border-b border-slate-200/70 px-4 py-3 text-sm font-semibold text-slate-900">
                    {language === "zh" ? "结构预览" : "Schema Preview"}
                  </div>
                  <div className="h-[calc(100%-49px)] overflow-auto bg-slate-50/60 p-4">
                    <pre className="whitespace-pre-wrap text-xs leading-6 text-slate-700 font-mono">
                      {activeTab.schema || (language === "zh" ? "打开对象后会显示建表结构。" : "Open an object to see schema here.")}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[calc(100%-169px)] flex-col">
            <div className="flex-1 overflow-auto bg-slate-50/50 px-4 py-4 md:px-6">
              {messages.length === 0 && (
                <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
                  {language === "zh"
                    ? "示例：找出后台管理员账号、统计异常充值、定位数据库中保存的网站配置。"
                    : "Example: find admin accounts, suspicious transactions or web configs in the database."}
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
                    <span className={`h-2 w-2 rounded-full ${aiLoading ? "bg-blue-500 animate-pulse" : "bg-slate-400"}`} />
                    {aiLoading && <Loader2 size={13} className="animate-spin" />}
                    {status}
                  </div>
                )}
                <div ref={aiListEndRef} />
              </div>
            </div>

            <div className="sticky bottom-0 z-20 border-t border-slate-200/70 bg-white/78 p-4 backdrop-blur-xl">
              <div className="mb-3 flex flex-wrap gap-2">
                {promptHistory.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setAiInput(prompt)}
                    className="ui-chip ui-pressable rounded-2xl px-3 py-2 text-sm text-slate-600"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="ui-subtle-surface rounded-[1.8rem] border border-white/70 bg-white/90 p-3 shadow-[0_30px_60px_-34px_rgba(15,23,42,0.26)] sm:p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{language === "zh" ? "数据库提问" : "Database Question"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {language === "zh"
                        ? "可直接描述调查目标，AI 会结合库表结构和 SQL 结果继续分析。"
                        : "Describe the investigation goal and the AI will continue from schema and SQL results."}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => void handleSendAi()}
                    disabled={aiLoading || !aiInput.trim() || aiInput.trim().startsWith("/")}
                    className="ui-button-primary ui-pressable inline-flex items-center justify-center gap-2 rounded-[1.2rem] px-4 py-2.5 text-sm font-medium disabled:bg-slate-300 disabled:border-slate-300 sm:self-start"
                  >
                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {language === "zh" ? "发送问题" : "Send"}
                  </motion.button>
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
                      if (aiInput.trim().startsWith("/")) {
                        const exactCommand = getExactSlashCommand(aiInput, slashCommands);
                        if (exactCommand) {
                          if (exactCommand.onSelect) {
                            exactCommand.onSelect();
                          } else {
                            setAiInput(exactCommand.insertText || exactCommand.command);
                          }
                        }
                      } else {
                        void handleSendAi();
                      }
                    }
                  }}
                  placeholder={
                    language === "zh"
                      ? "输入数据库调查问题，或输入 / 打开命令面板，例如：找出管理员账号、统计异常充值、提取系统配置。"
                      : "Ask a database investigation question, or type / to open the command palette."
                  }
                  className="ui-input-base min-h-[120px] w-full resize-none rounded-[1.4rem] border-white/0 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 shadow-inner"
                />
                <SlashCommandMenu
                  language={language}
                  input={aiInput}
                  commands={slashCommands}
                  onUse={(command) => {
                    setWorkspaceMode("ai");
                    if (command.onSelect) {
                      command.onSelect();
                      return;
                    }
                    setAiInput(command.insertText || "");
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <aside className="ui-shell order-2 min-h-0 overflow-hidden rounded-[2rem] xl:order-3 2xl:order-2">
        <div className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 via-white to-blue-50 text-slate-700 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.16)]">
              <Table2 size={18} />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-900">{language === "zh" ? "对象浏览器" : "Object Explorer"}</div>
              <div className="text-xs text-slate-500">{language === "zh" ? "数据库、表、视图与函数" : "Databases, tables, views and functions"}</div>
            </div>
          </div>
        </div>
        <div className="h-[calc(100%-80px)] overflow-auto p-4 custom-scrollbar">
          {databases.length === 0 && (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
              {language === "zh" ? "连接数据库后，这里会显示对象结构。" : "Connect a database to load objects."}
            </div>
          )}
          <div className="space-y-3">
            {databases.map((database) => {
              const isExpanded = expandedDbs.includes(database);
              const groups = expandedGroups[database] || [];
              const objects = dbObjects[database];
              return (
                <div key={database} className="ui-subtle-surface rounded-[1.5rem] p-3">
                  <button
                    onClick={() => void toggleDbExpand(database)}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{database}</div>
                      <div className="text-xs text-slate-500">
                        {objects ? `${objects.tables.length} table · ${objects.views.length} view` : language === "zh" ? "点击展开载入" : "Expand to load"}
                      </div>
                    </div>
                    <ChevronDown className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} size={16} />
                  </button>
                  {isExpanded && (
                    <div className="mt-2 space-y-2">
                      {(["tables", "views", "functions"] as const).map((group) => {
                        const items = objects?.[group] || [];
                        const isGroupExpanded = groups.includes(group);
                        const groupLabel =
                          group === "tables" ? (language === "zh" ? "表" : "Tables") : group === "views" ? (language === "zh" ? "视图" : "Views") : language === "zh" ? "函数" : "Functions";
                        return (
                          <div key={group} className="rounded-2xl bg-white/70 p-2">
                            <button
                              onClick={() => toggleGroup(database, group)}
                              className="flex w-full items-center justify-between px-2 py-1.5 text-sm font-medium text-slate-700"
                            >
                              <span>{groupLabel}</span>
                              <ChevronDown className={`transition-transform ${isGroupExpanded ? "rotate-180" : ""}`} size={14} />
                            </button>
                            {isGroupExpanded && (
                              <div className="mt-1 space-y-1">
                                {items.length === 0 && <div className="px-2 py-2 text-xs text-slate-400">{language === "zh" ? "暂无对象" : "No objects"}</div>}
                                {items.map((item) => (
                                  <button
                                    key={item}
                                    onClick={() =>
                                      void openObject(
                                        database,
                                        item,
                                        group === "tables" ? "table" : group === "views" ? "view" : "function",
                                      )
                                    }
                                    className={`ui-pressable flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm ${
                                      selection?.database === database && selection.objectName === item
                                        ? "ui-chip-active"
                                        : "text-slate-600 hover:bg-slate-100"
                                    }`}
                                  >
                                    <Table2 size={14} />
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
              );
            })}
          </div>
        </div>
      </aside>

      <aside className="ui-shell order-3 min-h-0 overflow-hidden rounded-[2rem] xl:order-2 2xl:order-1">
        <div className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-slate-900">{language === "zh" ? "数据库连接" : "Connections"}</div>
              <div className="text-xs text-slate-500">{language === "zh" ? "支持保存连接并通过 SSH 隧道接入目标数据库" : "Saved connections with SSH tunneling support"}</div>
            </div>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              onClick={() =>
                setFormConfig({
                  id: crypto.randomUUID(),
                  name: language === "zh" ? "新建连接" : "New Connection",
                  user: "root",
                  pass: "",
                  host: "127.0.0.1",
                  port: 3306,
                  database: "",
                  useSsh: false,
                  ssh: { ip: "", port: 22, user: "root", pass: "" },
                })
              }
              className="ui-button-primary ui-pressable rounded-2xl p-2.5"
            >
              <Plus size={16} />
            </motion.button>
          </div>
        </div>
        <div className="h-[calc(100%-80px)] overflow-auto p-4 custom-scrollbar">
          {connections.length === 0 && (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
              {language === "zh" ? "还没有数据库连接，点击右上角添加。" : "No saved connections yet."}
            </div>
          )}
          <div className="space-y-3">
            {connections.map((connection) => {
              const isActive = connection.id === activeConnectionId;
              const isConnecting = connectingId === connection.id;
              return (
                <motion.div
                  key={connection.id}
                  whileHover={{ y: -2 }}
                  className={`ui-subtle-surface rounded-[1.6rem] p-4 ${isActive ? "ring-1 ring-blue-200" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{connection.name}</div>
                      <div className="mt-1 text-xs font-mono text-slate-500">{connection.host}:{connection.port}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {connection.useSsh
                          ? language === "zh"
                            ? "SSH 隧道"
                            : "SSH tunnel"
                          : language === "zh"
                            ? "直连"
                            : "Direct"}
                      </div>
                    </div>
                    <button
                      onClick={() => setFormConfig(connection)}
                      className="ui-button ui-pressable rounded-xl p-2 text-slate-500"
                    >
                      <Edit3 size={15} />
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {isActive ? (
                      <button
                        onClick={() => void handleDisconnect()}
                        className="ui-button-danger ui-pressable flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium"
                      >
                        <Unplug size={15} />
                        {language === "zh" ? "断开" : "Disconnect"}
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleConnect(connection)}
                        disabled={!!connectingId}
                        className="ui-button-primary ui-pressable flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium disabled:bg-slate-300 disabled:border-slate-300"
                      >
                        {isConnecting ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />}
                        {language === "zh" ? "连接" : "Connect"}
                      </button>
                    )}
                    <button
                      onClick={() => void handleDeleteConnection(connection.id)}
                      className="ui-button ui-pressable rounded-2xl p-2.5 text-slate-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
            {status && <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-500">{status}</div>}
          </div>
        </div>
      </aside>

      <div className="order-4 custom-scrollbar max-h-full overflow-auto pr-1 space-y-4 2xl:col-span-3">
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[360px_minmax(0,1fr)]">
          <PlannerPanel
            language={language}
            tasks={tasks}
            onClear={() => clearTasks()}
            onUpdateTaskStatus={updateTaskStatus}
            onRemoveTask={removeTask}
          />
          <PromptDeck
            language={language}
            title={language === "zh" ? "数据库提示词库" : "Database Prompt Deck"}
            promptHistory={promptHistory}
            promptSnippets={promptSnippets}
            currentInput={aiInput}
            onUsePrompt={(value) => {
              setWorkspaceMode("ai");
              setAiInput(value);
            }}
            onSaveCurrent={() => savePromptSnippet({ content: aiInput, pinned: false })}
            onSaveHistoryPrompt={(value) => savePromptSnippet({ content: value, pinned: false })}
            onRemoveSnippet={removePromptSnippet}
            onTogglePin={togglePromptSnippetPin}
          />
        </div>
      </div>
      <FloatingContextMenu menu={menu} onClose={() => setMenu(null)} />
      {preview && <PreviewDialog title={preview.title} content={preview.content} onClose={() => setPreview(null)} />}

      {formConfig && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/30 backdrop-blur-md p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="ui-shell max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[2rem] p-4 sm:p-6"
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
