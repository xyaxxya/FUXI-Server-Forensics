import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import ServerSidebar from "./components/ServerSidebar";
import Dashboard from "./components/Dashboard";
import Intro from "./components/Intro";
import TaskSelectionModal from "./components/TaskSelectionModal";
import AIAssistant from "./components/AIAssistant";
import { motion } from "framer-motion";
import { Language } from "./translations";
import { CommandProvider, useCommandStore } from "./store/CommandContext";

function MainApp() {
  const [showIntro, setShowIntro] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("system");
  const [language, setLanguage] = useState<Language>('zh');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showServerSidebar, setShowServerSidebar] = useState(true);
  
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
    <div className="relative w-full h-screen overflow-hidden text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900 bg-slate-50">
      {/* Global Background Gradient */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 pointer-events-none" />
      
      {!isConnected ? (
        <Login onLogin={handleLoginSuccess} />
      ) : (
        <>
          <div className="relative z-10 flex h-full">
            <motion.div
              animate={{
                width: showServerSidebar ? 288 : 0,
              }}
              transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
              className="h-full overflow-hidden flex-none"
              style={{ willChange: "width" }}
            >
              <motion.div
                animate={{
                  x: showServerSidebar ? 0 : -288,
                  opacity: showServerSidebar ? 1 : 0,
                }}
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                className={showServerSidebar ? "h-full" : "h-full pointer-events-none"}
                style={{ willChange: "transform, opacity" }}
              >
                <ServerSidebar 
                  onAddSession={() => setShowLoginModal(true)}
                  onDisconnect={handleDisconnect}
                />
              </motion.div>
            </motion.div>
            <Sidebar 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
              onDisconnect={() => handleDisconnect()} 
              language={language}
              onToggleLanguage={() => setLanguage(prev => prev === 'en' ? 'zh' : 'en')}
              onAddSession={() => setShowLoginModal(true)}
              onToggleServerSidebar={() => setShowServerSidebar(prev => !prev)}
            />
            <Dashboard activeTab={activeTab} language={language} onAddSession={() => setShowLoginModal(true)} />
          </div>

          <TaskSelectionModal 
            isOpen={showTaskModal} 
            onExecute={handleExecuteTasks} 
            onCancel={handleCancelTasks}
            language={language}
          />
          <AIAssistant />
        </>
      )}

      {/* Login Modal for adding new sessions */}
      {isConnected && showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
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
