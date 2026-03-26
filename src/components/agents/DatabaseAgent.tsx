import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Send,
  Loader2,
  Sparkles,
  Trash2,
  Server,
  Check,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AIMessage, AISettings, sendToAI, Tool } from "../../lib/ai";
import { translations, Language } from "../../translations";
import ThinkingProcess, { ThinkingStep } from "./ThinkingProcess";
import { useToast } from "../Toast";
import { getFriendlyError } from "../../lib/errorHandler";

// --- Types (Mirrored from MySQLManager) ---
interface SshConfig {
  ip: string;
  port: number;
  user: string;
  pass?: string;
  private_key?: string;
}

interface DBConfig {
  id: string;
  name: string;
  user: string;
  pass: string;
  host: string;
  port: number;
  database: string;
  useSsh: boolean;
  ssh?: SshConfig;
}

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
  chatUserProfile?: {
    qq?: string | null;
    avatar?: string | null;
  };
}

type DisplayItem = 
  | { type: 'message', message: AIMessage }
  | { type: 'thinking', steps: ThinkingStep[], isFinished: boolean };

export default function DatabaseAgent({ language, aiSettings, onAiSettingsChange, chatUserProfile }: DatabaseAgentProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [autoSkillStatus, setAutoSkillStatus] = useState<string>("");
  const { showToast } = useToast();
  
  // Connection State
  const [connections, setConnections] = useState<DBConfig[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSummaryMode, setIsSummaryMode] = useState(true);
  const [userAvatarFailed, setUserAvatarFailed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = translations[language];
  const normalizedAvatar = chatUserProfile?.avatar?.trim() || "";
  const qq = (chatUserProfile?.qq || "").trim();
  const qqAvatarSrc = qq ? `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(qq)}&s=100` : "";
  const avatarFromLicense = normalizedAvatar
    ? normalizedAvatar.startsWith("data:")
      ? normalizedAvatar
      : `data:image/png;base64,${normalizedAvatar}`
    : "";
  const userAvatarSrc = qqAvatarSrc || avatarFromLicense;

  useEffect(() => {
    setUserAvatarFailed(false);
  }, [userAvatarSrc]);

  // Load connections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('db_connections');
    if (saved) {
      try {
        setConnections(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse db_connections", e);
      }
    }
  }, []);

  // Format helper
  const format = (str: string, ...args: any[]) => {
    return str.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };

  // Connect to DB
  const handleConnect = async (connId: string) => {
    const config = connections.find(c => c.id === connId);
    if (!config) return;

    setIsConnecting(true);
    try {
      const sshConfig = config.useSsh ? config.ssh : undefined;
      await invoke('connect_db', {
        id: config.id,
        host: config.host,
        port: config.port,
        user: config.user,
        pass: config.pass,
        database: config.database || 'mysql', 
        sshConfig: sshConfig
      });
      
      setActiveConnectionId(config.id);
      
      // Fetch Databases
      const res = await invoke<DbQueryResult>('exec_sql', {
        id: config.id,
        query: 'SHOW DATABASES;'
      });
      
      const dbs = res.rows.map(r => r[0]);
      setDatabases(dbs);
      if (config.database && dbs.includes(config.database)) {
        setSelectedDb(config.database);
      } else if (dbs.length > 0) {
        setSelectedDb(dbs[0] === 'information_schema' && dbs.length > 1 ? dbs[1] : dbs[0]);
      }
      
      showToast('success', language === 'zh' ? `已连接到 ${config.name}` : `Connected to ${config.name}`, 2000);
    } catch (e: any) {
      const friendlyError = getFriendlyError(e, language);
      showToast('error', friendlyError.message, 4000);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (activeConnectionId) {
      try {
        await invoke('disconnect_db', { id: activeConnectionId });
      } catch (e) {
        console.error(e);
      }
      setActiveConnectionId(null);
      setDatabases([]);
      setSelectedDb(null);
    }
  };

  // --- Chat Logic (Similar to GeneralAgent) ---

  const getDisplayItems = (msgs: AIMessage[]): DisplayItem[] => {
    const items: DisplayItem[] = [];
    let currentThinking: ThinkingStep[] = [];
    
    const flushThinking = (isFinished: boolean) => {
      if (currentThinking.length > 0) {
        items.push({ type: 'thinking', steps: [...currentThinking], isFinished });
        currentThinking = [];
      }
    };

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.role === 'user') {
        flushThinking(true);
        items.push({ type: 'message', message: msg });
        continue;
      }
      if (msg.role === 'system') continue;

      if (msg.role === 'assistant') {
        const content = msg.content || "";
        // Heuristics for thinking
        const isThinking = (msg.tool_calls && msg.tool_calls.length > 0) || 
                           (content.includes("Analysis") && content.length < 500);

        if (isThinking) {
          if (msg.content) {
             currentThinking.push({ id: `thought-${i}`, title: msg.content });
          }
          if (msg.tool_calls) {
            msg.tool_calls.forEach((tc) => {
               let args: any = {};
               try { args = JSON.parse(tc.function.arguments); } catch (e) { args = { command: tc.function.arguments }; }
               
               let title = `${t.call}: ${tc.function.name}`;
               if (tc.function.name === 'run_sql') title = `${t.execute}: ${args.query?.substring(0, 50)}${args.query?.length > 50 ? '...' : ''}`;
               
               currentThinking.push({
                 id: tc.id,
                 title: title,
                 toolCall: { command: args.query || tc.function.name, args: args, isLoading: true }
               });
            });
          }
        } else {
          flushThinking(true);
          items.push({ type: 'message', message: msg });
        }
      } else if (msg.role === 'tool') {
          const stepIndex = currentThinking.findIndex(s => s.id === msg.tool_call_id);
          if (stepIndex !== -1) {
              const step = currentThinking[stepIndex];
              if (step.toolCall) {
                  step.toolCall.output = msg.content;
                  step.toolCall.isLoading = false;
                  if (msg.content.includes("Error:")) step.toolCall.isError = true;
              }
          } else {
              currentThinking.push({
                  id: `tool-res-${i}`,
                  title: t.tool_output,
                  toolCall: { command: t.unknown, args: {}, output: msg.content, isLoading: false }
              });
          }
      }
    }
    flushThinking(false);
    return items;
  };

  const displayItems = getDisplayItems(messages);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading, status, displayItems.length]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;
    if (!activeConnectionId || !selectedDb) {
        const friendlyError = getFriendlyError(
          new Error('NO_DB_CONNECTION'), 
          language
        );
        showToast('warning', friendlyError.message, 3000);
        return;
    }

    const config = aiSettings.configs[aiSettings.activeProvider];
    if (!config.apiKey) {
      showToast('warning', format(t.configure_api_key, config.name), 3000);
      return;
    }

    const msgToStore: AIMessage = { role: "user", content: input };
    setMessages(prev => [...prev, msgToStore]);
    setInput("");
    setLoading(true);
    setStatus(t.ai_thinking);

    try {
      await processConversation([...messages, msgToStore]);
    } catch (error: any) {
      const friendlyError = getFriendlyError(error, language);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `❌ ${friendlyError.title}\n\n${friendlyError.message}${friendlyError.suggestion ? '\n\n💡 ' + friendlyError.suggestion : ''}` 
      }]);
      showToast('error', friendlyError.title, 3000);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const processConversation = async (history: AIMessage[], depth = 0) => {
    if (depth > (aiSettings.maxLoops || 25)) {
        setMessages(prev => [...prev, { role: 'assistant', content: t.max_loops_reached }]);
        return;
    }

    const tools: Tool[] = [
        {
            type: "function",
            function: {
                name: "list_tables",
                description: "List all tables in the current database.",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "get_schema",
                description: "Get the CREATE TABLE statement for specific tables to understand their structure.",
                parameters: {
                    type: "object",
                    properties: {
                        tables: { type: "array", items: { type: "string" }, description: "List of table names" }
                    },
                    required: ["tables"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "run_sql",
                description: "Execute a SELECT SQL query to retrieve data. Do NOT run UPDATE/DELETE/DROP.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "The SQL query to execute" }
                    },
                    required: ["query"]
                }
            }
        }
    ];

    // Inject System Prompt
    let effectiveHistory = [...history];
    if (!effectiveHistory.some(m => m.role === 'system')) {
        effectiveHistory.unshift({
            role: 'system',
            content: `你是一名数据库专家智能体。
当前数据库: ${selectedDb}
你的目标是通过查询数据库来回答用户的问题。

背景：
这是一个涉诈案件取证场景。嫌疑人搭建了虚假的投资理财网站，并作为管理员在后台进行操控。
我们的目标是找出这些嫌疑人（即网站管理员/后台操作员）的痕迹。

规则：
1. 在查询之前，务必先检查表结构 (get_schema) 以确保列名正确。
2. 仅执行只读查询 (SELECT)。
3. 系统会自动将查询结果以丰富的数据表格形式展示给用户。
   - 不要 尝试输出 Markdown 表格来展示大量数据集。
   - 只需说“查询结果如下：”或类似的话，让工具输出来处理展示。
   ${!isSummaryMode ? `
   - 严禁对数据进行总结或解释。
   - 直接返回查询工具的结果。
   - 不要在回复中包含具体数据的文本描述。
   - 工具执行完毕后，必须回复一句话确认，例如“查询已完成，结果如下表所示”或“已找到相关数据”，以确保消息气泡出现。` : `
   - 你可以结合表格数据，对结果进行简要的分析和总结。
   - 指出关键发现（如异常IP、大额资金等）。`}
4. 当用户询问“嫌疑人线索”或“管理员”时，请重点关注：
   - 后台管理员表 (admin, manager, system_user 等)。
   - 拥有最高权限或特殊权限的账户。
   - “资金池”账户或余额异常巨大的内部账户。
   - 管理员登录日志 (login_log, admin_log)，提取登录 IP。
   - 后台操作日志 (operation_log, action_log)，查找手动修改用户余额/改分的操作。
5. 必须使用提供的工具。
6. 思考过程 (Thinking Process) 请使用中文。`
        });
    }

    // Intercept history to truncate large tool outputs for AI context
    const contextHistory = effectiveHistory.map(m => {
        if (m.role === 'tool') {
            try {
                const parsed = JSON.parse(m.content);
                if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 20) {
                    const truncated = { ...parsed, rows: parsed.rows.slice(0, 20) };
                    return { ...m, content: JSON.stringify(truncated) + `\n...(Truncated ${parsed.rows.length - 20} rows)...` };
                }
            } catch (e) {
                // Not JSON, keep as is
            }
        }
        return m;
    });

    try {
      const response = await sendToAI(contextHistory, aiSettings, tools);
      setAutoSkillStatus(response.routing_info?.status_text || "");
      const newHistory = [...history, response];
      setMessages(newHistory);

      if (response.usage && onAiSettingsChange) {
          const currentUsage = aiSettings.tokenUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
          onAiSettingsChange({
              ...aiSettings,
              tokenUsage: {
                  prompt_tokens: currentUsage.prompt_tokens + response.usage.prompt_tokens,
                  completion_tokens: currentUsage.completion_tokens + response.usage.completion_tokens,
                  total_tokens: currentUsage.total_tokens + response.usage.total_tokens,
              }
          });
      }

      if (response.tool_calls && response.tool_calls.length > 0) {
        setStatus(t.executing_command);
        
        for (const toolCall of response.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            let output = "";

            try {
                if (toolCall.function.name === 'list_tables') {
                    const res = await invoke<DbQueryResult>('exec_sql', {
                        id: activeConnectionId,
                        query: `SHOW TABLES FROM \`${selectedDb}\``
                    });
                    output = JSON.stringify(res.rows.map(r => r[0]));
                } else if (toolCall.function.name === 'get_schema') {
                    const tables = args.tables as string[];
                    let schemas = [];
                    for (const table of tables) {
                        try {
                            const res = await invoke<DbQueryResult>('exec_sql', {
                                id: activeConnectionId,
                                query: `SHOW CREATE TABLE \`${selectedDb}\`.\`${table}\``
                            });
                            if (res.rows.length > 0) schemas.push(res.rows[0][1]);
                        } catch (e) {
                            schemas.push(`Error fetching schema for ${table}: ${e}`);
                        }
                    }
                    output = schemas.join("\n\n");
                } else if (toolCall.function.name === 'run_sql') {
                    const res = await invoke<DbQueryResult>('exec_sql', {
                        id: activeConnectionId,
                        query: args.query,
                        db: selectedDb
                    });
                    
                    // Always return full JSON for UI to render
                    output = JSON.stringify(res);

                    // For AI Context, we must truncate if too large to avoid token limits
                    if (res.rows && res.rows.length > 20) {
                        // const truncatedRes = { ...res, rows: res.rows.slice(0, 20) };
                        // aiContextOutput = JSON.stringify(truncatedRes) + `\n...(Truncated ${res.rows.length - 20} rows for AI context, but user sees all)...`;
                    }
                    
                    // We need to distinguish between what AI sees and what UI shows.
                    // Currently `messages` stores both.
                    // Hack: We store the full output in the tool message. 
                    // But when sending to AI, we will intercept and truncate.
                    // See `processConversation` logic below where we send `effectiveHistory`.
                }
            } catch (e: any) {
                output = `Error: ${e.toString()}`;
            }

            newHistory.push({
                role: 'tool',
                content: output,
                tool_call_id: toolCall.id
            });
        }
        
        setMessages(newHistory);
        setStatus(t.analyzing_results);
        await processConversation(newHistory, depth + 1);
      }

    } catch (e) {
        throw e;
    }
  };

  const activeConnectionName = connections.find(c => c.id === activeConnectionId)?.name;

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden min-w-0">
        {/* Left Sidebar: Connections */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Database size={18} className="text-indigo-500" />
                    {language === 'zh' ? '数据库列表' : 'Databases'}
                </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {connections.length === 0 ? (
                    <div className="text-center p-4 text-slate-400 text-sm">
                        {language === 'zh' ? '请先在数据库管理器中添加连接' : 'Add connections in Database Manager first'}
                    </div>
                ) : (
                    connections.map(c => (
                        <div key={c.id} className={`p-3 rounded-lg border transition-all ${activeConnectionId === c.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="font-semibold text-slate-700 truncate" title={c.name}>{c.name}</div>
                                {activeConnectionId === c.id && <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mb-3">{c.host}</div>
                            
                            {activeConnectionId === c.id ? (
                                <div className="space-y-2">
                                    <select 
                                        className="w-full p-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={selectedDb || ""}
                                        onChange={(e) => setSelectedDb(e.target.value)}
                                    >
                                        {databases.map(db => <option key={db} value={db}>{db}</option>)}
                                    </select>
                                    <button 
                                        onClick={handleDisconnect}
                                        className="w-full py-1.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-100 transition-colors"
                                    >
                                        {t.disconnect}
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => handleConnect(c.id)}
                                    disabled={isConnecting}
                                    className="w-full py-1.5 text-xs bg-white text-indigo-600 rounded hover:bg-indigo-50 border border-indigo-100 transition-colors flex items-center justify-center gap-1"
                                >
                                    {isConnecting ? <Loader2 size={12} className="animate-spin"/> : <Server size={12} />}
                                    {t.connect_server_btn}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white min-w-0">
            {/* Header */}
            <div className="h-16 border-b border-slate-200 flex items-center justify-between px-4 bg-white min-w-0 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Sparkles size={18} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-bold text-slate-800 text-sm">
                            {language === 'zh' ? '数据库智能助手' : 'Database AI Agent'}
                        </h2>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            {activeConnectionId ? (
                                <span className="text-green-600 flex items-center gap-1 min-w-0 truncate">
                                    {activeConnectionName} / {selectedDb}
                                </span>
                            ) : (
                                <span className="text-slate-400">{t.not_connected}</span>
                            )}
                        </div>
                        <div className="text-[11px] text-sky-600 truncate mt-0.5">{autoSkillStatus || t.skill_auto_detect_waiting}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button
                        onClick={() => setIsSummaryMode(!isSummaryMode)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium ${
                            isSummaryMode ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"
                        }`}
                        title={language === 'zh' ? "是否让AI总结分析查询结果" : "Toggle summary mode"}
                     >
                        <div className={`w-3 h-3 rounded-sm border ${isSummaryMode ? "bg-indigo-600 border-indigo-600" : "border-slate-400"}`}>
                            {isSummaryMode && <Check size={10} className="text-white" />}
                        </div>
                        {language === 'zh' ? '总结模式' : 'Summary Mode'}
                     </button>
                     <button
                        onClick={() => setMessages([])}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title={t.clear_chat}
                     >
                        <Trash2 size={18} />
                     </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 custom-scrollbar min-w-0">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-4">
                        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
                            <Database size={32} className="text-indigo-300" />
                        </div>
                        <p className="text-sm max-w-xs">
                            {language === 'zh' 
                                ? '连接数据库后，您可以直接用自然语言查询数据、分析表结构或生成报表。' 
                                : 'Connect to a database to query data, analyze structure, or generate reports using natural language.'}
                        </p>
                    </div>
                )}
                
                {displayItems.map((item, idx) => {
                    if (item.type === 'thinking') {
                        return <ThinkingProcess key={`thinking-${idx}`} steps={item.steps} isFinished={item.isFinished} language={language} />;
                    }
                    const msg = item.message;
                    return (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className={`flex gap-4 max-w-full min-w-0 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-sm transition-transform hover:scale-110 duration-200 ${
                                msg.role === "user" 
                                ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white" 
                                : "bg-white border border-indigo-50 text-indigo-600"
                            }`}>
                                {msg.role === "user" ? (
                                  userAvatarSrc && !userAvatarFailed ? (
                                    <img
                                      src={userAvatarSrc}
                                      alt="user avatar"
                                      className="w-full h-full rounded-xl object-cover"
                                      onError={() => setUserAvatarFailed(true)}
                                    />
                                  ) : (
                                    <div className="text-xs font-bold">U</div>
                                  )
                                ) : <Sparkles size={16} />}
                            </div>
                            <div className={`max-w-[85%] min-w-0 rounded-2xl px-6 py-4 text-sm shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
                                msg.role === "user" 
                                ? "bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-tr-sm" 
                                : "bg-white text-slate-700 rounded-tl-sm border border-slate-100/60"
                            }`}>
                                <div className={`prose prose-sm max-w-none break-words leading-relaxed ${msg.role === "user" ? "prose-invert" : "prose-slate"}`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                        table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-slate-300 border border-slate-200 rounded-lg" {...props} /></div>,
                                        th: ({node, ...props}) => <th className="bg-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider" {...props} />,
                                        td: ({node, ...props}) => <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600 border-t border-slate-100" {...props} />
                                    }}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
                
                {status && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 ml-12 animate-pulse">
                        <Loader2 size={12} className="animate-spin" />
                        <span>{status}</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-200 bg-white">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder={language === 'zh' ? "输入您的查询需求..." : "Enter your query..."}
                        disabled={loading || !activeConnectionId}
                        className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || loading || !activeConnectionId}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}
