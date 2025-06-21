/**
 * チャットコントローラー単体テスト
 * Purpose: chatController の各メソッドの動作確認
 */

import { jest } from '@jest/globals';
import { chatController } from '../../../../backend/src/controllers/chatController';
import {
  mockRequest,
  mockResponse,
  mockNext,
  testDataFactory,
  testHelpers,
  mockDatabase,
  mockRedis,
  mockOpenAI,
} from '../../../helpers/testSetup';

// 依存関係のモック
jest.mock('../../../../backend/src/services/chatService');
jest.mock('../../../../backend/src/repositories/chatRepository');
jest.mock('../../../../backend/src/repositories/userRepository');
jest.mock('../../../../backend/src/utils/logger');

describe('ChatController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('新しいセッションを正常に作成できる', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          mode: 'step_by_step',
          phoneNumber: '09012345678',
          currentCarrier: 'docomo',
          targetCarrier: 'au',
          preferences: { language: 'ja' }
        }
      });
      const res = mockResponse();
      
      const mockUser = testDataFactory.createUser();
      const mockSession = testDataFactory.createChatSession();
      
      // セッション作成のモック
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockSession] });

      // Act
      await chatController.createSession(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        testHelpers.expectAPISuccess({
          sessionToken: mockSession.sessionToken,
          user: expect.objectContaining({
            sessionId: mockUser.sessionId,
            phoneNumber: mockUser.phoneNumber,
            currentCarrier: mockUser.currentCarrier,
            targetCarrier: mockUser.targetCarrier,
            status: mockUser.status
          }),
          session: expect.objectContaining({
            sessionToken: mockSession.sessionToken,
            mode: mockSession.mode,
            currentStep: mockSession.currentStep
          })
        })
      );
    });

    it('必須パラメータが不足している場合は400エラーを返す', async () => {
      // Arrange
      const req = mockRequest({
        body: {} // modeが未指定
      });
      const res = mockResponse();

      // Act
      await chatController.createSession(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('mode')
          })
        })
      );
    });

    it('データベースエラーが発生した場合は500エラーを返す', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          mode: 'step_by_step'
        }
      });
      const res = mockResponse();
      
      mockDatabase.query.mockRejectedValueOnce(new Error('Database connection failed'));

      // Act
      await chatController.createSession(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR'
          })
        })
      );
    });
  });

  describe('sendMessage', () => {
    it('メッセージを正常に送信しAI応答を返す', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          message: 'MNPの手続きについて教えてください',
          sessionToken: 'test-session-token',
          mode: 'step_by_step',
          contextData: {}
        }
      });
      const res = mockResponse();

      const mockSession = testDataFactory.createChatSession();
      const mockUserMessage = testDataFactory.createMessage({
        messageType: 'user',
        content: req.body.message
      });
      const mockAiMessage = testDataFactory.createMessage({
        messageType: 'assistant',
        content: 'MNPの手続きについてご説明します...'
      });

      // セッション検証のモック
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockSession] });
      // メッセージ保存のモック
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockUserMessage] });
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockAiMessage] });
      
      // OpenAI APIのモック
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: mockAiMessage.content
          }
        }],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 80,
          total_tokens: 200
        }
      });

      // Act
      await chatController.sendMessage(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: mockAiMessage.content,
            sessionToken: mockSession.sessionToken,
            suggestions: expect.any(Array),
            actions: expect.any(Array),
            metadata: expect.objectContaining({
              responseTime: expect.any(Number),
              confidenceScore: expect.any(Number)
            })
          })
        })
      );
    });

    it('無効なセッショントークンの場合は401エラーを返す', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          message: 'テストメッセージ',
          sessionToken: 'invalid-token'
        }
      });
      const res = mockResponse();

      // セッション検証でエラー
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      // Act
      await chatController.sendMessage(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_SESSION_TOKEN'
          })
        })
      );
    });

    it('メッセージが空の場合は400エラーを返す', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          message: '',
          sessionToken: 'test-session-token'
        }
      });
      const res = mockResponse();

      // Act
      await chatController.sendMessage(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('message')
          })
        })
      );
    });

    it('AIサービスエラーの場合でもフォールバック応答を返す', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          message: 'テストメッセージ',
          sessionToken: 'test-session-token'
        }
      });
      const res = mockResponse();

      const mockSession = testDataFactory.createChatSession();
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockSession] });
      
      // OpenAI APIエラー
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error('OpenAI API Error')
      );

      // Act
      await chatController.sendMessage(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: expect.stringContaining('申し訳ございません'), // フォールバックメッセージ
            needsEscalation: true
          })
        })
      );
    });
  });

  describe('verifySession', () => {
    it('有効なセッショントークンの場合はセッション情報を返す', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          sessionToken: 'test-session-token'
        }
      });
      const res = mockResponse();

      const mockSession = testDataFactory.createChatSession();
      const mockUser = testDataFactory.createUser();
      
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockSession] });
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockUser] });

      // Act
      await chatController.verifySession(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            valid: true,
            user: expect.objectContaining({
              sessionId: mockUser.sessionId
            }),
            session: expect.objectContaining({
              sessionToken: mockSession.sessionToken
            }),
            expiresAt: expect.any(String)
          })
        })
      );
    });

    it('期限切れセッションの場合はvalidがfalseを返す', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          sessionToken: 'expired-session-token'
        }
      });
      const res = mockResponse();

      const expiredSession = testDataFactory.createChatSession({
        expiresAt: new Date(Date.now() - 1000) // 1秒前に期限切れ
      });
      
      mockDatabase.query.mockResolvedValueOnce({ rows: [expiredSession] });

      // Act
      await chatController.verifySession(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            valid: false
          })
        })
      );
    });
  });

  describe('getHistory', () => {
    it('チャット履歴を正常に取得できる', async () => {
      // Arrange
      const req = mockRequest({
        params: { sessionToken: 'test-session-token' },
        query: { page: '1', limit: '10' }
      });
      const res = mockResponse();

      const mockSession = testDataFactory.createChatSession();
      const mockUser = testDataFactory.createUser();
      const mockMessages = [
        testDataFactory.createMessage({ messageType: 'user' }),
        testDataFactory.createMessage({ messageType: 'assistant' })
      ];

      mockDatabase.query.mockResolvedValueOnce({ rows: [mockSession] });
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockDatabase.query.mockResolvedValueOnce({ rows: mockMessages });
      mockDatabase.query.mockResolvedValueOnce({ rows: [{ count: '2' }] }); // 総件数

      // Act
      await chatController.getHistory(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                messageType: 'user'
              }),
              expect.objectContaining({
                messageType: 'assistant'
              })
            ]),
            session: expect.objectContaining({
              sessionToken: mockSession.sessionToken
            }),
            user: expect.objectContaining({
              sessionId: mockUser.sessionId
            }),
            pagination: expect.objectContaining({
              total: 2,
              page: 1,
              limit: 10,
              totalPages: 1,
              hasNext: false,
              hasPrev: false
            })
          })
        })
      );
    });

    it('存在しないセッションの場合は404エラーを返す', async () => {
      // Arrange
      const req = mockRequest({
        params: { sessionToken: 'non-existent-token' }
      });
      const res = mockResponse();

      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      // Act
      await chatController.getHistory(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'SESSION_NOT_FOUND'
          })
        })
      );
    });

    it('ページネーションパラメータを正しく処理できる', async () => {
      // Arrange
      const req = mockRequest({
        params: { sessionToken: 'test-session-token' },
        query: { page: '2', limit: '5' }
      });
      const res = mockResponse();

      const mockSession = testDataFactory.createChatSession();
      const mockUser = testDataFactory.createUser();
      const mockMessages = Array(5).fill(null).map((_, i) => 
        testDataFactory.createMessage({ id: `message-${i}` })
      );

      mockDatabase.query.mockResolvedValueOnce({ rows: [mockSession] });
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockDatabase.query.mockResolvedValueOnce({ rows: mockMessages });
      mockDatabase.query.mockResolvedValueOnce({ rows: [{ count: '15' }] }); // 総件数

      // Act
      await chatController.getHistory(req, res, mockNext);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            pagination: expect.objectContaining({
              total: 15,
              page: 2,
              limit: 5,
              totalPages: 3,
              hasNext: true,
              hasPrev: true
            })
          })
        })
      );
    });
  });
});