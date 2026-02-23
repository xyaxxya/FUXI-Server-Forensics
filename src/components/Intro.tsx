import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Terminal, Database, Lock, Cpu, Eye, Globe, Code, Zap, Activity, Hexagon, Scan, Binary, Server, Radio, AlertCircle } from "lucide-react";
import tauriLogo from "../assets/tauri.png";

interface IntroProps {
  onComplete: () => void;
}

const bootLogs = [
  "KERNEL_INIT: [OK]",
  "LOADING_MODULES: CRYPTO, NET, FS",
  "MOUNTING_VIRTUAL_DRIVE... [DONE]",
  "ESTABLISHING_SECURE_CHANNEL...",
  "VERIFYING_INTEGRITY_SIGNATURES...",
  "LOADING_NEURAL_NETWORKS...",
  "ALLOCATING_MEMORY_PAGES...",
  "STARTING_FORENSIC_ENGINE...",
  "CONNECTING_TO_SATELLITE_UPLINK...",
  "DECRYPTING_USER_PROFILE...",
  "SYSTEM_READY."
];

const MatrixRain = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const columns = Math.floor(canvas.width / 20);
    const drops: number[] = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }

    const chars = "01010101XYZABCDEF";

    const draw = () => {
      ctx.fillStyle = "rgba(248, 250, 252, 0.1)"; // Very faint trail
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#0ea5e9"; // Sky-500
      ctx.font = "12px monospace";

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * 20, drops[i] * 20);

        if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-20 pointer-events-none" />;
};

export default function Intro({ onComplete }: IntroProps) {
  const [stage, setStage] = useState(0);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const sequence = async () => {
      // Stage 0: Boot Logs
      for (let i = 0; i < bootLogs.length; i++) {
        setLogIndex(i);
        await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
      }
      
      await new Promise(r => setTimeout(r, 200));
      setStage(1); // Core Reveal

      await new Promise(r => setTimeout(r, 800));
      setStage(2); // Satellites

      await new Promise(r => setTimeout(r, 1000));
      setStage(3); // Scan

      await new Promise(r => setTimeout(r, 1500));
      setStage(4); // Exit
      
      await new Promise(r => setTimeout(r, 600)); // Wait for shockwave
      onComplete();
    };
    sequence();
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-50 flex items-center justify-center overflow-hidden font-mono select-none">
      
      {/* Background Matrix Rain */}
      <MatrixRain />
      
      {/* Radial Gradient Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.9)_90%)] z-0 pointer-events-none" />

      {/* STAGE 0: Boot Logs (Center) */}
      <AnimatePresence>
        {stage === 0 && (
          <motion.div
            className="absolute z-20 flex flex-col items-start justify-center h-full w-full max-w-md px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 2, filter: "blur(10px)" }}
            transition={{ duration: 0.5 }}
          >
             <div className="w-full border-l-2 border-sky-500 pl-4 space-y-1">
                {bootLogs.slice(0, logIndex + 1).slice(-8).map((log, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-xs font-bold text-slate-600 tracking-wider"
                    >
                        <span className="text-sky-500 mr-2">{">"}</span>
                        {log}
                    </motion.div>
                ))}
                <motion.div 
                    animate={{ opacity: [0, 1] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="w-3 h-4 bg-sky-500 mt-1"
                />
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STAGE 1-3: Main Core */}
      <AnimatePresence>
        {stage >= 1 && stage < 4 && (
          <motion.div
             className="relative z-10 flex items-center justify-center w-full h-full perspective-[1000px]"
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 1.5 }}
             transition={{ duration: 0.8, type: "spring" }}
          >
             {/* 3D Rotating Rings */}
             <motion.div
                className="absolute w-[500px] h-[500px] border border-slate-200 rounded-full"
                style={{ rotateX: 60 }}
                animate={{ rotateZ: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
             />
             <motion.div
                className="absolute w-[400px] h-[400px] border border-sky-100 rounded-full"
                style={{ rotateX: 60 }}
                animate={{ rotateZ: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
             />
             
             {/* Hexagon Field */}
             <div className="relative flex items-center justify-center">
                 {/* Spinning Outer Hex */}
                 <motion.div
                    className="absolute inset-0 border-[1px] border-sky-500/30 w-[300px] h-[300px] m-auto"
                    style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                 />
                 
                 {/* Counter-Spinning Inner Hex */}
                 <motion.div
                    className="absolute inset-0 border-[2px] border-sky-400 w-[260px] h-[260px] m-auto"
                    style={{ clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" }}
                    animate={{ rotate: -360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                 />

                 {/* Center Logo */}
                 <motion.div
                    className="relative z-20 w-40 h-40 bg-white shadow-[0_0_50px_rgba(14,165,233,0.4)] flex items-center justify-center"
                    style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                 >
                    <img src={tauriLogo} className="w-20 h-20 object-contain relative z-10" alt="Logo" />
                    
                    {/* Glitch Overlay */}
                    <motion.div
                        className="absolute inset-0 bg-sky-500/20 mix-blend-overlay z-20"
                        animate={{ 
                            opacity: [0, 0.5, 0, 0.2, 0],
                            x: [0, 5, -5, 2, 0]
                        }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                    />
                 </motion.div>

                 {/* Orbiting Icons */}
                 {stage >= 2 && (
                    <>
                        {[Shield, Terminal, Database, Globe, Lock, Cpu].map((Icon, i) => {
                            const angle = (i * 60) * (Math.PI / 180);
                            const radius = 220;
                            const x = Math.cos(angle) * radius;
                            const y = Math.sin(angle) * radius;
                            
                            return (
                                <motion.div
                                    key={i}
                                    className="absolute w-12 h-12 bg-white border border-sky-200 shadow-lg flex items-center justify-center text-sky-600 z-10"
                                    style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                                    animate={{ x, y, opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.1, type: "spring" }}
                                >
                                    <Icon size={20} />
                                </motion.div>
                            )
                        })}
                    </>
                 )}
             </div>

             {/* Text */}
             <div className="absolute top-[70%] flex flex-col items-center">
                 <motion.h1
                    className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-3"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                 >
                    FUXI <span className="text-sky-500">FORENSICS</span>
                 </motion.h1>
                 <motion.div 
                    className="h-1 w-0 bg-sky-500 mt-2"
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                 />
                 <motion.p
                    className="mt-2 text-xs font-bold text-slate-400 tracking-[0.3em] uppercase"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                 >
                    System Online
                 </motion.p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STAGE 4: Shockwave Exit */}
      <AnimatePresence>
        {stage === 4 && (
           <motion.div
             className="absolute inset-0 z-50 flex items-center justify-center bg-white"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             transition={{ duration: 0.2 }} // Fast flash
           >
              <motion.div 
                className="absolute inset-0 border-[50px] border-sky-500 rounded-full"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}