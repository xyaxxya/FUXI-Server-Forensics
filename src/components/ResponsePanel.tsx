import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Cpu,
  Download,
  Gauge,
  HardDrive,
  Network,
  Pause,
  Play,
  RadioTower,
  Route,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
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

interface SuspiciousProcessRecord {
  pid: string;
  process: string;
  cpu: number;
  mem: number;
  keywordHits: string[];
  score: number;
  severity: "critical" | "high" | "medium";
}

interface SuspiciousNetworkRecord extends RemoteIpAggregate {
  score: number;
  severity: "critical" | "high" | "medium";
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
  severity: "critical" | "high";
}

type ResponseSectionId = "overview" | "metrics" | "trends" | "flows" | "rules" | "actions";

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
const DEFAULT_SUSPICIOUS_KEYWORDS_VALUE = "bash,sh,python,perl,nc,ncat,socat,curl,wget,cryptominer,kdevtmpfsi,kinsing,ddgs";

function text(language: Language, zh: string, en: string) {
  return language === "zh" ? zh : en;
}

function parsePipeTable(output: string, headers: string[]): ParsedTable {
  const rows = output
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((cell) => cell.trim()));
  return { headers, rows };
}

function metricFromOutput(output: string, pattern: RegExp): number {
  const match = output.match(pattern);
  if (!match) return 0;
  return Number.parseFloat(match[1] || "0") || 0;
}

function parseMetricCell(value: string): number {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  return cleaned ? Number.parseFloat(cleaned) || 0 : 0;
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

function getTimeAgo(language: Language, timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return text(language, "刚刚", "Just now");
  if (seconds < 60) return text(language, `${seconds}秒前`, `${seconds}s ago`);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return text(language, `${minutes}分钟前`, `${minutes}m ago`);
  const hours = Math.floor(minutes / 60);
  return text(language, `${hours}小时前`, `${hours}h ago`);
}

function SectionHeading({ icon, title, extra }: { icon: ReactNode; title: string; extra?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-[#0078D4]">
          {icon}
        </div>
        <h3 className="truncate text-sm font-bold text-slate-900">{title}</h3>
      </div>
      {extra}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  alert,
  targetId,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: string;
  alert?: boolean;
  targetId?: string;
}) {
  return (
    <motion.div
      id={targetId}
      whileHover={{ y: -2 }}
      className={`relative overflow-hidden rounded-[1.45rem] border bg-white/92 p-4 shadow-[0_14px_32px_rgba(0,91,158,0.08)] ${
        alert ? "border-red-200 ring-2 ring-red-100" : "border-sky-100/80"
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${tone}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
          <div className="mt-2 truncate text-2xl font-black tracking-tight text-slate-900">{value}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{hint}</div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-[#0078D4]">
          {icon}
        </div>
      </div>
      {alert && (
        <div className="mt-3 inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">
          Alert
        </div>
      )}
    </motion.div>
  );
}

function RadialMeter({ label, value, color }: { label: string; value: number; color: string }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sky-100/80 bg-white/82 p-3">
      <div
        className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${bounded * 3.6}deg, rgba(226,242,253,0.96) 0deg)` }}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-sm font-black text-slate-900">
          {bounded.toFixed(0)}%
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{bounded >= 80 ? "High pressure" : "Stable range"}</div>
      </div>
    </div>
  );
}

function CompactTable({ data, maxHeight = "max-h-72" }: { data: ParsedTable; maxHeight?: string }) {
  const rows = data.rows.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
  return (
    <div className={`custom-scrollbar overflow-auto rounded-2xl border border-sky-100/80 ${maxHeight}`}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="sticky top-0 z-10 bg-sky-50/95">
            <th className="w-10 p-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">#</th>
            {data.headers.map((header, index) => (
              <th key={index} className="p-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-sky-50 hover:bg-sky-50/60">
                <td className="p-2 text-center font-mono text-xs text-slate-400">{rowIndex + 1}</td>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="p-2 align-top font-mono text-xs text-slate-700">
                    <span className="break-all">{cell || "-"}</span>
                  </td>
                ))}
              </tr>
            ))
          ) : (
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

function tagClass(tag: RemoteIpAggregate["tag"]) {
  if (tag === "blacklist") return "border-red-200 bg-red-50 text-red-700";
  if (tag === "whitelist") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tag === "private") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function ResponsePanel({ language, active }: ResponsePanelProps) {
  const t = translations[language];
  const { startMonitoring, stopMonitoring, isMonitoring, getCommandData, getChartData, runCommand, currentSession } = useCommandStore();
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
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    const saved = localStorage.getItem("response_refresh_interval");
    return saved ? Number.parseInt(saved, 10) : 2000;
  });

  useEffect(() => {
    if (!active) {
      stopMonitoring();
      return;
    }
    startMonitoring(MONITOR_COMMANDS, refreshInterval);
    const interval = window.setInterval(() => setLastUpdateTime(Date.now()), refreshInterval);
    return () => {
      stopMonitoring();
      window.clearInterval(interval);
    };
  }, [active, refreshInterval]);

  useEffect(() => {
    localStorage.setItem("response_refresh_interval", String(refreshInterval));
  }, [refreshInterval]);

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
    localStorage.setItem("response_rule_config", JSON.stringify({ blacklistInput, whitelistInput, suspiciousKeywordsInput }));
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
  const latestNetworkPoint = networkChart[networkChart.length - 1];
  const rxKb = latestNetworkPoint?.value ?? 0;
  const txKb = latestNetworkPoint?.value2 ?? 0;
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
  const topCpu = parsePipeTable(getCommandData("response_top_proc_cpu")?.stdout || "", ["PID", t.th_command, "CPU%", "MEM%"]);
  const topMem = parsePipeTable(getCommandData("response_top_proc_mem")?.stdout || "", ["PID", t.th_command, "CPU%", "MEM%"]);

  const latestConnections = getCommandData("response_conn_count")?.stdout || "";
  const latestCpu = getCommandData("response_host_cpu")?.stdout || "";
  const latestMem = getCommandData("response_host_mem")?.stdout || "";
  const conn = metricFromOutput(latestConnections, /CONN:\s*(\d+)/);
  const cpu = metricFromOutput(latestCpu, /CPU:\s*([\d.]+)/);
  const mem = metricFromOutput(latestMem, /MEM:\s*([\d.]+)/);

  const blacklistSet = useMemo(() => new Set(blacklistInput.split(",").map((value) => value.trim()).filter(Boolean)), [blacklistInput]);
  const whitelistSet = useMemo(() => new Set(whitelistInput.split(",").map((value) => value.trim()).filter(Boolean)), [whitelistInput]);
  const suspiciousKeywords = useMemo(
    () => suspiciousKeywordsInput.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
    [suspiciousKeywordsInput],
  );

  const remoteIpAggregates: RemoteIpAggregate[] = useMemo(() => {
    const map = new Map<string, { count: number; ports: Set<string>; processes: Set<string> }>();
    for (const row of topFlows.rows) {
      const remoteIp = row[2] || "";
      const remotePort = row[3] || "";
      const processText = row[5] || "";
      if (!remoteIp || remoteIp === "*" || remoteIp === "0.0.0.0") continue;
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
      .slice(0, 24);
  }, [topFlows.rows, whitelistSet, blacklistSet]);

  const suspiciousProcessCount = useMemo(() => {
    const processText = [...topCpu.rows, ...topMem.rows, ...topFlows.rows].map((row) => row.join(" ")).join(" ").toLowerCase();
    return suspiciousKeywords.filter((keyword) => processText.includes(keyword)).length;
  }, [topCpu.rows, topMem.rows, topFlows.rows, suspiciousKeywords]);

  const suspiciousProcesses = useMemo<SuspiciousProcessRecord[]>(() => {
    const map = new Map<string, SuspiciousProcessRecord>();
    const upsert = (pid: string, process: string, cpuValue: number, memValue: number) => {
      const normalizedProcess = process || "-";
      const key = `${pid || "-"}|${normalizedProcess}`;
      const hits = suspiciousKeywords.filter((keyword) => normalizedProcess.toLowerCase().includes(keyword));
      const current = map.get(key) || {
        pid: pid || "-",
        process: normalizedProcess,
        cpu: 0,
        mem: 0,
        keywordHits: [],
        score: 0,
        severity: "medium" as const,
      };
      current.cpu = Math.max(current.cpu, cpuValue);
      current.mem = Math.max(current.mem, memValue);
      current.keywordHits = Array.from(new Set([...current.keywordHits, ...hits]));
      map.set(key, current);
    };

    topCpu.rows.forEach((row) => upsert(row[0] || "-", row[1] || "-", parseMetricCell(row[2] || "0"), parseMetricCell(row[3] || "0")));
    topMem.rows.forEach((row) => upsert(row[0] || "-", row[1] || "-", parseMetricCell(row[2] || "0"), parseMetricCell(row[3] || "0")));

    return Array.from(map.values())
      .map((item) => {
        const keywordScore = item.keywordHits.length * 3;
        const cpuScore = item.cpu >= cpuThreshold ? 2 : item.cpu >= cpuThreshold * 0.8 ? 1 : 0;
        const memScore = item.mem >= memThreshold ? 2 : item.mem >= memThreshold * 0.8 ? 1 : 0;
        const score = keywordScore + cpuScore + memScore;
        const severity: SuspiciousProcessRecord["severity"] = score >= 6 ? "critical" : score >= 4 ? "high" : "medium";
        return { ...item, score, severity };
      })
      .filter((item) => item.keywordHits.length > 0 || item.cpu >= cpuThreshold || item.mem >= memThreshold)
      .sort((a, b) => b.score - a.score || b.cpu - a.cpu || b.mem - a.mem)
      .slice(0, 10);
  }, [topCpu.rows, topMem.rows, suspiciousKeywords, cpuThreshold, memThreshold]);

  const suspiciousRemoteIps = useMemo<SuspiciousNetworkRecord[]>(() => {
    return remoteIpAggregates
      .map((item) => {
        const baseScore = item.tag === "blacklist" ? 5 : item.tag === "public" ? 2 : 1;
        const countScore = item.count >= 8 ? 4 : item.count >= 4 ? 2 : 1;
        const score = baseScore + countScore;
        const severity: SuspiciousNetworkRecord["severity"] = score >= 8 ? "critical" : score >= 6 ? "high" : "medium";
        return { ...item, score, severity };
      })
      .filter((item) => item.tag === "blacklist" || item.count >= 3)
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, 10);
  }, [remoteIpAggregates]);

  const blacklistCount = remoteIpAggregates.filter((item) => item.tag === "blacklist").length;
  const isCpuAlert = cpu >= cpuThreshold;
  const isMemAlert = mem >= memThreshold;
  const isConnAlert = conn >= connThreshold;
  const isTrafficAlert = rxKb >= trafficThresholdKb || txKb >= trafficThresholdKb;
  const isBlacklistAlert = blacklistCount > 0;
  const isProcessAlert = suspiciousProcessCount > 0;

  const warnings = useMemo<AlertItem[]>(() => {
    const result: AlertItem[] = [];
    if (isCpuAlert) result.push({ target: "threshold_cpu", message: t.response_warn_cpu.replace("{0}", cpu.toFixed(1)).replace("{1}", cpuThreshold.toString()), parameter: t.response_threshold_cpu, currentValue: `${cpu.toFixed(1)}%`, thresholdValue: `${cpuThreshold}%`, severity: "high" });
    if (isMemAlert) result.push({ target: "threshold_mem", message: t.response_warn_mem.replace("{0}", mem.toFixed(1)).replace("{1}", memThreshold.toString()), parameter: t.response_threshold_mem, currentValue: `${mem.toFixed(1)}%`, thresholdValue: `${memThreshold}%`, severity: "high" });
    if (isConnAlert) result.push({ target: "threshold_conn", message: t.response_warn_conn.replace("{0}", conn.toString()).replace("{1}", connThreshold.toString()), parameter: t.response_threshold_conn, currentValue: `${conn}`, thresholdValue: `${connThreshold}`, severity: "high" });
    if (isTrafficAlert) {
      result.push({
        target: "threshold_traffic",
        message: t.response_warn_traffic.replace("{0}", rxKb.toFixed(1)).replace("{1}", txKb.toFixed(1)).replace("{2}", trafficThresholdKb.toString()),
        parameter: t.response_threshold_traffic,
        currentValue: `RX ${rxKb.toFixed(1)} / TX ${txKb.toFixed(1)} KB/s`,
        thresholdValue: `${trafficThresholdKb} KB/s`,
        severity: "high",
      });
    }
    if (isBlacklistAlert) result.push({ target: "ip_aggregate", message: t.response_warn_blacklist.replace("{0}", blacklistCount.toString()), parameter: t.response_ip_agg_table, currentValue: `${blacklistCount}`, thresholdValue: "> 0", severity: "critical" });
    if (isProcessAlert) result.push({ target: "cpu_table", message: t.response_warn_proc.replace("{0}", suspiciousProcessCount.toString()), parameter: t.response_proc_signal, currentValue: `${suspiciousProcessCount}`, thresholdValue: "> 0", severity: "critical" });
    return result;
  }, [isCpuAlert, isMemAlert, isConnAlert, isTrafficAlert, isBlacklistAlert, isProcessAlert, cpu, cpuThreshold, mem, memThreshold, conn, connThreshold, rxKb, txKb, trafficThresholdKb, blacklistCount, suspiciousProcessCount, t]);

  const criticalAlertCount = warnings.filter((item) => item.severity === "critical").length + suspiciousRemoteIps.filter((item) => item.severity === "critical").length + suspiciousProcesses.filter((item) => item.severity === "critical").length;
  const highAlertCount = warnings.filter((item) => item.severity === "high").length + suspiciousRemoteIps.filter((item) => item.severity === "high").length + suspiciousProcesses.filter((item) => item.severity === "high").length;
  const riskScore = Math.min(100, criticalAlertCount * 22 + highAlertCount * 12 + warnings.length * 6 + (remoteIpAggregates.length > 20 ? 8 : 0));
  const posture = riskScore >= 70 ? text(language, "高危态势", "Critical posture") : riskScore >= 35 ? text(language, "需要关注", "Watch required") : text(language, "态势平稳", "Stable posture");
  const severityLabels = {
    critical: t.response_severity_critical,
    high: t.response_severity_high,
    medium: t.response_alert_badge,
  };

  const snapshot = useMemo(
    () => ({
      generated_at: new Date().toISOString(),
      session: currentSession ? `${currentSession.user}@${currentSession.ip}` : null,
      metrics: {
        rx_kb_s: Number(rxKb.toFixed(3)),
        tx_kb_s: Number(txKb.toFixed(3)),
        established_connections: conn,
        cpu_percent: Number(cpu.toFixed(2)),
        mem_percent: Number(mem.toFixed(2)),
        listening_services: listening.rows.length,
      },
      risk: { score: riskScore, critical: criticalAlertCount, high: highAlertCount },
      thresholds: {
        cpu_percent: cpuThreshold,
        mem_percent: memThreshold,
        connection_count: connThreshold,
        traffic_kb_s: trafficThresholdKb,
      },
      warnings: warnings.map((warning) => warning.message),
      remote_ip_aggregates: remoteIpAggregates,
      suspicious_processes: suspiciousProcesses,
      top_flows: topFlows.rows,
      listening_services: listening.rows,
      top_cpu_processes: topCpu.rows,
      top_mem_processes: topMem.rows,
    }),
    [currentSession, rxKb, txKb, conn, cpu, mem, listening.rows, riskScore, criticalAlertCount, highAlertCount, cpuThreshold, memThreshold, connThreshold, trafficThresholdKb, warnings, remoteIpAggregates, suspiciousProcesses, topFlows.rows, topCpu.rows, topMem.rows],
  );

  const exportJson = () => {
    downloadFile(`incident-snapshot-${Date.now()}.json`, JSON.stringify(snapshot, null, 2), "application/json");
  };

  const exportMarkdown = () => {
    const warningLines = warnings.length > 0 ? warnings.map((item) => `- ${item.message}`).join("\n") : `- ${t.response_no_warning}`;
    const topRemoteRows = remoteIpAggregates
      .slice(0, 12)
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
    downloadFile(`incident-snapshot-${Date.now()}.md`, md, "text/markdown");
  };

  const jumpToTarget = (target: AlertTarget) => {
    const el = document.getElementById(`resp-${target}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedTarget(target);
    window.setTimeout(() => setFocusedTarget((prev) => (prev === target ? null : prev)), 1600);
  };

  const scrollToSection = (sectionId: ResponseSectionId) => {
    const el = document.getElementById(`resp-section-${sectionId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const buildActionPayload = () => {
    const target = actionTarget.trim();
    if (!target) return null;
    if (actionTemplate === "block_ip") {
      return { command: `iptables -I INPUT -s ${target} -j DROP`, rollback: `iptables -D INPUT -s ${target} -j DROP` };
    }
    if (actionTemplate === "kill_process") {
      return { command: `kill -9 ${target}`, rollback: t.response_no_rollback };
    }
    return { command: `usermod -L ${target}`, rollback: `usermod -U ${target}` };
  };

  const executeActionTemplate = async () => {
    const payload = buildActionPayload();
    if (!payload || !confirmAction || executingAction) return;
    setExecutingAction(true);
    let status = t.completed;
    try {
      await runCommand(`response_action_${actionTemplate}`, payload.command);
    } catch {
      status = t.error_status;
    } finally {
      setActionLogs((prev) => [
        {
          ts: new Date().toISOString(),
          operator: operator || "IR-Operator",
          template: actionTemplate,
          target: actionTarget,
          command: payload.command,
          rollback: payload.rollback,
          status,
        },
        ...prev,
      ].slice(0, 100));
      setConfirmAction(false);
      setExecutingAction(false);
    }
  };

  const sectionNav: Array<{ id: ResponseSectionId; label: string }> = [
    { id: "overview", label: t.response_nav_overview },
    { id: "metrics", label: t.response_nav_metrics },
    { id: "trends", label: t.response_nav_trends },
    { id: "flows", label: t.response_nav_flows },
    { id: "rules", label: t.response_nav_rules },
    { id: "actions", label: t.response_nav_actions },
  ];

  const remoteTargets = remoteIpAggregates.slice(0, 8);
  const focusedClass = (target: AlertTarget) => (focusedTarget === target ? "ring-2 ring-red-200 border-red-300" : "");

  return (
    <div className="custom-scrollbar h-full overflow-y-auto rounded-[2rem] border border-sky-100/80 bg-white/88 p-4 shadow-[0_30px_90px_rgba(0,91,158,0.11)]">
      <div className="relative min-h-full overflow-hidden rounded-[1.7rem] border border-sky-100/70 bg-gradient-to-br from-white via-[#f8fcff] to-[#edf7ff] p-4">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-200/34 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-cyan-200/24 blur-3xl" />

        <div className="relative z-10 space-y-4">
          <header className="rounded-[1.6rem] border border-sky-100/80 bg-white/92 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-sky-700">
                  <ShieldAlert size={14} />
                  Incident Command Center
                </div>
                <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-950 md:text-3xl">{t.response_title}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.response_subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50/70 px-3 py-2">
                  <Clock3 size={14} className="text-[#0078D4]" />
                  <span className="text-xs font-semibold text-slate-600">{getTimeAgo(language, lastUpdateTime)}</span>
                </div>
                <select
                  value={refreshInterval}
                  onChange={(event) => setRefreshInterval(Number(event.target.value))}
                  className="rounded-2xl border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-sky-300"
                >
                  <option value={1000}>1s</option>
                  <option value={2000}>2s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                </select>
                <button
                  onClick={() => (isMonitoring ? stopMonitoring() : startMonitoring(MONITOR_COMMANDS, refreshInterval))}
                  className={`ui-pressable inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(0,120,212,0.2)] ${
                    isMonitoring ? "bg-red-500 hover:bg-red-600" : "bg-gradient-to-r from-[#0078D4] to-[#39bdf8]"
                  }`}
                >
                  {isMonitoring ? <Pause size={14} /> : <Play size={14} />}
                  {isMonitoring ? t.stop_monitoring : t.start_monitoring}
                </button>
                <button onClick={exportJson} className="ui-button ui-pressable inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-slate-600">
                  <Download size={13} />
                  JSON
                </button>
                <button onClick={exportMarkdown} className="ui-button ui-pressable inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-slate-600">
                  <Download size={13} />
                  MD
                </button>
              </div>
            </div>
          </header>

          <section id="resp-section-overview" className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[1.6rem] border border-sky-100/80 bg-white/88 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <SectionHeading icon={<Route size={16} />} title={text(language, "网络流向态势", "Network Flow Posture")} />
                <div className="flex flex-wrap gap-2">
                  {sectionNav.map((item) => (
                    <button key={item.id} onClick={() => scrollToSection(item.id)} className="rounded-full border border-sky-100 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700">
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative min-h-[390px] overflow-hidden rounded-[1.5rem] border border-sky-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,248,255,0.82))] p-4">
                <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(0,120,212,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,120,212,0.08)_1px,transparent_1px)] [background-size:42px_42px]" />
                <div className="absolute left-1/2 top-1/2 z-10 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-sky-200 bg-white/86 text-center shadow-[0_20px_60px_rgba(0,120,212,0.16)] backdrop-blur-xl">
                  <RadioTower size={22} className="text-[#0078D4]" />
                  <div className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Local Host</div>
                  <div className="mt-1 max-w-[110px] truncate text-sm font-black text-slate-900">
                    {currentSession ? currentSession.ip : text(language, "未连接", "No session")}
                  </div>
                </div>

                {remoteTargets.length > 0 ? (
                  remoteTargets.map((item, index) => {
                    const positions = [
                      "left-[8%] top-[14%]",
                      "right-[8%] top-[14%]",
                      "left-[6%] bottom-[18%]",
                      "right-[6%] bottom-[18%]",
                      "left-[32%] top-[6%]",
                      "right-[32%] bottom-[8%]",
                      "left-[28%] bottom-[10%]",
                      "right-[28%] top-[8%]",
                    ];
                    return (
                      <motion.div
                        key={item.ip}
                        className={`absolute z-20 max-w-[190px] rounded-2xl border px-3 py-2 shadow-[0_12px_28px_rgba(0,91,158,0.1)] ${positions[index]} ${tagClass(item.tag)}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: [0, -4, 0] }}
                        transition={{ y: { duration: 3.6 + index * 0.2, repeat: Infinity, ease: "easeInOut" } }}
                      >
                        <div className="truncate font-mono text-xs font-black">{item.ip}</div>
                        <div className="mt-1 truncate text-[11px] font-semibold">{item.count} hits · {item.ports.slice(0, 3).join(", ") || "-"}</div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="absolute bottom-5 left-5 right-5 z-20 rounded-2xl border border-sky-100 bg-white/82 p-4 text-sm text-slate-500">
                    {text(language, "等待实时连接数据，启动监控后会在这里展示外联方向。", "Waiting for live flow data. Start monitoring to see outbound destinations here.")}
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <div className={`rounded-[1.6rem] border p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)] ${riskScore >= 70 ? "border-red-200 bg-red-50/86" : riskScore >= 35 ? "border-amber-200 bg-amber-50/86" : "border-sky-100 bg-white/90"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{text(language, "风险态势", "Risk Posture")}</div>
                    <div className="mt-1 text-xl font-black text-slate-950">{posture}</div>
                  </div>
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-2xl font-black text-slate-950 shadow-inner">
                    {riskScore}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-white/78 p-3 text-center">
                    <div className="text-xl font-black text-red-600">{criticalAlertCount}</div>
                    <div className="mt-1 text-[10px] font-bold text-slate-500">{t.response_severity_critical}</div>
                  </div>
                  <div className="rounded-2xl bg-white/78 p-3 text-center">
                    <div className="text-xl font-black text-amber-600">{highAlertCount}</div>
                    <div className="mt-1 text-[10px] font-bold text-slate-500">{t.response_severity_high}</div>
                  </div>
                  <div className="rounded-2xl bg-white/78 p-3 text-center">
                    <div className="text-xl font-black text-sky-700">{warnings.length}</div>
                    <div className="mt-1 text-[10px] font-bold text-slate-500">{t.response_severity_total}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
                <SectionHeading icon={<ShieldAlert size={16} />} title={t.response_warning_title} extra={<span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-black text-sky-700">{warnings.length}</span>} />
                <div className="custom-scrollbar max-h-[260px] space-y-2 overflow-auto pr-1">
                  {warnings.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs font-semibold text-emerald-700">{t.response_no_warning}</div>
                  ) : (
                    warnings.map((warning, index) => (
                      <button key={`${warning.target}-${index}`} onClick={() => jumpToTarget(warning.target)} className="w-full rounded-2xl border border-red-100 bg-red-50/76 p-3 text-left text-xs text-red-700 hover:border-red-200">
                        <div className="flex items-center gap-1.5 font-black">
                          <AlertTriangle size={13} />
                          {warning.parameter}
                        </div>
                        <div className="mt-1 leading-5">{warning.message}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            {[
              { id: "resp-threshold_cpu", label: t.response_threshold_cpu, value: cpuThreshold, set: setCpuThreshold, alert: isCpuAlert, max: 100 },
              { id: "resp-threshold_mem", label: t.response_threshold_mem, value: memThreshold, set: setMemThreshold, alert: isMemAlert, max: 100 },
              { id: "resp-threshold_conn", label: t.response_threshold_conn, value: connThreshold, set: setConnThreshold, alert: isConnAlert, max: 99999 },
              { id: "resp-threshold_traffic", label: t.response_threshold_traffic, value: trafficThresholdKb, set: setTrafficThresholdKb, alert: isTrafficAlert, max: 99999 },
            ].map((item) => (
              <label
                key={item.id}
                id={item.id}
                className={`rounded-[1.35rem] border bg-white/90 p-3 shadow-[0_12px_28px_rgba(0,91,158,0.06)] ${
                  item.alert || focusedTarget === item.id.replace("resp-", "") ? "border-red-200 ring-2 ring-red-100" : "border-sky-100/80"
                }`}
              >
                <span className="block truncate text-[11px] font-bold text-slate-500">{item.label}</span>
                <input
                  type="number"
                  min={1}
                  max={item.max}
                  value={item.value}
                  onChange={(event) => item.set(Number(event.target.value) || item.value)}
                  className="ui-input-base mt-2 w-full rounded-2xl px-3 py-2 text-sm font-bold"
                />
              </label>
            ))}
          </section>

          <section id="resp-section-metrics" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard targetId="resp-metric_traffic" label={t.response_upstream} value={`${txKb.toFixed(1)} KB/s`} hint="TX rate" icon={<Network size={18} />} tone="bg-sky-500" alert={isTrafficAlert} />
            <MetricCard label={t.response_downstream} value={`${rxKb.toFixed(1)} KB/s`} hint="RX rate" icon={<Activity size={18} />} tone="bg-emerald-500" alert={isTrafficAlert} />
            <MetricCard targetId="resp-metric_conn" label={t.response_conn_count} value={String(conn)} hint={text(language, "活跃会话压力", "Active session pressure")} icon={<Zap size={18} />} tone="bg-amber-500" alert={isConnAlert} />
            <MetricCard targetId="resp-metric_host" label="CPU" value={`${cpu.toFixed(1)}%`} hint={t.response_host_usage} icon={<Cpu size={18} />} tone="bg-indigo-500" alert={isCpuAlert} />
            <MetricCard label="MEM" value={`${mem.toFixed(1)}%`} hint={t.response_mem_table} icon={<HardDrive size={18} />} tone="bg-cyan-500" alert={isMemAlert} />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
              <SectionHeading icon={<Gauge size={16} />} title={text(language, "硬件与资源监控", "Hardware and Resource Monitor")} />
              <div className="space-y-3">
                <RadialMeter label="CPU" value={cpu} color="#4f46e5" />
                <RadialMeter label="Memory" value={mem} color="#0891b2" />
                <div className="rounded-2xl border border-sky-100/80 bg-sky-50/60 p-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{text(language, "暴露面", "Exposure")}</div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="text-3xl font-black text-slate-950">{listening.rows.length}</div>
                    <div className="text-xs font-semibold text-slate-500">{t.response_listen_table}</div>
                  </div>
                </div>
              </div>
            </div>

            <div id="resp-section-trends" className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <div className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
                <SectionHeading icon={<Network size={16} />} title={t.response_rate_chart} />
                <ChartDisplay data={networkChart} title={t.response_rate_chart} yAxisLabel="KB/s" unit="KB/s" color="#0078d4" color2="#10b981" />
              </div>
              <div className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
                <SectionHeading icon={<Activity size={16} />} title={t.response_conn_chart} />
                <ChartDisplay data={connChart} title={t.response_conn_chart} yAxisLabel={t.response_conn_count} unit="" color="#f59e0b" />
              </div>
              <div className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
                <SectionHeading icon={<Cpu size={16} />} title={t.response_cpu_chart} />
                <ChartDisplay data={cpuChart} title={t.response_cpu_chart} yAxisLabel="CPU %" unit="%" color="#4f46e5" />
              </div>
              <div className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
                <SectionHeading icon={<HardDrive size={16} />} title={t.response_mem_chart} />
                <ChartDisplay data={memChart} title={t.response_mem_chart} yAxisLabel="MEM %" unit="%" color="#0891b2" />
              </div>
            </div>
          </section>

          <section id="resp-section-flows" className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div id="resp-ip_aggregate" className={`rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)] ${focusedClass("ip_aggregate")}`}>
              <SectionHeading icon={<ShieldAlert size={16} />} title={t.response_ip_agg_table} />
              <div className="custom-scrollbar max-h-72 space-y-2 overflow-auto pr-1">
                {remoteIpAggregates.length > 0 ? (
                  remoteIpAggregates.map((item) => (
                    <div key={item.ip} className={`rounded-2xl border p-3 ${tagClass(item.tag)}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-xs font-black">{item.ip}</span>
                        <span className="text-[10px] font-black uppercase">{item.tag}</span>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold">{t.response_hits} {item.count} · {item.ports.slice(0, 4).join(", ") || "-"}</div>
                      <div className="mt-1 truncate text-[11px] opacity-80">{item.processes.slice(0, 2).join(", ") || "-"}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-xs text-slate-500">{text(language, "暂无远端 IP 聚合数据。", "No remote IP aggregate data yet.")}</div>
                )}
              </div>
            </div>
            <div id="resp-flow_table" className={`rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)] xl:col-span-2 ${focusedClass("flow_table")}`}>
              <SectionHeading icon={<Route size={16} />} title={t.response_flow_table} />
              <CompactTable data={topFlows} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
              <SectionHeading icon={<RadioTower size={16} />} title={t.response_listen_table} />
              <CompactTable data={listening} />
            </div>
            <div id="resp-cpu_table" className={`rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)] ${focusedClass("cpu_table")}`}>
              <SectionHeading
                icon={<Cpu size={16} />}
                title={t.response_cpu_table}
                extra={suspiciousProcesses[0] ? <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-black text-red-700">{severityLabels[suspiciousProcesses[0].severity]}</span> : null}
              />
              <CompactTable data={topCpu} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
              <SectionHeading icon={<HardDrive size={16} />} title={t.response_mem_table} />
              <CompactTable data={topMem} />
            </div>

            <div id="resp-section-rules" className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
              <SectionHeading icon={<Terminal size={16} />} title={text(language, "研判规则", "Triage Rules")} />
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-600">{t.response_rule_blacklist}</span>
                  <input value={blacklistInput} onChange={(event) => setBlacklistInput(event.target.value)} className="ui-input-base mt-1 w-full rounded-2xl px-3 py-2 text-xs font-mono" placeholder="1.2.3.4,5.6.7.8" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-600">{t.response_rule_whitelist}</span>
                  <input value={whitelistInput} onChange={(event) => setWhitelistInput(event.target.value)} className="ui-input-base mt-1 w-full rounded-2xl px-3 py-2 text-xs font-mono" placeholder="127.0.0.1,::1" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-600">{t.response_rule_keywords}</span>
                  <input value={suspiciousKeywordsInput} onChange={(event) => setSuspiciousKeywordsInput(event.target.value)} className="ui-input-base mt-1 w-full rounded-2xl px-3 py-2 text-xs font-mono" placeholder="bash,python,nc,socat" />
                </label>
              </div>
            </div>
          </section>

          <section id="resp-section-actions" className="rounded-[1.6rem] border border-sky-100/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(0,91,158,0.08)]">
            <SectionHeading icon={<ShieldCheck size={16} />} title={t.response_action_title} />
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
              <input value={operator} onChange={(event) => setOperator(event.target.value)} className="ui-input-base rounded-2xl px-3 py-2 text-sm" placeholder={t.response_action_operator} />
              <select value={actionTemplate} onChange={(event) => setActionTemplate(event.target.value)} className="ui-input-base rounded-2xl px-3 py-2 text-sm">
                <option value="block_ip">{t.response_action_block_ip}</option>
                <option value="kill_process">{t.response_action_kill_process}</option>
                <option value="lock_user">{t.response_action_lock_user}</option>
              </select>
              <input value={actionTarget} onChange={(event) => setActionTarget(event.target.value)} className="ui-input-base rounded-2xl px-3 py-2 text-sm xl:col-span-2" placeholder={t.response_action_target} />
              <button onClick={executeActionTemplate} disabled={!confirmAction || !actionTarget.trim() || executingAction} className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300">
                {executingAction ? t.processing_status : t.response_action_execute}
              </button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={confirmAction} onChange={(event) => setConfirmAction(event.target.checked)} />
              {t.response_action_confirm}
            </label>
            <div className="mt-4">
              <CompactTable
                maxHeight="max-h-56"
                data={{
                  headers: ["Time", t.response_action_operator, t.response_action_template, t.response_action_target, "Command", t.response_action_rollback, t.th_status],
                  rows: actionLogs.map((log) => [new Date(log.ts).toLocaleString(), log.operator, log.template, log.target, log.command, log.rollback, log.status]),
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
