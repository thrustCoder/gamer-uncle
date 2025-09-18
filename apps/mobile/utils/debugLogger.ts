import AsyncStorage from '@react-native-async-storage/async-storage';

export class DebugLogger {
  private static instance: DebugLogger;
  private logs: string[] = [];
  private maxLogs = 1000;
  private storageKey = 'gamer_uncle_debug_logs';

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  async log(message: string, ...args: any[]): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message} ${args.length > 0 ? JSON.stringify(args) : ''}`;
    
    console.log(logEntry);
    
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save logs to storage:', error);
    }
  }

  async error(message: string, error?: any): Promise<void> {
    const errorMsg = error ? `${message} - ${error.toString()}` : message;
    await this.log(`ERROR: ${errorMsg}`);
  }

  async warn(message: string, ...args: any[]): Promise<void> {
    await this.log(`WARN: ${message}`, ...args);
  }

  async getLogs(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load logs from storage:', error);
    }
    return this.logs;
  }

  async clearLogs(): Promise<void> {
    this.logs = [];
    try {
      await AsyncStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear logs from storage:', error);
    }
  }
}

export const debugLogger = DebugLogger.getInstance();
