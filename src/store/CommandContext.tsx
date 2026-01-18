import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { commands } from '../config/commands';

interface CommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  cwd: string;
}

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
  const [data, setData] = useState<Record<string, CommandResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [chartData, setChartData] = useState<Record<string, ChartDataPoint[]>>({});
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
  const prevNetworkBytes = useRef<{rx: number, tx: number, time: number} | null>(null);

  // Process command output to extract numeric value for chart
  const extractChartValue = (id: string, stdout: string): number | { rx: number, tx: number } | null => {
    try {
      if (id === 'network_stats') {
        const rxMatch = stdout.match(/RX:\s*(\d+)/);
        const txMatch = stdout.match(/TX:\s*(\d+)/);
        if (rxMatch && txMatch) {
          const rx = parseInt(rxMatch[1], 10);
          const tx = parseInt(txMatch[1], 10);
          const now = Date.now();
          let result = null;
          if (prevNetworkBytes.current) {
            const dt = (now - prevNetworkBytes.current.time) / 1000;
            if (dt > 0) {
              result = {
                rx: (rx - prevNetworkBytes.current.rx) / dt,
                tx: (tx - prevNetworkBytes.current.tx) / dt
              };
            }
          }
          prevNetworkBytes.current = { rx, tx, time: now };
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
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await invoke<CommandResult>('exec_command', { cmd, session_id: sessionId, timeout });
      setData(prev => ({ ...prev, [id]: res }));
      
      // Add to command history
      addCommandToHistory(cmd, res.exit_code === 0, sessionId);
      
      // Extract chart value and update chart data if it's a monitored command
      const chartValue = extractChartValue(id, res.stdout);
      if (chartValue !== null) {
        setChartData(prev => {
          const currentData = prev[id] || [];
          
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
          return { ...prev, [id]: updatedData };
        });
      }
    } catch (e: any) {
      console.error(`Command ${id} failed:`, e);
      setData(prev => ({ 
        ...prev, 
        [id]: { stdout: '', stderr: e.toString(), exit_code: 1, cwd: '' } 
      }));
      // Add to command history as failed
      addCommandToHistory(cmd, false, sessionId);
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
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
      const result = await invoke<string>('disconnect_ssh', { session_id: sessionId });
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
      // Clear existing data to prevent showing stale data from previous session
      clearData();
      clearChartData();
      
      const result = await invoke<string>('switch_session', { session_id: sessionId });
      
      // Manually update local state immediately to ensure UI responsiveness
      setSessions(prev => prev.map(s => ({
        ...s,
        is_current: s.id === sessionId
      })));
      
      // Find the session in the current state to update currentSession immediately
      // Note: we need to find it from the previous state or current sessions list
      const targetSession = sessions.find(s => s.id === sessionId);
      if (targetSession) {
          setCurrentSession({...targetSession, is_current: true});
      }

      // Then sync with backend to be sure
      await updateSessions();
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
    setProgress(0);
    setCurrentTaskId(null);
    
    // Filter commands based on targetIds if provided
    const targetCommands = targetIds 
        ? commands.filter(cmd => targetIds.includes(cmd.id))
        : commands;

    // Filter out commands that already have data if forceRefresh is false
    const commandsToRun = forceRefresh 
        ? targetCommands 
        : targetCommands.filter(cmd => !data[cmd.id]);

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
          const res = await invoke<CommandResult>('exec_command', { cmd: prereq, timeout: 5000 });
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
      setData(prev => ({ 
        ...prev, 
        [cmd.id]: { 
          stdout: '', 
          stderr: `Skipped: Prerequisite '${cmd.prerequisite}' failed`, 
          exit_code: 126, // Command invoked cannot execute
          cwd: '' 
        } 
      }));
      return false;
    });

    const totalRunnable = runnableCommands.length;
    let completedRunnable = 0;

    const processCommandResult = (id: string, cmd: string, res: CommandResult) => {
      addCommandToHistory(cmd, res.exit_code === 0);
      const chartValue = extractChartValue(id, res.stdout);
      if (chartValue !== null) {
        setChartData(prev => {
          const currentData = prev[id] || [];
          
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
          return { ...prev, [id]: updatedData };
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
      setLoading(prev => {
        const next = { ...prev };
        batchDefs.forEach(def => next[def.id] = true);
        return next;
      });

      try {
        const results = await invoke<Record<string, CommandResult>>('batch_exec_command', { 
          commands: batchRequest 
        });
        
        // Update data state
        setData(prev => {
           const next = { ...prev };
           Object.entries(results).forEach(([id, res]) => {
             next[id] = res;
           });
           return next;
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
        setData(prev => {
            const next = { ...prev };
            batchDefs.forEach(def => {
                next[def.id] = { 
                    stdout: '', 
                    stderr: `Batch execution failed: ${e}`, 
                    exit_code: 1, 
                    cwd: '' 
                };
            });
            return next;
        });
      } finally {
        // Clear loading state
        setLoading(prev => {
            const next = { ...prev };
            batchDefs.forEach(def => next[def.id] = false);
            return next;
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
    if (isMonitoring && monitoredCommandsRef.current.length > 0) {
      // Initial run
      monitoredCommandsRef.current.forEach(id => {
        const cmd = commands.find(c => c.id === id);
        if (cmd) {
          runCommand(id, cmd.command);
        }
      });
      
      // Set up interval
      monitorTimerRef.current = setInterval(() => {
        monitoredCommandsRef.current.forEach(id => {
          const cmd = commands.find(c => c.id === id);
          if (cmd) {
            runCommand(id, cmd.command);
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
  }, [isMonitoring, monitorInterval]);

  const getCommandData = (id: string) => data[id] || null;
  
  const getChartData = (id: string) => chartData[id] || [];
  
  const clearData = () => {
      setData({});
      setLoading({});
      setProgress(0);
      setCurrentTaskId(null);
  };
  
  const clearChartData = (id?: string) => {
    if (id) {
      setChartData(prev => {
        const newChartData = { ...prev };
        delete newChartData[id];
        return newChartData;
      });
    } else {
      setChartData({});
    }
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
        data, 
        loading, 
        progress, 
        currentTaskId, 
        chartData, 
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
