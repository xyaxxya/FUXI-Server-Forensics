import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { useCommandStore } from '../store/CommandContext';
import { translations, Language } from '../translations';
import FileManager from './FileManager';
import { FolderOpen, X, RefreshCw, Terminal as TerminalIcon, Cpu } from 'lucide-react';

export default function TerminalXterm({ onClose, sessionId, language }: { onClose: () => void, sessionId?: string, language: Language }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const { sessions, currentSession } = useCommandStore();
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFileManager, setShowFileManager] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('terminal_font_size');
    return saved ? parseInt(saved) : 14;
  });
  const t = translations[language];

  // Use passed sessionId or fallback to currentSession (for backward compatibility)
  const targetSessionId = sessionId || currentSession?.id;
  // Get session details from store
  const targetSession = sessions.find(s => s.id === targetSessionId);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Reset state on re-run (retry)
    setConnecting(true);
    setError(null);

    // 1. Initialize Xterm
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
      fontSize: fontSize,
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: 0.4,
      allowTransparency: true,
      theme: {
        background: 'transparent',
        foreground: '#f8fafc',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#e879f9',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    
    // Focus handling for visual feedback
    term.textarea?.addEventListener('focus', () => setIsFocused(true));
    term.textarea?.addEventListener('blur', () => setIsFocused(false));

    // Keyboard shortcuts for font size
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const newSize = Math.min(24, fontSize + 1);
          setFontSize(newSize);
          localStorage.setItem('terminal_font_size', String(newSize));
          if (xtermRef.current) {
            xtermRef.current.options.fontSize = newSize;
            fitAddonRef.current?.fit();
          }
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          const newSize = Math.max(10, fontSize - 1);
          setFontSize(newSize);
          localStorage.setItem('terminal_font_size', String(newSize));
          if (xtermRef.current) {
            xtermRef.current.options.fontSize = newSize;
            fitAddonRef.current?.fit();
          }
        } else if (e.key === '0') {
          e.preventDefault();
          setFontSize(14);
          localStorage.setItem('terminal_font_size', '14');
          if (xtermRef.current) {
            xtermRef.current.options.fontSize = 14;
            fitAddonRef.current?.fit();
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    term.writeln(`\x1b[1;34m${t.initializing_ssh}\x1b[0m`);

    // 2. Start PTY Session
    const startPty = async () => {
      try {
        if (!targetSessionId || !targetSession) {
            throw new Error(t.no_active_session_selected);
        }

        term.writeln(`\r\n${t.connecting_to.replace('{0}', `${targetSession.user}@${targetSession.ip}`)}\r\n`);

        try {
             // Now we pass session_id instead of raw credentials
             const ptyId = await invoke<string>('start_pty_session', {
                 sessionId: targetSessionId,
                 cols: term.cols,
                 rows: term.rows
             });
             
             ptyIdRef.current = ptyId;
             setConnecting(false);
             term.writeln(`\x1b[32m${t.connected}\x1b[0m\r\n`);
             term.clear();
             term.focus(); // Auto focus
             
             // 3. Setup Events
             setupPtyEvents(term, ptyId);

        } catch (e: any) {
             const errorMsg = e.toString();
             term.writeln(`\r\n\x1b[31m${t.connection_failed.replace('{0}', errorMsg)}\x1b[0m`);
             setError(errorMsg);
             
             if (errorMsg.includes("No password stored")) {
                 term.writeln(`\r\n\x1b[33m${t.reconnect_hint}\x1b[0m`);
             }
        }

      } catch (e: any) {
        term.writeln(`\r\n\x1b[31m${t.error_status}: ${e.message}\x1b[0m`);
      }
    };

    startPty();

    // Robust Resize Handler
    const handleResize = () => {
        if (!fitAddonRef.current || !xtermRef.current || !terminalRef.current) return;
        
        // Check visibility - if hidden, dimensions are 0
        if (terminalRef.current.clientHeight === 0) return;

        try {
            fitAddonRef.current.fit();
            
            // Sync with PTY
            if (ptyIdRef.current) {
                invoke('resize_pty', { 
                    id: ptyIdRef.current, 
                    cols: xtermRef.current.cols, 
                    rows: xtermRef.current.rows 
                }).catch(console.error);
            }
        } catch (e) {
            console.error("Resize error:", e);
        }
    };

    // 1. ResizeObserver - Detects container size changes
    const resizeObserver = new ResizeObserver(() => {
        handleResize();
    });
    
    if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current);
    }

    // 2. Window resize
    window.addEventListener('resize', handleResize);

    // 3. Initial fit with retry
    setTimeout(handleResize, 100);
    setTimeout(handleResize, 500); // Second attempt after layout settles

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      resizeObserver.disconnect();
      if (ptyIdRef.current) {
          invoke('stop_pty_session', { id: ptyIdRef.current }).catch(console.error);
      }
      term.dispose();
    };
  }, [targetSessionId, retryCount, fontSize]);

  const setupPtyEvents = async (term: Terminal, ptyId: string) => {
      // Listen for incoming data
      await listen('pty_data', (event: any) => {
          const payload = event.payload as { id: string, data: string };
          if (payload.id === ptyId) {
              term.write(payload.data);
          }
      });

      // Handle input
      term.onData(data => {
          invoke('write_pty', { id: ptyId, data }).catch(console.error);
      });
      
      // Handle resize
      term.onResize(size => {
          invoke('resize_pty', { id: ptyId, cols: size.cols, rows: size.rows }).catch(console.error);
      });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex flex-col h-full rounded-2xl overflow-hidden border transition-all duration-500 relative ${
        isFocused 
          ? 'shadow-[0_0_40px_rgba(56,189,248,0.15)] border-sky-500/30' 
          : 'shadow-2xl border-white/10'
      }`}
      style={{
        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
        backdropFilter: 'blur(20px)'
      }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-b border-white/5 relative z-20 select-none">
        <div className="flex items-center gap-4">
            {/* Session Info */}
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-default"
            >
                <div className={`relative flex h-2 w-2`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connecting ? 'bg-amber-400' : error ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${connecting ? 'bg-amber-500' : error ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200 tracking-wide font-mono flex items-center gap-2">
                        {targetSession ? `${targetSession.user}` : t.no_session}
                        <span className="text-slate-500 font-sans">at</span>
                        <span className="text-sky-400">{targetSession?.ip}</span>
                    </span>
                </div>
            </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
            {/* Font Size Controls */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5">
              <button
                onClick={() => {
                  const newSize = Math.max(10, fontSize - 1);
                  setFontSize(newSize);
                  localStorage.setItem('terminal_font_size', String(newSize));
                  if (xtermRef.current) {
                    xtermRef.current.options.fontSize = newSize;
                    fitAddonRef.current?.fit();
                  }
                }}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors text-xs font-bold"
                title="Decrease font size (Ctrl+-)"
              >
                A-
              </button>
              <span className="text-xs text-slate-400 font-mono px-1">{fontSize}</span>
              <button
                onClick={() => {
                  const newSize = Math.min(24, fontSize + 1);
                  setFontSize(newSize);
                  localStorage.setItem('terminal_font_size', String(newSize));
                  if (xtermRef.current) {
                    xtermRef.current.options.fontSize = newSize;
                    fitAddonRef.current?.fit();
                  }
                }}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors text-xs font-bold"
                title="Increase font size (Ctrl++)"
              >
                A+
              </button>
            </div>

            <div className="h-4 w-[1px] bg-white/10 mx-1" />
            
            <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setRetryCount(c => c + 1)}
                className="p-2 text-slate-400 hover:text-emerald-300 rounded-lg transition-colors relative group"
                title="Reconnect SSH Session"
            >
                <RefreshCw size={18} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">Reconnect</span>
            </motion.button>
            
            <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFileManager(!showFileManager)} 
                className={`p-2 rounded-lg transition-colors relative group ${showFileManager ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-sky-300'}`}
                title="Toggle File Manager"
            >
                <FolderOpen size={18} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">Files</span>
            </motion.button>

            <div className="h-4 w-[1px] bg-white/10 mx-1" />

            <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: "rgba(239, 68, 68, 0.15)" }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose} 
                className="p-2 text-slate-400 hover:text-red-400 rounded-lg transition-colors relative group"
                title={t.terminal_close}
            >
                <X size={18} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">Close</span>
            </motion.button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative w-full h-full overflow-hidden">
            {/* Background Texture/Grid for tech feel */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
            />
            
            <div ref={terminalRef} className="absolute inset-0 p-2 md:p-4" />
        </div>
        
        {/* File Manager Slide-over */}
         <AnimatePresence>
             {showFileManager && (
                 <motion.div 
                     initial={{ x: "100%", opacity: 0 }}
                     animate={{ x: 0, opacity: 1 }}
                     exit={{ x: "100%", opacity: 0 }}
                     transition={{ type: "spring", damping: 30, stiffness: 300 }}
                     className="w-80 border-l border-white/10 bg-[#0f172a]/95 flex flex-col backdrop-blur-3xl shadow-[-10px_0_40px_rgba(0,0,0,0.3)] z-30"
                 >
                      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-sky-500/10 to-transparent">
                         <span className="text-xs font-bold text-sky-100 tracking-wider flex items-center gap-2 uppercase">
                             <motion.div 
                                whileHover={{ rotate: 180 }}
                                transition={{ duration: 0.3 }}
                                className="p-1 rounded bg-sky-500/20 text-sky-400"
                              >
                                  <FolderOpen size={14} />
                              </motion.div>
                             FUXI FTP
                         </span>
                         <motion.button 
                             whileHover={{ rotate: 90, scale: 1.1 }}
                             whileTap={{ scale: 0.9 }}
                             onClick={() => setShowFileManager(false)} 
                             className="text-slate-400 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
                         >
                             <X size={14} />
                         </motion.button>
                      </div>
                      <div className="flex-1 overflow-hidden relative">
                         <FileManager sessionId={targetSessionId || ''} />
                      </div>
                 </motion.div>
             )}
         </AnimatePresence>
      </div>
      
      {/* Bottom Status Bar */}
      <div className="h-6 bg-slate-900/80 border-t border-white/5 flex items-center px-4 justify-between text-[10px] text-slate-500 select-none">
          <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                  <TerminalIcon size={10} />
                  SSH-2.0-OpenSSH
              </span>
              <span className="flex items-center gap-1.5 hover:text-sky-400 transition-colors cursor-help">
                  <Cpu size={10} />
                  UTF-8
              </span>
          </div>
          <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isFocused ? 'bg-sky-500' : 'bg-slate-600'}`} />
              {isFocused ? 'FOCUSED' : 'IDLE'}
          </div>
      </div>
    </motion.div>
  );
}
