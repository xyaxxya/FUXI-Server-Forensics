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
  Layout,
  WrapText,
  Copy,
  CheckCheck
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
import ResponsePanel from "./ResponsePanel";
import PentestPanel from "./PentestPanel";
import { AISettings } from "../lib/ai";
import { APP_VERSION } from "../config/app";

// --- Types ---
type TableData = { headers: string[]; rows: string[][] };
type SecurityLogStatus = "success" | "failed" | "warn" | "info";
type SecurityLogEntry = {
  time: string;
  actor: string;
  source: string;
  action: string;
  detail: string;
  status: SecurityLogStatus;
  raw: string;
};
type SecurityLogData = {
  kind: "securityLog";
  logKind: string;
  title: string;
  rows: SecurityLogEntry[];
  stats: {
    total: number;
    success: number;
    failed: number;
    warn: number;
    info: number;
    uniqueSources: number;
  };
  raw: string;
};

const parseSyslogLine = (line: string) => {
  const match = line.match(/^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:]+):\s*(.*)$/);
  if (!match) return null;
  return {
    time: match[1],
    host: match[2],
    process: match[3],
    message: match[4],
  };
};

const getIp = (text: string) => text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0] || "-";
const getPort = (text: string) => text.match(/\bport\s+(\d+)\b/i)?.[1] || "";
const getServiceName = (process: string) => process.replace(/\[\d+\]$/, "");
const getLooseTime = (line: string) => {
  const iso = line.match(/^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z)?)/);
  if (iso) return iso[1];
  const slash = line.match(/^(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
  if (slash) return slash[1];
  return "-";
};
const buildLogData = (logKind: string, title: string, rows: SecurityLogEntry[], raw: string): SecurityLogData => {
  return {
    kind: "securityLog",
    logKind,
    title,
    rows,
    stats: {
      total: rows.length,
      success: rows.filter((r) => r.status === "success").length,
      failed: rows.filter((r) => r.status === "failed").length,
      warn: rows.filter((r) => r.status === "warn").length,
      info: rows.filter((r) => r.status === "info").length,
      uniqueSources: new Set(rows.map((r) => r.source).filter((s) => s !== "-")).size,
    },
    raw,
  };
};
const isSecurityLogData = (data: unknown): data is SecurityLogData => {
  return !!data && typeof data === "object" && "kind" in data && (data as SecurityLogData).kind === "securityLog";
};
const isTableData = (data: unknown): data is TableData => {
  return !!data && typeof data === "object" && "headers" in data && "rows" in data;
};

const parseSecurityLog = (output: string, args?: { logKind?: string }): SecurityLogData | string => {
  const raw = output || "";
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const logKind = args?.logKind || "";
  const titleMap: Record<string, string> = {
    login_success: "SSH 登录成功解读",
    login_failed: "SSH 登录失败解读",
    sudo: "Sudo 审计解读",
    cron: "Cron 审计解读",
    system_error: "系统错误日志解读",
    web_error: "Web 错误日志解读",
    db_error: "数据库错误日志解读",
  };
  const title = titleMap[logKind] || "安全日志解读";
  if (!lines.length) return buildLogData(logKind, title, [], raw);
  const rows: SecurityLogEntry[] = [];

  for (const line of lines) {
    const parsed = parseSyslogLine(line);
    const message = parsed?.message || line;
    const time = parsed?.time || getLooseTime(line);
    const process = parsed?.process || "unknown";

    if (logKind === "login_success" || logKind === "login_failed") {
      const userMatch = message.match(/for\s+(invalid user\s+)?([^\s]+)\s+from/i);
      const user = userMatch?.[2] || "unknown";
      const ip = getIp(message);
      const port = getPort(message);
      const source = ip === "-" ? "-" : `${ip}${port ? `:${port}` : ""}`;
      const isSuccess = /Accepted\s+(password|publickey)/i.test(message);
      const isFailed = /Failed password|authentication failure/i.test(message);
      const status: SecurityLogStatus = isSuccess ? "success" : isFailed ? "failed" : "warn";
      const action = isSuccess ? "SSH 登录成功" : isFailed ? "SSH 登录失败" : "SSH 登录事件";
      const detail = `用户 ${user}${source !== "-" ? `，来源 ${source}` : ""}`;
      rows.push({
        time,
        actor: user,
        source,
        action,
        detail,
        status,
        raw: line,
      });
      continue;
    }

    if (logKind === "sudo") {
      const commandMatch = message.match(/COMMAND=(.+)$/);
      const actorMatch = message.match(/^(\S+)\s*:/);
      const actor = actorMatch?.[1] || "unknown";
      if (commandMatch) {
        rows.push({
          time,
          actor,
          source: "本机",
          action: "执行 sudo 命令",
          detail: commandMatch[1].trim(),
          status: "info",
          raw: line,
        });
      } else if (/session opened/i.test(message)) {
        rows.push({
          time,
          actor,
          source: "本机",
          action: "sudo 会话开启",
          detail: message,
          status: "info",
          raw: line,
        });
      } else if (/session closed/i.test(message)) {
        rows.push({
          time,
          actor,
          source: "本机",
          action: "sudo 会话关闭",
          detail: message,
          status: "info",
          raw: line,
        });
      }
      continue;
    }

    if (logKind === "cron") {
      const actorMatch = message.match(/\(([^)]+)\)\s+CMD/i);
      const actor = actorMatch?.[1] || "root";
      const cmdMatch = message.match(/CMD\s+\((.*)\)\s*$/i);
      rows.push({
        time,
        actor,
        source: "本机",
        action: "执行定时任务",
        detail: cmdMatch?.[1] || message,
        status: "info",
        raw: line,
      });
      continue;
    }

    if (logKind === "system_error") {
      const source = getIp(message);
      const service = getServiceName(process);
      if (/client sent invalid protocol identifier/i.test(message)) {
        const protocolMatch = message.match(/identifier\s+"([^"]+)"/i);
        rows.push({
          time,
          actor: service,
          source,
          action: "疑似协议探测 SSH 端口",
          detail: protocolMatch?.[1] ? `请求标识: ${protocolMatch[1]}` : message,
          status: "warn",
          raw: line,
        });
        continue;
      }
      if (/banner line contains invalid characters/i.test(message)) {
        rows.push({
          time,
          actor: service,
          source,
          action: "SSH 握手异常字符",
          detail: message,
          status: "warn",
          raw: line,
        });
        continue;
      }
      if (/kex_protocol_error/i.test(message)) {
        rows.push({
          time,
          actor: service,
          source,
          action: "密钥交换协议异常",
          detail: message,
          status: "failed",
          raw: line,
        });
        continue;
      }
      if (/Connection closed by remote host|Connection reset by peer/i.test(message)) {
        rows.push({
          time,
          actor: service,
          source,
          action: "远端异常断开连接",
          detail: message,
          status: "info",
          raw: line,
        });
        continue;
      }
      rows.push({
        time,
        actor: service,
        source,
        action: "系统错误事件",
        detail: message,
        status: /panic|fatal|critical/i.test(message) ? "failed" : "warn",
        raw: line,
      });
      continue;
    }

    if (logKind === "web_error") {
      const source = message.match(/client:\s*([^,\s]+)/i)?.[1] || getIp(message);
      const request = message.match(/request:\s*"([^"]+)"/i)?.[1];
      const level = message.match(/\[(error|warn|crit|alert)\]/i)?.[1]?.toLowerCase() || "";
      const status: SecurityLogStatus = level === "warn" ? "warn" : level ? "failed" : /error|exception|timeout|refused/i.test(message) ? "failed" : "warn";
      rows.push({
        time,
        actor: getServiceName(process) === "unknown" ? "web" : getServiceName(process),
        source,
        action: status === "failed" ? "Web 服务错误" : "Web 风险告警",
        detail: request ? `请求 ${request}` : message,
        status,
        raw: line,
      });
      continue;
    }

    if (logKind === "db_error") {
      const source = message.match(/host[=:]\s*([^\s,]+)/i)?.[1] || getIp(message);
      const service = getServiceName(process) === "unknown" ? "database" : getServiceName(process);
      if (/Query_time:\s*[\d.]+/i.test(message) || /slow query/i.test(message)) {
        rows.push({
          time,
          actor: service,
          source,
          action: "慢查询事件",
          detail: message,
          status: "warn",
          raw: line,
        });
        continue;
      }
      const isFailed = /error|fatal|panic|crash|deadlock/i.test(message);
      rows.push({
        time,
        actor: service,
        source,
        action: isFailed ? "数据库错误" : "数据库告警",
        detail: message,
        status: isFailed ? "failed" : "warn",
        raw: line,
      });
      continue;
    }
  }

  if (!rows.length && logKind) return buildLogData(logKind, title, [], raw);
  if (!rows.length) return raw;
  return buildLogData(logKind, title, rows, raw);
};

const splitNonEmptyLines = (output: string) => (output || "").split("\n").map((l) => l.trim()).filter(Boolean);
const extractIpPort = (text: string) => {
  const match = text.match(/(.*):(\d+)$/);
  if (!match) return { ip: text, port: "-" };
  return { ip: match[1], port: match[2] };
};
const toKeyValueTable = (output: string, label = "项目", value = "内容"): TableData => {
  const lines = splitNonEmptyLines(output);
  const rows = lines.map((line) => {
    const pair = line.split(/[:=]\s*/, 2);
    if (pair.length === 2) return [pair[0].trim(), pair[1].trim()];
    return [line, "-"];
  });
  return { headers: [label, value], rows };
};

// --- Parsers ---
const parsers: Record<
  string,
  (output: string, args?: any) => TableData | string | SecurityLogData
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
  authLog: (output, args) => {
    return parseSecurityLog(output, args);
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
  uptimeHuman: (output) => ({ headers: ["运行状态"], rows: [[output.trim() || "-"]] }),
  linuxRelease: (output) => toKeyValueTable(output, "发行版字段", "值"),
  rebootHistory: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      const parts = line.split(/\s+/);
      return [parts[0] || "-", parts[2] || "-", parts.slice(3, 8).join(" "), parts.slice(8).join(" ") || "-"];
    });
    return { headers: ["事件", "终端", "时间段", "细节"], rows };
  },
  timeSync: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      if (line.includes(":")) {
        const [k, v] = line.split(/:\s*/, 2);
        return [k.trim(), v?.trim() || "-"];
      }
      return ["状态信息", line];
    });
    return { headers: ["同步项", "结果"], rows };
  },
  processStats: (output) => {
    const lines = splitNonEmptyLines(output);
    const total = lines[0] || "0";
    const uptimePart = lines[1] || "-";
    const taskPart = lines[2] || "-";
    return {
      headers: ["指标", "值"],
      rows: [
        ["进程总数", total],
        ["运行时长片段", uptimePart],
        ["任务分布", taskPart],
      ],
    };
  },
  netTraffic: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows: string[][] = [];
    for (let i = 0; i < lines.length; i += 2) {
      const rx = lines[i] || "";
      const tx = lines[i + 1] || "";
      const rxPackets = rx.match(/RX packets\s+(\d+)/)?.[1] || "-";
      const rxBytes = rx.match(/bytes\s+(\d+)/)?.[1] || "-";
      const txPackets = tx.match(/TX packets\s+(\d+)/)?.[1] || "-";
      const txBytes = tx.match(/bytes\s+(\d+)/)?.[1] || "-";
      rows.push([`网卡${rows.length + 1}`, rxPackets, txPackets, rxBytes, txBytes]);
    }
    return { headers: ["接口", "RX包数", "TX包数", "RX字节", "TX字节"], rows };
  },
  temperature: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line, i) => {
      const tempMatch = line.match(/(-?\d+(?:\.\d+)?)\s*°?\s*[CF]/i) || line.match(/(-?\d+(?:\.\d+)?)/);
      const value = tempMatch?.[1] ? `${tempMatch[1]}°C` : "-";
      const status = tempMatch?.[1] && Number(tempMatch[1]) >= 80 ? "偏高" : "正常";
      return [`传感器${i + 1}`, value, status, line];
    });
    return { headers: ["来源", "温度", "状态", "原始片段"], rows };
  },
  sudoPerm: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      const principal = line.split(/\s+/)[0] || "-";
      const nopasswd = /NOPASSWD/i.test(line) ? "是" : "否";
      return [principal, nopasswd, line];
    });
    return { headers: ["主体", "免密执行", "规则"], rows };
  },
  firewallStatus: (output) => {
    const lines = splitNonEmptyLines(output);
    const engine = lines.some((l) => /firewalld/i.test(l)) ? "firewalld" : lines.some((l) => /ufw/i.test(l)) ? "ufw" : "unknown";
    const active = lines.some((l) => /active|running|Status:\s*active/i.test(l)) ? "是" : "否";
    const policy = lines.find((l) => /Default|default/i.test(l)) || "-";
    return { headers: ["防火墙引擎", "已启用", "默认策略", "原始摘要"], rows: [[engine, active, policy, lines.slice(0, 2).join(" | ") || "-"]] };
  },
  cronJobs: (output) => {
    const lines = splitNonEmptyLines(output).filter((l) => !l.startsWith("#"));
    const rows = lines.map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 6) return ["-", "-", "-", "-", "-", line];
      const cmd = parts.slice(5).join(" ");
      return [parts[0], parts[1], parts[2], parts[3], parts[4], cmd || "-"];
    });
    return { headers: ["分", "时", "日", "月", "周", "命令"], rows };
  },
  ssConnections: (output) => {
    const lines = splitNonEmptyLines(output).filter((l) => !/^Netid|^State/i.test(l));
    const rows = lines.map((line) => {
      const parts = line.split(/\s+/);
      const proto = parts[0] || "-";
      const state = parts[1] || "-";
      const local = parts[4] || "-";
      const peer = parts[5] || "-";
      const proc = parts.slice(6).join(" ") || "-";
      const localParts = extractIpPort(local);
      const peerParts = extractIpPort(peer);
      return [proto, state, localParts.ip, localParts.port, peerParts.ip, peerParts.port, proc];
    });
    return { headers: ["协议", "状态", "本地IP", "本地端口", "远端IP", "远端端口", "进程"], rows };
  },
  routeSnapshot: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      const dest = line.split(" ")[0] || "-";
      const via = line.match(/\bvia\s+([^\s]+)/)?.[1] || "-";
      const dev = line.match(/\bdev\s+([^\s]+)/)?.[1] || "-";
      const metric = line.match(/\bmetric\s+([^\s]+)/)?.[1] || "-";
      return [dest, via, dev, metric, line];
    });
    return { headers: ["目标网段", "下一跳", "网卡", "优先级", "原始规则"], rows };
  },
  neighborSnapshot: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      const ip = line.split(/\s+/)[0] || "-";
      const dev = line.match(/\bdev\s+([^\s]+)/)?.[1] || "-";
      const mac = line.match(/\blladdr\s+([^\s]+)/)?.[1] || "-";
      const state = line.split(/\s+/).slice(-1)[0] || "-";
      return [ip, dev, mac, state];
    });
    return { headers: ["IP", "网卡", "MAC", "状态"], rows };
  },
  firewallRules: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      const engine = line.startsWith("-") ? "iptables" : /table|chain|hook|policy/i.test(line) ? "nftables" : /Status|ALLOW|DENY/i.test(line) ? "ufw" : "unknown";
      const action = line.match(/\b(ACCEPT|DROP|REJECT|ALLOW|DENY)\b/i)?.[1]?.toUpperCase() || "-";
      const src = line.match(/\bsource\s+([^\s]+)/i)?.[1] || line.match(/\bfrom\s+([^\s]+)/i)?.[1] || "-";
      const dst = line.match(/\bdestination\s+([^\s]+)/i)?.[1] || line.match(/\bto\s+([^\s]+)/i)?.[1] || "-";
      return [engine, action, src, dst, line];
    });
    return { headers: ["引擎", "动作", "来源", "目标", "规则"], rows };
  },
  dnsConfig: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line, i) => [String(i + 1), line.replace(/^nameserver\s+/i, "")]);
    return { headers: ["序号", "DNS服务器"], rows };
  },
  btAuth: (output) => {
    try {
      const data = JSON.parse(output || "{}");
      const rows = Object.entries(data).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
      return { headers: ["认证字段", "值"], rows };
    } catch {
      return toKeyValueTable(output, "认证字段", "值");
    }
  },
  btUser: (output) => {
    try {
      const data = JSON.parse(output || "{}");
      const rows = Object.entries(data).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
      return { headers: ["用户字段", "值"], rows };
    } catch {
      return toKeyValueTable(output, "用户字段", "值");
    }
  },
  nginxInfo: (output) => {
    const merged = output.replace(/\n/g, " ");
    const version = merged.match(/nginx\/([^\s]+)/i)?.[1] || "-";
    const openssl = merged.match(/OpenSSL\s+([^\s]+)/i)?.[1] || "-";
    const built = merged.match(/built\s+with\s+([^)]+)\)/i)?.[1] || "-";
    return { headers: ["Nginx版本", "OpenSSL", "构建信息"], rows: [[version, openssl, built]] };
  },
  nginxConfig: (output) => {
    const lines = splitNonEmptyLines(output);
    const includeCount = lines.filter((l) => /^\s*include\s+/i.test(l)).length;
    const serverCount = lines.filter((l) => /\bserver\s*\{/i.test(l)).length;
    const listenPorts = Array.from(new Set(lines.map((l) => l.match(/\blisten\s+(\d+)/)?.[1]).filter(Boolean))).join(",") || "-";
    const serverNames = lines.filter((l) => /\bserver_name\b/i.test(l)).slice(0, 5).map((l) => l.replace(/.*server_name\s+/i, "").replace(/;$/, "")).join(" | ") || "-";
    return { headers: ["Server块数量", "Listen端口", "Include条数", "示例域名"], rows: [[String(serverCount), listenPorts, String(includeCount), serverNames]] };
  },
  tlsCert: (output) => {
    const lines = splitNonEmptyLines(output);
    const notBefore = lines.find((l) => /notBefore=/i.test(l))?.replace(/notBefore=/i, "") || "-";
    const notAfter = lines.find((l) => /notAfter=/i.test(l))?.replace(/notAfter=/i, "") || "-";
    const issuer = lines.find((l) => /^issuer=/i.test(l))?.replace(/^issuer=/i, "") || "-";
    const subject = lines.find((l) => /^subject=/i.test(l))?.replace(/^subject=/i, "") || "-";
    const serial = lines.find((l) => /^serial=/i.test(l))?.replace(/^serial=/i, "") || "-";
    const certPath = lines.find((l) => /^CERT_PATH:/i.test(l))?.replace(/^CERT_PATH:/i, "") || "-";
    return { headers: ["证书路径", "主题", "签发者", "生效时间", "到期时间", "序列号"], rows: [[certPath, subject, issuer, notBefore, notAfter, serial]] };
  },
  webAccessLog: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      const ip = line.match(/^(\S+)/)?.[1] || "-";
      const time = line.match(/\[([^\]]+)\]/)?.[1] || "-";
      const req = line.match(/"([A-Z]+)\s+([^"\s]+)[^"]*"/);
      const status = line.match(/"\s+(\d{3})\s+/)?.[1] || "-";
      return [time, ip, req?.[1] || "-", req?.[2] || "-", status, line];
    });
    return { headers: ["时间", "来源IP", "方法", "路径", "状态码", "原始行"], rows };
  },
  packageList: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      if (/^ii\s+/.test(line)) {
        const parts = line.split(/\s+/);
        return [parts[1] || "-", parts[2] || "-", "dpkg", line];
      }
      const rpm = line.match(/^([^-]+)-([0-9][^-]*)/);
      if (rpm) return [rpm[1], rpm[2], "rpm", line];
      return [line, "-", "unknown", line];
    });
    return { headers: ["包名", "版本", "来源", "原始"], rows };
  },
  serviceStatus: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      const svc = line.split(/\s+/)[0] || "-";
      const enabled = /\benabled\b/i.test(line) || /\bon\b/i.test(line) ? "是" : "否";
      return [svc, enabled, line];
    });
    return { headers: ["服务", "开机启动", "原始"], rows };
  },
  dbSlowLog: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      const isSlow = /Query_time:\s*[\d.]+|slow/i.test(line);
      const isErr = /error|fatal|panic|deadlock/i.test(line);
      return [isErr ? "错误" : isSlow ? "慢查询" : "事件", line];
    });
    return { headers: ["类型", "详情"], rows };
  },
  dbPermissionMatrix: (output) => {
    const lines = splitNonEmptyLines(output);
    let engine = "unknown";
    const rows: string[][] = [];
    for (const line of lines) {
      if (/^\[MySQL\]/i.test(line)) {
        engine = "MySQL";
        continue;
      }
      if (/^\[PostgreSQL\]/i.test(line)) {
        engine = "PostgreSQL";
        continue;
      }
      if (/^\[Redis\]/i.test(line)) {
        engine = "Redis";
        continue;
      }
      const parts = line.split(/[|\s]+/).filter(Boolean);
      rows.push([engine, parts.slice(0, 4).join(" | ") || line]);
    }
    return { headers: ["引擎", "权限信息"], rows };
  },
  dockerInfo: (output) => {
    const lines = splitNonEmptyLines(output);
    const pick = (key: string) => lines.find((l) => l.toLowerCase().startsWith(`${key.toLowerCase()}:`))?.split(":").slice(1).join(":").trim() || "-";
    return {
      headers: ["服务器版本", "存储驱动", "日志驱动", "CPU核数", "总内存"],
      rows: [[pick("Server Version"), pick("Storage Driver"), pick("Logging Driver"), pick("CPUs"), pick("Total Memory")]],
    };
  },
  dockerPrivileged: (output) => {
    const lines = splitNonEmptyLines(output);
    const rows = lines.map((line) => {
      const parts = line.split("|");
      const name = parts[0] || "-";
      const privileged = parts[1] === "true" ? "是" : "否";
      const networkMode = parts[2] || "-";
      const pidMode = parts[3] || "-";
      const userns = parts[4] || "-";
      const capAdd = (parts[5] || "").replace(/[\[\]]/g, "") || "-";
      return [name, privileged, networkMode, pidMode, userns, capAdd];
    });
    return { headers: ["容器", "特权模式", "网络模式", "PID模式", "Userns", "附加能力"], rows };
  },
  k8sEvents: (output) => {
    const lines = splitNonEmptyLines(output).filter((l) => !/^NAMESPACE\s+/i.test(l));
    const rows = lines.map((line) => {
      const parts = line.split(/\s+/);
      return [parts[0] || "-", parts[1] || "-", parts[2] || "-", parts[3] || "-", parts.slice(4).join(" ") || "-"];
    });
    return { headers: ["命名空间", "最近时间", "类型", "对象", "信息"], rows };
  },
  k8sRbac: (output) => {
    const lines = splitNonEmptyLines(output).filter((l) => !/^NAMESPACE\s+/i.test(l));
    const rows = lines.map((line) => {
      const parts = line.split(/\s+/);
      return [parts[0] || "-", parts[1] || "-", parts[2] || "-", parts.slice(3).join(" ") || "-"];
    });
    return { headers: ["命名空间", "类型", "名称", "角色或详情"], rows };
  },
  raw: (output) => output,
};

// --- Helper Components ---

function TableDisplay({ data, language }: { data: TableData; language: Language }) {
  const t = translations[language];
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [wrapMode, setWrapMode] = useState(false);

  const selectedRowData = selectedRowIndex !== null ? data.rows[selectedRowIndex] : null;

  return (
    <div className="relative flex flex-col h-full max-h-[600px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs text-slate-500">
          {language === "zh" ? `共 ${data.rows.length} 条` : `${data.rows.length} rows`}
        </div>
        <button
          onClick={() => setWrapMode(v => !v)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${
            wrapMode
              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <WrapText size={12} />
          {language === "zh" ? "自动换行" : "Wrap"}
        </button>
      </div>
      <div className="overflow-x-auto custom-scrollbar flex-1 pb-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-10 text-center bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
                #
              </th>
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
                <td className="p-3 text-xs text-slate-400 font-mono border-b border-slate-100 text-center align-top">
                  {i + 1}
                </td>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`p-3 text-sm font-mono align-top ${
                      data.headers[j] === "th_credentials" 
                        ? "max-w-none text-red-600 font-bold group-hover:text-red-700" 
                        : `text-slate-600 group-hover:text-slate-800 max-w-[420px] ${wrapMode ? "whitespace-pre-wrap break-all" : "whitespace-nowrap truncate"}`
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

function RawOutputDisplay({ value, language }: { value: string; language: Language }) {
  const [wrapMode, setWrapMode] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
      <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {language === "zh" ? "原始输出" : "Raw Output"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWrapMode(v => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${
              wrapMode
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            <WrapText size={12} />
            {language === "zh" ? "换行" : "Wrap"}
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
            {language === "zh" ? "复制" : "Copy"}
          </button>
        </div>
      </div>
      <pre
        className={`font-mono text-xs text-slate-700 overflow-auto max-h-80 custom-scrollbar p-3 ${
          wrapMode ? "whitespace-pre-wrap break-all" : "whitespace-pre"
        }`}
      >
        {value || "Empty output"}
      </pre>
    </div>
  );
}

function SecurityLogDisplay({ data, language }: { data: SecurityLogData; language: Language }) {
  const [wrapMode, setWrapMode] = useState(false);
  const statCards =
    data.logKind === "login_success" || data.logKind === "login_failed"
      ? [
          { labelZh: "总事件", labelEn: "Total", value: data.stats.total, style: "border-slate-200 bg-slate-50 text-slate-700" },
          { labelZh: "成功", labelEn: "Success", value: data.stats.success, style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
          { labelZh: "失败", labelEn: "Failed", value: data.stats.failed, style: "border-red-200 bg-red-50 text-red-700" },
          { labelZh: "异常", labelEn: "Warnings", value: data.stats.warn, style: "border-amber-200 bg-amber-50 text-amber-700" },
          { labelZh: "来源IP数", labelEn: "Source IPs", value: data.stats.uniqueSources, style: "border-blue-200 bg-blue-50 text-blue-700" },
        ]
      : [
          { labelZh: "总事件", labelEn: "Total", value: data.stats.total, style: "border-slate-200 bg-slate-50 text-slate-700" },
          { labelZh: "错误", labelEn: "Errors", value: data.stats.failed, style: "border-red-200 bg-red-50 text-red-700" },
          { labelZh: "告警", labelEn: "Warnings", value: data.stats.warn, style: "border-amber-200 bg-amber-50 text-amber-700" },
          { labelZh: "信息", labelEn: "Info", value: data.stats.info, style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
          { labelZh: "来源IP数", labelEn: "Source IPs", value: data.stats.uniqueSources, style: "border-blue-200 bg-blue-50 text-blue-700" },
        ];

  const statusStyle: Record<SecurityLogStatus, string> = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    info: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const statusLabel = (status: SecurityLogStatus) => {
    if (language === "zh") {
      if (status === "success") return "成功";
      if (status === "failed") return "失败";
      if (status === "warn") return "异常";
      return "信息";
    }
    if (status === "success") return "Success";
    if (status === "failed") return "Failed";
    if (status === "warn") return "Warning";
    return "Info";
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
      <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {language === "zh" ? data.title : "Security Audit Summary"}
        </span>
        <button
          onClick={() => setWrapMode((v) => !v)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${
            wrapMode
              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
              : "bg-white text-slate-600 border-slate-200"
          }`}
        >
          <WrapText size={12} />
          {language === "zh" ? "细节换行" : "Wrap Detail"}
        </button>
      </div>
      <div className="p-3 grid grid-cols-2 lg:grid-cols-5 gap-2 border-b border-slate-200 bg-white">
        {statCards.map((card, index) => (
          <div key={index} className={`rounded-lg border px-3 py-2 ${card.style}`}>
            <div className="text-[10px] opacity-90">{language === "zh" ? card.labelZh : card.labelEn}</div>
            <div className="text-base font-semibold">{card.value}</div>
          </div>
        ))}
      </div>
      <div className="max-h-80 overflow-auto custom-scrollbar p-3 space-y-2">
        {data.rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            {language === "zh" ? "当前未发现相关日志事件" : "No matching log events found"}
          </div>
        )}
        {data.rows.map((row, index) => (
          <div key={`${row.time}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs text-slate-500 font-mono">{row.time}</span>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] ${statusStyle[row.status]}`}>
                {statusLabel(row.status)}
              </span>
              <span className="text-xs text-slate-700">
                {language === "zh" ? `操作者: ${row.actor}` : `Actor: ${row.actor}`}
              </span>
              <span className="text-xs text-slate-700">
                {language === "zh" ? `来源: ${row.source}` : `Source: ${row.source}`}
              </span>
            </div>
            <div className="text-sm text-slate-800 font-medium mb-1">{row.action}</div>
            <div className={`text-xs text-slate-600 font-mono ${wrapMode ? "whitespace-pre-wrap break-all" : "truncate"}`}>
              {row.detail}
            </div>
          </div>
        ))}
      </div>
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
  const CardIcon = def.icon || Activity;

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
          <RawOutputDisplay value={parsedData} language={language} />
        );
      } else if (isSecurityLogData(parsedData)) {
        content = <SecurityLogDisplay data={parsedData} language={language} />;
      } else if (isTableData(parsedData)) {
        content = <TableDisplay data={parsedData} language={language} />;
      } else {
        content = <RawOutputDisplay value={data?.stdout || data?.stderr || ""} language={language} />;
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
          <RawOutputDisplay value={parsedData} language={language} />
        );
      } else if (isSecurityLogData(parsedData)) {
        content = <SecurityLogDisplay data={parsedData} language={language} />;
      } else if (isTableData(parsedData)) {
        content = <TableDisplay data={parsedData} language={language} />;
      } else {
        content = <RawOutputDisplay value={data?.stdout || ""} language={language} />;
      }
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      className={`bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgba(15,23,42,0.06)] border border-slate-200/70 overflow-visible relative z-0 hover:z-30 hover:shadow-[0_12px_36px_rgba(14,165,233,0.12)] hover:border-sky-200/80 transition-all duration-300 flex flex-col group ${
        className || ""
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="h-1 w-full bg-gradient-to-r from-sky-500/70 via-indigo-500/40 to-transparent" />

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

      <div className="px-6 py-4 border-b border-slate-100/90 flex items-center justify-between bg-white/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform duration-300 shadow-sm border border-sky-100/60">
            <CardIcon size={16} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-slate-800">{title}</span>
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
      <div className="p-6">{content}</div>
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
  onAiSettingsChange?: (settings: AISettings) => void;
  chatUserProfile?: {
    qq?: string | null;
    avatar?: string | null;
  };
}

export default function Dashboard({
  activeTab,
  language,
  aiSettings,
  onOpenSettings,
  onAiSettingsChange,
  chatUserProfile,
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
  const isResponsePanel = activeTab === "response";
  const isTerminal = activeTab === "terminal";
  const isPentest = activeTab === "pentest";
  const isMetrics = !isGeneralAgent && !isAgentPanel && !isContextPanel && !isDatabaseAgent && !isResponsePanel && !isTerminal && !isPentest;

  // Filter commands
  const tabCommands = commands.filter((c) => c.category === activeTab);
  const filteredCommands = (searchTerm ? commands : tabCommands).filter((c) => {
    const title = language === "zh" ? c.cn_name : c.name;
    return (
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Filter out commands with errors
  const visibleCommands = filteredCommands.filter((cmd) => {
    const data = getCommandData(cmd.id);
    const isLoading = loading[cmd.id] || false;
    
    // If we have data and it's not loading, check for errors
    if (data && !isLoading) {
      // If there is stderr output, consider it an error and hide it
      if (data.stderr) return false;
    }
    
    return true;
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
          onAiSettingsChange={onAiSettingsChange}
          onOpenSettings={onOpenSettings}
          generalInfo={generalInfo}
          setGeneralInfo={setGeneralInfo}
          chatUserProfile={chatUserProfile}
        />
      </div>

      {/* Agent Panel View */}
      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isAgentPanel ? 'hidden' : ''}`}>
        <AgentPanel
          language={language}
          aiSettings={aiSettings}
          onAiSettingsChange={onAiSettingsChange}
          generalInfo={generalInfo}
          chatUserProfile={chatUserProfile}
        />
      </div>

      {/* General Info Context Panel */}
      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isContextPanel ? 'hidden' : ''}`}>
          <div className="h-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/60 overflow-y-auto custom-scrollbar">
             <GeneralInfoPanel
                language={language}
                generalInfo={generalInfo}
                setGeneralInfo={setGeneralInfo}
                aiSettings={aiSettings}
                onAiSettingsChange={onAiSettingsChange}
             />
          </div>
      </div>

      {/* Database Agent View */}
      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isDatabaseAgent ? 'hidden' : ''}`}>
        <DatabaseAgent 
          language={language} 
          aiSettings={aiSettings} 
          onAiSettingsChange={onAiSettingsChange}
          onOpenSettings={onOpenSettings}
          chatUserProfile={chatUserProfile}
        />
      </div>

      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isResponsePanel ? 'hidden' : ''}`}>
        <ResponsePanel language={language} active={isResponsePanel} />
      </div>

      {/* Terminal View */}
      <div className={`flex-1 h-full p-6 flex flex-col glass-dark overflow-hidden relative ${!isTerminal ? 'hidden' : ''}`}>
        <div className="flex-1 bg-black/80 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 shadow-2xl relative z-10 ring-1 ring-white/5">
          <TerminalXterm onClose={() => {}} language={language} />
        </div>
      </div>

      <div className={`flex-1 h-full p-4 md:p-6 flex flex-col glass overflow-hidden relative ${!isPentest ? 'hidden' : ''}`}>
        <PentestPanel language={language} />
      </div>

      {/* Main Dashboard Metrics View */}
      <div className={`flex-1 flex flex-col h-screen overflow-hidden glass relative ${!isMetrics ? 'hidden' : ''}`}>
      
      {/* Top Bar */}
      <div className="px-8 md:px-10 py-8 flex items-center justify-between relative z-20">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight capitalize flex items-center gap-3">
              {activeTab === 'system' && <Cpu className="text-sky-500" size={36} />}
              {activeTab === 'network' && <Globe className="text-sky-500" size={36} />}
              {activeTab === 'services' && <Server className="text-sky-500" size={36} />}
              {activeTab === 'docker' && <Layout className="text-sky-500" size={36} />}
              {t[activeTab as keyof typeof t] || activeTab}
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-sky-500 to-indigo-500 mt-2 rounded-full" />
            <p className="mt-3 text-sm text-slate-500 max-w-xl">
              {language === "zh" ? "实时查看核心指标与取证结果，支持快速检索与聚焦分析。" : "Realtime metrics and forensic outputs with fast search and focused analysis."}
            </p>
          </motion.div>
          
          {/* Connection Status Indicator */}
          {currentSession && (
            <div className="flex items-center gap-2 mt-4 bg-white/70 backdrop-blur px-3 py-1.5 rounded-full border border-sky-100/60 w-fit shadow-sm">
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

        <div className="flex items-center gap-4 md:gap-6">
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
            <div className="hidden md:flex items-center gap-2 mr-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
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
              className="pl-10 pr-4 py-2.5 bg-white/85 backdrop-blur-sm border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all w-52 md:w-64 shadow-sm hover:shadow-md"
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
          <MySQLManager onClose={() => setShowDatabaseModal(false)} language={language} aiSettings={aiSettings} onAiSettingsChange={onAiSettingsChange} />
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
      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8 custom-scrollbar relative z-10">
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
        {visibleCommands.length === 0 ? (
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
            className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-24"
          >
            {visibleCommands.map((cmd) => (
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
