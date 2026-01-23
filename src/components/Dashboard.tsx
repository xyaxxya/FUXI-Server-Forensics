import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  RefreshCw,
  Play,
  Pause,
  Cloud,
  Search,
  Globe,
  X,
  HelpCircle,
  Info,
  Check,
  Database,
  Key,
} from "lucide-react";
import { translations, Language } from "../translations";
import { commands, PluginCommand } from "../config/commands";
import { useCommandStore } from "../store/CommandContext";
import { ChartDisplay } from "./ChartDisplay";
import TerminalXterm from "./TerminalXterm";
import MySQLManager from "./tools/MySQLManager";
import GeneralAgent from "./agents/GeneralAgent";
import AgentPanel from "./agents/AgentPanel";
import { AISettings } from "../lib/ai";

// --- Types ---
type TableData = { headers: string[]; rows: string[][] };

// --- Parsers ---
const parsers: Record<
  string,
  (output: string, args?: any) => TableData | string
> = {
  disk: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["th_filesystem", "th_size", "th_used", "th_avail", "th_use_percent", "th_mounted"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  process: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["th_pid", "th_user", "th_cpu_percent", "th_mem_percent", "th_command"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  network: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["th_interface", "th_ip_address"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  ports: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["th_protocol", "th_local_address", "th_process"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  docker: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["ID", "th_image", "th_status", "th_ports", "th_names", "th_credentials"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  simpleList: (output, args) => {
    const lines = output.trim().split("\n");
    const headers = args || ["th_value"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  lsOutput: (output) => {
    // Basic ls -l parsing
    return output;
  },
  authLog: (output) => {
    return output;
  },
  k8sNodes: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["th_name", "th_status", "th_roles", "th_version"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  k8sPods: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["th_namespace", "th_name", "th_status", "IP"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  memory: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["th_type", "th_total", "th_used", "th_free", "th_shared", "th_buff_cache", "th_avail"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  boot: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["th_unit", "th_state", "th_preset"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  diskIO: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["th_device", "th_read_sec", "th_write_sec", "th_read_kb", "th_write_kb", "th_util"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  raw: (output) => output,
};

// --- Helper Components ---

function TableDisplay({ data, language }: { data: TableData; language: Language }) {
  const t = translations[language];
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  const selectedRowData = selectedRowIndex !== null ? data.rows[selectedRowIndex] : null;

  return (
    <div className="relative flex flex-col h-full max-h-[600px]">
      <div className="overflow-x-auto custom-scrollbar flex-1 pb-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              {data.headers.map((h, i) => (
                <th
                  key={i}
                  className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm"
                >
                  {t[h as keyof typeof t] || h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr
                key={i}
                onClick={() => setSelectedRowIndex(i)}
                className={`transition-colors group border-b border-slate-100 last:border-0 cursor-pointer ${
                  selectedRowIndex === i ? "bg-blue-100/50" : "hover:bg-blue-50/50"
                }`}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`p-3 text-sm font-mono whitespace-nowrap truncate ${
                      data.headers[j] === "th_credentials" 
                        ? "max-w-none text-red-600 font-bold group-hover:text-red-700" 
                        : "text-slate-600 group-hover:text-slate-800 max-w-[300px]"
                    }`}
                    title={cell}
                  >
                    {data.headers[j] === "th_credentials" && cell && cell.length > 2 ? (
                      <span className="flex items-center gap-1">
                        <Key size={14} className="shrink-0 text-red-500" />
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedRowData && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 z-20 rounded-t-xl"
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Info size={16} className="text-blue-500" />
                {t.analysis_details || "Row Details"}
              </span>
              <button
                onClick={() => setSelectedRowIndex(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
              {data.headers.map((h, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                    {t[h as keyof typeof t] || h}
                  </span>
                  <div className="text-xs text-slate-700 font-mono break-all bg-slate-50 p-2 rounded border border-slate-100 select-text">
                    {selectedRowData[i]}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status, language }: { status: "ok" | "error" | "loading", language: Language }) {
  const t = translations[language];
  if (status === "loading") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 text-xs font-medium border border-sky-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
        {t.processing_status}
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 text-xs font-medium border border-red-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
        {t.error_status}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium border border-emerald-500/20">
      <Check size={12} />
      {t.ok_status}
    </div>
  );
}

function CommandCard({
  def,
  data,
  loading,
  onRefresh,
  description,
  title,
  chartData,
  isMonitoring,
  onStartMonitoring,
  onStopMonitoring,
  language,
  className,
}: {
  def: PluginCommand;
  data: any;
  loading: boolean;
  onRefresh: () => void;
  description: string;
  title: string;
  chartData: any[];
  isMonitoring: boolean;
  onStartMonitoring: (id: string) => void;
  onStopMonitoring: () => void;
  language: Language;
  className?: string;
}) {
  const t = translations[language];
  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<any>(null);

  const handleMouseEnter = () => {
    tooltipTimeout.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500); // 500ms delay
  };

  const handleMouseLeave = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  };

  // Determine if this command should show a chart
  const isChartCommand = [
    "cpu_usage",
    "mem_usage",
    "disk_usage",
    "load_avg",
  ].includes(def.id);

  let content;
  if (!data && !loading) {
    content = (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
          <Globe
            className="text-slate-400 group-hover:text-blue-500 transition-colors"
            size={24}
          />
        </div>
        <div>
          <h3 className="text-slate-800 font-medium mb-1">{title}</h3>
          <p className="text-slate-400 text-sm">{t.noData}</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} />
          {t.load_data}
        </button>
      </div>
    );
  } else if (loading) {
    content = (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="w-8 h-8 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">{t.fetching_data}</span>
      </div>
    );
  } else if (data) {
    // Check if command was successful (exit_code 0), regardless of stderr content
    const isSuccess = data.exit_code === 0;

    if (isSuccess) {
      // Command succeeded, even if there's stderr output (e.g., nginx -t writes to stderr)
      const parser = parsers[def.parserType || "raw"] || parsers.raw;
      const parsedData = parser(
        data?.stdout || data?.stderr || "",
        def.parserArgs,
      );

      if (typeof parsedData === "string") {
        content = (
          <pre className="font-mono text-xs text-slate-600 whitespace-pre-wrap overflow-auto max-h-64 custom-scrollbar p-3 bg-slate-50 rounded-lg border border-slate-100">
            {parsedData || "Empty output"}
          </pre>
        );
      } else {
        content = <TableDisplay data={parsedData} language={language} />;
      }
    } else if (data?.stderr) {
      // Check if the error is a common "not found" error
      const isNotFoundError =
        data.stderr.includes("没有那个文件或目录") ||
        data.stderr.includes("No such file or directory") ||
        data.stderr.includes("command not found") ||
        data.stderr.includes("could not be found") ||
        data.stderr.includes("no matches found") ||
        data.stderr.includes("no crontab for");

      content = isNotFoundError ? (
        <div className="flex flex-col items-center justify-center h-48 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
            <Info size={24} />
          </div>
          <div>
            <h3 className="text-slate-800 font-medium mb-1">
              {t.serviceNotDetected}: {title}
            </h3>
            <p className="text-slate-400 text-sm">
              {language === 'zh' ? '该功能或配置不存在于当前系统' : 'Function or config not found on this system'}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl text-red-600 text-sm font-mono overflow-auto max-h-48 custom-scrollbar">
          {data.stderr}
        </div>
      );
    } else {
      // No stderr, but command failed - show generic error
      content = (
        <div className="flex flex-col items-center justify-center h-48 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
            <Info size={24} />
          </div>
          <div>
            <h3 className="text-slate-800 font-medium mb-1">{t.execution_failed}</h3>
            <p className="text-slate-400 text-sm">
              {language === 'zh' ? '无法执行该命令，请检查权限和命令语法' : 'Failed to execute command. Check permissions and syntax.'}
            </p>
          </div>
        </div>
      );
    }
  } else {
    if (isChartCommand && chartData.length > 0) {
      // Show chart for monitoring commands
      content = (
        <div>
          <div className="mb-4">
            <ChartDisplay
              data={chartData}
              title={title}
              color="#3b82f6"
              color2="#10b981" // Green for TX
              yAxisLabel={
                def.id === "network_traffic" ? "KB/s" : "Percentage (%)"
              }
              unit={def.id === "network_traffic" ? "KB/s" : "%"}
            />
          </div>
          <div className="text-center">
            <button
              onClick={() => {
                if (isMonitoring) {
                  onStopMonitoring();
                } else {
                  onStartMonitoring(def.id);
                }
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 mx-auto ${
                isMonitoring
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
            >
              {isMonitoring ? <Pause size={14} /> : <Play size={14} />}
              {isMonitoring ? t.stop_monitoring : t.start_monitoring}
            </button>
          </div>
        </div>
      );
    } else {
      const parser = parsers[def.parserType || "raw"] || parsers.raw;
      const parsedData = parser(data?.stdout || "", def.parserArgs);

      if (typeof parsedData === "string") {
        content = (
          <pre className="font-mono text-xs text-slate-600 whitespace-pre-wrap overflow-auto max-h-64 custom-scrollbar p-3 bg-slate-50 rounded-lg border border-slate-100">
            {parsedData || "Empty output"}
          </pre>
        );
      } else {
        content = <TableDisplay data={parsedData} language={language} />;
      }
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-visible relative hover:shadow-md transition-shadow duration-300 flex flex-col ${
        className || ""
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-50 left-0 right-0 -top-16 mx-4 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl border border-slate-700 pointer-events-none"
          >
            <div className="font-semibold mb-0.5 flex items-center gap-2">
              <Info size={12} className="text-blue-400" />
              {t.function_description}
            </div>
            <p className="text-slate-300 leading-relaxed">{description}</p>
            {/* Arrow */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 border-b border-r border-slate-700" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
            <Activity size={16} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-slate-700">{title}</span>
            {data?.ts && (
              <span className="text-[10px] text-slate-400">
                Updated {new Date(data.ts).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge
            status={loading ? "loading" : data?.stderr ? "error" : "ok"}
            language={language}
          />
          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
      <div className="p-5">{content}</div>
    </motion.div>
  );
}

// --- Main Dashboard Component ---

interface DashboardProps {
  activeTab: string;
  language: Language;
  onAddSession: () => void;
  aiSettings: AISettings;
  onOpenSettings?: () => void;
}

export default function Dashboard({
  activeTab,
  language,
  aiSettings,
  onOpenSettings,
}: DashboardProps) {
  const [showAbout, setShowAbout] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const {
    loading,
    runCommand,
    getCommandData,
    getChartData,
    progress,
    currentTaskId,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    currentSession,
    fetchAll,
    clearData,
  } = useCommandStore();

  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  // Monitoring state
  const [monitoredCommandIds, setMonitoredCommandIds] = useState<string[]>([]);

  // Terminal Tabs Management
  const [terminalTabs, setTerminalTabs] = useState<
    { id: string; sessionId: string; title: string }[]
  >([]);
  const [activeTerminalTab, setActiveTerminalTab] = useState<string | null>(
    null,
  );

  // Initialize a terminal tab if one doesn't exist and we're on the terminal tab
  useEffect(() => {
    if (
      activeTab === "terminal" &&
      terminalTabs.length === 0 &&
      currentSession
    ) {
      const newTabId = crypto.randomUUID();
      setTerminalTabs([
        {
          id: newTabId,
          sessionId: currentSession.id,
          title: `${currentSession.user}@${currentSession.ip}`,
        },
      ]);
      setActiveTerminalTab(newTabId);
    }
  }, [activeTab, currentSession, terminalTabs.length]);

  const closeTerminalTab = (tabId: string, e?: any) => {
    e?.stopPropagation();
    setTerminalTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (newTabs.length > 0 && activeTerminalTab === tabId) {
        setActiveTerminalTab(newTabs[newTabs.length - 1].id);
      } else if (newTabs.length === 0) {
        setActiveTerminalTab(null);
      }
      return newTabs;
    });
  };

  // Expose closeTerminalTab to window/commands if needed or just use it in UI
  useEffect(() => {
    // Just to silence unused warning if we keep the function
    if (false) closeTerminalTab("", undefined);
  }, []);

  // Filter commands for current tab
  const tabCommands = commands.filter((c) => c.category === activeTab);

  // Effect: Refresh data when session changes
  useEffect(() => {
    if (currentSession && activeTab !== "terminal") {
      // Fetch new data for current tab
      const ids = tabCommands.map((c) => c.id);
      if (ids.length > 0) {
        // Pass false to use cached data if available
        fetchAll(ids, false);
      }
    } else if (!currentSession) {
      clearData();
    }
  }, [currentSession?.id, activeTab]);

  // Effect: Scroll terminal to bottom
  useEffect(() => {
    // Scroll logic removed as we use xterm.js
  }, []);

  // Monitoring handlers
  const handleStartMonitoring = (commandId: string) => {
    const newMonitoredIds = [...monitoredCommandIds, commandId];
    setMonitoredCommandIds(newMonitoredIds);
    startMonitoring(newMonitoredIds, 3000); // 3 second interval
  };

  const handleStopMonitoring = () => {
    setMonitoredCommandIds([]);
    stopMonitoring();
  };

  const t = translations[language];

  // Helper booleans for view switching
  const isGeneralAgent = activeTab === "agent-general";
  const isAgentPanel = activeTab === "agent-panel";
  const isTerminal = activeTab === "terminal";
  const isMetrics = !isGeneralAgent && !isAgentPanel && !isTerminal;

  // Apply search filter
  const filteredCommands = (searchTerm ? commands : tabCommands).filter((c) => {
    const title = language === "zh" ? c.cn_name : c.name;
    return (
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const currentTaskCmd = commands.find((c) => c.id === currentTaskId);
  const currentTaskTitle = currentTaskCmd
    ? language === "zh"
      ? currentTaskCmd.cn_name
      : currentTaskCmd.name
    : "";

  return (
    <>
      {/* General Agent View - Persist State */}
      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isGeneralAgent ? 'hidden' : ''}`}>
        <GeneralAgent 
          language={language} 
          aiSettings={aiSettings} 
          onOpenSettings={onOpenSettings}
        />
      </div>

      {/* Agent Panel View - Persist State */}
      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isAgentPanel ? 'hidden' : ''}`}>
        <AgentPanel language={language} aiSettings={aiSettings} />
      </div>

      {/* Terminal View - Persist State */}
      <div className={`flex-1 h-full p-6 flex flex-col glass-dark overflow-hidden relative ${!isTerminal ? 'hidden' : ''}`}>
        <div className="flex-1 bg-transparent rounded-lg overflow-hidden border border-white/10 shadow-2xl relative z-10">
          <TerminalXterm onClose={() => {}} language={language} />
        </div>
      </div>

      {/* Main Dashboard Metrics View */}
      <div className={`flex-1 flex flex-col h-screen overflow-hidden glass relative ${!isMetrics ? 'hidden' : ''}`}>
      
      {/* Top Bar */}
      <div className="px-10 py-8 flex items-center justify-between relative z-20">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-black text-slate-800 tracking-tight capitalize bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
              {t[activeTab as keyof typeof t] || activeTab}
            </h1>
            <div className="h-1 w-20 bg-blue-500 mt-2 rounded-full" />
          </motion.div>
          <p className="text-slate-500 text-base mt-3 font-medium">
            {t.system_overview}
          </p>
          {/* Connection Status Indicator */}
          {currentSession && (
            <div className="flex items-center gap-2 mt-2 bg-white/50 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200/50 w-fit shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-xs font-semibold text-slate-600">
                {t.connected_to}{" "}
                <span className="text-blue-600">
                  {currentSession.user}@{currentSession.ip}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          {/* Progress Indicator */}
          {progress < 100 && progress > 0 && (
            <div className="flex flex-col items-end mr-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="text-xs font-semibold text-blue-600">
                  {t.running}: {currentTaskTitle}
                </span>
              </div>
              <div className="w-32 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Monitoring Status */}
          {isMonitoring && (
            <div className="flex items-center gap-2 mr-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-green-600">
                {t.monitoring_metrics.replace('{0}', monitoredCommandIds.length.toString())}
              </span>
            </div>
          )}

          {/* Session Management - Moved to ServerSidebar */}

          <div className="relative group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder={t.search_metrics}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all w-64 shadow-sm"
            />
          </div>

          <button
            onClick={() => setShowAbout(true)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Database Query Modal */}
      <AnimatePresence>
        {showDatabaseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden relative">
              <button
                onClick={() => setShowDatabaseModal(false)}
                className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
              <MySQLManager onClose={() => setShowDatabaseModal(false)} language={language} />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* About Modal */}
      <AnimatePresence>
        {showAbout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative"
            >
              <button
                onClick={() => setShowAbout(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-500">
                  <Activity size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  FUXI Server Forensics
                </h2>
                <p className="text-slate-500 mb-8">
                  {t.about_title}
                </p>

                <div className="space-y-4 text-left">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      {t.author}
                    </div>
                    <div className="text-slate-700 font-medium">yiyi、mid2dog</div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      {t.tech_stack}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 font-medium">
                        Tauri v2
                      </span>
                      <span className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 font-medium">
                        Rust
                      </span>
                      <span className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 font-medium">
                        React
                      </span>
                      <span className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 font-medium">
                        TypeScript
                      </span>
                      <span className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 font-medium">
                        Tailwind CSS
                      </span>
                      <span className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 font-medium">
                        Framer Motion
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
                {t.built_with}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar relative z-10">
        {activeTab === "database" && (
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => setShowDatabaseModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm transition-colors font-medium text-sm"
            >
              <Database size={16} />
              <span>{t.manage_database}</span>
            </button>
          </div>
        )}

        {/* Command Cards */}
        {filteredCommands.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-24 h-24 rounded-3xl bg-white shadow-xl shadow-blue-500/10 flex items-center justify-center mb-6">
              <Cloud className="text-blue-400" size={48} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">
              {t.no_metrics_title}
            </h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8 text-lg">
              {t.no_metrics_desc}
            </p>
            <button className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center gap-3 transform hover:scale-105 active:scale-95">
              <RefreshCw size={20} />
              <span>{t.reload_system}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-24">
            {filteredCommands.map((cmd) => (
              <CommandCard
                key={cmd.id}
                def={cmd}
                data={getCommandData(cmd.id)}
                loading={loading[cmd.id] || false}
                onRefresh={() => runCommand(cmd.id, cmd.command, undefined)}
                description={
                  language === "zh" ? cmd.cn_description : cmd.description
                }
                title={language === "zh" ? cmd.cn_name : cmd.name}
                chartData={getChartData(cmd.id)}
                isMonitoring={
                  isMonitoring && monitoredCommandIds.includes(cmd.id)
                }
                onStartMonitoring={handleStartMonitoring}
                onStopMonitoring={handleStopMonitoring}
                language={language}
                className={cmd.id === 'docker_containers' ? "xl:col-span-2" : ""}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Version */}
      <div className="absolute bottom-4 right-6 text-xs text-slate-400 font-medium z-10">
        v0.1.0-beta
      </div>
    </div>
    </>
  );
}
