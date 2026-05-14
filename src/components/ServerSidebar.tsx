import React, { useState } from "react";
import { useCommandStore } from "../store/CommandContext";
import {
  Activity,
  CalendarClock,
  Check,
  CheckSquare,
  Crown,
  Edit2,
  LogOut,
  Plus,
  Server,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { cn } from "../lib/utils";
import { translations, Language } from "../translations";
import { APP_VERSION } from "../config/app";
import { useToast } from "./Toast";

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

const normalizePlan = (rawPlan?: string | null) => {
  const plan = String(rawPlan || "").trim().toLowerCase();
  if (["one_year", "one-year", "oneyear", "1year", "一年", "一年套餐"].includes(plan)) {
    return "one_year";
  }
  if (["half_year", "half-year", "halfyear", "半年", "半年套餐", "6m"].includes(plan)) {
    return "half_year";
  }
  if (["permanent", "forever", "lifetime", "永久", "永久套餐"].includes(plan)) {
    return "permanent";
  }
  return "thirty_days";
};

const planTotalDays: Record<string, number> = {
  thirty_days: 30,
  half_year: 183,
  one_year: 365,
  permanent: 365,
};

function ServerCard({
  session,
  isSelected,
  isActive,
  onClick,
  onToggleSelect,
  onDelete,
  onUpdateNote,
  language = "en",
}: {
  session: any;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onUpdateNote: (note: string) => void;
  language?: Language;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(session.note || "");
  const t = translations[language];

  const handleSaveNote = (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    onUpdateNote(noteDraft);
    setIsEditing(false);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteDraft(session.note || "");
    setIsEditing(false);
  };

  return (
    <motion.div
      layout
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-[22px] border p-3 transition-all duration-200",
        isActive
          ? "border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 shadow-[0_12px_26px_rgba(0,120,212,0.12)]"
          : "border-white/70 bg-white/58 hover:border-sky-100 hover:bg-white/88 hover:shadow-[0_10px_22px_rgba(42,79,120,0.09)]",
      )}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={!isEditing ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isActive && (
        <motion.div
          layoutId="active-server-indicator"
          className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-gradient-to-b from-[#0078D4] to-[#50E6FF]"
        />
      )}

      {!isEditing && (
        <button
          onClick={onToggleSelect}
          className={cn(
            "relative z-20 flex shrink-0 rounded-xl p-1 transition-colors",
            isSelected ? "text-[#0078D4]" : "text-slate-400 hover:bg-sky-50 hover:text-[#0078D4]",
          )}
        >
          {isSelected ? (
            <motion.div initial={{ scale: 0.82 }} animate={{ scale: 1 }}>
              <CheckSquare size={17} />
            </motion.div>
          ) : (
            <Square size={17} />
          )}
        </button>
      )}

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-white/80 bg-gradient-to-br from-[#0078D4] to-[#50E6FF] text-white shadow-[0_10px_20px_rgba(0,120,212,0.22)]">
        <Server size={18} />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-0.5">
        {isEditing ? (
          <div className="flex w-full items-center gap-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="ui-input-base min-w-0 flex-1 px-2.5 py-1.5 text-xs"
              placeholder={language === "zh" ? "添加备注" : "Add a note"}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveNote(e);
                if (e.key === "Escape") handleCancelEdit(e as any);
              }}
            />
            <button onClick={handleSaveNote} className="rounded-xl p-1.5 text-emerald-600 hover:bg-emerald-50">
              <Check size={14} />
            </button>
            <button onClick={handleCancelEdit} className="rounded-xl p-1.5 text-red-500 hover:bg-red-50">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className={cn("flex items-center gap-2 truncate text-[13px] font-semibold", isActive ? "text-slate-900" : "text-slate-700")}>
              <span className="truncate tracking-tight">
                {session.user}@{session.ip}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", isActive ? "bg-emerald-400" : "bg-slate-400")} />
                  <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-slate-400")} />
                </span>
                <span className={isActive ? "text-emerald-600" : "text-slate-400"}>{isActive ? t.active_status : t.connected_status}</span>
              </div>
              {session.note && (
                <span className="max-w-[96px] truncate rounded-full border border-slate-200 bg-white/72 px-2 py-0.5 text-[10px] text-slate-500" title={session.note}>
                  {session.note}
                </span>
              )}
            </div>
          </>
        )}
      </div>

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
              className="relative z-20 rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-sky-50 hover:text-[#0078D4]"
              title="Edit Note"
            >
              <Edit2 size={14} />
            </motion.button>
            <motion.button
              onClick={onDelete}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              className="relative z-20 rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title={t.disconnect}
            >
              <LogOut size={14} />
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ServerSidebar({ onAddSession, onDisconnect, language = "en", licenseStatus = null }: ServerSidebarProps) {
  const {
    sessions,
    switchSession,
    selectedSessionIds,
    toggleSessionSelection,
    setSessionSelection,
    updateSessionNote,
    reorderSessions,
    currentSession,
  } = useCommandStore();

  const { showToast } = useToast();
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingToId, setSwitchingToId] = useState<string | null>(null);

  const sessionToDeleteObj = sessions.find((s) => s.id === sessionToDelete);
  const t = translations[language];
  const plan = normalizePlan(licenseStatus?.license_plan);
  const licenseTierClass = `license-tier-${plan}`;
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
  const progressValue =
    plan === "permanent"
      ? 100
      : remainingDays === null
        ? 72
        : Math.max(4, Math.min(100, Math.round((remainingDays / planTotalDays[plan]) * 100)));
  const fallbackLabel =
    plan === "permanent"
      ? language === "zh"
        ? "永久会员"
        : "Lifetime"
      : plan === "one_year"
        ? language === "zh"
          ? "一年会员"
          : "Annual"
        : plan === "half_year"
          ? language === "zh"
            ? "半年会员"
            : "Half-year"
          : language === "zh"
            ? "30天会员"
            : "30 days";
  const planStatusText =
    plan === "permanent"
      ? language === "zh"
        ? "永久授权已激活"
        : "Lifetime license active"
      : language === "zh"
        ? "授权周期运行中"
        : "License cycle active";

  const handleSessionClick = async (sessionId: string) => {
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (!targetSession) return;

    try {
      setIsSwitching(true);
      setSwitchingToId(sessionId);
      await switchSession(sessionId);
      showToast(
        "success",
        language === "zh"
          ? `已切换到 ${targetSession.user}@${targetSession.ip}`
          : `Switched to ${targetSession.user}@${targetSession.ip}`,
        2000,
      );
    } catch (error) {
      console.error("Failed to switch session:", error);
      showToast(
        "error",
        language === "zh" ? `切换失败：${String(error)}` : `Switch failed: ${String(error)}`,
        4000,
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
      setSessionSelection(sessions.map((s) => s.id));
    }
  };

  return (
    <aside className="server-sidebar-compact relative z-30 flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-sky-100/80 bg-white/92 font-sans shadow-[0_22px_52px_rgba(0,91,158,0.1)] backdrop-blur-[34px]">
      <div className="px-3.5 pt-3.5">
        <div className="relative overflow-hidden rounded-[24px] border border-sky-100/80 bg-white/94 p-3 shadow-[0_14px_34px_rgba(0,91,158,0.08)] backdrop-blur-2xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="license-tier-avatar h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white bg-white shadow-[0_10px_22px_rgba(42,79,120,0.14)]">
              {avatarSrc ? (
                <img src={avatarSrc} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-sky-50 text-[10px] font-bold text-[#0078D4]">
                  USER
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-bold tracking-tight text-slate-900">
                  {licenseStatus?.nickname || (language === "zh" ? "授权用户" : "Licensed User")}
                </h2>
                <span className={`license-tier-badge ${licenseTierClass} inline-flex max-w-[78px] shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold shadow-none`}>
                  <Crown size={10} className="license-tier-badge-icon shrink-0" />
                  <span className="truncate">{licenseStatus?.license_label || fallbackLabel}</span>
                </span>
              </div>
              <div className="mt-1 truncate text-[11px] font-medium text-slate-500">QQ: {licenseStatus?.qq || "-"}</div>
            </div>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={onAddSession}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-[#0078D4] shadow-sm"
              title={t.new_connection}
            >
              <Plus size={16} />
            </motion.button>
          </div>

          <div className="mt-3 rounded-2xl border border-sky-100/80 bg-sky-50/48 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate font-semibold text-slate-600">{planStatusText}</span>
              <span className="inline-flex shrink-0 items-center gap-1 font-bold text-slate-800">
                <ShieldCheck size={12} className="text-[#0078D4]" />
                {plan === "permanent" ? "100%" : remainingDays !== null ? `${remainingDays}d` : "Active"}
              </span>
            </div>
            <div className="mt-2 h-1.5 fluent-progress-track">
              <motion.div className={`license-tier-progress-fill ${licenseTierClass} h-full fluent-progress-fill`} initial={{ width: 0 }} animate={{ width: `${progressValue}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
              <span>FUXI FORENSICS</span>
              {expiresText ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={10} />
                  {expiresText}
                </span>
              ) : (
                <span>{language === "zh" ? "永久授权" : "Lifetime"}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-100/80 bg-white/88 text-[#0078D4] shadow-[0_8px_18px_rgba(0,91,158,0.06)]">
            <Terminal size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{t.servers_title}</h3>
            <div className="text-[11px] font-medium text-slate-500">{t.connected_count.replace("{0}", sessions.length.toString())}</div>
          </div>
        </div>
        <button
          onClick={toggleSelectAll}
          className="rounded-full border border-sky-100/80 bg-white/84 px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-[#0078D4]"
        >
          {selectedSessionIds.length === sessions.length && sessions.length > 0 ? (language === "zh" ? "取消全选" : "Clear") : t.select_all_context}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-[28px] border border-dashed border-sky-200 bg-sky-50/42 p-5 text-center text-slate-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white bg-white/82 text-[#0078D4] shadow-sm">
              <Server size={26} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">{t.no_connections}</p>
            <p className="mt-1 max-w-[180px] text-xs leading-5 text-slate-500">{t.add_server_hint}</p>
            <button onClick={onAddSession} className="ui-button-primary mt-4 px-5 py-2.5 text-xs">
              {t.connect_server_btn}
            </button>
          </div>
        ) : (
          <Reorder.Group axis="y" values={sessions.map((s) => s.id)} onReorder={reorderSessions} className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sessions.map((session) => (
                <Reorder.Item key={session.id} value={session.id} className="list-none">
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

      <footer className="border-t border-sky-100/70 px-5 py-3">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          <span>Control Center</span>
          <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">v{APP_VERSION}</span>
        </div>
      </footer>

      <AnimatePresence>
        {sessionToDelete && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/32 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              className="glass-heavy w-full max-w-[260px] rounded-[28px] p-5"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="rounded-2xl bg-red-50 p-3 text-red-500">
                  <Trash2 size={21} />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-bold text-slate-800">{t.disconnect_confirm_title}</h3>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {t.disconnect_confirm_desc}
                    <br />
                    <span className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-slate-700">
                      {sessionToDeleteObj?.ip}
                    </span>
                  </p>
                </div>
                <div className="mt-1 grid w-full grid-cols-2 gap-2">
                  <button onClick={() => setSessionToDelete(null)} className="ui-button px-3 py-2 text-xs">
                    {t.cancel}
                  </button>
                  <button onClick={confirmDelete} className="ui-button-danger px-3 py-2 text-xs">
                    {t.disconnect}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSwitching && switchingToId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex cursor-wait items-center justify-center bg-white/36 backdrop-blur-[3px]"
          >
            <div className="flex items-center gap-3 rounded-[24px] border border-sky-200/70 bg-white/94 px-4 py-3 shadow-xl">
              <Activity className="animate-spin text-[#0078D4]" size={20} />
              <div className="text-sm font-semibold text-slate-700">
                {language === "zh" ? "正在切换到" : "Switching to"}{" "}
                <span className="font-mono text-[#0078D4]">{sessions.find((s) => s.id === switchingToId)?.ip}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
