/**
 * 認証ミドルウェア
 * Purpose: JWT認証とセッション管理
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    sessionId: string;
    sessionToken: string;
    permissions: string[];
  };
  sessionToken?: string;
}

export interface JWTPayload {
  userId: string;
  sessionId: string;
  sessionToken: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

/**
 * JWT認証ミドルウェア
 */
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'アクセストークンが必要です',
          timestamp: new Date().toISOString()
        }
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not configured');
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'サーバー設定エラー',
          timestamp: new Date().toISOString()
        }
      });
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        logger.warn('JWT verification failed', { error: err.message });
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'トークンが無効です',
            timestamp: new Date().toISOString()
          }
        });
      }

      const payload = decoded as JWTPayload;
      req.user = {
        id: payload.userId,
        sessionId: payload.sessionId,
        sessionToken: payload.sessionToken,
        permissions: payload.permissions || []
      };

      logger.info('User authenticated', { userId: payload.userId, sessionId: payload.sessionId });
      next();
    });
  } catch (error) {
    logger.error('Authentication error', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '認証処理エラー',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * セッション認証ミドルウェア（認証なしでもセッション情報取得）
 */
export const authenticateSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Bearer token からセッショントークンを取得
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    // または session-token ヘッダーから取得
    const sessionToken = req.headers['session-token'] as string || token;

    if (sessionToken) {
      req.sessionToken = sessionToken;
      logger.info('Session token provided', { sessionToken: sessionToken.substring(0, 8) + '...' });
    }

    next();
  } catch (error) {
    logger.error('Session authentication error', { error: error.message });
    next(); // セッション認証エラーでも処理を続行
  }
};

/**
 * 権限チェックミドルウェア
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('admin')) {
      logger.warn('Permission denied', { 
        userId: req.user.id, 
        requiredPermission: permission, 
        userPermissions: req.user.permissions 
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '権限が不足しています',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  };
};

/**
 * 管理者権限チェック
 */
export const requireAdmin = requirePermission('admin');

/**
 * オプショナル認証ミドルウェア
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // トークンがなくても処理続行
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(); // JWT設定がなくても処理続行
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (!err && decoded) {
        const payload = decoded as JWTPayload;
        req.user = {
          id: payload.userId,
          sessionId: payload.sessionId,
          sessionToken: payload.sessionToken,
          permissions: payload.permissions || []
        };
      }
      next(); // エラーがあっても処理続行
    });
  } catch (error) {
    logger.warn('Optional auth error', { error: error.message });
    next(); // エラーがあっても処理続行
  }
};

/**
 * レート制限用のキー生成
 */
export const getRateLimitKey = (req: AuthRequest): string => {
  // 認証済みユーザーの場合はユーザーIDを使用
  if (req.user) {
    return `user:${req.user.id}`;
  }
  
  // セッショントークンがある場合はそれを使用
  if (req.sessionToken) {
    return `session:${req.sessionToken}`;
  }
  
  // それ以外はIPアドレスを使用
  return `ip:${req.ip}`;
};

/**
 * JWT トークン生成
 */
export const generateJWT = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
};

/**
 * リフレッシュトークン生成
 */
export const generateRefreshToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }

  return jwt.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn });
};

/**
 * リフレッシュトークン検証
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }

  return jwt.verify(token, refreshSecret) as JWTPayload;
};

/**
 * セッション有効性チェック
 */
export const validateSession = async (sessionToken: string): Promise<boolean> => {
  try {
    // 実際の実装では、データベースでセッションの有効性をチェック
    // ここでは簡単な形式チェックのみ
    return sessionToken && sessionToken.length > 10;
  } catch (error) {
    logger.error('Session validation error', { error: error.message });
    return false;
  }
};

export default {
  authenticateJWT,
  authenticateSession,
  requirePermission,
  requireAdmin,
  optionalAuth,
  getRateLimitKey,
  generateJWT,
  generateRefreshToken,
  verifyRefreshToken,
  validateSession
};