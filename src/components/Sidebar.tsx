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
    <div className={`h-full flex flex-col transition-all duration-300 border-r border-gray-200 ${isCollapsed ? "w-16" : "w-60"} bg-white`}>
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <motion.button
            onClick={onToggleServerSidebar}
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex h-12 w-12 items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <img src={tauriLogo} alt="FUXI" className="h-8 w-8 object-contain" />
          </motion.button>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-gray-900">FUXI AI Workbench</div>
              <div className="mt-1 text-xs text-gray-500">
                {language === "zh" ? "服务器取证与智能分析工作台" : "Server forensics and AI investigation workspace"}
              </div>
              <div className="mt-3 h-px bg-gradient-to-r from-gray-200 to-transparent" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-4 pb-3">
        {!isCollapsed && (
          <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full transition-all duration-200 ${isCollapsed ? "flex justify-center p-3" : "flex items-center gap-3 px-3 py-3"} ${isActive ? "bg-blue-600 text-white rounded-md" : "hover:bg-gray-50 rounded-md"}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-md ${isActive ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
                  <Icon size={16} />
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-700"}`}>
                      {textByLanguage(language, item.title)}
                    </div>
                    <div className={`mt-1 text-xs ${isActive ? "text-white/80" : "text-gray-500"}`}>
                      {textByLanguage(language, item.description)}
                    </div>
                  </div>
                )}
              </motion.button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-gray-200 p-3 space-y-2">
        {onToggleCollapse && (
          <motion.button
            onClick={onToggleCollapse}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full transition-colors ${isCollapsed ? "flex justify-center p-3" : "flex items-center gap-3 px-3 py-2"} hover:bg-gray-50 rounded-md`}
            title={collapseLabel}
          >
            <ChevronRight className={`transition-transform ${isCollapsed ? "" : "rotate-180"}`} size={16} />
            {!isCollapsed && <span className="text-sm font-medium text-gray-700">{collapseLabel}</span>}
          </motion.button>
        )}
        <motion.button
          onClick={onOpenSettings}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full transition-colors ${isCollapsed ? "flex justify-center p-3" : "flex items-center gap-3 px-3 py-2"} hover:bg-gray-50 rounded-md`}
          title={settingsLabel}
        >
          <Settings size={16} className="text-gray-500" />
          {!isCollapsed && <span className="text-sm font-medium text-gray-700">{settingsLabel}</span>}
        </motion.button>
        <motion.button
          onClick={onDisconnect}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full transition-colors ${isCollapsed ? "flex justify-center p-3" : "flex items-center gap-3 px-3 py-2"} bg-red-50 hover:bg-red-100 text-red-600 rounded-md`}
          title={disconnectLabel}
        >
          <LogOut size={16} />
          {!isCollapsed && <span className="text-sm font-medium">{disconnectLabel}</span>}
        </motion.button>
      </div>
    </div>
  );
}
