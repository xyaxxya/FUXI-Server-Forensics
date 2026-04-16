import { AIMessage } from './ai';

interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  history: AIMessage[];
  metadata: {
    [key: string]: any;
  };
}

interface SessionStorage {
  saveSession(session: Session): Promise<void>;
  loadSession(id: string): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
  listSessions(): Promise<Session[]>;
  clearSessions(): Promise<void>;
}

class LocalStorageSessionStorage implements SessionStorage {
  private readonly KEY_PREFIX = 'fuxi_session_';

  async saveSession(session: Session): Promise<void> {
    const key = `${this.KEY_PREFIX}${session.id}`;
    localStorage.setItem(key, JSON.stringify(session));
  }

  async loadSession(id: string): Promise<Session | null> {
    const key = `${this.KEY_PREFIX}${id}`;
    const data = localStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async deleteSession(id: string): Promise<void> {
    const key = `${this.KEY_PREFIX}${id}`;
    localStorage.removeItem(key);
  }

  async listSessions(): Promise<Session[]> {
    const sessions: Session[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.KEY_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            sessions.push(JSON.parse(data));
          } catch {
            // Skip invalid sessions
          }
        }
      }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async clearSessions(): Promise<void> {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.KEY_PREFIX)) {
        localStorage.removeItem(key);
        i--; // Adjust index after removal
      }
    }
  }
}

export class SessionManager {
  private storage: SessionStorage;
  private currentSession: Session | null = null;

  constructor(storage?: SessionStorage) {
    this.storage = storage || new LocalStorageSessionStorage();
  }

  /**
   * 创建新会话
   */
  async createSession(name: string, initialMessage?: AIMessage): Promise<Session> {
    const session: Session = {
      id: this.generateSessionId(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      history: initialMessage ? [initialMessage] : [],
      metadata: {}
    };

    await this.storage.saveSession(session);
    this.currentSession = session;
    return session;
  }

  /**
   * 加载会话
   */
  async loadSession(id: string): Promise<Session | null> {
    const session = await this.storage.loadSession(id);
    if (session) {
      this.currentSession = session;
    }
    return session;
  }

  /**
   * 保存当前会话
   */
  async saveCurrentSession(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.updatedAt = Date.now();
      await this.storage.saveSession(this.currentSession);
    }
  }

  /**
   * 添加消息到当前会话
   */
  async addMessageToCurrentSession(message: AIMessage): Promise<void> {
    if (this.currentSession) {
      this.currentSession.history.push(message);
      this.currentSession.updatedAt = Date.now();
      await this.storage.saveSession(this.currentSession);
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(id: string): Promise<void> {
    await this.storage.deleteSession(id);
    if (this.currentSession && this.currentSession.id === id) {
      this.currentSession = null;
    }
  }

  /**
   * 列出所有会话
   */
  async listSessions(): Promise<Session[]> {
    return this.storage.listSessions();
  }

  /**
   * 清除所有会话
   */
  async clearSessions(): Promise<void> {
    await this.storage.clearSessions();
    this.currentSession = null;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * 设置当前会话的元数据
   */
  async setSessionMetadata(key: string, value: any): Promise<void> {
    if (this.currentSession) {
      this.currentSession.metadata[key] = value;
      this.currentSession.updatedAt = Date.now();
      await this.storage.saveSession(this.currentSession);
    }
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例实例
export const sessionManager = new SessionManager();
