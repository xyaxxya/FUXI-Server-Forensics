import { useState, useEffect } from 'react';
import { 
  Cpu, Network, Database, Container, Cloud, Terminal, 
  Shield, LayoutDashboard, ChevronDown, LogOut,
  Bot, GalleryVerticalEnd, Settings,
  FileText, Sparkles
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
    id: 'monitor',
    labelKey: 'monitor',
    items: [
      { id: 'system', icon: Cpu, labelKey: 'system' },
      { id: 'network', icon: Network, labelKey: 'network' },
    ]
  },
  {
    id: 'infrastructure',
    labelKey: 'infrastructure',
    items: [
      { id: 'docker', icon: Container, labelKey: 'docker' },
      { id: 'k8s', icon: Cloud, labelKey: 'k8s' },
      { id: 'database', icon: Database, labelKey: 'database' },
    ]
  },
  {
    id: 'services',
    labelKey: 'services',
    items: [
      { id: 'web', icon: LayoutDashboard, labelKey: 'web' },
      { id: 'security', icon: Shield, labelKey: 'security' },
    ]
  },
  {
    id: 'agent',
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
    ]
  }
];

export default function Sidebar({ activeTab, onTabChange, onDisconnect, language, onOpenSettings, onToggleServerSidebar }: SidebarProps) {
  const t = translations[language];
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['monitor', 'infrastructure', 'services', 'agent', 'tools']);

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
    <div className="w-64 h-full flex flex-col glass transition-all duration-300 relative z-20">
      {/* Header */}
      <div className="p-6 pb-2 shrink-0" data-tauri-drag-region>
        <div className="flex items-center gap-4 mb-2">
            <motion.button 
                onClick={onToggleServerSidebar}
                className="relative w-12 h-12 flex items-center justify-center bg-white/50 rounded-2xl shadow-sm border border-white/60 focus:outline-none glass-button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <motion.img 
                    src={tauriLogo} 
                    alt="Logo" 
                    className="w-8 h-8 object-contain relative z-10"
                />
            </motion.button>
            
            <div className="flex flex-col overflow-hidden">
                <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="font-bold text-lg text-slate-800 tracking-tight leading-none mb-1"
                >
                    Server Forensics
                </motion.span>
                <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-2"
                >
                    <span className="text-[10px] font-bold text-sky-600 tracking-widest uppercase">FUXI</span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">PRO</span>
                </motion.div>
            </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto custom-scrollbar">
        {menuGroups.map(group => (
          <div key={group.id} className="mb-2">
            <button 
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
            >
              <span>{t[group.labelKey as keyof typeof t]}</span>
              <motion.div
                animate={{ rotate: expandedGroups.includes(group.id) ? 0 : -90 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={12} />
              </motion.div>
            </button>
            
            <AnimatePresence initial={false}>
              {expandedGroups.includes(group.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 mt-1">
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => onTabChange(item.id)}
                          className="w-full relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeTab"
                              className="absolute inset-0 bg-sky-500/5 border border-sky-500/10 rounded-xl"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                          <div className={`relative z-10 p-1.5 rounded-lg transition-colors ${isActive ? 'text-sky-600 bg-sky-100/50' : 'text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-100/50'}`}>
                            <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                          </div>
                          <span className={`relative z-10 text-sm font-medium transition-colors ${isActive ? 'text-slate-800' : 'text-slate-500 group-hover:text-slate-700'}`}>
                            {t[item.labelKey as keyof typeof t]}
                          </span>
                          
                          {isActive && (
                            <motion.div
                                layoutId="activeIndicator"
                                className="absolute right-2 w-1.5 h-1.5 rounded-full bg-sky-500"
                            />
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
      <div className="p-4 border-t border-white/20 bg-white/5 space-y-2">
        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-white/40 transition-all duration-200 group"
        >
          <Settings size={18} className="group-hover:rotate-45 transition-transform duration-500" />
          <span className="text-sm font-medium">{t.settings}</span>
        </button>
        <button 
          onClick={onDisconnect}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50/50 transition-all duration-200"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">{t.disconnect}</span>
        </button>
      </div>
    </div>
  );
}
