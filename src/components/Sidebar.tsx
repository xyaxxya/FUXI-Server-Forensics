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
    title: { zh: "工具面板", en: "Tool Panel" },
    description: { zh: "访问现有工具与辅助能力", en: "Open tools and helper capabilities" },
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
    <div className={`h-full ui-shell flex flex-col transition-all duration-300 ${isCollapsed ? "w-[88px]" : "w-[292px]"}`}>
      <div className="border-b border-slate-200/70 p-4">
        <div className="flex items-center gap-3">
          <motion.button
            onClick={onToggleServerSidebar}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="ui-button ui-pressable ui-focus-ring flex h-12 w-12 items-center justify-center rounded-[1.35rem]"
          >
            <img src={tauriLogo} alt="FUXI" className="h-8 w-8 object-contain" />
          </motion.button>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-slate-900">FUXI AI Workbench</div>
              <div className="mt-1 text-xs text-slate-500">
                {language === "zh" ? "服务器取证与智能分析工作台" : "Server forensics and AI investigation workspace"}
              </div>
              <div className="mt-3 h-px ui-divider" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pt-4 pb-3">
        {!isCollapsed && (
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            {language === "zh" ? "核心工作区" : "Core Workspace"}
          </div>
        )}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = item.id === activeTab;
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={isCollapsed ? textByLanguage(language, item.title) : undefined}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                className={`ui-hover-lift ui-pressable ui-focus-ring relative w-full overflow-hidden text-left ${
                  isActive ? "ui-chip-active rounded-[1.5rem]" : "ui-button rounded-[1.5rem]"
                } ${isCollapsed ? "flex justify-center p-3.5" : "p-4"}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-item"
                    className="absolute inset-0 rounded-[1.5rem] bg-gradient-to-br from-blue-50 via-white to-indigo-50"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <div className={`relative z-10 ${isCollapsed ? "flex items-center justify-center" : "flex items-start gap-3.5"}`}>
                  <div
                    className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all ${
                      isActive
                        ? "bg-white text-blue-700 shadow-[0_12px_24px_-18px_rgba(37,99,235,0.6)]"
                        : "bg-slate-100/90 text-slate-500"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${isActive ? "text-slate-900" : "text-slate-700"}`}>
                        {textByLanguage(language, item.title)}
                      </div>
                      <div className={`mt-1 text-xs leading-5 ${isActive ? "text-blue-700/80" : "text-slate-500"}`}>
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
            className={`ui-button ui-hover-lift ui-pressable ui-focus-ring w-full rounded-[1.35rem] text-slate-600 ${
              isCollapsed ? "flex justify-center p-3.5" : "flex items-center gap-3 px-4 py-3"
            }`}
            title={collapseLabel}
          >
            <ChevronRight className={`transition-transform ${isCollapsed ? "" : "rotate-180"}`} size={18} />
            {!isCollapsed && <span className="text-sm font-medium">{collapseLabel}</span>}
          </motion.button>
        )}
        <motion.button
          onClick={onOpenSettings}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
          className={`ui-button ui-hover-lift ui-pressable ui-focus-ring w-full rounded-[1.35rem] text-slate-600 ${
            isCollapsed ? "flex justify-center p-3.5" : "flex items-center gap-3 px-4 py-3"
          }`}
          title={settingsLabel}
        >
          <Settings size={18} />
          {!isCollapsed && <span className="text-sm font-medium">{settingsLabel}</span>}
        </motion.button>
        <motion.button
          onClick={onDisconnect}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
          className={`ui-button-danger ui-hover-lift ui-pressable ui-focus-ring w-full rounded-[1.35rem] ${
            isCollapsed ? "flex justify-center p-3.5" : "flex items-center gap-3 px-4 py-3"
          }`}
          title={disconnectLabel}
        >
          <LogOut size={18} />
          {!isCollapsed && <span className="text-sm font-medium">{disconnectLabel}</span>}
        </motion.button>
      </div>
    </div>
  );
}
