/**
 * データ保護・プライバシー保護ミドルウェア
 * Purpose: 個人情報保護、データマスキング、GDPR準拠
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface PrivacyConfig {
  maskPhoneNumbers: boolean;
  maskEmails: boolean;
  logPersonalData: boolean;
  retentionPeriod: number; // 日数
}

const defaultPrivacyConfig: PrivacyConfig = {
  maskPhoneNumbers: true,
  maskEmails: true,
  logPersonalData: false,
  retentionPeriod: 30,
};

/**
 * 電話番号をマスクする
 */
export const maskPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber || phoneNumber.length < 8) {
    return phoneNumber;
  }
  
  // 090-1234-5678 → 090-****-5678
  const start = phoneNumber.substring(0, 3);
  const end = phoneNumber.substring(phoneNumber.length - 4);
  const middle = '*'.repeat(phoneNumber.length - 7);
  
  return `${start}-${middle}-${end}`;
};

/**
 * メールアドレスをマスクする
 */
export const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) {
    return email;
  }
  
  const [localPart, domain] = email.split('@');
  const maskedLocal = localPart.substring(0, 2) + '*'.repeat(Math.max(0, localPart.length - 2));
  
  return `${maskedLocal}@${domain}`;
};

/**
 * 機密データをマスクする
 */
export const maskSensitiveData = (data: any, config: PrivacyConfig = defaultPrivacyConfig): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const masked = Array.isArray(data) ? [...data] : { ...data };
  
  Object.keys(masked).forEach(key => {
    const value = masked[key];
    
    if (typeof value === 'string') {
      // 電話番号のマスキング
      if (config.maskPhoneNumbers && /^(070|080|090)[0-9]{8}$/.test(value)) {
        masked[key] = maskPhoneNumber(value);
      }
      // メールアドレスのマスキング
      else if (config.maskEmails && /@/.test(value)) {
        masked[key] = maskEmail(value);
      }
      // クレジットカード番号のマスキング
      else if (/^[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}$/.test(value)) {
        masked[key] = value.substring(0, 4) + '-****-****-' + value.substring(value.length - 4);
      }
    }
    // ネストしたオブジェクトの処理
    else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, config);
    }
  });
  
  return masked;
};

/**
 * 個人情報を含むリクエストのログマスキング
 */
export const logMaskingMiddleware = (config: PrivacyConfig = defaultPrivacyConfig) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 元のbodyとqueryを保存
    const originalBody = req.body;
    const originalQuery = req.query;
    
    // ログ用のマスクされたデータを作成
    if (config.logPersonalData) {
      const maskedBody = maskSensitiveData(originalBody, config);
      const maskedQuery = maskSensitiveData(originalQuery, config);
      
      logger.info('Request received', {
        method: req.method,
        path: req.path,
        body: maskedBody,
        query: maskedQuery,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }
    
    next();
  };
};

/**
 * レスポンスデータのマスキング
 */
export const responseMaskingMiddleware = (config: PrivacyConfig = defaultPrivacyConfig) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // 機密データをマスク（ログ出力用）
      const maskedBody = maskSensitiveData(body, config);
      
      logger.debug('Response sent', {
        path: req.path,
        status: res.statusCode,
        data: maskedBody,
      });
      
      // 元のレスポンスを送信（マスクしない）
      return originalJson.call(this, body);
    };
    
    next();
  };
};

/**
 * 個人データ暗号化
 */
export const encryptPersonalData = (data: string, key?: string): string => {
  const encryptionKey = key || process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return encrypted;
};

/**
 * 個人データ復号化
 */
export const decryptPersonalData = (encryptedData: string, key?: string): string => {
  try {
    const encryptionKey = key || process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Data decryption failed', { error: error.message });
    throw new Error('復号化に失敗しました');
  }
};

/**
 * データ保持期間チェック
 */
export const checkDataRetention = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 古いセッションデータの自動削除（実装例）
    const retentionDays = defaultPrivacyConfig.retentionPeriod;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    // 実際の実装では定期的なクリーンアップジョブで実行
    logger.debug('Data retention check', {
      cutoffDate: cutoffDate.toISOString(),
      retentionDays,
    });
    
    next();
  } catch (error) {
    logger.error('Data retention check failed', { error: error.message });
    next();
  }
};

/**
 * GDPR準拠の同意確認
 */
export const gdprConsentMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const consentHeader = req.headers['x-privacy-consent'] as string;
  const consentBody = req.body.privacyConsent;
  
  // プライバシーポリシーに関わるエンドポイントの場合
  const privacyRoutes = ['/api/chat/session', '/api/user/register', '/api/user/profile'];
  
  if (privacyRoutes.some(route => req.path.startsWith(route))) {
    if (!consentHeader && !consentBody) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PRIVACY_CONSENT_REQUIRED',
          message: 'プライバシーポリシーへの同意が必要です',
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    // 同意の記録（監査ログ）
    logger.info('Privacy consent recorded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      consent: consentHeader || consentBody,
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

/**
 * セキュアなファイル保存
 */
export const secureFileStorage = {
  /**
   * ファイル名のサニタイズ
   */
  sanitizeFilename: (filename: string): string => {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  },
  
  /**
   * ファイルタイプの検証
   */
  validateFileType: (filename: string, allowedTypes: string[]): boolean => {
    const extension = filename.split('.').pop()?.toLowerCase();
    return allowedTypes.includes(extension || '');
  },
  
  /**
   * ファイルのウイルススキャン（プレースホルダー）
   */
  scanForVirus: async (filePath: string): Promise<boolean> => {
    // 実際の実装では ClamAV などのウイルススキャナーを使用
    logger.debug('File virus scan', { filePath });
    return true; // 仮の実装
  },
};

/**
 * データベース操作の監査ログ
 */
export const auditLogMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const sensitiveOperations = ['POST', 'PUT', 'DELETE'];
  
  if (sensitiveOperations.includes(req.method)) {
    logger.info('Database operation audit', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      // 個人情報は含めない
    });
  }
  
  next();
};

/**
 * データ匿名化
 */
export const anonymizeData = (data: any): any => {
  const anonymized = { ...data };
  
  // 識別可能な情報を削除・匿名化
  delete anonymized.phoneNumber;
  delete anonymized.email;
  delete anonymized.sessionId;
  
  // IPアドレスの匿名化（末尾をマスク）
  if (anonymized.ip) {
    const ipParts = anonymized.ip.split('.');
    anonymized.ip = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.xxx`;
  }
  
  // タイムスタンプの精度を下げる（時間単位）
  if (anonymized.timestamp) {
    const date = new Date(anonymized.timestamp);
    date.setMinutes(0, 0, 0);
    anonymized.timestamp = date.toISOString();
  }
  
  return anonymized;
};

/**
 * プライバシー保護の設定を取得
 */
export const getPrivacyConfig = (): PrivacyConfig => {
  return {
    maskPhoneNumbers: process.env.MASK_PHONE_NUMBERS === 'true',
    maskEmails: process.env.MASK_EMAILS === 'true',
    logPersonalData: process.env.LOG_PERSONAL_DATA === 'true',
    retentionPeriod: parseInt(process.env.DATA_RETENTION_DAYS || '30'),
  };
};

export default {
  maskPhoneNumber,
  maskEmail,
  maskSensitiveData,
  logMaskingMiddleware,
  responseMaskingMiddleware,
  encryptPersonalData,
  decryptPersonalData,
  checkDataRetention,
  gdprConsentMiddleware,
  secureFileStorage,
  auditLogMiddleware,
  anonymizeData,
  getPrivacyConfig,
};