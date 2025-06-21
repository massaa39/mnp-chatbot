/**
 * 型定義エクスポート
 * Purpose: 全ての型定義の統一エクスポート
 */

// Database types
export * from './database';

// API types
export * from './api';

// External service types
export * from './external';

// Additional common types
export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  timestamp: Date;
}

export interface EnvironmentConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  LOG_LEVEL: string;
}

// Express Request拡張型
declare global {
  namespace Express {
    interface Request {
      user?: import('./database').User;
      session?: import('./database').ChatSession;
      requestId?: string;
    }
  }
}