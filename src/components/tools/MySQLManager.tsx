import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, Table, X, 
  ChevronRight, ChevronDown, Server,
  ArrowRight, Loader2, Plus, Shield, Trash2,
  Play, RotateCw, Save, FileCode, Layout
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { translations, Language } from '../../translations';

interface MySQLManagerProps {
  onClose: () => void;
  language?: Language;
}

interface SshConfig {
  ip: string;
  port: number;
  user: string;
  pass?: string;
  private_key?: string;
}

interface DBConfig {
  id: string; // Unique ID for connection
  name: string;
  user: string;
  pass: string;
  host: string;
  port: number;
  database: string;
  useSsh: boolean;
  ssh?: SshConfig;
}

interface DbQueryResult {
  headers: string[];
  rows: string[][];
  affected_rows: number;
  last_insert_id: number | null;
}

interface Tab {
  id: string;
  type: 'query' | 'table';
  title: string;
  query: string; // SQL for Query tab, Table Name for Table tab
  result: DbQueryResult | null;
  error: string | null;
  loading: boolean;
  page: number; // For pagination
}

export default function MySQLManager({ onClose, language = 'en' }: MySQLManagerProps) {
  const t = translations[language];
  // State
  const [connections, setConnections] = useState<DBConfig[]>(() => {
    const saved = localStorage.getItem('db_connections');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeConnection, setActiveConnection] = useState<string | null>(null); // Connected DB ID
  const [editingConfig, setEditingConfig] = useState<DBConfig | null>(null); // Config being edited/created
  
  const [connecting, setConnecting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  // Manager State
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [expandedDbs, setExpandedDbs] = useState<string[]>([]);

  // Tabs
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('db_connections', JSON.stringify(connections));
  }, [connections]);

  const handleCreate = () => {
    setEditingConfig({
      id: crypto.randomUUID(),
      name: t.new_connection,
      user: 'root',
      pass: '',
      host: '127.0.0.1',
      port: 3306,
      database: '',
      useSsh: false,
      ssh: {
        ip: '',
        port: 22,
        user: 'root',
        pass: ''
      }
    });
  };

  const handleSave = () => {
    if (!editingConfig) return;
    setConnections(prev => {
      const idx = prev.findIndex(c => c.id === editingConfig.id);
      if (idx >= 0) {
        const newConns = [...prev];
        newConns[idx] = editingConfig;
        return newConns;
      }
      return [...prev, editingConfig];
    });
    setEditingConfig(null);
  };

  const handleDeleteConnection = (id: string) => {
    if (confirm(t.delete_connection_confirm)) {
        setConnections(prev => prev.filter(c => c.id !== id));
        if (editingConfig?.id === id) setEditingConfig(null);
    }
  };

  const handleTestConnection = async () => {
    if (!editingConfig) return;
    setConnecting(true);
    setGlobalError(null);
    const tempId = "test_" + crypto.randomUUID();
    try {
        const sshConfig = editingConfig.useSsh ? editingConfig.ssh : undefined;
        await invoke('connect_db', {
            id: tempId,
            host: editingConfig.host,
            port: editingConfig.port,
            user: editingConfig.user,
            pass: editingConfig.pass,
            database: editingConfig.database || 'mysql',
            sshConfig: sshConfig
        });
        alert(t.connection_successful);
        await invoke('disconnect_db', { id: tempId });
    } catch (e: any) {
        alert(t.connection_failed_prefix + e.toString());
    } finally {
        setConnecting(false);
    }
  };

  const handleConnect = async (config: DBConfig) => {
    setConnecting(true);
    setGlobalError(null);
    try {
      // If SSH is enabled, validate SSH config
      const sshConfig = config.useSsh ? config.ssh : undefined;
      
      await invoke('connect_db', {
        id: config.id,
        host: config.host,
        port: config.port,
        user: config.user,
        pass: config.pass,
        database: config.database || 'mysql', 
        sshConfig: sshConfig
      });
      
      setActiveConnection(config.id);
      
      // Fetch Databases
      const res = await invoke<DbQueryResult>('exec_sql', {
        id: config.id,
        query: 'SHOW DATABASES;'
      });
      
      const dbs = res.rows.map(r => r[0]);
      setDatabases(dbs);
      setEditingConfig(null); // Close editor if open
      
    } catch (e: any) {
      setGlobalError(e.toString());
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeConnection) return;
    try {
      await invoke('disconnect_db', { id: activeConnection });
      setActiveConnection(null);
      setDatabases([]);
      setSelectedDb(null);
      setTables([]);
      setTabs([]);
      setActiveTabId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const createTab = (type: 'query' | 'table', title: string, content: string = '') => {
    const newTab: Tab = {
        id: crypto.randomUUID(),
        type,
        title,
        query: content,
        result: null,
        error: null,
        loading: false,
        page: 0
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return newTab;
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
        const newTabs = prev.filter(t => t.id !== id);
        if (activeTabId === id && newTabs.length > 0) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        } else if (newTabs.length === 0) {
            setActiveTabId(null);
        }
        return newTabs;
    });
  };

  const updateTab = (id: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const execTabQuery = async (tabId: string, sql: string) => {
    if (!activeConnection) return;
    
    updateTab(tabId, { loading: true, error: null });
    
    try {
      const res = await invoke<DbQueryResult>('exec_sql', {
        id: activeConnection,
        query: sql
      });
      updateTab(tabId, { result: res, loading: false });
    } catch (e: any) {
      updateTab(tabId, { error: e.toString(), loading: false });
    }
  };

  const selectDatabase = async (db: string) => {
    if (expandedDbs.includes(db)) {
      setExpandedDbs(prev => prev.filter(d => d !== db));
      return;
    }
    setExpandedDbs(prev => [...prev, db]);
    setSelectedDb(db);
    
    try {
      await invoke('exec_sql', {
        id: activeConnection,
        query: `USE ${db};`
      });
      
      const res = await invoke<DbQueryResult>('exec_sql', {
        id: activeConnection,
        query: 'SHOW TABLES;'
      });
      
      setTables(res.rows.map(r => r[0]));
    } catch (e: any) {
      setGlobalError(e.toString());
    }
  };
  
  const selectTable = async (table: string) => {
    // Check if tab already exists
    const existingTab = tabs.find(t => t.type === 'table' && t.title === table);
    if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
    }

    const newTab = createTab('table', table, table);
    // Initial fetch
    execTabQuery(newTab.id, `SELECT * FROM ${table} LIMIT 100;`);
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-[90vw] h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{t.db_manager_title}</h2>
              <p className="text-xs text-slate-500">{t.db_manager_subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Sidebar: Connections & Tree */}
          <div className="w-64 bg-slate-50 border-r flex flex-col shrink-0">
            {!activeConnection ? (
              <div className="p-2 space-y-2">
                <button 
                  onClick={handleCreate}
                  className="w-full flex items-center justify-center gap-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Plus size={16} /> {t.new_connection}
                </button>
                <div className="space-y-1 mt-2">
                  {connections.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 hover:bg-slate-200 rounded-lg group cursor-pointer" onClick={() => setEditingConfig(c)}>
                      <div className="flex items-center gap-2 truncate">
                        <Server size={14} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{c.name}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleConnect(c); }}
                        className="p-1.5 bg-green-100 text-green-600 rounded opacity-0 group-hover:opacity-100 hover:bg-green-200 transition-all"
                        title={t.ok_status || "Connect"}
                      >
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                 <div className="p-2 border-b bg-green-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-green-700 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      {t.connected}
                    </span>
                    <button onClick={handleDisconnect} className="text-xs text-red-500 hover:underline">{t.disconnect}</button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2">
                    {databases.map(db => (
                      <div key={db}>
                        <div 
                          className={`flex items-center gap-1 p-1.5 rounded cursor-pointer hover:bg-slate-200 ${selectedDb === db ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}`}
                          onClick={() => selectDatabase(db)}
                        >
                          {expandedDbs.includes(db) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <Database size={14} />
                          <span className="text-sm truncate">{db}</span>
                        </div>
                        {expandedDbs.includes(db) && selectedDb === db && (
                          <div className="pl-4 border-l ml-2 border-slate-200">
                             {tables.map(tb => (
                               <div 
                                 key={tb} 
                                 className="flex items-center gap-1 p-1.5 rounded cursor-pointer hover:bg-slate-200 text-slate-600 hover:text-blue-600"
                                 onClick={() => selectTable(tb)}
                               >
                                 <Table size={12} />
                                 <span className="text-xs truncate">{tb}</span>
                               </div>
                             ))}
                          </div>
                        )}
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </div>

          {/* Main Area */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden w-0">
            {editingConfig ? (
               <div className="p-8 max-w-2xl mx-auto w-full overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800">{t.connection_settings}</h3>
                      {connections.some(c => c.id === editingConfig.id) && (
                          <button onClick={() => handleDeleteConnection(editingConfig.id)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                              <Trash2 size={18}/>
                          </button>
                      )}
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                      <label className="block text-sm font-medium text-slate-700">{t.connection_name}</label>
                      <input 
                        className="w-full p-2 border rounded bg-white" 
                        value={editingConfig.name} 
                        onChange={e => setEditingConfig({...editingConfig, name: e.target.value})}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">{t.host}</label>
                          <input className="w-full p-2 border rounded bg-white" value={editingConfig.host} onChange={e => setEditingConfig({...editingConfig, host: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700">{t.port}</label>
                          <input type="number" className="w-full p-2 border rounded bg-white" value={editingConfig.port} onChange={e => setEditingConfig({...editingConfig, port: parseInt(e.target.value)})} />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">{t.username}</label>
                          <input className="w-full p-2 border rounded bg-white" value={editingConfig.user} onChange={e => setEditingConfig({...editingConfig, user: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700">{t.password}</label>
                          <input type="password" className="w-full p-2 border rounded bg-white" value={editingConfig.pass} onChange={e => setEditingConfig({...editingConfig, pass: e.target.value})} />
                        </div>
                      </div>
                      
                      <div>
                          <label className="block text-sm font-medium text-slate-700">{t.database_optional}</label>
                          <input className="w-full p-2 border rounded bg-white" value={editingConfig.database} onChange={e => setEditingConfig({...editingConfig, database: e.target.value})} />
                      </div>
                    </div>

                    {/* SSH Tunnel */}
                    <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                      <div className="flex items-center gap-2 mb-2">
                        <input 
                          type="checkbox" 
                          id="useSsh"
                          checked={editingConfig.useSsh} 
                          onChange={e => setEditingConfig({...editingConfig, useSsh: e.target.checked})}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="useSsh" className="font-bold text-slate-700 flex items-center gap-2 cursor-pointer">
                          <Shield size={16} /> {t.use_ssh_tunnel}
                        </label>
                      </div>
                      
                      {editingConfig.useSsh && (
                        <div className="space-y-4 pl-6 border-l-2 border-slate-200">
                          {(!editingConfig.ssh) && (() => {
                             // Initialize SSH config if missing
                             const newSsh = { ip: '', port: 22, user: 'root', pass: '' };
                             setEditingConfig({...editingConfig, ssh: newSsh});
                             return null;
                          })()}
                          <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                              <label className="block text-sm font-medium text-slate-700">{t.ssh_host}</label>
                              <input className="w-full p-2 border rounded bg-white" value={editingConfig.ssh?.ip || ''} onChange={e => setEditingConfig({...editingConfig, ssh: {...editingConfig.ssh!, ip: e.target.value}})} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700">{t.port}</label>
                              <input type="number" className="w-full p-2 border rounded bg-white" value={editingConfig.ssh?.port || 22} onChange={e => setEditingConfig({...editingConfig, ssh: {...editingConfig.ssh!, port: parseInt(e.target.value)}})} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700">{t.ssh_user}</label>
                              <input className="w-full p-2 border rounded bg-white" value={editingConfig.ssh?.user || ''} onChange={e => setEditingConfig({...editingConfig, ssh: {...editingConfig.ssh!, user: e.target.value}})} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700">{t.ssh_password}</label>
                              <input type="password" className="w-full p-2 border rounded bg-white" value={editingConfig.ssh?.pass || ''} onChange={e => setEditingConfig({...editingConfig, ssh: {...editingConfig.ssh!, pass: e.target.value}})} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700">{t.private_key_path}</label>
                            <input className="w-full p-2 border rounded bg-white" value={editingConfig.ssh?.private_key || ''} onChange={e => setEditingConfig({...editingConfig, ssh: {...editingConfig.ssh!, private_key: e.target.value}})} placeholder="/path/to/id_rsa" />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-between pt-4 border-t">
                      <button 
                        onClick={handleTestConnection}
                        disabled={connecting}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors flex items-center gap-2"
                      >
                         {connecting ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
                         {t.test_connection}
                      </button>
                      <div className="flex gap-3">
                          <button onClick={() => setEditingConfig(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">{t.cancel}</button>
                          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm flex items-center gap-2">
                              <Save size={16}/> {t.save}
                          </button>
                      </div>
                    </div>
                  </div>
               </div>
            ) : activeConnection ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                 {/* Tabs Bar */}
                 <div className="flex items-center bg-slate-100 border-b overflow-x-auto">
                    {tabs.map(tab => (
                        <div 
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2 text-sm border-r cursor-pointer select-none min-w-[120px] max-w-[200px]
                                ${activeTabId === tab.id ? 'bg-white font-medium text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-600 hover:bg-slate-200'}
                            `}
                        >
                            {tab.type === 'query' ? <FileCode size={14} className="shrink-0"/> : <Table size={14} className="shrink-0"/>}
                            <span className="truncate flex-1">{tab.title}</span>
                            <button onClick={(e) => closeTab(tab.id, e)} className="p-0.5 rounded-full hover:bg-slate-300 opacity-50 hover:opacity-100">
                                <X size={12}/>
                            </button>
                        </div>
                    ))}
                    <button 
                        onClick={() => createTab('query', t.new_query, '')}
                        className="px-3 py-2 text-slate-500 hover:bg-slate-200 border-r"
                        title={t.new_query}
                    >
                        <Plus size={16}/>
                    </button>
                 </div>

                 {/* Tab Content */}
                 <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {activeTab ? (
                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            {/* Toolbar */}
                            <div className="p-2 border-b flex gap-2 items-center bg-white">
                                <button 
                                    onClick={() => execTabQuery(activeTab.id, activeTab.type === 'query' ? activeTab.query : `SELECT * FROM ${activeTab.title} LIMIT 100`)} 
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                                    disabled={activeTab.loading || (activeTab.type === 'query' && !activeTab.query)}
                                >
                                    {activeTab.loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 
                                    {activeTab.type === 'query' ? t.run : t.refresh}
                                </button>
                                {activeTab.type === 'table' && (
                                    <span className="text-xs text-slate-400 ml-2">{t.displaying_top_100}</span>
                                )}
                            </div>

                            {/* Query Editor (Only for Query Tabs) */}
                            {activeTab.type === 'query' && (
                                <div className="h-40 border-b relative group">
                                    <textarea 
                                        className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none bg-slate-50 text-slate-800" 
                                        placeholder="SELECT * FROM table..."
                                        value={activeTab.query}
                                        onChange={e => updateTab(activeTab.id, { query: e.target.value })}
                                        spellCheck={false}
                                    />
                                </div>
                            )}

                            {/* Results */}
                            <div className="flex-1 overflow-auto bg-white relative">
                                {activeTab.result ? (
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-2 border-b border-r w-10 bg-slate-50 text-slate-400 text-center">#</th>
                                                {activeTab.result.headers.map((h, i) => (
                                                    <th key={i} className="p-2 border-b border-r font-semibold text-slate-700 min-w-[100px] whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeTab.result.rows.map((row, i) => (
                                                <tr key={i} className="hover:bg-blue-50 group">
                                                    <td className="p-2 border-b border-r text-xs text-slate-400 text-center bg-slate-50 group-hover:bg-blue-50">{i + 1}</td>
                                                    {row.map((cell, j) => (
                                                        <td key={j} className="p-2 border-b border-r text-slate-600 truncate max-w-[300px]" title={cell}>{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        {activeTab.loading ? (
                                            <div className="flex flex-col items-center">
                                                <Loader2 size={32} className="animate-spin mb-2 text-blue-500"/>
                                                <p>{t.executing_query}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <Layout size={48} className="mb-4 opacity-20" />
                                                <p>{t.no_results}</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer Status */}
                            <div className="p-1 px-3 bg-slate-100 border-t text-xs text-slate-500 flex gap-4 shrink-0">
                                {activeTab.result ? (
                                    <>
                                        <span>{t.rows}: {activeTab.result.rows.length}</span>
                                        <span>{t.affected}: {activeTab.result.affected_rows}</span>
                                        {activeTab.result.last_insert_id && <span>{t.insert_id}: {activeTab.result.last_insert_id}</span>}
                                    </>
                                ) : (
                                    <span>{t.ready}</span>
                                )}
                                {activeTab.error && (
                                    <span className="text-red-500 font-medium flex items-center gap-1">
                                        <X size={12}/> {t.error_status || "Error"}: {activeTab.error}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <Database size={48} className="mb-4 opacity-20" />
                            <p>{t.select_table_hint}</p>
                        </div>
                    )}
                 </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Server size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-600">{t.no_connection_selected}</h3>
                <p className="text-sm mt-1">{t.no_connection_desc}</p>
                {connecting && (
                   <div className="mt-4 flex items-center gap-2 text-blue-600">
                     <Loader2 size={16} className="animate-spin" /> {t.connecting}
                   </div>
                )}
                {globalError && (
                   <div className="mt-4 max-w-md text-center text-red-500 bg-red-50 p-2 rounded border border-red-200">
                     {globalError}
                   </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
