import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X, RotateCw } from "lucide-react";
import { FriendlyError } from "../lib/errorHandler";

interface ErrorDialogProps {
  isOpen: boolean;
  error: FriendlyError | null;
  onClose: () => void;
  onRetry?: () => void;
  language?: 'zh' | 'en';
}

export default function ErrorDialog({ isOpen, error, onClose, onRetry, language = 'zh' }: ErrorDialogProps) {
  if (!error) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                  <AlertCircle size={24} />
                </div>
                <h3 className="font-bold text-red-900 text-lg">{error.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-slate-700 text-sm leading-relaxed">
                {error.message}
              </p>

              {error.suggestion && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="font-semibold text-slate-800 text-xs mb-2">
                    {language === 'zh' ? '解决建议' : 'Suggestions'}
                  </h4>
                  <p className="text-slate-600 text-xs whitespace-pre-line leading-relaxed">
                    {error.suggestion}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {language === 'zh' ? '关闭' : 'Close'}
              </button>
              {error.canRetry && onRetry && (
                <button
                  onClick={() => {
                    onClose();
                    onRetry();
                  }}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <RotateCw size={16} />
                  {language === 'zh' ? '重试' : 'Retry'}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
