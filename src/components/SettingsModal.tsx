import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Globe, Bot, Settings, Sparkles } from "lucide-react";
import { translations, Language } from "../translations";
import { AISettings, DEFAULT_SETTINGS } from "../lib/ai";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  aiSettings: AISettings;
  onAiSettingsChange: (settings: AISettings) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  language,
  onLanguageChange,
  aiSettings,
  onAiSettingsChange,
}: SettingsModalProps) {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<"general" | "ai">("general");

  // Local state for AI settings to avoid constant re-renders/writes during typing
  // We commit changes only when specific fields blur or when saving? 
  // For simplicity in this app, we can update parent directly or use a local buffer.
  // Let's use direct updates for now as it was in GeneralAgent.

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between bg-white">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Settings size={24} />
              </div>
              {t.settings}
            </h2>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden bg-slate-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 p-6 space-y-2">
              <button
                onClick={() => setActiveTab("general")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "general"
                    ? "bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Globe size={20} />
                {t.general_settings}
              </button>
              <button
                onClick={() => setActiveTab("ai")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "ai"
                    ? "bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Bot size={20} />
                {t.ai_settings}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
              <div className="max-w-3xl mx-auto">
                {activeTab === "general" && (
                  <div className="space-y-8 animate-fade-in">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Globe className="text-blue-500" size={24} />
                        {t.language}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                          onClick={() => onLanguageChange("en")}
                          className={`group relative flex items-center p-6 rounded-2xl border-2 transition-all duration-200 ${
                            language === "en"
                              ? "border-blue-500 bg-white shadow-lg shadow-blue-500/10"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md"
                          }`}
                        >
                          <div className="flex-1 text-left">
                            <span className="block text-lg font-bold text-slate-800 mb-1">English</span>
                            <span className="text-sm text-slate-500">English Language</span>
                          </div>
                          {language === "en" && (
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                              <Settings size={14} className="opacity-0" /> {/* Just for spacing */}
                              <div className="w-2.5 h-2.5 bg-white rounded-full" />
                            </div>
                          )}
                        </button>
                        <button
                          onClick={() => onLanguageChange("zh")}
                          className={`group relative flex items-center p-6 rounded-2xl border-2 transition-all duration-200 ${
                            language === "zh"
                              ? "border-blue-500 bg-white shadow-lg shadow-blue-500/10"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md"
                          }`}
                        >
                          <div className="flex-1 text-left">
                            <span className="block text-lg font-bold text-slate-800 mb-1">简体中文</span>
                            <span className="text-sm text-slate-500">Chinese Language</span>
                          </div>
                          {language === "zh" && (
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                              <div className="w-2.5 h-2.5 bg-white rounded-full" />
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "ai" && (
                  <div className="space-y-8 animate-fade-in">
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                           <Bot className="text-indigo-500" size={28} />
                           {t.ai_settings}
                        </h3>
                        <p className="text-slate-500">确认你的 AI 模型与 API 密钥</p>
                      </div>
                    </div>

                    {/* Enable Planning Mode Toggle */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                              <Sparkles size={16} className="text-indigo-600" />
                              {t.enable_planning}
                            </h4>
                            <p className="text-xs text-indigo-700/70 mt-1">
                              {t.enable_planning_desc}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={aiSettings.enablePlanning || false}
                              onChange={(e) => onAiSettingsChange({
                                ...aiSettings,
                                enablePlanning: e.target.checked
                              })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                            <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2 mb-2">
                              <Settings size={16} className="text-indigo-600" />
                              {t.max_loops}
                            </h4>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="5" 
                                    max="50" 
                                    step="1"
                                    value={aiSettings.maxLoops || 10}
                                    onChange={(e) => onAiSettingsChange({
                                        ...aiSettings,
                                        maxLoops: parseInt(e.target.value)
                                    })}
                                    className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-100 min-w-[3rem] text-center">
                                    {aiSettings.maxLoops || 10}
                                </span>
                            </div>
                            <p className="text-xs text-indigo-700/70 mt-2">
                                {t.max_loops_desc}
                            </p>
                        </div>
                    </div>

                    {/* Provider Tabs */}
                    <div className="flex gap-2 mb-8 p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto custom-scrollbar">
                      {(["zhipu", "openai", "qwen", "claude", "kimi"] as const).map(
                        (provider) => (
                          <button
                            key={provider}
                            onClick={() =>
                              onAiSettingsChange({
                                ...aiSettings,
                                activeProvider: provider,
                              })
                            }
                            className={`flex-1 min-w-[100px] px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
                              aiSettings.activeProvider === provider
                                ? "bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {aiSettings.configs[provider]?.name || provider}
                          </button>
                        )
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          {t.api_endpoint}
                        </label>
                        <input
                          type="text"
                          value={
                            aiSettings.configs[aiSettings.activeProvider].baseUrl
                          }
                          onChange={(e) =>
                            onAiSettingsChange({
                              ...aiSettings,
                              configs: {
                                ...aiSettings.configs,
                                [aiSettings.activeProvider]: {
                                  ...aiSettings.configs[aiSettings.activeProvider],
                                  baseUrl: e.target.value,
                                },
                              },
                            })
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm"
                          placeholder={
                            DEFAULT_SETTINGS.configs[aiSettings.activeProvider]
                              .baseUrl
                          }
                        />
                        <p className="mt-2 text-xs text-slate-400">The base URL for the API endpoint (e.g., https://api.openai.com/v1)</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          {t.api_key}
                        </label>
                        <input
                          type="password"
                          value={aiSettings.configs[aiSettings.activeProvider].apiKey}
                          onChange={(e) =>
                            onAiSettingsChange({
                              ...aiSettings,
                              configs: {
                                ...aiSettings.configs,
                                [aiSettings.activeProvider]: {
                                  ...aiSettings.configs[aiSettings.activeProvider],
                                  apiKey: e.target.value,
                                },
                              },
                            })
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm"
                          placeholder={`${aiSettings.configs[aiSettings.activeProvider].name} API Key`}
                        />
                        <p className="mt-2 text-xs text-slate-400">Your secret API key. This is stored locally on your device.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          {t.model_name}
                        </label>
                        <input
                          type="text"
                          value={aiSettings.configs[aiSettings.activeProvider].model}
                          onChange={(e) =>
                            onAiSettingsChange({
                              ...aiSettings,
                              configs: {
                                ...aiSettings.configs,
                                [aiSettings.activeProvider]: {
                                  ...aiSettings.configs[aiSettings.activeProvider],
                                  model: e.target.value,
                                },
                              },
                            })
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm"
                          placeholder={
                            DEFAULT_SETTINGS.configs[aiSettings.activeProvider]
                              .model
                          }
                        />
                        <p className="mt-2 text-xs text-slate-400">The specific model identifier to use (e.g., gpt-4, claude-3-opus)</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
