import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, ChevronDown, ChevronRight, Cpu, Download, HardDrive, Network, Play, Pause, ShieldAlert, ShieldCheck } from "lucide-react";
import { useCommandStore } from "../store/CommandContext";
import { Language, translations } from "../translations";
import { ChartDisplay } from "./ChartDisplay";

interface ResponsePanelProps {
  language: Language;
  active: boolean;
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

interface RemoteIpAggregate {
  ip: string;
  count: number;
  ports: string[];
  processes: string[];
  tag: "whitelist" | "blacklist" | "private" | "public";
}

type AlertTarget =
  | "threshold_cpu"
  | "threshold_mem"
  | "threshold_conn"
  | "threshold_traffic"
  | "metric_traffic"
  | "metric_conn"
  | "metric_host"
  | "ip_aggregate"
  | "flow_table"
  | "cpu_table";

interface AlertItem {
  target: AlertTarget;
  message: string;
  parameter: string;
  currentValue: string;
  thresholdValue?: string;
}

type ResponseSectionId =
  | "overview"
  | "thresholds"
  | "alerts"
  | "rules"
  | "metrics"
  | "trends"
  | "flows"
  | "actions";

const MONITOR_COMMANDS = [
  "response_net_rate",
  "response_conn_count",
  "response_host_cpu",
  "response_host_mem",
  "response_top_flows",
  "response_listen_services",
  "response_top_proc_cpu",
  "response_top_proc_mem",
];
const DEFAULT_BLACKLIST_VALUE = "45.9.148.114,198.51.100.10";
const DEFAULT_WHITELIST_VALUE = "127.0.0.1,::1";
const DEFAULT_SUSPICIOUS_KEYWORDS_VALUE = "bash,sh,python,perl,nc,ncat,socat,curl,wget";

function parsePipeTable(output: string, headers: string[]): ParsedTable {
  const rows = output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("|"));
  return { headers, rows };
}

function metricFromOutput(output: string, pattern: RegExp): number {
  const match = output.match(pattern);
  if (!match) return 0;
  return Number.parseFloat(match[1] || "0") || 0;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith("127.") ||
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

function classifyIp(ip: string, whitelist: Set<string>, blacklist: Set<string>): RemoteIpAggregate["tag"] {
  if (blacklist.has(ip)) return "blacklist";
  if (whitelist.has(ip)) return "whitelist";
  if (isPrivateIp(ip)) return "private";
  return "public";
}

function downloadFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 text-sky-600 flex items-center justify-center border border-sky-100/60 shadow-sm">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-800 tracking-tight">{title}</h3>
    </div>
  );
}

function CompactTable({ data }: { data: ParsedTable }) {
  const rows = data.rows.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
  return (
    <div className="overflow-auto max-h-80 border border-slate-100 rounded-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 sticky top-0 z-10">
            <th className="p-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-10 text-center">#</th>
            {data.headers.map((h, i) => (
              <th key={i} className="p-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-sky-50/30 even:bg-slate-50/40">
              <td className="p-2 text-xs text-slate-400 font-mono text-center align-top">{i + 1}</td>
              {row.map((cell, j) => (
                <td key={j} className="p-2 text-xs font-mono text-slate-700 whitespace-pre-wrap break-all align-top">
                  {cell}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={data.headers.length + 1} className="p-6 text-center text-xs text-slate-400">
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ResponsePanel({ language, active }: ResponsePanelProps) {
  const t = translations[language];
  const { startMonitoring, stopMonitoring, isMonitoring, getCommandData, getChartData, runCommand } = useCommandStore();
  const [cpuThreshold, setCpuThreshold] = useState(80);
  const [memThreshold, setMemThreshold] = useState(85);
  const [connThreshold, setConnThreshold] = useState(300);
  const [trafficThresholdKb, setTrafficThresholdKb] = useState(1024);
  const [focusedTarget, setFocusedTarget] = useState<AlertTarget | null>(null);
  const [blacklistInput, setBlacklistInput] = useState(DEFAULT_BLACKLIST_VALUE);
  const [whitelistInput, setWhitelistInput] = useState(DEFAULT_WHITELIST_VALUE);
  const [suspiciousKeywordsInput, setSuspiciousKeywordsInput] = useState(DEFAULT_SUSPICIOUS_KEYWORDS_VALUE);
  const [operator, setOperator] = useState("IR-Operator");
  const [confirmAction, setConfirmAction] = useState(false);
  const [actionTarget, setActionTarget] = useState("");
  const [actionTemplate, setActionTemplate] = useState("block_ip");
  const [executingAction, setExecutingAction] = useState(false);
  const [actionLogs, setActionLogs] = useState<Array<{ ts: string; operator: string; template: string; target: string; command: string; rollback: string; status: string }>>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<ResponseSectionId, boolean>>({
    overview: false,
    thresholds: false,
    alerts: false,
    rules: false,
    metrics: false,
    trends: false,
    flows: false,
    actions: false,
  });

  useEffect(() => {
    if (!active) {
      stopMonitoring();
      return;
    }
    startMonitoring(MONITOR_COMMANDS, 2000);
    return () => stopMonitoring();
  }, [active]);

  useEffect(() => {
    const stored = localStorage.getItem("response_rule_config");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (typeof parsed.blacklistInput === "string") setBlacklistInput(parsed.blacklistInput);
      if (typeof parsed.whitelistInput === "string") setWhitelistInput(parsed.whitelistInput);
      if (typeof parsed.suspiciousKeywordsInput === "string") setSuspiciousKeywordsInput(parsed.suspiciousKeywordsInput);
    } catch {
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "response_rule_config",
      JSON.stringify({
        blacklistInput,
        whitelistInput,
        suspiciousKeywordsInput,
      })
    );
  }, [blacklistInput, whitelistInput, suspiciousKeywordsInput]);

  useEffect(() => {
    const stored = localStorage.getItem("response_action_logs");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) setActionLogs(parsed);
    } catch {
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("response_action_logs", JSON.stringify(actionLogs.slice(0, 100)));
  }, [actionLogs]);

  const networkChart = getChartData("response_net_rate").map((point) => ({
    ...point,
    value: point.value / 1024,
    value2: (point.value2 || 0) / 1024,
  }));

  const connChart = getChartData("response_conn_count");
  const cpuChart = getChartData("response_host_cpu");
  const memChart = getChartData("response_host_mem");

  const topFlows = parsePipeTable(getCommandData("response_top_flows")?.stdout || "", [
    t.response_local_ip,
    t.response_local_port,
    t.response_remote_ip,
    t.response_remote_port,
    t.response_protocol,
    t.response_process,
  ]);

  const listening = parsePipeTable(getCommandData("response_listen_services")?.stdout || "", [
    t.response_protocol,
    t.response_port,
    t.response_process,
  ]);

  const topCpu = parsePipeTable(getCommandData("response_top_proc_cpu")?.stdout || "", [
    "PID",
    t.th_command,
    "CPU%",
    "MEM%",
  ]);

  const topMem = parsePipeTable(getCommandData("response_top_proc_mem")?.stdout || "", [
    "PID",
    t.th_command,
    "CPU%",
    "MEM%",
  ]);

  const latestNetwork = getCommandData("response_net_rate")?.stdout || "";
  const latestConnections = getCommandData("response_conn_count")?.stdout || "";
  const latestCpu = getCommandData("response_host_cpu")?.stdout || "";
  const latestMem = getCommandData("response_host_mem")?.stdout || "";

  const rx = metricFromOutput(latestNetwork, /RX:(\d+)/);
  const tx = metricFromOutput(latestNetwork, /TX:(\d+)/);
  const conn = metricFromOutput(latestConnections, /CONN:(\d+)/);
  const cpu = metricFromOutput(latestCpu, /CPU:([\d.]+)/);
  const mem = metricFromOutput(latestMem, /MEM:([\d.]+)/);
  const rxKb = rx / 1024;
  const txKb = tx / 1024;
  const blacklistSet = useMemo(() => new Set(blacklistInput.split(",").map((v) => v.trim()).filter(Boolean)), [blacklistInput]);
  const whitelistSet = useMemo(() => new Set(whitelistInput.split(",").map((v) => v.trim()).filter(Boolean)), [whitelistInput]);
  const suspiciousKeywords = useMemo(() => suspiciousKeywordsInput.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean), [suspiciousKeywordsInput]);

  const remoteIpAggregates: RemoteIpAggregate[] = useMemo(() => {
    const map = new Map<string, { count: number; ports: Set<string>; processes: Set<string> }>();
    for (const row of topFlows.rows) {
      const remoteIp = row[2] || "";
      const remotePort = row[3] || "";
      const processText = row[5] || "";
      if (!remoteIp) continue;
      const current = map.get(remoteIp) || { count: 0, ports: new Set<string>(), processes: new Set<string>() };
      current.count += 1;
      if (remotePort) current.ports.add(remotePort);
      if (processText) current.processes.add(processText);
      map.set(remoteIp, current);
    }
    return Array.from(map.entries())
      .map(([ip, value]) => ({
        ip,
        count: value.count,
        ports: Array.from(value.ports).slice(0, 8),
        processes: Array.from(value.processes).slice(0, 6),
        tag: classifyIp(ip, whitelistSet, blacklistSet),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [topFlows.rows, whitelistSet, blacklistSet]);

  const suspiciousProcessCount = useMemo(() => {
    const allProcessTexts = [
      ...topCpu.rows.map((r) => r[1] || ""),
      ...topMem.rows.map((r) => r[1] || ""),
      ...topFlows.rows.map((r) => r[5] || ""),
    ].join(" ").toLowerCase();
    return suspiciousKeywords.filter((k) => allProcessTexts.includes(k)).length;
  }, [topCpu.rows, topMem.rows, topFlows.rows, suspiciousKeywords]);

  const blacklistCount = remoteIpAggregates.filter((item) => item.tag === "blacklist").length;
  const isCpuAlert = cpu >= cpuThreshold;
  const isMemAlert = mem >= memThreshold;
  const isConnAlert = conn >= connThreshold;
  const isTrafficAlert = rxKb >= trafficThresholdKb || txKb >= trafficThresholdKb;
  const isBlacklistAlert = blacklistCount > 0;
  const isProcessAlert = suspiciousProcessCount > 0;

  const warnings = useMemo(() => {
    const result: AlertItem[] = [];
    if (isCpuAlert) result.push({ target: "threshold_cpu", message: t.response_warn_cpu.replace("{0}", cpu.toFixed(1)).replace("{1}", cpuThreshold.toString()), parameter: t.response_threshold_cpu, currentValue: `${cpu.toFixed(1)}%`, thresholdValue: `${cpuThreshold}%` });
    if (isMemAlert) result.push({ target: "threshold_mem", message: t.response_warn_mem.replace("{0}", mem.toFixed(1)).replace("{1}", memThreshold.toString()), parameter: t.response_threshold_mem, currentValue: `${mem.toFixed(1)}%`, thresholdValue: `${memThreshold}%` });
    if (isConnAlert) result.push({ target: "threshold_conn", message: t.response_warn_conn.replace("{0}", conn.toString()).replace("{1}", connThreshold.toString()), parameter: t.response_threshold_conn, currentValue: `${conn}`, thresholdValue: `${connThreshold}` });
    if (isTrafficAlert) {
      result.push(
        {
          target: "threshold_traffic",
          message: t.response_warn_traffic
            .replace("{0}", rxKb.toFixed(1))
            .replace("{1}", txKb.toFixed(1))
            .replace("{2}", trafficThresholdKb.toString()),
          parameter: t.response_threshold_traffic,
          currentValue: `RX ${rxKb.toFixed(1)} / TX ${txKb.toFixed(1)} KB/s`,
          thresholdValue: `${trafficThresholdKb} KB/s`
        }
      );
    }
    if (isBlacklistAlert) result.push({ target: "ip_aggregate", message: t.response_warn_blacklist.replace("{0}", blacklistCount.toString()), parameter: t.response_ip_agg_table, currentValue: `${blacklistCount}`, thresholdValue: "> 0" });
    if (isProcessAlert) result.push({ target: "cpu_table", message: t.response_warn_proc.replace("{0}", suspiciousProcessCount.toString()), parameter: t.response_proc_signal, currentValue: `${suspiciousProcessCount}`, thresholdValue: "> 0" });
    return result;
  }, [isCpuAlert, isMemAlert, isConnAlert, isTrafficAlert, isBlacklistAlert, isProcessAlert, cpu, cpuThreshold, mem, memThreshold, conn, connThreshold, rxKb, txKb, trafficThresholdKb, blacklistCount, suspiciousProcessCount, t]);

  const snapshot = useMemo(
    () => ({
      generated_at: new Date().toISOString(),
      metrics: {
        rx_kb_s: Number(rxKb.toFixed(3)),
        tx_kb_s: Number(txKb.toFixed(3)),
        established_connections: conn,
        cpu_percent: Number(cpu.toFixed(2)),
        mem_percent: Number(mem.toFixed(2)),
      },
      thresholds: {
        cpu_percent: cpuThreshold,
        mem_percent: memThreshold,
        connection_count: connThreshold,
        traffic_kb_s: trafficThresholdKb,
      },
      warnings: warnings.map((w) => w.message),
      remote_ip_aggregates: remoteIpAggregates,
      top_flows: topFlows.rows,
      listening_services: listening.rows,
      top_cpu_processes: topCpu.rows,
      top_mem_processes: topMem.rows,
    }),
    [rxKb, txKb, conn, cpu, mem, cpuThreshold, memThreshold, connThreshold, trafficThresholdKb, warnings, remoteIpAggregates, topFlows.rows, listening.rows, topCpu.rows, topMem.rows]
  );

  const exportJson = () => {
    const fileName = `incident-snapshot-${Date.now()}.json`;
    downloadFile(fileName, JSON.stringify(snapshot, null, 2), "application/json");
  };

  const exportMarkdown = () => {
    const warningLines = warnings.length > 0 ? warnings.map((item) => `- ${item.message}`).join("\n") : `- ${t.response_no_warning}`;
    const topRemoteRows = remoteIpAggregates
      .map((row) => `| ${row.ip} | ${row.tag} | ${row.count} | ${row.ports.join(", ")} | ${row.processes.join(", ")} |`)
      .join("\n");
    const md = `# ${t.response_title}

${new Date(snapshot.generated_at).toLocaleString()}

## ${t.response_host_usage}

- RX: ${snapshot.metrics.rx_kb_s} KB/s
- TX: ${snapshot.metrics.tx_kb_s} KB/s
- ${t.response_conn_count}: ${snapshot.metrics.established_connections}
- CPU: ${snapshot.metrics.cpu_percent}%
- MEM: ${snapshot.metrics.mem_percent}%

## ${t.response_warning_title}

${warningLines}

## ${t.response_ip_agg_table}

| IP | Tag | Hits | Ports | Processes |
|---|---|---:|---|---|
${topRemoteRows}
`;
    const fileName = `incident-snapshot-${Date.now()}.md`;
    downloadFile(fileName, md, "text/markdown");
  };

  const jumpToTarget = (target: AlertTarget) => {
    const el = document.getElementById(`resp-${target}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedTarget(target);
    window.setTimeout(() => setFocusedTarget((prev) => (prev === target ? null : prev)), 1600);
  };

  const sectionNav: Array<{ id: ResponseSectionId; label: string }> = [
    { id: "overview", label: t.response_nav_overview },
    { id: "thresholds", label: t.response_nav_thresholds },
    { id: "alerts", label: t.response_nav_alerts },
    { id: "rules", label: t.response_nav_rules },
    { id: "metrics", label: t.response_nav_metrics },
    { id: "trends", label: t.response_nav_trends },
    { id: "flows", label: t.response_nav_flows },
    { id: "actions", label: t.response_nav_actions },
  ];

  const scrollToSection = (sectionId: ResponseSectionId) => {
    const el = document.getElementById(`resp-section-${sectionId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleSection = (sectionId: ResponseSectionId) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const buildActionPayload = () => {
    const target = actionTarget.trim();
    if (!target) {
      return null;
    }
    if (actionTemplate === "block_ip") {
      return {
        command: `iptables -I INPUT -s ${target} -j DROP`,
        rollback: `iptables -D INPUT -s ${target} -j DROP`,
      };
    }
    if (actionTemplate === "kill_process") {
      return {
        command: `kill -9 ${target}`,
        rollback: t.response_no_rollback,
      };
    }
    return {
      command: `usermod -L ${target}`,
      rollback: `usermod -U ${target}`,
    };
  };

  const executeActionTemplate = async () => {
    const payload = buildActionPayload();
    if (!payload || !confirmAction || executingAction) return;
    setExecutingAction(true);
    const cmdId = `response_action_${actionTemplate}`;
    let status = t.completed;
    try {
      await runCommand(cmdId, payload.command);
    } catch {
      status = t.error_status;
    } finally {
      const record = {
        ts: new Date().toISOString(),
        operator: operator || "IR-Operator",
        template: actionTemplate,
        target: actionTarget,
        command: payload.command,
        rollback: payload.rollback,
        status,
      };
      setActionLogs((prev) => [record, ...prev].slice(0, 100));
      setConfirmAction(false);
      setExecutingAction(false);
    }
  };

  return (
    <div className="relative h-full overflow-y-auto custom-scrollbar p-6 bg-white/90 rounded-3xl border border-slate-200/70 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
      <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-sky-200/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-indigo-200/20 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{t.response_title}</h2>
          <p className="text-sm text-slate-500 mt-1">{t.response_subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => (isMonitoring ? stopMonitoring() : startMonitoring(MONITOR_COMMANDS, 2000))}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shadow-sm ${
              isMonitoring ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {isMonitoring ? <Pause size={14} /> : <Play size={14} />}
            {isMonitoring ? t.stop_monitoring : t.start_monitoring}
          </button>
          <button
            onClick={exportJson}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-2 shadow-sm"
          >
            <Download size={12} />
            {t.response_export_json}
          </button>
          <button
            onClick={exportMarkdown}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-800 text-white flex items-center gap-2 shadow-sm"
          >
            <Download size={12} />
            {t.response_export_md}
          </button>
        </div>
      </div>

      <div id="resp-section-overview" className="mb-6 panel-soft p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {t.response_nav_overview}
          </div>
          <div className="flex flex-wrap gap-2">
            {sectionNav.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-sky-200 hover:text-sky-600 hover:bg-sky-50/60"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section id="resp-section-thresholds" className="mb-6">
        <button
          onClick={() => toggleSection("thresholds")}
          className="w-full mb-3 flex items-center justify-between px-4 py-3 rounded-2xl bg-white/90 border border-slate-200/80 text-slate-700 hover:border-sky-200"
        >
          <span className="text-sm font-semibold">{t.response_nav_thresholds}</span>
          {collapsedSections.thresholds ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      {!collapsedSections.thresholds && (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="grid grid-cols-1 xl:grid-cols-4 gap-3">
        <div id="resp-threshold_cpu" className={`bg-white/90 border rounded-2xl p-3 shadow-sm ${focusedTarget === "threshold_cpu" ? "border-red-400 ring-2 ring-red-200" : "border-slate-200/80"}`}>
          <div className="text-[11px] text-slate-500 mb-1">{t.response_threshold_cpu}</div>
          <input
            type="number"
            min={1}
            max={100}
            value={cpuThreshold}
            onChange={(e) => setCpuThreshold(Number(e.target.value) || 80)}
            className={`w-full border rounded-lg px-2 py-1.5 text-sm ${isCpuAlert ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200"}`}
          />
        </div>
        <div id="resp-threshold_mem" className={`bg-white/90 border rounded-2xl p-3 shadow-sm ${focusedTarget === "threshold_mem" ? "border-red-400 ring-2 ring-red-200" : "border-slate-200/80"}`}>
          <div className="text-[11px] text-slate-500 mb-1">{t.response_threshold_mem}</div>
          <input
            type="number"
            min={1}
            max={100}
            value={memThreshold}
            onChange={(e) => setMemThreshold(Number(e.target.value) || 85)}
            className={`w-full border rounded-lg px-2 py-1.5 text-sm ${isMemAlert ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200"}`}
          />
        </div>
        <div id="resp-threshold_conn" className={`bg-white/90 border rounded-2xl p-3 shadow-sm ${focusedTarget === "threshold_conn" ? "border-red-400 ring-2 ring-red-200" : "border-slate-200/80"}`}>
          <div className="text-[11px] text-slate-500 mb-1">{t.response_threshold_conn}</div>
          <input
            type="number"
            min={1}
            value={connThreshold}
            onChange={(e) => setConnThreshold(Number(e.target.value) || 300)}
            className={`w-full border rounded-lg px-2 py-1.5 text-sm ${isConnAlert ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200"}`}
          />
        </div>
        <div id="resp-threshold_traffic" className={`bg-white/90 border rounded-2xl p-3 shadow-sm ${focusedTarget === "threshold_traffic" ? "border-red-400 ring-2 ring-red-200" : "border-slate-200/80"}`}>
          <div className="text-[11px] text-slate-500 mb-1">{t.response_threshold_traffic}</div>
          <input
            type="number"
            min={1}
            value={trafficThresholdKb}
            onChange={(e) => setTrafficThresholdKb(Number(e.target.value) || 1024)}
            className={`w-full border rounded-lg px-2 py-1.5 text-sm ${isTrafficAlert ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200"}`}
          />
        </div>
      </motion.div>
      )}
      </section>

      <section id="resp-section-alerts" className="mb-6">
        <button
          onClick={() => toggleSection("alerts")}
          className="w-full mb-3 flex items-center justify-between px-4 py-3 rounded-2xl bg-white/90 border border-slate-200/80 text-slate-700 hover:border-sky-200"
        >
          <span className="text-sm font-semibold">{t.response_nav_alerts}</span>
          {collapsedSections.alerts ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      {!collapsedSections.alerts && (
      <div className={`rounded-2xl border p-4 shadow-sm ${warnings.length > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div className={`flex items-center gap-2 font-semibold text-sm ${warnings.length > 0 ? "text-red-700" : "text-emerald-700"}`}>
          {warnings.length > 0 ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
          {t.response_warning_title}
        </div>
        <div className="mt-2 space-y-1">
          {warnings.length > 0 ? (
            warnings.map((item, idx) => (
              <button key={idx} onClick={() => jumpToTarget(item.target)} className="w-full text-left text-xs text-red-700 flex items-start gap-1 hover:bg-red-100/60 rounded px-1 py-1 transition-colors">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold">{item.parameter}</span>
                  <span className="ml-2 text-red-600">{item.currentValue}</span>
                  {item.thresholdValue && <span className="ml-2 text-red-500">/ {item.thresholdValue}</span>}
                  <span className="ml-2">{item.message}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="text-xs text-emerald-700">{t.response_no_warning}</div>
          )}
        </div>
      </div>
      )}
      </section>

      <section id="resp-section-rules" className="mb-6">
        <button
          onClick={() => toggleSection("rules")}
          className="w-full mb-3 flex items-center justify-between px-4 py-3 rounded-2xl bg-white/90 border border-slate-200/80 text-slate-700 hover:border-sky-200"
        >
          <span className="text-sm font-semibold">{t.response_nav_rules}</span>
          {collapsedSections.rules ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      {!collapsedSections.rules && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-600 mb-2">{t.response_rule_blacklist}</div>
          <input
            value={blacklistInput}
            onChange={(e) => setBlacklistInput(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono"
            placeholder="1.2.3.4,5.6.7.8"
          />
        </div>
        <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-600 mb-2">{t.response_rule_whitelist}</div>
          <input
            value={whitelistInput}
            onChange={(e) => setWhitelistInput(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono"
            placeholder="127.0.0.1,::1"
          />
        </div>
        <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-600 mb-2">{t.response_rule_keywords}</div>
          <input
            value={suspiciousKeywordsInput}
            onChange={(e) => setSuspiciousKeywordsInput(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono"
            placeholder="bash,python,nc,socat"
          />
        </div>
      </div>
      )}
      </section>

      <section id="resp-section-metrics" className="mb-6">
        <button
          onClick={() => toggleSection("metrics")}
          className="w-full mb-3 flex items-center justify-between px-4 py-3 rounded-2xl bg-white/90 border border-slate-200/80 text-slate-700 hover:border-sky-200"
        >
          <span className="text-sm font-semibold">{t.response_nav_metrics}</span>
          {collapsedSections.metrics ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      {!collapsedSections.metrics && (
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div id="resp-metric_traffic" className={`rounded-2xl p-4 relative shadow-sm ${isTrafficAlert ? "bg-red-50 border border-red-200" : "bg-white border border-slate-200/80"} ${focusedTarget === "metric_traffic" ? "ring-2 ring-red-300" : ""}`}>
          {isTrafficAlert && <span className="absolute right-3 top-3 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t.response_alert_badge}</span>}
          <div className="text-xs text-slate-500">{t.response_upstream}</div>
          <div className="mt-1 text-xl font-bold text-sky-600">{(tx / 1024).toFixed(2)} KB/s</div>
        </div>
        <div className={`rounded-2xl p-4 relative shadow-sm ${isTrafficAlert ? "bg-red-50 border border-red-200" : "bg-white border border-slate-200/80"} ${focusedTarget === "metric_traffic" ? "ring-2 ring-red-300" : ""}`}>
          {isTrafficAlert && <span className="absolute right-3 top-3 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t.response_alert_badge}</span>}
          <div className="text-xs text-slate-500">{t.response_downstream}</div>
          <div className="mt-1 text-xl font-bold text-emerald-600">{(rx / 1024).toFixed(2)} KB/s</div>
        </div>
        <div id="resp-metric_conn" className={`rounded-2xl p-4 relative shadow-sm ${isConnAlert ? "bg-red-50 border border-red-200" : "bg-white border border-slate-200/80"} ${focusedTarget === "metric_conn" ? "ring-2 ring-red-300" : ""}`}>
          {isConnAlert && <span className="absolute right-3 top-3 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t.response_alert_badge}</span>}
          <div className="text-xs text-slate-500">{t.response_conn_count}</div>
          <div className="mt-1 text-xl font-bold text-amber-600">{conn}</div>
        </div>
        <div id="resp-metric_host" className={`rounded-2xl p-4 relative shadow-sm ${isCpuAlert || isMemAlert ? "bg-red-50 border border-red-200" : "bg-white border border-slate-200/80"} ${focusedTarget === "metric_host" ? "ring-2 ring-red-300" : ""}`}>
          {(isCpuAlert || isMemAlert) && <span className="absolute right-3 top-3 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t.response_alert_badge}</span>}
          <div className="text-xs text-slate-500">{t.response_host_usage}</div>
          <div className="mt-1 text-xl font-bold text-violet-600">CPU {cpu.toFixed(1)}% / MEM {mem.toFixed(1)}%</div>
        </div>
      </div>
      )}
      </section>

      <section id="resp-section-trends" className="mb-6">
        <button
          onClick={() => toggleSection("trends")}
          className="w-full mb-3 flex items-center justify-between px-4 py-3 rounded-2xl bg-white/90 border border-slate-200/80 text-slate-700 hover:border-sky-200"
        >
          <span className="text-sm font-semibold">{t.response_nav_trends}</span>
          {collapsedSections.trends ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      {!collapsedSections.trends && (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white/90 border border-slate-200/80 rounded-3xl p-4 shadow-sm">
          <SectionTitle icon={<Network size={15} />} title={t.response_rate_chart} />
          <ChartDisplay data={networkChart} title={t.response_rate_chart} yAxisLabel="KB/s" unit="KB/s" />
        </div>
        <div className="bg-white/90 border border-slate-200/80 rounded-3xl p-4 shadow-sm">
          <SectionTitle icon={<Activity size={15} />} title={t.response_conn_chart} />
          <ChartDisplay data={connChart} title={t.response_conn_chart} yAxisLabel={t.response_conn_count} unit="" />
        </div>
        <div className="bg-white/90 border border-slate-200/80 rounded-3xl p-4 shadow-sm">
          <SectionTitle icon={<Cpu size={15} />} title={t.response_cpu_chart} />
          <ChartDisplay data={cpuChart} title={t.response_cpu_chart} yAxisLabel="CPU %" unit="%" />
        </div>
        <div className="bg-white/90 border border-slate-200/80 rounded-3xl p-4 shadow-sm">
          <SectionTitle icon={<HardDrive size={15} />} title={t.response_mem_chart} />
          <ChartDisplay data={memChart} title={t.response_mem_chart} yAxisLabel="MEM %" unit="%" />
        </div>
      </div>
      )}
      </section>

      <section id="resp-section-flows" className="mb-6">
        <button
          onClick={() => toggleSection("flows")}
          className="w-full mb-3 flex items-center justify-between px-4 py-3 rounded-2xl bg-white/90 border border-slate-200/80 text-slate-700 hover:border-sky-200"
        >
          <span className="text-sm font-semibold">{t.response_nav_flows}</span>
          {collapsedSections.flows ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      {!collapsedSections.flows && (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div id="resp-ip_aggregate" className={`bg-white/90 border rounded-3xl p-4 shadow-sm ${focusedTarget === "ip_aggregate" ? "border-red-400 ring-2 ring-red-200" : "border-slate-200/80"}`}>
          <SectionTitle icon={<ShieldAlert size={15} />} title={t.response_ip_agg_table} />
          <div className="overflow-auto max-h-72 border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 sticky top-0 z-10">
                  <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">IP</th>
                  <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t.th_status}</th>
                  <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hits</th>
                  <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t.response_port}</th>
                  <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t.response_process}</th>
                </tr>
              </thead>
              <tbody>
                {remoteIpAggregates.map((item, idx) => (
                  <tr
                    key={`${item.ip}-${idx}`}
                    className={`border-t border-slate-100 hover:bg-sky-50/30 ${item.tag === "blacklist" ? "bg-red-50/60" : ""}`}
                  >
                    <td className="p-2 text-xs font-mono text-slate-700">{item.ip}</td>
                    <td className="p-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          item.tag === "blacklist"
                            ? "bg-red-100 text-red-700"
                            : item.tag === "whitelist"
                              ? "bg-emerald-100 text-emerald-700"
                              : item.tag === "private"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.tag === "blacklist" ? `${item.tag} · ${t.response_alert_badge}` : item.tag}
                      </span>
                    </td>
                    <td className="p-2 text-xs font-semibold text-slate-700">{item.count}</td>
                    <td className="p-2 text-xs font-mono text-slate-700">{item.ports.join(", ")}</td>
                    <td className="p-2 text-xs font-mono text-slate-700">{item.processes.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div id="resp-flow_table" className={`rounded-3xl p-4 shadow-sm ${isBlacklistAlert ? "bg-red-50/60 border border-red-200" : "bg-white/90 border border-slate-200/80"} ${focusedTarget === "flow_table" ? "ring-2 ring-red-200" : ""}`}>
          <SectionTitle icon={<Network size={15} />} title={t.response_flow_table} />
          <CompactTable data={topFlows} />
        </div>
        <div className="bg-white/90 border border-slate-200/80 rounded-3xl p-4 shadow-sm">
          <SectionTitle icon={<Activity size={15} />} title={t.response_listen_table} />
          <CompactTable data={listening} />
        </div>
        <div id="resp-cpu_table" className={`rounded-3xl p-4 shadow-sm ${isProcessAlert ? "bg-red-50/60 border border-red-200" : "bg-white/90 border border-slate-200/80"} ${focusedTarget === "cpu_table" ? "ring-2 ring-red-200" : ""}`}>
          <SectionTitle icon={<Cpu size={15} />} title={t.response_cpu_table} />
          <CompactTable data={topCpu} />
        </div>
        <div className={`rounded-3xl p-4 shadow-sm ${isProcessAlert ? "bg-red-50/60 border border-red-200" : "bg-white/90 border border-slate-200/80"}`}>
          <SectionTitle icon={<HardDrive size={15} />} title={t.response_mem_table} />
          <CompactTable data={topMem} />
        </div>
      </div>
      )}
      </section>

      <section id="resp-section-actions" className="mb-2">
        <button
          onClick={() => toggleSection("actions")}
          className="w-full mb-3 flex items-center justify-between px-4 py-3 rounded-2xl bg-white/90 border border-slate-200/80 text-slate-700 hover:border-sky-200"
        >
          <span className="text-sm font-semibold">{t.response_nav_actions}</span>
          {collapsedSections.actions ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      {!collapsedSections.actions && (
      <div className="bg-white/90 border border-slate-200/80 rounded-3xl p-4 shadow-sm">
        <SectionTitle icon={<ShieldCheck size={15} />} title={t.response_action_title} />
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 mb-3">
          <input
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder={t.response_action_operator}
          />
          <select
            value={actionTemplate}
            onChange={(e) => setActionTemplate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="block_ip">{t.response_action_block_ip}</option>
            <option value="kill_process">{t.response_action_kill_process}</option>
            <option value="lock_user">{t.response_action_lock_user}</option>
          </select>
          <input
            value={actionTarget}
            onChange={(e) => setActionTarget(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm xl:col-span-2"
            placeholder={t.response_action_target}
          />
          <button
            onClick={executeActionTemplate}
            disabled={!confirmAction || !actionTarget.trim() || executingAction}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {executingAction ? t.processing_status : t.response_action_execute}
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 mb-3">
          <input type="checkbox" checked={confirmAction} onChange={(e) => setConfirmAction(e.target.checked)} />
          {t.response_action_confirm}
        </label>
        <div className="overflow-auto max-h-56 border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 sticky top-0 z-10">
                <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase">Time</th>
                <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase">{t.response_action_operator}</th>
                <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase">{t.response_action_template}</th>
                <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase">{t.response_action_target}</th>
                <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase">Command</th>
                <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase">{t.response_action_rollback}</th>
                <th className="p-2 text-[11px] font-semibold text-slate-500 uppercase">{t.th_status}</th>
              </tr>
            </thead>
            <tbody>
              {actionLogs.map((log, idx) => (
                <tr key={`${log.ts}-${idx}`} className="border-t border-slate-100">
                  <td className="p-2 text-xs font-mono text-slate-700">{new Date(log.ts).toLocaleString()}</td>
                  <td className="p-2 text-xs text-slate-700">{log.operator}</td>
                  <td className="p-2 text-xs text-slate-700">{log.template}</td>
                  <td className="p-2 text-xs font-mono text-slate-700">{log.target}</td>
                  <td className="p-2 text-xs font-mono text-slate-700">{log.command}</td>
                  <td className="p-2 text-xs font-mono text-slate-700">{log.rollback}</td>
                  <td className="p-2 text-xs text-slate-700">{log.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
      </section>
    </div>
  );
}
