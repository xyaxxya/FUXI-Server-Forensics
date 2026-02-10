import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  Cpu, 
  Globe, 
  Save,
  Trash2,
  Sparkles,
  Zap
} from 'lucide-react';
import { translations, Language } from '../../translations';
import { AIMessage, AISettings, sendToAI } from '../../lib/ai';
import { useCommandStore } from '../../store/CommandContext';
import { invoke } from "@tauri-apps/api/core";
import ThinkingProcess, { ThinkingStep } from './ThinkingProcess';

interface GeneralInfoPanelProps {
  language: Language;
  generalInfo: string;
  setGeneralInfo: (info: string | ((prev: string) => string)) => void;
  aiSettings: AISettings;
}

export default function GeneralInfoPanel({
  language,
  generalInfo,
  setGeneralInfo,
  aiSettings
}: GeneralInfoPanelProps) {
  const t = translations[language];
  
  // AI Execution State
  const [loading, setLoading] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [isThinkingFinished, setIsThinkingFinished] = useState(true);
  
  const { currentSession, sessions, selectedSessionIds } = useCommandStore();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const presets = [
    {
      id: 'db',
      label: t.general_info_auto_db,
      icon: <Database size={16} />,
      prompt: "请扫描服务器上的数据库配置（MySQL, PostgreSQL, Redis, MongoDB等）。查找常见的配置文件（如 my.cnf, redis.conf），包括常见php网站目录里的数据库配置，常见java网站jar包里的数据库配置文件。如果可见，请提取主机、端口、用户名和密码。如果找到，请总结这些凭据并调用 `update_context_info` 工具将其保存。请不要在最终回答中以明文显示密码，仅在工具调用中保存。"
    },
    {
      id: 'sys',
      label: t.general_info_auto_sys,
      icon: <Cpu size={16} />,
      prompt: "请收集系统详细信息：操作系统版本 (`cat /etc/*release`)、内核版本 (`uname -a`)、CPU信息、内存使用情况和磁盘使用情况。请总结关键规格并调用 `update_context_info` 将此环境上下文保存。"
    },
    {
      id: 'web',
      label: t.general_info_auto_web,
      icon: <Globe size={16} />,
      prompt: "请识别正在运行的Web服务（Nginx, Apache, Tomcat等）。检查活动端口 (`netstat -tulpn`) 和配置文件位置。请总结Web架构并调用 `update_context_info` 将其保存。"
    }
  ];

  const handleExecute = async (prompt: string) => {
      setLoading(true);
      setThinkingSteps([]); // Clear previous steps
      setIsThinkingFinished(false);
      
      const initialHistory: AIMessage[] = [
          { role: 'user', content: prompt }
      ];

      try {
          await processConversation(initialHistory);
      } catch (e) {
          console.error(e);
          setThinkingSteps(prev => [...prev, {
              id: 'error',
              title: `Error: ${e}`,
          }]);
      } finally {
          setLoading(false);
          setIsThinkingFinished(true);
      }
  };

  const processConversation = async (history: AIMessage[], depth = 0) => {
    const maxLoops = aiSettings.maxLoops || 25;
    if (depth > maxLoops) return;

    try {
      // 1. Get response from AI
      // Pass current generalInfo to give context even for these tasks
      const response = await sendToAI(history, aiSettings, undefined, generalInfo);

      // Update thinking steps based on response content (reasoning)
      if (response.content) {
          setThinkingSteps(prev => [...prev, {
              id: `step-${depth}`,
              title: response.content
          }]);
      }

      const newHistory = [...history, response];

      // 2. Check for tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          if (toolCall.function.name === "run_shell_command") {
            const args = JSON.parse(toolCall.function.arguments);
            const cmd = args.command;

            // Add step for tool execution
            const stepId = toolCall.id;
            setThinkingSteps(prev => [...prev, {
                id: stepId,
                title: `${t.execute}: ${cmd}`,
                toolCall: {
                    command: cmd,
                    args: args,
                    isLoading: true
                }
            }]);

            // Execute command
            let output = "";
            try {
              let targetSessions = sessions.filter((s) => selectedSessionIds.includes(s.id));
              if (targetSessions.length === 0 && currentSession) {
                targetSessions = [currentSession];
              }

              if (targetSessions.length === 0) {
                output = t.no_active_session;
              } else if (targetSessions.length === 1) {
                const session = targetSessions[0];
                const res: any = await invoke("exec_command", {
                  cmd,
                  sessionId: session.id,
                });
                output = res.stdout || res.stderr || t.no_output;
                 if (output.length > 3000) {
                     output = output.substring(0, 3000) + t.output_truncated;
                 }
                if (res.exit_code !== 0) {
                  output += `\n(${t.exit_code}: ${res.exit_code})`;
                }
              } else {
                 // Multi-session not fully supported in this simplified panel logic yet, 
                 // but we'll just run on first for context gathering usually.
                 // Or just join outputs.
                 const results = await Promise.all(
                  targetSessions.map(async (session) => {
                    try {
                      const res: any = await invoke("exec_command", {
                        cmd,
                        sessionId: session.id,
                      });
                      let out = res.stdout || res.stderr || t.no_output;
                      if (out.length > 1000) out = out.substring(0, 1000) + "...";
                      return `[${session.ip}]:\n${out}`;
                    } catch (e: any) {
                      return `[${session.ip}]: Error ${e}`;
                    }
                  })
                 );
                 output = results.join("\n\n");
              }
            } catch (e: any) {
              output = `${t.execution_failed}: ${e.toString()}`;
            }

            // Update step with result
            setThinkingSteps(prev => prev.map(step => {
                if (step.id === stepId && step.toolCall) {
                    return {
                        ...step,
                        toolCall: {
                            ...step.toolCall,
                            isLoading: false,
                            output: output,
                            isError: output.includes("Error") || output.includes("failed")
                        }
                    };
                }
                return step;
            }));

            // Add tool result to history
            newHistory.push({
              role: "tool",
              content: output,
              tool_call_id: toolCall.id,
            });

          } else if (toolCall.function.name === "update_context_info") {
              const args = JSON.parse(toolCall.function.arguments);
              const info = args.info;
              
              const stepId = toolCall.id;
              setThinkingSteps(prev => [...prev, {
                  id: stepId,
                  title: t.general_info_updated,
                  toolCall: {
                      command: "update_context_info",
                      args: args,
                      isLoading: false,
                      output: "Context Updated",
                      isError: false
                  }
              }]);

              if (info) {
                  setGeneralInfo(prev => {
                      const newInfo = prev ? prev + "\n\n" + info : info;
                      return newInfo;
                  });
              }
              
              newHistory.push({
                  role: "tool",
                  content: "Context updated successfully.",
                  tool_call_id: toolCall.id,
              });
          }
        }

        // Recursively call AI
        await processConversation(newHistory, depth + 1);
      }
    } catch (error) {
      console.error("AI Error", error);
      setThinkingSteps(prev => [...prev, {
          id: `error-${depth}`,
          title: `Error: ${error}`
      }]);
    }
  };

  return (
    <div className="bg-slate-50 border-b border-slate-200 min-h-full flex flex-col">
      <div className="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar pb-20">
        
        {/* Quick Actions Grid */}
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Zap size={12} className="text-amber-500"/>
                    {t.general_info_presets}
                </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {presets.map((preset) => (
                    <button
                        key={preset.id}
                        onClick={() => handleExecute(preset.prompt)}
                        disabled={loading}
                        className={`flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 transition-all text-left ${
                            loading ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm'
                        }`}
                    >
                        <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-md">
                            {preset.icon}
                        </div>
                        <span className="font-medium truncate">{preset.label}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Text Area */}
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Save size={12} className="text-blue-500"/>
                    {t.general_info_context}
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                    {generalInfo.length} chars
                </span>
            </div>
            
            <div className="relative group bg-white focus-within:bg-white rounded-xl border border-slate-200 focus-within:border-indigo-200 focus-within:ring-4 focus-within:ring-indigo-50/50 transition-all duration-300 shadow-sm">
                <textarea
                    value={generalInfo}
                    onChange={(e) => setGeneralInfo(e.target.value)}
                    placeholder={t.general_info_placeholder}
                    className="w-full h-48 p-3 text-sm bg-transparent border-none focus:ring-0 outline-none focus:outline-none resize-none custom-scrollbar font-mono leading-relaxed"
                />
                <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                        onClick={() => setGeneralInfo('')}
                        className="p-1 text-slate-300 hover:text-red-400 transition-colors"
                        title={t.delete}
                     >
                        <Trash2 size={14} />
                     </button>
                </div>
            </div>
            
            <p className="text-[10px] text-slate-400 flex items-start gap-1">
                <Sparkles size={10} className="mt-0.5 text-indigo-400 flex-shrink-0" />
                {t.general_info_desc}
            </p>
        </div>

        {/* Thinking Process Display */}
        {thinkingSteps.length > 0 && (
            <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Cpu size={12} className="text-blue-500"/>
                        {t.thinking_process}
                    </label>
                    {loading && (
                        <span className="text-[10px] text-blue-500 flex items-center gap-1">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full"
                            />
                            {t.ai_thinking}
                        </span>
                    )}
                </div>
                <ThinkingProcess 
                    steps={thinkingSteps} 
                    isFinished={isThinkingFinished} 
                    language={language} 
                />
                <div ref={messagesEndRef} />
            </div>
        )}

      </div>
    </div>
  );
}
