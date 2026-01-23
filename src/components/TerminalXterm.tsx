import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCommandStore } from '../store/CommandContext';
import { translations, Language } from '../translations';
import FileManager from './FileManager';
import { FolderOpen, X, RefreshCw } from 'lucide-react';

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
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.3,
      allowTransparency: true,
      theme: {
        background: 'transparent',
        foreground: '#f1f5f9',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

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

    // 3. Polling for visibility changes (Critical for when tab becomes visible)
    // This ensures that if the terminal was hidden during init, it fits correctly when shown
    const intervalId = setInterval(handleResize, 800);

    // Initial fit
    setTimeout(handleResize, 100);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (ptyIdRef.current) {
          invoke('stop_pty_session', { id: ptyIdRef.current }).catch(console.error);
      }
      term.dispose();
    };
  }, [targetSessionId, retryCount]);

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
    <div className="flex flex-col h-full glass-dark rounded-2xl overflow-hidden border border-white/10 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/10 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <div className={`w-1.5 h-1.5 rounded-full ${connecting ? 'bg-amber-400 animate-pulse' : error ? 'bg-red-400' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'}`} />
                <span className="text-xs font-medium text-slate-200 tracking-wide">
                    {targetSession ? `${targetSession.user}@${targetSession.ip}` : t.no_session}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-1">
            <button 
                onClick={() => setRetryCount(c => c + 1)}
                className="p-2 text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all duration-300"
                title="Reconnect SSH Session"
            >
                <RefreshCw size={16} />
            </button>
            <button 
                onClick={() => setShowFileManager(!showFileManager)} 
                className={`p-2 rounded-lg transition-all duration-300 ${showFileManager ? 'bg-sky-500/20 text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.2)]' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                title="Toggle File Manager"
            >
                <FolderOpen size={16} />
            </button>
            <button 
                onClick={onClose} 
                className="p-2 text-slate-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-300 ml-1"
                title={t.terminal_close}
            >
                <X size={16} />
            </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative w-full h-full overflow-hidden bg-transparent">
          <div ref={terminalRef} className="absolute inset-0 p-4" />
        </div>
        
        {showFileManager && (
            <div className="w-80 border-l border-white/10 glass-dark flex flex-col animate-in slide-in-from-right duration-300 backdrop-blur-3xl shadow-[-10px_0_30px_rgba(0,0,0,0.2)]">
                 <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <span className="text-xs font-bold text-slate-200 tracking-wider flex items-center gap-2 uppercase">
                        <FolderOpen size={14} className="text-sky-400"/>
                        FUXI_SFTP_ACCESS
                    </span>
                    <button onClick={() => setShowFileManager(false)} className="text-slate-500 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors">
                        <X size={14} />
                    </button>
                 </div>
                 <div className="flex-1 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-sky-500/5 to-transparent pointer-events-none" />
                    <FileManager sessionId={targetSessionId || ''} />
                 </div>
            </div>
        )}
      </div>
    </div>
  );
}
