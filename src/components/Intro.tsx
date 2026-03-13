import React, { useState, useEffect } from "react";
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

export default function Intro({ onComplete }: IntroProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Total duration approx 5000ms (5s)
    // 100 steps * 50ms = 5000ms
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 800); // Wait a bit before unmounting
          return 100;
        }
        // Consistent progress for 5s duration (100 / (5000/50) = 1)
        const increment = 1; 
        return Math.min(prev + increment, 100);
      });
    }, 50); // Tick every 50ms

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div 
      className="fixed inset-0 z-[9999] bg-white overflow-hidden font-sans select-none flex items-center justify-center"
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8 }}
    >
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
        className="absolute top-0 left-0 right-0 h-16 border-b border-slate-100 bg-white/90 backdrop-blur-md z-50 flex items-center justify-between px-8 shadow-sm"
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

      {/* --- LEFT COLUMN --- */}
      <motion.div 
        className="absolute left-8 top-24 bottom-24 w-72 flex flex-col gap-6 z-40 hidden md:flex"
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
      >
        <div className="flex-1 border border-slate-100 rounded-xl bg-slate-50/80 p-5 relative overflow-hidden backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-500">
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
                <div className="absolute inset-0 bg-gradient-to-tr from-[#409EFF]/10 to-[#B37DEF]/10 rounded-full blur-xl animate-pulse" />

                {/* The Logo Image */}
                <motion.div 
                  className="relative z-10 p-6 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(64,158,255,0.3)] border border-slate-100"
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
          <div className="w-96 h-1.5 mx-auto bg-slate-100 rounded-full overflow-hidden relative mt-8 shadow-inner">
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
                      SYSTEM READY
                   </motion.span>
                )}
             </AnimatePresence>
          </div>
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
               className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 backdrop-blur-sm transition-all duration-300
                 ${progress > (i * 25) ? 'bg-white/80 border-[#409EFF]/30 shadow-md scale-105' : 'bg-slate-50/50 border-slate-100 opacity-60 scale-100 grayscale'}
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
        <div className="mt-4 flex items-center justify-center gap-2 bg-white/50 p-2 rounded-lg border border-slate-100">
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
