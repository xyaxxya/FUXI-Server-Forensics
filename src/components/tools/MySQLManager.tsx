import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, Table, X, 
  ChevronRight, ChevronDown, Server,
  ArrowRight, Loader2, Plus,
  Play, FileCode, Layout,
  Eye, Scroll, Archive, Sparkles,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { translations, Language } from '../../translations';
import { AISettings, sendToAI } from '../../lib/ai';
import { useDbStore, DBConfig } from '../../lib/dbStore';
import ConnectionForm from '../database/ConnectionForm';

interface MySQLManagerProps {
  onClose: () => void;
  language?: Language;
  aiSettings?: AISettings;
}

// Interfaces SshConfig and DBConfig are imported from dbStore


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

export default function MySQLManager({ onClose, language = 'en', aiSettings, onAiSettingsChange }: MySQLManagerProps & { onAiSettingsChange?: (settings: AISettings) => void }) {
  const t = translations[language];
  // State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const { 
     connections, 
     activeConnectionId: activeConnection, 
     activeDatabase: selectedDb,
     databases,
     addConnection,
     updateConnection,
     removeConnection,
     setActiveConnection,
     setActiveDatabase: setSelectedDb,
     setDatabases
   } = useDbStore();
 
   const [editingConfig, setEditingConfig] = useState<DBConfig | null>(null); // Config being edited/created
   
   const [connecting, setConnecting] = useState(false);
   const [globalError, setGlobalError] = useState<string | null>(null);
   
   // Manager State
   // databases is now from store
   // selectedDb is now from store
  
  interface DbObjects {
    tables: string[];
    views: string[];
    functions: string[];
    backups: string[]; // Placeholder for now
  }
  
  const [dbObjects, setDbObjects] = useState<Record<string, DbObjects>>({});
  const [expandedDbs, setExpandedDbs] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, string[]>>({}); // db -> ['tables', 'views']

  // Tabs
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

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

  const handleSave = (config: DBConfig) => {
    const exists = connections.some(c => c.id === config.id);
    if (exists) {
      updateConnection(config);
    } else {
      addConnection(config);
    }
    setEditingConfig(null);
  };

  const handleDeleteConnection = (id: string) => {
    if (confirm(t.delete_connection_confirm)) {
        removeConnection(id);
        if (editingConfig?.id === id) setEditingConfig(null);
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
      // setTables([]); // Removed as it is not defined
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
        query: sql,
        db: selectedDb // Pass the selected database context
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
    
    // Auto expand Tables folder by default
    setExpandedFolders(prev => ({
        ...prev,
        [db]: [...(prev[db] || []), 'tables']
    }));

    try {
      const res = await invoke<DbQueryResult>('exec_sql', {
        id: activeConnection,
        query: `SHOW FULL TABLES FROM \`${db}\`;`
      });
      
      const tables: string[] = [];
      const views: string[] = [];
      
      res.rows.forEach(row => {
          if (row[1] === 'VIEW') {
              views.push(row[0]);
          } else {
              tables.push(row[0]);
          }
      });

      // Try to fetch functions (might fail if no permissions, but we try)
      let functions: string[] = [];
      try {
          const funcRes = await invoke<DbQueryResult>('exec_sql', {
            id: activeConnection,
            query: `SHOW FUNCTION STATUS WHERE Db = '${db}';`
          });
          functions = funcRes.rows.map(r => r[1]); // Name is usually 2nd col in SHOW FUNCTION STATUS
      } catch (e) {
          console.warn("Could not fetch functions", e);
      }

      setDbObjects(prev => ({ 
          ...prev, 
          [db]: { 
              tables, 
              views, 
              functions,
              backups: [] 
          } 
      }));
    } catch (e: any) {
      setGlobalError(e.toString());
    }
  };
  
  const toggleFolder = (db: string, folder: string) => {
      setExpandedFolders(prev => {
          const current = prev[db] || [];
          const isOpen = current.includes(folder);
          return {
              ...prev,
              [db]: isOpen ? current.filter(f => f !== folder) : [...current, folder]
          };
      });
  };

  const selectTable = async (db: string, table: string) => {
    // Check if tab already exists
    const existingTab = tabs.find(t => t.type === 'table' && t.title === table);
    if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
    }

    const newTab = createTab('table', table, table);
    // Initial fetch using fully qualified name
    execTabQuery(newTab.id, `SELECT * FROM \`${db}\`.\`${table}\` LIMIT 100;`);
  };

  const SQL_KEYWORDS = ["SELECT", "INSERT", "UPDATE", "DELETE", "FROM", "WHERE", "AND", "OR", "ORDER BY", "GROUP BY", "LIMIT", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "ON", "AS", "DISTINCT", "VALUES", "SET", "CREATE", "TABLE", "DATABASE", "DROP", "ALTER", "SHOW", "USE", "DESCRIBE", "NULL", "NOT", "IN", "BETWEEN", "LIKE", "IS", "EXISTS", "HAVING", "COUNT", "MAX", "MIN", "AVG", "SUM"];

  // Auto-completion State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });

  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>, tabId: string) => {
    const val = e.target.value;
    updateTab(tabId, { query: val });

    const textarea = e.target;
    const cursor = textarea.selectionStart;
    
    // Find the word being typed
    const textBeforeCursor = val.substring(0, cursor);
    const words = textBeforeCursor.split(/[\s\n(),;]+/); // Split by delimiters
    const currentWord = words[words.length - 1];

    if (currentWord.length >= 1) {
        let candidates: string[] = [];
        const TABLE_CONTEXT_KEYWORDS = ["FROM", "JOIN", "UPDATE", "INTO", "DESCRIBE", "TABLE"];
        const DB_CONTEXT_KEYWORDS = ["USE", "DATABASE", "SCHEMA"];

        // 0. Check for "db.table" pattern
        if (currentWord.includes('.')) {
            const parts = currentWord.split('.');
            if (parts.length === 2) {
                const dbName = parts[0];
                // If we have cached objects for this db
                if (dbObjects[dbName]) {
                     candidates = [...(dbObjects[dbName].tables || []), ...(dbObjects[dbName].views || [])];
                }
            }
        } else {
            // Context Awareness Logic using Last Keyword
            // Sort keywords by length desc to match "ORDER BY" before "ORDER"
            const sortedKeywords = [...SQL_KEYWORDS].sort((a, b) => b.length - a.length);
            // Escape keywords for regex just in case
            const patternStr = `\\b(${sortedKeywords.join('|')})\\b`;
            const keywordRegex = new RegExp(patternStr, 'gi');
            
            let lastKeyword = "";
            let match;
            while ((match = keywordRegex.exec(textBeforeCursor)) !== null) {
                // Check if this keyword is NOT the current word being typed
                if (match.index + match[0].length < cursor - currentWord.length) {
                    lastKeyword = match[0].toUpperCase();
                }
            }

            const currentDb = selectedDb || connections.find(c => c.id === activeConnection)?.database;

            if (TABLE_CONTEXT_KEYWORDS.includes(lastKeyword)) {
                // Suggest Tables, Views from current DB
                if (currentDb && dbObjects[currentDb]) {
                    candidates = [...(dbObjects[currentDb].tables || []), ...(dbObjects[currentDb].views || [])];
                }
                // Also suggest databases (e.g. FROM other_db.table)
                candidates = [...candidates, ...databases];
            } else if (DB_CONTEXT_KEYWORDS.includes(lastKeyword)) {
                // Suggest Databases
                candidates = databases;
            } else {
                // Default: Keywords
                candidates = SQL_KEYWORDS;
                // Optional: Include tables/columns in default context too?
                // User wants "smarter". In SELECT list, tables are useful for aliases.
                // But let's prioritize keywords to keep it clean, unless matches are few?
            }
        }

        // Filter candidates
        // If "db.table", we filter against the part after dot
        let filterText = currentWord;
        if (currentWord.includes('.')) {
            filterText = currentWord.split('.')[1];
        }

        const matches = Array.from(new Set(candidates)).filter(k => 
            k.toLowerCase().startsWith(filterText.toLowerCase()) && 
            k.toLowerCase() !== filterText.toLowerCase()
        );

        if (matches.length > 0) {
            setSuggestions(matches.slice(0, 10)); // Limit to 10 suggestions
            setShowSuggestions(true);
            setSuggestionIndex(0);
            
            // Calculate approximate position
            const lines = textBeforeCursor.split('\n');
            const lineIndex = lines.length - 1;
            const charIndex = lines[lineIndex].length - currentWord.length; // Align with start of word
            
            // Approximate measurements
            const top = (lineIndex + 1) * 20 + 10; 
            const left = charIndex * 8.5 + 20;

            setSuggestionPos({ top, left });
            return;
        }
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, tabId: string) => {
    if (showSuggestions) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSuggestionIndex(prev => (prev + 1) % suggestions.length);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            const textarea = e.currentTarget;
            const cursor = textarea.selectionStart;
            const value = textarea.value;
            const textBeforeCursor = value.substring(0, cursor);
            const words = textBeforeCursor.split(/[\s\n]+/);
            const currentWord = words[words.length - 1];
            
            const completion = suggestions[suggestionIndex];
            const newValue = value.substring(0, cursor - currentWord.length) + completion + value.substring(cursor);
            
            updateTab(tabId, { query: newValue });
            setShowSuggestions(false);
            
            requestAnimationFrame(() => {
                textarea.selectionStart = textarea.selectionEnd = cursor - currentWord.length + completion.length;
            });
            return;
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            return;
        }
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        // Basic Tab Indentation
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        
        updateTab(tabId, { query: newValue });
        
        // Restore cursor position
        requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
    }
  };

  const createNewQuery = (initialSql: string = '') => {
      createTab('query', t.new_query, initialSql);
  };

  const handleAIQuery = async () => {
    if (!aiPrompt.trim()) return;
    if (!activeConnection || !selectedDb) {
        setAiError(language === 'zh' ? "请先连接数据库并选择一个数据库" : "Please connect to a database and select one first");
        return;
    }
    if (!aiSettings) {
        setAiError(language === 'zh' ? "AI 设置不可用" : "AI Settings not available");
        return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
        // 1. Fetch Schema
        // We use information_schema to get tables and columns for the selected DB
        const schemaRes = await invoke<DbQueryResult>('exec_sql', {
            id: activeConnection,
            query: `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${selectedDb}' ORDER BY TABLE_NAME, ORDINAL_POSITION;`
        });

        // 2. Format Schema
        let schemaStr = "";
        let currentTable = "";
        if (schemaRes.rows.length === 0) {
             // Fallback if permission denied or empty
             schemaStr = "No schema information available or database is empty.";
        } else {
            schemaRes.rows.forEach(row => {
                if (row[0] !== currentTable) {
                    currentTable = row[0];
                    schemaStr += `\nTable: ${currentTable}\nColumns:\n`;
                }
                const comment = row[3] ? ` // ${row[3]}` : '';
                schemaStr += `- ${row[1]} (${row[2]})${comment}\n`;
            });
        }

        // 3. Send to AI
        const prompt = `
Context: You are a SQL expert.
Database Schema (${selectedDb}):
${schemaStr}

User Request: ${aiPrompt}

Task: Generate a single valid MySQL query to answer the request.
Constraints:
- Return ONLY the SQL code.
- No markdown formatting (no \`\`\`).
- No explanations.
- Use fully qualified table names if needed or just standard names.
`;

        const response = await sendToAI(
            [{ role: 'user', content: prompt }],
            aiSettings
        );

        if (response.usage && onAiSettingsChange) {
            const currentUsage = aiSettings.tokenUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
            onAiSettingsChange({
                ...aiSettings,
                tokenUsage: {
                    prompt_tokens: currentUsage.prompt_tokens + response.usage.prompt_tokens,
                    completion_tokens: currentUsage.completion_tokens + response.usage.completion_tokens,
                    total_tokens: currentUsage.total_tokens + response.usage.total_tokens,
                }
            });
        }

        let sql = response.content.trim();
        // Strip markdown if present
        if (sql.startsWith('```sql')) sql = sql.replace(/```sql\n?/, '').replace(/```$/, '');
        else if (sql.startsWith('```')) sql = sql.replace(/```\n?/, '').replace(/```$/, '');
        
        sql = sql.trim();

        // 4. Create Query Tab
        createNewQuery(sql);
        setShowAIModal(false);
        setAiPrompt("");

    } catch (e: any) {
        setAiError(e.message || e.toString());
    } finally {
        setAiLoading(false);
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-200/60 backdrop-blur-sm p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-[90vw] h-[90vh] bg-white rounded-2xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-xl shadow-lg shadow-indigo-200"
            >
              <Database size={20} />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight font-display">FUXI SQL</h2>
              <p className="text-xs text-slate-500 font-medium tracking-wide flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Data Intelligence Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
                onClick={() => setShowAIModal(true)}
                className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-2 font-medium text-sm mr-2"
                title="AI SQL Helper"
            >
                <Sparkles size={18} />
                <span className="hidden sm:inline">AI Query</span>
            </button>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose} 
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden bg-slate-50/50">
          
          {/* Sidebar: Connections & Tree */}
          <div className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-10">
            {!activeConnection ? (
              <div className="p-4 space-y-4">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 font-semibold text-sm group"
                >
                  <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
                  {t.new_connection}
                </motion.button>
                <div className="space-y-2 mt-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Saved Links</h3>
                  {connections.map(c => (
                    <motion.div 
                      key={c.id} 
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl group cursor-pointer border border-transparent hover:border-slate-100 transition-all" 
                      onClick={() => setEditingConfig(c)}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-500 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                            <Server size={16} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{c.name}</span>
                            <span className="text-[10px] text-slate-400 group-hover:text-slate-500">{c.host}</span>
                        </div>
                      </div>
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); handleConnect(c); }}
                        className="p-2 bg-emerald-50 text-emerald-600 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-emerald-500 hover:text-white transition-all"
                        title={t.ok_status || "Connect"}
                      >
                        <ArrowRight size={14} />
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                 <div className="p-4 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-2 uppercase tracking-wider">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      {t.connected}
                    </span>
                    <button onClick={handleDisconnect} className="text-[10px] font-medium px-2 py-1 rounded bg-white text-red-500 border border-red-100 hover:bg-red-50 transition-colors uppercase tracking-wide shadow-sm">
                        {t.disconnect}
                    </button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {databases.map(db => (
                      <div key={db} className="mb-1">
                        <div 
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all group ${
                              selectedDb === db 
                              ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-sm' 
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                          onClick={() => selectDatabase(db)}
                        >
                          {expandedDbs.includes(db) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <Database size={14} className={selectedDb === db ? "text-indigo-500" : "text-slate-400"} />
                          <span className="text-sm truncate flex-1">{db}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); createNewQuery(`USE ${db};\nSELECT * FROM `); }}
                            className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="New Query in this DB"
                          >
                             <FileCode size={12} />
                          </button>
                        </div>
                        <AnimatePresence>
                            {expandedDbs.includes(db) && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                  <div className="pl-4 border-l ml-3 border-slate-200 mt-1 space-y-0.5">
                                     {/* Tables Folder */}
                                     <div className="mt-1">
                                        <div 
                                            className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); toggleFolder(db, 'tables'); }}
                                        >
                                            {expandedFolders[db]?.includes('tables') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            <Table size={12} />
                                            <span className="text-xs font-semibold">Tables</span>
                                            <span className="text-[10px] text-slate-400 ml-auto">{dbObjects[db]?.tables.length || 0}</span>
                                        </div>
                                        {expandedFolders[db]?.includes('tables') && (
                                            <div className="pl-4 border-l ml-2 border-slate-100 mt-0.5">
                                                {dbObjects[db]?.tables.map(tb => (
                                                <div 
                                                    key={tb} 
                                                    className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors group/table"
                                                    onClick={() => selectTable(db, tb)}
                                                >
                                                    <Table size={12} className="group-hover/table:text-indigo-500 transition-colors opacity-50" />
                                                    <span className="text-xs truncate font-mono flex-1">{tb}</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); createNewQuery(`SELECT * FROM \`${db}\`.\`${tb}\` LIMIT 100;`); }}
                                                        className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 opacity-0 group-hover/table:opacity-100 transition-opacity"
                                                        title="Query Table"
                                                    >
                                                        <FileCode size={10} />
                                                    </button>
                                                </div>
                                                ))}
                                            </div>
                                        )}
                                     </div>

                                     {/* Views Folder */}
                                     <div className="mt-0.5">
                                        <div 
                                            className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); toggleFolder(db, 'views'); }}
                                        >
                                            {expandedFolders[db]?.includes('views') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            <Eye size={12} />
                                            <span className="text-xs font-semibold">Views</span>
                                            <span className="text-[10px] text-slate-400 ml-auto">{dbObjects[db]?.views.length || 0}</span>
                                        </div>
                                        {expandedFolders[db]?.includes('views') && (
                                            <div className="pl-4 border-l ml-2 border-slate-100 mt-0.5">
                                                {dbObjects[db]?.views.map(view => (
                                                <div 
                                                    key={view} 
                                                    className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors group/view"
                                                    onClick={() => selectTable(db, view)}
                                                >
                                                    <Eye size={12} className="group-hover/view:text-indigo-500 transition-colors opacity-50" />
                                                    <span className="text-xs truncate font-mono flex-1">{view}</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); createNewQuery(`SELECT * FROM \`${db}\`.\`${view}\` LIMIT 100;`); }}
                                                        className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 opacity-0 group-hover/view:opacity-100 transition-opacity"
                                                        title="Query View"
                                                    >
                                                        <FileCode size={10} />
                                                    </button>
                                                </div>
                                                ))}
                                            </div>
                                        )}
                                     </div>

                                     {/* Functions Folder */}
                                     <div className="mt-0.5">
                                        <div 
                                            className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); toggleFolder(db, 'functions'); }}
                                        >
                                            {expandedFolders[db]?.includes('functions') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            <Scroll size={12} />
                                            <span className="text-xs font-semibold">Functions</span>
                                            <span className="text-[10px] text-slate-400 ml-auto">{dbObjects[db]?.functions.length || 0}</span>
                                        </div>
                                        {expandedFolders[db]?.includes('functions') && (
                                            <div className="pl-4 border-l ml-2 border-slate-100 mt-0.5">
                                                {dbObjects[db]?.functions.map(func => (
                                                <div 
                                                    key={func} 
                                                    className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                                                >
                                                    <Scroll size={12} className="opacity-50" />
                                                    <span className="text-xs truncate font-mono flex-1">{func}</span>
                                                </div>
                                                ))}
                                            </div>
                                        )}
                                     </div>

                                     {/* Backups Folder (Placeholder) */}
                                     <div className="mt-0.5">
                                        <div 
                                            className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); toggleFolder(db, 'backups'); }}
                                        >
                                            {expandedFolders[db]?.includes('backups') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            <Archive size={12} />
                                            <span className="text-xs font-semibold">Backups</span>
                                        </div>
                                        {expandedFolders[db]?.includes('backups') && (
                                            <div className="pl-4 border-l ml-2 border-slate-100 mt-0.5">
                                                <div className="p-2 text-[10px] text-slate-400 italic text-center">
                                                    No backups found
                                                </div>
                                            </div>
                                        )}
                                     </div>

                                  </div>
                              </motion.div>
                            )}
                        </AnimatePresence>
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </div>

          {/* Main Area */}
          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden w-0 relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.4] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
            />

            {editingConfig ? (
               <div className="p-8 max-w-3xl mx-auto w-full overflow-y-auto custom-scrollbar relative z-10">
                  <ConnectionForm 
                    initialConfig={editingConfig}
                    onSave={handleSave}
                    onCancel={() => setEditingConfig(null)}
                    onDelete={handleDeleteConnection}
                    language={language}
                  />
               </div>
            ) : activeConnection ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 bg-white">
                 {/* Tabs Bar */}
                 <div className="flex items-center bg-slate-50 border-b border-slate-200">
                    <div className="flex-1 flex items-center overflow-x-auto custom-scrollbar">
                        {tabs.map(tab => (
                            <div 
                                key={tab.id}
                                onClick={() => setActiveTabId(tab.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-3 text-xs border-r border-slate-200 cursor-pointer select-none min-w-[140px] max-w-[220px] transition-colors group whitespace-nowrap
                                    ${activeTabId === tab.id ? 'bg-white font-bold text-indigo-600 border-t-2 border-t-indigo-500 shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 bg-slate-50'}
                                `}
                            >
                                {tab.type === 'query' ? <FileCode size={14} className="shrink-0 opacity-70"/> : <Table size={14} className="shrink-0 opacity-70"/>}
                                <span className="truncate flex-1">{tab.title}</span>
                                <button onClick={(e) => closeTab(tab.id, e)} className="p-0.5 rounded-full hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500">
                                    <X size={12}/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => createNewQuery()}
                        className="px-4 py-3 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 border-l border-slate-200 transition-colors flex items-center gap-2 font-bold text-xs shrink-0 bg-slate-50 z-10 shadow-sm"
                        title={t.new_query}
                    >
                        <Plus size={16}/> {t.new_query}
                    </button>
                 </div>

                 {/* Tab Content */}
                 <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {activeTab ? (
                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            {/* Toolbar */}
                            <div className="p-2 border-b border-slate-200 flex justify-between items-center bg-white">
                                <div className="flex items-center gap-2">
                                    <motion.button 
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => execTabQuery(activeTab.id, activeTab.type === 'query' ? activeTab.query : `SELECT * FROM ${activeTab.title} LIMIT 100`)} 
                                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        disabled={activeTab.loading || (activeTab.type === 'query' && !activeTab.query)}
                                    >
                                        {activeTab.loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 
                                        {activeTab.type === 'query' ? t.run : t.refresh}
                                    </motion.button>
                                    {activeTab.type === 'table' && (
                                        <span className="text-xs text-slate-500 ml-2 font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200">{t.displaying_top_100}</span>
                                    )}
                                </div>
                                
                                {/* Current Database Indicator (Navicat style) */}
                                <div className="relative flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
                                    <Database size={12} className="text-indigo-500" />
                                    <span className="text-xs text-slate-500 font-medium">DB:</span>
                                    <select
                                        value={selectedDb || connections.find(c => c.id === activeConnection)?.database || ''}
                                        onChange={(e) => {
                                            const db = e.target.value;
                                            if (db) {
                                                if (!expandedDbs.includes(db)) {
                                                    selectDatabase(db);
                                                } else {
                                                    setSelectedDb(db);
                                                }
                                            }
                                        }}
                                        className="text-xs font-bold text-slate-700 font-mono bg-transparent border-none focus:ring-0 cursor-pointer outline-none py-0 pl-0 pr-8 appearance-none relative z-10"
                                        style={{ backgroundImage: 'none' }} 
                                    >
                                        {databases.length === 0 && (
                                            <option value={selectedDb || connections.find(c => c.id === activeConnection)?.database || 'mysql'}>
                                                {selectedDb || connections.find(c => c.id === activeConnection)?.database || 'mysql'}
                                            </option>
                                        )}
                                        {databases.map(db => (
                                            <option key={db} value={db}>{db}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={12} className="text-slate-400 absolute right-3 pointer-events-none" />
                                </div>
                            </div>

                            {/* Query Editor (Only for Query Tabs) */}
                            {activeTab.type === 'query' && (
                                <div className="h-48 border-b border-slate-200 relative group bg-slate-50">
                                    <textarea 
                                        className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none bg-slate-50 text-slate-800 selection:bg-indigo-100 relative z-10 bg-transparent" 
                                        placeholder="SELECT * FROM table..."
                                        value={activeTab.query}
                                        onChange={e => handleQueryChange(e, activeTab.id)}
                                        onKeyDown={e => handleKeyDown(e, activeTab.id)}
                                        spellCheck={false}
                                        onClick={() => setShowSuggestions(false)}
                                    />
                                    <AnimatePresence>
                                        {showSuggestions && (
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="absolute z-20 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden min-w-[150px] flex flex-col"
                                                style={{ top: suggestionPos.top, left: suggestionPos.left }}
                                            >
                                                {suggestions.map((s, i) => (
                                                    <div 
                                                        key={s} 
                                                        className={`px-3 py-1.5 text-xs font-mono cursor-pointer hover:bg-indigo-50 flex items-center justify-between ${i === suggestionIndex ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-600'}`}
                                                        onClick={() => {
                                                        // Manually trigger completion for mouse click (simplified)
                                                        // const completion = s;
                                                        // const cursor = activeTab.query.length; // Approximate, ideally use ref
                                                        // This is a bit tricky with React state, better to use keyboard for now or full implementation
                                                    }}
                                                    >
                                                        <span>{s}</span>
                                                        {i === suggestionIndex && <span className="text-[10px] text-indigo-400">Tab</span>}
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Results */}
                            <div className="flex-1 overflow-auto bg-white relative custom-scrollbar">
                                {activeTab.result ? (
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-3 border-b border-slate-200 border-r border-slate-100 w-12 text-slate-400 text-center font-mono text-xs bg-slate-50">#</th>
                                                {activeTab.result.headers.map((h, i) => (
                                                    <th key={i} className="p-3 border-b border-slate-200 border-r border-slate-100 font-bold text-slate-600 min-w-[100px] whitespace-nowrap text-xs uppercase tracking-wider bg-slate-50">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeTab.result.rows.map((row, i) => (
                                                <tr key={i} className="hover:bg-indigo-50/50 group transition-colors even:bg-slate-50/30">
                                                    <td className="p-2 border-b border-slate-100 border-r border-slate-100 text-xs text-slate-400 text-center font-mono group-hover:text-slate-600">{i + 1}</td>
                                                    {row.map((cell, j) => (
                                                        <td key={j} className="p-2 border-b border-slate-100 border-r border-slate-100 text-slate-600 truncate max-w-[300px] font-mono text-xs group-hover:text-slate-900 selection:bg-indigo-100" title={cell}>{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        {activeTab.loading ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-indigo-200 blur-xl rounded-full"></div>
                                                    <Loader2 size={40} className="animate-spin text-indigo-500 relative z-10"/>
                                                </div>
                                                <p className="text-sm font-bold text-slate-500 animate-pulse">{t.executing_query}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="p-6 bg-slate-50 rounded-full mb-4 border border-slate-100">
                                                    <Layout size={48} className="opacity-20 text-slate-400" />
                                                </div>
                                                <p className="text-sm font-bold text-slate-500">{t.no_results}</p>
                                                <p className="text-xs text-slate-400 mt-1">Execute a query to see results here</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer Status */}
                            <div className="p-2 px-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex gap-6 shrink-0 font-mono">
                                {activeTab.result ? (
                                    <>
                                        <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {t.rows}: <span className="text-slate-700 font-bold">{activeTab.result.rows.length}</span></span>
                                        <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> {t.affected}: <span className="text-slate-700 font-bold">{activeTab.result.affected_rows}</span></span>
                                        {activeTab.result.last_insert_id && <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t.insert_id}: <span className="text-slate-700 font-bold">{activeTab.result.last_insert_id}</span></span>}
                                    </>
                                ) : (
                                    <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t.ready}</span>
                                )}
                                {activeTab.error && (
                                    <span className="text-red-500 font-medium flex items-center gap-2 ml-auto">
                                        <X size={12} className="bg-red-100 p-0.5 rounded-full box-content"/> {t.error_status || "Error"}: {activeTab.error}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100 shadow-sm">
                                <Database size={40} className="opacity-30 text-indigo-400" />
                            </div>
                            <p className="text-lg font-bold text-slate-600">{t.select_table_hint}</p>
                            <p className="text-sm mt-2 max-w-xs text-center leading-relaxed text-slate-400">Select a table from the sidebar or open a new query tab to get started.</p>
                        </div>
                    )}
                 </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 relative z-10">
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-slate-200 border border-slate-100 relative group"
                >
                  <div className="absolute inset-0 bg-indigo-100 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  <Server size={48} className="text-slate-300 group-hover:text-indigo-500 transition-colors relative z-10" />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-700">{t.no_connection_selected}</h3>
                <p className="text-sm mt-2 text-slate-400 max-w-sm text-center leading-relaxed">{t.no_connection_desc}</p>
                {connecting && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="mt-8 flex items-center gap-3 px-4 py-2 bg-indigo-50 text-indigo-500 rounded-full border border-indigo-100"
                   >
                     <Loader2 size={16} className="animate-spin" /> 
                     <span className="text-xs font-bold tracking-wide uppercase">{t.connecting}</span>
                   </motion.div>
                )}
                {globalError && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="mt-6 max-w-md text-center text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 text-sm shadow-sm"
                   >
                     {globalError}
                   </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI Query Modal */}
        <AnimatePresence>
            {showAIModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
                    >
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white">
                            <div className="flex items-center gap-2 text-indigo-600 font-bold">
                                <Sparkles size={18} />
                                <span>AI SQL Generator</span>
                            </div>
                            <button onClick={() => setShowAIModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {language === 'zh' ? '描述你的查询需求' : 'Describe your query'}
                                </label>
                                <textarea 
                                    className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none text-sm text-slate-700 placeholder-slate-400 font-sans"
                                    placeholder={language === 'zh' ? "例如：查询最近注册的10个用户..." : "e.g. Find top 10 recent users..."}
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            
                            {aiError && (
                                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                                    {aiError}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button 
                                    onClick={() => setShowAIModal(false)}
                                    className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                                >
                                    {t.cancel}
                                </button>
                                <button 
                                    onClick={handleAIQuery}
                                    disabled={aiLoading || !aiPrompt.trim()}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all"
                                >
                                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    {language === 'zh' ? '生成 SQL' : 'Generate SQL'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
}