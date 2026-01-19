import React, { useState } from 'react';
import { useCommandStore } from '../store/CommandContext';
import { Server, Plus, CheckSquare, Square, LogOut, Trash2, Activity, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface ServerSidebarProps {
  onAddSession: () => void;
  onDisconnect: (sessionId: string) => void;
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
  onDelete 
}: { 
  session: any, 
  isSelected: boolean, 
  isActive: boolean, 
  onClick: () => void, 
  onToggleSelect: (e: React.MouseEvent) => void,
  onDelete: (e: React.MouseEvent) => void
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300",
        "border overflow-hidden backdrop-blur-md",
        // Active State (Clean Tech: Frosted, Elevated, Clear)
        isActive 
          ? "bg-white/90 border-blue-200 shadow-lg shadow-blue-100/50 ring-1 ring-blue-100 z-10 scale-[1.02]" 
          : "bg-white/40 border-white/60 hover:bg-white/70 hover:border-white/80 hover:shadow-md hover:-translate-y-0.5"
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Shimmer Effect (Clean Tech: Subtle Light Sweep) */}
      <div className={cn(
        "absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700",
        "bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 translate-x-[-100%] group-hover:animate-shimmer"
      )} />

      {/* Active Indicator (Left Border Glow) */}
      {isActive && (
        <motion.div 
          layoutId="active-indicator"
          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-gradient-to-b from-blue-400 to-cyan-400 shadow-[0_0_8px_rgba(59,130,246,0.4)]" 
        />
      )}

      {/* Checkbox (AI Context) - Floating effect on hover */}
      <div 
        onClick={onToggleSelect}
        className={cn(
          "relative z-20 flex-shrink-0 transition-colors p-1.5 rounded-md",
          isSelected ? "text-blue-500 bg-blue-50" : "text-slate-400 hover:text-blue-400 hover:bg-slate-100"
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
             <span className="relative flex h-2 w-2">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                isActive ? "bg-green-400" : "bg-emerald-400"
              )}></span>
              <span className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                isActive ? "bg-green-500" : "bg-emerald-500"
              )}></span>
            </span>
            <span className={isActive ? "text-green-600 font-bold" : "text-slate-500"}>
              {isActive ? 'Active' : 'Connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Disconnect Button (Slide In) */}
      <AnimatePresence>
        {isHovered && (
          <motion.button
            onClick={onDelete}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="relative z-20 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Disconnect"
          >
            <LogOut size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Decorative background pulse for active state */}
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 via-transparent to-transparent pointer-events-none" />
      )}
    </motion.div>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------
export default function ServerSidebar({ onAddSession, onDisconnect }: ServerSidebarProps) {
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

  // Handle switching with visual feedback
  const handleSessionClick = async (sessionId: string) => {
    // Prevent re-clicking active session if desired, but allowing it can be good for "refreshing" view
    // if (currentSession?.id === sessionId) return;

    try {
      setIsSwitching(true);
      setSwitchError(null);
      await switchSession(sessionId);
    } catch (error) {
      console.error("Failed to switch session:", error);
      setSwitchError(String(error));
    } finally {
      // Ensure loading state persists long enough to feel smooth
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
    <div className="w-72 h-full flex flex-col relative z-30 font-sans border-r border-slate-200/60 bg-slate-50/80 backdrop-blur-2xl transition-colors duration-300">
      
      {/* Decorative Top Gradient */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

      {/* Content Layer */}
      <div className="relative flex flex-col h-full z-10">
        
        {/* Header Section */}
        <div className="p-5 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-blue-500 ring-1 ring-slate-50">
                <Terminal size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 tracking-tight">SERVERS</h2>
                <div className="text-[10px] text-slate-500 font-medium tracking-wide">
                  {sessions.length} CONNECTED
                </div>
              </div>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.8)" }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddSession}
              className="p-2.5 rounded-xl bg-white/60 text-blue-500 border border-slate-200 shadow-sm hover:shadow hover:border-blue-200 transition-all"
              title="Add New Server"
            >
              <Plus size={18} />
            </motion.button>
          </div>

          {/* Bulk Actions Bar */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/40 border border-slate-200/60 backdrop-blur-sm">
             <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors group"
            >
              {selectedSessionIds.length === sessions.length && sessions.length > 0 ? (
                <CheckSquare size={16} className="text-blue-500" />
              ) : (
                <Square size={16} className="text-slate-400 group-hover:text-blue-400" />
              )}
              <span>Select All Context</span>
            </button>
          </div>
          {switchError && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-red-50/80 border border-red-200/60 text-[11px] text-red-700 break-words">
              {switchError}
            </div>
          )}
        </div>

        {/* Scrollable Server List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-2.5">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-4">
              <div className="p-5 rounded-full bg-slate-100 border border-slate-200">
                <Server size={32} className="opacity-50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-600">No connections</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[150px]">Add a server to start monitoring</p>
              </div>
              <button 
                onClick={onAddSession}
                className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
              >
                Connect Server
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
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-200/60 bg-slate-50/50 backdrop-blur-sm">
           <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
             <span>FUXI FORENSICS</span>
             <span className="bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-500">v1.2.1</span>
           </div>
        </div>

        {/* Delete Confirmation Modal (Clean Glass) */}
        <AnimatePresence>
          {sessionToDelete && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-[2px] p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 10 }}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl shadow-slate-200/50 w-full max-w-[260px] relative overflow-hidden"
              >
                {/* Decorative glow */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-orange-400" />
                
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="p-3 bg-red-50 rounded-full text-red-500 shadow-sm">
                    <Trash2 size={24} />
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">Disconnect Server?</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Are you sure you want to disconnect from <br/>
                      <span className="text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {sessionToDeleteObj?.ip}
                      </span>?
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full mt-1">
                    <button 
                      onClick={() => setSessionToDelete(null)}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmDelete}
                      className="px-3 py-2 text-xs font-bold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg shadow-md shadow-red-500/20 transition-all hover:scale-105 active:scale-95"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Global Loading Overlay for Sidebar (when switching) */}
      <AnimatePresence>
        {isSwitching && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="absolute inset-0 z-40 bg-white/30 backdrop-blur-[1px] cursor-wait flex items-center justify-center"
           >
             <div className="bg-white p-3 rounded-full shadow-lg border border-slate-100">
               <Activity className="animate-spin text-blue-500" size={20} />
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
