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
} from "lucide-react";
import tauriLogo from "../assets/tauri.png";
import { useCommandStore } from "../store/CommandContext";

interface LoginProps {
  onLogin: () => void;
  onClose?: () => void;
}

interface LoginHistoryItem {
  ip: string;
  port: string;
  user: string;
  pass?: string;
  lastUsed: number;
}

export default function Login({ onLogin, onClose }: LoginProps) {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("22");
  const [user, setUser] = useState("root");
  const [pass, setPass] = useState("");
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
      await connectSSH(ip, parseInt(port), user, pass);
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
      className={`relative w-full flex flex-col items-center justify-center ${isModal ? "" : "h-full p-8 bg-[#f5f9ff]"}`}
    >
      {/* Watermark for Login - Only show in full page mode */}
      {!isModal && (
        <div className="watermark-container">
          {Array.from({ length: 50 }).map((_, i) => (
            <span key={i} className="watermark-text">
              SERVER-FORENSICS-ACCESS
            </span>
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 relative">
          {/* Close Button - Only shown if onClose prop is provided */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          )}

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
            FUXI Server Forensics 客户端 v0.1.0
          </p>
        </div>
      </motion.div>
    </div>
  );
}
