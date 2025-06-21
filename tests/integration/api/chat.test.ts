/**
 * Chat API 統合テスト
 * Purpose: チャット機能のAPI統合テスト
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../helpers/testApp';
import {
  testDataFactory,
  testHelpers,
  cleanupDatabase,
  cleanupRedis,
} from '../../helpers/testSetup';

describe('Chat API Integration', () => {
  let app: Express;
  let testUser: any;
  let testSession: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await cleanupRedis();
  });

  beforeEach(async () => {
    // テストデータの準備
    testUser = testDataFactory.createUser();
    testSession = testDataFactory.createChatSession({
      userId: testUser.id,
    });
  });

  describe('POST /api/chat/session', () => {
    it('新しいチャットセッションを作成できる', async () => {
      const response = await request(app)
        .post('/api/chat/session')
        .send({
          mode: 'step_by_step',
          phoneNumber: '09012345678',
          currentCarrier: 'docomo',
          targetCarrier: 'au',
          preferences: {
            language: 'ja',
            notifications: true,
          },
        })
        .expect(201);

      testHelpers.expectAPISuccess(response.body);
      
      expect(response.body.data).toMatchObject({
        sessionToken: expect.any(String),
        user: expect.objectContaining({
          phoneNumber: '09012345678',
          currentCarrier: 'docomo',
          targetCarrier: 'au',
          status: 'active',
        }),
        session: expect.objectContaining({
          mode: 'step_by_step',
          currentStep: 'initial',
          status: 'active',
        }),
      });

      testHelpers.expectToBeUUID(response.body.data.sessionToken);
    });

    it('必須パラメータが不足している場合は400エラーを返す', async () => {
      const response = await request(app)
        .post('/api/chat/session')
        .send({
          // mode が未指定
          phoneNumber: '09012345678',
        })
        .expect(400);

      testHelpers.expectAPIError(response.body, 'VALIDATION_ERROR');
    });

    it('無効な電話番号の場合は400エラーを返す', async () => {
      const response = await request(app)
        .post('/api/chat/session')
        .send({
          mode: 'step_by_step',
          phoneNumber: 'invalid-phone',
          currentCarrier: 'docomo',
        })
        .expect(400);

      testHelpers.expectAPIError(response.body, 'VALIDATION_ERROR');
    });

    it('無効なキャリア名の場合は400エラーを返す', async () => {
      const response = await request(app)
        .post('/api/chat/session')
        .send({
          mode: 'step_by_step',
          phoneNumber: '09012345678',
          currentCarrier: 'invalid-carrier',
        })
        .expect(400);

      testHelpers.expectAPIError(response.body, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/chat/message', () => {
    it('メッセージを送信してAI応答を受け取れる', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: testSession.sessionToken,
          message: 'MNPの手続きについて教えてください',
          mode: 'step_by_step',
          contextData: {},
        })
        .expect(200);

      testHelpers.expectAPISuccess(response.body);

      expect(response.body.data).toMatchObject({
        message: expect.any(String),
        suggestions: expect.any(Array),
        actions: expect.any(Array),
        sessionToken: testSession.sessionToken,
        metadata: expect.objectContaining({
          responseTime: expect.any(Number),
          confidenceScore: expect.any(Number),
        }),
      });

      // 応答メッセージがMNPに関連していることを確認
      expect(response.body.data.message).toMatch(/MNP|ポータビリティ|手続き/);
    });

    it('無効なセッショントークンの場合は401エラーを返す', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: 'invalid-session-token',
          message: 'テストメッセージ',
        })
        .expect(401);

      testHelpers.expectAPIError(response.body, 'INVALID_SESSION_TOKEN');
    });

    it('期限切れセッションの場合は401エラーを返す', async () => {
      const expiredSession = testDataFactory.createChatSession({
        userId: testUser.id,
        expiresAt: new Date(Date.now() - 1000), // 1秒前に期限切れ
      });

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: expiredSession.sessionToken,
          message: 'テストメッセージ',
        })
        .expect(401);

      testHelpers.expectAPIError(response.body, 'SESSION_EXPIRED');
    });

    it('空のメッセージの場合は400エラーを返す', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: testSession.sessionToken,
          message: '',
        })
        .expect(400);

      testHelpers.expectAPIError(response.body, 'VALIDATION_ERROR');
    });

    it('長すぎるメッセージの場合は400エラーを返す', async () => {
      const longMessage = 'a'.repeat(5001); // 5000文字を超える

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: testSession.sessionToken,
          message: longMessage,
        })
        .expect(400);

      testHelpers.expectAPIError(response.body, 'VALIDATION_ERROR');
    });

    it('キャリア固有の質問に対して適切な応答を返す', async () => {
      // ドコモユーザーのテストセッション
      const docomoUser = testDataFactory.createUser({
        currentCarrier: 'docomo',
        targetCarrier: 'au',
      });
      const docomoSession = testDataFactory.createChatSession({
        userId: docomoUser.id,
      });

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: docomoSession.sessionToken,
          message: 'ドコモからMNP転出する方法を教えてください',
          mode: 'step_by_step',
        })
        .expect(200);

      // ドコモ固有の情報が含まれていることを確認
      expect(response.body.data.message).toMatch(/ドコモ|docomo|My docomo|151/i);
    });

    it('ロードマップモードで全体の流れに関する応答を返す', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: testSession.sessionToken,
          message: 'MNPの全体的な流れを教えてください',
          mode: 'roadmap',
        })
        .expect(200);

      expect(response.body.data.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'button',
            label: expect.stringMatching(/ロードマップ|全体|流れ/),
          }),
        ])
      );
    });

    it('複雑な質問でエスカレーションが提案される', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: testSession.sessionToken,
          message: '複雑な法的問題についての詳細な相談があります',
          mode: 'step_by_step',
        })
        .expect(200);

      expect(response.body.shouldEscalate).toBe(true);
      expect(response.body.escalationReason).toBeDefined();
    });
  });

  describe('POST /api/chat/verify', () => {
    it('有効なセッションの検証ができる', async () => {
      const response = await request(app)
        .post('/api/chat/verify')
        .send({
          sessionToken: testSession.sessionToken,
        })
        .expect(200);

      testHelpers.expectAPISuccess(response.body);

      expect(response.body.data).toMatchObject({
        valid: true,
        user: expect.objectContaining({
          sessionId: testUser.sessionId,
        }),
        session: expect.objectContaining({
          sessionToken: testSession.sessionToken,
          mode: testSession.mode,
        }),
        expiresAt: expect.any(String),
      });
    });

    it('無効なセッションの検証結果を返す', async () => {
      const response = await request(app)
        .post('/api/chat/verify')
        .send({
          sessionToken: 'invalid-token',
        })
        .expect(200);

      testHelpers.expectAPISuccess(response.body);
      expect(response.body.data.valid).toBe(false);
    });

    it('期限切れセッションの検証結果を返す', async () => {
      const expiredSession = testDataFactory.createChatSession({
        userId: testUser.id,
        expiresAt: new Date(Date.now() - 1000),
      });

      const response = await request(app)
        .post('/api/chat/verify')
        .send({
          sessionToken: expiredSession.sessionToken,
        })
        .expect(200);

      testHelpers.expectAPISuccess(response.body);
      expect(response.body.data.valid).toBe(false);
    });
  });

  describe('GET /api/chat/history/:sessionToken', () => {
    it('チャット履歴を取得できる', async () => {
      // テスト用メッセージを事前に作成
      const messages = [
        testDataFactory.createMessage({
          sessionId: testSession.id,
          messageType: 'user',
          content: 'ユーザーメッセージ1',
        }),
        testDataFactory.createMessage({
          sessionId: testSession.id,
          messageType: 'assistant',
          content: 'AI応答1',
        }),
        testDataFactory.createMessage({
          sessionId: testSession.id,
          messageType: 'user',
          content: 'ユーザーメッセージ2',
        }),
      ];

      const response = await request(app)
        .get(`/api/chat/history/${testSession.sessionToken}`)
        .query({
          page: 1,
          limit: 10,
        })
        .expect(200);

      testHelpers.expectAPISuccess(response.body);

      expect(response.body.data).toMatchObject({
        messages: expect.arrayContaining([
          expect.objectContaining({
            messageType: 'user',
            content: 'ユーザーメッセージ1',
          }),
          expect.objectContaining({
            messageType: 'assistant',
            content: 'AI応答1',
          }),
        ]),
        session: expect.objectContaining({
          sessionToken: testSession.sessionToken,
        }),
        user: expect.objectContaining({
          sessionId: testUser.sessionId,
        }),
        pagination: expect.objectContaining({
          total: messages.length,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }),
      });
    });

    it('ページネーションが正常に動作する', async () => {
      // 15件のメッセージを作成
      const messages = Array.from({ length: 15 }, (_, i) =>
        testDataFactory.createMessage({
          sessionId: testSession.id,
          messageType: i % 2 === 0 ? 'user' : 'assistant',
          content: `メッセージ ${i + 1}`,
        })
      );

      // 2ページ目を取得 (5件ずつ)
      const response = await request(app)
        .get(`/api/chat/history/${testSession.sessionToken}`)
        .query({
          page: 2,
          limit: 5,
        })
        .expect(200);

      expect(response.body.data.pagination).toMatchObject({
        total: 15,
        page: 2,
        limit: 5,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });

      expect(response.body.data.messages).toHaveLength(5);
    });

    it('存在しないセッションの場合は404エラーを返す', async () => {
      const response = await request(app)
        .get('/api/chat/history/non-existent-token')
        .expect(404);

      testHelpers.expectAPIError(response.body, 'SESSION_NOT_FOUND');
    });
  });

  describe('POST /api/chat/escalate', () => {
    it('エスカレーションを開始できる', async () => {
      const response = await request(app)
        .post('/api/chat/escalate')
        .send({
          sessionToken: testSession.sessionToken,
          reason: '複雑な技術的問題',
          priority: 'high',
          context: {
            lastMessages: ['ユーザー質問', 'AI応答'],
            mode: 'step_by_step',
            currentStep: 'troubleshooting',
          },
        })
        .expect(200);

      testHelpers.expectAPISuccess(response.body);

      expect(response.body.data).toMatchObject({
        ticketId: expect.any(String),
        estimatedWaitTime: expect.any(Number),
        lineUrl: expect.stringContaining('line.me'),
        status: 'pending',
      });

      testHelpers.expectToBeUUID(response.body.data.ticketId);
    });

    it('無効なセッションでエスカレーション要求した場合は401エラーを返す', async () => {
      const response = await request(app)
        .post('/api/chat/escalate')
        .send({
          sessionToken: 'invalid-token',
          reason: 'テスト理由',
        })
        .expect(401);

      testHelpers.expectAPIError(response.body, 'INVALID_SESSION_TOKEN');
    });

    it('理由が未指定の場合は400エラーを返す', async () => {
      const response = await request(app)
        .post('/api/chat/escalate')
        .send({
          sessionToken: testSession.sessionToken,
          // reason が未指定
        })
        .expect(400);

      testHelpers.expectAPIError(response.body, 'VALIDATION_ERROR');
    });
  });

  describe('レート制限テスト', () => {
    it('レート制限に達した場合は429エラーを返す', async () => {
      // 短時間で大量のリクエストを送信
      const promises = Array.from({ length: 20 }, () =>
        request(app)
          .post('/api/chat/message')
          .send({
            sessionToken: testSession.sessionToken,
            message: 'レート制限テスト',
          })
      );

      const responses = await Promise.allSettled(promises);

      // 一部のリクエストが429エラーになることを確認
      const rateLimitedResponses = responses.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('セキュリティテスト', () => {
    it('SQLインジェクション攻撃を防ぐ', async () => {
      const maliciousInput = "'; DROP TABLE users; --";

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: testSession.sessionToken,
          message: maliciousInput,
        })
        .expect(200);

      // 正常にレスポンスが返されることを確認（SQLインジェクションが防がれている）
      testHelpers.expectAPISuccess(response.body);
    });

    it('XSS攻撃を防ぐ', async () => {
      const maliciousInput = "<script>alert('XSS')</script>";

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: testSession.sessionToken,
          message: maliciousInput,
        })
        .expect(200);

      // レスポンスにスクリプトタグがエスケープされていることを確認
      expect(response.body.data.message).not.toContain('<script>');
    });

    it('大量データ攻撃を防ぐ', async () => {
      const largePayload = {
        sessionToken: testSession.sessionToken,
        message: 'a'.repeat(10000), // 10KB
        contextData: {
          largeField: 'x'.repeat(50000), // 50KB
        },
      };

      const response = await request(app)
        .post('/api/chat/message')
        .send(largePayload)
        .expect(400);

      testHelpers.expectAPIError(response.body, 'PAYLOAD_TOO_LARGE');
    });
  });

  describe('パフォーマンステスト', () => {
    it('応答時間が許容範囲内である', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          sessionToken: testSession.sessionToken,
          message: 'パフォーマンステスト',
        })
        .expect(200);

      const responseTime = Date.now() - startTime;

      // 応答時間が3秒以内であることを確認
      expect(responseTime).toBeLessThan(3000);
      expect(response.body.data.metadata.responseTime).toBeLessThan(2000);
    });

    it('同時リクエストを正常に処理できる', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/chat/message')
          .send({
            sessionToken: testSession.sessionToken,
            message: `同時リクエスト ${i + 1}`,
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // 全てのリクエストが成功することを確認
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        testHelpers.expectAPISuccess(response.body);
      });
    });
  });
});