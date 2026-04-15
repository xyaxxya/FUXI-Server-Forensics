import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import ServerSidebar from "./components/ServerSidebar";
import Dashboard from "./components/Dashboard";
import Intro from "./components/Intro";
import TaskSelectionModal from "./components/TaskSelectionModal";
import SettingsModal from "./components/SettingsModal";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import { motion, AnimatePresence } from "framer-motion";
import { Language } from "./translations";
import { CommandProvider, useCommandStore } from "./store/CommandContext";
import { AISettings, DEFAULT_SETTINGS } from "./lib/ai";
import StarrySkyBackground from "./components/StarrySkyBackground";
import LicenseGate from "./components/LicenseGate";
import { APP_VERSION } from "./config/app";
import { ToastProvider } from "./components/Toast";
import GlobalContextMenu from "./components/GlobalContextMenu";

interface LicenseStatus {
  valid: boolean;
  message: string;
  machine_code: string;
  expires_at?: number | null;
  nickname?: string | null;
  qq?: string | null;
  avatar?: string | null;
  license_plan?: string | null;
  license_label?: string | null;
}

interface UpdateCheckResult {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  download_url: string;
  package_sha256: string;
  manifest_signature: string;
  notes: string;
  min_supported_version: string;
  force_update: boolean;
  channel: string;
  message: string;
}

function MainApp() {
  const [showIntro, setShowIntro] = useState(true);
  const [introMinElapsed, setIntroMinElapsed] = useState(false);
  const [introMaxElapsed, setIntroMaxElapsed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("system");
  const [language, setLanguage] = useState<Language>('zh');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showServerSidebar, setShowServerSidebar] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [isAiSettingsLoaded, setIsAiSettingsLoaded] = useState(false);
  const [isLicensed, setIsLicensed] = useState(false);
  const [isLicenseChecked, setIsLicenseChecked] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [startupUpdateInfo, setStartupUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isStartupUpdateChecked, setIsStartupUpdateChecked] = useState(false);
  const [showStartupUpdatePrompt, setShowStartupUpdatePrompt] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"general" | "tools" | "updates" | "ai">("general");
  const [isStarryMode, setIsStarryMode] = useState(() => {
    const saved = localStorage.getItem("starry_mode");
    return saved ? JSON.parse(saved) : false;
  });
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Effect to toggle body class and save
  useEffect(() => {
    localStorage.setItem("starry_mode", JSON.stringify(isStarryMode));
    if (isStarryMode) {
      document.body.classList.add("starry-mode");
    } else {
      document.body.classList.remove("starry-mode");
    }
  }, [isStarryMode]);

  // Load AI settings on mount
  useEffect(() => {
    const saved = localStorage.getItem("ai_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: check if it's the old flat format
        if ("apiKey" in parsed) {
          setAiSettings({
            ...DEFAULT_SETTINGS,
            activeProvider: "fuxi", // Override old users to default to fuxi
            tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            configs: {
              ...DEFAULT_SETTINGS.configs,
              zhipu: {
                ...DEFAULT_SETTINGS.configs.zhipu,
                apiKey: parsed.apiKey || "",
                baseUrl:
                  parsed.baseUrl || DEFAULT_SETTINGS.configs.zhipu.baseUrl,
                model: parsed.model || DEFAULT_SETTINGS.configs.zhipu.model,
              },
            },
          });
        } else {
          // New format
          setAiSettings((prev) => {
            const merged = {
              ...prev,
              ...parsed,
              configs: {
                ...prev.configs,
                ...parsed.configs, // Merge to keep defaults for new providers
                fuxi: DEFAULT_SETTINGS.configs.fuxi, // Always override fuxi with default config to ensure API key is present
              },
              tokenUsage: parsed.tokenUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            };
            
            // If they didn't have fuxi before, make it active by default
            if (!parsed.configs?.fuxi) {
                merged.activeProvider = "fuxi";
            }
            return merged;
          });
        }
      } catch (e) {
        console.error("Failed to parse AI settings", e);
      }
    }
    setIsAiSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLicenseChecked) {
      setIsStartupUpdateChecked(false);
      return;
    }
    if (!isLicensed) {
      setStartupUpdateInfo(null);
      setShowStartupUpdatePrompt(false);
      setIsStartupUpdateChecked(true);
      return;
    }
    setIsStartupUpdateChecked(false);
    invoke<UpdateCheckResult>("check_client_update", {
      currentVersion: APP_VERSION,
    })
      .then((result) => {
        setStartupUpdateInfo(result);
        if (result.has_update && result.download_url) {
          setShowStartupUpdatePrompt(true);
        } else {
          setShowStartupUpdatePrompt(false);
        }
      })
      .catch(() => {
        setStartupUpdateInfo(null);
        setShowStartupUpdatePrompt(false);
      })
      .finally(() => {
        setIsStartupUpdateChecked(true);
      });
  }, [isLicenseChecked, isLicensed]);

  const handleStartupUpdateNow = async () => {
    if (!startupUpdateInfo?.has_update) return;
    setShowStartupUpdatePrompt(false);
    setSettingsInitialTab("updates");
    setShowSettingsModal(true);
  };

  // Save AI settings when changed
  useEffect(() => {
    if (isAiSettingsLoaded) {
      localStorage.setItem("ai_settings", JSON.stringify(aiSettings));
    }
  }, [aiSettings, isAiSettingsLoaded]);

  useEffect(() => {
    invoke<LicenseStatus>("get_license_status")
      .then((status) => {
        setLicenseStatus(status);
        setIsLicensed(!!status?.valid);
      })
      .catch(() => {
        setLicenseStatus(null);
        setIsLicensed(false);
      })
      .finally(() => setIsLicenseChecked(true));
  }, []);

  useEffect(() => {
    const minTimer = window.setTimeout(() => setIntroMinElapsed(true), 1800);
    const maxTimer = window.setTimeout(() => setIntroMaxElapsed(true), 12000);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, []);
  
  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+/ - Show keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
      
      // Esc - Close modals
      if (e.key === 'Escape') {
        if (showKeyboardShortcuts) setShowKeyboardShortcuts(false);
        if (showSettingsModal) setShowSettingsModal(false);
        if (showTaskModal) setShowTaskModal(false);
        if (showLoginModal) setShowLoginModal(false);
      }
      
      // Ctrl+1-9 - Quick tab switching (only when connected)
      if (isConnected && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        const tabMap: Record<string, string> = {
          '1': 'system',
          '2': 'network',
          '3': 'response',
          '4': 'docker',
          '5': 'database',
          '6': 'agent-general',
          '7': 'terminal'
        };
        
        if (tabMap[e.key]) {
          e.preventDefault();
          setActiveTab(tabMap[e.key]);
        }
      }
      
      // Ctrl+T - Open terminal
      if (isConnected && (e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        setActiveTab('terminal');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, showKeyboardShortcuts, showSettingsModal, showTaskModal, showLoginModal]);
  
  const { fetchAll, clearData, disconnectSSH } = useCommandStore();

  const handleDisconnect = async (sessionId?: string) => {
    try {
      await disconnectSSH(sessionId);
      
      // If no sessions left, reset to login screen
      // We check sessions.length - 1 because the state update might lag slightly 
      // or we can invoke list_sessions directly to be sure
      const remaining = await invoke<any[]>('list_sessions');
      if (remaining.length === 0) {
        clearData();
        setIsConnected(false);
      }
    } catch (e) {
      console.error(e);
      // If error occurs, we might still want to check connectivity
      const remaining = await invoke<any[]>('list_sessions').catch(() => []);
      if (remaining.length === 0) {
        setIsConnected(false); 
      }
    }
  };

  const handleLoginSuccess = () => {
    setIsConnected(true);
    setLanguage('zh');
    setShowServerSidebar(true);
    // Show task modal instead of auto-executing
    setShowTaskModal(true);
  };

  const handleExecuteTasks = (selectedIds: string[]) => {
    setShowTaskModal(false);
    fetchAll(selectedIds);
  };

  const handleCancelTasks = () => {
    setShowTaskModal(false);
  };

  const openSettings = (tab: "general" | "tools" | "updates" | "ai" = "general") => {
    setSettingsInitialTab(tab);
    setShowSettingsModal(true);
  };

  const bootReady = introMaxElapsed || (introMinElapsed && isLicenseChecked && isStartupUpdateChecked);
  const bootStatusText = !isLicenseChecked
    ? "启动中：正在校验授权状态..."
    : !isStartupUpdateChecked
    ? "启动中：正在检查客户端更新..."
    : "启动中：准备完成";

  return (
    <div className={`relative w-full h-screen overflow-hidden text-slate-800 font-sans selection:bg-sky-100 selection:text-sky-900 ${isStarryMode ? '' : 'bg-[#F8FAFC]'}`}>
      {isStarryMode ? (
        <StarrySkyBackground />
      ) : (
        <>
          {/* Noise Overlay */}
          <div className="noise-overlay" />
          
          {/* Global Background Gradient - Subtle Cold Light */}
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] opacity-100 pointer-events-none" />
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-sky-100/30 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-slate-200/40 blur-[100px] pointer-events-none" />
        </>
      )}
      
      <AnimatePresence mode="wait">
        {showIntro ? (
          <Intro
            key="intro"
            onComplete={() => setShowIntro(false)}
            bootReady={bootReady}
            bootStatusText={bootStatusText}
          />
        ) : (
          <motion.div 
            key="main-app"
            initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="relative w-full h-full"
          >
            {!isLicenseChecked ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                正在检查授权...
              </div>
            ) : !isLicensed ? (
              <LicenseGate
                initialLicenseStatus={licenseStatus}
                onAuthorized={(status) => {
                  setLicenseStatus(status);
                  setIsLicensed(true);
                }}
              />
            ) : !isConnected ? (
              <Login
                onLogin={handleLoginSuccess}
                licenseStatus={licenseStatus}
                updateInfo={startupUpdateInfo}
                onOpenUpdates={() => openSettings("updates")}
              />
            ) : (
              <>
                <div className="relative z-10 flex h-full p-2 gap-2">
                  <motion.div
                    animate={{
                      width: showServerSidebar ? 280 : 0,
                      opacity: showServerSidebar ? 1 : 0,
                      marginRight: showServerSidebar ? 0 : -8,
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className="h-full overflow-hidden flex-none rounded-2xl"
                    style={{ willChange: "width, opacity" }}
                  >
                    <div className="h-full w-[280px]">
                      <ServerSidebar 
                        onAddSession={() => setShowLoginModal(true)}
                        onDisconnect={handleDisconnect}
                        language={language}
                        licenseStatus={licenseStatus}
                      />
                    </div>
                  </motion.div>

                  {/* Main Navigation Sidebar */}
                  <div className="h-full flex-none rounded-2xl overflow-hidden z-20">
                     <Sidebar 
                       activeTab={activeTab}
                       onTabChange={setActiveTab}
                       onDisconnect={() => handleDisconnect()}
                       language={language}
                       onOpenSettings={() => openSettings("general")}
                       onAddSession={() => setShowLoginModal(true)}
                       onToggleServerSidebar={() => setShowServerSidebar(prev => !prev)}
                       isCollapsed={sidebarCollapsed}
                       onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
                     />
                  </div>

                  {/* Main Content Area */}
                  <main className="flex-1 h-full overflow-hidden rounded-2xl relative z-10">
                    <Dashboard 
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      language={language}
                      onAddSession={() => setShowLoginModal(true)}
                      aiSettings={aiSettings}
                      onOpenSettings={() => openSettings("general")}
                      chatUserProfile={{
                        qq: licenseStatus?.qq || null,
                        avatar: licenseStatus?.avatar || null,
                      }}
                    />
                  </main>
                </div>

                <TaskSelectionModal 
                  isOpen={showTaskModal} 
                  onExecute={handleExecuteTasks} 
                  onCancel={handleCancelTasks}
                  language={language}
                />

                {/* Login Modal for adding new sessions */}
                {isConnected && showLoginModal && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
                    <div className="w-full max-w-md">
                      <Login 
                        onLogin={() => {
                          setShowLoginModal(false);
                        }} 
                        onClose={() => setShowLoginModal(false)}
                        licenseStatus={licenseStatus}
                        updateInfo={startupUpdateInfo}
                        onOpenUpdates={() => openSettings("updates")}
                      />
                    </div>
                  </div>
                )}

                {showStartupUpdatePrompt && startupUpdateInfo?.has_update && (
                  <div className="fixed right-6 top-6 z-[120] max-w-sm rounded-2xl border border-blue-200 bg-white shadow-2xl p-4">
                    <div className="text-sm font-semibold text-slate-800">
                      发现新版本 v{startupUpdateInfo.latest_version}
                    </div>
                    {startupUpdateInfo.notes && (
                      <div className="mt-2 text-xs text-slate-600 whitespace-pre-wrap max-h-28 overflow-auto">
                        {startupUpdateInfo.notes}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      {!startupUpdateInfo.force_update && (
                        <button
                          onClick={() => setShowStartupUpdatePrompt(false)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs"
                        >
                          稍后
                        </button>
                      )}
                      <button
                        onClick={handleStartupUpdateNow}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs"
                      >
                        去更新
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      渠道 {startupUpdateInfo.channel || "stable"}
                      {startupUpdateInfo.force_update ? " · 强制更新" : ""}
                    </div>
                  </div>
                )}
              </>
            )}
            {showSettingsModal && (
              <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                language={language}
                onLanguageChange={setLanguage}
                aiSettings={aiSettings}
                onAiSettingsChange={setAiSettings}
                isStarryMode={isStarryMode}
                onStarryModeChange={setIsStarryMode}
                initialUpdateInfo={startupUpdateInfo}
                initialActiveTab={settingsInitialTab}
              />
            )}
            
            <KeyboardShortcuts
              isOpen={showKeyboardShortcuts}
              onClose={() => setShowKeyboardShortcuts(false)}
              language={language}
            />
            <GlobalContextMenu language={language} onOpenSettings={() => openSettings("general")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <CommandProvider>
        <MainApp />
      </CommandProvider>
    </ToastProvider>
  );
}
