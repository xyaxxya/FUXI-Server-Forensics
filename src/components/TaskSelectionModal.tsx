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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white w-full max-w-4xl max-h-[80vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Task Execution Queue</h2>
                <p className="text-sm text-slate-500">Select tasks to initialize system monitoring</p>
              </div>
            </div>
            <div className="text-sm font-medium text-slate-500">
              {selectedIds.size} / {commands.length} Selected
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc] custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(groupedCommands).map(([category, cmds]) => {
                const isAllSelected = cmds.every(c => selectedIds.has(c.id));
                const isPartial = !isAllSelected && cmds.some(c => selectedIds.has(c.id));

                return (
                  <div key={category} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div 
                        onClick={() => toggleCategory(category)}
                        className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <span className="font-semibold text-slate-700 capitalize">{t[category as keyof typeof t] || category}</span>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isAllSelected ? 'bg-blue-500 border-blue-500' : isPartial ? 'bg-blue-500/50 border-blue-500' : 'border-slate-300'}`}>
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
                            className={`group relative flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                          >
                            <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
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
          <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
            <button 
              onClick={onCancel}
              className="px-6 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleExecute}
              disabled={selectedIds.size === 0}
              className="px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Play size={18} />
              Execute Tasks
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
