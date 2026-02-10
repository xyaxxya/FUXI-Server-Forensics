import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Trash2, RotateCw, Save, Loader2 
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { translations, Language } from '../../translations';
import { DBConfig } from '../../lib/dbStore';

interface ConnectionFormProps {
  initialConfig?: DBConfig | null;
  onSave: (config: DBConfig) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  language: Language;
}

export default function ConnectionForm({ 
  initialConfig, 
  onSave, 
  onCancel, 
  onDelete, 
  language 
}: ConnectionFormProps) {
  const t = translations[language];
  
  const [config, setConfig] = useState<DBConfig>(() => {
    if (initialConfig) return initialConfig;
    return {
      id: crypto.randomUUID(),
      name: t.new_connection || "New Connection",
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
    };
  });

  const [connecting, setConnecting] = useState(false);

  const handleTestConnection = async () => {
    setConnecting(true);
    const tempId = "test_" + crypto.randomUUID();
    try {
        const sshConfig = config.useSsh ? config.ssh : undefined;
        await invoke('connect_db', {
            id: tempId,
            host: config.host,
            port: config.port,
            user: config.user,
            pass: config.pass,
            database: config.database || 'mysql',
            sshConfig: sshConfig
        });
        alert(t.connection_successful || "Connection Successful");
        await invoke('disconnect_db', { id: tempId });
    } catch (e: any) {
        alert((t.connection_failed_prefix || "Connection Failed: ") + e.toString());
    } finally {
        setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
          <div>
              <h3 className="text-2xl font-bold text-slate-800">{t.connection_settings}</h3>
              <p className="text-slate-500 text-sm mt-1">Configure your FUXI Data Link parameters</p>
          </div>
          {onDelete && initialConfig && (
              <button onClick={() => onDelete(config.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2.5 rounded-xl transition-colors">
                  <Trash2 size={20}/>
              </button>
          )}
      </div>

      <div className="space-y-5 p-6 border border-slate-200 rounded-2xl bg-white shadow-sm">
        <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.connection_name}</label>
            <input 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder-slate-400 font-medium" 
              value={config.name} 
              placeholder="My Database"
              onChange={e => setConfig({...config, name: e.target.value})}
            />
        </div>
        
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.host}</label>
            <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.host} onChange={e => setConfig({...config, host: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.port}</label>
            <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.port} onChange={e => setConfig({...config, port: parseInt(e.target.value)})} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.username}</label>
            <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.user} onChange={e => setConfig({...config, user: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.password}</label>
            <input type="password" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.pass} onChange={e => setConfig({...config, pass: e.target.value})} />
          </div>
        </div>
        
        <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.database_optional}</label>
            <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.database} onChange={e => setConfig({...config, database: e.target.value})} />
        </div>
      </div>

      {/* SSH Tunnel */}
      <div className="space-y-5 p-6 border border-slate-200 rounded-2xl bg-white shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="relative flex items-center">
              <input 
                type="checkbox" 
                id="useSsh"
                checked={config.useSsh} 
                onChange={e => {
                    const checked = e.target.checked;
                    setConfig(prev => ({
                        ...prev, 
                        useSsh: checked,
                        // Initialize SSH config if turning on and it's missing
                        ssh: checked && !prev.ssh ? { ip: '', port: 22, user: 'root', pass: '' } : prev.ssh
                    }));
                }}
                className="peer sr-only"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" onClick={() => {
                  // Allow clicking the toggle track to trigger change
                  const checkbox = document.getElementById('useSsh') as HTMLInputElement;
                  if(checkbox) checkbox.click();
              }}></div>
          </div>
          <label htmlFor="useSsh" className="font-bold text-slate-700 flex items-center gap-2 cursor-pointer select-none">
            <Shield size={16} className="text-indigo-500" /> {t.use_ssh_tunnel}
          </label>
        </div>
        
        <AnimatePresence>
          {config.useSsh && (
              <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
              >
                  <div className="space-y-4 pl-6 border-l-2 border-indigo-100 pt-2">
                  <div className="grid grid-cols-3 gap-5">
                      <div className="col-span-2 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.ssh_host}</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.ssh?.ip || ''} onChange={e => setConfig({...config, ssh: {...(config.ssh || {port: 22, user: '', pass: ''}), ip: e.target.value}})} />
                      </div>
                      <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.port}</label>
                      <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.ssh?.port || 22} onChange={e => setConfig({...config, ssh: {...(config.ssh || {ip: '', user: '', pass: ''}), port: parseInt(e.target.value)}})} />
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.ssh_user}</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.ssh?.user || ''} onChange={e => setConfig({...config, ssh: {...(config.ssh || {ip: '', port: 22, pass: ''}), user: e.target.value}})} />
                      </div>
                      <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.ssh_password}</label>
                      <input type="password" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.ssh?.pass || ''} onChange={e => setConfig({...config, ssh: {...(config.ssh || {ip: '', port: 22, user: ''}), pass: e.target.value}})} />
                      </div>
                  </div>
                  <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.private_key_path}</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm" value={config.ssh?.private_key || ''} onChange={e => setConfig({...config, ssh: {...(config.ssh || {ip: '', port: 22, user: '', pass: ''}), private_key: e.target.value}})} placeholder="/path/to/id_rsa" />
                  </div>
                  </div>
              </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="flex justify-between pt-6 border-t border-slate-200">
        <button 
          onClick={handleTestConnection}
          disabled={connecting}
          className="px-5 py-2.5 bg-white text-slate-600 rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-all flex items-center gap-2 border border-slate-200 font-bold shadow-sm disabled:opacity-50"
        >
            {connecting ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
            {t.test_connection}
        </button>
        <div className="flex gap-4">
            <button onClick={onCancel} className="px-5 py-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors font-medium">{t.cancel}</button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSave(config)} 
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2 font-bold"
            >
                <Save size={18}/> {t.save}
            </motion.button>
        </div>
      </div>
    </div>
  );
}
