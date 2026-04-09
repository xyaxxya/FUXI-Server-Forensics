import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { 
  Lock, Server, Activity, Wifi, Database, Disc, Zap, Cpu
} from "lucide-react";
// Import the new logo
import logo from "../assets/logo.png";

// --- CONFIGURATION ---
const THEME = {
  white: "#FFFFFF",
  techBlue: "#409EFF",
  purpleStart: "#B37DEF",
  purpleMid: "#F0559A",
  purpleEnd: "#FFD63E",
  darkGrey: "#555555",
  green: "#32D74B",
  bgGrid: "rgba(64, 158, 255, 0.05)"
};

interface IntroProps {
  onComplete: () => void;
  bootReady?: boolean;
  bootStatusText?: string;
}

// --- HELPER COMPONENTS ---

// 1. Digital Clock with Glitch Effect
const DigitalClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const format = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="flex items-center gap-1 font-mono text-lg font-bold tracking-widest relative">
      <motion.span 
        key={time.getHours()} 
        initial={{ y: -5, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }}
        className="text-[#409EFF]"
      >
        {format(time.getHours())}
      </motion.span>
      <span className="text-slate-300 animate-pulse">:</span>
      <motion.span 
        key={time.getMinutes()} 
        initial={{ y: -5, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }}
        className="bg-clip-text text-transparent bg-gradient-to-b from-[#409EFF] to-[#B37DEF]"
      >
        {format(time.getMinutes())}
      </motion.span>
      <span className="text-slate-300 animate-pulse">:</span>
      <motion.span 
        key={time.getSeconds()} 
        initial={{ y: -5, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }}
        className="text-[#F0559A]"
      >
        {format(time.getSeconds())}
      </motion.span>
    </div>
  );
};

// 2. Glitch Wrapper Component
const GlitchEffect = ({ children, intensity = 1 }: { children: React.ReactNode, intensity?: number }) => {
  const controls = useAnimation();
  
  useEffect(() => {
    const glitchSequence = async () => {
      while (true) {
        await new Promise(r => setTimeout(r, Math.random() * 3000 + 2000));
        await controls.start({
          x: [0, -2 * intensity, 2 * intensity, -1 * intensity, 0],
          y: [0, 1 * intensity, -1 * intensity, 0],
          filter: ["none", "hue-rotate(90deg)", "none"],
          opacity: [1, 0.8, 1],
          transition: { duration: 0.2 }
        });
      }
    };
    glitchSequence();
  }, [controls, intensity]);

  return (
    <motion.div animate={controls} className="relative">
      {children}
    </motion.div>
  );
};

// 3. Scrolling Code Block
const CodeBlock = () => {
  const codeSnippet = `
// FUXI FORENSICS CORE V2.0
// INITIATING DEEP SCAN...

fn analyze_memory_dump(path: &Path) -> Result<Report> {
    let mut scanner = Scanner::new(config);
    scanner.load_signature_db()?;
    
    let regions = scanner.map_memory_regions(path);
    for region in regions {
        if region.entropy > 0.85 {
            // High entropy detected
            log::warn!("Possible packed code at {:x}", region.start);
            scanner.decrypt_and_scan(region)?;
        }
    }
    
    // Check for rootkit hooks
    let hooks = scanner.find_kernel_hooks();
    if !hooks.is_empty() {
        alert!("KERNEL INTEGRITY COMPROMISED");
    }
    
    Ok(scanner.generate_report())
}
`;
  
  return (
    <div className="font-mono text-[10px] leading-4 text-slate-400 opacity-80 overflow-hidden h-48 relative">
      <motion.div
        animate={{ y: ["0%", "-50%"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        <pre>{codeSnippet}</pre>
        <pre>{codeSnippet}</pre>
      </motion.div>
      <div className="absolute inset-0 pointer-events-none mix-blend-color-burn bg-gradient-to-b from-transparent via-[#409EFF]/5 to-transparent" />
    </div>
  );
};

// 4. Floating Data Particles
const FloatingParticles = () => {
  const particles = [
    { id: 1, text: '0x4F52454E53494353', x: "5%", y: "30%" },
    { id: 2, text: 'ACCESS_GRANTED', x: "85%", y: "10%" },
    { id: 3, text: 'ENCRYPTION: AES-256-GCM', x: "75%", y: "85%" },
    { id: 4, text: 'INTEGRITY_CHECK_PASS', x: "10%", y: "80%" },
    { id: 5, text: 'LOADING_MODULES...', x: "50%", y: "15%" },
    { id: 6, text: '01010101', x: "90%", y: "50%" },
  ];

  return (
    <>
      {particles.map((p, i) => (
        <motion.div
          key={p.id}
          className="absolute font-mono text-[10px] text-[#409EFF]/30 pointer-events-none select-none z-0"
          initial={{ x: p.x, y: p.y, opacity: 0 }}
          animate={{ 
            y: [p.y, `calc(${p.y} - 30px)`, p.y],
            opacity: [0.2, 0.5, 0.2] 
          }}
          transition={{ 
            duration: 3 + i, 
            repeat: Infinity, 
            ease: "easeInOut",
            delay: i * 0.7 
          }}
          style={{ left: p.x, top: p.y }}
        >
          {p.text}
        </motion.div>
      ))}
    </>
  );
};

export default function Intro({ onComplete, bootReady = false, bootStatusText = "" }: IntroProps) {
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);
  const isStarryMode = typeof window !== "undefined" && (document.body.classList.contains("starry-mode") || localStorage.getItem("starry_mode") === "true");

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          if (!completedRef.current) {
            completedRef.current = true;
            setTimeout(onComplete, 500);
          }
          return 100;
        }
        if (!bootReady && prev >= 92) {
          return 92;
        }
        const increment = bootReady ? 2.4 : 0.9;
        const next = Math.min(prev + increment, 100);
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete, bootReady]);

  return (
    <motion.div 
      className={`fixed inset-0 z-[9999] overflow-hidden font-sans select-none flex items-center justify-center ${isStarryMode ? "bg-[#070b16]" : "bg-white"}`}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(64,158,255,0.12),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(240,85,154,0.12),_transparent_28%),radial-gradient(circle_at_left,_rgba(179,125,239,0.10),_transparent_24%)]" />
        <motion.div
          className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[#409EFF]/10 blur-3xl"
          animate={{ x: [0, 28, 0], y: [0, -16, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-20 bottom-16 h-80 w-80 rounded-full bg-[#B37DEF]/10 blur-3xl"
          animate={{ x: [0, -22, 0], y: [0, 18, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Background Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(${THEME.bgGrid} 1px, transparent 1px),
            linear-gradient(90deg, ${THEME.bgGrid} 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          transform: "perspective(1000px) rotateX(10deg) scale(1.1)"
        }}
      />
      
      {/* Scanning Line Background */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-transparent via-[#409EFF]/5 to-transparent"
        style={{ height: "20%" }}
        animate={{ top: ["-20%", "120%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />

      <FloatingParticles />

      {/* --- TOP STATUS BAR --- */}
      <motion.div 
        className={`absolute top-0 left-0 right-0 h-16 border-b backdrop-blur-xl z-50 flex items-center justify-between px-8 shadow-sm ${isStarryMode ? "border-slate-700/70 bg-slate-900/80" : "border-white/70 bg-white/78"}`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
      >
        <div className="flex items-center gap-2 text-slate-600">
          <Lock size={16} className="text-slate-400" />
          <span className="text-xs font-bold tracking-widest text-slate-500">SECURE_ENV</span>
        </div>
        
        <DigitalClock />
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-bold">MEM_INTEGRITY</span>
            <GlitchEffect intensity={2}>
              <span className="text-xs font-mono font-bold text-slate-600">100%</span>
            </GlitchEffect>
          </div>
          <motion.div 
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-[#32D74B] shadow-[0_0_10px_#32D74B]" 
          />
        </div>
      </motion.div>

      <motion.div
        className="absolute right-8 top-24 z-40 hidden w-72 md:block"
        initial={{ x: 180, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.45, type: "spring", stiffness: 110, damping: 16 }}
      >
        <div className={`overflow-hidden rounded-[1.4rem] border p-4 backdrop-blur-xl shadow-[0_28px_56px_-34px_rgba(15,23,42,0.28)] ${isStarryMode ? "border-slate-700/70 bg-slate-900/72" : "border-white/70 bg-white/74"}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">telemetry</div>
            <motion.div
              className="h-2 w-2 rounded-full bg-[#32D74B] shadow-[0_0_10px_#32D74B]"
              animate={{ opacity: [1, 0.45, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Threads", value: `${24 + Math.floor(progress / 8)}` },
              { label: "Memory", value: `${58 + Math.floor(progress / 5)}%` },
              { label: "Modules", value: `${4 + Math.floor(progress / 25)}` },
              { label: "Risk", value: progress > 88 ? "low" : "scan" },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.58 + index * 0.06 }}
                className={`rounded-[1rem] border px-3 py-3 ${isStarryMode ? "border-slate-700/70 bg-slate-900/62" : "border-slate-200/70 bg-white/76"}`}
              >
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{item.label}</div>
                <div className="mt-2 text-sm font-semibold text-slate-700">{item.value}</div>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-full bg-slate-200/80">
            <motion.div
              className="h-1.5 rounded-full bg-gradient-to-r from-[#409EFF] via-[#B37DEF] to-[#F0559A]"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* --- LEFT COLUMN --- */}
      <motion.div 
        className="absolute left-8 top-24 bottom-24 w-72 flex flex-col gap-6 z-40 hidden md:flex"
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
      >
        <div className={`flex-1 border rounded-[1.5rem] p-5 relative overflow-hidden backdrop-blur-xl shadow-[0_28px_60px_-38px_rgba(15,23,42,0.28)] hover:shadow-[0_36px_70px_-38px_rgba(64,158,255,0.28)] transition-all duration-500 ${isStarryMode ? "border-slate-700/70 bg-slate-900/70" : "border-white/70 bg-white/72"}`}>
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#409EFF] to-[#B37DEF]" />
          <div className="flex items-center gap-2 mb-4 text-[#409EFF]">
            <Server size={18} />
            <span className="text-xs font-bold tracking-wider">NODE_CLUSTER_01</span>
          </div>
          
          <div className="space-y-3 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center text-[10px] font-mono text-slate-500 border-b border-slate-100 pb-1">
                <span>192.168.1.{100 + i}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-[#32D74B] animate-pulse shadow-[0_0_5px_#32D74B]' : 'bg-slate-300'}`} />
              </div>
            ))}
          </div>

          <div className="mb-6">
             <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-2">
                <span>CPU LOAD</span>
                <span>{Math.floor(progress * 0.8 + 10)}%</span>
             </div>
             <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                <motion.div 
                    className="h-full bg-[#409EFF]" 
                    style={{ width: `${Math.floor(progress * 0.8 + 10)}%` }}
                />
             </div>
             {/* Mini Sparkline */}
             <svg viewBox="0 0 100 20" className="w-full h-8 mt-2 stroke-[#409EFF]/50 fill-none stroke-[1.5]">
                <motion.path 
                  d="M0,15 L10,10 L20,15 L30,5 L40,10 L50,5 L60,12 L70,5 L80,10 L90,5 L100,15"
                  strokeDasharray="100"
                  strokeDashoffset="100"
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                />
             </svg>
          </div>

          <CodeBlock />
        </div>
      </motion.div>

      {/* --- CENTER BRAND AREA --- */}
      <div className="relative z-50 flex flex-col items-center">
        {/* Logo/Chip Container */}
        <GlitchEffect intensity={2}>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1, type: "spring" }}
            className="relative mb-10"
          >
             <div className="w-48 h-48 relative flex items-center justify-center">
                {/* Outer Rotating Rings */}
                <motion.div 
                  className="absolute inset-[-20px] border border-dashed border-slate-300/50 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                <motion.div 
                  className="absolute inset-[-10px] border border-[#409EFF]/30 rounded-full"
                  style={{ borderTopColor: "transparent", borderBottomColor: "transparent" }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Glowing Background for Logo */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#409EFF]/14 via-[#B37DEF]/12 to-[#F0559A]/10 blur-2xl animate-pulse" />

                {/* The Logo Image */}
                <motion.div 
                  className="relative z-10 p-6 bg-white/82 backdrop-blur-xl rounded-[2rem] shadow-[0_24px_60px_-22px_rgba(64,158,255,0.34)] border border-white/80"
                  whileHover={{ scale: 1.05 }}
                  animate={{ 
                    y: [0, -10, 0],
                    boxShadow: [
                      "0 10px 40px -10px rgba(64,158,255,0.3)", 
                      "0 20px 50px -10px rgba(179,125,239,0.4)", 
                      "0 10px 40px -10px rgba(64,158,255,0.3)"
                    ] 
                  }}
                  transition={{ 
                    y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                    boxShadow: { duration: 2, repeat: Infinity }
                  }}
                >
                  <img src={logo} alt="FUXI Logo" className="w-24 h-24 object-contain" />
                  
                  {/* Scanning Overlay on Logo */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-transparent rounded-2xl pointer-events-none"
                    animate={{ top: ["-100%", "200%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1 }}
                  />
                </motion.div>

                {/* Orbiting Particle */}
                <motion.div
                  className="absolute w-full h-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-3 h-3 bg-[#F0559A] rounded-full shadow-[0_0_10px_#F0559A]" />
                </motion.div>
             </div>
          </motion.div>
        </GlitchEffect>

        {/* Brand Text */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <h1 className="text-6xl font-black tracking-[0.15em] text-slate-800 mb-4 select-none relative"
              style={{ 
                textShadow: "4px 4px 0px rgba(64,158,255,0.1)",
                WebkitTextStroke: "1px rgba(64,158,255,0.2)"
              }}>
            FUXI
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#409EFF] to-[#B37DEF]"> FORENSICS</span>
            
            {/* Glitch Overlay Text */}
            <motion.span 
              className="absolute inset-0 text-[#409EFF] opacity-30 mix-blend-overlay pointer-events-none"
              animate={{ x: [-2, 2, -1, 0], opacity: [0, 0.5, 0] }}
              transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 3 }}
            >
               FUXI FORENSICS
            </motion.span>
          </h1>
          
          {/* Progress Bar Container */}
          <div className="w-96 h-2 mx-auto bg-slate-100/90 border border-white/70 rounded-full overflow-hidden relative mt-8 shadow-inner">
             <motion.div 
               className="h-full bg-gradient-to-r from-[#409EFF] via-[#F0559A] to-[#FFD63E]"
               style={{ width: `${progress}%` }}
             >
                <motion.div 
                   className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/80 transform skew-x-[-20deg]"
                   animate={{ x: ["-100%", "500%"] }}
                   transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
             </motion.div>
          </div>

          {/* Status Text Below Progress Bar */}
          <div className="mt-4 h-6 overflow-hidden flex flex-col items-center">
             <AnimatePresence mode="wait">
                {progress < 30 && (
                   <motion.span key="init" initial={{y:10, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-10, opacity:0}} className="text-sm font-mono text-slate-400 tracking-wider">INITIALIZING SYSTEM KERNEL...</motion.span>
                )}
                {progress >= 30 && progress < 60 && (
                   <motion.span key="modules" initial={{y:10, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-10, opacity:0}} className="text-sm font-mono text-slate-500 tracking-wider">LOADING SECURITY MODULES...</motion.span>
                )}
                {progress >= 60 && progress < 90 && (
                   <motion.span key="ai" initial={{y:10, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-10, opacity:0}} className="text-sm font-mono text-[#409EFF] tracking-wider flex items-center gap-2">
                      <Zap size={14} className="animate-pulse" /> SYNCHRONIZING AI NEURAL NET
                   </motion.span>
                )}
                {progress >= 90 && (
                   <motion.span key="ready" initial={{y:10, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-10, opacity:0}} className="text-sm font-mono font-bold text-[#32D74B] tracking-wider">
                      {bootReady ? "SYSTEM READY" : "WAITING SECURITY CHECK"}
                   </motion.span>
                )}
             </AnimatePresence>
          </div>
          {bootStatusText && (
            <div className="mt-3 rounded-full border border-white/70 bg-white/74 px-3 py-1.5 text-[11px] text-slate-500 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.24)]">{bootStatusText}</div>
          )}
        </motion.div>
      </div>

      {/* --- RIGHT BOTTOM MODULES --- */}
      <motion.div 
        className="absolute right-8 bottom-24 w-64 z-40 hidden md:block"
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.6, type: "spring" }}
      >
        <div className="grid grid-cols-2 gap-3">
           {['NETWORK', 'MEMORY', 'STORAGE', 'AI_CORE'].map((mod, i) => (
             <motion.div 
               key={mod}
               className={`p-4 rounded-[1.2rem] border flex flex-col items-center justify-center gap-2 backdrop-blur-xl transition-all duration-300
                ${progress > (i * 25) ? (isStarryMode ? 'bg-slate-900/75 border-sky-500/40 shadow-md scale-105' : 'bg-white/80 border-[#409EFF]/30 shadow-[0_22px_44px_-30px_rgba(64,158,255,0.28)] scale-105') : (isStarryMode ? 'bg-slate-900/45 border-slate-700/70 opacity-60 scale-100 grayscale' : 'bg-slate-50/50 border-slate-100 opacity-60 scale-100 grayscale')}
               `}
             >
                {i === 0 && <Wifi size={20} className={progress > 0 ? "text-[#409EFF] animate-pulse" : "text-slate-300"} />}
                {i === 1 && <Database size={20} className={progress > 25 ? "text-[#B37DEF] animate-pulse" : "text-slate-300"} />}
                {i === 2 && <Disc size={20} className={progress > 50 ? "text-[#F0559A] animate-pulse" : "text-slate-300"} />}
                {i === 3 && <Cpu size={20} className={progress > 75 ? "text-[#FFD63E] animate-pulse" : "text-slate-300"} />}
                <span className="text-[10px] font-bold text-slate-500 tracking-wide">{mod}</span>
                
                {/* Tiny Progress Bar per Module */}
                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mt-1">
                    <motion.div 
                        className="h-full bg-slate-400"
                        initial={{ width: 0 }}
                        animate={{ width: progress > (i * 25) ? "100%" : "0%" }}
                        transition={{ duration: 0.5 }}
                        style={{ backgroundColor: i === 0 ? THEME.techBlue : i === 1 ? THEME.purpleStart : i === 2 ? THEME.purpleMid : THEME.purpleEnd }}
                    />
                </div>
             </motion.div>
           ))}
        </div>
        <div className={`mt-4 flex items-center justify-center gap-2 p-2 rounded-xl border backdrop-blur-sm ${isStarryMode ? "bg-slate-900/60 border-slate-700/70" : "bg-white/72 border-white/70 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.22)]"}`}>
           <Activity size={14} className="text-[#32D74B] animate-bounce" />
           <span className="text-[10px] text-slate-500 font-mono">DIAGNOSTICS: OPTIMAL</span>
        </div>
      </motion.div>
      
      {/* Percentage Display - Big Background Number */}
      <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 text-[12rem] font-black text-slate-50 opacity-50 pointer-events-none select-none z-0">
         {Math.floor(progress)}%
      </div>

    </motion.div>
  );
}
