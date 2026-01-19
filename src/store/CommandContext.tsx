import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { commands } from '../config/commands';

interface CommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  cwd: string;
}

type CachedCommandResult = CommandResult & { ts: number };

interface BatchCommandRequest {
  id: string;
  cmd: string;
}

interface ChartDataPoint {
  time: string;
  value: number;
  value2?: number; // Optional second value for dual-line charts (e.g. RX/TX)
}

interface Session {
  id: string;
  ip: string;
  port: number;
  user: string;
  is_current: boolean;
}

interface CommandHistoryItem {
  id: string;
  cmd: string;
  timestamp: Date;
  success: boolean;
  sessionId?: string;
}

interface CustomCommand {
  id: string;
  name: string;
  cn_name: string;
  description: string;
  cn_description: string;
  command: string;
  category: string;
}

interface ServerGroup {
  id: string;
  name: string;
  description: string;
  sessionIds: string[];
  color: string;
}

interface CommandContextType {
  data: Record<string, CommandResult>;
  loading: Record<string, boolean>;
  progress: number;
  currentTaskId: string | null;
  chartData: Record<string, ChartDataPoint[]>;
  isMonitoring: boolean;
  monitorInterval: number;
  sessions: Session[];
  currentSession: Session | null;
  selectedSessionIds: string[];
  commandHistory: CommandHistoryItem[];
  customCommands: CustomCommand[];
  serverGroups: ServerGroup[];
  fetchAll: (targetIds?: string[], forceRefresh?: boolean) => Promise<void>;
  runCommand: (id: string, cmd: string, sessionId?: string) => Promise<void>;
  getCommandData: (id: string) => CommandResult | null;
  getChartData: (id: string) => ChartDataPoint[];
  startMonitoring: (commandIds: string[], interval: number) => void;
  stopMonitoring: () => void;
  clearData: () => void;
  clearChartData: (id?: string) => void;
  clearCommandHistory: () => void;
  connectSSH: (ip: string, port: number, user: string, pass: string) => Promise<string>;
  disconnectSSH: (sessionId?: string) => Promise<string>;
  listSessions: () => Promise<Session[]>;
  switchSession: (sessionId: string) => Promise<string>;
  toggleSessionSelection: (sessionId: string) => void;
  setSessionSelection: (sessionIds: string[]) => void;
  updateSessions: () => Promise<void>;
  addCommandToHistory: (cmd: string, success: boolean, sessionId?: string) => void;
  addCustomCommand: (command: Omit<CustomCommand, 'id'>) => void;
  removeCustomCommand: (id: string) => void;
  runCustomCommand: (id: string, sessionId?: string) => Promise<void>;
  addServerGroup: (group: Omit<ServerGroup, 'id'>) => void;
  updateServerGroup: (id: string, group: Partial<ServerGroup>) => void;
  removeServerGroup: (id: string) => void;
  addSessionToGroup: (groupId: string, sessionId: string) => void;
  removeSessionFromGroup: (groupId: string, sessionId: string) => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [dataBySession, setDataBySession] = useState<Record<string, Record<string, CachedCommandResult>>>({});
  const [loadingBySession, setLoadingBySession] = useState<Record<string, Record<string, boolean>>>({});
  const [progress, setProgress] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [chartBySession, setChartBySession] = useState<Record<string, Record<string, ChartDataPoint[]>>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorInterval, setMonitorInterval] = useState(3000); // Default 3 seconds
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);
  const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
  const monitorTimerRef = useRef<number | null>(null);
  const monitoredCommandsRef = useRef<string[]>([]);
  
  // Previous network bytes for rate calculation
  const prevNetworkBytesBySession = useRef<Record<string, {rx: number, tx: number, time: number} | null>>({});

  // Process command output to extract numeric value for chart
  const extractChartValue = (sessionId: string, id: string, stdout: string): number | { rx: number, tx: number } | null => {
    try {
      if (id === 'network_stats') {
        const rxMatch = stdout.match(/RX:\s*(\d+)/);
        const txMatch = stdout.match(/TX:\s*(\d+)/);
        if (rxMatch && txMatch) {
          const rx = parseInt(rxMatch[1], 10);
          const tx = parseInt(txMatch[1], 10);
          const now = Date.now();
          let result = null;
          const prev = prevNetworkBytesBySession.current[sessionId];
          if (prev) {
            const dt = (now - prev.time) / 1000;
            if (dt > 0) {
              result = {
                rx: (rx - prev.rx) / dt,
                tx: (tx - prev.tx) / dt
              };
            }
          }
          prevNetworkBytesBySession.current[sessionId] = { rx, tx, time: now };
          return result;
        }
        return null;
      } else if (id === 'cpu_usage') {
        // Example: "CPU: 25.5%"
        const match = stdout.match(/CPU:\s*(\d+\.\d+)%/);
        return match ? parseFloat(match[1]) : null;
      } else if (id === 'mem_usage') {
        // Example: "USE: 1.2G / 4.0G"
        const match = stdout.match(/USE:\s*(\d+(?:\.\d+)?)G\s*\/\s*(\d+(?:\.\d+)?)G/);
        if (match) {
          const used = parseFloat(match[1]);
          const total = parseFloat(match[2]);
          return total > 0 ? (used / total) * 100 : null;
        }
        return null;
      } else if (id === 'disk_usage') {
        // Example: "Use%: 45%"
        const match = stdout.match(/Use%:\s*(\d+)%/);
        return match ? parseFloat(match[1]) : null;
      } else if (id === 'load_avg') {
        // Example: "0.1 0.2 0.3" (take 1min load avg)
        const match = stdout.match(/^(\d+\.\d+)/);
        return match ? parseFloat(match[1]) : null;
      }
      // For other commands, try to extract any number
      const numMatch = stdout.match(/\b(\d+\.\d+)\b/);
      return numMatch ? parseFloat(numMatch[1]) : null;
    } catch (error) {
      console.error(`Error parsing chart value for ${id}:`, error);
      return null;
    }
  };

  const addCommandToHistory = (cmd: string, success: boolean, sessionId?: string) => {
    const historyItem: CommandHistoryItem = {
      id: crypto.randomUUID(),
      cmd,
      timestamp: new Date(),
      success,
      sessionId
    };
    setCommandHistory(prev => {
      // Keep only the last 100 command history items for performance
      const updated = [historyItem, ...prev].slice(0, 100);
      return updated;
    });
  };

  const clearCommandHistory = () => {
    setCommandHistory([]);
  };

  const runCommand = async (id: string, cmd: string, sessionId?: string, timeout?: number) => {
    const sid = sessionId || currentSession?.id;
    if (!sid) {
      throw new Error('No active session selected');
    }

    setLoadingBySession(prev => {
      const bucket = prev[sid] || {};
      return { ...prev, [sid]: { ...bucket, [id]: true } };
    });
    try {
      const res = await invoke<CommandResult>('exec_command', { cmd, sessionId: sid, timeout });
      const now = Date.now();
      setDataBySession(prev => {
        const bucket = prev[sid] || {};
        return { ...prev, [sid]: { ...bucket, [id]: { ...res, ts: now } } };
      });
      
      // Add to command history
      addCommandToHistory(cmd, res.exit_code === 0, sid);
      
      // Extract chart value and update chart data if it's a monitored command
      const chartValue = extractChartValue(sid, id, res.stdout);
      if (chartValue !== null) {
        setChartBySession(prev => {
          const sessionBucket = prev[sid] || {};
          const currentData = sessionBucket[id] || [];
          
          let val1: number;
          let val2: number | undefined;

          if (typeof chartValue === 'number') {
             val1 = chartValue;
          } else {
             val1 = chartValue.rx;
             val2 = chartValue.tx;
          }
          
          const newPoint = { time: new Date().toISOString(), value: val1, value2: val2 };
          // Keep only the last 50 data points for performance
          const updatedData = [...currentData, newPoint].slice(-50);
          return { ...prev, [sid]: { ...sessionBucket, [id]: updatedData } };
        });
      }
    } catch (e: any) {
      console.error(`Command ${id} failed:`, e);
      const now = Date.now();
      setDataBySession(prev => {
        const bucket = prev[sid] || {};
        return { 
          ...prev, 
          [sid]: { 
            ...bucket, 
            [id]: { stdout: '', stderr: e.toString(), exit_code: 1, cwd: '', ts: now } 
          } 
        };
      });
      // Add to command history as failed
      addCommandToHistory(cmd, false, sid);
    } finally {
      setLoadingBySession(prev => {
        const bucket = prev[sid] || {};
        return { ...prev, [sid]: { ...bucket, [id]: false } };
      });
    }
  };

  // SSH Session Management
  const connectSSH = async (ip: string, port: number, user: string, pass: string): Promise<string> => {
    try {
      const sessionId = await invoke<string>('connect_ssh', { ip, port, user, pass });
      await updateSessions();
      return sessionId;
    } catch (e: any) {
      console.error('Failed to connect SSH:', e);
      throw e;
    }
  };

  const disconnectSSH = async (sessionId?: string): Promise<string> => {
    try {
      const result = await invoke<string>('disconnect_ssh', { sessionId });

      if (sessionId) {
        setDataBySession(prev => {
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
        setLoadingBySession(prev => {
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
        setChartBySession(prev => {
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
        delete prevNetworkBytesBySession.current[sessionId];
      }

      await updateSessions();
      return result;
    } catch (e: any) {
      console.error('Failed to disconnect SSH:', e);
      throw e;
    }
  };

  const listSessions = async (): Promise<Session[]> => {
    try {
      const sessionList = await invoke<Session[]>('list_sessions');
      return sessionList;
    } catch (e: any) {
      console.error('Failed to list sessions:', e);
      return [];
    }
  };

  const switchSession = async (sessionId: string): Promise<string> => {
    try {
      setSessions(prev => {
        const next = prev.map(s => ({
          ...s,
          is_current: s.id === sessionId
        }));
        const target = next.find(s => s.id === sessionId);
        if (target) {
          setCurrentSession({ ...target, is_current: true });
        }
        return next;
      });

      const result = await invoke<string>('switch_session', { sessionId });

      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      let lastList: Session[] = [];
      let lastCurrent: Session | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        lastList = await listSessions();
        lastCurrent = lastList.find(s => s.is_current) || null;
        if (lastCurrent?.id === sessionId) break;
        await sleep(120);
        await invoke<string>('switch_session', { sessionId }).catch(() => undefined as any);
      }

      if (lastCurrent?.id !== sessionId) {
        setSessions(lastList);
        setCurrentSession(lastCurrent);
        throw new Error(`Switch session failed: backend current=${lastCurrent?.id ?? 'null'} target=${sessionId}`);
      }

      setSessions(lastList);
      setCurrentSession(lastCurrent);

      if (isMonitoring && monitoredCommandsRef.current.length > 0) {
        monitoredCommandsRef.current.forEach(id => {
          const def = commands.find(c => c.id === id);
          if (def) setTimeout(() => runCommand(id, def.command), 50);
        });
      }
      return result;
    } catch (e: any) {
      console.error('Failed to switch session:', e);
      // Try to update sessions list in case of error (e.g. session lost)
      await updateSessions();
      throw e;
    }
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessionIds(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const setSessionSelection = (sessionIds: string[]) => {
    setSelectedSessionIds(sessionIds);
  };

  const updateSessions = async (): Promise<void> => {
    const sessionList = await listSessions();
    setSessions(sessionList);
    // Set current session
    const current = sessionList.find(s => s.is_current) || null;
    setCurrentSession(current);
  };

  const fetchAll = async (targetIds?: string[], forceRefresh: boolean = false) => {
    const sid = currentSession?.id;
    if (!sid) {
      return;
    }
    setProgress(0);
    setCurrentTaskId(null);
    
    // Filter commands based on targetIds if provided
    const targetCommands = targetIds 
        ? commands.filter(cmd => targetIds.includes(cmd.id))
        : commands;

    // Filter out commands that already have data if forceRefresh is false
    const sessionData = dataBySession[sid] || {};
    const commandsToRun = forceRefresh 
        ? targetCommands 
        : targetCommands.filter(cmd => !sessionData[cmd.id]);

    const total = commandsToRun.length;
    
    // If all commands are already cached and we don't need to run anything
    if (total === 0) {
        setProgress(100);
        return;
    }

    const prereqs = [...new Set(commandsToRun.map(c => c.prerequisite).filter(Boolean))] as string[];
    const prereqResults: Record<string, boolean> = {};

    if (prereqs.length > 0) {
      // Run prerequisites in parallel
      await Promise.all(prereqs.map(async (prereq) => {
        // Use a temporary ID for prereq check
        try {
          // Short timeout for checks (5s)
          const res = await invoke<CommandResult>('exec_command', { cmd: prereq, sessionId: sid, timeout: 5000 });
          prereqResults[prereq] = res.exit_code === 0;
        } catch (e) {
          console.warn(`Prerequisite check failed: ${prereq}`, e);
          prereqResults[prereq] = false;
        }
      }));
    }

    // Filter commands based on prerequisites
    const runnableCommands = commandsToRun.filter(cmd => {
      if (!cmd.prerequisite) return true;
      if (prereqResults[cmd.prerequisite]) return true;
      
      // If prereq failed, mark command as skipped/failed immediately
      const now = Date.now();
      setDataBySession(prev => {
        const bucket = prev[sid] || {};
        return {
          ...prev,
          [sid]: {
            ...bucket,
            [cmd.id]: {
              stdout: '',
              stderr: `Skipped: Prerequisite '${cmd.prerequisite}' failed`,
              exit_code: 126,
              cwd: '',
              ts: now
            }
          }
        };
      });
      return false;
    });

    const totalRunnable = runnableCommands.length;
    let completedRunnable = 0;

    const processCommandResult = (id: string, cmd: string, res: CommandResult) => {
      addCommandToHistory(cmd, res.exit_code === 0, sid);
      const chartValue = extractChartValue(sid, id, res.stdout);
      if (chartValue !== null) {
        setChartBySession(prev => {
          const sessionBucket = prev[sid] || {};
          const currentData = sessionBucket[id] || [];
          
          let val1: number;
          let val2: number | undefined;

          if (typeof chartValue === 'number') {
             val1 = chartValue;
          } else {
             val1 = chartValue.rx;
             val2 = chartValue.tx;
          }

          const newPoint = { time: new Date().toISOString(), value: val1, value2: val2 };
          const updatedData = [...currentData, newPoint].slice(-50);
          return { ...prev, [sid]: { ...sessionBucket, [id]: updatedData } };
        });
      }
    };

    // Use larger batch size for backend batching
    // We use a larger batch size because we are now sending a single IPC call for multiple commands
    // which is much more efficient.
    const BATCH_SIZE = 10;

    for (let i = 0; i < totalRunnable; i += BATCH_SIZE) {
      const batchDefs = runnableCommands.slice(i, i + BATCH_SIZE);
      
      if (batchDefs.length > 0) {
          setCurrentTaskId(batchDefs[0].id);
      }

      // Prepare batch request
      const batchRequest: BatchCommandRequest[] = batchDefs.map(def => ({
        id: def.id,
        cmd: def.command
      }));

      // Set loading state
      setLoadingBySession(prev => {
        const bucket = prev[sid] || {};
        const nextBucket = { ...bucket };
        batchDefs.forEach(def => nextBucket[def.id] = true);
        return { ...prev, [sid]: nextBucket };
      });

      try {
        const results = await invoke<Record<string, CommandResult>>('batch_exec_command', { 
          commands: batchRequest,
          sessionId: sid
        });
        
        // Update data state
        const now = Date.now();
        setDataBySession(prev => {
           const bucket = prev[sid] || {};
           const nextBucket = { ...bucket };
           Object.entries(results).forEach(([id, res]) => {
             nextBucket[id] = { ...res, ts: now };
           });
           return { ...prev, [sid]: nextBucket };
        });

        // Process results (history, charts)
        Object.entries(results).forEach(([id, res]) => {
           const cmdDef = batchDefs.find(b => b.id === id);
           if (cmdDef) {
             processCommandResult(id, cmdDef.command, res);
           }
        });

      } catch (e: any) {
        console.error("Batch execution failed:", e);
        // Mark all in batch as failed
        const now = Date.now();
        setDataBySession(prev => {
            const bucket = prev[sid] || {};
            const nextBucket = { ...bucket };
            batchDefs.forEach(def => {
                nextBucket[def.id] = { 
                    stdout: '', 
                    stderr: `Batch execution failed: ${e}`, 
                    exit_code: 1, 
                    cwd: '',
                    ts: now
                };
            });
            return { ...prev, [sid]: nextBucket };
        });
      } finally {
        // Clear loading state
        setLoadingBySession(prev => {
            const bucket = prev[sid] || {};
            const nextBucket = { ...bucket };
            batchDefs.forEach(def => nextBucket[def.id] = false);
            return { ...prev, [sid]: nextBucket };
        });
      }
      
      completedRunnable += batchDefs.length;
      // Calculate progress based on original total
      setProgress(Math.round(((total - (totalRunnable - completedRunnable)) / total) * 100));
      
      // Small delay to allow UI updates between batches
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    setCurrentTaskId(null);
    setProgress(100);
  };

  const startMonitoring = (commandIds: string[], interval: number) => {
    // Stop any existing monitoring
    stopMonitoring();
    
    monitoredCommandsRef.current = commandIds;
    setMonitorInterval(interval);
    setIsMonitoring(true);
  };

  const stopMonitoring = () => {
    if (monitorTimerRef.current) {
      clearInterval(monitorTimerRef.current);
      monitorTimerRef.current = null;
    }
    setIsMonitoring(false);
  };

  // Effect for real-time monitoring
  useEffect(() => {
    const sid = currentSession?.id;
    if (sid && isMonitoring && monitoredCommandsRef.current.length > 0) {
      // Initial run
      monitoredCommandsRef.current.forEach(id => {
        const cmd = commands.find(c => c.id === id);
        if (cmd) {
          runCommand(id, cmd.command, sid);
        }
      });
      
      // Set up interval
      monitorTimerRef.current = setInterval(() => {
        monitoredCommandsRef.current.forEach(id => {
          const cmd = commands.find(c => c.id === id);
          if (cmd) {
            runCommand(id, cmd.command, sid);
          }
        });
      }, monitorInterval);
    }
    
    return () => {
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
        monitorTimerRef.current = null;
      }
    };
  }, [isMonitoring, monitorInterval, currentSession?.id]);

  const activeSessionId = currentSession?.id;
  const activeData = activeSessionId ? dataBySession[activeSessionId] || {} : {};
  const activeLoading = activeSessionId ? loadingBySession[activeSessionId] || {} : {};
  const activeChartData = activeSessionId ? chartBySession[activeSessionId] || {} : {};

  const getCommandData = (id: string) => (activeData as any)[id] || null;
  
  const getChartData = (id: string) => activeChartData[id] || [];
  
  const clearData = () => {
      const sid = currentSession?.id;
      if (!sid) {
        setDataBySession({});
        setLoadingBySession({});
        setChartBySession({});
        prevNetworkBytesBySession.current = {};
      } else {
        setDataBySession(prev => ({ ...prev, [sid]: {} }));
        setLoadingBySession(prev => ({ ...prev, [sid]: {} }));
        setChartBySession(prev => ({ ...prev, [sid]: {} }));
        delete prevNetworkBytesBySession.current[sid];
      }
      setProgress(0);
      setCurrentTaskId(null);
  };
  
  const clearChartData = (id?: string) => {
    const sid = currentSession?.id;
    if (!sid) {
      setChartBySession({});
      return;
    }
    if (!id) {
      setChartBySession(prev => ({ ...prev, [sid]: {} }));
      return;
    }
    setChartBySession(prev => {
      const bucket = prev[sid] || {};
      const nextBucket = { ...bucket };
      delete nextBucket[id];
      return { ...prev, [sid]: nextBucket };
    });
  };



  // Custom command management
  const addCustomCommand = (command: Omit<CustomCommand, 'id'>) => {
    const newCommand: CustomCommand = {
      ...command,
      id: `custom_${crypto.randomUUID()}`
    };
    setCustomCommands(prev => [...prev, newCommand]);
  };

  const removeCustomCommand = (id: string) => {
    setCustomCommands(prev => prev.filter(cmd => cmd.id !== id));
  };

  const runCustomCommand = async (id: string, sessionId?: string) => {
    const customCmd = customCommands.find(cmd => cmd.id === id);
    if (customCmd) {
      await runCommand(id, customCmd.command, sessionId);
    }
  };

  // Server group management
  const addServerGroup = (group: Omit<ServerGroup, 'id'>) => {
    const newGroup: ServerGroup = {
      ...group,
      id: `group_${crypto.randomUUID()}`
    };
    setServerGroups(prev => [...prev, newGroup]);
  };

  const updateServerGroup = (id: string, group: Partial<ServerGroup>) => {
    setServerGroups(prev => prev.map(g => 
      g.id === id ? { ...g, ...group } : g
    ));
  };

  const removeServerGroup = (id: string) => {
    setServerGroups(prev => prev.filter(g => g.id !== id));
  };

  const addSessionToGroup = (groupId: string, sessionId: string) => {
    setServerGroups(prev => prev.map(g => {
      if (g.id === groupId && !g.sessionIds.includes(sessionId)) {
        return { ...g, sessionIds: [...g.sessionIds, sessionId] };
      }
      return g;
    }));
  };

  const removeSessionFromGroup = (groupId: string, sessionId: string) => {
    setServerGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, sessionIds: g.sessionIds.filter(id => id !== sessionId) };
      }
      return g;
    }));
  };

  return (
    <CommandContext.Provider 
      value={{ 
        data: activeData as any, 
        loading: activeLoading, 
        progress, 
        currentTaskId, 
        chartData: activeChartData, 
        isMonitoring, 
        monitorInterval,
        sessions,
        currentSession,
        selectedSessionIds,
        commandHistory,
        customCommands,
        serverGroups,
        fetchAll, 
        runCommand, 
        getCommandData, 
        getChartData,
        startMonitoring,
        stopMonitoring,
        clearData,
        clearChartData,
        clearCommandHistory,
        connectSSH,
        disconnectSSH,
        listSessions,
        switchSession,
        toggleSessionSelection,
        setSessionSelection,
        updateSessions,
        addCommandToHistory,
        addCustomCommand,
        removeCustomCommand,
        runCustomCommand,
        addServerGroup,
        updateServerGroup,
        removeServerGroup,
        addSessionToGroup,
        removeSessionFromGroup
      }}>
      {children}
    </CommandContext.Provider>
  );
}

export function useCommandStore() {
  const context = useContext(CommandContext);
  if (context === undefined) {
    throw new Error('useCommandStore must be used within a CommandProvider');
  }
  return context;
}
