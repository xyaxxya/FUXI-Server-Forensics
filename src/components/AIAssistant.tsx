import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  X,
  Send,
  Settings,
  Terminal,
  Loader2,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCommandStore } from "../store/CommandContext";
import { AIMessage, AISettings, DEFAULT_SETTINGS, sendToAI } from "../lib/ai";

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  // Settings State
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);

  const { currentSession, sessions, selectedSessionIds } = useCommandStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load settings on mount
  useEffect(() => {
    const saved = localStorage.getItem("ai_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: check if it's the old flat format
        if ("apiKey" in parsed) {
          setSettings({
            ...DEFAULT_SETTINGS,
            configs: {
              ...DEFAULT_SETTINGS.configs,
              zhipu: {
                ...DEFAULT_SETTINGS.configs.zhipu,
                apiKey: parsed.apiKey || "",
                baseUrl:
                  parsed.baseUrl || DEFAULT_SETTINGS.configs.zhipu.baseUrl,
                model: parsed.model || DEFAULT_SETTINGS.configs.zhipu.model,
              },
            },
          });
        } else {
          // New format
          setSettings((prev) => ({
            ...prev,
            ...parsed,
            configs: {
              ...prev.configs,
              ...parsed.configs, // Merge to keep defaults for new providers
            },
          }));
        }
      } catch (e) {
        console.error("Failed to parse AI settings", e);
      }
    }
  }, []);

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem("ai_settings", JSON.stringify(settings));
  }, [settings]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, status]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const config = settings.configs[settings.activeProvider];
    if (!config.apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `请先在设置中配置 ${config.name} 的 API Key。`,
        },
      ]);
      setShowSettings(true);
      return;
    }

    // Add context about selected servers if any
    let content = input;
    if (selectedSessionIds.length > 0) {
      content = `[Context: Operation targeting ${selectedSessionIds.length} servers: ${selectedSessionIds.join(", ")}]\n${input}`;
    }

    const userMsg: AIMessage = { role: "user", content: input }; // Display original input to user
    // But we send context-enhanced message to AI?
    // Actually, we should probably just send the input and let the system prompt or context handling do it.
    // But since sendToAI takes the whole history, we can inject a system message or modify the last message.
    // Let's modify the message stored in history to include context, but display it cleanly?
    // No, better to keep display and history synced.
    // Let's prepend context to the content we store.

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
    setStatus("AI 正在思考...");

    try {
      await processConversation([...messages, msgToStore]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `错误: ${error.message}` },
      ]);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const processConversation = async (history: AIMessage[]) => {
    try {
      // 1. Get response from AI
      const response = await sendToAI(history, settings);

      // 2. Add AI response to history
      const newHistory = [...history, response];
      setMessages(newHistory);

      // 3. Check for tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        setStatus("正在执行命令...");

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
                output =
                  "错误：没有活动的 SSH 会话，且未选择任何服务器。请先连接并选择服务器。";
              } else if (targetSessions.length === 1) {
                // Single session execution (legacy behavior)
                const session = targetSessions[0];
                setStatus(`正在运行 (${session.ip}): ${cmd}`);
                const res: any = await invoke("exec_command", {
                  cmd,
                  sessionId: session.id,
                });
                output = res.stdout || res.stderr || "(无输出)";
                if (res.exit_code !== 0) {
                  output += `\n(退出代码: ${res.exit_code})`;
                }
              } else {
                // Multi-session execution
                setStatus(
                  `正在 ${targetSessions.length} 个服务器上运行: ${cmd}`,
                );
                const results = await Promise.all(
                  targetSessions.map(async (session) => {
                    try {
                      const res: any = await invoke("exec_command", {
                        cmd,
                        sessionId: session.id,
                      });
                      const sessionOutput =
                        res.stdout || res.stderr || "(无输出)";
                      const exitInfo =
                        res.exit_code !== 0 ? ` (Exit: ${res.exit_code})` : "";
                      return `[${session.user}@${session.ip}]${exitInfo}:\n${sessionOutput}`;
                    } catch (e: any) {
                      return `[${session.user}@${session.ip}]: 执行失败 - ${e.toString()}`;
                    }
                  }),
                );
                output = results.join("\n\n" + "-".repeat(40) + "\n\n");
              }
            } catch (e: any) {
              output = `执行失败: ${e.toString()}`;
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
        setStatus("正在分析结果...");
        await processConversation(newHistory);
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white z-50 hover:shadow-indigo-500/40 transition-shadow"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </motion.button>

      {/* Main Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              width: isExpanded ? "calc(100vw - 256px - 32px)" : "400px",
              height: isExpanded ? "calc(100vh - 32px)" : "600px",
              bottom: isExpanded ? "16px" : "96px",
              right: isExpanded ? "16px" : "24px",
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={`fixed bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden ${isExpanded ? "z-[100]" : "z-50"}`}
          >
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">AI 助手</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    {selectedSessionIds.length > 0 ? (
                      <span className="text-blue-600 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        已选中 {selectedSessionIds.length} 个服务器
                      </span>
                    ) : currentSession ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        已连接: {currentSession.ip}
                      </span>
                    ) : (
                      <span className="text-amber-500">未连接</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                  title={isExpanded ? "还原" : "最大化"}
                >
                  {isExpanded ? (
                    <Minimize2 size={20} />
                  ) : (
                    <Maximize2 size={20} />
                  )}
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors ${showSettings ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-400"}`}
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-50 border-b border-slate-200 overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    {/* Provider Tabs */}
                    <div className="flex gap-2 mb-4 p-1 bg-slate-200 rounded-lg overflow-x-auto custom-scrollbar">
                      {(
                        ["zhipu", "openai", "qwen", "claude", "kimi"] as const
                      ).map((provider) => (
                        <button
                          key={provider}
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              activeProvider: provider,
                            }))
                          }
                          className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                            settings.activeProvider === provider
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {settings.configs[provider]?.name || provider}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">
                        API 端点
                      </label>
                      <input
                        type="text"
                        value={
                          settings.configs[settings.activeProvider].baseUrl
                        }
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            configs: {
                              ...prev.configs,
                              [prev.activeProvider]: {
                                ...prev.configs[prev.activeProvider],
                                baseUrl: e.target.value,
                              },
                            },
                          }))
                        }
                        className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        placeholder={
                          DEFAULT_SETTINGS.configs[settings.activeProvider]
                            .baseUrl
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">
                        API 密钥
                      </label>
                      <input
                        type="password"
                        value={settings.configs[settings.activeProvider].apiKey}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            configs: {
                              ...prev.configs,
                              [prev.activeProvider]: {
                                ...prev.configs[prev.activeProvider],
                                apiKey: e.target.value,
                              },
                            },
                          }))
                        }
                        className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        placeholder={`${settings.configs[settings.activeProvider].name} API Key`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">
                        模型名称
                      </label>
                      <input
                        type="text"
                        value={settings.configs[settings.activeProvider].model}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            configs: {
                              ...prev.configs,
                              [prev.activeProvider]: {
                                ...prev.configs[prev.activeProvider],
                                model: e.target.value,
                              },
                            },
                          }))
                        }
                        className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        placeholder={
                          DEFAULT_SETTINGS.configs[settings.activeProvider]
                            .model
                        }
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white custom-scrollbar scroll-smooth">
              {messages.length === 0 && !showSettings && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div
                    className="mb-6 opacity-0 animate-fade-in-up"
                    style={{ animationFillMode: "forwards" }}
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 text-white">
                      <Bot size={32} />
                    </div>
                    <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
                      How can I help you today?
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
                        text: "Check disk usage on all servers",
                      },
                      {
                        icon: <Sparkles size={16} />,
                        text: "Analyze recent Nginx error logs",
                      },
                      {
                        icon: <Bot size={16} />,
                        text: "Explain the active connections",
                      },
                      {
                        icon: <Settings size={16} />,
                        text: "Show system kernel versions",
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

              {messages
                .filter((m) => m.role !== "system")
                .map((msg, idx) => (
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
                          : msg.role === "tool"
                            ? "bg-slate-900 text-slate-200 font-mono text-xs w-full overflow-x-auto custom-scrollbar rounded-tl-sm"
                            : "bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-100"
                      }`}
                    >
                      {/* Render tool calls if any (for assistant) */}
                      {msg.role === "assistant" && msg.tool_calls && (
                        <div className="mb-2 space-y-2">
                          {msg.tool_calls.map((tool, tIdx) => (
                            <div
                              key={tIdx}
                              className="bg-slate-100 rounded border border-slate-200 p-2 text-xs font-mono text-slate-600"
                            >
                              <div className="font-bold text-indigo-600 flex items-center gap-1">
                                <Terminal size={10} />
                                Executing: {tool.function.name}
                              </div>
                              <div className="truncate opacity-75 mt-1">
                                {tool.function.arguments}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        className={`prose prose-sm max-w-none ${msg.role === "user" ? "prose-invert [&_*]:text-white" : "prose-slate"}`}
                        components={{
                          pre: ({ node, ...props }) => (
                            <div className="bg-slate-900 rounded-lg p-3 my-2 overflow-x-auto text-slate-200 shadow-inner">
                              <pre {...props} />
                            </div>
                          ),
                          code: ({ node, className, children, ...props }) => {
                            const match = /language-(\w+)/.exec(
                              className || "",
                            );
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
                  </motion.div>
                ))}

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
            <div className="p-4 bg-white/80 backdrop-blur-sm">
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
                          {status || "AI is thinking..."}
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
                        ? `Ask about ${selectedSessionIds.length} selected servers...`
                        : "输入问题或指令 (Enter 发送)..."
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
                    FUXI Server Forensics generated content may be inaccurate.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
