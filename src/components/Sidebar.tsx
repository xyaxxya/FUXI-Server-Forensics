import { useState, useEffect } from 'react';
import { 
  Cpu, ChevronDown, LogOut, Settings, ScanLine,
  FileText, Bot, Sparkles, GalleryVerticalEnd, Terminal, Crosshair
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations, Language } from '../translations';
import tauriLogo from '../assets/tauri.png';

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

interface MenuItem {
  id: string;
  icon: any;
  labelKey: string;
}

interface MenuGroup {
  id: string;
  labelKey: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    id: 'monitoring',
    labelKey: 'monitor',
    items: [
      { id: 'dashboard', icon: Cpu, labelKey: 'monitor_center' },
    ]
  },
  {
    id: 'ai_agents',
    labelKey: 'agent',
    items: [
      { id: 'agent-context', icon: FileText, labelKey: 'agent_context' },
      { id: 'agent-general', icon: Bot, labelKey: 'agent_general' },
      { id: 'agent-database', icon: Sparkles, labelKey: 'agent_database' },
      { id: 'agent-panel', icon: GalleryVerticalEnd, labelKey: 'agent_panel' },
    ]
  },
  {
    id: 'tools',
    labelKey: 'tools',
    items: [
      { id: 'terminal', icon: Terminal, labelKey: 'terminal' },
      { id: 'pentest', icon: Crosshair, labelKey: 'pentest' },
    ]
  }
];

export default function Sidebar({ activeTab, onTabChange, onDisconnect, language, onOpenSettings, onToggleServerSidebar, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const t = translations[language];
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['monitoring', 'ai_agents', 'tools']);

  // Auto-expand group containing active tab
  useEffect(() => {
    const activeGroup = menuGroups.find(group => group.items.some(item => item.id === activeTab));
    if (activeGroup && !expandedGroups.includes(activeGroup.id)) {
      setExpandedGroups(prev => [...prev, activeGroup.id]);
    }
  }, [activeTab]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <div className={`h-full flex flex-col ds-panel transition-all duration-300 relative z-20 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Decorative Top Edge */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/35 to-transparent" />

      {/* Header */}
      <div className="p-6 pb-2 shrink-0 relative" data-tauri-drag-region>
        <div className="flex items-center gap-4 mb-2">
            <motion.button
                onClick={onToggleServerSidebar}
                className="relative w-12 h-12 flex items-center justify-center bg-white/70 rounded-2xl shadow-sm border border-blue-100 focus:outline-none glass-button overflow-hidden group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Tech Scan Effect */}
                <motion.div
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/15 to-transparent translate-y-[-100%]"
                    whileHover={{ translateY: "100%" }}
                    transition={{ duration: 0.6 }}
                />

                <motion.img
                    src={tauriLogo}
                    alt="Logo"
                    className="w-8 h-8 object-contain relative z-10"
                />
            </motion.button>

            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden">
                  <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="font-bold text-lg text-slate-800 tracking-tight leading-none mb-1 flex items-center gap-2"
                  >
                      Server Forensics
                  </motion.span>
                  <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center gap-2"
                  >
                      <span className="text-[10px] font-bold text-blue-700 tracking-widest uppercase flex items-center gap-1">
                        <ScanLine size={10} />
                        FUXI
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50">PRO</span>
                  </motion.div>
              </div>
            )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto custom-scrollbar relative z-10">
        {menuGroups.map(group => (
          <div key={group.id} className="mb-2">
            {!isCollapsed && (
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors group"
              >
                <span className="flex items-center gap-2">
                  {t[group.labelKey as keyof typeof t]}
                  <div className="h-[1px] w-4 bg-slate-200 group-hover:bg-slate-300 transition-colors" />
                </span>
                <motion.div
                  animate={{ rotate: expandedGroups.includes(group.id) ? 0 : -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={12} />
                </motion.div>
              </button>
            )}

            <AnimatePresence initial={false}>
              {(isCollapsed || expandedGroups.includes(group.id)) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 mt-1 relative">
                    {/* Vertical Guide Line */}
                    {!isCollapsed && <div className="absolute left-3 top-2 bottom-2 w-[1px] bg-slate-200/50" />}

                    {group.items.map(item => {
                      const isActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => onTabChange(item.id)}
                          className={`w-full relative flex items-center gap-3 rounded-xl transition-all duration-200 group ${isCollapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5 ml-2'}`}
                          style={isCollapsed ? {} : { width: "calc(100% - 8px)" }}
                          title={isCollapsed ? t[item.labelKey as keyof typeof t] : undefined}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeTab"
                              className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl overflow-hidden"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                                {/* Corner Accents for Tech Feel */}
                                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-blue-500/40 rounded-tl-lg" />
                                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-blue-500/40 rounded-br-lg" />

                                {/* Scanning Line */}
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent w-1/2 h-full skew-x-12"
                                    animate={{ x: ["-150%", "200%"] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                />
                            </motion.div>
                          )}

                          <div className={`relative z-10 p-1.5 rounded-lg transition-colors ${isActive ? 'text-blue-700 bg-blue-100/70' : 'text-slate-400 group-hover:text-slate-600'}`}>
                            <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                          </div>
                          {!isCollapsed && (
                            <span className={`relative z-10 text-sm font-medium transition-colors ${isActive ? 'text-slate-800' : 'text-slate-500 group-hover:text-slate-700'}`}>
                              {t[item.labelKey as keyof typeof t]}
                            </span>
                          )}

                          {isActive && !isCollapsed && (
                            <motion.div
                                layoutId="activeIndicator"
                                className="absolute right-2 flex items-center"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" />
                            </motion.div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/20 bg-white/5 space-y-2 relative z-10">
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-white/40 transition-all duration-200 group relative overflow-hidden"
            title={isCollapsed ? (language === 'zh' ? '展开侧边栏' : 'Expand') : (language === 'zh' ? '折叠侧边栏' : 'Collapse')}
          >
            <motion.div
              animate={{ rotate: isCollapsed ? 0 : 180 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown size={18} className="rotate-90" />
            </motion.div>
            {!isCollapsed && <span className="text-sm font-medium">{language === 'zh' ? '折叠' : 'Collapse'}</span>}
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-3 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-white/40 transition-all duration-200 group relative overflow-hidden ${isCollapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5'}`}
          title={isCollapsed ? t.settings : undefined}
        >
          <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
          {!isCollapsed && <span className="text-sm font-medium">{t.settings}</span>}
          {/* Subtle Shine */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
        </button>
        <button
          onClick={onDisconnect}
          className={`w-full flex items-center gap-3 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50/50 transition-all duration-200 ${isCollapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5'}`}
          title={isCollapsed ? t.disconnect : undefined}
        >
          <LogOut size={18} />
          {!isCollapsed && <span className="text-sm font-medium">{t.disconnect}</span>}
        </button>
      </div>
    </div>
  );
}
