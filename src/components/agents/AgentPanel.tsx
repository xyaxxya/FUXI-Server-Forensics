import React, { useState, useRef, useEffect } from "react";
import { 
  Bot, 
  Play, 
  Plus, 
  FileText, 
  Database, 
  Coffee, 
  BarChart2, 
  CheckCircle2, 
  Loader2, 
  Clock, 
  ChevronRight,
  X,
  BrainCircuit,
  Settings,
  Send,
  User,
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  RefreshCw
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { translations, Language } from "../../translations";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AIMessage, AISettings, sendToAI, Tool } from "../../lib/ai";
import { useCommandStore } from "../../store/CommandContext";

// --- Types ---

export type QuestionType = "Basic" | "Database" | "Java" | "DataAnalysis";
export type QuestionStatus = "pending" | "processing" | "completed" | "error";

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  isThinking?: boolean;
  tool_call_id?: string;
  rawToolCalls?: AIMessage["tool_calls"];
}

export interface BatchQuestion {
  id: string;
  content: string;
  type: QuestionType;
  status: QuestionStatus;
  // History of the conversation for this specific question
  messages: ChatMessage[]; 
  accuracy?: number;
  timestamp: number;
  // Store the final answer separately for quick access in the list view
  finalAnswer?: string;
  errorMessage?: string;
}

interface AgentPanelProps {
  language?: Language;
  aiSettings?: AISettings;
}

// --- Helpers ---

const getIconForType = (type: QuestionType) => {
  switch (type) {
    case "Database": return <Database size={16} className="text-orange-500" />;
    case "Java": return <Coffee size={16} className="text-red-500" />;
    case "DataAnalysis": return <BarChart2 size={16} className="text-purple-500" />;
    default: return <FileText size={16} className="text-blue-500" />;
  }
};

const getColorForType = (type: QuestionType) => {
  switch (type) {
    case "Database": return "bg-orange-100 text-orange-700 border-orange-200";
    case "Java": return "bg-red-100 text-red-700 border-red-200";
    case "DataAnalysis": return "bg-purple-100 text-purple-700 border-purple-200";
    default: return "bg-blue-100 text-blue-700 border-blue-200";
  }
};

const normalizeQuestionType = (value: unknown): QuestionType => {
  const raw = String(value ?? "").trim();
  const v = raw.toLowerCase().replace(/[\s_\-]/g, "");
  if (v === "database" || v === "db") return "Database";
  if (v === "java" || v === "jar" || v === "webjar") return "Java";
  if (v === "dataanalysis" || v === "analysis" || v === "analytics") return "DataAnalysis";
  return "Basic";
};

const tryExtractJsonArrayText = (text: string): string | null => {
  const trimmed = text.trim();
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (match) return match[0];
  if (trimmed.startsWith("```")) {
    const unwrapped = trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
    const match2 = unwrapped.match(/\[[\s\S]*\]/);
    return match2 ? match2[0] : null;
  }
  return null;
};

type SplitItem = { content: string; type: QuestionType };

const parseSplitResult = (rawText: string): SplitItem[] | null => {
  const arrText = tryExtractJsonArrayText(rawText);
  if (arrText) {
    try {
      const parsed = JSON.parse(arrText);
      if (Array.isArray(parsed)) {
        const items = parsed
          .map((x: any) => {
            if (typeof x === "string") {
              const content = x.trim();
              return content ? { content, type: "Basic" as const } : null;
            }
            const content = String(x?.content ?? x?.question ?? x?.text ?? "").trim();
            if (!content) return null;
            return { content, type: normalizeQuestionType(x?.type ?? x?.category) };
          })
          .filter(Boolean) as SplitItem[];
        return items.length > 0 ? items : null;
      }
    } catch {
      return null;
    }
  }

  try {
    const trimmed = rawText.trim().replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return null;
    if (parsed && typeof parsed === "object") {
      const keys = ["questions", "tasks", "items", "result", "data", "list"];
      for (const k of keys) {
        const v = (parsed as any)[k];
        if (Array.isArray(v)) {
          const items = v
            .map((x: any) => {
              if (typeof x === "string") {
                const content = x.trim();
                return content ? { content, type: "Basic" as const } : null;
              }
              const content = String(x?.content ?? x?.question ?? x?.text ?? "").trim();
              if (!content) return null;
              return { content, type: normalizeQuestionType(x?.type ?? x?.category) };
            })
            .filter(Boolean) as SplitItem[];
          return items.length > 0 ? items : null;
        }
      }

      const singleContent = String((parsed as any).content ?? (parsed as any).question ?? "").trim();
      if (singleContent) return [{ content: singleContent, type: normalizeQuestionType((parsed as any).type ?? (parsed as any).category) }];
    }
  } catch {
    return null;
  }

  return null;
};

// --- Components ---

export default function AgentPanel({ language = 'en', aiSettings }: AgentPanelProps) {
  const t = translations[language];
  const [input, setInput] = useState("");
  const [questions, setQuestions] = useState<BatchQuestion[]>([]);
  const [autoIdentify, setAutoIdentify] = useState(true);
  
  // Selected question for full-screen detail view
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  
  // Chat input in detail view
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { currentSession, selectedSessionIds, sessions } = useCommandStore();

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  // Scroll to bottom of chat
  useEffect(() => {
    if (selectedQuestionId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedQuestionId, selectedQuestion?.messages]);

  // Add questions from input
  const handleAddQuestions = async () => {
    if (!input.trim()) return;

    // If auto-identify is on, trigger classification in background
    if (autoIdentify && aiSettings) {
      if (!aiSettings.configs[aiSettings.activeProvider]?.apiKey) {
        alert(t.configure_api_key.replace("{0}", aiSettings.configs[aiSettings.activeProvider]?.name || "AI"));
        return;
      }
      await splitAndClassifyQuestions(input, aiSettings);
    } else {
        const newLines = input.split("\n").filter(line => line.trim() !== "");
        // We create them as "Basic" first
        const newQuestions: BatchQuestion[] = newLines.map(line => ({
          id: Math.random().toString(36).substring(2, 9),
          content: line.trim(),
          type: "Basic", // Default
          status: "pending",
          timestamp: Date.now(),
          messages: [] 
        }));
        setQuestions(prev => [...prev, ...newQuestions]);
    }

    setInput("");
  };

  const splitAndClassifyQuestions = async (text: string, settings: AISettings) => {
    setIsClassifying(true);
    const prompt = `
You are a task analyzer. 
1. Analyze the following text and split it into distinct independent tasks/questions.
2. For each task, classify it into exactly one of these categories: Basic, Database, Java, DataAnalysis.
3. IMPORTANT: Prioritize "Database" over "DataAnalysis". If the task involves analyzing data that is likely stored in a database (e.g. users, orders, logs in DB tables), classify it as "Database". Only use "DataAnalysis" for general file/csv/statistical analysis that doesn't explicitly imply a database query.
4. Return the result as a raw JSON array of objects, where each object has "content" (string) and "type" (string).
5. Do NOT include any markdown formatting or explanation. Just the JSON array.

Text to analyze:
${text}
`;

    try {
        const res = await sendToAI([
            { role: "user", content: prompt }
        ], settings, []); 

        const items = parseSplitResult(res.content);
        if (!items) {
          throw new Error("AI split result is empty or invalid");
        }

        const newQuestions: BatchQuestion[] = items.map((item) => ({
          id: Math.random().toString(36).substring(2, 9),
          content: item.content,
          type: item.type,
          status: "pending",
          timestamp: Date.now(),
          messages: []
        }));
        setQuestions(prev => [...prev, ...newQuestions]);
    } catch (e) {
        console.error("AI Split/Classify failed", e);
        const newLines = text.split("\n").filter(line => line.trim() !== "");
        if (newLines.length === 0) return;
        const newQuestions: BatchQuestion[] = newLines.map(line => ({
          id: Math.random().toString(36).substring(2, 9),
          content: line.trim(),
          type: "Basic",
          status: "pending",
          timestamp: Date.now(),
          messages: [] 
        }));
        setQuestions(prev => [...prev, ...newQuestions]);
    } finally {
        setIsClassifying(false);
    }
  };

  // Agent Loop for a single question
  const processQuestion = async (q: BatchQuestion) => {
    if (!aiSettings) return;

    // Update status to processing
    setQuestions(prev => prev.map(item => 
        item.id === q.id ? { ...item, status: "processing", messages: [{ role: "user", content: q.content }] } : item
    ));

    // Determine target sessions
    let targetSessions = sessions.filter((s) => selectedSessionIds.includes(s.id));
    if (targetSessions.length === 0 && currentSession) {
        targetSessions = [currentSession];
    }
    
    // Initial History
    // We add a system prompt to guide the output format
    let history: ChatMessage[] = [
        { 
            role: "system", 
            content: "你是一个精确的取证助手。在回答时，请仅提供直接答案（例如端口号、文件路径、状态），不要包含任何 markdown 格式、解释、废话或思考过程，除非明确要求提供详细信息。如果用户询问端口，只返回数字。如果用户询问路径，只返回路径。请直接给出最终结果，不要有任何前缀。" 
        },
        { role: "user", content: q.content }
    ];
    
    // Tools
    const tools: Tool[] = [
        {
          type: "function",
          function: {
            name: "run_shell_command",
            description: "Execute Shell Command on the target server(s).",
            parameters: {
              type: "object",
              properties: {
                command: { type: "string", description: "Shell command to execute" }
              },
              required: ["command"]
            }
          }
        }
    ];

    try {
        let finalAnswer = "";
        let turnCount = 0;
        const MAX_TURNS = 10; // Prevent infinite loops

        while (turnCount < MAX_TURNS) {
            turnCount++;
            
            // 1. Send to AI
            const aiMessages: AIMessage[] = history.map(m => ({
                role: m.role as any,
                content: m.content,
                tool_call_id: m.tool_call_id,
                tool_calls: (m as any).rawToolCalls
            })) as AIMessage[];

            const response = await sendToAI(aiMessages, aiSettings, tools);
            
            // 2. Add AI Response to History
            const assistantMsg: ChatMessage = {
                role: "assistant",
                content: response.content,
                rawToolCalls: response.tool_calls
            };
            history.push(assistantMsg);
            
            // Update UI with intermediate thought
            setQuestions(prev => prev.map(item => 
                item.id === q.id ? { ...item, messages: [...history] } : item
            ));

            // 3. Check Tool Calls
            if (response.tool_calls && response.tool_calls.length > 0) {
                // Execute Tools
                for (const tc of response.tool_calls) {
                    const functionName = tc.function.name;
                    const args = JSON.parse(tc.function.arguments);
                    let output = "";

                    if (functionName === "run_shell_command") {
                        const cmd = args.command;
                        
                        if (targetSessions.length === 0) {
                            output = "Error: No active SSH session connected.";
                        } else {
                            // Run on all target sessions
                            const results = await Promise.all(targetSessions.map(async (s) => {
                                try {
                                    const res: any = await invoke("exec_command", {
                                        cmd,
                                        sessionId: s.id
                                    });
                                    const out = res.stdout || res.stderr || "(No Output)";
                                    const exit = res.exit_code !== 0 ? ` [Exit: ${res.exit_code}]` : "";
                                    return `[${s.user}@${s.ip}]${exit}:\n${out}`;
                                } catch (e: any) {
                                    return `[${s.user}@${s.ip}] Error: ${e.toString()}`;
                                }
                            }));
                            output = results.join("\n\n---\n\n");
                        }
                    } else {
                        output = "Error: Unknown tool.";
                    }

                    // Add Tool Output to History
                    const toolMsg: ChatMessage = {
                        role: "tool",
                        content: output,
                        tool_call_id: tc.id
                    };
                    history.push(toolMsg);
                }
                
                // Update UI again
                setQuestions(prev => prev.map(item => 
                    item.id === q.id ? { ...item, messages: [...history] } : item
                ));
                
                // Loop continues to let AI see tool output
            } else {
                // No tool calls -> Final Answer
                finalAnswer = response.content;
                break;
            }
        }

        // Completion
        setQuestions(prev => prev.map(item => 
            item.id === q.id ? { 
                ...item, 
                status: "completed", 
                finalAnswer: finalAnswer,
                messages: [...history],
                accuracy: 95 // Mock accuracy for now
            } : item
        ));

    } catch (error: any) {
        setQuestions(prev => prev.map(item => 
            item.id === q.id ? { 
                ...item, 
                status: "error", 
                errorMessage: error.message 
            } : item
        ));
    }
  };

  // Batch Processing
  const startBatchProcessing = async () => {
    if (!aiSettings) {
        alert("Please configure AI settings first.");
        return;
    }
    
    setIsProcessing(true);
    
    const pendingQuestions = questions.filter(q => q.status === "pending");
    
    // Concurrent processing
    await Promise.all(pendingQuestions.map(q => processQuestion(q)));
    
    setIsProcessing(false);
  };

  // Handle sending a follow-up message in detail view
  const handleSendFollowUp = async () => {
    if (!chatInput.trim() || !selectedQuestionId || !aiSettings) return;
    
    const q = questions.find(item => item.id === selectedQuestionId);
    if (!q) return;

    const userMsg: ChatMessage = { role: "user", content: chatInput };
    
    // Update local state first
    const newMessages = [...q.messages, userMsg];
    
    setQuestions(prev => prev.map(item => 
      item.id === selectedQuestionId 
        ? { ...item, messages: newMessages, status: "processing" } 
        : item
    ));
    setChatInput("");

    // Continue the loop 
    // We reuse logic similar to processQuestion but with existing history
    try {
        let history = [...newMessages];
        let targetSessions = sessions.filter((s) => selectedSessionIds.includes(s.id));
        if (targetSessions.length === 0 && currentSession) {
            targetSessions = [currentSession];
        }

        const tools: Tool[] = [
            {
              type: "function",
              function: {
                name: "run_shell_command",
                description: "Execute Shell Command on the target server(s).",
                parameters: {
                  type: "object",
                  properties: {
                    command: { type: "string", description: "Shell command to execute" }
                  },
                  required: ["command"]
                }
              }
            }
        ];

        let turnCount = 0;
        const MAX_TURNS = 10; 

        while (turnCount < MAX_TURNS) {
            turnCount++;
            
            const aiMessages = history.map(m => ({
                role: m.role as any,
                content: m.content,
                tool_call_id: m.tool_call_id,
                tool_calls: (m as any).rawToolCalls
            })) as AIMessage[];

            const response = await sendToAI(aiMessages, aiSettings, tools);
            
            const assistantMsg: ChatMessage = {
                role: "assistant",
                content: response.content,
                rawToolCalls: response.tool_calls
            };
            history.push(assistantMsg);
            
            setQuestions(prev => prev.map(item => 
                item.id === selectedQuestionId ? { ...item, messages: [...history] } : item
            ));

            if (response.tool_calls && response.tool_calls.length > 0) {
                for (const tc of response.tool_calls) {
                    const functionName = tc.function.name;
                    const args = JSON.parse(tc.function.arguments);
                    let output = "";

                    if (functionName === "run_shell_command") {
                        const cmd = args.command;
                        if (targetSessions.length === 0) {
                            output = "Error: No active SSH session connected.";
                        } else {
                            const results = await Promise.all(targetSessions.map(async (s) => {
                                try {
                                    const res: any = await invoke("exec_command", { cmd, sessionId: s.id });
                                    const out = res.stdout || res.stderr || "(No Output)";
                                    const exit = res.exit_code !== 0 ? ` [Exit: ${res.exit_code}]` : "";
                                    return `[${s.user}@${s.ip}]${exit}:\n${out}`;
                                } catch (e: any) {
                                    return `[${s.user}@${s.ip}] Error: ${e.toString()}`;
                                }
                            }));
                            output = results.join("\n\n---\n\n");
                        }
                    } else {
                        output = "Error: Unknown tool.";
                    }

                    const toolMsg: ChatMessage = {
                        role: "tool",
                        content: output,
                        tool_call_id: tc.id
                    };
                    history.push(toolMsg);
                }
                
                setQuestions(prev => prev.map(item => 
                    item.id === selectedQuestionId ? { ...item, messages: [...history] } : item
                ));
            } else {
                break;
            }
        }
        
        setQuestions(prev => prev.map(item => 
            item.id === selectedQuestionId ? { ...item, status: "completed" } : item
        ));

    } catch (e: any) {
        // Handle error
    }
  };

  const handleCopy = (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Delete a question
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setQuestions(prev => prev.filter(q => q.id !== id));
    if (selectedQuestionId === id) {
        setSelectedQuestionId(null);
    }
  };

  // Re-analyze a question
  const handleReanalyze = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const q = questions.find(item => item.id === id);
    if (!q || !aiSettings) return;

    // Reset status and process again
    setQuestions(prev => prev.map(item => 
        item.id === id ? { ...item, status: "pending", messages: [], finalAnswer: undefined, errorMessage: undefined } : item
    ));

    // We need to trigger processQuestion but it's async and we might want to do it immediately
    // Since state update is async, we pass the reset object directly
    const resetQ = { ...q, status: "pending" as QuestionStatus, messages: [], finalAnswer: undefined, errorMessage: undefined };
    await processQuestion(resetQ);
  };

  // --- Detail View (Full Screen Chat) ---
  if (selectedQuestion) {
    return (
      <div className="flex flex-col h-full bg-slate-50 relative z-20 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedQuestionId(null)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {t.analysis_details}
                <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 border font-normal ${getColorForType(selectedQuestion.type)}`}>
                    {getIconForType(selectedQuestion.type)}
                    {t[`type_${selectedQuestion.type.toLowerCase().replace("dataanalysis", "data_analysis")}` as keyof typeof t] || selectedQuestion.type}
                </span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {selectedQuestion.accuracy && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm font-medium">
                  <BrainCircuit size={16} />
                  {t.confidence}: {selectedQuestion.accuracy}%
                </div>
             )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
           {selectedQuestion.messages.length === 0 ? (
             <div className="text-center text-slate-400 mt-20">
               {t.noData}
             </div>
           ) : (
             selectedQuestion.messages.map((msg, idx) => (
               <div 
                 key={idx} 
                 className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
               >
                 {/* Avatar */}
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm
                   ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-blue-600"}`}
                 >
                   {msg.role === "user" ? <User size={20} /> : <Bot size={20} />}
                 </div>

                 {/* Bubble */}
                 <div className={`flex flex-col max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                   <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed
                     ${msg.role === "user" 
                       ? "bg-blue-600 text-white rounded-tr-sm [&_*]:text-white" 
                       : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                     }
                     ${msg.isThinking ? "animate-pulse" : ""}
                   `}>
                     {msg.role === "tool" ? (
                         <details className="cursor-pointer group">
                             <summary className="font-medium opacity-70 hover:opacity-100 flex items-center gap-2 select-none">
                                 Tool Output
                             </summary>
                             <pre className="mt-2 text-xs bg-slate-900 text-slate-200 p-2 rounded overflow-x-auto">
                                 {msg.content}
                             </pre>
                         </details>
                     ) : (
                       <div className={`markdown-content ${msg.role === "user" ? "prose-invert" : ""}`}>
                         <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                                pre: ({node, ...props}) => (
                                    <div className="bg-slate-900 rounded-lg p-3 my-2 overflow-x-auto text-slate-200 shadow-inner">
                                        <pre {...props} />
                                    </div>
                                ),
                                code: ({node, className, children, ...props}) => (
                                    <code className={`${className} bg-black/10 px-1 py-0.5 rounded text-xs font-mono`} {...props}>
                                        {children}
                                    </code>
                                )
                            }}
                         >
                            {msg.content}
                         </ReactMarkdown>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             ))
           )}
           <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendFollowUp()}
              placeholder={t.chat_input_placeholder}
              disabled={!aiSettings?.configs[aiSettings.activeProvider].apiKey}
              className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
            />
            <button
              onClick={handleSendFollowUp}
              disabled={!chatInput.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Dashboard View ---

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col transition-all duration-300">
        
        {/* Header / Config Bar */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Bot size={20} />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">{t.batch_agent_title}</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <Settings size={14} className="text-slate-500" />
              <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={autoIdentify} 
                  onChange={(e) => setAutoIdentify(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {t.auto_identify_type}
              </label>
            </div>
            
            <button
              onClick={startBatchProcessing}
              disabled={isProcessing || questions.filter(q => q.status === "pending").length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors shadow-sm
                ${isProcessing || questions.filter(q => q.status === "pending").length === 0
                  ? "bg-slate-300 cursor-not-allowed" 
                  : "bg-green-600 hover:bg-green-700 active:bg-green-800"}`}
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              {isProcessing ? t.processing : t.start_batch}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Input Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Plus size={16} className="text-blue-500" />
              {t.add_questions_title}
            </h3>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.add_questions_placeholder}
              className="w-full h-24 p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none text-slate-600 text-sm font-mono bg-slate-50"
            />
            <div className="flex justify-end mt-3">
              <button 
                onClick={handleAddQuestions}
                disabled={!input.trim() || isClassifying}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isClassifying && <Loader2 size={14} className="animate-spin" />}
                {isClassifying ? "Analyzing..." : t.add_to_queue}
              </button>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>{t.analysis_queue}</span>
              <span className="text-xs font-normal text-slate-400">
                {questions.length} items
              </span>
            </h3>
            
            {questions.length === 0 && (
              <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
                <Bot size={32} className="mx-auto mb-2 opacity-50" />
                <p>{t.no_questions}</p>
              </div>
            )}

            {questions.map((q) => (
              <div 
                key={q.id}
                onDoubleClick={() => {
                   setSelectedQuestionId(q.id);
                }}
                className={`group relative bg-white p-4 rounded-xl border transition-all hover:shadow-md flex flex-col md:flex-row gap-4
                  ${(q.status === "completed" || q.status === "processing" || q.status === "error") ? "cursor-pointer hover:border-blue-300" : "cursor-default border-slate-200 opacity-80"}
                `}
              >
                {/* Left Column: Question Info (Width 65%) */}
                <div className="flex-1 md:w-[65%] min-w-0 border-r border-slate-100 pr-4 relative">
                  <div className="flex items-start gap-4 h-full">
                    {/* Icon & Status */}
                    <div className="flex-shrink-0 pt-1">
                      {q.status === "pending" && <Clock size={20} className="text-slate-400" />}
                      {q.status === "processing" && <Loader2 size={20} className="text-blue-500 animate-spin" />}
                      {q.status === "completed" && <CheckCircle2 size={20} className="text-green-500" />}
                      {q.status === "error" && <X size={20} className="text-red-500" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col h-full justify-between">
                      <p className="text-slate-800 font-medium line-clamp-3 mb-2 pr-16">{q.content}</p>
                      <div className="flex items-center gap-2 mt-auto">
                        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 border ${getColorForType(q.type)}`}>
                          {getIconForType(q.type)}
                          {t[`type_${q.type.toLowerCase().replace("dataanalysis", "data_analysis")}` as keyof typeof t] || q.type}
                        </span>
                        {q.status === "completed" && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <BrainCircuit size={12} />
                            {t.confidence}: <span className="font-semibold text-green-600">{q.accuracy}%</span>
                          </span>
                        )}
                        {q.status === "error" && (
                           <span className="text-xs text-red-500">{q.errorMessage}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons (Top Right of Left Column) */}
                  <div className="absolute top-0 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => handleReanalyze(e, q.id)}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-blue-500 rounded-md transition-colors"
                        title={t.reanalyze}
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={(e) => handleDelete(e, q.id)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                        title={t.delete}
                    >
                        <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Right Column: Answer Preview (Width 35%) */}
                <div className="md:w-[35%] flex flex-col justify-between pl-2 relative">
                  {q.status === "completed" && q.finalAnswer ? (
                    <>
                      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed border border-slate-100 h-full overflow-hidden relative group/answer">
                        <div className="absolute top-0 right-0 p-1 opacity-0 group-hover/answer:opacity-100 transition-opacity bg-gradient-to-l from-slate-50 via-slate-50 to-transparent pl-6">
                           <button
                              onClick={(e) => handleCopy(e, q.id, q.finalAnswer || "")}
                              className="p-1.5 hover:bg-white bg-slate-100 text-slate-500 hover:text-blue-600 rounded-md border border-slate-200 shadow-sm transition-all"
                              title={t.copy}
                           >
                              {copiedId === q.id ? <Check size={14} className="text-green-600"/> : <Copy size={14}/>}
                           </button>
                        </div>
                        <p className="line-clamp-4 text-base font-semibold text-slate-700">{q.finalAnswer}</p>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-300 text-xs italic bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                       {q.status === "pending" ? t.pending_analysis : q.status === "processing" ? t.processing : "Error"}
                    </div>
                  )}
                  
                  {/* View Details Arrow (Absolute positioned or just at bottom right) */}
                  {(q.status === "completed" || q.status === "processing" || q.status === "error") && (
                    <div className="absolute bottom-1 right-0 text-slate-300">
                       <ChevronRight size={16} />
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
