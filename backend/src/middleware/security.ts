/**
 * セキュリティミドルウェア
 * Purpose: セキュリティヘッダー、CSRF保護、入力検証
 */

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult, ValidationChain } from 'express-validator';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { AuthRequest, getRateLimitKey } from './authentication';

/**
 * Helmet設定（セキュリティヘッダー）
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      childSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

/**
 * CORS設定
 */
export const corsConfig = cors({
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001').split(',');
    
    // 開発環境では localhost を許可
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
    }
    
    // origin が undefined（同一オリジン）または許可リストに含まれる場合は許可
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'session-token'],
  maxAge: 86400 // 24 hours
});

/**
 * API レート制限
 */
export const apiRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: (req: AuthRequest) => {
    // 認証済みユーザーはより緩い制限
    if (req.user) {
      return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200');
    }
    return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
  },
  keyGenerator: getRateLimitKey,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'レート制限に達しました。しばらく時間をおいてから再度お試しください。',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: (req, res, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      key: getRateLimitKey(req as AuthRequest)
    });
  }
});

/**
 * 認証エンドポイント用のレート制限（より厳しい）
 */
export const authRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: 5, // 認証試行は5回まで
  keyGenerator: getRateLimitKey,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: '認証試行回数の制限に達しました。しばらく時間をおいてから再度お試しください。',
      timestamp: new Date().toISOString()
    }
  },
  onLimitReached: (req, res, options) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      key: getRateLimitKey(req as AuthRequest)
    });
  }
});

/**
 * API レスポンス速度制限
 */
export const apiSlowDown = slowDown({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  delayAfter: 50, // 50リクエスト後から遅延開始
  delayMs: 500, // 500ms遅延
  maxDelayMs: 10000, // 最大10秒遅延
  keyGenerator: getRateLimitKey
});

/**
 * 入力検証エラーハンドラー
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation error', { errors: errors.array(), body: req.body });
    
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '入力データが不正です',
        details: errors.array().map(error => ({
          field: error.param,
          message: error.msg,
          value: error.value
        })),
        timestamp: new Date().toISOString()
      }
    });
  }
  
  next();
};

/**
 * 共通入力検証ルール
 */
export const validationRules = {
  // セッショントークン検証
  sessionToken: body('sessionToken')
    .optional()
    .isLength({ min: 10, max: 255 })
    .withMessage('セッショントークンの形式が正しくありません'),

  // メッセージ検証
  message: body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('メッセージは1文字以上1000文字以下で入力してください')
    .escape(),

  // 電話番号検証
  phoneNumber: body('phoneNumber')
    .optional()
    .matches(/^(070|080|090)[0-9]{8}$/)
    .withMessage('正しい携帯電話番号を入力してください'),

  // 格安SIM事業者検証
  carrier: body('currentCarrier')
    .optional()
    .isIn(['rakuten', 'mineo', 'uq', 'ymobile', 'iijmio', 'ocn', 'biglobe', 'other'])
    .withMessage('サポートされていない格安SIM事業者です'),

  // モード検証
  mode: body('mode')
    .isIn(['roadmap', 'step_by_step'])
    .withMessage('サポートされていないモードです'),

  // UUID検証
  uuid: param('id')
    .isUUID()
    .withMessage('正しいIDを指定してください'),

  // ページネーション検証
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('ページ番号は1以上の整数を指定してください'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('取得件数は1以上100以下の整数を指定してください')
  ],

  // エスカレーション検証
  escalation: [
    body('reason')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('理由は1文字以上500文字以下で入力してください'),
    body('urgencyLevel')
      .isIn(['low', 'medium', 'high'])
      .withMessage('緊急度レベルが正しくありません'),
    body('customerInfo.preferredContact')
      .isIn(['line', 'phone', 'email'])
      .withMessage('希望連絡方法が正しくありません')
  ]
};

/**
 * CSRF保護
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // GET、HEAD、OPTIONS リクエストはCSRF保護をスキップ
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.headers['session-token'];

  if (!token || !sessionToken) {
    logger.warn('CSRF token missing', { method: req.method, path: req.path });
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'CSRF トークンが必要です',
        timestamp: new Date().toISOString()
      }
    });
  }

  // 簡単なCSRFトークン検証（実際の実装ではより厳密に）
  const expectedToken = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'default-secret')
    .update(sessionToken)
    .digest('hex');

  if (token !== expectedToken) {
    logger.warn('CSRF token invalid', { method: req.method, path: req.path });
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'CSRF トークンが無効です',
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

/**
 * ファイルアップロード保護
 */
export const fileUploadSecurity = (req: Request, res: Response, next: NextFunction) => {
  // ファイルサイズ制限
  const maxSize = parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '10485760'); // 10MB
  
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'ファイルサイズが大きすぎます',
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

/**
 * IPアドレスホワイトリスト
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip;
    
    if (!allowedIPs.includes(clientIP)) {
      logger.warn('IP address blocked', { ip: clientIP });
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: 'アクセスが拒否されました',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    next();
  };
};

/**
 * SQL インジェクション保護
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(--|\/\*|\*\/|;|'|")/,
    /(\b(OR|AND)\b.*=.*)/i
  ];

  const checkForSQLInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSQLInjection(value));
    }
    
    return false;
  };

  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query)) {
    logger.warn('Potential SQL injection attempt', {
      ip: req.ip,
      body: req.body,
      query: req.query,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(400).json({
      success: false,
      error: {
        code: 'MALICIOUS_INPUT',
        message: '不正な入力が検出されました',
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

export default {
  helmetConfig,
  corsConfig,
  apiRateLimit,
  authRateLimit,
  apiSlowDown,
  handleValidationErrors,
  validationRules,
  csrfProtection,
  fileUploadSecurity,
  ipWhitelist,
  sqlInjectionProtection
};