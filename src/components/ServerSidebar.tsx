import React, { useState } from 'react';
import { useCommandStore } from '../store/CommandContext';
import { Server, Plus, CheckSquare, Square, LogOut, Trash2, Activity, Terminal, Edit2, Check, X, Crown, CalendarClock } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { cn } from '../lib/utils';
import { translations, Language } from '../translations';
import { APP_VERSION } from '../config/app';
import { useToast } from './Toast';

interface ServerSidebarProps {
  onAddSession: () => void;
  onDisconnect: (sessionId: string) => void;
  language?: Language;
  licenseStatus?: {
    valid: boolean;
    nickname?: string | null;
    qq?: string | null;
    avatar?: string | null;
    license_plan?: string | null;
    license_label?: string | null;
    expires_at?: number | null;
  } | null;
}

// ------------------------------------------------------------------
// Sub-component: Server Card (Trae Solo 3 Style)
// ------------------------------------------------------------------
const ServerCard = ({ 
  session, 
  isSelected, 
  isActive, 
  onClick, 
  onToggleSelect, 
  onDelete,
  onUpdateNote,
  language = 'en'
}: { 
  session: any, 
  isSelected: boolean, 
  isActive: boolean, 
  onClick: () => void, 
  onToggleSelect: (e: React.MouseEvent) => void,
  onDelete: (e: React.MouseEvent) => void,
  onUpdateNote: (note: string) => void,
  language?: Language
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(session.note || '');
  const t = translations[language];

  const handleSaveNote = (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    onUpdateNote(noteDraft);
    setIsEditing(false);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteDraft(session.note || '');
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
        "border",
        isActive 
          ? "border-blue-600 bg-blue-50 shadow-sm" 
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      )}
      onClick={!isEditing ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox */}
      {!isEditing && (
        <div 
          onClick={onToggleSelect}
          className={cn(
            "flex-shrink-0 transition-colors p-1 rounded-md",
            isSelected ? "text-blue-600" : "text-gray-400 hover:text-blue-500"
          )}
        >
          {isSelected ? (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
              <CheckSquare size={16} />
            </motion.div>
          ) : (
            <Square size={16} />
          )}
        </div>
      )}

      {/* Server Info or Edit Mode */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {isEditing ? (
          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="w-full min-w-0 text-xs px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white"
              placeholder="Add a note..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNote(e);
                if (e.key === 'Escape') handleCancelEdit(e as any);
              }}
            />
            <button onClick={handleSaveNote} className="p-1 text-green-600 hover:bg-green-50 rounded">
              <Check size={14} />
            </button>
            <button onClick={handleCancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className={cn(
              "font-medium text-sm truncate flex items-center gap-2 transition-colors",
              isActive ? "text-blue-600" : "text-gray-700"
            )}>
              <span className="truncate">{session.user}@{session.ip}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      isActive ? "bg-green-500" : "bg-gray-400"
                    )}></span>
                    <span className={cn(
                      "relative inline-flex rounded-full h-2 w-2",
                      isActive ? "bg-green-500" : "bg-gray-400"
                    )}></span>
                  </span>
                  <span className={isActive ? "text-green-600 font-medium" : "text-gray-500"}>
                    {isActive ? t.active_status : t.connected_status}
                  </span>
                </div>
              </div>
              {session.note && (
                <span className="text-xs text-gray-500 truncate max-w-[80px] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200" title={session.note}>
                  {session.note}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions (Slide In) */}
      <AnimatePresence>
        {isHovered && !isEditing && (
          <div className="flex items-center gap-1">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
              title="Edit Note"
            >
              <Edit2 size={14} />
            </motion.button>
            <motion.button
              onClick={onDelete}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title={t.disconnect}
            >
              <LogOut size={14} />
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------
export default function ServerSidebar({ onAddSession, onDisconnect, language = 'en', licenseStatus = null }: ServerSidebarProps) {
  const { 
    sessions, 
    switchSession, 
    selectedSessionIds, 
    toggleSessionSelection,
    setSessionSelection,
    updateSessionNote,
    reorderSessions,
    currentSession
  } = useCommandStore();
  
  const { showToast } = useToast();
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingToId, setSwitchingToId] = useState<string | null>(null);
  
  const sessionToDeleteObj = sessions.find(s => s.id === sessionToDelete);
  const t = translations[language];
  const normalizePlan = (rawPlan?: string | null) => {
    const plan = String(rawPlan || "").trim().toLowerCase();
    if (
      plan === "one_year" ||
      plan === "one-year" ||
      plan === "oneyear" ||
      plan === "1year" ||
      plan === "一年" ||
      plan === "一年套餐"
    ) {
      return "one_year";
    }
    if (
      plan === "half_year" ||
      plan === "half-year" ||
      plan === "halfyear" ||
      plan === "半年" ||
      plan === "半年套餐" ||
      plan === "6m"
    ) {
      return "half_year";
    }
    if (
      plan === "permanent" ||
      plan === "forever" ||
      plan === "lifetime" ||
      plan === "永久" ||
      plan === "永久套餐"
    ) {
      return "permanent";
    }
    return "thirty_days";
  };
  const plan = normalizePlan(licenseStatus?.license_plan);
  const avatarSrc =
    licenseStatus?.avatar && licenseStatus.avatar.trim().length > 0
      ? licenseStatus.avatar.startsWith("data:")
        ? licenseStatus.avatar
        : `data:image/png;base64,${licenseStatus.avatar}`
      : "";
  const expiresText =
    licenseStatus?.expires_at && plan !== "permanent"
      ? new Date(licenseStatus.expires_at * 1000).toLocaleDateString("zh-CN")
      : "";
  const remainingDays =
    licenseStatus?.expires_at && plan !== "permanent"
      ? Math.max(0, Math.ceil((licenseStatus.expires_at * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;
  const fallbackLabel =
    plan === "permanent"
      ? "永久会员"
      : plan === "one_year"
      ? "一年会员"
      : plan === "half_year"
      ? "半年会员"
      : "30天会员";

  // Handle switching with visual feedback
  const handleSessionClick = async (sessionId: string) => {
    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return;
    
    try {
      setIsSwitching(true);
      setSwitchingToId(sessionId);
      
      await switchSession(sessionId);
      
      // 成功提示
      showToast(
        'success', 
        language === 'zh' 
          ? `已切换到 ${targetSession.user}@${targetSession.ip}` 
          : `Switched to ${targetSession.user}@${targetSession.ip}`,
        2000
      );
    } catch (error) {
      console.error("Failed to switch session:", error);
      
      // 失败提示
      showToast(
        'error',
        language === 'zh'
          ? `切换失败：${String(error)}`
          : `Switch failed: ${String(error)}`,
        4000
      );
    } finally {
      setTimeout(() => {
        setIsSwitching(false);
        setSwitchingToId(null);
      }, 300);
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
    <div className="w-full h-full flex flex-col border-r border-gray-200 bg-white">
      
      {/* Content Layer */}
      <div className="flex flex-col h-full">
        
        {/* Header Section */}
        <div className="p-4 pb-2 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md border border-gray-200 bg-gray-50 text-blue-600">
                <Terminal size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">{t.servers_title}</h2>
                <div className="text-xs text-gray-500 font-medium">
                  {t.connected_count.replace('{0}', sessions.length.toString())}
                </div>
              </div>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddSession}
              className="p-2 rounded-md border border-gray-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors"
              title={t.new_connection}
            >
              <Plus size={16} />
            </motion.button>
          </div>

          {/* Bulk Actions Bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 border border-gray-200">
             <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {selectedSessionIds.length === sessions.length && sessions.length > 0 ? (
                <CheckSquare size={14} className="text-blue-600" />
              ) : (
                <Square size={14} className="text-gray-400" />
              )}
              <span>{t.select_all_context}</span>
            </button>
          </div>

        </div>

        {/* Scrollable Server List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 space-y-3">
              <div className="p-4 rounded-full bg-gray-100 border border-gray-200">
                <Server size={24} className="opacity-50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">{t.no_connections}</p>
                <p className="text-xs text-gray-500 mt-1 max-w-[150px]">{t.add_server_hint}</p>
              </div>
              <button 
                onClick={onAddSession}
                className="mt-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-sm transition-colors"
              >
                {t.connect_server_btn}
              </button>
            </div>
          ) : (
            <Reorder.Group axis="y" values={sessions.map(s => s.id)} onReorder={reorderSessions} className="space-y-2">
              <AnimatePresence mode='popLayout'>
                {sessions.map(session => (
                  <Reorder.Item key={session.id} value={session.id}>
                    <ServerCard 
                      session={session}
                      isActive={session.is_current || currentSession?.id === session.id}
                      isSelected={selectedSessionIds.includes(session.id)}
                      onClick={() => handleSessionClick(session.id)}
                      onToggleSelect={(e) => {
                        e.stopPropagation();
                        toggleSessionSelection(session.id);
                      }}
                      onDelete={(e) => handleDeleteClick(e, session.id)}
                      onUpdateNote={(note) => updateSessionNote(session.id, note)}
                      language={language}
                    />
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-gray-200 space-y-3">
          {licenseStatus?.valid && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-lg border border-gray-200 p-3 shadow-sm bg-white"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md overflow-hidden border border-gray-200 bg-white shrink-0">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-600 font-medium">
                      USER
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {licenseStatus.nickname || "授权用户"}
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">QQ: {licenseStatus.qq || "-"}</div>
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 text-gray-700">
                  <Crown size={10} />
                  {licenseStatus.license_label || fallbackLabel}
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500 font-medium">
                  {plan === "permanent" ? "永久授权" : "会员运行中"}
                </div>
                {expiresText && (
                  <div className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
                    <CalendarClock size={10} />
                    {expiresText}
                    {remainingDays !== null && <span className="text-blue-600 font-medium">剩余{remainingDays}天</span>}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          <div className="flex items-center justify-between text-xs font-medium text-gray-500">
            <span>FUXI FORENSICS</span>
            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">v{APP_VERSION}</span>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {sessionToDelete && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 10 }}
                className="bg-white border border-gray-200 rounded-lg p-5 shadow-lg w-full max-w-[240px]"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="p-2 bg-red-50 rounded-full text-red-600">
                    <Trash2 size={20} />
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm mb-1">{t.disconnect_confirm_title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {t.disconnect_confirm_desc} <br/>
                      <span className="text-gray-700 font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                        {sessionToDeleteObj?.ip}
                      </span>?
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full mt-1">
                    <button 
                      onClick={() => setSessionToDelete(null)}
                      className="px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      onClick={confirmDelete}
                      className="px-2 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
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
        {isSwitching && switchingToId && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="absolute inset-0 z-40 bg-white/80 backdrop-blur-sm cursor-wait flex items-center justify-center"
           >
             <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200 flex items-center gap-3">
               <Activity className="animate-spin text-blue-600" size={20} />
               <div className="text-sm font-medium text-gray-700">
                 {language === 'zh' ? '正在切换到' : 'Switching to'}{' '}
                 <span className="font-mono text-blue-600">
                   {sessions.find(s => s.id === switchingToId)?.ip}
                 </span>
               </div>
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
