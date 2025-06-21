/**
 * 構造化ログ出力ユーティリティ
 * Purpose: 包括的なログ管理とモニタリング
 */
import winston from 'winston';
import path from 'path';

// ログレベル定義
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// カラー設定
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan'
};

winston.addColors(LOG_COLORS);

/**
 * カスタムログフォーマッター
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      service: 'mnp-chatbot',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      ...metadata
    };

    return JSON.stringify(logEntry);
  })
);

/**
 * コンソール出力用フォーマッター（開発環境）
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    const metaStr = Object.keys(metadata).length > 0 
      ? `\n${JSON.stringify(metadata, null, 2)}`
      : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

/**
 * ログトランスポート設定
 */
const transports: winston.transport[] = [];

// コンソール出力（開発環境）
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );
} else {
  // 本番環境はJSON形式
  transports.push(
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || 'info',
      format: customFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );
}

/**
 * Winstonロガー作成
 */
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports,
  exitOnError: false
});

/**
 * ログレベル別メソッド定義
 */
interface LoggerInterface {
  error: (message: string, metadata?: any) => void;
  warn: (message: string, metadata?: any) => void;
  info: (message: string, metadata?: any) => void;
  http: (message: string, metadata?: any) => void;
  debug: (message: string, metadata?: any) => void;
  
  // 特殊用途メソッド
  audit: (action: string, details: any) => void;
  security: (event: string, details: any) => void;
  performance: (operation: string, duration: number, details?: any) => void;
}

/**
 * 拡張ロガークラス
 */
class ExtendedLogger implements LoggerInterface {
  private winston: winston.Logger;

  constructor(winstonLogger: winston.Logger) {
    this.winston = winstonLogger;
  }

  error(message: string, metadata: any = {}): void {
    this.winston.error(message, {
      ...metadata,
      logType: 'error'
    });
  }

  warn(message: string, metadata: any = {}): void {
    this.winston.warn(message, {
      ...metadata,
      logType: 'warning'
    });
  }

  info(message: string, metadata: any = {}): void {
    this.winston.info(message, {
      ...metadata,
      logType: 'info'
    });
  }

  http(message: string, metadata: any = {}): void {
    this.winston.http(message, {
      ...metadata,
      logType: 'http'
    });
  }

  debug(message: string, metadata: any = {}): void {
    this.winston.debug(message, {
      ...metadata,
      logType: 'debug'
    });
  }

  /**
   * 監査ログ
   */
  audit(action: string, details: any = {}): void {
    this.winston.info(`AUDIT: ${action}`, {
      ...details,
      logType: 'audit',
      auditAction: action,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * セキュリティログ
   */
  security(event: string, details: any = {}): void {
    this.winston.warn(`SECURITY: ${event}`, {
      ...details,
      logType: 'security',
      securityEvent: event,
      alertLevel: details.alertLevel || 'medium'
    });
  }

  /**
   * パフォーマンスログ
   */
  performance(operation: string, duration: number, details: any = {}): void {
    const level = duration > 3000 ? 'warn' : 'info';
    
    this.winston[level](`PERFORMANCE: ${operation}`, {
      ...details,
      logType: 'performance',
      operation,
      duration: `${duration}ms`,
      isSlowOperation: duration > 3000
    });
  }
}

const extendedLogger = new ExtendedLogger(logger);

export { extendedLogger as logger };
export default extendedLogger;