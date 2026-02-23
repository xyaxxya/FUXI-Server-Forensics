import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { 
  Shield, Terminal, Database, Lock, Cpu, Globe, Zap, 
  Activity, Hexagon, Scan, Server, Radio, Crosshair, 
  Wifi, Search, Key, Code, Layers, Binary, Aperture,
  Command, Box, Fingerprint
} from "lucide-react";
import tauriLogo from "../assets/tauri.png";

interface IntroProps {
  onComplete: () => void;
}

// --- CONFIGURATION ---
const CYBER_BLUE = "#0ea5e9"; // sky-500
const CYBER_CYAN = "#06b6d4"; // cyan-500
const CYBER_VIOLET = "#8b5cf6"; // violet-500
const TEXT_COLOR = "#334155"; // slate-700

// Generate random hex data
const generateHex = (length: number) => {
  let result = '';
  const characters = '0123456789ABCDEF';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// --- COMPONENTS ---

// 1. Matrix Rain / Data Stream (Canvas)
const DataStreamCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const fontSize = 14;
    const columns = Math.ceil(width / fontSize);
    const drops: number[] = [];
    
    // Initialize drops
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100; // Start above screen
    }

    const chars = "010101XYZABCDEFGHIJKLMNOPQRSTUV";

    const draw = () => {
      // Fade out effect (white with opacity)
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        
        // Randomly color some characters
        if (Math.random() > 0.98) {
             ctx.fillStyle = CYBER_CYAN;
        } else if (Math.random() > 0.95) {
             ctx.fillStyle = CYBER_BLUE;
        } else {
             ctx.fillStyle = "#cbd5e1"; // slate-300
        }

        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-40 pointer-events-none" />;
};

// 2. Complex SVG Reactor Core
const ReactorCore = () => {
  return (
    <div className="relative flex items-center justify-center w-[600px] h-[600px]">
      {/* Outer Rotating Scale Ring - SLOW ROTATION REMOVED, NOW STATIC OR PULSING */}
      <motion.div
        className="absolute inset-0 border border-slate-200/60 rounded-full"
        style={{ borderStyle: "dashed", borderWidth: "1px" }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {[...Array(12)].map((_, i) => (
            <div 
                key={i} 
                className="absolute w-2 h-2 bg-slate-300 rounded-full"
                style={{ 
                    top: "50%", 
                    left: "50%", 
                    transform: `rotate(${i * 30}deg) translate(295px) translate(-50%, -50%)` 
                }} 
            />
        ))}
      </motion.div>

      {/* Middle Tech Ring - STATIC WITH PULSE */}
      <motion.div
        className="absolute w-[450px] h-[450px] border-[2px] border-sky-100 rounded-full flex items-center justify-center"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 border-t-2 border-sky-400/30 rounded-full" />
        <div className="absolute inset-0 border-b-2 border-sky-400/30 rounded-full" />
        
        {/* Orbiting Elements - STILL ORBITING BUT SLOWER */}
        <motion.div 
            className="absolute top-0 w-4 h-4 bg-sky-500 rounded-full shadow-[0_0_15px_rgba(14,165,233,0.6)]"
            style={{ offsetPath: "path('M 225 0 A 225 225 0 1 1 224.9 0 Z')" }} 
            animate={{ offsetDistance: "100%" }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

      {/* Inner Hexagon Field - STATIC */}
      <motion.div
        className="absolute w-[300px] h-[300px] flex items-center justify-center"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full text-sky-200/50 fill-none stroke-current stroke-[0.5]">
             <polygon points="50 0, 95 25, 95 75, 50 100, 5 75, 5 25" />
             <line x1="50" y1="0" x2="50" y2="100" />
             <line x1="95" y1="25" x2="5" y2="75" />
             <line x1="95" y1="75" x2="5" y2="25" />
        </svg>
      </motion.div>

      {/* Core Energy Ball */}
      <motion.div
         className="absolute w-32 h-32 rounded-full bg-gradient-to-tr from-sky-400 to-cyan-300 blur-md opacity-20"
         animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
         transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Central Logo Container */}
      <motion.div
         className="relative z-20 w-24 h-24 bg-white shadow-[0_0_40px_rgba(14,165,233,0.3)] rounded-2xl flex items-center justify-center border border-sky-100"
         initial={{ scale: 0 }}
         animate={{ scale: 1 }}
         transition={{ duration: 1, type: "spring" }}
      >
         <img src={tauriLogo} alt="Core" className="w-12 h-12 object-contain" />
         
         {/* Scanning Overlay on Logo */}
         <motion.div 
            className="absolute inset-0 bg-gradient-to-b from-transparent via-sky-400/20 to-transparent z-30"
            animate={{ top: ["-100%", "200%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
         />
      </motion.div>
    </div>
  );
};

// 3. Glitch Text Component
const GlitchText = ({ text, className = "" }: { text: string, className?: string }) => {
  return (
    <div className={`relative inline-block ${className}`}>
      <span className="relative z-10">{text}</span>
      <motion.span
        className="absolute top-0 left-0 -z-10 text-red-500 opacity-70"
        animate={{ x: [-2, 2, -1, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 0.2, repeat: Infinity, repeatDelay: Math.random() * 5 }}
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute top-0 left-0 -z-10 text-cyan-500 opacity-70"
        animate={{ x: [2, -2, 1, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 0.2, repeat: Infinity, repeatDelay: Math.random() * 5 + 0.1 }}
      >
        {text}
      </motion.span>
    </div>
  );
};

// 4. Floating Info Card (Glassmorphism)
const InfoCard = ({ title, value, icon: Icon, delay, x, y }: any) => (
  <motion.div
    className="absolute z-20 p-3 bg-white/70 backdrop-blur-md border border-white/50 shadow-lg rounded-xl flex items-center gap-3 w-48"
    style={{ left: x, top: y }}
    initial={{ opacity: 0, y: 20, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.5, type: "spring" }}
  >
    <div className="p-2 bg-sky-50 rounded-lg text-sky-500 border border-sky-100">
        <Icon size={18} />
    </div>
    <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</div>
        <div className="text-sm font-bold text-slate-700 font-mono">{value}</div>
    </div>
    {/* Decorative Corner */}
    <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-sky-400/50 rounded-tr-md" />
  </motion.div>
);

export default function Intro({ onComplete }: IntroProps) {
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isExiting, setIsExiting] = useState(false);

  // Mouse Parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        mouseX.set((e.clientX - window.innerWidth / 2) / 50);
        mouseY.set((e.clientY - window.innerHeight / 2) / 50);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    // Progress Simulation
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
            clearInterval(interval);
            return 100;
        }
        return prev + Math.random() * 2;
      });
    }, 50);

    // Log Simulation
    const logInterval = setInterval(() => {
        const actions = ["DECRYPT", "MOUNT", "SCAN", "AUTH", "SYNC", "LOAD"];
        const targets = ["KERNEL", "SHELL", "NETWORK", "PROXY", "DAEMON"];
        const newLog = `${actions[Math.floor(Math.random()*actions.length)]}_${targets[Math.floor(Math.random()*targets.length)]}::${generateHex(4)}`;
        setLogs(prev => [...prev.slice(-6), newLog]);
    }, 200);

    // Exit Trigger
    const exitTimer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 1200); // Allow time for exit animation
    }, 5000);

    return () => {
        clearInterval(interval);
        clearInterval(logInterval);
        clearTimeout(exitTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#f8fafc] flex items-center justify-center overflow-hidden font-sans select-none perspective-[1000px] cursor-none">
      
      {/* 0. Chromatic Aberration / Vertigo Effect */}
      <motion.div 
        className="absolute inset-0 pointer-events-none z-50 mix-blend-overlay opacity-30"
        animate={{ 
            x: [2, -2, 0],
            scale: [1, 1.005, 1]
        }}
        transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 4 }} // Occasional "glitch" jump
        style={{
            backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1IiBoZWlnaHQ9IjUiPgo8cmVjdCB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPC9zdmc+')"
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#f1f5f9_0%,#e2e8f0_100%)] z-0" />
      <DataStreamCanvas />
      
      {/* 2. Parallax Container */}
      <motion.div 
        className="relative z-10 w-full h-full flex items-center justify-center"
        style={{ x: mouseX, y: mouseY }}
        exit={{ scale: 20, opacity: 0, filter: "blur(40px)" }}
        transition={{ duration: 1, ease: "easeInOut" }}
      >
        
        {/* Background Grid - NEW */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
             style={{ 
                 backgroundImage: "linear-gradient(rgba(14, 165, 233, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.3) 1px, transparent 1px)",
                 backgroundSize: "40px 40px",
                 transform: "perspective(500px) rotateX(60deg) translateY(-100px) scale(2)"
             }}
        />

        {/* Scanning Light Beam - NEW */}
        <motion.div
            className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-transparent via-sky-400/10 to-transparent"
            style={{ height: "20%" }}
            animate={{ top: ["-20%", "120%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        {/* The Reactor Core - WITH SHAKE EFFECT */}
        <motion.div
            animate={{ x: [-1, 1, -1, 0], y: [1, -1, 0] }}
            transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 3 }} // Occasional glitch shake
        >
            <ReactorCore />
        </motion.div>

        {/* Orbiting Satellites - NOW STATIC OR VERY SLOW DRIFT */}
        <motion.div
            className="absolute w-[800px] h-[800px] rounded-full border border-slate-200/40"
            animate={{ rotate: 10 }}
            transition={{ duration: 100, ease: "linear", repeat: Infinity, repeatType: "mirror" }}
        >
             <div className="absolute top-1/2 -right-4 bg-white border border-slate-200 p-2 rounded-lg shadow-sm flex items-center gap-2">
                 <Shield size={16} className="text-emerald-500" />
                 <span className="text-[10px] font-mono text-slate-500">SECURE_LAYER</span>
             </div>
             <div className="absolute bottom-0 left-1/2 bg-white border border-slate-200 p-2 rounded-lg shadow-sm flex items-center gap-2">
                 <Database size={16} className="text-violet-500" />
                 <span className="text-[10px] font-mono text-slate-500">DATA_SHARD</span>
             </div>
        </motion.div>

        {/* Floating Info Cards */}
        <InfoCard 
            title="SYSTEM STATUS" 
            value="OPERATIONAL" 
            icon={Activity} 
            delay={0.5} 
            x="10%" y="20%" 
        />
        <InfoCard 
            title="NETWORK LINK" 
            value="ENCRYPTED" 
            icon={Lock} 
            delay={0.7} 
            x="75%" y="25%" 
        />
        <InfoCard 
            title="ACTIVE THREADS" 
            value={Math.floor(progress * 12)} 
            icon={Cpu} 
            delay={0.9} 
            x="15%" y="70%" 
        />
        <InfoCard 
            title="MEMORY ALLOC" 
            value={`${(progress * 0.64).toFixed(1)} GB`} 
            icon={Database} 
            delay={1.1} 
            x="70%" y="65%" 
        />

      </motion.div>

      {/* 3. Center HUD Overlay */}
      <div className="absolute z-20 bottom-12 left-0 right-0 flex flex-col items-center justify-center gap-4">
          <div className="relative">
              <GlitchText 
                text="FUXI FORENSICS" 
                className="text-4xl font-black tracking-[0.3em] text-slate-800"
              />
              <motion.div 
                className="h-1 bg-sky-500 mt-2"
                style={{ width: `${progress}%` }}
              />
          </div>
          
          <div className="flex items-center gap-8 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-2">
                  <Terminal size={12} />
                  INITIALIZING... {Math.floor(progress)}%
              </span>
              <span className="flex items-center gap-2">
                  <Wifi size={12} />
                  HOST: LOCALHOST
              </span>
          </div>
      </div>

      {/* 4. Log Stream (Left Side) */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 items-start opacity-60">
          {logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[10px] font-mono text-slate-500 bg-white/50 px-2 py-0.5 rounded border border-slate-100"
              >
                  <span className="text-sky-500 mr-2">➜</span>
                  {log}
              </motion.div>
          ))}
      </div>

      {/* 5. White Flash Transition */}
      <AnimatePresence>
        {isExiting && (
           <motion.div 
             className="absolute inset-0 bg-white z-50 pointer-events-none"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ duration: 0.8, ease: "circIn" }}
           >
              {/* Optional: Final Shockwave */}
              <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div 
                    className="w-full h-2 bg-sky-500/20"
                    animate={{ scaleY: [0, 100, 0] }}
                    transition={{ duration: 0.5 }}
                  />
              </div>
           </motion.div>
        )}
      </AnimatePresence>
      
      {/* 6. Scanlines Overlay */}
      <div className="absolute inset-0 pointer-events-none z-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoMCwgMCwgMCwgMC4wMikiLz48L3N2Zz4=')] opacity-50" />
      
      {/* 7. Vignette */}
      <div className="absolute inset-0 pointer-events-none z-30 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(148,163,184,0.1)_100%)]" />

    </div>
  );
}
