import React, { useState } from 'react';
import { useCommandStore } from '../store/CommandContext';
import { Server, Plus, Monitor, CheckSquare, Square, MoreVertical, LogOut, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ServerSidebarProps {
  onAddSession: () => void;
  onDisconnect: (sessionId: string) => void;
}

export default function ServerSidebar({ onAddSession, onDisconnect }: ServerSidebarProps) {
  const { 
    sessions, 
    currentSession, 
    switchSession, 
    selectedSessionIds, 
    toggleSessionSelection,
    setSessionSelection
  } = useCommandStore();
  
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  
  const sessionToDeleteObj = sessions.find(s => s.id === sessionToDelete);

  const handleSessionClick = async (sessionId: string) => {
    // Always attempt to switch, even if it appears to be the current session.
    // This handles cases where state might be out of sync or user wants to refresh.
    try {
      await switchSession(sessionId);
    } catch (error) {
      console.error("Failed to switch session:", error);
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

  const cancelDelete = () => {
    setSessionToDelete(null);
  };

  // Select all handler
  const toggleSelectAll = () => {
    if (selectedSessionIds.length === sessions.length) {
      setSessionSelection([]);
    } else {
      setSessionSelection(sessions.map(s => s.id));
    }
  };

  return (
    <div className="w-64 h-full bg-slate-900 flex flex-col border-r border-slate-800 text-slate-300 relative z-30">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-white">
          <Server size={18} className="text-blue-500" />
          <span>Servers</span>
        </div>
        <button 
          onClick={onAddSession}
          className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
          title="Add Server"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Bulk Actions */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
        <button 
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          {selectedSessionIds.length === sessions.length && sessions.length > 0 ? (
            <CheckSquare size={14} className="text-blue-500" />
          ) : (
            <Square size={14} />
          )}
          <span>Select All (AI Context)</span>
        </button>
      </div>

      {/* Server List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm">
            <Server size={32} className="mb-2 opacity-20" />
            <p>No servers connected</p>
            <button 
              onClick={onAddSession}
              className="mt-4 text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              + Connect Server
            </button>
          </div>
        ) : (
          sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => handleSessionClick(session.id)}
              className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                session.is_current 
                  ? 'bg-blue-600/10 border border-blue-500/30' 
                  : 'hover:bg-slate-800 border border-transparent'
              }`}
            >
              {/* Checkbox for AI Context Selection */}
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSessionSelection(session.id);
                }}
                className="flex-shrink-0 text-slate-500 hover:text-blue-400 transition-colors"
              >
                {selectedSessionIds.includes(session.id) ? (
                  <CheckSquare size={16} className="text-blue-500" />
                ) : (
                  <Square size={16} />
                )}
              </div>

              {/* Server Info */}
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm truncate ${session.is_current ? 'text-blue-400' : 'text-slate-200'}`}>
                  {session.user}@{session.ip}
                </div>
                <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${session.is_current ? 'bg-green-500' : 'bg-slate-600'}`}></span>
                  {session.is_current ? 'Active View' : 'Connected'}
                </div>
              </div>

              {/* Actions */}
              <button
                onClick={(e) => handleDeleteClick(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                title="Disconnect"
              >
                <LogOut size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {sessionToDelete && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl w-full"
            >
              <div className="flex items-center gap-3 text-amber-500 mb-2">
                <Trash2 size={20} />
                <h3 className="font-bold text-white">Disconnect?</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Are you sure you want to disconnect {sessionToDeleteObj ? (
                  <span className="text-white font-medium">{sessionToDeleteObj.user}@{sessionToDeleteObj.ip}</span>
                ) : 'this session'}?
              </p>
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={cancelDelete}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 rounded transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
