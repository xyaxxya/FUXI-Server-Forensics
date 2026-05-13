import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  ChevronRight,
  Database,
  FileSearch,
  ListChecks,
  LogOut,
  type LucideIcon,
  Settings,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import { Language } from "../translations";
import tauriLogo from "../assets/tauri.png";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onDisconnect: () => void;
  language: Language;
  onToggleLanguage?: () => void;
  onAddSession?: () => void;
  onToggleServerSidebar?: () => void;
  onOpenSettings: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: string;
  icon: LucideIcon;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
}

const navItems: NavItem[] = [
  {
    id: "dashboard",
    icon: Activity,
    title: { zh: "命令中心", en: "Command Center" },
    description: { zh: "执行常用命令并查看结果", en: "Run common commands and view outputs" },
  },
  {
    id: "agent-general",
    icon: Bot,
    title: { zh: "通用智能体", en: "General Agent" },
    description: { zh: "对话分析并沉淀关键线索", en: "Chat, analyze and retain key clues" },
  },
  {
    id: "agent-database",
    icon: Database,
    title: { zh: "数据库智查", en: "Database Intel" },
    description: { zh: "连接库表、查询数据与 AI 分析", en: "Connect, query and investigate with AI" },
  },
  {
    id: "agent-context",
    icon: FileSearch,
    title: { zh: "上下文面板", en: "Context Panel" },
    description: { zh: "一键采集系统与网站关键信息", en: "Collect system and web context quickly" },
  },
  {
    id: "agent-panel",
    icon: ListChecks,
    title: { zh: "批量问答", en: "Batch QA" },
    description: { zh: "批量提问并统一查看答案", en: "Ask in batch and review all answers" },
  },
  {
    id: "terminal",
    icon: SquareTerminal,
    title: { zh: "XFTP Terminal", en: "XFTP Terminal" },
    description: { zh: "交互终端与文件管理", en: "Interactive terminal and file manager" },
  },
  {
    id: "pentest",
    icon: Wrench,
    title: { zh: "远勘智能体", en: "Recon Agent" },
    description: { zh: "网站画像、后台发现与攻击面研判", en: "Web profiling, admin discovery and attack-surface triage" },
  },
];

function textByLanguage(language: Language, value: { zh: string; en: string }) {
  return language === "zh" ? value.zh : value.en;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  onDisconnect,
  language,
  onToggleServerSidebar,
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const settingsLabel = language === "zh" ? "设置" : "Settings";
  const disconnectLabel = language === "zh" ? "断开连接" : "Disconnect";
  const collapseLabel = isCollapsed
    ? language === "zh"
      ? "展开"
      : "Expand"
    : language === "zh"
      ? "折叠"
      : "Collapse";

  return (
    <div className={`h-full ui-shell border-r border-slate-100 flex flex-col transition-all duration-300 ${isCollapsed ? "w-[80px]" : "w-[260px]"}`}>
      <div className="border-b border-slate-100/50 p-4">
        <div className="flex items-center gap-3">
          <motion.button
            onClick={onToggleServerSidebar}
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="glass-button flex h-10 w-10 items-center justify-center rounded-lg"
          >
            <img src={tauriLogo} alt="FUXI" className="h-6 w-6 object-contain grayscale opacity-80" />
          </motion.button>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-slate-900 tracking-tight">FUXI Workbench</div>
              <div className="text-[10px] font-medium tracking-wide text-slate-500">
                {language === "zh" ? "SERVER FORENSICS" : "SERVER FORENSICS"}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pt-4 pb-3">
        {!isCollapsed && (
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400">
            {language === "zh" ? "核心工作区" : "Core Workspace"}
          </div>
        )}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.id === activeTab;
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={isCollapsed ? textByLanguage(language, item.title) : undefined}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                className={`relative w-full overflow-hidden text-left transition-all duration-200 ${
                  isActive ? "bg-transparent" : "hover:bg-slate-50/50"
                } ${isCollapsed ? "flex justify-center p-2.5 rounded-lg" : "p-3 rounded-lg"}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-item"
                    className="absolute inset-0 rounded-[12px] bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-indigo-500/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className={`relative z-10 ${isCollapsed ? "flex items-center justify-center" : "flex items-start gap-3.5"}`}>
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all ${
                      isActive
                        ? "bg-transparent text-white"
                        : "bg-[#F7F7F8] text-slate-500 border border-black/5"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${isActive ? "text-white" : "text-slate-800"}`}>
                        {textByLanguage(language, item.title)}
                      </div>
                      <div className={`mt-0.5 text-[11px] leading-5 font-medium ${isActive ? "text-white/70" : "text-slate-500"}`}>
                        {textByLanguage(language, item.description)}
                      </div>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-slate-200/70 p-3 space-y-2">
        {onToggleCollapse && (
          <motion.button
            onClick={onToggleCollapse}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
            className={`w-full rounded-lg text-slate-600 hover:bg-slate-50 transition-colors ${
              isCollapsed ? "flex justify-center p-2.5" : "flex items-center gap-3 px-3 py-2"
            }`}
            title={collapseLabel}
          >
            <ChevronRight className={`transition-transform ${isCollapsed ? "" : "rotate-180"}`} size={16} />
            {!isCollapsed && <span className="text-sm font-medium">{collapseLabel}</span>}
          </motion.button>
        )}
        <motion.button
          onClick={onOpenSettings}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
          className={`w-full rounded-lg text-slate-600 hover:bg-slate-50 transition-colors ${
            isCollapsed ? "flex justify-center p-2.5" : "flex items-center gap-3 px-3 py-2"
          }`}
          title={settingsLabel}
        >
          <Settings size={16} />
          {!isCollapsed && <span className="text-sm font-medium">{settingsLabel}</span>}
        </motion.button>
        <motion.button
          onClick={onDisconnect}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
          className={`w-full rounded-lg text-red-600 hover:bg-red-50 transition-colors ${
            isCollapsed ? "flex justify-center p-2.5" : "flex items-center gap-3 px-3 py-2"
          }`}
          title={disconnectLabel}
        >
          <LogOut size={16} />
          {!isCollapsed && <span className="text-sm font-medium">{disconnectLabel}</span>}
        </motion.button>
      </div>
    </div>
  );
}
