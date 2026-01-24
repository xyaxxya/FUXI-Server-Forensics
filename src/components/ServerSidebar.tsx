import React, { useState } from 'react';
import { useCommandStore } from '../store/CommandContext';
import { Server, Plus, CheckSquare, Square, LogOut, Trash2, Activity, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { translations, Language } from '../translations';
import { APP_VERSION } from '../config/app';

interface ServerSidebarProps {
  onAddSession: () => void;
  onDisconnect: (sessionId: string) => void;
  language?: Language;
}

// ------------------------------------------------------------------
// Sub-component: Server Card (Clean Tech Style)
// ------------------------------------------------------------------
const ServerCard = ({ 
  session, 
  isSelected, 
  isActive, 
  onClick, 
  onToggleSelect, 
  onDelete,
  language = 'en'
}: { 
  session: any, 
  isSelected: boolean, 
  isActive: boolean, 
  onClick: () => void, 
  onToggleSelect: (e: React.MouseEvent) => void,
  onDelete: (e: React.MouseEvent) => void,
  language?: Language
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const t = translations[language];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300",
        "border",
        isActive 
          ? "bg-white/60 border-sky-300/50 shadow-lg shadow-sky-500/10 ring-1 ring-sky-100/50 z-10 backdrop-blur-md" 
          : "bg-white/10 border-white/20 hover:bg-white/30 hover:border-white/40 backdrop-blur-sm"
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Active Indicator (Left Border Glow) */}
      {isActive && (
        <motion.div 
          layoutId="active-indicator"
          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]" 
        />
      )}

      {/* Checkbox */}
      <div 
        onClick={onToggleSelect}
        className={cn(
          "relative z-20 flex-shrink-0 transition-colors p-1 rounded-md",
          isSelected ? "text-sky-500" : "text-slate-400 hover:text-sky-400"
        )}
      >
        {isSelected ? (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
            <CheckSquare size={16} className="drop-shadow-sm" />
          </motion.div>
        ) : (
          <Square size={16} />
        )}
      </div>

      {/* Server Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 relative z-10">
        <div className={cn(
          "font-semibold text-sm truncate flex items-center gap-2 transition-colors",
          isActive ? "text-slate-800" : "text-slate-600 group-hover:text-slate-800"
        )}>
          <span className="truncate tracking-tight">{session.user}@{session.ip}</span>
        </div>
        
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider font-medium text-slate-400">
          <div className="flex items-center gap-1.5">
             <span className="relative flex h-1.5 w-1.5">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                isActive ? "bg-emerald-400" : "bg-slate-400"
              )}></span>
              <span className={cn(
                "relative inline-flex rounded-full h-1.5 w-1.5",
                isActive ? "bg-emerald-500" : "bg-slate-400"
              )}></span>
            </span>
            <span className={isActive ? "text-emerald-600 font-bold" : "text-slate-500"}>
              {isActive ? t.active_status : t.connected_status}
            </span>
          </div>
        </div>
      </div>

      {/* Disconnect Button (Slide In) */}
      <AnimatePresence>
        {isHovered && (
          <motion.button
            onClick={onDelete}
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 5 }}
            className="relative z-20 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title={t.disconnect}
          >
            <LogOut size={14} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------
export default function ServerSidebar({ onAddSession, onDisconnect, language = 'en' }: ServerSidebarProps) {
  const { 
    sessions, 
    switchSession, 
    selectedSessionIds, 
    toggleSessionSelection,
    setSessionSelection,
    currentSession
  } = useCommandStore();
  
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  
  const sessionToDeleteObj = sessions.find(s => s.id === sessionToDelete);
  const t = translations[language];

  // Handle switching with visual feedback
  const handleSessionClick = async (sessionId: string) => {
    try {
      setIsSwitching(true);
      setSwitchError(null);
      await switchSession(sessionId);
    } catch (error) {
      console.error("Failed to switch session:", error);
      setSwitchError(String(error));
    } finally {
      setTimeout(() => setIsSwitching(false), 300);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      onDisconnect(sessionToDelete);
      setSessionToDelete(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSessionIds.length === sessions.length) {
      setSessionSelection([]);
    } else {
      setSessionSelection(sessions.map(s => s.id));
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative z-30 font-sans glass transition-colors duration-300">
      
      {/* Content Layer */}
      <div className="relative flex flex-col h-full z-10">
        
        {/* Header Section */}
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-slate-100 text-sky-500">
                <Terminal size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 tracking-tight">{t.servers_title}</h2>
                <div className="text-[10px] text-slate-500 font-medium tracking-wide">
                  {t.connected_count.replace('{0}', sessions.length.toString())}
                </div>
              </div>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddSession}
              className="p-2 rounded-xl bg-white/60 text-sky-500 border border-slate-200 hover:border-sky-200 transition-all glass-button"
              title={t.new_connection}
            >
              <Plus size={16} />
            </motion.button>
          </div>

          {/* Bulk Actions Bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/30 border border-slate-200/50 backdrop-blur-sm">
             <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors group"
            >
              {selectedSessionIds.length === sessions.length && sessions.length > 0 ? (
                <CheckSquare size={14} className="text-sky-500" />
              ) : (
                <Square size={14} className="text-slate-400 group-hover:text-sky-400" />
              )}
              <span>{t.select_all_context}</span>
            </button>
          </div>
          {switchError && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-red-50/80 border border-red-200/60 text-[11px] text-red-700 break-words">
              {switchError}
            </div>
          )}
        </div>

        {/* Scrollable Server List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-3">
              <div className="p-4 rounded-full bg-slate-100/50 border border-slate-200/50">
                <Server size={24} className="opacity-50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-600">{t.no_connections}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[150px]">{t.add_server_hint}</p>
              </div>
              <button 
                onClick={onAddSession}
                className="mt-1 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all"
              >
                {t.connect_server_btn}
              </button>
            </div>
          ) : (
            <AnimatePresence mode='popLayout'>
              {sessions.map(session => (
                <ServerCard 
                  key={session.id}
                  session={session}
                  isActive={session.is_current || currentSession?.id === session.id}
                  isSelected={selectedSessionIds.includes(session.id)}
                  onClick={() => handleSessionClick(session.id)}
                  onToggleSelect={(e) => {
                    e.stopPropagation();
                    toggleSessionSelection(session.id);
                  }}
                  onDelete={(e) => handleDeleteClick(e, session.id)}
                  language={language}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-white/20 bg-white/10">
           <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
             <span>FUXI FORENSICS</span>
             <span className="bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-500">v{APP_VERSION}</span>
           </div>
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {sessionToDelete && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-sm p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 10 }}
                className="bg-white/90 border border-white/60 rounded-2xl p-5 shadow-xl shadow-slate-200/50 w-full max-w-[240px] relative overflow-hidden glass-heavy"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="p-2 bg-red-50 rounded-full text-red-500 shadow-sm">
                    <Trash2 size={20} />
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">{t.disconnect_confirm_title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {t.disconnect_confirm_desc} <br/>
                      <span className="text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {sessionToDeleteObj?.ip}
                      </span>?
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full mt-1">
                    <button 
                      onClick={() => setSessionToDelete(null)}
                      className="px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      onClick={confirmDelete}
                      className="px-2 py-1.5 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md shadow-red-500/20 transition-all"
                    >
                      {t.disconnect}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Global Loading Overlay for Sidebar */}
      <AnimatePresence>
        {isSwitching && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="absolute inset-0 z-40 bg-white/30 backdrop-blur-[1px] cursor-wait flex items-center justify-center"
           >
             <div className="bg-white/80 p-2 rounded-full shadow-lg border border-white/50">
               <Activity className="animate-spin text-sky-500" size={18} />
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
