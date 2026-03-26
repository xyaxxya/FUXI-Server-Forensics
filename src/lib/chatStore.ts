import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AIMessage } from './ai';

export interface ChatSession {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  searchQuery: string;
  
  // Actions
  createSession: (title?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateSessionMessages: (id: string, messages: AIMessage[]) => void;
  updateSessionTitle: (id: string, title: string) => void;
  clearSessionMessages: (id: string) => void;
  setSearchQuery: (query: string) => void;
  getFilteredSessions: () => ChatSession[];
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      searchQuery: '',

      createSession: (title) => {
        const id = crypto.randomUUID();
        const newSession: ChatSession = {
          id,
          title: title || 'New Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: id,
        }));
        
        return id;
      },

      deleteSession: (id) => {
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id);
          // If active session is deleted, switch to the first one or null
          let newActiveId = state.activeSessionId;
          if (state.activeSessionId === id) {
            newActiveId = newSessions.length > 0 ? newSessions[0].id : null;
          }
          return {
            sessions: newSessions,
            activeSessionId: newActiveId,
          };
        });
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id });
      },

      updateSessionMessages: (id, messages) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id === id) {
              // Auto-generate title from first user message if it's "New Chat" or undefined
              let title = s.title;
              if ((s.title === 'New Chat' || !s.title) && messages.length > 0) {
                 const firstUserMsg = messages.find(m => m.role === 'user');
                 if (firstUserMsg) {
                     title = firstUserMsg.content.substring(0, 30);
                     if (firstUserMsg.content.length > 30) title += '...';
                 }
              }
              
              return { ...s, messages, title, updatedAt: Date.now() };
            }
            return s;
          }),
        }));
      },
      
      updateSessionTitle: (id, title) => {
        set((state) => ({
            sessions: state.sessions.map((s) => 
                s.id === id ? { ...s, title, updatedAt: Date.now() } : s
            )
        }));
      },

      clearSessionMessages: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, messages: [], updatedAt: Date.now() } : s
          ),
        }));
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      getFilteredSessions: () => {
        const { sessions, searchQuery } = get();
        if (!searchQuery.trim()) return sessions;
        
        const query = searchQuery.toLowerCase();
        return sessions.filter(session => {
          // Search in title
          if (session.title.toLowerCase().includes(query)) return true;
          
          // Search in messages
          return session.messages.some(msg => 
            msg.content.toLowerCase().includes(query)
          );
        });
      },
    }),
    {
      name: 'chat-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
