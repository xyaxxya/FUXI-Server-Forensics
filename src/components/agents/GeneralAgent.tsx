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
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCommandStore } from "../../store/CommandContext";
import { AIMessage, AISettings, sendToAI } from "../../lib/ai";
import { translations, Language } from "../../translations";
import ThinkingProcess, { ThinkingStep } from "./ThinkingProcess";

interface GeneralAgentProps {
  language: Language;
  aiSettings: AISettings;
  onOpenSettings?: () => void;
}

type DisplayItem = 
  | { type: 'message', message: AIMessage }
  | { type: 'thinking', steps: ThinkingStep[], isFinished: boolean };

export default function GeneralAgent({ language, aiSettings, onOpenSettings }: GeneralAgentProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const { currentSession, sessions, selectedSessionIds } = useCommandStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = translations[language];

  const format = (str: string, ...args: any[]) => {
    return str.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };

  // Process messages into display items (Grouping thinking steps)
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
        // Detect if this is a "Thinking" block:
        // 1. It has tool calls
        // 2. OR it contains "Analysis" or "Plan" keywords (and likely followed by tools or is a plan step)
        // 3. OR it's NOT the last message (heuristic: if there's a next message that is 'tool' or 'assistant' with tools)
        // Note: checking next message is tricky in a loop, but we can check if it LOOKS like a plan.
        
        const content = msg.content || "";
        const hasKeywords = content.includes("Analysis") || content.includes("Plan") || content.includes("分析") || content.includes("规划");
        const hasTools = msg.tool_calls && msg.tool_calls.length > 0;
        
        // If it looks like a plan, treat as thinking.
        const isThinking = hasTools || (hasKeywords && content.length < 500); // Simple heuristic: Plans aren't usually massive essays unless it's the final answer? Actually plans can be long.
        // Better heuristic: If it has "Analysis" AND "Plan" headers as per our prompt.

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
               try {
                  args = JSON.parse(tc.function.arguments);
               } catch (e) {
                  args = { command: tc.function.arguments };
               }
               
               currentThinking.push({
                 id: tc.id,
                 title: args.command ? `Execute: ${args.command}` : `Call: ${tc.function.name}`,
                 toolCall: {
                   command: args.command || tc.function.name,
                   args: args,
                   isLoading: true 
                 }
               });
            });
          }
        } else {
          // Normal message (Final Answer)
          flushThinking(true);
          items.push({ type: 'message', message: msg });
        }
      } else if (msg.role === 'tool') {
          // ... (existing tool logic)
          // Find step
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
              // Fallback for orphan tool results
              currentThinking.push({
                  id: `tool-res-${i}`,
                  title: "Tool Output",
                  toolCall: {
                      command: "Unknown",
                      args: {},
                      output: msg.content,
                      isLoading: false
                  }
              });
          }
      }
    }

    // If still have thinking steps at the end, they are pending/active
    flushThinking(false);
    return items;
  };

  const displayItems = getDisplayItems(messages);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, status, displayItems.length]);

  const handleClearChat = () => {
    if (messages.length > 0 && window.confirm(t.clear_chat_confirm)) {
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const config = aiSettings.configs[aiSettings.activeProvider];
    if (!config.apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${format(t.configure_api_key, config.name)} [${t.settings}](#settings)`,
        },
      ]);
      return;
    }

    const msgToStore: AIMessage = {
      role: "user",
      content:
        selectedSessionIds.length > 0
          ? `(Selected ${selectedSessionIds.length} servers) ${input}`
          : input,
    };

    setMessages((prev) => [...prev, msgToStore]);
    setInput("");
    setLoading(true);
    setStatus(t.ai_thinking);

    try {
      await processConversation([...messages, msgToStore]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: format(t.error_prefix, error.message) },
      ]);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const processConversation = async (history: AIMessage[]) => {
    try {
      // 1. Get response from AI
      const response = await sendToAI(history, aiSettings);

      // 2. Add AI response to history
      const newHistory = [...history, response];
      setMessages(newHistory);

      // 3. Check for tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        setStatus(t.executing_command);

        for (const toolCall of response.tool_calls) {
          if (toolCall.function.name === "run_shell_command") {
            const args = JSON.parse(toolCall.function.arguments);
            const cmd = args.command;

            // Execute command
            let output = "";
            try {
              // Determine target sessions
              let targetSessions = sessions.filter((s) =>
                selectedSessionIds.includes(s.id),
              );

              // Fallback to current session if no selection
              if (targetSessions.length === 0 && currentSession) {
                targetSessions = [currentSession];
              }

              if (targetSessions.length === 0) {
                output = t.no_active_session;
              } else if (targetSessions.length === 1) {
                // Single session execution (legacy behavior)
                const session = targetSessions[0];
                setStatus(format(t.running_command, session.ip, cmd));
                const res: any = await invoke("exec_command", {
                  cmd,
                  sessionId: session.id,
                });
                output = res.stdout || res.stderr || "(无输出)";
                 if (output.length > 1500) {
                     output = output.substring(0, 1500) + t.output_truncated;
                 }
                if (res.exit_code !== 0) {
                  output += `\n(退出代码: ${res.exit_code})`;
                }
              } else {
                // Multi-session execution
                setStatus(format(t.running_on_servers, targetSessions.length, cmd));
                const results = await Promise.all(
                  targetSessions.map(async (session) => {
                    try {
                      const res: any = await invoke("exec_command", {
                        cmd,
                        sessionId: session.id,
                      });
                      const sessionOutput =
                        res.stdout || res.stderr || "(无输出)";
                      
                      // Truncate output if too long
                      let truncatedOutput = sessionOutput;
                      if (truncatedOutput.length > 1000) {
                          truncatedOutput = truncatedOutput.substring(0, 1000) + t.output_truncated;
                      }

                      const exitInfo =
                        res.exit_code !== 0 ? ` (Exit: ${res.exit_code})` : "";
                      return `[${session.user}@${session.ip}]${exitInfo}:\n${truncatedOutput}`;
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

            // Add tool result to history
            const toolMsg: AIMessage = {
              role: "tool",
              content: output,
              tool_call_id: toolCall.id,
            };
            newHistory.push(toolMsg);
          }
        }

        // Update UI with tool outputs (hidden but part of state)
        setMessages(newHistory);

        // 4. Recursively call AI with tool outputs
        setStatus(t.analyzing_results);
        await processConversation(newHistory, depth + 1);
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
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
              <div
                className="mb-6 opacity-0 animate-fade-in-up"
                style={{ animationFillMode: "forwards" }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 text-white">
                  <Bot size={32} />
                </div>
                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
                  {t.how_can_i_help}
                </h3>
              </div>

              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full px-4 opacity-0 animate-fade-in-up"
                style={{
                  animationDelay: "0.1s",
                  animationFillMode: "forwards",
                }}
              >
                {[
                  {
                    icon: <Terminal size={16} />,
                    text: t.example_disk_usage,
                  },
                  {
                    icon: <Sparkles size={16} />,
                    text: t.example_nginx_logs,
                  },
                  {
                    icon: <Bot size={16} />,
                    text: t.example_active_connections,
                  },
                  {
                    icon: <Settings size={16} />,
                    text: t.example_kernel_versions,
                  },
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
              return (
                <ThinkingProcess
                  key={`thinking-${idx}`}
                  steps={item.steps}
                  isFinished={item.isFinished}
                  language={language}
                />
              );
            }

            const msg = item.message;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-indigo-600 border border-indigo-100 shadow-sm"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div className="text-xs font-bold">U</div>
                  ) : (
                    <Sparkles size={16} />
                  )}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm [&_*]:text-white"
                      : "bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-100"
                  }`}
                >
                  <div className={`prose prose-sm max-w-none ${msg.role === "user" ? "prose-invert [&_*]:text-white" : "prose-slate"}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node, href, children, ...props }) => {
                        if (href === "#settings") {
                          return (
                            <button
                              onClick={() => onOpenSettings?.()}
                              className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                            >
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
                          <code
                            className={`${msg.role === "user" ? "bg-white/20 text-white" : "bg-slate-200 text-pink-600"} px-1.5 py-0.5 rounded text-xs font-mono`}
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
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

          {/* Status Indicator */}
          {status && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-xs text-slate-400 ml-12"
            >
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
              <span>{status}</span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Gemini Style */}
        <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-slate-100">
          <div className="relative max-w-4xl mx-auto">
            {/* Floating Status Pill */}
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
                    <span className="font-medium">
                      {status || t.ai_thinking}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className={`relative bg-slate-100/50 hover:bg-slate-100 focus-within:bg-white rounded-[2rem] border border-slate-200 focus-within:border-indigo-200 focus-within:ring-4 focus-within:ring-indigo-50/50 transition-all duration-300 ${loading ? "opacity-80" : ""}`}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  selectedSessionIds.length > 0
                    ? format(t.input_placeholder_selected, selectedSessionIds.length)
                    : t.input_placeholder_default
                }
                className="w-full pl-6 pr-14 py-4 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[56px] text-slate-700 placeholder:text-slate-400 leading-relaxed custom-scrollbar"
                style={{ height: "auto" }}
              />
              <div className="absolute right-2 bottom-2">
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || loading}
                  className={`p-2.5 rounded-full transition-all duration-200 ${
                    input.trim() && !loading
                      ? "bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg hover:scale-105 active:scale-95"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Send
                      size={20}
                      className={input.trim() ? "ml-0.5" : ""}
                    />
                  )}
                </button>
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
  );
}
