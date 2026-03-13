import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Settings,
  Terminal,
  Loader2,
  Sparkles,
  Trash2,
  MessageSquare,
  Plus,
  Menu,
  X,
  Square
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCommandStore } from "../../store/CommandContext";
import { AIMessage, AISettings, sendToAI } from "../../lib/ai";
import { translations, Language } from "../../translations";
import ThinkingProcess, { ThinkingStep } from "./ThinkingProcess";
import { useChatStore } from "../../lib/chatStore";

interface GeneralAgentProps {
  language: Language;
  aiSettings: AISettings;
  onOpenSettings?: () => void;
  generalInfo: string;
  setGeneralInfo: (info: string | ((prev: string) => string)) => void;
}

type DisplayItem = 
  | { type: 'message', message: AIMessage }
  | { type: 'thinking', steps: ThinkingStep[], isFinished: boolean };

export default function GeneralAgent({ language, aiSettings, onOpenSettings, generalInfo, setGeneralInfo }: GeneralAgentProps) {
  // Chat Store
  const { 
    sessions: chatSessions, 
    activeSessionId, 
    createSession, 
    deleteSession, 
    setActiveSession, 
    updateSessionMessages,
    clearSessionMessages
  } = useChatStore();

  // Local State
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { currentSession, sessions, selectedSessionIds } = useCommandStore();
  const t = translations[language];

  // Derived State
  const activeSession = Array.isArray(chatSessions) ? chatSessions.find(s => s.id === activeSessionId) : undefined;
  const messages = activeSession ? activeSession.messages : [];

  // Ensure there's always at least one session if none exist
  useEffect(() => {
    if ((!chatSessions || chatSessions.length === 0) && !activeSessionId) {
        createSession();
    } else if (chatSessions && chatSessions.length > 0 && !activeSessionId) {
        setActiveSession(chatSessions[0].id);
    }
  }, [chatSessions?.length, activeSessionId, createSession, setActiveSession]);

  const format = (str: string, ...args: any[]) => {
    return str.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };

  // Process messages into display items
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
        const hasKeywords = content.includes("Analysis") || content.includes("Plan") || content.includes("分析") || content.includes("规划") || content.includes("思索") || content.includes("执行") || content.includes("反馈");
        const hasTools = msg.tool_calls && msg.tool_calls.length > 0;
        const isThinking = hasTools || (hasKeywords && content.length < 500);

        if (isThinking) {
          if (msg.content) {
             currentThinking.push({
               id: `thought-${i}`,
               title: msg.content
             });
          }
          
          if (msg.tool_calls) {
            msg.tool_calls.forEach((tc) => {
               let args: any = {};
               try { args = JSON.parse(tc.function.arguments); } catch (e) { args = { command: tc.function.arguments }; }
               
               currentThinking.push({
                 id: tc.id,
                 title: args.command ? `${t.execute}: ${args.command}` : `${t.call}: ${tc.function.name}`,
                 toolCall: {
                   command: args.command || tc.function.name,
                   args: args,
                   isLoading: true 
                 }
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
                  if (msg.content.includes("Exit:") && !msg.content.includes("Exit: 0")) {
                      step.toolCall.isError = true;
                  } else if (msg.content.includes("Execution failed")) {
                      step.toolCall.isError = true;
                  }
              }
          } else {
              currentThinking.push({
                  id: `tool-res-${i}`,
                  title: t.tool_output,
                  toolCall: {
                      command: t.unknown,
                      args: {},
                      output: msg.content,
                      isLoading: false
                  }
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

  const handleClearChat = () => {
    if (activeSessionId && messages.length > 0 && window.confirm(t.clear_chat_confirm)) {
        clearSessionMessages(activeSessionId);
    }
  };

  const handleStopGeneration = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setLoading(false);
          setStatus(t.stopped_by_user);
      }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const config = aiSettings.configs[aiSettings.activeProvider];
    if (!config.apiKey) {
        // We can't easily add a message to store without it being "real", but we can temporary show it or just add it.
        // Let's add it to store for consistency
        if (activeSessionId) {
             const errorMsg: AIMessage = {
                role: "assistant",
                content: `${format(t.configure_api_key, config.name)} [${t.settings}](#settings)`,
             };
             updateSessionMessages(activeSessionId, [...messages, errorMsg]);
        }
        return;
    }

    // Ensure active session
    let sessionId = activeSessionId;
    let currentMessages = messages;
    
    if (!sessionId) {
        sessionId = createSession();
        currentMessages = [];
    }

    const msgToStore: AIMessage = {
      role: "user",
      content:
        selectedSessionIds.length > 0
          ? `(Selected ${selectedSessionIds.length} servers) ${input}`
          : input,
    };

    const newHistory = [...currentMessages, msgToStore];
    updateSessionMessages(sessionId, newHistory);
    setInput("");
    setLoading(true);
    setStatus(t.ai_thinking);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await processConversation(sessionId, newHistory, 0, controller.signal);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
          const errHistory = [...newHistory, { role: "assistant", content: format(t.error_prefix, error.message) } as AIMessage];
          updateSessionMessages(sessionId, errHistory);
      }
    } finally {
      if (abortControllerRef.current === controller) {
         setLoading(false);
         setStatus("");
         abortControllerRef.current = null;
      }
    }
  };

  const processConversation = async (sessionId: string, history: AIMessage[], depth = 0, signal: AbortSignal) => {
    if (signal.aborted) return;
    
    const maxLoops = aiSettings.maxLoops || 25;
    if (depth > maxLoops) {
        const loopMsg: AIMessage = { role: 'assistant', content: t.max_loops_reached };
        updateSessionMessages(sessionId, [...history, loopMsg]);
        return;
    }

    try {
      // Prepare enhanced context with server list
      let enhancedInfo = generalInfo;
      const serverListInfo = sessions
          .map(s => `- ${s.user}@${s.ip} (ID: ${s.id}) ${s.note ? `[Note: ${s.note}]` : ''} ${selectedSessionIds.includes(s.id) ? '(Selected)' : ''}`)
          .join('\n');
      
      enhancedInfo = `**Current Server List**:\n${serverListInfo}\n\n${enhancedInfo}`;

      // 1. Get response from AI
      const response = await sendToAI(history, aiSettings, undefined, enhancedInfo, signal);
      if (signal.aborted) return;

      // 2. Add AI response to history
      const newHistory = [...history, response];
      updateSessionMessages(sessionId, newHistory);

      // 3. Check for tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        setStatus(t.executing_command);

        for (const toolCall of response.tool_calls) {
          if (signal.aborted) break;

          if (toolCall.function.name === "run_shell_command") {
            const args = JSON.parse(toolCall.function.arguments);
            const cmd = args.command;
            const targetIds = args.target_ids;

            let output = "";
            try {
              let targetSessions: typeof sessions = [];
              
              if (targetIds && Array.isArray(targetIds) && targetIds.length > 0) {
                  // If AI specified targets, use them
                  targetSessions = sessions.filter(s => targetIds.includes(s.id));
              } 
              
              if (targetSessions.length === 0) {
                  // Fallback to selected sessions or current session
                  targetSessions = sessions.filter((s) => selectedSessionIds.includes(s.id));
                  if (targetSessions.length === 0 && currentSession) targetSessions = [currentSession];
              }

              if (targetSessions.length === 0) {
                output = t.no_active_session;
              } else if (targetSessions.length === 1) {
                const session = targetSessions[0];
                setStatus(format(t.running_command, session.ip, cmd));
                const res: any = await invoke("exec_command", { cmd, sessionId: session.id });
                output = res.stdout || res.stderr || t.no_output;
                if (res.exit_code !== 0) output += `\n(${t.exit_code}: ${res.exit_code})`;
              } else {
                setStatus(format(t.running_on_servers, targetSessions.length, cmd));
                const results = await Promise.all(
                  targetSessions.map(async (session) => {
                    try {
                      const res: any = await invoke("exec_command", { cmd, sessionId: session.id });
                      const truncated = res.stdout || res.stderr || t.no_output;
                      const exitInfo = res.exit_code !== 0 ? ` (${t.exit_code}: ${res.exit_code})` : "";
                      return `[${session.user}@${session.ip}]${exitInfo}:\n${truncated}`;
                    } catch (e: any) {
                      return `[${session.user}@${session.ip}]: ${format(t.execution_failed, e.toString())}`;
                    }
                  }),
                );
                output = results.join("\n\n" + "-".repeat(40) + "\n\n");
              }
            } catch (e: any) {
              output = format(t.execution_failed, e.toString());
            }

            const toolMsg: AIMessage = {
              role: "tool",
              content: output,
              tool_call_id: toolCall.id,
            };
            newHistory.push(toolMsg);
          } else if (toolCall.function.name === "update_context_info") {
              const args = JSON.parse(toolCall.function.arguments);
              if (args.info) {
                  setGeneralInfo(prev => prev ? prev + "\n\n" + args.info : args.info);
                  setStatus(t.general_info_updated);
              }
               const toolMsg: AIMessage = {
                  role: "tool",
                  content: "Context updated successfully.",
                  tool_call_id: toolCall.id,
                };
                newHistory.push(toolMsg);
          }
        }

        if (signal.aborted) return;
        updateSessionMessages(sessionId, newHistory);

        // 4. Recursively call AI with tool outputs
        setStatus(t.analyzing_results);
        await processConversation(sessionId, newHistory, depth + 1, signal);
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-50 border-r border-slate-200 flex flex-col transition-all duration-300 overflow-hidden`}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <button 
                    onClick={() => createSession()}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={16} />
                    <span className="text-sm font-medium">{language === 'zh' ? '新对话' : 'New Chat'}</span>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {chatSessions.map(session => (
                    <div 
                        key={session.id}
                        className={`group p-3 rounded-lg border cursor-pointer transition-all ${
                            activeSessionId === session.id 
                            ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-50' 
                            : 'bg-transparent border-transparent hover:bg-slate-200/50'
                        }`}
                        onClick={() => setActiveSession(session.id)}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <MessageSquare size={16} className={activeSessionId === session.id ? 'text-indigo-500' : 'text-slate-400'} />
                                <span className={`text-sm truncate ${activeSessionId === session.id ? 'text-slate-700 font-medium' : 'text-slate-600'}`}>
                                    {session.title}
                                </span>
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(window.confirm(t.delete_confirm)) {
                                        deleteSession(session.id);
                                    }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-all"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 pl-6">
                            {new Date(session.updatedAt).toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Header */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{t.ai_assistant}</h3>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                {selectedSessionIds.length > 0 ? (
                                    <span className="text-blue-600 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        {format(t.selected_servers, selectedSessionIds.length)}
                                    </span>
                                ) : currentSession ? (
                                    <span className="text-green-600 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        {format(t.connected_to, currentSession.ip)}
                                    </span>
                                ) : (
                                    <span className="text-amber-500">{t.not_connected}</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {messages.length > 0 && (
                        <button
                            onClick={handleClearChat}
                            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title={t.clear_chat}
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white custom-scrollbar scroll-smooth">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <div className="mb-6 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 text-white">
                                <Bot size={32} />
                            </div>
                            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
                                {t.how_can_i_help}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full px-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
                            {[
                                { icon: <Terminal size={16} />, text: t.example_disk_usage },
                                { icon: <Sparkles size={16} />, text: t.example_nginx_logs },
                                { icon: <Bot size={16} />, text: t.example_active_connections },
                                { icon: <Settings size={16} />, text: t.example_kernel_versions },
                            ].map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(item.text)}
                                    className="group flex items-center gap-3 p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-xl text-left transition-all duration-200 hover:shadow-md"
                                >
                                    <div className="p-2 bg-white rounded-lg text-slate-400 group-hover:text-blue-500 transition-colors shadow-sm">
                                        {item.icon}
                                    </div>
                                    <span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium">
                                        {item.text}
                                    </span>
                                </button>
                            ))}
                        </div>
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
                            className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-sm transition-transform hover:scale-110 duration-200 ${
                                msg.role === "user" 
                                ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white" 
                                : "bg-white text-indigo-600 border border-indigo-50"
                            }`}>
                                {msg.role === "user" ? <div className="text-xs font-bold">U</div> : <Sparkles size={16} />}
                            </div>
                            <div className={`max-w-[85%] rounded-2xl px-6 py-4 text-sm shadow-sm transition-all duration-200 hover:shadow-md ${
                                msg.role === "user" 
                                ? "bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-tr-sm" 
                                : "bg-white text-slate-700 rounded-tl-sm border border-slate-100/60"
                            }`}>
                                <div className={`prose prose-sm max-w-none leading-relaxed ${msg.role === "user" ? "prose-invert [&_*]:text-white/95" : "prose-slate"}`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: ({ node, href, children, ...props }) => {
                                                if (href === "#settings") {
                                                    return (
                                                        <button onClick={() => onOpenSettings?.()} className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1">
                                                            {children} <Settings size={12} />
                                                        </button>
                                                    );
                                                }
                                                return <a href={href} {...props}>{children}</a>;
                                            },
                                            pre: ({ node, ...props }) => (
                                                <div className="bg-slate-900 rounded-lg p-3 my-2 overflow-x-auto text-slate-200 shadow-inner">
                                                    <pre {...props} />
                                                </div>
                                            ),
                                            code: ({ node, className, children, ...props }) => {
                                                return !className ? (
                                                    <code className={`${msg.role === "user" ? "bg-white/20 text-white" : "bg-slate-200 text-pink-600"} px-1.5 py-0.5 rounded text-xs font-mono`} {...props}>
                                                        {children}
                                                    </code>
                                                ) : <code className={className} {...props}>{children}</code>;
                                            },
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}

                {status && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-slate-400 ml-12">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                        <span>{status}</span>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-slate-100">
                <div className="relative max-w-4xl mx-auto">
                    <AnimatePresence>
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none"
                            >
                                <div className="bg-white/90 backdrop-blur border border-indigo-100 text-indigo-600 text-xs px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm ring-1 ring-indigo-50">
                                    <Loader2 size={12} className="animate-spin" />
                                    <span className="font-medium">{status || t.ai_thinking}</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className={`relative bg-slate-100/50 hover:bg-slate-100 focus-within:bg-white rounded-[2rem] border border-slate-200 focus-within:border-indigo-200 focus-within:ring-4 focus-within:ring-indigo-50/50 transition-all duration-300 ${loading ? "opacity-80" : ""}`}>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder={selectedSessionIds.length > 0 ? format(t.input_placeholder_selected, selectedSessionIds.length) : t.input_placeholder_default}
                            className="w-full pl-6 pr-14 py-4 bg-transparent border-none focus:ring-0 outline-none focus:outline-none resize-none max-h-32 min-h-[56px] text-slate-700 placeholder:text-slate-400 leading-relaxed custom-scrollbar"
                            style={{ height: "auto" }}
                        />
                        <div className="absolute right-2 bottom-2">
                            {loading ? (
                                <button
                                    onClick={handleStopGeneration}
                                    className="p-2.5 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
                                    title={language === 'zh' ? "停止生成" : "Stop generation"}
                                >
                                    <Square size={16} fill="currentColor" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!input.trim()}
                                    className={`p-2.5 rounded-full transition-all duration-200 ${input.trim() ? "bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg hover:scale-105 active:scale-95" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
                                >
                                    <Send size={20} className={input.trim() ? "ml-0.5" : ""} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 text-center">
                        <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                            <Sparkles size={10} className="text-indigo-400" />
                            {t.ai_disclaimer}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
