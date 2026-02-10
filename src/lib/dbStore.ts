import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SshConfig {
  ip: string;
  port: number;
  user: string;
  pass?: string;
  private_key?: string;
}

export interface DBConfig {
  id: string;
  name: string;
  user: string;
  pass: string;
  host: string;
  port: number;
  database: string;
  useSsh: boolean;
  ssh?: SshConfig;
}

interface DbState {
  connections: DBConfig[];
  activeConnectionId: string | null;
  activeDatabase: string | null; // The currently selected database schema (e.g. 'users_db')
  databases: string[]; // List of available databases for the active connection
  
  // Actions
  setConnections: (conns: DBConfig[]) => void;
  addConnection: (conn: DBConfig) => void;
  updateConnection: (conn: DBConfig) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  setActiveDatabase: (db: string | null) => void;
  setDatabases: (dbs: string[]) => void;
}

export const useDbStore = create<DbState>()(
  persist(
    (set) => ({
      connections: [],
      activeConnectionId: null,
      activeDatabase: null,
      databases: [],

      setConnections: (connections) => set({ connections }),
      addConnection: (conn) => set((state) => ({ connections: [...state.connections, conn] })),
      updateConnection: (conn) => set((state) => ({
        connections: state.connections.map((c) => (c.id === conn.id ? conn : c)),
      })),
      removeConnection: (id) => set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
        // If we delete the active connection, reset active state
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        activeDatabase: state.activeConnectionId === id ? null : state.activeDatabase,
        databases: state.activeConnectionId === id ? [] : state.databases,
      })),
      setActiveConnection: (id) => set({ activeConnectionId: id }),
      setActiveDatabase: (db) => set({ activeDatabase: db }),
      setDatabases: (dbs) => set({ databases: dbs }),
    }),
    {
      name: 'db_connections', // Match the key used by previous localStorage implementation
      storage: createJSONStorage(() => localStorage),
      // Only persist connections, not active state (as active state is runtime only)
      partialize: (state) => ({ connections: state.connections }),
    }
  )
);
