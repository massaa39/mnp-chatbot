import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, query } from 'express-validator';
import {
  searchFAQs,
  getFAQById,
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getFAQStats,
  batchUpdateEmbeddings
} from '../../controllers/faqController';
import { validateRequest } from '../../middleware/validation';
import { securityMiddleware } from '../../middleware/security';

const router = express.Router();

// FAQ検索用レート制限（ユーザー向け）
const searchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 200, // 15分間に200回まで（検索は頻繁に行われる）
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '検索リクエストが制限を超えました。しばらく待ってから再度お試しください。'
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

// 管理機能用レート制限（厳しめ）
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 50, // 15分間に50回まで
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '管理機能のリクエストが制限を超えました。しばらく待ってから再度お試しください。'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/v1/faq/search
 * FAQ検索（複合検索）
 */
router.post('/search',
  searchRateLimit,
  securityMiddleware.validateInput,
  [
    body('query')
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('検索クエリは1文字以上200文字以下で入力してください'),
    body('category')
      .optional()
      .isIn(['mnp_basic', 'carrier_specific', 'troubleshooting', 'technical'])
      .withMessage('無効なカテゴリです'),
    body('carrier')
      .optional()
      .isIn(['docomo', 'au', 'softbank', 'rakuten'])
      .withMessage('無効なキャリアです'),
    body('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('制限数は1から50の間で指定してください'),
    body('useVectorSearch')
      .optional()
      .isBoolean()
      .withMessage('ベクトル検索フラグはboolean値である必要があります'),
    body('useFullTextSearch')
      .optional()
      .isBoolean()
      .withMessage('全文検索フラグはboolean値である必要があります')
  ],
  validateRequest,
  searchFAQs
);

/**
 * GET /api/v1/faq/:faqId
 * FAQ詳細取得
 */
router.get('/:faqId',
  apiRateLimit,
  [
    param('faqId')
      .isUUID(4)
      .withMessage('有効なFAQ IDが必要です')
  ],
  validateRequest,
  getFAQById
);

/**
 * GET /api/v1/faq
 * FAQ一覧取得
 */
router.get('/',
  apiRateLimit,
  [
    query('category')
      .optional()
      .isIn(['mnp_basic', 'carrier_specific', 'troubleshooting', 'technical'])
      .withMessage('無効なカテゴリです'),
    query('carrier')
      .optional()
      .isIn(['docomo', 'au', 'softbank', 'rakuten'])
      .withMessage('無効なキャリアです'),
    query('searchText')
      .optional()
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('検索テキストは1文字以上200文字以下で入力してください'),
    query('priority')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('優先度は1から10の間で指定してください'),
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
  getFAQs
);

/**
 * POST /api/v1/faq
 * FAQ作成（管理者用）
 */
router.post('/',
  adminRateLimit,
  securityMiddleware.validateInput,
  [
    body('question')
      .isString()
      .isLength({ min: 5, max: 500 })
      .withMessage('質問は5文字以上500文字以下で入力してください'),
    body('answer')
      .isString()
      .isLength({ min: 10, max: 2000 })
      .withMessage('回答は10文字以上2000文字以下で入力してください'),
    body('category')
      .isIn(['mnp_basic', 'carrier_specific', 'troubleshooting', 'technical'])
      .withMessage('無効なカテゴリです'),
    body('carrier')
      .optional()
      .isIn(['docomo', 'au', 'softbank', 'rakuten'])
      .withMessage('無効なキャリアです'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('タグは配列形式である必要があります'),
    body('tags.*')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('各タグは1文字以上50文字以下である必要があります'),
    body('priority')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('優先度は1から10の間で指定してください')
  ],
  validateRequest,
  createFAQ
);

/**
 * PUT /api/v1/faq/:faqId
 * FAQ更新（管理者用）
 */
router.put('/:faqId',
  adminRateLimit,
  securityMiddleware.validateInput,
  [
    param('faqId')
      .isUUID(4)
      .withMessage('有効なFAQ IDが必要です'),
    body('question')
      .optional()
      .isString()
      .isLength({ min: 5, max: 500 })
      .withMessage('質問は5文字以上500文字以下で入力してください'),
    body('answer')
      .optional()
      .isString()
      .isLength({ min: 10, max: 2000 })
      .withMessage('回答は10文字以上2000文字以下で入力してください'),
    body('category')
      .optional()
      .isIn(['mnp_basic', 'carrier_specific', 'troubleshooting', 'technical'])
      .withMessage('無効なカテゴリです'),
    body('carrier')
      .optional()
      .isIn(['docomo', 'au', 'softbank', 'rakuten'])
      .withMessage('無効なキャリアです'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('タグは配列形式である必要があります'),
    body('tags.*')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('各タグは1文字以上50文字以下である必要があります'),
    body('priority')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('優先度は1から10の間で指定してください'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('アクティブフラグはboolean値である必要があります')
  ],
  validateRequest,
  updateFAQ
);

/**
 * DELETE /api/v1/faq/:faqId
 * FAQ削除（管理者用）
 */
router.delete('/:faqId',
  adminRateLimit,
  [
    param('faqId')
      .isUUID(4)
      .withMessage('有効なFAQ IDが必要です')
  ],
  validateRequest,
  deleteFAQ
);

/**
 * GET /api/v1/faq/stats
 * FAQ統計取得
 */
router.get('/stats',
  apiRateLimit,
  getFAQStats
);

/**
 * POST /api/v1/faq/embeddings/batch-update
 * FAQ埋め込みベクトル一括更新（管理者用）
 */
router.post('/embeddings/batch-update',
  adminRateLimit,
  securityMiddleware.validateInput,
  [
    body('faqIds')
      .isArray({ min: 1, max: 100 })
      .withMessage('FAQ IDは1個以上100個以下の配列である必要があります'),
    body('faqIds.*')
      .isUUID(4)
      .withMessage('各FAQ IDは有効なUUID形式である必要があります'),
    body('force')
      .optional()
      .isBoolean()
      .withMessage('強制更新フラグはboolean値である必要があります')
  ],
  validateRequest,
  batchUpdateEmbeddings
);

/**
 * GET /api/v1/faq/categories
 * 利用可能なカテゴリ一覧取得
 */
router.get('/categories',
  apiRateLimit,
  async (req, res) => {
    try {
      const categories = [
        {
          id: 'mnp_basic',
          name: 'MNP基本情報',
          description: 'MNPの基本的な手続きや概要について'
        },
        {
          id: 'carrier_specific',
          name: 'キャリア固有情報',
          description: '各キャリア特有の手続きや注意事項'
        },
        {
          id: 'troubleshooting',
          name: 'トラブルシューティング',
          description: 'よくある問題とその解決方法'
        },
        {
          id: 'technical',
          name: '技術的な情報',
          description: '技術的な詳細や仕様について'
        }
      ];

      res.json({
        success: true,
        data: categories,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CATEGORIES_FETCH_ERROR',
          message: 'カテゴリ一覧の取得に失敗しました'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/v1/faq/carriers
 * 利用可能なキャリア一覧取得
 */
router.get('/carriers',
  apiRateLimit,
  async (req, res) => {
    try {
      const carriers = [
        {
          id: 'docomo',
          name: 'NTTドコモ',
          description: 'NTTドコモ関連の情報'
        },
        {
          id: 'au',
          name: 'au',
          description: 'au（KDDI）関連の情報'
        },
        {
          id: 'softbank',
          name: 'ソフトバンク',
          description: 'ソフトバンク関連の情報'
        },
        {
          id: 'rakuten',
          name: '楽天モバイル',
          description: '楽天モバイル関連の情報'
        }
      ];

      res.json({
        success: true,
        data: carriers,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CARRIERS_FETCH_ERROR',
          message: 'キャリア一覧の取得に失敗しました'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;