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
} from "lucide-react";
import { translations, Language } from "../translations";
import { commands, PluginCommand } from "../config/commands";
import { useCommandStore } from "../store/CommandContext";
import { ChartDisplay } from "./ChartDisplay";
import TerminalXterm from "./TerminalXterm";
import MySQLManager from "./tools/MySQLManager";

// --- Types ---
type TableData = { headers: string[]; rows: string[][] };

// --- Parsers ---
const parsers: Record<
  string,
  (output: string, args?: any) => TableData | string
> = {
  disk: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["Filesystem", "Size", "Used", "Avail", "Use%", "Mounted"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  process: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["PID", "User", "%CPU", "%MEM", "Command"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  network: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["Interface", "IP Address"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  ports: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["Protocol", "Local Address", "Process"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  docker: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["ID", "Image", "Status", "Names"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  simpleList: (output, args) => {
    const lines = output.trim().split("\n");
    const headers = args || ["Value"];
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
    const headers = ["Name", "Status", "Roles", "Version"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  k8sPods: (output) => {
    const lines = output.trim().split("\n");
    const headers = ["Namespace", "Name", "Status", "IP"];
    const rows = lines.map((line) => line.split("|"));
    return { headers, rows };
  },
  raw: (output) => output,
};

// --- Helper Components ---

function TableDisplay({ data }: { data: TableData }) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            {data.headers.map((h, i) => (
              <th
                key={i}
                className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap bg-slate-50/50"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr
              key={i}
              className="hover:bg-blue-50/50 transition-colors group border-b border-slate-100 last:border-0"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="p-3 text-sm text-slate-600 font-mono whitespace-nowrap group-hover:text-slate-800"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "error" | "loading" }) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        Processing
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-medium border border-red-100">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Error
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-medium border border-green-100">
      <Check size={12} />
      OK
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
}) {
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
          <p className="text-slate-400 text-sm">No data available</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Load Data
        </button>
      </div>
    );
  } else if (loading) {
    content = (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="w-8 h-8 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">Fetching data...</span>
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
        content = <TableDisplay data={parsedData} />;
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
              未检测到 {title}
            </h3>
            <p className="text-slate-400 text-sm">
              该功能或配置不存在于当前系统
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
            <h3 className="text-slate-800 font-medium mb-1">命令执行失败</h3>
            <p className="text-slate-400 text-sm">
              无法执行该命令，请检查权限和命令语法
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
              {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
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
        content = <TableDisplay data={parsedData} />;
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="light-card overflow-visible relative border border-slate-200/60 shadow-sm hover:shadow-md transition-all group"
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
              Function Description
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
          <span className="font-semibold text-slate-700">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge
            status={loading ? "loading" : data?.stderr ? "error" : "ok"}
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
}

export default function Dashboard({
  activeTab,
  language,
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

  if (activeTab === "terminal") {
    return (
      <div className="flex-1 h-full p-6 flex flex-col bg-[#1e1e2e] overflow-hidden relative">
        <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-2xl relative z-10">
          <TerminalXterm onClose={() => {}} />
        </div>
      </div>
    );
  }

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
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
      {/* Background Watermark */}
      <div className="watermark-container pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={i} className="watermark-text text-slate-200/20">
            FUXI Server Forensics
          </span>
        ))}
      </div>

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
            System Overview & Monitoring Dashboard
          </p>
          {/* Connection Status Indicator */}
          {currentSession && (
            <div className="flex items-center gap-2 mt-2 bg-white/50 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200/50 w-fit shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-xs font-semibold text-slate-600">
                Connected to{" "}
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
                  Running: {currentTaskTitle}
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
                Monitoring {monitoredCommandIds.length} metrics
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
              placeholder="Search metrics..."
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
              <MySQLManager onClose={() => setShowDatabaseModal(false)} />
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
                  Advanced System Intelligence & Forensics Tool
                </p>

                <div className="space-y-4 text-left">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Author
                    </div>
                    <div className="text-slate-700 font-medium">yiyi</div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Tech Stack
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
                v0.1.0 • Built with ❤️ for Security
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
              <span>Manage Database</span>
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
              No Data Available
            </h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8 text-lg">
              There are no metrics to display for this category. Try selecting a
              different tab or running a custom command.
            </p>
            <button className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center gap-3 transform hover:scale-105 active:scale-95">
              <RefreshCw size={20} />
              <span>Reload System</span>
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
  );
}
