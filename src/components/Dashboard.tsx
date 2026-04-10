import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  Database,
  FileSearch,
  ListChecks,
  Loader2,
  Play,
  Search,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import GeneralInfoPanel from "./agents/GeneralInfoPanel";
import GeneralAgent from "./agents/GeneralAgent";
import DatabaseAgent from "./agents/DatabaseAgent";
import AgentPanel from "./agents/AgentPanel";
import PentestPanel from "./PentestPanel";
import TerminalXterm from "./TerminalXterm";
import { Language } from "../translations";
import { AISettings } from "../lib/ai";
import { useAIWorkspaceStore } from "../lib/aiWorkspaceStore";
import { useCommandStore } from "../store/CommandContext";
import { commands } from "../config/commands";
import { PluginCommand } from "../plugins/types";

interface DashboardProps {
  activeTab: string;
  language: Language;
  onAddSession?: () => void;
  aiSettings?: AISettings;
  onAiSettingsChange?: (settings: AISettings) => void;
  onOpenSettings?: () => void;
  chatUserProfile?: { qq: string | null; avatar: string | null };
}

const panelMeta = {
  dashboard: {
    icon: Activity,
    title: { zh: "命令中心", en: "Command Center" },
    desc: {
      zh: "集中执行常用排查命令并查看结果输出。",
      en: "Run common investigation commands and review outputs in one place.",
    },
  },
  "agent-general": {
    icon: Bot,
    title: { zh: "通用智能体", en: "General Agent" },
    desc: {
      zh: "围绕当前服务器对话分析、提炼结论并沉淀共享线索。",
      en: "Investigate the current server through dialogue and retain useful clues.",
    },
  },
  "agent-database": {
    icon: Database,
    title: { zh: "数据库智查", en: "Database Intel" },
    desc: {
      zh: "连接数据库、浏览对象、执行 SQL，并结合 AI 进行智查。",
      en: "Connect databases, browse objects, run SQL and investigate with AI.",
    },
  },
  "agent-context": {
    icon: FileSearch,
    title: { zh: "上下文面板", en: "Context Panel" },
    desc: {
      zh: "一键采集系统信息、网站配置和数据库账号等关键上下文。",
      en: "Collect system info, web config and database credentials with one click.",
    },
  },
  "agent-panel": {
    icon: ListChecks,
    title: { zh: "批量问答", en: "Batch QA" },
    desc: {
      zh: "批量输入多个问题，统一查看每题的过程与答案。",
      en: "Submit multiple questions and inspect each process and answer together.",
    },
  },
  terminal: {
    icon: SquareTerminal,
    title: { zh: "XFTP Terminal", en: "XFTP Terminal" },
    desc: {
      zh: "直接进入交互式终端并配合文件管理进行处理。",
      en: "Open the interactive terminal and work alongside file management.",
    },
  },
  pentest: {
    icon: Wrench,
    title: { zh: "工具面板", en: "Tool Panel" },
    desc: {
      zh: "集中访问现有工具能力与辅助排查入口。",
      en: "Access existing tool capabilities and investigation helpers.",
    },
  },
} as const;

const categoryMeta = {
  system: { zh: "系统", en: "System" },
  network: { zh: "网络", en: "Network" },
  web: { zh: "Web", en: "Web" },
  security: { zh: "安全", en: "Security" },
  database: { zh: "数据库", en: "Database" },
  docker: { zh: "Docker", en: "Docker" },
  k8s: { zh: "K8s", en: "K8s" },
  response: { zh: "响应", en: "Response" },
} as const;

function byLanguage(language: Language, text: { zh: string; en: string }) {
  return language === "zh" ? text.zh : text.en;
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="ui-chip rounded-2xl px-3.5 py-2.5 text-sm text-slate-600">
      <span className="text-slate-500">{label}</span>
      <span className="ml-2 font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export default function Dashboard({
  activeTab,
  language,
  aiSettings,
  onAiSettingsChange,
  onOpenSettings,
  chatUserProfile,
}: DashboardProps) {
  const generalInfo = useAIWorkspaceStore((state) => state.manualContext);
  const setGeneralInfo = useAIWorkspaceStore((state) => state.setManualContext);
  const clueCount = useAIWorkspaceStore((state) => state.records.length);
  const { sessions, selectedSessionIds, currentSession, runCommand, getCommandData, loading } = useCommandStore();
  const [mountedTabs, setMountedTabs] = useState<string[]>(() => [activeTab]);

  useEffect(() => {
    setMountedTabs((prev) => (prev.includes(activeTab) ? prev : [...prev, activeTab]));
  }, [activeTab]);

  if (!aiSettings) {
    return (
      <div className="ui-surface h-full rounded-[2rem] p-8 text-slate-500">
        {language === "zh" ? "AI 配置尚未加载。" : "AI settings are not ready yet."}
      </div>
    );
  }

  const panelKey = activeTab in panelMeta ? (activeTab as keyof typeof panelMeta) : "agent-general";
  const meta = panelMeta[panelKey];
  const Icon = meta.icon;
  const panelVisibilityClass = (tab: string) => (activeTab === tab ? "block h-full" : "hidden h-full");

  return (
    <div className="h-full flex flex-col gap-4">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="ui-shell overflow-hidden rounded-[2rem] px-5 py-5 md:px-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-blue-100 via-white to-indigo-100 text-blue-700 shadow-[0_18px_36px_-24px_rgba(37,99,235,0.45)]">
                <Icon size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900">{byLanguage(language, meta.title)}</h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{byLanguage(language, meta.desc)}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatChip label={language === "zh" ? "会话" : "Sessions"} value={sessions.length} />
            <StatChip label={language === "zh" ? "已选服务器" : "Selected"} value={selectedSessionIds.length} />
            <StatChip label={language === "zh" ? "共享线索" : "Shared Clues"} value={clueCount} />
          </div>
        </div>
        <div className="mt-4 rounded-[1.4rem] bg-white/72 px-4 py-3 text-sm text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          {currentSession
            ? `${language === "zh" ? "当前会话" : "Current"}：${currentSession.user}@${currentSession.ip}`
            : language === "zh"
              ? "当前没有激活 SSH 会话，可以先在左侧服务器栏连接主机。"
              : "No active SSH session. Connect a host from the server sidebar first."}
        </div>
      </motion.section>

      <div className="flex-1 min-h-0">
        {mountedTabs.includes("dashboard") && (
          <div className={panelVisibilityClass("dashboard")}>
            <CommandCenter
              language={language}
              commands={commands}
              currentSessionLabel={currentSession ? `${currentSession.user}@${currentSession.ip}` : null}
              onRun={async (command) => {
                await runCommand(command.id, command.command);
              }}
              getOutput={getCommandData}
              loading={loading}
            />
          </div>
        )}
        {mountedTabs.includes("agent-general") && (
          <div className={panelVisibilityClass("agent-general")}>
            <GeneralAgent
              language={language}
              aiSettings={aiSettings}
              onOpenSettings={onOpenSettings}
              generalInfo={generalInfo}
              setGeneralInfo={setGeneralInfo}
              onAiSettingsChange={onAiSettingsChange}
              chatUserProfile={chatUserProfile}
            />
          </div>
        )}
        {mountedTabs.includes("agent-database") && (
          <div className={panelVisibilityClass("agent-database")}>
            <DatabaseAgent
              language={language}
              aiSettings={aiSettings}
              onOpenSettings={onOpenSettings}
              onAiSettingsChange={onAiSettingsChange}
              generalInfo={generalInfo}
              chatUserProfile={chatUserProfile}
            />
          </div>
        )}
        {mountedTabs.includes("agent-context") && (
          <div className={panelVisibilityClass("agent-context")}>
            <GeneralInfoPanel
              language={language}
              generalInfo={generalInfo}
              setGeneralInfo={setGeneralInfo}
              aiSettings={aiSettings}
              onAiSettingsChange={onAiSettingsChange}
            />
          </div>
        )}
        {mountedTabs.includes("agent-panel") && (
          <div className={panelVisibilityClass("agent-panel")}>
            <AgentPanel
              language={language}
              aiSettings={aiSettings}
              onAiSettingsChange={onAiSettingsChange}
              generalInfo={generalInfo}
              chatUserProfile={chatUserProfile}
            />
          </div>
        )}
        {mountedTabs.includes("terminal") && (
          <div className={panelVisibilityClass("terminal")}>
            <TerminalXterm onClose={() => undefined} language={language} isActive={activeTab === "terminal"} />
          </div>
        )}
        {mountedTabs.includes("pentest") && (
          <div className={panelVisibilityClass("pentest")}>
            <div className="h-full overflow-hidden rounded-[2rem]">
              <PentestPanel language={language} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CommandCenter({
  language,
  commands,
  currentSessionLabel,
  onRun,
  getOutput,
  loading,
}: {
  language: Language;
  commands: PluginCommand[];
  currentSessionLabel: string | null;
  onRun: (command: PluginCommand) => Promise<void>;
  getOutput: (id: string) => { stdout: string; stderr: string; exit_code: number; cwd: string } | null;
  loading: Record<string, boolean>;
}) {
  const [activeCategory, setActiveCategory] = useState<PluginCommand["category"]>("system");
  const [search, setSearch] = useState("");

  const filteredCommands = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return commands.filter((command) => {
      if (command.category !== activeCategory) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return [command.name, command.cn_name, command.description, command.cn_description]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [activeCategory, commands, search]);

  return (
    <div className="ui-shell h-full overflow-hidden rounded-[2rem]" data-context-scope="command-center">
      <div className="border-b border-slate-200/70 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-700 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.16)]">
              <Activity size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{language === "zh" ? "基础命令选项卡" : "Base Command Tabs"}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {language === "zh"
                  ? "按分类快速执行常用命令，保留命令内容与输出结果，便于持续排查。"
                  : "Run categorized commands quickly and keep both command text and output for investigation."}
              </p>
            </div>
          </div>
          <div className="ui-subtle-surface rounded-[1.4rem] px-4 py-3 text-sm text-slate-600">
            {currentSessionLabel
              ? `${language === "zh" ? "当前执行目标" : "Current target"}：${currentSessionLabel}`
              : language === "zh"
                ? "请先连接 SSH 会话后执行命令。"
                : "Connect an SSH session before running commands."}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(categoryMeta) as PluginCommand["category"][]).map((category) => {
              const active = activeCategory === category;
              return (
                <motion.button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  className={`ui-pressable ui-focus-ring rounded-2xl px-4 py-2.5 text-sm font-medium ${
                    active ? "ui-chip-active" : "ui-chip text-slate-600"
                  }`}
                >
                  {byLanguage(language, categoryMeta[category])}
                </motion.button>
              );
            })}
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={language === "zh" ? "搜索命令、描述或中文名称" : "Search commands"}
              className="ui-input-base w-full rounded-[1.4rem] py-3 pl-11 pr-4 text-sm text-slate-700"
            />
          </div>
        </div>
      </div>

      <div className="h-[calc(100%-236px)] overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {filteredCommands.map((command) => {
            const output = getOutput(command.id);
            const isRunning = !!loading[command.id];
            const Icon = command.icon ?? SquareTerminal;
            const content = output?.stdout?.trim() || output?.stderr?.trim() || "";
            return (
              <motion.div
                key={command.id}
                whileHover={{ y: -2 }}
                className="ui-subtle-surface ui-hover-lift rounded-[1.7rem] p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.16)]">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-slate-900">
                          {language === "zh" ? command.cn_name : command.name}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-500">
                          {language === "zh" ? command.cn_description : command.description}
                        </div>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => void onRun(command)}
                    disabled={isRunning || !currentSessionLabel}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    className="ui-button-primary ui-pressable ui-focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium disabled:bg-slate-300 disabled:border-slate-300 disabled:shadow-none"
                  >
                    {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    {language === "zh" ? "执行" : "Run"}
                  </motion.button>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="ui-surface rounded-[1.4rem] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {language === "zh" ? "命令" : "Command"}
                    </div>
                    <div className="mt-3 text-xs leading-6 text-slate-700 font-mono break-all">{command.command}</div>
                  </div>
                  <div className="ui-surface rounded-[1.4rem] overflow-hidden">
                    <div className="border-b border-slate-200/70 px-4 py-3 text-sm font-medium text-slate-700">
                      {language === "zh" ? "输出结果" : "Output"}
                    </div>
                    <div className="max-h-72 overflow-auto px-4 py-3 text-xs leading-6 text-slate-600 font-mono whitespace-pre-wrap">
                      {content || (language === "zh" ? "尚未执行该命令。" : "Command has not been executed yet.")}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filteredCommands.length === 0 && (
            <div className="ui-subtle-surface rounded-[1.7rem] p-10 text-center text-slate-500 2xl:col-span-2">
              {language === "zh" ? "当前筛选条件下没有命令。" : "No commands match the current filter."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
