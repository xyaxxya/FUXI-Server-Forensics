import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  ChevronRight,
  Database,
  FileSearch,
  Globe,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Network,
  PanelLeftOpen,
  Server,
  Settings,
  ShieldCheck,
  SquareTerminal,
  type LucideIcon,
  Wrench,
} from "lucide-react";
import { Language } from "../translations";
import logo from "../assets/logo.png";

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

interface NavGroup {
  title: { zh: string; en: string };
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: { zh: "调查工作区", en: "Investigation" },
    items: [
      {
        id: "system",
        icon: LayoutDashboard,
        title: { zh: "系统基线", en: "System" },
        description: { zh: "主机信息、磁盘、服务与资源", en: "Host baseline, disk and services" },
      },
      {
        id: "network",
        icon: Network,
        title: { zh: "网络状态", en: "Network" },
        description: { zh: "端口、连接、路由与邻居表", en: "Ports, routes and connections" },
      },
      {
        id: "security",
        icon: ShieldCheck,
        title: { zh: "安全审计", en: "Security" },
        description: { zh: "登录、sudo、防火墙和持久化", en: "Auth, sudo, firewall and persistence" },
      },
      {
        id: "web",
        icon: Globe,
        title: { zh: "Web 服务", en: "Web" },
        description: { zh: "Nginx、Apache、证书与面板", en: "Nginx, Apache, TLS and panels" },
      },
      {
        id: "database",
        icon: Database,
        title: { zh: "数据库", en: "Database" },
        description: { zh: "MySQL、Redis、Postgres 证据", en: "MySQL, Redis and Postgres evidence" },
      },
    ],
  },
  {
    title: { zh: "智能工具", en: "Agents" },
    items: [
      {
        id: "agent-general",
        icon: Bot,
        title: { zh: "通用智能体", en: "General Agent" },
        description: { zh: "对话分析并沉淀关键线索", en: "Chat, analyze and retain clues" },
      },
      {
        id: "agent-database",
        icon: Database,
        title: { zh: "数据库智查", en: "Database Intel" },
        description: { zh: "连接库表、查询数据与 AI 分析", en: "Query databases with AI" },
      },
      {
        id: "agent-context",
        icon: FileSearch,
        title: { zh: "上下文面板", en: "Context Panel" },
        description: { zh: "采集系统与网站关键证据", en: "Collect shared investigation context" },
      },
      {
        id: "agent-panel",
        icon: ListChecks,
        title: { zh: "批量问答", en: "Batch QA" },
        description: { zh: "批量提问并统一查看答案", en: "Ask in batch and review answers" },
      },
      {
        id: "pentest",
        icon: Wrench,
        title: { zh: "远勘智能体", en: "Recon Agent" },
        description: { zh: "资产画像、后台发现和攻击面研判", en: "Profiling and attack-surface triage" },
      },
    ],
  },
  {
    title: { zh: "运行视图", en: "Runtime" },
    items: [
      {
        id: "response",
        icon: Activity,
        title: { zh: "应急响应", en: "Response" },
        description: { zh: "实时流量、进程、端口与风险", en: "Live traffic, process and risk views" },
      },
      {
        id: "terminal",
        icon: SquareTerminal,
        title: { zh: "XFTP 终端", en: "XFTP Terminal" },
        description: { zh: "交互终端与文件管理", en: "Interactive terminal and file manager" },
      },
    ],
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
      ? "展开导航"
      : "Expand"
    : language === "zh"
      ? "收起导航"
      : "Collapse";

  return (
    <nav
      className={`flex h-full flex-col rounded-[26px] border border-sky-100/80 bg-white/94 shadow-[0_18px_46px_rgba(0,91,158,0.1)] backdrop-blur-[30px] transition-all duration-300 ${
        isCollapsed ? "w-[82px]" : "w-[274px]"
      }`}
      aria-label="Main navigation"
    >
      <header className="border-b border-sky-100/70 px-3 py-3.5">
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
          <motion.button
            onClick={onToggleServerSidebar}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-100/90 bg-white shadow-[0_8px_18px_rgba(0,91,158,0.08)] transition-colors hover:border-sky-200 hover:bg-sky-50"
            title={language === "zh" ? "显示/隐藏会话卡片" : "Show/hide session card"}
          >
            <img src={logo} alt="FUXI" className="h-9 w-9 object-contain" />
          </motion.button>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-bold tracking-tight text-slate-900">FUXI</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Server Forensics
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-2.5 py-3">
        {navGroups.map((group) => (
          <section key={group.title.en} className="mb-4 last:mb-0">
            {!isCollapsed && (
              <div className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {textByLanguage(language, group.title)}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = item.id === activeTab;
                const Icon = item.icon;
                const title = textByLanguage(language, item.title);
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    title={isCollapsed ? title : undefined}
                    whileHover={{ x: isCollapsed ? 0 : 2 }}
                    whileTap={{ scale: 0.99 }}
                    className={`group relative w-full overflow-hidden text-left transition-colors ${
                      isCollapsed ? "flex justify-center rounded-2xl p-2" : "rounded-2xl px-2.5 py-2"
                    } ${
                      isActive
                        ? "bg-sky-50/90 text-sky-700"
                        : "text-slate-600 hover:bg-sky-50/70 hover:text-slate-900"
                    }`}
                  >
                    {isActive && !isCollapsed && (
                      <motion.span
                        layoutId="sidebar-active-rail"
                        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-sky-500"
                        transition={{ type: "spring", stiffness: 500, damping: 38 }}
                      />
                    )}
                    <div className={`relative z-10 ${isCollapsed ? "flex items-center justify-center" : "flex items-center gap-2.5"}`}>
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                          isActive
                            ? "border-sky-200 bg-white text-sky-600 shadow-sm"
                            : "border-transparent bg-transparent text-slate-500 group-hover:bg-white group-hover:text-sky-600"
                        }`}
                      >
                        <Icon size={17} strokeWidth={2.1} />
                      </div>
                      {!isCollapsed && (
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-sm font-semibold ${isActive ? "text-sky-700" : "text-slate-700"}`}>
                            {title}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] leading-4 text-slate-400">
                            {textByLanguage(language, item.description)}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-auto border-t border-sky-100/70 p-2.5">
        {!isCollapsed && (
          <div className="mb-2 flex items-center gap-2 px-2.5 py-2 text-xs text-slate-500">
            <Server size={14} className="text-sky-600" />
            <span className="truncate">Workbench</span>
          </div>
        )}

        <div className="space-y-1">
          {onToggleCollapse && (
            <motion.button
              onClick={onToggleCollapse}
              whileHover={{ x: isCollapsed ? 0 : 2 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full rounded-2xl text-slate-600 transition-colors hover:bg-sky-50/70 hover:text-sky-700 ${
                isCollapsed ? "flex justify-center p-2.5" : "flex items-center gap-2.5 px-3 py-2.5"
              }`}
              title={collapseLabel}
            >
              {isCollapsed ? <PanelLeftOpen size={17} /> : <ChevronRight className="rotate-180" size={17} />}
              {!isCollapsed && <span className="text-sm font-semibold">{collapseLabel}</span>}
            </motion.button>
          )}
          <motion.button
            onClick={onOpenSettings}
            whileHover={{ x: isCollapsed ? 0 : 2 }}
            whileTap={{ scale: 0.99 }}
            className={`w-full rounded-2xl text-slate-600 transition-colors hover:bg-sky-50/70 hover:text-sky-700 ${
              isCollapsed ? "flex justify-center p-2.5" : "flex items-center gap-2.5 px-3 py-2.5"
            }`}
            title={settingsLabel}
          >
            <Settings size={17} />
            {!isCollapsed && <span className="text-sm font-semibold">{settingsLabel}</span>}
          </motion.button>
          <motion.button
            onClick={onDisconnect}
            whileHover={{ x: isCollapsed ? 0 : 2 }}
            whileTap={{ scale: 0.99 }}
            className={`w-full rounded-2xl text-rose-600 transition-colors hover:bg-rose-50 ${
              isCollapsed ? "flex justify-center p-2.5" : "flex items-center gap-2.5 px-3 py-2.5"
            }`}
            title={disconnectLabel}
          >
            <LogOut size={17} />
            {!isCollapsed && <span className="text-sm font-semibold">{disconnectLabel}</span>}
          </motion.button>
        </div>
      </footer>
    </nav>
  );
}
