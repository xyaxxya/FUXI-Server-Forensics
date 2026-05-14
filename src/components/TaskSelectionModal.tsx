import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Play, Layers, Info } from 'lucide-react';
import { commands, PluginCommand } from '../config/commands';
import { translations, Language } from '../translations';

interface TaskSelectionModalProps {
  isOpen: boolean;
  onExecute: (selectedIds: string[]) => void;
  onCancel: () => void;
  language: Language;
}

export default function TaskSelectionModal({ isOpen, onExecute, onCancel, language }: TaskSelectionModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(commands.map(c => c.id)));
  const t = translations[language];

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, PluginCommand[]> = {};
    commands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, []);

  const toggleCommand = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleCategory = (category: string) => {
    const categoryCmds = groupedCommands[category];
    const allSelected = categoryCmds.every(c => selectedIds.has(c.id));
    
    const newSet = new Set(selectedIds);
    categoryCmds.forEach(c => {
      if (allSelected) {
        newSet.delete(c.id);
      } else {
        newSet.add(c.id);
      }
    });
    setSelectedIds(newSet);
  };

  const handleExecute = () => {
    onExecute(Array.from(selectedIds));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/18 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="ui-shell flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/60 bg-white/42 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#0078D4] to-[#50E6FF] text-white shadow-[0_14px_28px_rgba(0,120,212,0.22)]">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{t.task_queue}</h2>
                <p className="text-sm text-slate-500">{t.task_queue_desc}</p>
              </div>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-[#0078D4]">
              {t.selected_count.replace('{0}', selectedIds.size.toString()).replace('{1}', commands.length.toString())}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-sky-50/24 p-6 custom-scrollbar">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(groupedCommands).map(([category, cmds]) => {
                const isAllSelected = cmds.every(c => selectedIds.has(c.id));
                const isPartial = !isAllSelected && cmds.some(c => selectedIds.has(c.id));

                return (
                  <div key={category} className="overflow-hidden rounded-[24px] border border-white/76 bg-white/78 shadow-[0_12px_28px_rgba(42,79,120,0.08)]">
                    <div 
                        onClick={() => toggleCategory(category)}
                        className="flex cursor-pointer items-center justify-between border-b border-slate-200/60 bg-white/54 px-4 py-3 transition-colors hover:bg-sky-50"
                    >
                      <span className="font-semibold text-slate-700 capitalize">{t[category as keyof typeof t] || category}</span>
                      <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${isAllSelected ? 'border-[#0078D4] bg-[#0078D4]' : isPartial ? 'border-[#0078D4] bg-[#0078D4]/50' : 'border-slate-300'}`}>
                        {isAllSelected && <Check size={12} className="text-white" />}
                        {isPartial && <div className="w-2 h-0.5 bg-white rounded-full" />}
                      </div>
                    </div>
                    <div className="p-2 space-y-1">
                      {cmds.map(cmd => {
                        const isSelected = selectedIds.has(cmd.id);
                        return (
                          <div 
                            key={cmd.id}
                            onClick={() => toggleCommand(cmd.id)}
                            title={language === 'zh' ? cmd.cn_description : cmd.description}
                            className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl p-2.5 transition-all ${isSelected ? 'bg-sky-50 text-[#0078D4]' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${isSelected ? 'border-[#0078D4] bg-[#0078D4]' : 'border-slate-300'}`}>
                              {isSelected && <Check size={10} className="text-white" />}
                            </div>
                            <span className="text-sm truncate select-none">{language === 'zh' ? cmd.cn_name : cmd.name}</span>
                            
                            {/* Hover Info Icon */}
                            <Info size={14} className="ml-auto opacity-0 group-hover:opacity-50 text-slate-400" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200/60 bg-white/62 px-6 py-4">
            <button 
              onClick={onCancel}
              className="ui-button px-6 py-2.5 text-sm"
            >
              {t.cancel}
            </button>
            <button 
              onClick={handleExecute}
              disabled={selectedIds.size === 0}
              className="ui-button-primary flex items-center gap-2 px-8 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={18} />
              {t.execute_tasks}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
