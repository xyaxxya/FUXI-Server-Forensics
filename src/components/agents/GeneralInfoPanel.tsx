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
      id: 'sys',
      label: t.general_info_auto_sys,
      icon: <Cpu size={16} />,
      prompt: `**任务：系统深度取证与基线检查**
请执行以下取证命令序列，并对发现的**高危项**（如老旧内核、高负载、异常账号）进行**标红**或加粗警告。

1.  **OS基础信息**：
    - \`cat /etc/*release\` (发行版)
    - \`uname -a\` (内核版本，检查是否存在DirtyCow等已知漏洞)
    - \`hostnamectl\`

2.  **资源负载**：
    - \`uptime\` (检查负载是否异常高)
    - \`free -h\` (内存占用)
    - \`df -hT | grep -v 'tmpfs'\` (磁盘空间，重点关注 /var /tmp 是否爆满)

3.  **账号与权限**：
    - \`cat /etc/passwd | grep -v 'nologin'\` (查看可登录用户)
    - \`grep 'sudo' /etc/group\` (查看sudo权限组)
    - \`lastlog | head -n 10\` (最近登录记录)

4.  **网络连接**：
    - \`ip addr show\`
    - \`route -n\`

请将收集到的信息整理为结构化报告，并调用 \`update_context_info\` 保存。`
    },
    {
      id: 'web',
      label: t.general_info_auto_web,
      icon: <Globe size={16} />,
      prompt: `**任务：Web服务与中间件取证**
请识别服务器上运行的所有Web组件，并寻找潜在的**Webshell**或**配置文件**。

1.  **服务识别**：
    - \`netstat -tulpn | grep -E '80|443|8080|8888|3306|6379'\` (关键端口监听)
    - \`ps aux | grep -E 'nginx|apache|tomcat|java|php|docker'\` (进程特征)

2.  **配置定位** (尝试查找，但不强制)：
    - Nginx: \`find /etc/nginx -name "*.conf" 2>/dev/null | head -n 5\`
    - Apache: \`find /etc/httpd /etc/apache2 -name "*.conf" 2>/dev/null | head -n 5\`
    - Tomcat: \`find / -name "server.xml" 2>/dev/null | head -n 5\`

3.  **Web根目录推断**：
    - 根据配置文件或进程参数，推断 Web Root 路径（如 \`/var/www/html\`, \`/usr/share/nginx/html\`, \`/opt/tomcat/webapps\`）。

4.  **异常检查**：
    - 检查 Web 目录下是否有最近修改的 \`.php\` / \`.jsp\` 文件 (疑似Webshell):
      \`find /var/www/html -type f -name "*.php" -mtime -7 2>/dev/null\` (示例路径，需根据实际情况调整)

请总结 Web 架构（前端->后端->数据库），并记录关键路径到 \`update_context_info\`。`
    },
    {
      id: 'db',
      label: t.general_info_auto_db,
      icon: <Database size={16} />,
      prompt: `**任务：数据库凭据与连接取证**
你的目标是找到数据库连接信息（主机、端口、用户、密码）。

1.  **配置文件扫描**：
    - 扫描常见 Web 应用配置文件（如 WordPress \`wp-config.php\`, Drupal \`wp-config.php\`, Spring Boot \`application.yml\`, .env 文件）。
    - 命令示例：
      - \`find /var/www -name "wp-config.php" -o -name ".env" -o -name "config.php" 2>/dev/null\`
      - \`grep -rE "DB_PASSWORD|jdbc|redis" /var/www 2>/dev/null | head -n 10\`

2.  **服务配置**：
    - MySQL: \`cat /etc/my.cnf /etc/mysql/my.cnf 2>/dev/null\`
    - Redis: \`grep -v '^#' /etc/redis/redis.conf | grep 'requirepass'\`

3.  **历史记录挖掘**：
    - 检查 \`.bash_history\` 中是否有带密码的 mysql 连接命令：
      \`grep -E 'mysql -u|redis-cli' ~/.bash_history | head -n 20\`

**安全警告**：找到密码后，请**脱敏**展示（如 \`pass****\`），但必须将**明文**完整保存到 \`update_context_info\` 中以便后续自动连接使用。`
    },
    {
        id: 'persistence',
        label: t.general_info_auto_persistence || "Persistence Check",
        icon: <Save size={16} />,
        prompt: `**任务：持久化后门排查 (Persistence Mechanisms)**
请检查攻击者可能留下的自启动后门。对于任何**可疑项**，请加粗并标记 **[SUSPICIOUS]**。

1.  **定时任务 (Cron)**：
    - \`cat /etc/crontab\`
    - \`ls -la /etc/cron.d/ /etc/cron.daily/ /etc/cron.hourly/\`
    - \`cat /var/spool/cron/crontabs/* 2>/dev/null\`

2.  **系统服务 (Systemd)**：
    - \`systemctl list-unit-files --state=enabled | grep -v 'static'\` (列出所有自启服务)
    - 检查最近修改的服务文件：\`find /etc/systemd/system -mtime -30 -type f\`

3.  **启动脚本**：
    - \`cat /etc/rc.local\`
    - \`ls -la /etc/init.d/\`
    - 检查 \`.bashrc\` / \`.profile\` 中的异常别名或导出：
      \`grep -E 'alias|export' ~/.bashrc ~/.profile /etc/profile\`

4.  **SSH 后门**：
    - 检查 \`~/.ssh/authorized_keys\` 是否包含陌生公钥。

请汇总所有自启动项，并指出哪些看起来不属于标准 Linux 发行版。`
    },
    {
        id: 'network',
        label: t.general_info_auto_network || "Network Connections",
        icon: <Globe size={16} />,
        prompt: `**任务：异常网络连接与反弹Shell排查**
分析当前网络连接，寻找反弹 Shell 或 C2 连接迹象。

1.  **建立的连接**：
    - \`netstat -antp | grep 'ESTABLISHED'\`
    - 关注非标准端口（如 4444, 5555, 6666）的外连。

2.  **监听端口**：
    - \`netstat -tulpn\`
    - 注意绑定在 \`0.0.0.0\` 的未知高位端口。

3.  **进程关联**：
    - 对于可疑连接，查看 PID 对应的进程详情：
      \`ls -l /proc/[PID]/exe\` (将 [PID] 替换为实际数字)

4.  **DNS/Hosts**：
    - \`cat /etc/hosts\`
    - \`cat /etc/resolv.conf\`

请列出所有**外连 IP** (Outbound Connections) 及其对应的进程名。如果发现连接到**公网 IP** 的 Shell 进程（bash/sh/python），请立即告警！`
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
            let isCommandError = false;
            try {
              let targetSessions = sessions.filter((s) => selectedSessionIds.includes(s.id));
              if (targetSessions.length === 0 && currentSession) {
                targetSessions = [currentSession];
              }

              if (targetSessions.length === 0) {
                output = t.no_active_session;
                isCommandError = true;
              } else if (targetSessions.length === 1) {
                const session = targetSessions[0];
                const res: any = await invoke("exec_command", {
                  cmd,
                  sessionId: session.id,
                });
                output = res.stdout || res.stderr || t.no_output;
                if (res.exit_code !== 0) {
                  output += `\n(${t.exit_code}: ${res.exit_code})`;
                  isCommandError = true;
                }
              } else {
                 // Multi-session
                 const results = await Promise.all(
                  targetSessions.map(async (session) => {
                    try {
                      const res: any = await invoke("exec_command", {
                        cmd,
                        sessionId: session.id,
                      });
                      const out = res.stdout || res.stderr || t.no_output;
                      return { 
                          text: `[${session.ip}]:\n${out}`, 
                          isError: res.exit_code !== 0 
                      };
                    } catch (e: any) {
                      return { 
                          text: `[${session.ip}]: Error ${e}`, 
                          isError: true 
                      };
                    }
                  })
                 );
                 output = results.map(r => r.text).join("\n\n");
                 isCommandError = results.some(r => r.isError);
              }
            } catch (e: any) {
              output = `${t.execution_failed}: ${e.toString()}`;
              isCommandError = true;
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
                            isError: isCommandError
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
