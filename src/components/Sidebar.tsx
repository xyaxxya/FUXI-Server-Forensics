import { useState, useEffect } from 'react';
import { 
  Cpu, Network, Database, Container, Cloud, Terminal, 
  Shield, LayoutDashboard, ChevronDown, LogOut,
  Bot, GalleryVerticalEnd, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations, Language } from '../translations';
import tauriLogo from '../assets/tauri.png';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onDisconnect: () => void;
  language: Language;
  onToggleLanguage: () => void;
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
      { id: 'agent-general', icon: Bot, labelKey: 'agent_general' },
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
    <div className="w-80 h-full flex flex-col border-r border-slate-200/60 bg-white/90 backdrop-blur-2xl z-20 transition-all duration-300 relative shadow-2xl">
      {/* Header Area */}
      <div className="p-8 flex items-center justify-between relative overflow-hidden" data-tauri-drag-region>
        {/* Animated Background Elements for Header */}
        <div className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none overflow-hidden" data-tauri-drag-region>
            <motion.div 
                className="absolute -top-10 -right-10 w-32 h-32 bg-blue-400/30 rounded-full blur-2xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
                className="absolute bottom-0 left-0 w-24 h-24 bg-purple-400/30 rounded-full blur-2xl"
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
        </div>

        <div className="flex items-center gap-4 group relative z-10 w-full">
            <motion.button
                type="button"
                onClick={onToggleServerSidebar}
                className="relative w-14 h-14 flex items-center justify-center bg-white rounded-2xl shadow-lg shadow-blue-500/10 border border-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                whileHover={{ scale: 1.05, rotate: 2 }}
            >
                <motion.img 
                    src={tauriLogo} 
                    alt="Logo" 
                    className="w-10 h-10 object-contain relative z-10"
                />
            </motion.button>
            
            <div className="flex flex-col overflow-hidden">
                <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="font-black text-xl text-slate-800 tracking-tight leading-none mb-1"
                >
                    Server Forensics
                </motion.span>
                <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-2"
                >
                    <span className="text-xs font-bold text-blue-600 tracking-widest uppercase">FUXI</span>
                    <span className="text-[9px] font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 px-1.5 py-0.5 rounded shadow-sm shadow-blue-500/20">PRO</span>
                </motion.div>
            </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-6 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups.includes(group.id);
          const hasActiveChild = group.items.some(item => item.id === activeTab);

          return (
            <div key={group.id} className="space-y-1">
              <button 
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  hasActiveChild ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span>{t[group.labelKey as keyof typeof t]}</span>
                <ChevronDown 
                  size={14} 
                  className={`transition-transform duration-300 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} 
                />
              </button>
              
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden space-y-1"
                  >
                    {group.items.map((item) => {
                      const isActive = activeTab === item.id;
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          onClick={() => onTabChange(item.id)}
                          className={`relative group w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 outline-none overflow-hidden ${
                              isActive 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
                              : 'hover:bg-slate-100/80 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Icon 
                            size={20} 
                            className={`transition-all duration-300 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} 
                          />
                          <span className="font-medium text-sm">
                              {t[item.labelKey as keyof typeof t]}
                          </span>
                          
                          {isActive && (
                             <motion.div
                               layoutId="activeGlow"
                               className="absolute inset-0 bg-white/20 blur-xl rounded-xl"
                               initial={{ opacity: 0 }}
                               animate={{ opacity: 1 }}
                               transition={{ duration: 0.5 }}
                             />
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-6 border-t border-slate-200/60 space-y-3 bg-white/50 backdrop-blur-sm">
        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group shadow-sm hover:shadow-md"
        >
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                 <Settings size={16} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
             </div>
             <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
               {t.settings}
             </span>
          </div>
        </button>

        <button 
          onClick={onDisconnect}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:shadow-md transition-all group shadow-sm"
        >
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-red-100 transition-colors">
                 <LogOut size={16} className="text-slate-500 group-hover:text-red-600 transition-colors" />
             </div>
             <span className="text-xs font-medium text-slate-600 group-hover:text-red-600 transition-colors">{t.disconnect}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
