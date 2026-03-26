import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { Language } from "../translations";

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

interface Shortcut {
  keys: string[];
  description_zh: string;
  description_en: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // 全局快捷键
  { keys: ['Ctrl', '/'], description_zh: '显示快捷键帮助', description_en: 'Show keyboard shortcuts', category: 'global' },
  { keys: ['Ctrl', 'K'], description_zh: '快速命令面板', description_en: 'Quick command palette', category: 'global' },
  { keys: ['Esc'], description_zh: '关闭模态框', description_en: 'Close modal', category: 'global' },
  
  // 导航快捷键
  { keys: ['Ctrl', '1'], description_zh: '切换到系统监控', description_en: 'Switch to System', category: 'navigation' },
  { keys: ['Ctrl', '2'], description_zh: '切换到网络监控', description_en: 'Switch to Network', category: 'navigation' },
  { keys: ['Ctrl', '3'], description_zh: '切换到响应监控', description_en: 'Switch to Response', category: 'navigation' },
  { keys: ['Ctrl', 'T'], description_zh: '打开终端', description_en: 'Open Terminal', category: 'navigation' },
  
  // 终端快捷键
  { keys: ['Ctrl', '+'], description_zh: '增大字体', description_en: 'Increase font size', category: 'terminal' },
  { keys: ['Ctrl', '-'], description_zh: '减小字体', description_en: 'Decrease font size', category: 'terminal' },
  { keys: ['Ctrl', '0'], description_zh: '重置字体大小', description_en: 'Reset font size', category: 'terminal' },
  
  // 聊天快捷键
  { keys: ['Enter'], description_zh: '发送消息', description_en: 'Send message', category: 'chat' },
  { keys: ['Shift', 'Enter'], description_zh: '换行', description_en: 'New line', category: 'chat' },
];

const categories = {
  global: { zh: '全局', en: 'Global' },
  navigation: { zh: '导航', en: 'Navigation' },
  terminal: { zh: '终端', en: 'Terminal' },
  chat: { zh: '聊天', en: 'Chat' }
};

export default function KeyboardShortcuts({ isOpen, onClose, language }: KeyboardShortcutsProps) {
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <Keyboard size={24} />
                </div>
                <h3 className="font-bold text-white text-lg">
                  {language === 'zh' ? '键盘快捷键' : 'Keyboard Shortcuts'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                {Object.entries(groupedShortcuts).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
                      {categories[category as keyof typeof categories][language]}
                    </h4>
                    <div className="space-y-2">
                      {items.map((shortcut, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <span className="text-sm text-slate-700">
                            {language === 'zh' ? shortcut.description_zh : shortcut.description_en}
                          </span>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, keyIdx) => (
                              <span key={keyIdx} className="flex items-center gap-1">
                                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-semibold text-slate-700 shadow-sm">
                                  {key}
                                </kbd>
                                {keyIdx < shortcut.keys.length - 1 && (
                                  <span className="text-slate-400 text-xs">+</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-500">
                {language === 'zh' 
                  ? '按 Ctrl+/ 随时打开此帮助' 
                  : 'Press Ctrl+/ anytime to open this help'}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
