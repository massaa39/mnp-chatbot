import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, query } from 'express-validator';
import {
  initiateEscalation,
  getEscalationStatus,
  updateEscalation,
  getEscalations,
  getEscalationDetails,
  getEscalationStats,
  resolveEscalation
} from '../../controllers/escalationController';
import { validateRequest } from '../../middleware/validation';
import { securityMiddleware } from '../../middleware/security';

const router = express.Router();

// エスカレーション用レート制限
const escalationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 10, // 15分間に10回まで（エスカレーションは頻繁に行われるべきではない）
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'エスカレーション要求が制限を超えました。しばらく待ってから再度お試しください。'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 一般的なAPI用レート制限
const apiRateLimit = rateLimit({
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
 * POST /api/v1/escalation
 * エスカレーション開始
 */
router.post('/',
  escalationRateLimit,
  securityMiddleware.validateInput,
  [
    body('sessionToken')
      .isUUID(4)
      .withMessage('有効なセッショントークンが必要です'),
    body('reason')
      .isString()
      .isLength({ min: 5, max: 500 })
      .withMessage('理由は5文字以上500文字以下で入力してください'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('優先度は low, medium, high, urgent のいずれかである必要があります'),
    body('contactInfo')
      .optional()
      .isObject()
      .withMessage('連絡先情報はオブジェクト形式である必要があります'),
    body('contactInfo.email')
      .optional()
      .isEmail()
      .withMessage('有効なメールアドレスを入力してください'),
    body('contactInfo.phone')
      .optional()
      .isMobilePhone('ja-JP')
      .withMessage('有効な電話番号を入力してください'),
    body('context')
      .optional()
      .isObject()
      .withMessage('コンテキストはオブジェクト形式である必要があります')
  ],
  validateRequest,
  initiateEscalation
);

/**
 * GET /api/v1/escalation/status/:sessionToken
 * エスカレーション状態取得
 */
router.get('/status/:sessionToken',
  apiRateLimit,
  [
    param('sessionToken')
      .isUUID(4)
      .withMessage('有効なセッショントークンが必要です')
  ],
  validateRequest,
  getEscalationStatus
);

/**
 * PUT /api/v1/escalation/:ticketId
 * エスカレーション更新（管理者用）
 */
router.put('/:ticketId',
  apiRateLimit,
  securityMiddleware.validateInput,
  [
    param('ticketId')
      .isUUID(4)
      .withMessage('有効なチケットIDが必要です'),
    body('status')
      .optional()
      .isIn(['pending', 'assigned', 'in_progress', 'waiting_customer', 'resolved', 'cancelled'])
      .withMessage('無効なステータスです'),
    body('assignedAgent')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('担当者名は1文字以上100文字以下である必要があります'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('メモは1000文字以下である必要があります'),
    body('estimatedWaitTime')
      .optional()
      .isInt({ min: 0, max: 10080 }) // 最大1週間（分単位）
      .withMessage('推定待ち時間は0から10080分の間で指定してください')
  ],
  validateRequest,
  updateEscalation
);

/**
 * GET /api/v1/escalation
 * エスカレーション一覧取得（管理者用）
 */
router.get('/',
  apiRateLimit,
  [
    query('status')
      .optional()
      .isIn(['pending', 'assigned', 'in_progress', 'waiting_customer', 'resolved', 'cancelled'])
      .withMessage('無効なステータスです'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('無効な優先度です'),
    query('assignedAgent')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('担当者名は1文字以上100文字以下である必要があります'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('制限数は1から100の間で指定してください'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('オフセットは0以上である必要があります'),
    query('orderBy')
      .optional()
      .isString()
      .matches(/^[a-zA-Z_]+\s+(ASC|DESC)$/i)
      .withMessage('無効なソート条件です')
  ],
  validateRequest,
  getEscalations
);

/**
 * GET /api/v1/escalation/:ticketId
 * エスカレーション詳細取得
 */
router.get('/:ticketId',
  apiRateLimit,
  [
    param('ticketId')
      .isUUID(4)
      .withMessage('有効なチケットIDが必要です')
  ],
  validateRequest,
  getEscalationDetails
);

/**
 * GET /api/v1/escalation/stats
 * エスカレーション統計取得（管理者用）
 */
router.get('/stats',
  apiRateLimit,
  [
    query('period')
      .optional()
      .isIn(['1d', '7d', '30d', '90d', '1y'])
      .withMessage('期間は 1d, 7d, 30d, 90d, 1y のいずれかである必要があります')
  ],
  validateRequest,
  getEscalationStats
);

/**
 * POST /api/v1/escalation/:ticketId/resolve
 * エスカレーション終了
 */
router.post('/:ticketId/resolve',
  apiRateLimit,
  securityMiddleware.validateInput,
  [
    param('ticketId')
      .isUUID(4)
      .withMessage('有効なチケットIDが必要です'),
    body('resolution')
      .optional()
      .isString()
      .isLength({ min: 5, max: 1000 })
      .withMessage('解決内容は5文字以上1000文字以下で入力してください'),
    body('feedback')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('フィードバックは500文字以下で入力してください'),
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('評価は1から5の間で指定してください')
  ],
  validateRequest,
  resolveEscalation
);

/**
 * POST /api/v1/escalation/:ticketId/cancel
 * エスカレーションキャンセル
 */
router.post('/:ticketId/cancel',
  apiRateLimit,
  [
    param('ticketId')
      .isUUID(4)
      .withMessage('有効なチケットIDが必要です'),
    body('reason')
      .optional()
      .isString()
      .isLength({ min: 5, max: 500 })
      .withMessage('キャンセル理由は5文字以上500文字以下で入力してください')
  ],
  validateRequest,
  async (req, res) => {
    try {
      // キャンセル処理をupdateEscalationを使って実装
      req.body = {
        status: 'cancelled',
        notes: req.body.reason || 'ユーザーによりキャンセルされました'
      };
      
      await updateEscalation(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CANCEL_ERROR',
          message: 'エスカレーションのキャンセルに失敗しました'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;