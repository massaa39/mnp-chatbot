/**
 * ログ管理ユーティリティ
 * Purpose: フロントエンドのログ出力と管理
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: Date;
  component?: string;
  sessionId?: string;
}

class Logger {
  private isDevelopment: boolean;
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.logLevel = this.isDevelopment ? 'debug' : 'info';
  }

  /**
   * デバッグログ
   */
  debug(message: string, data?: any, component?: string): void {
    this.log('debug', message, data, component);
  }

  /**
   * 情報ログ
   */
  info(message: string, data?: any, component?: string): void {
    this.log('info', message, data, component);
  }

  /**
   * 警告ログ
   */
  warn(message: string, data?: any, component?: string): void {
    this.log('warn', message, data, component);
  }

  /**
   * エラーログ
   */
  error(message: string, data?: any, component?: string): void {
    this.log('error', message, data, component);
    
    // エラーログは常にコンソールに出力
    console.error(`[${component || 'Unknown'}] ${message}`, data);
  }

  /**
   * ログ出力
   */
  private log(level: LogLevel, message: string, data?: any, component?: string): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      component,
      sessionId: this.getSessionId()
    };

    // メモリ内ログに追加
    this.addToMemoryLog(entry);

    // レベルに応じてコンソール出力
    if (this.shouldLog(level)) {
      this.outputToConsole(entry);
    }

    // 本番環境では外部ログサービスに送信（実装例）
    if (!this.isDevelopment && level === 'error') {
      this.sendToLogService(entry);
    }
  }

  /**
   * ログレベルチェック
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.logLevel];
  }

  /**
   * コンソール出力
   */
  private outputToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp.toISOString()}] [${entry.component || 'App'}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.data);
        break;
      case 'info':
        console.info(message, entry.data);
        break;
      case 'warn':
        console.warn(message, entry.data);
        break;
      case 'error':
        console.error(message, entry.data);
        break;
    }
  }

  /**
   * メモリ内ログに追加
   */
  private addToMemoryLog(entry: LogEntry): void {
    this.logs.push(entry);
    
    // 最大ログ数を超えた場合、古いログを削除
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * セッションID取得
   */
  private getSessionId(): string | undefined {
    try {
      const authStore = localStorage.getItem('mnp-auth-storage');
      if (authStore) {
        const parsed = JSON.parse(authStore);
        return parsed.state?.sessionToken?.substring(0, 8);
      }
    } catch (error) {
      // エラーを無視
    }
    return undefined;
  }

  /**
   * 外部ログサービスに送信
   */
  private async sendToLogService(entry: LogEntry): Promise<void> {
    try {
      // 実際の実装では外部ログサービス（Sentry、LogRocket等）に送信
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // });
    } catch (error) {
      console.warn('ログサービスへの送信に失敗:', error);
    }
  }

  /**
   * ログレベル設定
   */
  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * ログ履歴取得
   */
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = level 
      ? this.logs.filter(log => log.level === level)
      : this.logs;

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  /**
   * ログクリア
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * パフォーマンス測定開始
   */
  startTimer(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      this.info(`Timer "${name}": ${duration}ms`);
    };
  }

  /**
   * エラー境界用のエラーログ
   */
  logError(error: Error, errorInfo?: any, component?: string): void {
    this.error('React Error Boundary caught an error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }, component);
  }

  /**
   * APIエラー用のログ
   */
  logApiError(url: string, method: string, status: number, error: any): void {
    this.error('API Error', {
      url,
      method,
      status,
      error,
      timestamp: new Date().toISOString()
    }, 'API');
  }

  /**
   * ユーザーアクション用のログ
   */
  logUserAction(action: string, data?: any): void {
    this.info(`User Action: ${action}`, data, 'UserAction');
  }
}

// シングルトンインスタンス
export const logger = new Logger();

// デフォルトエクスポート
export default logger;