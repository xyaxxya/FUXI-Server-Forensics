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
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/32 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="ui-shell w-full max-w-md overflow-hidden rounded-[30px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-red-100/80 bg-red-50/74 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-red-100 text-red-600">
                  <AlertCircle size={24} />
                </div>
                <h3 className="font-bold text-red-900 text-lg">{error.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-2xl p-2 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
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
                <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/74 p-4">
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
            <div className="flex justify-end gap-3 border-t border-slate-200/70 bg-white/58 px-6 py-4">
              <button
                onClick={onClose}
                className="ui-button px-4 py-2 text-sm"
              >
                {language === 'zh' ? '关闭' : 'Close'}
              </button>
              {error.canRetry && onRetry && (
                <button
                  onClick={() => {
                    onClose();
                    onRetry();
                  }}
                  className="ui-button-primary flex items-center gap-2 px-4 py-2 text-sm"
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
