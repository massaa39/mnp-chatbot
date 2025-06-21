/**
 * AIサービス単体テスト
 * Purpose: aiService の各メソッドの動作確認
 */

import { jest } from '@jest/globals';
import { aiService } from '../../../../backend/src/services/aiService';
import {
  testDataFactory,
  testHelpers,
  mockOpenAI,
  mockDatabase,
} from '../../../helpers/testSetup';

// 依存関係のモック
jest.mock('../../../../backend/src/services/ragService');
jest.mock('../../../../backend/src/config/openai');
jest.mock('../../../../backend/src/utils/logger');

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateChatResponse', () => {
    it('RAG検索結果を含むAI応答を正常に生成できる', async () => {
      // Arrange
      const request = {
        prompt: 'MNPの手続きについて教えてください',
        sessionData: {
          mode: 'step_by_step',
          currentStep: 'initial',
          currentCarrier: 'docomo',
          targetCarrier: 'au'
        },
        maxTokens: 1000,
        temperature: 0.7
      };

      const mockRAGResults = {
        faqs: [
          testDataFactory.createFAQ({
            question: 'MNPとは何ですか？',
            answer: 'MNPはモバイルナンバーポータビリティの略です...'
          })
        ],
        contextRelevance: 0.85,
        totalResults: 1
      };

      const expectedAIResponse = {
        message: 'MNPの手続きについてご説明します。まず、MNP予約番号を取得する必要があります。',
        suggestions: ['詳細な手順を確認', 'MNP予約番号の取得方法', 'オペレーターに相談'],
        actions: [
          {
            type: 'button',
            label: '次のステップ',
            value: 'next_step'
          }
        ],
        needsEscalation: false
      };

      // RAGサービスのモック
      const mockRagService = require('../../../../backend/src/services/ragService');
      mockRagService.ragService.searchRelevantFAQs.mockResolvedValue(mockRAGResults);

      // OpenAI APIのモック
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(expectedAIResponse)
          }
        }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 80,
          total_tokens: 230
        }
      });

      // Act
      const result = await aiService.generateChatResponse(request);

      // Assert
      expect(result).toEqual(expectedAIResponse);
      expect(mockRagService.ragService.searchRelevantFAQs).toHaveBeenCalledWith(
        request.prompt,
        request.sessionData
      );
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: request.prompt })
          ]),
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          response_format: { type: 'json_object' }
        })
      );
    });

    it('OpenAI API エラー時にフォールバック応答を返す', async () => {
      // Arrange
      const request = {
        prompt: 'テストメッセージ',
        sessionData: { mode: 'step_by_step' }
      };

      const mockRAGResults = {
        faqs: [],
        contextRelevance: 0.3,
        totalResults: 0
      };

      const mockRagService = require('../../../../backend/src/services/ragService');
      mockRagService.ragService.searchRelevantFAQs.mockResolvedValue(mockRAGResults);

      // OpenAI APIエラー
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API rate limit exceeded')
      );

      // Act
      const result = await aiService.generateChatResponse(request);

      // Assert
      expect(result.message).toContain('申し訳ございません');
      expect(result.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'escalation',
            label: 'オペレーターに相談'
          })
        ])
      );
    });

    it('RAGの関連度が低い場合にエスカレーションを提案する', async () => {
      // Arrange
      const request = {
        prompt: '複雑な法的質問',
        sessionData: { mode: 'step_by_step' }
      };

      const mockRAGResults = {
        faqs: [],
        contextRelevance: 0.2, // 低い関連度
        totalResults: 0
      };

      const mockRagService = require('../../../../backend/src/services/ragService');
      mockRagService.ragService.searchRelevantFAQs.mockResolvedValue(mockRAGResults);

      const aiResponse = {
        message: 'この内容について詳しくご案内するため、専門スタッフにおつなぎします。',
        needsEscalation: true
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(aiResponse)
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      });

      // Act
      const result = await aiService.generateChatResponse(request);

      // Assert
      expect(result.escalation).toBeDefined();
      expect(result.escalation.reason).toBe('complex_inquiry');
      expect(result.escalation.lineUrl).toContain('/escalation');
    });

    it('システムプロンプトを正しく構築する', async () => {
      // Arrange
      const request = {
        prompt: 'テスト質問',
        sessionData: {
          mode: 'roadmap',
          currentStep: 'application',
          currentCarrier: 'softbank',
          targetCarrier: 'rakuten'
        }
      };

      const mockRAGResults = {
        faqs: [
          testDataFactory.createFAQ({
            question: 'ソフトバンクからのMNP手順',
            answer: 'ソフトバンクからのMNP手順は...'
          })
        ],
        contextRelevance: 0.9,
        totalResults: 1
      };

      const mockRagService = require('../../../../backend/src/services/ragService');
      mockRagService.ragService.searchRelevantFAQs.mockResolvedValue(mockRAGResults);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({ message: 'テスト応答' })
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      });

      // Act
      await aiService.generateChatResponse(request);

      // Assert
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('roadmap') // モードが含まれている
            }),
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('softbank') // キャリア情報が含まれている
            }),
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('ソフトバンクからのMNP手順') // FAQ内容が含まれている
            }),
            expect.objectContaining({
              role: 'user',
              content: request.prompt
            })
          ]
        })
      );
    });

    it('レート制限チェックを正しく実行する', async () => {
      // Arrange
      const request = {
        prompt: 'テストメッセージ',
        sessionData: { mode: 'step_by_step' }
      };

      const mockOpenAIConfig = require('../../../../backend/src/config/openai');
      mockOpenAIConfig.checkRateLimit = jest.fn().mockResolvedValue({
        allowed: false,
        waitTime: 5000
      });

      const mockRagService = require('../../../../backend/src/services/ragService');
      mockRagService.ragService.searchRelevantFAQs.mockResolvedValue({
        faqs: [],
        contextRelevance: 0.5,
        totalResults: 0
      });

      // レート制限後の成功レスポンス
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({ message: 'テスト応答' })
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      });

      // Act
      const result = await aiService.generateChatResponse(request);

      // Assert
      expect(mockOpenAIConfig.checkRateLimit).toHaveBeenCalledWith(1000);
      expect(result.message).toBe('テスト応答');
    });
  });

  describe('generateEmbedding', () => {
    it('テキストの埋め込みベクトルを正常に生成できる', async () => {
      // Arrange
      const inputText = 'MNPの手続きについて教えてください';
      const expectedEmbedding = Array(1536).fill(0.1);

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{
          embedding: expectedEmbedding
        }],
        usage: {
          total_tokens: 10
        }
      });

      // Act
      const result = await aiService.generateEmbedding(inputText);

      // Assert
      expect(result).toEqual(expectedEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: expect.any(String),
        input: inputText
      });
    });

    it('埋め込み生成エラー時に適切にエラーを投げる', async () => {
      // Arrange
      const inputText = 'テストテキスト';
      
      mockOpenAI.embeddings.create.mockRejectedValue(
        new Error('Embedding API Error')
      );

      // Act & Assert
      await expect(aiService.generateEmbedding(inputText)).rejects.toThrow('Embedding API Error');
    });

    it('使用量を正しく記録する', async () => {
      // Arrange
      const inputText = 'テストテキスト';
      const mockUsage = { total_tokens: 15 };

      const mockOpenAIConfig = require('../../../../backend/src/config/openai');
      mockOpenAIConfig.recordUsage = jest.fn();

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{
          embedding: Array(1536).fill(0.1)
        }],
        usage: mockUsage
      });

      // Act
      await aiService.generateEmbedding(inputText);

      // Assert
      expect(mockOpenAIConfig.recordUsage).toHaveBeenCalledWith(15, 0);
    });
  });

  describe('retryLogic', () => {
    it('一時的なエラーの場合にリトライを実行する', async () => {
      // Arrange
      const request = {
        prompt: 'テストメッセージ',
        sessionData: { mode: 'step_by_step' }
      };

      const mockRagService = require('../../../../backend/src/services/ragService');
      mockRagService.ragService.searchRelevantFAQs.mockResolvedValue({
        faqs: [],
        contextRelevance: 0.5,
        totalResults: 0
      });

      // 最初の2回は失敗、3回目は成功
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({ message: '成功応答' })
            }
          }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
        });

      // Act
      const result = await aiService.generateChatResponse(request);

      // Assert
      expect(result.message).toBe('成功応答');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    it('最大リトライ回数を超えた場合にフォールバック応答を返す', async () => {
      // Arrange
      const request = {
        prompt: 'テストメッセージ',
        sessionData: { mode: 'step_by_step' }
      };

      const mockRagService = require('../../../../backend/src/services/ragService');
      mockRagService.ragService.searchRelevantFAQs.mockResolvedValue({
        faqs: [],
        contextRelevance: 0.5,
        totalResults: 0
      });

      // 全てのリトライが失敗
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Persistent API Error')
      );

      // Act
      const result = await aiService.generateChatResponse(request);

      // Assert
      expect(result.message).toContain('申し訳ございません');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3); // maxRetries = 3
    });
  });

  describe('responseValidation', () => {
    it('不正なJSON応答の場合にフォールバック応答を返す', async () => {
      // Arrange
      const request = {
        prompt: 'テストメッセージ',
        sessionData: { mode: 'step_by_step' }
      };

      const mockRagService = require('../../../../backend/src/services/ragService');
      mockRagService.ragService.searchRelevantFAQs.mockResolvedValue({
        faqs: [],
        contextRelevance: 0.5,
        totalResults: 0
      });

      // 不正なJSON応答
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: '不正なJSON応答 { invalid json'
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      });

      // Act
      const result = await aiService.generateChatResponse(request);

      // Assert
      expect(result.message).toBe('不正なJSON応答 { invalid json');
      expect(result.suggestions).toEqual(['詳細を教えてください', 'オペレーターに相談する']);
      expect(result.actions).toEqual([{
        type: 'escalation',
        label: 'オペレーターに相談',
        value: 'escalate'
      }]);
    });

    it('空の応答の場合にエラーを投げる', async () => {
      // Arrange
      const request = {
        prompt: 'テストメッセージ',
        sessionData: { mode: 'step_by_step' }
      };

      const mockRagService = require('../../../../backend/src/services/ragService');
      mockRagService.ragService.searchRelevantFAQs.mockResolvedValue({
        faqs: [],
        contextRelevance: 0.5,
        totalResults: 0
      });

      // 空の応答
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: null
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 0, total_tokens: 100 }
      });

      // Act
      const result = await aiService.generateChatResponse(request);

      // Assert
      expect(result.message).toContain('申し訳ございません'); // フォールバック応答
    });
  });
});