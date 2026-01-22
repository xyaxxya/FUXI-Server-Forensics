import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCommandStore } from '../store/CommandContext';
import { translations, Language } from '../translations';

export default function TerminalXterm({ onClose, sessionId, language }: { onClose: () => void, sessionId?: string, language: Language }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const { sessions, currentSession } = useCommandStore();
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = translations[language];

  // Use passed sessionId or fallback to currentSession (for backward compatibility)
  const targetSessionId = sessionId || currentSession?.id;
  // Get session details from store
  const targetSession = sessions.find(s => s.id === targetSessionId);

  useEffect(() => {
    if (!terminalRef.current) return;

    // 1. Initialize Xterm
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1e293b',
        foreground: '#f8fafc',
        cursor: '#38bdf8',
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

    // Resize observer
    const handleResize = () => {
        if (fitAddonRef.current && ptyIdRef.current) {
            fitAddonRef.current.fit();
            invoke('resize_pty', { 
                id: ptyIdRef.current, 
                cols: xtermRef.current?.cols, 
                rows: xtermRef.current?.rows 
            }).catch(console.error);
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ptyIdRef.current) {
          invoke('stop_pty_session', { id: ptyIdRef.current }).catch(console.error);
      }
      term.dispose();
    };
  }, [targetSessionId]);

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
    <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connecting ? 'bg-yellow-400 animate-pulse' : error ? 'bg-red-500' : 'bg-green-400'}`}></div>
            <span className="text-xs font-mono text-slate-300">
                {targetSession ? `${targetSession.user}@${targetSession.ip}` : t.terminal_title} (xterm.js)
            </span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xs uppercase font-bold tracking-wider">
            {t.terminal_close}
        </button>
      </div>
      <div className="flex-1 relative p-1">
        <div ref={terminalRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
