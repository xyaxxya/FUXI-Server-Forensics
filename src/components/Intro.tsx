import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Terminal, Activity, Database, Lock } from "lucide-react";
import tauriLogo from "../assets/tauri.png";

interface IntroProps {
  onComplete: () => void;
}

const techLines = [
  "INITIALIZING KERNEL...",
  "LOADING SECURITY MODULES...",
  "ESTABLISHING SECURE CONNECTION...",
  "SCANNING NETWORK INTERFACES...",
  "DECRYPTING DATABASE CREDENTIALS...",
  "SYSTEM READY.",
];

export default function Intro({ onComplete }: IntroProps) {
  const [stage, setStage] = useState(0);
  const [currentLine, setCurrentLine] = useState(0);

  useEffect(() => {
    // Sequence timing
    const sequence = async () => {
      await new Promise((r) => setTimeout(r, 500));
      setStage(1); // Grid & HUD

      await new Promise((r) => setTimeout(r, 1000));
      setStage(2); // Logo & Icons

      await new Promise((r) => setTimeout(r, 800));
      setStage(3); // Text Lines

      // Advance text lines
      for (let i = 0; i < techLines.length; i++) {
        setCurrentLine(i);
        await new Promise((r) => setTimeout(r, 300));
      }

      await new Promise((r) => setTimeout(r, 1000));
      setStage(4); // Exit

      await new Promise((r) => setTimeout(r, 1000));
      onComplete();
    };

    sequence();
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden font-mono select-none pointer-events-none">
      {/* 1. Background Grid & Scanlines */}
      <motion.div
        className="absolute inset-0 z-0 bg-slate-950/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: stage >= 1 && stage < 4 ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-20" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xIDFoMnYySDF6IiBmaWxsPSIjMzM0MTU1IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=')] opacity-20" />
      </motion.div>

      {/* 2. Central HUD Elements */}
      <AnimatePresence>
        {stage >= 1 && stage < 4 && (
          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
            {/* Rotating Rings */}
            <div className="relative w-[500px] h-[500px] flex items-center justify-center">
              <motion.div
                className="absolute inset-0 border border-blue-500/20 rounded-full"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.8, ease: "circOut" }}
              />
              <motion.div
                className="absolute inset-10 border-t-2 border-r-2 border-cyan-500/40 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-20 border-b-2 border-l-2 border-purple-500/40 rounded-full"
                animate={{ rotate: -360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />

              {/* Central Logo Area */}
              <motion.div
                className="relative z-20 w-48 h-48 bg-slate-900/50 backdrop-blur-xl rounded-full flex items-center justify-center border border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                  delay: 0.2,
                }}
              >
                <motion.img
                  src={tauriLogo}
                  alt="System Logo"
                  className="w-24 h-24 object-contain drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                />
              </motion.div>

              {/* Orbital Icons */}
              {stage >= 2 && (
                <>
                  {[Shield, Database, Terminal, Activity, Lock].map(
                    (Icon, index) => {
                      const angle = index * 72 * (Math.PI / 180);
                      const radius = 180;
                      const x = Math.cos(angle) * radius;
                      const y = Math.sin(angle) * radius;

                      return (
                        <motion.div
                          key={index}
                          className="absolute w-10 h-10 bg-slate-800/80 border border-blue-500/50 rounded-lg flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                          animate={{ x, y, opacity: 1, scale: 1 }}
                          exit={{ x: x * 1.5, y: y * 1.5, opacity: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 100,
                            damping: 15,
                            delay: 0.1 * index,
                          }}
                        >
                          <Icon size={20} />
                        </motion.div>
                      );
                    },
                  )}
                </>
              )}
            </div>

            {/* Terminal Text Output */}
            <div className="absolute bottom-20 w-full max-w-lg">
              <div className="flex flex-col items-center space-y-2">
                <motion.div
                  className="h-8 overflow-hidden text-cyan-400 font-bold tracking-widest text-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  FUXI Server Forensics
                </motion.div>

                <div className="h-24 w-full bg-slate-900/80 border border-slate-700/50 rounded p-4 font-mono text-xs text-green-400/90 shadow-inner overflow-hidden flex flex-col justify-end">
                  {techLines.slice(0, currentLine + 1).map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center"
                    >
                      <span className="mr-2 text-blue-500">➜</span>
                      {line}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Final Flash / Transition Out */}
      <AnimatePresence>
        {stage === 4 && (
          <motion.div
            className="absolute inset-0 z-50 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.8, times: [0, 0.1, 1] }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
