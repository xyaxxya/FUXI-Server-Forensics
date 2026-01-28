import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import ServerSidebar from "./components/ServerSidebar";
import Dashboard from "./components/Dashboard";
import Intro from "./components/Intro";
import TaskSelectionModal from "./components/TaskSelectionModal";
import SettingsModal from "./components/SettingsModal";
import { motion } from "framer-motion";
import { Language } from "./translations";
import { CommandProvider, useCommandStore } from "./store/CommandContext";
import { AISettings, DEFAULT_SETTINGS } from "./lib/ai";
import StarrySkyBackground from "./components/StarrySkyBackground";

function MainApp() {
  const [showIntro, setShowIntro] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("system");
  const [language, setLanguage] = useState<Language>('zh');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showServerSidebar, setShowServerSidebar] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [isAiSettingsLoaded, setIsAiSettingsLoaded] = useState(false);
  const [isStarryMode, setIsStarryMode] = useState(false);

  // Load Starry Mode settings
  useEffect(() => {
    const saved = localStorage.getItem("starry_mode");
    if (saved) {
      setIsStarryMode(JSON.parse(saved));
    }
  }, []);

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
          setAiSettings((prev) => ({
            ...prev,
            ...parsed,
            configs: {
              ...prev.configs,
              ...parsed.configs, // Merge to keep defaults for new providers
            },
          }));
        }
      } catch (e) {
        console.error("Failed to parse AI settings", e);
      }
    }
    setIsAiSettingsLoaded(true);
  }, []);

  // Save AI settings when changed
  useEffect(() => {
    if (isAiSettingsLoaded) {
      localStorage.setItem("ai_settings", JSON.stringify(aiSettings));
    }
  }, [aiSettings, isAiSettingsLoaded]);
  
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

  if (showIntro) {
    return <Intro onComplete={() => setShowIntro(false)} />;
  }

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
      
      {!isConnected ? (
        <Login onLogin={handleLoginSuccess} />
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
                 onOpenSettings={() => setShowSettingsModal(true)}
                 onAddSession={() => setShowLoginModal(true)}
                 onToggleServerSidebar={() => setShowServerSidebar(prev => !prev)}
               />
            </div>

            {/* Main Content Area */}
            <main className="flex-1 h-full overflow-hidden rounded-2xl relative z-10">
              <Dashboard 
                activeTab={activeTab}
                language={language}
                onAddSession={() => setShowLoginModal(true)}
                aiSettings={aiSettings}
                onOpenSettings={() => setShowSettingsModal(true)}
              />
            </main>
          </div>

          <TaskSelectionModal 
            isOpen={showTaskModal} 
            onExecute={handleExecuteTasks} 
            onCancel={handleCancelTasks}
            language={language}
          />

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
            />
          )}
        </>
      )}

      {/* Login Modal for adding new sessions */}
      {isConnected && showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
          <div className="w-full max-w-md">
            <Login 
              onLogin={() => {
                setShowLoginModal(false);
              }} 
              onClose={() => setShowLoginModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <CommandProvider>
      <MainApp />
    </CommandProvider>
  );
}
