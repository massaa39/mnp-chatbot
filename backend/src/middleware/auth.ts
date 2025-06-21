import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { chatRepository } from '../repositories/chatRepository';
import { userRepository } from '../repositories/userRepository';
import { logger } from '../utils/logger';
import { APIResponse } from '../types/api';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role: string;
  };
  session?: {
    id: string;
    token: string;
    userId?: string;
  };
}

// JWT設定
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SESSION_EXPIRES_IN = process.env.SESSION_EXPIRES_IN || '7d';

/**
 * JWTトークンを生成
 */
export const generateToken = (payload: any): string => {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'mnp-chatbot',
    audience: 'mnp-chatbot-users'
  });
};

/**
 * JWTトークンを検証
 */
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'mnp-chatbot',
      audience: 'mnp-chatbot-users'
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_TOKEN');
    } else {
      throw new Error('TOKEN_VERIFICATION_FAILED');
    }
  }
};

/**
 * パスワードをハッシュ化
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

/**
 * パスワードを検証
 */
export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * セッショントークン認証ミドルウェア
 * チャット用の軽量認証
 */
export const authenticateSession = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const sessionToken = req.headers['x-session-token'] as string || 
                        req.body.sessionToken || 
                        req.query.sessionToken as string;

    if (!sessionToken) {
      res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_TOKEN_REQUIRED',
          message: 'セッショントークンが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
      return;
    }

    // セッション検証
    const session = await chatRepository.getSessionByToken(sessionToken);
    if (!session) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SESSION_TOKEN',
          message: '無効なセッショントークンです'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
      return;
    }

    // セッション有効期限チェック
    const now = new Date();
    if (session.expires_at && session.expires_at < now) {
      res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'セッションが期限切れです'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
      return;
    }

    // セッション情報をリクエストに追加
    req.session = {
      id: session.id,
      token: sessionToken,
      userId: session.user_id || undefined
    };

    // ユーザー情報も追加（存在する場合）
    if (session.user_id) {
      const user = await userRepository.getUserById(session.user_id);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email || undefined,
          role: user.role || 'user'
        };
      }
    }

    // セッションの最終活動時間を更新
    await chatRepository.updateSession(sessionToken, {
      last_activity: new Date()
    });

    next();

  } catch (error) {
    logger.error('セッション認証エラー', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: '認証処理中にエラーが発生しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * JWT認証ミドルウェア
 * 管理機能用の厳格な認証
 */
export const authenticateJWT = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: '認証トークンが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
      return;
    }

    // トークン検証
    const decoded = verifyToken(token);
    
    // ユーザー情報を取得
    const user = await userRepository.getUserById(decoded.userId);
    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND_OR_INACTIVE',
          message: 'ユーザーが見つからないか無効化されています'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
      return;
    }

    // ユーザー情報をリクエストに追加
    req.user = {
      id: user.id,
      email: user.email || undefined,
      role: user.role || 'user'
    };

    // ユーザーの最終ログイン時間を更新
    await userRepository.updateUserActivity(user.id, {
      last_login: new Date(),
      last_activity: new Date()
    });

    next();

  } catch (error) {
    logger.error('JWT認証エラー', { error });

    if (error instanceof Error) {
      switch (error.message) {
        case 'TOKEN_EXPIRED':
          res.status(401).json({
            success: false,
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'トークンの有効期限が切れています'
            },
            timestamp: new Date().toISOString()
          } as APIResponse<never>);
          return;

        case 'INVALID_TOKEN':
          res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message: '無効なトークンです'
            },
            timestamp: new Date().toISOString()
          } as APIResponse<never>);
          return;

        default:
          res.status(500).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_ERROR',
              message: '認証処理中にエラーが発生しました'
            },
            timestamp: new Date().toISOString()
          } as APIResponse<never>);
          return;
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: '認証処理中にエラーが発生しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * 管理者権限認証ミドルウェア
 */
export const requireAdmin = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: '認証が必要です'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
    return;
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: '管理者権限が必要です'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
    return;
  }

  next();
};

/**
 * 特定の権限レベル認証ミドルウェア
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: '認証が必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `必要な権限: ${allowedRoles.join(', ')}`
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
      return;
    }

    next();
  };
};

/**
 * オプショナル認証ミドルウェア
 * 認証トークンがある場合は検証するが、なくてもエラーにしない
 */
export const optionalAuth = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await userRepository.getUserById(decoded.userId);
        
        if (user && user.is_active) {
          req.user = {
            id: user.id,
            email: user.email || undefined,
            role: user.role || 'user'
          };
        }
      } catch (error) {
        // オプショナル認証なので、トークンエラーは無視
        logger.debug('オプショナル認証でトークンエラー', { error });
      }
    }

    next();

  } catch (error) {
    logger.error('オプショナル認証エラー', { error });
    next(); // エラーでも続行
  }
};

/**
 * APIキー認証ミドルウェア
 * 外部システム連携用
 */
export const authenticateAPIKey = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_REQUIRED',
          message: 'APIキーが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
      return;
    }

    // APIキー検証（環境変数または設定から）
    const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');
    
    if (!validApiKeys.includes(apiKey)) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: '無効なAPIキーです'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
      return;
    }

    next();

  } catch (error) {
    logger.error('APIキー認証エラー', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: '認証処理中にエラーが発生しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

// 型定義をエクスポート
export type { AuthenticatedRequest };
