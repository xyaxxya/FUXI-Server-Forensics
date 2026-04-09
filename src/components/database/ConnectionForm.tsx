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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
              <h3 className="text-2xl font-bold text-slate-800">{t.connection_settings}</h3>
              <p className="mt-1 text-sm text-slate-500">Configure your FUXI Data Link parameters</p>
          </div>
          {onDelete && initialConfig && (
              <button onClick={() => onDelete(config.id)} className="ui-button-danger ui-pressable self-start rounded-2xl p-2.5 sm:self-auto">
                  <Trash2 size={20}/>
              </button>
          )}
      </div>

      <div className="ui-surface space-y-5 rounded-[1.7rem] p-4 sm:p-6">
        <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.connection_name}</label>
            <input 
              className="ui-input-base w-full rounded-2xl p-3 text-slate-800 placeholder-slate-400 font-medium" 
              value={config.name} 
              placeholder="My Database"
              onChange={e => setConfig({...config, name: e.target.value})}
            />
        </div>
        
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.host}</label>
            <input className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.host} onChange={e => setConfig({...config, host: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.port}</label>
            <input type="number" className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.port} onChange={e => setConfig({...config, port: parseInt(e.target.value)})} />
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.username}</label>
            <input className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.user} onChange={e => setConfig({...config, user: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.password}</label>
            <input type="password" className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.pass} onChange={e => setConfig({...config, pass: e.target.value})} />
          </div>
        </div>
        
        <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.database_optional}</label>
            <input className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.database} onChange={e => setConfig({...config, database: e.target.value})} />
        </div>
      </div>

      <div className="ui-surface space-y-5 rounded-[1.7rem] p-4 sm:p-6">
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
                  <div className="space-y-4 border-l-2 border-indigo-100 pt-2 pl-4 sm:pl-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.ssh_host}</label>
                      <input className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.ssh?.ip || ''} onChange={e => setConfig({...config, ssh: {...(config.ssh || {port: 22, user: '', pass: ''}), ip: e.target.value}})} />
                      </div>
                      <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.port}</label>
                      <input type="number" className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.ssh?.port || 22} onChange={e => setConfig({...config, ssh: {...(config.ssh || {ip: '', user: '', pass: ''}), port: parseInt(e.target.value)}})} />
                      </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.ssh_user}</label>
                      <input className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.ssh?.user || ''} onChange={e => setConfig({...config, ssh: {...(config.ssh || {ip: '', port: 22, pass: ''}), user: e.target.value}})} />
                      </div>
                      <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.ssh_password}</label>
                      <input type="password" className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.ssh?.pass || ''} onChange={e => setConfig({...config, ssh: {...(config.ssh || {ip: '', port: 22, user: ''}), pass: e.target.value}})} />
                      </div>
                  </div>
                  <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.private_key_path}</label>
                      <input className="ui-input-base w-full rounded-2xl p-3 text-slate-800 font-mono text-sm" value={config.ssh?.private_key || ''} onChange={e => setConfig({...config, ssh: {...(config.ssh || {ip: '', port: 22, user: '', pass: ''}), private_key: e.target.value}})} placeholder="/path/to/id_rsa" />
                  </div>
                  </div>
              </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button 
          onClick={handleTestConnection}
          disabled={connecting}
          className="ui-button ui-pressable inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 font-bold text-slate-600 disabled:opacity-50"
        >
            {connecting ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
            {t.test_connection}
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button onClick={onCancel} className="ui-button ui-pressable rounded-2xl px-5 py-2.5 font-medium text-slate-500 hover:text-slate-800">{t.cancel}</button>
            <motion.button 
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onSave(config)} 
              className="ui-button-primary ui-pressable flex items-center justify-center gap-2 rounded-2xl px-6 py-2.5 font-bold"
            >
                <Save size={18}/> {t.save}
            </motion.button>
        </div>
      </div>
    </div>
  );
}
