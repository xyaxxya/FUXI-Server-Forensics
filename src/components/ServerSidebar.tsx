import React, { useState } from 'react';
import { useCommandStore } from '../store/CommandContext';
import { Server, Plus, CheckSquare, Square, LogOut, Trash2, Activity, Terminal, Edit2, Check, X, Crown, CalendarClock } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { cn } from '../lib/utils';
import { translations, Language } from '../translations';
import { APP_VERSION } from '../config/app';

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
// Sub-component: Server Card (Clean Tech Style)
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
        "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300",
        "border",
        isActive 
          ? "bg-white/60 border-sky-300/50 shadow-lg shadow-sky-500/10 ring-1 ring-sky-100/50 z-10 backdrop-blur-md" 
          : "bg-white/10 border-white/20 hover:bg-white/30 hover:border-white/40 backdrop-blur-sm"
      )}
      onClick={!isEditing ? onClick : undefined}
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
      {!isEditing && (
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
      )}

      {/* Server Info or Edit Mode */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 relative z-10">
        {isEditing ? (
          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="w-full min-w-0 text-xs px-2 py-1 rounded border border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-400 bg-white/80"
              placeholder="Add a note..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNote(e);
                if (e.key === 'Escape') handleCancelEdit(e as any);
              }}
            />
            <button onClick={handleSaveNote} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded">
              <Check size={14} />
            </button>
            <button onClick={handleCancelEdit} className="p-1 text-red-500 hover:bg-red-50 rounded">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className={cn(
              "font-semibold text-sm truncate flex items-center gap-2 transition-colors",
              isActive ? "text-slate-800" : "text-slate-600 group-hover:text-slate-800"
            )}>
              <span className="truncate tracking-tight">{session.user}@{session.ip}</span>
            </div>
            
            <div className="flex items-center justify-between">
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
              {session.note && (
                <span className="text-[10px] text-slate-500 truncate max-w-[80px] bg-slate-100 px-1 rounded border border-slate-200" title={session.note}>
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
              className="relative z-20 p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"
              title="Edit Note"
            >
              <Edit2 size={14} />
            </motion.button>
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
  
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  
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
  const planCardStyle =
    plan === "permanent"
      ? {
          borderColor: "rgba(245,158,11,0.35)",
          background:
            "linear-gradient(140deg, rgba(255,251,235,0.95), rgba(255,237,213,0.92), rgba(255,255,255,0.96))",
        }
      : plan === "one_year"
      ? {
          borderColor: "rgba(139,92,246,0.35)",
          background:
            "linear-gradient(140deg, rgba(245,243,255,0.95), rgba(237,233,254,0.92), rgba(255,255,255,0.96))",
        }
      : plan === "half_year"
      ? {
          borderColor: "rgba(16,185,129,0.35)",
          background:
            "linear-gradient(140deg, rgba(236,253,245,0.95), rgba(209,250,229,0.92), rgba(255,255,255,0.96))",
        }
      : {
          borderColor: "rgba(14,165,233,0.32)",
          background:
            "linear-gradient(140deg, rgba(239,246,255,0.95), rgba(224,242,254,0.9), rgba(255,255,255,0.96))",
        };
  const planGlowClass =
    plan === "permanent"
      ? "bg-amber-300/40"
      : plan === "one_year"
      ? "bg-violet-300/40"
      : plan === "half_year"
      ? "bg-emerald-300/40"
      : "bg-sky-300/40";
  const planBadgeClass =
    plan === "permanent"
      ? "bg-amber-100/90 text-amber-700 border-amber-200"
      : plan === "one_year"
      ? "bg-violet-100/90 text-violet-700 border-violet-200"
      : plan === "half_year"
      ? "bg-emerald-100/90 text-emerald-700 border-emerald-200"
      : "bg-sky-100/90 text-sky-700 border-sky-200";
  const planRemainClass =
    plan === "one_year"
      ? "text-violet-600"
      : plan === "half_year"
      ? "text-emerald-600"
      : "text-sky-600";
  const planStatusText =
    plan === "permanent"
      ? "尊享身份已激活"
      : plan === "one_year"
      ? "一年会员运行中"
      : plan === "half_year"
      ? "半年会员运行中"
      : "30天会员运行中";

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
        <div className="p-3 border-t border-white/20 bg-white/10 space-y-3">
          {licenseStatus?.valid && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="relative rounded-2xl border overflow-hidden p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
              style={planCardStyle}
            >
              <motion.div
                animate={{ opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl ${planGlowClass}`}
              />
              <div className="relative flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl overflow-hidden border border-white/90 bg-white shadow-sm shrink-0">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600 font-bold">
                      USER
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800 truncate tracking-wide">
                    {licenseStatus.nickname || "授权用户"}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">QQ: {licenseStatus.qq || "-"}</div>
                </div>
                <motion.div
                  animate={plan === "permanent" ? { scale: [1, 1.08, 1] } : undefined}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${planBadgeClass}`}
                >
                  <Crown size={10} />
                  {licenseStatus.license_label || fallbackLabel}
                </motion.div>
              </div>

              <div className="relative mt-2.5 flex items-center justify-between gap-2">
                <div className="text-[10px] text-slate-500 font-medium">
                  {planStatusText}
                </div>
                {expiresText ? (
                  <div className="inline-flex items-center gap-1.5 text-[10px] text-slate-600 bg-white/70 border border-white rounded-full px-2 py-1">
                    <CalendarClock size={10} />
                    {expiresText}
                    {remainingDays !== null && <span className={`${planRemainClass} font-semibold`}>剩余{remainingDays}天</span>}
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-700 font-semibold bg-amber-50/80 border border-amber-200 rounded-full px-2 py-1">
                    永久授权
                  </div>
                )}
              </div>
            </motion.div>
          )}
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
