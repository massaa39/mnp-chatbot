import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, param } from 'express-validator';
import { 
  createSession, 
  verifySession, 
  refreshSession, 
  deleteSession,
  getSessionInfo 
} from '../../controllers/authController';
import { validateRequest } from '../../middleware/validation';
import { securityMiddleware } from '../../middleware/security';

const router = express.Router();

// 認証用レート制限（厳しめ）
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 15分間に5回まで
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '認証試行回数の制限に達しました。しばらく待ってから再度お試しください。'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// セッション管理用レート制限（通常）
const sessionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 15分間に100回まで
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'リクエスト数が制限を超えました。しばらく待ってから再度お試しください。'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/v1/sessions
 * セッション作成
 */
router.post('/sessions',
  sessionRateLimit,
  securityMiddleware.validateInput,
  [
    body('mode')
      .optional()
      .isIn(['step_by_step', 'roadmap'])
      .withMessage('モードは step_by_step または roadmap である必要があります'),
    body('userAgent')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('ユーザーエージェントは500文字以下である必要があります'),
    body('language')
      .optional()
      .isString()
      .isLength({ max: 10 })
      .withMessage('言語コードは10文字以下である必要があります'),
    body('timezone')
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage('タイムゾーンは50文字以下である必要があります')
  ],
  validateRequest,
  createSession
);

/**
 * GET /api/v1/sessions/:sessionToken/verify
 * セッション検証
 */
router.get('/sessions/:sessionToken/verify',
  sessionRateLimit,
  [
    param('sessionToken')
      .isUUID(4)
      .withMessage('有効なセッショントークンが必要です')
  ],
  validateRequest,
  verifySession
);

/**
 * POST /api/v1/sessions/:sessionToken/refresh
 * セッション更新
 */
router.post('/sessions/:sessionToken/refresh',
  sessionRateLimit,
  [
    param('sessionToken')
      .isUUID(4)
      .withMessage('有効なセッショントークンが必要です')
  ],
  validateRequest,
  refreshSession
);

/**
 * DELETE /api/v1/sessions/:sessionToken
 * セッション削除
 */
router.delete('/sessions/:sessionToken',
  sessionRateLimit,
  [
    param('sessionToken')
      .isUUID(4)
      .withMessage('有効なセッショントークンが必要です')
  ],
  validateRequest,
  deleteSession
);

/**
 * GET /api/v1/sessions/:sessionToken
 * セッション情報取得
 */
router.get('/sessions/:sessionToken',
  sessionRateLimit,
  [
    param('sessionToken')
      .isUUID(4)
      .withMessage('有効なセッショントークンが必要です')
  ],
  validateRequest,
  getSessionInfo
);

/**
 * POST /api/v1/sessions/:sessionToken/ws-token
 * WebSocket接続用トークン取得
 */
router.post('/sessions/:sessionToken/ws-token',
  sessionRateLimit,
  [
    param('sessionToken')
      .isUUID(4)
      .withMessage('有効なセッショントークンが必要です')
  ],
  validateRequest,
  async (req, res) => {
    try {
      // WebSocket用トークン生成ロジック
      const wsToken = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const wsUrl = process.env.WS_URL || 'ws://localhost:3001';
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間後

      res.json({
        success: true,
        data: {
          wsToken,
          wsUrl,
          expiresAt: expiresAt.toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'WS_TOKEN_ERROR',
          message: 'WebSocketトークンの生成に失敗しました'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;