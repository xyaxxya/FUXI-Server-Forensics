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
import ThinkingProcess, { ThinkingStep } from "./ThinkingProcess";
import { pLimit } from "../../lib/p-limit";

import JarConfigArtifact from "./JarConfigArtifact";

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

type DisplayItem = 
  | { type: 'message', message: ChatMessage }
  | { type: 'thinking', steps: ThinkingStep[], isFinished: boolean }
  | { type: 'artifact', component: React.ReactNode };

const JAR_ANALYSIS_SCRIPT = `
param([string]$JarPath)
$Extensions = @(".yml", ".yaml", ".properties", ".xml", ".json", ".conf")
$Keywords = @("jdbc", "database", "datasource", "password", "secret", "redis", "mongo", "elasticsearch")
if (-not (Test-Path $JarPath)) { Write-Output "{ ""error"": ""File not found: $JarPath"" }"; exit 1 }
$TempDir = Join-Path $env:TEMP ("fuxi_jar_" + [Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TempDir | Out-Null
try {
    Expand-Archive -Path $JarPath -DestinationPath $TempDir -Force
    $Results = @()
    $Files = Get-ChildItem -Path $TempDir -Recurse | Where-Object { $_.Extension -in $Extensions }
    foreach ($File in $Files) {
        $Content = Get-Content -Path $File.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $Content) { continue }
        $IsConfig = $false
        if ($File.Name -match "application|bootstrap|setting|config|persistence|context") { $IsConfig = $true }
        if (-not $IsConfig) { foreach ($Keyword in $Keywords) { if ($Content -match $Keyword) { $IsConfig = $true; break } } }
        if ($IsConfig) {
            $RelPath = $File.FullName.Substring($TempDir.Length + 1)
            $Results += @{ path = $RelPath; content = $Content; size = $File.Length }
        }
    }
    $JsonOutput = @{ jar_path = $JarPath; timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"); files = $Results }
    Write-Output ($JsonOutput | ConvertTo-Json -Depth 5 -Compress)
} catch { Write-Output "{ ""error"": ""$($_.Exception.Message)"" }" } finally { if (Test-Path $TempDir) { Remove-Item -Path $TempDir -Recurse -Force } }
`;

const encodePowerShellScript = (script: string): string => {
  const bytes = new Uint8Array(script.length * 2);
  for (let i = 0; i < script.length; i++) {
    const charCode = script.charCodeAt(i);
    bytes[i * 2] = charCode & 0xff;
    bytes[i * 2 + 1] = (charCode >>> 8) & 0xff;
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

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
  
  // Helper to process messages into display items (groups thoughts and tools)
  const getDisplayItems = (messages: ChatMessage[], status: QuestionStatus): DisplayItem[] => {
    const items: DisplayItem[] = [];
    let currentThinking: ThinkingStep[] = [];
    
    // Helper to flush current thinking steps
    const flushThinking = (isFinished: boolean) => {
      if (currentThinking.length > 0) {
        items.push({ 
          type: 'thinking', 
          steps: [...currentThinking],
          isFinished 
        });
        currentThinking = [];
      }
    };

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === 'system') continue;

      if (msg.role === 'user') {
        flushThinking(true);
        items.push({ type: 'message', message: msg });
      } else if (msg.role === 'assistant') {
        const hasToolCalls = msg.rawToolCalls && msg.rawToolCalls.length > 0;
        // Identify if this is a "thinking" step or a final answer
        // Logic: If it has tool calls -> Thinking
        // If it starts with "Thinking Process:" or similar (less reliable) -> Thinking
        // Otherwise -> Message
        
        if (hasToolCalls) {
          // This is a thinking step (Action)
          // We can have multiple tool calls in one message
          msg.rawToolCalls?.forEach(tc => {
             const args = JSON.parse(tc.function.arguments);
             currentThinking.push({
               id: tc.id,
               title: args.command ? `${t.execute}: ${args.command}` : `${t.call}: ${tc.function.name}`,
               toolCall: {
                 command: args.command || tc.function.name,
                 args: args,
                 isLoading: true // Will be updated by tool output
               }
             });
          });
        } else {
           // Normal message (Final Answer or Just Text)
           // But wait, sometimes "Thoughts" come as text before tool calls? 
           // In our implementation, we usually send tool calls.
           // Let's treat it as a message, flushing previous thinking
           flushThinking(true);
           items.push({ type: 'message', message: msg });
        }
      } else if (msg.role === 'tool') {
          // Identify Artifacts
          if (msg.content.startsWith('{"jar_path":')) {
            try {
              const data = JSON.parse(msg.content);
              items.push({ type: 'artifact', component: <JarConfigArtifact data={data} /> });
            } catch (e) {
              console.error("Failed to parse Jar artifact", e);
            }
          }

          // Find the step that corresponds to this tool output
          // In our simple model, we just look for the last step with matching ID or just the last step
          // Since we process linearly, it should be in currentThinking
          
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
              // Orphan tool output? Add as generic step
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
    
    // Flush any remaining thinking steps
    // If status is completed, then thinking is definitely finished
    // If processing, it might be ongoing
    flushThinking(status === 'completed' || status === 'error');
    
    return items;
  };

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { currentSession, selectedSessionIds, sessions } = useCommandStore();

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  // Scroll to bottom of chat
  useEffect(() => {
    if (selectedQuestionId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
6. Do NOT output any thinking process. Just output the JSON result directly and immediately.

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
            content: `你是一名全球顶尖的电子数据取证专家。
你的任务是进行自动化批量取证分析，目标是精准、高效、安全。

**核心原则**：
1. **非交互式原则**：严禁使用 vi, nano, top 等交互式命令。使用 cat, grep, head, tail 等。
2. **自适应分析**：根据发现的系统环境（Docker, Java, PHP等）自动调整查找策略。
3. **数据清洗**：注意处理输出中的干扰信息。

**回答格式**：
- 对于批量提问，请**仅提供直接答案**（例如端口号、路径、状态值）。
- 不要包含 Markdown 格式、长篇解释或思考过程的文本输出，除非用户明确要求详细报告。
- 所有的“分析-执行-反馈”过程应体现在你的**工具调用**逻辑中，而不是最终的文本回复中。
- 如果用户询问端口，只返回数字。如果询问路径，只返回路径。
- 遇到错误或无法获取时，简要说明原因。`
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
        },
        {
          type: "function",
          function: {
            name: "analyze_jar_config",
            description: "Analyze a JAR file to find configuration files (YAML, Properties, XML, JSON) and extract sensitive information (JDBC, Passwords) WITHOUT using 'strings' command.",
            parameters: {
              type: "object",
              properties: {
                jar_path: { type: "string", description: "Absolute path to the JAR file on the local system" }
              },
              required: ["jar_path"]
            }
          }
        }
    ];

    try {
        let finalAnswer = "";
        let turnCount = 0;
        const MAX_TURNS = aiSettings?.maxLoops || 10;

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
                                    let out = res.stdout || res.stderr || "(No Output)";
                                    
                                    // Truncate output if too long to save tokens
                                    if (out.length > 1000) {
                                        out = out.substring(0, 1000) + t.output_truncated;
                                    }
                                    
                                    const exit = res.exit_code !== 0 ? ` [Exit: ${res.exit_code}]` : "";
                                    return `[${s.user}@${s.ip}]${exit}:\n${out}`;
                                } catch (e: any) {
                                    return `[${s.user}@${s.ip}] Error: ${e.toString()}`;
                                }
                            }));
                            output = results.join("\n\n---\n\n");
                        }
                    } else if (functionName === "analyze_jar_config") {
                        const jarPath = args.jar_path;
                        try {
                            const encodedScript = encodePowerShellScript(JAR_ANALYSIS_SCRIPT);
                            const safePath = jarPath.replace(/'/g, "''");
                            const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript} -JarPath '${safePath}'`;
                            
                            const res: any = await invoke("exec_local_command", { cmd });
                            output = res || "(No Output)";
                        } catch (e: any) {
                             output = `Error analyzing JAR: ${e}`;
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
                // accuracy: 95 // Mock accuracy for now (Hidden by user request)
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

  const startBatchProcessing = async () => {
    if (!aiSettings) {
        alert("Please configure AI settings first.");
        return;
    }
    
    setIsProcessing(true);
    
    const pendingQuestions = questions.filter(q => q.status === "pending");
    
    // Concurrent processing with limit
    const limit = pLimit(aiSettings.maxConcurrentTasks || 3);
    const tasks = pendingQuestions.map(q => limit(() => processQuestion(q)));
    
    await Promise.all(tasks);
    
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
        const MAX_TURNS = aiSettings?.maxLoops || 10;

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
                                    let out = res.stdout || res.stderr || "(No Output)";
                                    
                                    // Truncate output if too long to save tokens
                                    if (out.length > 1000) {
                                        out = out.substring(0, 1000) + t.output_truncated;
                                    }

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
             {/* Confidence hidden by user request */}
             {/* {selectedQuestion.accuracy && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm font-medium">
                  <BrainCircuit size={16} />
                  {t.confidence}: {selectedQuestion.accuracy}%
                </div>
             )} */}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
           {selectedQuestion.messages.length === 0 ? (
             <div className="text-center text-slate-400 mt-20">
               {t.noData}
             </div>
           ) : (
             <>
                {getDisplayItems(selectedQuestion.messages, selectedQuestion.status).map((item, idx) => {
                  if (item.type === 'message') {
                     if (item.message.role === 'user') {
                       return (
                        <div key={`msg-${idx}`} className="flex flex-row-reverse gap-4 mb-6">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm bg-blue-600 text-white">
                                <User size={20} />
                            </div>
                            <div className="flex flex-col max-w-[80%] items-end">
                                <div className="px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed bg-blue-600 text-white rounded-tr-sm [&_*]:text-white">
                                    {item.message.content}
                                </div>
                            </div>
                        </div>
                       );
                     } else {
                       // Assistant Message (Final Answer)
                       return (
                        <div key={`msg-${idx}`} className="flex gap-4 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm bg-green-600 text-white">
                                <Bot size={20} />
                            </div>
                            <div className="flex flex-col max-w-[80%] items-start">
                                <div className="px-6 py-4 rounded-2xl shadow-md text-sm leading-relaxed bg-white border border-slate-200 text-slate-800 rounded-tl-sm">
                                    <div className="markdown-content prose-invert">
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
                                            {item.message.content}
                                        </ReactMarkdown>
                                    </div>
                                    <button
                                        onClick={(e) => handleCopy(e, `msg-${idx}`, item.message.content)}
                                        className="mt-2 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-blue-500 rounded transition-colors flex items-center gap-1 text-xs"
                                        title={t.copy}
                                    >
                                        {copiedId === `msg-${idx}` ? <Check size={14} className="text-green-600"/> : <Copy size={14}/>}
                                        {t.copy}
                                    </button>
                                </div>
                            </div>
                        </div>
                       );
                     }
                  } else if (item.type === 'artifact') {
                    return (
                        <div key={`artifact-${idx}`} className="my-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             {item.component}
                        </div>
                    );
                  } else {
                    // Thinking Process
                    return (
                        <ThinkingProcess 
                            key={`think-${idx}`}
                            steps={item.steps} 
                            isFinished={item.isFinished}
                            language={language}
                        />
                    );
                  }
                })}
             </>
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
                {isClassifying ? t.analyzing : t.add_to_queue}
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
                        {/* {q.status === "completed" && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <BrainCircuit size={12} />
                            {t.confidence}: <span className="font-semibold text-green-600">{q.accuracy}%</span>
                          </span>
                        )} */}
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
