import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Globe, Bot, Settings, Sparkles, ChevronDown, FolderSearch, LoaderCircle, RotateCw, BadgeCheck, Zap, CheckCircle, XCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { translations, Language } from "../translations";
import { AISettings, DEFAULT_SETTINGS } from "../lib/ai";
import { loadPentestToolPaths, savePentestToolPaths } from "../lib/pentestSettings";
import { APP_VERSION } from "../config/app";
import { testAIConnection, ValidationResult } from "../lib/aiValidator";
import { useToast } from "./Toast";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialActiveTab?: "general" | "tools" | "updates" | "ai";
  language: Language;
  onLanguageChange: (lang: Language) => void;
  aiSettings: AISettings;
  onAiSettingsChange: (settings: AISettings) => void;
  isStarryMode: boolean;
  onStarryModeChange: (enabled: boolean) => void;
  initialUpdateInfo?: UpdateCheckResult | null;
}

interface UpdateCheckResult {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  download_url: string;
  package_sha256: string;
  manifest_signature: string;
  notes: string;
  min_supported_version: string;
  force_update: boolean;
  channel: string;
  message: string;
}

interface UpdateProgressPayload {
  stage: string;
  percentage: number;
  downloaded: number;
  total: number;
  message: string;
}

export default function SettingsModal({
  isOpen,
  onClose,
  initialActiveTab = "general",
  language,
  onLanguageChange,
  aiSettings,
  onAiSettingsChange,
  isStarryMode,
  onStarryModeChange,
  initialUpdateInfo = null,
}: SettingsModalProps) {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<"general" | "tools" | "updates" | "ai">(initialActiveTab);
  const [pentestPaths, setPentestPaths] = useState(() => loadPentestToolPaths());
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(initialUpdateInfo);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgressPayload | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showLatestDialog, setShowLatestDialog] = useState(false);
  const [latestDialogText, setLatestDialogText] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ValidationResult | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (initialUpdateInfo) {
      setUpdateInfo(initialUpdateInfo);
      if (initialUpdateInfo.has_update && initialUpdateInfo.latest_version) {
        setUpdateMessage(initialUpdateInfo.message || `发现新版本 v${initialUpdateInfo.latest_version}`);
      } else {
        setUpdateMessage(`当前已是最新版本 v${APP_VERSION}`);
      }
    }
  }, [initialUpdateInfo]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialActiveTab);
  }, [isOpen, initialActiveTab]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<UpdateProgressPayload>("client-update-progress", (event) => {
      setUpdateProgress(event.payload);
      setUpdateMessage(event.payload.message || "");
      if (event.payload.stage === "cancelled") {
        setIsUpdating(false);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const updatePentestPath = (
    key: "fscan" | "fscanExe" | "kscan" | "kscanExe",
    value: string
  ) => {
    const next = { ...pentestPaths, [key]: value };
    setPentestPaths(next);
    savePentestToolPaths(next);
  };

  const showLatestVersionDialog = () => {
    const text =
      language === "zh"
        ? `当前已是最新版本 v${APP_VERSION}`
        : `You are already on the latest version v${APP_VERSION}`;
    setLatestDialogText(text);
    setShowLatestDialog(true);
  };

  const checkUpdate = async () => {
    if (isUpdating) return;
    setIsCheckingUpdate(true);
    setIsRestarting(false);
    setUpdateLoading(true);
    setUpdateMessage("");
    setUpdateProgress(null);
    try {
      const data = await invoke<UpdateCheckResult>("check_client_update", {
        currentVersion: APP_VERSION,
      });
      setUpdateInfo(data);
      if (data.has_update && data.latest_version) {
        setUpdateMessage(`发现新版本 v${data.latest_version}，可立即更新`);
      } else {
        setUpdateMessage(`当前已是最新版本 v${APP_VERSION}`);
        showLatestVersionDialog();
      }
    } catch (e: any) {
      setUpdateMessage(`检查更新失败: ${e?.message || e?.toString()}`);
    } finally {
      setIsCheckingUpdate(false);
      setUpdateLoading(false);
    }
  };

  const openUpdateUrl = async () => {
    if (isCheckingUpdate) return;
    setIsRestarting(false);
    setIsUpdating(true);
    setUpdateLoading(true);
    setUpdateProgress({
      stage: "download",
      percentage: 0,
      downloaded: 0,
      total: 0,
      message: "准备下载更新包",
    });
    let shouldShowRestart = false;
    try {
      const checked = await invoke<UpdateCheckResult>("check_client_update", {
        currentVersion: APP_VERSION,
      });
      setUpdateInfo(checked);
      let target = checked;
      if (!target?.download_url || !target?.latest_version || !target?.has_update) {
        setUpdateMessage(`当前已是最新版本 v${APP_VERSION}`);
        showLatestVersionDialog();
        setUpdateProgress(null);
        setIsUpdating(false);
        return;
      }
      await invoke<string>("perform_client_update", {
        downloadUrl: target.download_url,
        version: target.latest_version,
        packageSha256: target.package_sha256,
      });
      shouldShowRestart = true;
      setIsRestarting(true);
      setUpdateProgress({
        stage: "restart",
        percentage: 100,
        downloaded: updateProgress?.downloaded || 0,
        total: updateProgress?.total || 0,
        message: "更新完成，正在退出并重启",
      });
      setUpdateMessage("更新完成，正在优雅重启，请稍候...");
    } catch (e: any) {
      setIsRestarting(false);
      setUpdateMessage(`更新失败: ${e?.message || e?.toString()}`);
    } finally {
      setIsUpdating(false);
      if (!shouldShowRestart) {
        setIsRestarting(false);
      }
      setUpdateLoading(false);
    }
  };

  const cancelUpdate = async () => {
    if (!isUpdating) return;
    try {
      await invoke<string>("cancel_client_update");
      setUpdateMessage("已取消更新下载");
      setIsRestarting(false);
      setUpdateProgress(null);
    } catch (e: any) {
      setUpdateMessage(`取消更新失败: ${e?.message || e?.toString()}`);
    } finally {
      setIsUpdating(false);
      setUpdateLoading(false);
    }
  };

  // Local state for AI settings to avoid constant re-renders/writes during typing
  // We commit changes only when specific fields blur or when saving? 
  // For simplicity in this app, we can update parent directly or use a local buffer.
  // Let's use direct updates for now as it was in GeneralAgent.

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between bg-white">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Settings size={24} />
              </div>
              {t.settings}
            </h2>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden bg-slate-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 p-6 space-y-2">
              <button
                onClick={() => setActiveTab("general")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "general"
                    ? "bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Globe size={20} />
                {t.general_settings}
              </button>
              <button
                onClick={() => setActiveTab("tools")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "tools"
                    ? "bg-emerald-50 text-emerald-600 shadow-sm ring-1 ring-emerald-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <FolderSearch size={20} />
                {language === "zh" ? "渗透工具" : "Pentest Tools"}
              </button>
              <button
                onClick={() => setActiveTab("ai")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "ai"
                    ? "bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Bot size={20} />
                {t.ai_settings}
              </button>
              <button
                onClick={() => setActiveTab("updates")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "updates"
                    ? "bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Sparkles size={20} />
                {language === "zh" ? "客户端更新" : "Client Updates"}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
              <div className="max-w-3xl mx-auto">
                {activeTab === "general" && (
                  <div className="space-y-8 animate-fade-in">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Globe className="text-blue-500" size={24} />
                        {t.language}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                          onClick={() => onLanguageChange("en")}
                          className={`group relative flex items-center p-6 rounded-2xl border-2 transition-all duration-200 ${
                            language === "en"
                              ? "border-blue-500 bg-white shadow-lg shadow-blue-500/10"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md"
                          }`}
                        >
                          <div className="flex-1 text-left">
                            <span className="block text-lg font-bold text-slate-800 mb-1">English</span>
                            <span className="text-sm text-slate-500">English Language</span>
                          </div>
                          {language === "en" && (
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                              <Settings size={14} className="opacity-0" /> {/* Just for spacing */}
                              <div className="w-2.5 h-2.5 bg-white rounded-full" />
                            </div>
                          )}
                        </button>
                        <button
                          onClick={() => onLanguageChange("zh")}
                          className={`group relative flex items-center p-6 rounded-2xl border-2 transition-all duration-200 ${
                            language === "zh"
                              ? "border-blue-500 bg-white shadow-lg shadow-blue-500/10"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md"
                          }`}
                        >
                          <div className="flex-1 text-left">
                            <span className="block text-lg font-bold text-slate-800 mb-1">简体中文</span>
                            <span className="text-sm text-slate-500">Chinese Language</span>
                          </div>
                          {language === "zh" && (
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                              <div className="w-2.5 h-2.5 bg-white rounded-full" />
                            </div>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Starry Mode Section */}
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Sparkles className="text-purple-500" size={24} />
                        {t.appearance}
                      </h3>
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex items-center justify-between">
                         <div>
                           <h4 className="font-bold text-slate-800 text-lg mb-1">{t.starry_mode}</h4>
                           <p className="text-slate-500 text-sm">{t.starry_mode_desc}</p>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={isStarryMode}
                              onChange={(e) => onStarryModeChange(e.target.checked)}
                            />
                            <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                         </label>
                      </div>
                    </div>

                  </div>
                )}

                {activeTab === "tools" && (
                  <div className="space-y-8 animate-fade-in">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <FolderSearch className="text-emerald-500" size={24} />
                        {language === "zh" ? "渗透工具路径" : "Pentest Tool Paths"}
                      </h3>
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">fscan (Linux)</label>
                          <input
                            type="text"
                            value={pentestPaths.fscan}
                            onChange={(e) => updatePentestPath("fscan", e.target.value)}
                            placeholder={language === "zh" ? "例如: D:\\tools\\fscan" : "e.g. D:\\tools\\fscan"}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">fscan.exe (Windows)</label>
                          <input
                            type="text"
                            value={pentestPaths.fscanExe}
                            onChange={(e) => updatePentestPath("fscanExe", e.target.value)}
                            placeholder={language === "zh" ? "例如: D:\\tools\\fscan.exe" : "e.g. D:\\tools\\fscan.exe"}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">kscan (Linux)</label>
                          <input
                            type="text"
                            value={pentestPaths.kscan}
                            onChange={(e) => updatePentestPath("kscan", e.target.value)}
                            placeholder={language === "zh" ? "例如: D:\\tools\\kscan" : "e.g. D:\\tools\\kscan"}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">kscan.exe (Windows)</label>
                          <input
                            type="text"
                            value={pentestPaths.kscanExe}
                            onChange={(e) => updatePentestPath("kscanExe", e.target.value)}
                            placeholder={language === "zh" ? "例如: D:\\tools\\kscan.exe" : "e.g. D:\\tools\\kscan.exe"}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono text-sm"
                          />
                        </div>
                        <div className="text-xs text-slate-500">
                          {language === "zh"
                            ? "路径会自动保存到本地，上传 fscan/kscan 时会按目标系统自动选择对应文件。"
                            : "Paths are persisted locally and auto-selected by target OS during upload."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "updates" && (
                  <div className="space-y-8 animate-fade-in">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Sparkles className="text-orange-500" size={24} />
                        {language === "zh" ? "客户端更新" : "Client Updates"}
                      </h3>
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">{language === "zh" ? "当前版本" : "Current Version"}</span>
                          <span className="font-semibold text-slate-800">v{APP_VERSION}</span>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={checkUpdate}
                            disabled={updateLoading || isUpdating || isRestarting}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium disabled:opacity-70"
                          >
                            {isCheckingUpdate
                              ? language === "zh"
                                ? "检查中"
                                : "Checking"
                              : language === "zh"
                              ? "检查更新"
                              : "Check Update"}
                          </button>
                          <button
                            onClick={openUpdateUrl}
                            disabled={updateLoading || isCheckingUpdate || isRestarting}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-70"
                          >
                            {language === "zh" ? "立即更新" : "Update Now"}
                          </button>
                          <AnimatePresence>
                            {isUpdating && (
                              <motion.button
                                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                onClick={cancelUpdate}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
                              >
                                {language === "zh" ? "取消下载" : "Cancel Download"}
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                        <AnimatePresence>
                          {isCheckingUpdate && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex items-center gap-3 text-sm text-slate-600">
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                                >
                                  <LoaderCircle size={18} className="text-blue-500" />
                                </motion.div>
                                <motion.span
                                  animate={{ opacity: [0.55, 1, 0.55] }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                >
                                  正在连接更新服务并检查新版本...
                                </motion.span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {(isUpdating || isRestarting) && updateProgress && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                              <span className="flex items-center gap-2">
                                <motion.span
                                  animate={{ rotate: isRestarting ? [0, 0] : [0, 360] }}
                                  transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
                                >
                                  <RotateCw size={14} className={isRestarting ? "text-emerald-500" : "text-blue-500"} />
                                </motion.span>
                                {updateProgress?.message || "准备更新..."}
                              </span>
                              <span>{Math.max(0, Math.min(100, updateProgress?.percentage || 0)).toFixed(1)}%</span>
                            </div>
                            <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200">
                              <motion.div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(2, Math.min(100, updateProgress?.percentage || 0))}%`,
                                  background:
                                    "linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(99,102,241,1) 38%, rgba(168,85,247,1) 68%, rgba(236,72,153,1) 100%)",
                                  backgroundSize: "240% 100%",
                                }}
                                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                              />
                              <motion.div
                                className="absolute top-0 h-full w-14 -translate-x-16 bg-white/40 blur-[4px]"
                                animate={{ x: ["0%", "560%"] }}
                                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                              />
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500">
                              {updateProgress.total > 0
                                ? `${(updateProgress.downloaded / 1024 / 1024).toFixed(2)} MB / ${(updateProgress.total / 1024 / 1024).toFixed(2)} MB`
                                : `${(updateProgress.downloaded / 1024 / 1024).toFixed(2)} MB`}
                            </div>
                          </motion.div>
                        )}
                        <AnimatePresence>
                          {isRestarting && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.96, y: 8 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96, y: -8 }}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                            >
                              <div className="flex items-center gap-3 text-emerald-700 text-sm">
                                <motion.div
                                  className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                                />
                                <span>更新包已完成部署，客户端正在退出并平滑重启...</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {updateInfo?.latest_version && (
                          <div className="text-sm text-slate-600">
                            {language === "zh" ? "最新版本" : "Latest Version"}:{" "}
                            <span className="font-semibold text-slate-800">{updateInfo.latest_version}</span>
                          </div>
                        )}
                        {updateInfo && (
                          <div className="text-xs text-slate-500 space-y-1">
                            <div>
                              {language === "zh" ? "渠道" : "Channel"}: {updateInfo.channel || "stable"}
                            </div>
                            <div>
                              {language === "zh" ? "最小支持版本" : "Min Supported"}:{" "}
                              {updateInfo.min_supported_version || "-"}
                            </div>
                            <div>
                              {language === "zh" ? "更新策略" : "Policy"}:{" "}
                              {updateInfo.force_update
                                ? language === "zh"
                                  ? "强制更新"
                                  : "Force Update"
                                : language === "zh"
                                ? "可选更新"
                                : "Optional"}
                            </div>
                          </div>
                        )}
                        {updateInfo?.notes && (
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600 whitespace-pre-wrap">
                            {updateInfo.notes}
                          </div>
                        )}
                        {updateMessage && <div className="text-sm text-slate-600">{updateMessage}</div>}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "ai" && (
                  <div className="space-y-8 animate-fade-in">
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                           <Bot className="text-indigo-500" size={28} />
                           {t.ai_settings}
                        </h3>
                        <p className="text-slate-500">确认你的 AI 模型与 API 密钥</p>
                      </div>
                    </div>

                    {/* Enable Planning Mode Toggle */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                              <Sparkles size={16} className="text-indigo-600" />
                              {t.enable_planning}
                            </h4>
                            <p className="text-xs text-indigo-700/70 mt-1 whitespace-pre-line">
                              {t.enable_planning_desc}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={aiSettings.enablePlanning || false}
                              onChange={(e) => onAiSettingsChange({
                                ...aiSettings,
                                enablePlanning: e.target.checked
                              })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                            <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2 mb-2">
                              <Settings size={16} className="text-indigo-600" />
                              {t.max_loops}
                            </h4>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="5" 
                                    max="500" 
                                    step="1"
                                    value={aiSettings.maxLoops || 25}
                                    onChange={(e) => onAiSettingsChange({
                                        ...aiSettings,
                                        maxLoops: parseInt(e.target.value)
                                    })}
                                    className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-100 min-w-[3rem] text-center">
                                    {aiSettings.maxLoops || 25}
                                </span>
                            </div>
                            <p className="text-xs text-indigo-700/70 mt-2">
                                {t.max_loops_desc}
                            </p>
                        </div>
                    </div>

                    {/* Max Tokens Slider */}
                    <div className="mb-8">
                        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                            <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2 mb-2">
                              <Settings size={16} className="text-indigo-600" />
                              {t.max_tokens}
                            </h4>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="1000" 
                                    max="128000" 
                                    step="1000"
                                    value={aiSettings.maxTokens || 32768}
                                    onChange={(e) => onAiSettingsChange({
                                        ...aiSettings,
                                        maxTokens: parseInt(e.target.value)
                                    })}
                                    className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-100 min-w-[4rem] text-center">
                                    {aiSettings.maxTokens || 32768}
                                </span>
                            </div>
                            <p className="text-xs text-indigo-700/70 mt-2">
                                {t.max_tokens_desc}
                            </p>
                        </div>
                    </div>

                    {/* Max Concurrent Tasks Slider */}
                    <div className="mb-8">
                        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                            <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2 mb-2">
                              <Settings size={16} className="text-indigo-600" />
                              {t.max_concurrent}
                            </h4>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    step="1"
                                    value={aiSettings.maxConcurrentTasks || 3}
                                    onChange={(e) => onAiSettingsChange({
                                        ...aiSettings,
                                        maxConcurrentTasks: parseInt(e.target.value)
                                    })}
                                    className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-100 min-w-[3rem] text-center">
                                    {aiSettings.maxConcurrentTasks || 3}
                                </span>
                            </div>
                            <p className="text-xs text-indigo-700/70 mt-2">
                                {t.max_concurrent_desc}
                            </p>
                        </div>
                    </div>

                    {/* Provider Selection Dropdown */}
                    <div className="mb-8">
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        {language === 'zh' ? 'AI 模型服务商' : 'AI Provider'}
                      </label>
                      <div className="relative group">
                        <select
                          value={aiSettings.activeProvider}
                          onChange={(e) =>
                            onAiSettingsChange({
                              ...aiSettings,
                              activeProvider: e.target.value as any,
                            })
                          }
                          className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-3.5 px-4 pr-10 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium cursor-pointer hover:border-indigo-300 shadow-sm"
                        >
                          {(["fuxi", "zhipu", "openai", "qwen", "claude", "kimi", "gemini", "ollama"] as const).map(
                            (provider) => (
                              <option key={provider} value={provider}>
                                {aiSettings.configs[provider]?.name || provider}
                              </option>
                            )
                          )}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 group-hover:text-indigo-500 transition-colors">
                          <ChevronDown size={20} />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
                      {aiSettings.activeProvider !== 'fuxi' && (
                        <>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                              {t.api_endpoint}
                            </label>
                            <input
                              type="text"
                              value={
                                aiSettings.configs[aiSettings.activeProvider].baseUrl
                              }
                              onChange={(e) =>
                                onAiSettingsChange({
                                  ...aiSettings,
                                  configs: {
                                    ...aiSettings.configs,
                                    [aiSettings.activeProvider]: {
                                      ...aiSettings.configs[aiSettings.activeProvider],
                                      baseUrl: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm"
                              placeholder={
                                DEFAULT_SETTINGS.configs[aiSettings.activeProvider]
                                  .baseUrl
                              }
                            />
                            <p className="mt-2 text-xs text-slate-400">{t.api_url_help}</p>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                              {t.api_key}
                            </label>
                            <input
                              type="password"
                              value={aiSettings.configs[aiSettings.activeProvider].apiKey}
                              onChange={(e) =>
                                onAiSettingsChange({
                                  ...aiSettings,
                                  configs: {
                                    ...aiSettings.configs,
                                    [aiSettings.activeProvider]: {
                                      ...aiSettings.configs[aiSettings.activeProvider],
                                      apiKey: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm"
                              placeholder={`${aiSettings.configs[aiSettings.activeProvider].name} API Key`}
                            />
                            <p className="mt-2 text-xs text-slate-400">{t.api_key_help}</p>
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          {t.model_name}
                        </label>
                        <input
                          type="text"
                          disabled={aiSettings.activeProvider === 'fuxi'}
                          value={aiSettings.configs[aiSettings.activeProvider].model}
                          onChange={(e) =>
                            onAiSettingsChange({
                              ...aiSettings,
                              configs: {
                                ...aiSettings.configs,
                                [aiSettings.activeProvider]: {
                                  ...aiSettings.configs[aiSettings.activeProvider],
                                  model: e.target.value,
                                },
                              },
                            })
                          }
                          className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm ${aiSettings.activeProvider === 'fuxi' ? 'opacity-60 cursor-not-allowed' : ''}`}
                          placeholder={
                            DEFAULT_SETTINGS.configs[aiSettings.activeProvider]
                              .model
                          }
                        />
                        <p className="mt-2 text-xs text-slate-400">
                          {aiSettings.activeProvider === 'fuxi' ? (language === 'zh' ? '内置免费模型，不可更改' : 'Built-in free model, cannot be changed') : t.model_name_help}
                        </p>
                      </div>
                    </div>

                    {/* Test Connection Button */}
                    <div className="mb-8">
                      <button
                        onClick={async () => {
                          setIsTestingConnection(true);
                          setTestResult(null);
                          try {
                            const result = await testAIConnection(
                              aiSettings.activeProvider,
                              aiSettings
                            );
                            setTestResult(result);
                            if (result.success) {
                              showToast('success', result.message, 3000);
                            } else {
                              showToast('error', result.message, 4000);
                            }
                          } catch (e) {
                            const errorResult = {
                              success: false,
                              message: `测试失败: ${String(e)}`
                            };
                            setTestResult(errorResult);
                            showToast('error', errorResult.message, 4000);
                          } finally {
                            setIsTestingConnection(false);
                          }
                        }}
                        disabled={isTestingConnection || !aiSettings.configs[aiSettings.activeProvider].apiKey}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTestingConnection ? (
                          <>
                            <LoaderCircle size={18} className="animate-spin" />
                            <span>{language === 'zh' ? '测试中...' : 'Testing...'}</span>
                          </>
                        ) : (
                          <>
                            <Zap size={18} />
                            <span>{language === 'zh' ? '测试 API 连接' : 'Test API Connection'}</span>
                          </>
                        )}
                      </button>

                      {/* Test Result Display */}
                      <AnimatePresence>
                        {testResult && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${
                              testResult.success
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className={testResult.success ? 'text-emerald-600' : 'text-red-600'}>
                              {testResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                            </div>
                            <div className="flex-1">
                              <div className={`text-sm font-semibold ${testResult.success ? 'text-emerald-900' : 'text-red-900'}`}>
                                {testResult.success ? (language === 'zh' ? '连接成功' : 'Connection Successful') : (language === 'zh' ? '连接失败' : 'Connection Failed')}
                              </div>
                              <div className={`text-xs mt-1 ${testResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                {testResult.message}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Token Usage Display */}
                    <div className="mb-8">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                                <Bot size={16} className="text-slate-600" />
                                {language === 'zh' ? 'Token 用量统计 (本次会话)' : 'Session Token Usage'}
                            </h4>
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="bg-white p-3 rounded-lg border border-slate-100 text-center shadow-sm">
                                    <div className="text-xs text-slate-500 font-medium mb-1">Prompt Tokens</div>
                                    <div className="font-mono font-bold text-indigo-600 text-lg">{aiSettings.tokenUsage?.prompt_tokens || 0}</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-slate-100 text-center shadow-sm">
                                    <div className="text-xs text-slate-500 font-medium mb-1">Completion Tokens</div>
                                    <div className="font-mono font-bold text-emerald-600 text-lg">{aiSettings.tokenUsage?.completion_tokens || 0}</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-slate-100 text-center shadow-sm">
                                    <div className="text-xs text-slate-500 font-medium mb-1">Total Tokens</div>
                                    <div className="font-mono font-bold text-slate-800 text-lg">{aiSettings.tokenUsage?.total_tokens || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
        <AnimatePresence>
          {showLatestDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4"
              onClick={() => setShowLatestDialog(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="relative w-full max-w-md overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-sky-200/40 blur-2xl" />
                <div className="absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-indigo-200/40 blur-2xl" />
                <div className="relative p-6">
                  <div className="flex items-start justify-between">
                    <motion.div
                      className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/30"
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <BadgeCheck size={24} />
                    </motion.div>
                    <button
                      onClick={() => setShowLatestDialog(false)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 text-lg font-bold text-slate-800">
                    {language === "zh" ? "版本已是最新" : "Already Up To Date"}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {latestDialogText}
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button
                      onClick={() => setShowLatestDialog(false)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-sm font-medium shadow-lg shadow-sky-500/30 hover:shadow-sky-500/40"
                    >
                      {language === "zh" ? "知道了" : "Got It"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
