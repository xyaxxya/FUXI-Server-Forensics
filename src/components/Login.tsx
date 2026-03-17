import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  User,
  Globe,
  ChevronDown,
  Check,
  Trash2,
  History,
  X,
  SlidersHorizontal,
} from "lucide-react";
import tauriLogo from "../assets/tauri.png";
import { useCommandStore } from "../store/CommandContext";
import { APP_VERSION } from "../config/app";

interface LoginProps {
  onLogin: () => void;
  onClose?: () => void;
  licenseStatus?: LicenseStatus | null;
  updateInfo?: UpdateCheckResult | null;
  onOpenUpdates?: () => void;
}

interface LoginHistoryItem {
  ip: string;
  port: string;
  user: string;
  pass?: string;
  lastUsed: number;
}

interface LicenseStatus {
  valid: boolean;
  message: string;
  machine_code: string;
  expires_at?: number | null;
  nickname?: string | null;
  qq?: string | null;
  avatar?: string | null;
  license_plan?: string | null;
  license_label?: string | null;
}

interface UpdateCheckResult {
  has_update: boolean;
  latest_version: string;
  notes: string;
  force_update: boolean;
}

export default function Login({
  onLogin,
  onClose,
  licenseStatus = null,
  updateInfo = null,
  onOpenUpdates,
}: LoginProps) {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("22");
  const [user, setUser] = useState("root");
  const [pass, setPass] = useState("");
  const [proxyType, setProxyType] = useState<"direct" | "socks5" | "http">("direct");
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState("1080");
  const [proxyUser, setProxyUser] = useState("");
  const [proxyPass, setProxyPass] = useState("");
  const [showProxySettings, setShowProxySettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { connectSSH } = useCommandStore();

  // History & Remember Password State
  const [showHistory, setShowHistory] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [history, setHistory] = useState<LoginHistoryItem[]>([]);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem("ssh_login_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHistory(parsed);
        // Auto-fill last used if available
        if (parsed.length > 0) {
          const last = parsed[0];
          setIp(last.ip);
          setPort(last.port);
          setUser(last.user);
          if (last.pass) {
            setPass(last.pass);
            setRememberPassword(true);
          }
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const avatarSrc =
    licenseStatus?.avatar && licenseStatus.avatar.trim().length > 0
      ? licenseStatus.avatar.startsWith("data:")
        ? licenseStatus.avatar
        : `data:image/png;base64,${licenseStatus.avatar}`
      : "";

  const expiresText =
    licenseStatus?.expires_at && (licenseStatus.license_plan || "").toLowerCase() !== "permanent"
      ? new Date(licenseStatus.expires_at * 1000).toLocaleDateString("zh-CN")
      : "";
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
  const normalizedPlan = normalizePlan(licenseStatus?.license_plan);
  const fallbackLabel =
    normalizedPlan === "permanent"
      ? "永久会员"
      : normalizedPlan === "one_year"
      ? "一年会员"
      : normalizedPlan === "half_year"
      ? "半年会员"
      : "30天会员";
  const planBadgeClass =
    normalizedPlan === "permanent"
      ? "bg-amber-100 text-amber-700 border border-amber-200"
      : normalizedPlan === "one_year"
      ? "bg-violet-100 text-violet-700 border border-violet-200"
      : normalizedPlan === "half_year"
      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
      : "bg-sky-100 text-sky-700 border border-sky-200";
  const planCardClass =
    normalizedPlan === "permanent"
      ? "border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50"
      : normalizedPlan === "one_year"
      ? "border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50"
      : normalizedPlan === "half_year"
      ? "border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50"
      : "border-sky-100 bg-gradient-to-r from-sky-50 to-indigo-50";

  const saveToHistory = () => {
    const newItem: LoginHistoryItem = {
      ip,
      port,
      user,
      pass: rememberPassword ? pass : undefined,
      lastUsed: Date.now(),
    };

    // Filter out duplicates (same ip, port, user)
    const filtered = history.filter(
      (h) => !(h.ip === ip && h.port === port && h.user === user),
    );
    const newHistory = [newItem, ...filtered].slice(0, 10); // Keep top 10

    setHistory(newHistory);
    localStorage.setItem("ssh_login_history", JSON.stringify(newHistory));
  };

  const deleteHistoryItem = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    localStorage.setItem("ssh_login_history", JSON.stringify(newHistory));
  };

  const selectHistoryItem = (item: LoginHistoryItem) => {
    setIp(item.ip);
    setPort(item.port);
    setUser(item.user);
    if (item.pass) {
      setPass(item.pass);
      setRememberPassword(true);
    } else {
      setPass("");
      setRememberPassword(false);
    }
    setShowHistory(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      if (proxyType !== "direct" && (!proxyHost.trim() || !proxyPort.trim())) {
        throw new Error("请填写代理主机与端口");
      }
      const proxy =
        proxyType === "direct"
          ? undefined
          : {
              type: proxyType,
              host: proxyHost,
              port: parseInt(proxyPort, 10),
              username: proxyUser || undefined,
              password: proxyPass || undefined,
            };
      await connectSSH(ip, parseInt(port), user, pass, proxy);
      saveToHistory();
      onLogin();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const isModal = !!onClose;

  return (
    <div
      className={`relative w-full flex flex-col items-center justify-center ${isModal ? "" : "h-full p-8 bg-transparent"}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 relative">
          <button
            onClick={() => setShowProxySettings((v) => !v)}
            className={`absolute top-4 left-4 px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-all ${proxyType === "direct" ? "bg-white/80 border-slate-200 text-slate-500 hover:text-slate-700" : "bg-blue-50 border-blue-200 text-blue-600 hover:text-blue-700"}`}
          >
            <SlidersHorizontal size={14} />
            <span>{proxyType === "direct" ? "代理设置" : `代理: ${proxyType.toUpperCase()}`}</span>
          </button>

          {/* Close Button - Only shown if onClose prop is provided */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          )}

          <AnimatePresence>
            {showProxySettings && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className="absolute top-14 left-4 right-4 rounded-2xl border border-blue-100 bg-white/95 backdrop-blur p-4 shadow-xl z-30"
              >
                <div className="grid grid-cols-3 gap-3">
                  <select
                    value={proxyType}
                    onChange={(e) => setProxyType(e.target.value as "direct" | "socks5" | "http")}
                    className="col-span-1 px-3 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  >
                    <option value="direct">直连</option>
                    <option value="socks5">SOCKS5</option>
                    <option value="http">HTTP代理</option>
                  </select>
                  <input
                    type="text"
                    placeholder="代理主机"
                    value={proxyHost}
                    onChange={(e) => setProxyHost(e.target.value)}
                    disabled={proxyType === "direct"}
                    className="col-span-1 px-3 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    placeholder="代理端口"
                    value={proxyPort}
                    onChange={(e) => setProxyPort(e.target.value)}
                    disabled={proxyType === "direct"}
                    className="col-span-1 px-3 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 disabled:opacity-50 text-center"
                  />
                </div>
                {proxyType !== "direct" && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <input
                      type="text"
                      placeholder="代理用户名(可选)"
                      value={proxyUser}
                      onChange={(e) => setProxyUser(e.target.value)}
                      className="px-3 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <input
                      type="password"
                      placeholder="代理密码(可选)"
                      value={proxyPass}
                      onChange={(e) => setProxyPass(e.target.value)}
                      className="px-3 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                  </div>
                )}
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => setShowProxySettings(false)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    收起
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <motion.img
                src={tauriLogo}
                alt="Logo"
                className="w-32 h-32 object-contain drop-shadow-lg"
                animate={{
                  rotate: [0, 5, 0, -5, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" },
                  scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                }}
              />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">连接服务器</h2>
            <p className="text-slate-500 text-sm mt-1">
              建立初始SSH连接
            </p>
          </div>

          {updateInfo?.has_update && (
            <div className="mb-5 p-3 rounded-2xl border border-blue-200 bg-blue-50/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-blue-800">
                    发现新版本 v{updateInfo.latest_version}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    {updateInfo.force_update ? "该版本为强制更新，请尽快完成升级" : "建议先更新后再进行连接操作"}
                  </div>
                </div>
                <button
                  onClick={() => onOpenUpdates?.()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  去更新
                </button>
              </div>
              {updateInfo.notes && (
                <div className="mt-2 text-xs text-blue-700/90 max-h-16 overflow-auto whitespace-pre-wrap">
                  {updateInfo.notes}
                </div>
              )}
            </div>
          )}

          {licenseStatus?.valid && (
            <div className={`mb-5 p-3 rounded-2xl border ${planCardClass}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-sky-200 bg-white shrink-0">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-sky-600 font-bold">
                      USER
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {licenseStatus.nickname || "授权用户"}
                  </div>
                  <div className="text-xs text-slate-500 truncate">QQ: {licenseStatus.qq || "-"}</div>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${planBadgeClass}`}
                >
                  {licenseStatus.license_label || fallbackLabel}
                </div>
              </div>
              {expiresText && (
                <div className="mt-2 text-xs text-slate-500">到期时间：{expiresText}</div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 relative z-20">
                <Globe
                  className="absolute left-3 top-3.5 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="主机地址"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  onFocus={() => setShowHistory(true)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                />

                {/* History Toggle Button */}
                {history.length > 0 && (
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <ChevronDown
                      size={18}
                      className={`transition-transform duration-200 ${showHistory ? "rotate-180" : ""}`}
                    />
                  </button>
                )}

                {/* History Dropdown */}
                <AnimatePresence>
                  {showHistory && history.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <History size={12} />
                          <span>最近连接</span>
                        </div>
                        {history.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => selectHistoryItem(item)}
                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 group flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-700 text-sm">
                                {item.ip}:{item.port}
                              </span>
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <User size={10} /> {item.user}
                              </span>
                            </div>
                            <button
                              onClick={(e) => deleteHistoryItem(e, index)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="删除记录"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Overlay to close dropdown when clicking outside */}
                {showHistory && (
                  <div
                    className="fixed inset-0 z-[-1]"
                    onClick={() => setShowHistory(false)}
                  />
                )}
              </div>
              <div className="col-span-1 relative">
                <input
                  type="text"
                  placeholder="端口"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 text-center"
                />
              </div>
            </div>

            <div className="relative">
              <User
                className="absolute left-3 top-3.5 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="用户名"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="relative">
              <div className="absolute left-3 top-3.5 text-slate-400">
                <span className="font-mono text-xs font-bold">***</span>
              </div>
              <input
                type="password"
                placeholder="密码"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Remember Password Checkbox */}
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={() => setRememberPassword(!rememberPassword)}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${rememberPassword ? "bg-blue-500 border-blue-500 shadow-sm shadow-blue-500/30" : "bg-white border-slate-300 hover:border-blue-400"}`}
              >
                {rememberPassword && (
                  <Check size={12} className="text-white" strokeWidth={3} />
                )}
              </button>
              <span
                className="text-sm text-slate-600 cursor-pointer select-none"
                onClick={() => setRememberPassword(!rememberPassword)}
              >
                记住密码
              </span>
            </div>

            {proxyType !== "direct" && (
              <div className="px-3 py-2 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-700">
                当前代理: {proxyType.toUpperCase()} {proxyHost}:{proxyPort}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 text-red-500 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>连接</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <button
              onClick={onLogin}
              className="w-full py-3.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 rounded-xl font-medium transition-all flex items-center justify-center gap-2 mt-3"
            >
              <span>直接进入主界面</span>
            </button>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-slate-400 text-xs">
            FUXI Server Forensics 客户端 v{APP_VERSION}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
