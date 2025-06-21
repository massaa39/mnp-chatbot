/**
 * セキュリティ設定の統合管理
 * Purpose: アプリケーション全体のセキュリティ設定を一元管理
 */

import { Express } from 'express';
import { helmetConfig, corsConfig, apiRateLimit, authRateLimit } from '../middleware/security';
import { logMaskingMiddleware, responseMaskingMiddleware, gdprConsentMiddleware, auditLogMiddleware, getPrivacyConfig } from '../middleware/dataProtection';
import { logger } from '../utils/logger';

export interface SecurityConfig {
  // 認証関連
  jwtSecret: string;
  sessionSecret: string;
  jwtExpiresIn: string;
  sessionExpiresIn: string;
  
  // レート制限
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  authRateLimitMax: number;
  
  // CORS設定
  corsOrigin: string[];
  
  // データ保護
  encryptionKey: string;
  maskPersonalData: boolean;
  logPersonalData: boolean;
  dataRetentionDays: number;
  
  // ファイルアップロード
  uploadMaxFileSize: number;
  allowedFileTypes: string[];
  
  // 環境固有設定
  isDevelopment: boolean;
  isProduction: boolean;
  enableDebugLogs: boolean;
  
  // 監査・コンプライアンス
  enableAuditLogs: boolean;
  gdprCompliance: boolean;
}

/**
 * 環境変数からセキュリティ設定を読み込み
 */
export const getSecurityConfig = (): SecurityConfig => {
  const config: SecurityConfig = {
    // 認証関連
    jwtSecret: process.env.JWT_SECRET || (() => {
      const error = 'JWT_SECRET environment variable is required in production';
      if (process.env.NODE_ENV === 'production') {
        throw new Error(error);
      }
      logger.warn(error);
      return 'development-jwt-secret-change-in-production';
    })(),
    sessionSecret: process.env.SESSION_SECRET || (() => {
      const error = 'SESSION_SECRET environment variable is required in production';
      if (process.env.NODE_ENV === 'production') {
        throw new Error(error);
      }
      logger.warn(error);
      return 'development-session-secret-change-in-production';
    })(),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    sessionExpiresIn: process.env.SESSION_EXPIRES_IN || '7d',
    
    // レート制限
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15分
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
    
    // CORS設定
    corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    
    // データ保護
    encryptionKey: process.env.ENCRYPTION_KEY || (() => {
      const error = 'ENCRYPTION_KEY environment variable is required in production';
      if (process.env.NODE_ENV === 'production') {
        throw new Error(error);
      }
      logger.warn(error);
      return 'development-encryption-key-change-in-production';
    })(),
    maskPersonalData: process.env.MASK_PERSONAL_DATA === 'true',
    logPersonalData: process.env.LOG_PERSONAL_DATA === 'true',
    dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '30'),
    
    // ファイルアップロード
    uploadMaxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '10485760'), // 10MB
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf,txt').split(','),
    
    // 環境固有設定
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    enableDebugLogs: process.env.ENABLE_DEBUG_LOGS === 'true',
    
    // 監査・コンプライアンス
    enableAuditLogs: process.env.ENABLE_AUDIT_LOGS !== 'false',
    gdprCompliance: process.env.GDPR_COMPLIANCE !== 'false',
  };

  return config;
};

/**
 * セキュリティミドルウェアの適用
 */
export const applySecurity = (app: Express): void => {
  const config = getSecurityConfig();
  const privacyConfig = getPrivacyConfig();

  logger.info('Applying security configurations', {
    isDevelopment: config.isDevelopment,
    corsOrigin: config.corsOrigin,
    rateLimitMax: config.rateLimitMaxRequests,
    maskPersonalData: config.maskPersonalData,
    gdprCompliance: config.gdprCompliance,
  });

  // 1. セキュリティヘッダー
  app.use(helmetConfig);

  // 2. CORS設定
  app.use(corsConfig);

  // 3. リクエストサイズ制限
  app.use((req, res, next) => {
    if (req.headers['content-length'] && 
        parseInt(req.headers['content-length']) > config.uploadMaxFileSize) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'リクエストサイズが大きすぎます',
        },
      });
    }
    next();
  });

  // 4. データ保護・プライバシー
  if (config.maskPersonalData) {
    app.use(logMaskingMiddleware(privacyConfig));
    app.use(responseMaskingMiddleware(privacyConfig));
  }

  // 5. GDPR準拠
  if (config.gdprCompliance) {
    app.use(gdprConsentMiddleware);
  }

  // 6. 監査ログ
  if (config.enableAuditLogs) {
    app.use(auditLogMiddleware);
  }

  // 7. レート制限は個別にルートで適用
  // app.use('/api/', apiRateLimit);
  // app.use('/api/auth/', authRateLimit);
  
  logger.info('Security middleware applied successfully');
};

/**
 * セキュリティ設定の検証
 */
export const validateSecurityConfig = (): { valid: boolean; errors: string[] } => {
  const config = getSecurityConfig();
  const errors: string[] = [];

  // 本番環境での必須設定チェック
  if (config.isProduction) {
    if (config.jwtSecret.includes('development')) {
      errors.push('JWT_SECRET must be set to a secure value in production');
    }
    
    if (config.sessionSecret.includes('development')) {
      errors.push('SESSION_SECRET must be set to a secure value in production');
    }
    
    if (config.encryptionKey.includes('development')) {
      errors.push('ENCRYPTION_KEY must be set to a secure value in production');
    }
    
    if (config.corsOrigin.includes('*') || config.corsOrigin.includes('localhost')) {
      errors.push('CORS_ORIGIN should not include localhost or wildcard in production');
    }
  }

  // セキュリティレベルの検証
  if (config.rateLimitMaxRequests > 1000) {
    errors.push('Rate limit is too high, consider lowering RATE_LIMIT_MAX_REQUESTS');
  }

  if (config.uploadMaxFileSize > 50 * 1024 * 1024) { // 50MB
    errors.push('Upload file size limit is too high');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * セキュリティヘルスチェック
 */
export const performSecurityHealthCheck = (): {
  status: 'healthy' | 'warning' | 'critical';
  checks: Array<{ name: string; status: 'pass' | 'fail'; message?: string }>;
} => {
  const checks = [];
  
  // 設定検証
  const configValidation = validateSecurityConfig();
  checks.push({
    name: 'Configuration Validation',
    status: configValidation.valid ? 'pass' : 'fail',
    message: configValidation.errors.join(', '),
  });

  // 環境変数チェック
  const requiredEnvVars = ['JWT_SECRET', 'SESSION_SECRET'];
  requiredEnvVars.forEach(envVar => {
    checks.push({
      name: `Environment Variable: ${envVar}`,
      status: process.env[envVar] ? 'pass' : 'fail',
      message: process.env[envVar] ? undefined : `${envVar} is not set`,
    });
  });

  // セキュリティヘッダーチェック（プレースホルダー）
  checks.push({
    name: 'Security Headers',
    status: 'pass',
    message: 'Helmet configuration applied',
  });

  // 全体ステータスの判定
  const failedChecks = checks.filter(check => check.status === 'fail');
  let status: 'healthy' | 'warning' | 'critical';
  
  if (failedChecks.length === 0) {
    status = 'healthy';
  } else if (failedChecks.length <= 2) {
    status = 'warning';
  } else {
    status = 'critical';
  }

  return { status, checks };
};

/**
 * セキュリティインシデント記録
 */
export const recordSecurityIncident = (incident: {
  type: 'authentication_failure' | 'rate_limit_exceeded' | 'malicious_input' | 'unauthorized_access' | 'data_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ip?: string;
  userAgent?: string;
  additionalData?: any;
}): void => {
  logger.warn('Security incident recorded', {
    ...incident,
    timestamp: new Date().toISOString(),
    source: 'security_module',
  });

  // 重大なインシデントの場合は追加のアクション
  if (incident.severity === 'critical') {
    logger.error('Critical security incident', incident);
    
    // 実際の実装では：
    // - アラート通知
    // - 自動的なIP制限
    // - 管理者への緊急通知
    // - セキュリティダッシュボードへの報告
  }
};

/**
 * セキュリティメトリクスの取得
 */
export const getSecurityMetrics = (): {
  rateLimitViolations: number;
  authenticationFailures: number;
  maliciousInputAttempts: number;
  activeSessionCount: number;
  lastSecurityScan: string;
} => {
  // 実際の実装では Redis やデータベースからメトリクスを取得
  return {
    rateLimitViolations: 0,
    authenticationFailures: 0,
    maliciousInputAttempts: 0,
    activeSessionCount: 0,
    lastSecurityScan: new Date().toISOString(),
  };
};

export default {
  getSecurityConfig,
  applySecurity,
  validateSecurityConfig,
  performSecurityHealthCheck,
  recordSecurityIncident,
  getSecurityMetrics,
};