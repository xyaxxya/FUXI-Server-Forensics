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
  Server,
  Lock,
  Cpu,
  ShieldCheck,
  Wifi,
  Scan
} from "lucide-react";
import tauriLogo from "../assets/tauri.png";
import { useCommandStore } from "../store/CommandContext";
import { APP_VERSION } from "../config/app";

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

const WorldMap = () => (
    <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" viewBox="0 0 1000 500">
        <path d="M50,200 Q100,100 200,200 T400,200 T600,200 T800,200 T950,200" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M100,100 L100,400 M300,100 L300,400 M500,100 L500,400 M700,100 L700,400 M900,100 L900,400" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5,5" />
        <circle cx="200" cy="200" r="5" fill="currentColor" />
        <circle cx="500" cy="300" r="5" fill="currentColor" />
        <circle cx="800" cy="150" r="5" fill="currentColor" />
    </svg>
);

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
      className={`relative w-full flex flex-col items-center justify-center ${isModal ? "" : "h-full p-8 bg-transparent"}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.8, delay: isModal ? 0 : 0.2, ease: "easeOut" }} 
        className="w-full max-w-md relative z-10"
      >
        {/* Tech Card Container */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-1 shadow-[0_20px_60px_-15px_rgba(14,165,233,0.15)] border border-white/60 relative overflow-hidden group">
            
            <WorldMap />

            {/* Animated Border Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
            
            {/* Inner Content */}
            <div className="bg-white/80 rounded-[20px] p-8 relative z-10 h-full">
                
                {/* Decorative Tech Lines */}
                <div className="absolute top-4 left-4 w-8 h-[1px] bg-sky-200" />
                <div className="absolute top-4 left-4 w-[1px] h-8 bg-sky-200" />
                <div className="absolute bottom-4 right-4 w-8 h-[1px] bg-sky-200" />
                <div className="absolute bottom-4 right-4 w-[1px] h-8 bg-sky-200" />

                {/* Close Button */}
                {onClose && (
                    <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"
                    >
                    <X size={20} />
                    </button>
                )}

                <div className="text-center mb-8 relative">
                    <div className="flex justify-center mb-6 relative">
                    <motion.div
                        className="relative z-10"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-75" />
                        <img
                            src={tauriLogo}
                            alt="Logo"
                            className="w-20 h-20 object-contain relative z-10 drop-shadow-md"
                        />
                        {/* Orbiting ring */}
                        <motion.div 
                            className="absolute -inset-4 border border-dashed border-sky-300 rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        />
                    </motion.div>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
                        <Scan size={24} className="text-sky-500" />
                        SECURE ACCESS
                    </h2>
                    <p className="text-slate-500 text-xs mt-1.5 font-mono tracking-wide uppercase">
                        FUXI Server Forensics
                    </p>
                </div>

                <div className="space-y-5">
                    <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-3 relative z-20 group/input">
                        <Globe
                        className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors"
                        size={18}
                        />
                        <input
                        type="text"
                        placeholder="HOST / IP"
                        value={ip}
                        onChange={(e) => setIp(e.target.value)}
                        onFocus={() => setShowHistory(true)}
                        className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 placeholder:font-mono"
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
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.98 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden z-50"
                            >
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <History size={10} />
                                <span>Recent Sessions</span>
                                </div>
                                {history.map((item, index) => (
                                <div
                                    key={index}
                                    onClick={() => selectHistoryItem(item)}
                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 group flex items-center justify-between transition-colors"
                                >
                                    <div className="flex flex-col">
                                    <span className="font-mono text-slate-700 text-sm font-medium">
                                        {item.ip}:{item.port}
                                    </span>
                                    <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                        <User size={10} /> {item.user}
                                    </span>
                                    </div>
                                    <button
                                    onClick={(e) => deleteHistoryItem(e, index)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Remove"
                                    >
                                    <Trash2 size={14} />
                                    </button>
                                </div>
                                ))}
                            </div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                        
                        {/* Backdrop for history */}
                        {showHistory && (
                        <div className="fixed inset-0 z-[-1]" onClick={() => setShowHistory(false)} />
                        )}
                    </div>
                    
                    <div className="col-span-1 relative group/input">
                        <div className="absolute inset-0 bg-slate-50 border border-slate-200 rounded-xl pointer-events-none group-focus-within/input:border-blue-500 group-focus-within/input:ring-4 group-focus-within/input:ring-blue-500/10 transition-all" />
                        <input
                        type="text"
                        placeholder="22"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        className="w-full px-2 py-3 bg-transparent relative z-10 text-center text-slate-700 font-mono text-sm focus:outline-none placeholder:text-slate-400"
                        />
                    </div>
                    </div>

                    <div className="relative group/input">
                    <User
                        className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="USERNAME"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 placeholder:font-mono"
                    />
                    </div>

                    <div className="relative group/input">
                    <Lock
                        className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors"
                        size={18}
                    />
                    <input
                        type="password"
                        placeholder="PASSWORD"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 placeholder:font-mono"
                    />
                    </div>

                    {/* Remember Password Checkbox */}
                    <div className="flex items-center gap-2 px-1">
                    <button
                        onClick={() => setRememberPassword(!rememberPassword)}
                        className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all duration-200 ${rememberPassword ? "bg-blue-500 border-blue-500 shadow-sm shadow-blue-500/30" : "bg-white border-slate-300 hover:border-blue-400"}`}
                    >
                        <motion.div
                        initial={false}
                        animate={{ scale: rememberPassword ? 1 : 0 }}
                        >
                            <Check size={12} className="text-white" strokeWidth={3} />
                        </motion.div>
                    </button>
                    <span
                        className="text-xs font-medium text-slate-500 cursor-pointer select-none hover:text-slate-800 transition-colors uppercase tracking-wide"
                        onClick={() => setRememberPassword(!rememberPassword)}
                    >
                        Remember Credentials
                    </span>
                    </div>

                    {/* Error Message */}
                    <AnimatePresence>
                        {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-3 bg-red-50 text-red-600 text-xs font-mono rounded-xl border border-red-100 flex items-center gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                                <span className="font-medium break-all">{error}</span>
                            </div>
                        </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2 active:scale-[0.98] group relative overflow-hidden"
                    >
                      {/* Button Shine Effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
                      
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                        <span className="tracking-wide">INITIATE CONNECTION</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                    </button>

                    {!isModal && (
                        <button
                        onClick={onLogin}
                        className="w-full py-3.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-medium transition-all flex items-center justify-center gap-2 mt-3 text-xs uppercase tracking-wide"
                        >
                        <span>Demo Mode (Offline)</span>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* System Status Indicators */}
        <div className="flex justify-between mt-8 px-4 opacity-60">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <Wifi size={12} className="text-green-500" />
                <span>NET: ONLINE</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <ShieldCheck size={12} className="text-blue-500" />
                <span>SEC: ACTIVE</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <Cpu size={12} className="text-purple-500" />
                <span>CPU: READY</span>
            </div>
        </div>
      </motion.div>
    </div>
  );
}