/**
 * チャットAPI ルーティング
 * Purpose: チャット関連のAPIエンドポイント定義
 */
import { Router } from 'express';
import { chatController } from '../../controllers/chatController';
import { validateRequest } from '../../middleware/validation';
import { rateLimit } from '../../middleware/rateLimit';

const router = Router();

// セッション作成
router.post('/sessions', 
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), // 15分間に10回まで
  validateRequest({
    body: {
      mode: { in: ['roadmap', 'step_by_step'] },
      phoneNumber: { optional: true, isLength: { options: { min: 10, max: 15 } } },
      currentCarrier: { optional: true, isString: true },
      targetCarrier: { optional: true, isString: true },
      preferences: { optional: true, isObject: true }
    }
  }),
  chatController.createSession.bind(chatController)
);

// セッション検証
router.post('/sessions/verify',
  validateRequest({
    body: {
      sessionToken: { isUUID: true }
    }
  }),
  chatController.verifySession.bind(chatController)
);

// メッセージ送信
router.post('/messages',
  rateLimit({ windowMs: 1 * 60 * 1000, max: 30 }), // 1分間に30回まで
  validateRequest({
    body: {
      message: { isLength: { options: { min: 1, max: 1000 } } },
      sessionToken: { isUUID: true },
      mode: { optional: true, in: ['roadmap', 'step_by_step'] },
      contextData: { optional: true, isObject: true }
    }
  }),
  chatController.sendMessage.bind(chatController)
);

// 会話履歴取得
router.get('/history/:sessionToken',
  validateRequest({
    params: {
      sessionToken: { isUUID: true }
    },
    query: {
      page: { optional: true, isInt: { options: { min: 1 } } },
      limit: { optional: true, isInt: { options: { min: 1, max: 100 } } }
    }
  }),
  chatController.getHistory.bind(chatController)
);

export default router;
