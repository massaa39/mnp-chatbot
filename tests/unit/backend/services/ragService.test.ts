/**
 * RAGサービス単体テスト
 * Purpose: ragService の各メソッドの動作確認
 */

import { jest } from '@jest/globals';
import { ragService } from '../../../../backend/src/services/ragService';
import {
  testDataFactory,
  testHelpers,
  mockDatabase,
} from '../../../helpers/testSetup';

// 依存関係のモック
jest.mock('../../../../backend/src/repositories/faqRepository');
jest.mock('../../../../backend/src/services/aiService');
jest.mock('../../../../backend/src/utils/logger');

describe('RAGService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchRelevantFAQs', () => {
    it('関連性の高いFAQを正常に検索できる', async () => {
      // Arrange
      const query = 'MNPの手続きについて教えてください';
      const sessionData = {
        mode: 'step_by_step',
        currentStep: 'initial',
        currentCarrier: 'docomo',
        targetCarrier: 'au'
      };

      const mockFAQs = [
        testDataFactory.createFAQ({
          id: 'faq-1',
          question: 'MNPとは何ですか？',
          answer: 'MNPはモバイルナンバーポータビリティの略です...',
          category: 'mnp_basic',
          subcategory: 'overview',
          keywords: ['MNP', 'ポータビリティ', '番号'],
          carrierSpecific: null,
          priority: 1
        }),
        testDataFactory.createFAQ({
          id: 'faq-2',
          question: 'ドコモからMNP転出する方法',
          answer: 'ドコモからのMNP転出方法は...',
          category: 'carrier_process',
          subcategory: 'docomo',
          keywords: ['ドコモ', 'MNP転出', '手続き'],
          carrierSpecific: 'docomo',
          priority: 1
        })
      ];

      // FAQ検索のモック
      const mockFaqRepository = require('../../../../backend/src/repositories/faqRepository');
      mockFaqRepository.faqRepository.searchByEmbedding.mockResolvedValue(mockFAQs);
      mockFaqRepository.faqRepository.searchByKeywords.mockResolvedValue(mockFAQs);

      // 埋め込みベクトル生成のモック
      const mockAiService = require('../../../../backend/src/services/aiService');
      mockAiService.aiService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1)
      );

      // Act
      const result = await ragService.searchRelevantFAQs(query, sessionData);

      // Assert
      expect(result.faqs).toHaveLength(2);
      expect(result.faqs[0]).toMatchObject({
        question: expect.stringContaining('MNP'),
        answer: expect.any(String),
        category: expect.any(String)
      });
      expect(result.contextRelevance).toBeGreaterThan(0);
      expect(result.totalResults).toBe(2);

      // 埋め込み検索が呼ばれることを確認
      expect(mockAiService.aiService.generateEmbedding).toHaveBeenCalledWith(query);
      expect(mockFaqRepository.faqRepository.searchByEmbedding).toHaveBeenCalledWith(
        Array(1536).fill(0.1),
        expect.any(Object)
      );
    });

    it('キャリア固有のFAQを優先的に返す', async () => {
      // Arrange
      const query = 'MNP転出の方法';
      const sessionData = {
        currentCarrier: 'softbank',
        targetCarrier: 'rakuten'
      };

      const generalFAQ = testDataFactory.createFAQ({
        id: 'general-faq',
        question: '一般的なMNP手続き',
        carrierSpecific: null,
        priority: 2
      });

      const softbankFAQ = testDataFactory.createFAQ({
        id: 'softbank-faq',
        question: 'ソフトバンクからのMNP転出',
        carrierSpecific: 'softbank',
        priority: 1
      });

      const mockFaqRepository = require('../../../../backend/src/repositories/faqRepository');
      mockFaqRepository.faqRepository.searchByEmbedding.mockResolvedValue([
        generalFAQ,
        softbankFAQ
      ]);

      const mockAiService = require('../../../../backend/src/services/aiService');
      mockAiService.aiService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1)
      );

      // Act
      const result = await ragService.searchRelevantFAQs(query, sessionData);

      // Assert
      // ソフトバンク固有のFAQが最初に来ることを確認
      expect(result.faqs[0].carrierSpecific).toBe('softbank');
      expect(result.faqs[0].priority).toBe(1);

      // 検索条件にキャリア情報が含まれることを確認
      expect(mockFaqRepository.faqRepository.searchByEmbedding).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          carrierPreference: 'softbank'
        })
      );
    });

    it('検索結果が空の場合に適切に処理する', async () => {
      // Arrange
      const query = '存在しない質問';
      const sessionData = { mode: 'step_by_step' };

      const mockFaqRepository = require('../../../../backend/src/repositories/faqRepository');
      mockFaqRepository.faqRepository.searchByEmbedding.mockResolvedValue([]);
      mockFaqRepository.faqRepository.searchByKeywords.mockResolvedValue([]);

      const mockAiService = require('../../../../backend/src/services/aiService');
      mockAiService.aiService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1)
      );

      // Act
      const result = await ragService.searchRelevantFAQs(query, sessionData);

      // Assert
      expect(result.faqs).toHaveLength(0);
      expect(result.contextRelevance).toBe(0);
      expect(result.totalResults).toBe(0);
    });

    it('埋め込み生成エラー時にキーワード検索にフォールバックする', async () => {
      // Arrange
      const query = 'MNP手続きについて';
      const sessionData = { mode: 'step_by_step' };

      const mockFAQs = [
        testDataFactory.createFAQ({
          question: 'MNP手続きの流れ',
          keywords: ['MNP', '手続き']
        })
      ];

      const mockFaqRepository = require('../../../../backend/src/repositories/faqRepository');
      mockFaqRepository.faqRepository.searchByKeywords.mockResolvedValue(mockFAQs);

      // 埋め込み生成でエラー
      const mockAiService = require('../../../../backend/src/services/aiService');
      mockAiService.aiService.generateEmbedding.mockRejectedValue(
        new Error('Embedding API Error')
      );

      // Act
      const result = await ragService.searchRelevantFAQs(query, sessionData);

      // Assert
      expect(result.faqs).toHaveLength(1);
      expect(mockFaqRepository.faqRepository.searchByKeywords).toHaveBeenCalledWith(
        query,
        expect.any(Object)
      );
      // 埋め込み検索は呼ばれないことを確認
      expect(mockFaqRepository.faqRepository.searchByEmbedding).not.toHaveBeenCalled();
    });

    it('関連度スコアを正しく計算する', async () => {
      // Arrange
      const query = 'ドコモからauへのMNP手続き';
      const sessionData = {
        currentCarrier: 'docomo',
        targetCarrier: 'au',
        mode: 'step_by_step'
      };

      // 高関連度のFAQ
      const highRelevanceFAQ = testDataFactory.createFAQ({
        question: 'ドコモからauへのMNP手続きの流れ',
        answer: 'ドコモからauへのMNP手続きは以下の通りです...',
        keywords: ['ドコモ', 'au', 'MNP', '手続き'],
        carrierSpecific: 'docomo',
        priority: 1
      });

      // 低関連度のFAQ
      const lowRelevanceFAQ = testDataFactory.createFAQ({
        question: '料金プランについて',
        answer: '料金プランの詳細は...',
        keywords: ['料金', 'プラン'],
        carrierSpecific: null,
        priority: 3
      });

      const mockFaqRepository = require('../../../../backend/src/repositories/faqRepository');
      mockFaqRepository.faqRepository.searchByEmbedding.mockResolvedValue([
        highRelevanceFAQ,
        lowRelevanceFAQ
      ]);

      const mockAiService = require('../../../../backend/src/services/aiService');
      mockAiService.aiService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1)
      );

      // Act
      const result = await ragService.searchRelevantFAQs(query, sessionData);

      // Assert
      // 関連度が計算されていることを確認
      expect(result.contextRelevance).toBeGreaterThan(0.5);
      // 高関連度のFAQが最初に来ることを確認
      expect(result.faqs[0].question).toContain('ドコモからauへのMNP');
    });

    it('モード別のFAQ検索を正しく実行する', async () => {
      // Arrange
      const query = 'MNPの全体的な流れ';
      const sessionData = {
        mode: 'roadmap',
        currentStep: 'overview'
      };

      const mockFAQs = [
        testDataFactory.createFAQ({
          category: 'mnp_basic',
          subcategory: 'procedure',
          question: 'MNP手続きの全体的な流れ'
        })
      ];

      const mockFaqRepository = require('../../../../backend/src/repositories/faqRepository');
      mockFaqRepository.faqRepository.searchByEmbedding.mockResolvedValue(mockFAQs);

      const mockAiService = require('../../../../backend/src/services/aiService');
      mockAiService.aiService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1)
      );

      // Act
      const result = await ragService.searchRelevantFAQs(query, sessionData);

      // Assert
      // ロードマップモード向けの検索条件が適用されることを確認
      expect(mockFaqRepository.faqRepository.searchByEmbedding).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          mode: 'roadmap',
          preferredCategories: expect.arrayContaining(['mnp_basic'])
        })
      );
    });

    it('検索結果の重複を除去する', async () => {
      // Arrange
      const query = 'MNP手続き';
      const sessionData = { mode: 'step_by_step' };

      const duplicateFAQ = testDataFactory.createFAQ({
        id: 'duplicate-faq',
        question: 'MNP手続きについて'
      });

      const mockFaqRepository = require('../../../../backend/src/repositories/faqRepository');
      // 埋め込み検索とキーワード検索で同じFAQが返される場合
      mockFaqRepository.faqRepository.searchByEmbedding.mockResolvedValue([duplicateFAQ]);
      mockFaqRepository.faqRepository.searchByKeywords.mockResolvedValue([duplicateFAQ]);

      const mockAiService = require('../../../../backend/src/services/aiService');
      mockAiService.aiService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1)
      );

      // Act
      const result = await ragService.searchRelevantFAQs(query, sessionData);

      // Assert
      // 重複が除去されて1件だけ返されることを確認
      expect(result.faqs).toHaveLength(1);
      expect(result.faqs[0].id).toBe('duplicate-faq');
    });
  });

  describe('updateFAQEmbeddings', () => {
    it('FAQ埋め込みベクトルを正常に更新できる', async () => {
      // Arrange
      const mockFAQs = [
        testDataFactory.createFAQ({
          id: 'faq-1',
          question: 'MNPとは？',
          answer: 'MNPは...',
          embeddingVector: null // 未設定
        }),
        testDataFactory.createFAQ({
          id: 'faq-2',
          question: 'ドコモからのMNP',
          answer: 'ドコモから...',
          embeddingVector: null
        })
      ];

      const mockFaqRepository = require('../../../../backend/src/repositories/faqRepository');
      mockFaqRepository.faqRepository.findMissingEmbeddings.mockResolvedValue(mockFAQs);
      mockFaqRepository.faqRepository.updateEmbedding.mockResolvedValue(true);

      const mockAiService = require('../../../../backend/src/services/aiService');
      mockAiService.aiService.generateEmbedding.mockResolvedValue(
        Array(1536).fill(0.1)
      );

      // Act
      const result = await ragService.updateFAQEmbeddings();

      // Assert
      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockAiService.aiService.generateEmbedding).toHaveBeenCalledTimes(2);
      expect(mockFaqRepository.faqRepository.updateEmbedding).toHaveBeenCalledTimes(2);
    });

    it('埋め込み生成エラーを適切に処理する', async () => {
      // Arrange
      const mockFAQs = [
        testDataFactory.createFAQ({
          id: 'faq-1',
          question: 'テスト質問',
          embeddingVector: null
        })
      ];

      const mockFaqRepository = require('../../../../backend/src/repositories/faqRepository');
      mockFaqRepository.faqRepository.findMissingEmbeddings.mockResolvedValue(mockFAQs);

      const mockAiService = require('../../../../backend/src/services/aiService');
      mockAiService.aiService.generateEmbedding.mockRejectedValue(
        new Error('Embedding generation failed')
      );

      // Act
      const result = await ragService.updateFAQEmbeddings();

      // Assert
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('faq-1');
    });
  });

  describe('calculateRelevanceScore', () => {
    it('キーワードマッチングに基づいて関連度を計算する', async () => {
      // Arrange
      const query = 'ドコモ MNP 手続き';
      const faq = testDataFactory.createFAQ({
        question: 'ドコモからのMNP手続きについて',
        answer: 'ドコモからMNP手続きを行う場合は...',
        keywords: ['ドコモ', 'MNP', '手続き', '転出']
      });

      // Act
      const score = ragService.calculateRelevanceScore(query, faq);

      // Assert
      expect(score).toBeGreaterThan(0.5); // 高い関連度
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('関連性の低いFAQに対して低スコアを返す', async () => {
      // Arrange
      const query = 'MNP 手続き';
      const unrelatedFAQ = testDataFactory.createFAQ({
        question: '機種変更の方法',
        answer: '機種変更をする場合は...',
        keywords: ['機種変更', '端末', '購入']
      });

      // Act
      const score = ragService.calculateRelevanceScore(query, unrelatedFAQ);

      // Assert
      expect(score).toBeLessThan(0.3); // 低い関連度
    });

    it('完全一致の場合に最高スコアを返す', async () => {
      // Arrange
      const query = 'MNP予約番号の取得方法';
      const exactMatchFAQ = testDataFactory.createFAQ({
        question: 'MNP予約番号の取得方法について',
        keywords: ['MNP予約番号', '取得方法', 'MNP']
      });

      // Act
      const score = ragService.calculateRelevanceScore(query, exactMatchFAQ);

      // Assert
      expect(score).toBeGreaterThan(0.8); // 非常に高い関連度
    });
  });
});