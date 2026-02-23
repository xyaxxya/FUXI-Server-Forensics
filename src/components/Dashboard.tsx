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
  Cpu,
  Server,
  Zap,
  Layout,
  Terminal,
  Clock
} from "lucide-react";
import { translations, Language } from "../translations";
import { commands, PluginCommand } from "../config/commands";
import { useCommandStore } from "../store/CommandContext";
import { ChartDisplay } from "./ChartDisplay";
import TerminalXterm from "./TerminalXterm";
import MySQLManager from "./tools/MySQLManager";
import GeneralAgent from "./agents/GeneralAgent";
import AgentPanel from "./agents/AgentPanel";
import GeneralInfoPanel from "./agents/GeneralInfoPanel";
import DatabaseAgent from "./agents/DatabaseAgent";
import { AISettings } from "../lib/ai";
import { APP_VERSION } from "../config/app";

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
                  className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md"
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
                  selectedRowIndex === i ? "bg-blue-100/50" : "hover:bg-blue-50/30"
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
            className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 z-20 rounded-t-xl"
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
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<any>(null);

  const handleMouseEnter = () => {
    tooltipTimeout.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500); 
  };

  const handleMouseLeave = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  };

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
    const isSuccess = data.exit_code === 0;

    if (isSuccess) {
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
      content = (
        <div>
          <div className="mb-4">
            <ChartDisplay
              data={chartData}
              title={title}
              color="#3b82f6"
              color2="#10b981"
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
      className={`bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 overflow-visible relative hover:shadow-lg hover:border-sky-200 transition-all duration-300 flex flex-col group overflow-hidden ${
        className || ""
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Holographic Shine Effect on Hover - Removed per user request */}
      {/* <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none z-10" /> */}

      {/* Tech Corner Accents */}
      <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 border-sky-500/0 group-hover:border-sky-500/50 rounded-tl-lg transition-colors duration-300" />
      <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 border-sky-500/0 group-hover:border-sky-500/50 rounded-br-lg transition-colors duration-300" />

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
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300">
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
  const [monitoredCommandIds, setMonitoredCommandIds] = useState<string[]>([]);
  const [generalInfo, setGeneralInfo] = useState("");

  // Helper booleans for view switching
  const isGeneralAgent = activeTab === "agent-general";
  const isAgentPanel = activeTab === "agent-panel";
  const isContextPanel = activeTab === "agent-context";
  const isDatabaseAgent = activeTab === "agent-database";
  const isTerminal = activeTab === "terminal";
  const isMetrics = !isGeneralAgent && !isAgentPanel && !isContextPanel && !isDatabaseAgent && !isTerminal;

  // Filter commands
  const tabCommands = commands.filter((c) => c.category === activeTab);
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

  const t = translations[language];

  // Monitoring handlers
  const handleStartMonitoring = (commandId: string) => {
    const newMonitoredIds = [...monitoredCommandIds, commandId];
    setMonitoredCommandIds(newMonitoredIds);
    startMonitoring(newMonitoredIds, 3000);
  };

  const handleStopMonitoring = () => {
    setMonitoredCommandIds([]);
    stopMonitoring();
  };

  // Effect: Refresh data when session changes
  useEffect(() => {
    if (currentSession && activeTab !== "terminal") {
      const ids = tabCommands.map((c) => c.id);
      if (ids.length > 0) {
        fetchAll(ids, false);
      }
    } else if (!currentSession) {
      clearData();
    }
  }, [currentSession?.id, activeTab]);

  return (
    <>
      {/* General Agent View */}
      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isGeneralAgent ? 'hidden' : ''}`}>
        <GeneralAgent 
          language={language} 
          aiSettings={aiSettings} 
          onOpenSettings={onOpenSettings}
          generalInfo={generalInfo}
          setGeneralInfo={setGeneralInfo}
        />
      </div>

      {/* Agent Panel View */}
      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isAgentPanel ? 'hidden' : ''}`}>
        <AgentPanel language={language} aiSettings={aiSettings} />
      </div>

      {/* General Info Context Panel */}
      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isContextPanel ? 'hidden' : ''}`}>
          <div className="h-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/60 overflow-y-auto custom-scrollbar">
             <GeneralInfoPanel
                language={language}
                generalInfo={generalInfo}
                setGeneralInfo={setGeneralInfo}
                aiSettings={aiSettings}
             />
          </div>
      </div>

      {/* Database Agent View */}
      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isDatabaseAgent ? 'hidden' : ''}`}>
        <DatabaseAgent 
          language={language} 
          aiSettings={aiSettings} 
          onOpenSettings={onOpenSettings}
        />
      </div>

      {/* Terminal View */}
      <div className={`flex-1 h-full p-6 flex flex-col glass-dark overflow-hidden relative ${!isTerminal ? 'hidden' : ''}`}>
        <div className="flex-1 bg-black/80 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 shadow-2xl relative z-10 ring-1 ring-white/5">
          <TerminalXterm onClose={() => {}} language={language} />
        </div>
      </div>

      {/* Main Dashboard Metrics View */}
      <div className={`flex-1 flex flex-col h-screen overflow-hidden glass relative ${!isMetrics ? 'hidden' : ''}`}>
      
      {/* Top Bar */}
      <div className="px-10 py-8 flex items-center justify-between relative z-20">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-black text-slate-800 tracking-tight capitalize flex items-center gap-3">
              {activeTab === 'system' && <Cpu className="text-sky-500" size={36} />}
              {activeTab === 'network' && <Globe className="text-sky-500" size={36} />}
              {activeTab === 'services' && <Server className="text-sky-500" size={36} />}
              {activeTab === 'docker' && <Layout className="text-sky-500" size={36} />}
              {t[activeTab as keyof typeof t] || activeTab}
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-sky-500 to-transparent mt-2 rounded-full" />
            
            {/* System Ticker */}
            <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-500">
                <span className="flex items-center gap-1">
                    <Clock size={12} className="text-sky-500" />
                    UPTIME: 42:12:09
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1">
                    <Activity size={12} className="text-emerald-500" />
                    SYS_LOAD: 0.45
                </span>
            </div>
          </motion.div>
          
          {/* Connection Status Indicator */}
          {currentSession && (
            <div className="flex items-center gap-2 mt-4 bg-white/60 backdrop-blur px-3 py-1.5 rounded-full border border-sky-100/50 w-fit shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-xs font-semibold text-slate-600">
                {t.connected_to}{" "}
                <span className="text-sky-600 font-mono">
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
                <div className="w-3 h-3 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                <span className="text-xs font-semibold text-sky-600">
                  {t.running}: {currentTaskTitle}
                </span>
              </div>
              <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-sky-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Monitoring Status */}
          {isMonitoring && (
            <div className="flex items-center gap-2 mr-4 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              <Activity size={14} className="text-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-600">
                {t.monitoring_metrics.replace('{0}', monitoredCommandIds.length.toString())}
              </span>
            </div>
          )}

          <div className="relative group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder={t.search_metrics}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all w-64 shadow-sm hover:shadow-md"
            />
          </div>

          <button
            onClick={() => setShowAbout(true)}
            className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:border-sky-200 hover:bg-sky-50 transition-all shadow-sm hover:shadow-md"
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Database Query Modal */}
      <AnimatePresence>
        {showDatabaseModal && (
          <MySQLManager onClose={() => setShowDatabaseModal(false)} language={language} aiSettings={aiSettings} />
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
                <motion.div 
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-500 shadow-lg shadow-blue-500/20"
                >
                  <Activity size={32} />
                </motion.div>
                <motion.h2 
                  whileHover={{ scale: 1.05 }}
                  className="text-2xl font-bold text-slate-800 mb-2 cursor-default"
                >
                  FUXI Server Forensics
                </motion.h2>
                <p className="text-slate-500 mb-8">
                  {t.about_title}
                </p>

                <div className="space-y-4 text-left">
                  <motion.div 
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(239, 246, 255, 0.5)" }}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors cursor-default group"
                  >
                    <div className="text-xs text-slate-400 group-hover:text-blue-500 font-semibold uppercase tracking-wider mb-1 transition-colors">
                      {t.author}
                    </div>
                    <div className="text-slate-700 font-medium flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                       yiyi、mid2dog
                    </div>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/30 transition-colors cursor-default group"
                  >
                    <div className="text-xs text-slate-400 group-hover:text-purple-500 font-semibold uppercase tracking-wider mb-2 transition-colors">
                      {t.tech_stack}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: "Tauri v2", color: "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100" },
                        { name: "Rust", color: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" },
                        { name: "React", color: "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100" },
                        { name: "TypeScript", color: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" },
                        { name: "Tailwind CSS", color: "bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100" },
                        { name: "Framer Motion", color: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100" },
                      ].map((tech) => (
                        <motion.span
                          key={tech.name}
                          whileHover={{ scale: 1.1, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-3 py-1.5 border rounded-lg text-xs font-semibold shadow-sm cursor-pointer transition-colors ${tech.color}`}
                        >
                          {tech.name}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
                {t.built_with.replace('{0}', APP_VERSION)}
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
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-lg shadow-sky-500/20 transition-all font-medium text-sm transform hover:scale-105 active:scale-95"
            >
              <Database size={16} />
              <span>{t.manage_database}</span>
            </button>
          </div>
        )}

        {/* Command Cards */}
        {filteredCommands.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-24 h-24 rounded-3xl bg-white/50 backdrop-blur shadow-xl shadow-sky-500/10 flex items-center justify-center mb-6 border border-white">
              <Cloud className="text-sky-400" size={48} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">
              {t.no_metrics_title}
            </h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8 text-lg">
              {t.no_metrics_desc}
            </p>
            <button className="px-8 py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-sky-500/30 transition-all flex items-center gap-3 transform hover:scale-105 active:scale-95">
              <RefreshCw size={20} />
              <span>{t.reload_system}</span>
            </button>
          </div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
                visible: {
                    transition: {
                        staggerChildren: 0.1
                    }
                }
            }}
            className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-24"
          >
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
          </motion.div>
        )}
      </div>

      {/* Footer Version */}
      <div className="absolute bottom-4 right-6 text-[10px] text-slate-400 font-mono z-10 opacity-50">
        FUXI_FORENSICS_CORE v{APP_VERSION}
      </div>
    </div>
    </>
  );
}