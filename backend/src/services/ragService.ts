/**
 * RAG（Retrieval-Augmented Generation）サービス
 * Purpose: FAQ検索とコンテキスト拡張
 */
import { FAQ, RAGSearchResult } from '../types';
import { database } from '../config/database';
import { aiService } from './aiService';
import { logger } from '../utils/logger';

class RAGService {
  private readonly maxResults: number = 5;
  private readonly relevanceThreshold: number = 0.7;

  /**
   * 関連FAQの検索
   * @param query ユーザークエリ
   * @param sessionData セッションデータ
   * @returns 検索結果
   */
  public async searchRelevantFAQs(query: string, sessionData: any): Promise<RAGSearchResult> {
    try {
      const startTime = Date.now();

      // 1. クエリの埋め込みベクトル生成
      const queryEmbedding = await aiService.generateEmbedding(query);

      // 2. ベクトル類似度検索
      const vectorResults = await this.vectorSimilaritySearch(queryEmbedding, sessionData);

      // 3. キーワード検索（フォールバック）
      const keywordResults = await this.keywordSearch(query, sessionData);

      // 4. 結果統合とスコアリング
      const combinedResults = this.combineAndScoreResults(
        vectorResults,
        keywordResults,
        sessionData
      );

      // 5. コンテキスト関連性評価
      const contextRelevance = this.evaluateContextRelevance(combinedResults, sessionData);

      const searchTime = Date.now() - startTime;

      logger.info('RAG search completed', {
        query: query.substring(0, 50),
        resultsCount: combinedResults.length,
        contextRelevance,
        searchTime: `${searchTime}ms`,
        sessionStep: sessionData.currentStep
      });

      return {
        faqs: combinedResults,
        similarityScores: combinedResults.map(faq => faq.relevanceScore || 0),
        contextRelevance
      };

    } catch (error: any) {
      logger.error('RAG search failed:', {
        error: error.message,
        query: query.substring(0, 50),
        sessionData
      });

      // エラー時は空の結果を返す
      return {
        faqs: [],
        similarityScores: [],
        contextRelevance: 0
      };
    }
  }

  /**
   * ベクトル類似度検索
   * @param queryEmbedding クエリのベクトル
   * @param sessionData セッションデータ
   * @returns 検索結果
   */
  private async vectorSimilaritySearch(
    queryEmbedding: number[],
    sessionData: any
  ): Promise<FAQ[]> {
    try {
      // PostgreSQLのベクトル類似度検索
      // NOTE: 実際の実装では専用のベクトルDBやpgvectorを使用
      const query = `
        SELECT 
          id, category, subcategory, question, answer, keywords,
          priority, carrier_specific, is_active, version,
          created_at, updated_at,
          -- コサイン類似度（簡易実装）
          CASE 
            WHEN embedding_vector IS NOT NULL 
            THEN 1.0 - (embedding_vector <-> $1::float8[])
            ELSE 0.0
          END as similarity_score
        FROM faqs
        WHERE is_active = true
          AND (carrier_specific IS NULL OR carrier_specific = $2)
        ORDER BY similarity_score DESC, priority DESC
        LIMIT $3
      `;

      const result = await database.query(query, [
        queryEmbedding,
        sessionData.currentCarrier || null,
        this.maxResults
      ]);

      return result.rows.map((row: any) => ({
        ...row,
        relevanceScore: row.similarity_score,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));

    } catch (error: any) {
      logger.error('Vector similarity search failed:', error);
      return [];
    }
  }

  /**
   * キーワード検索
   * @param query 検索クエリ
   * @param sessionData セッションデータ
   * @returns 検索結果
   */
  private async keywordSearch(query: string, sessionData: any): Promise<FAQ[]> {
    try {
      // 全文検索とキーワードマッチング
      const searchQuery = `
        SELECT 
          id, category, subcategory, question, answer, keywords,
          priority, carrier_specific, is_active, version,
          created_at, updated_at,
          -- 全文検索スコア
          ts_rank(
            to_tsvector('japanese', question || ' ' || answer),
            plainto_tsquery('japanese', $1)
          ) as fulltext_score,
          -- キーワードマッチスコア
          CASE 
            WHEN keywords && string_to_array($1, ' ') THEN 0.8
            ELSE 0.0
          END as keyword_score
        FROM faqs
        WHERE is_active = true
          AND (carrier_specific IS NULL OR carrier_specific = $2)
          AND (
            to_tsvector('japanese', question || ' ' || answer) @@ plainto_tsquery('japanese', $1)
            OR keywords && string_to_array($1, ' ')
          )
        ORDER BY (fulltext_score + keyword_score) DESC, priority DESC
        LIMIT $3
      `;

      const result = await database.query(searchQuery, [
        query,
        sessionData.currentCarrier || null,
        this.maxResults
      ]);

      return result.rows.map((row: any) => ({
        ...row,
        relevanceScore: (row.fulltext_score || 0) + (row.keyword_score || 0),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));

    } catch (error: any) {
      logger.error('Keyword search failed:', error);
      return [];
    }
  }

  /**
   * 検索結果統合とスコアリング
   * @param vectorResults ベクトル検索結果
   * @param keywordResults キーワード検索結果
   * @param sessionData セッションデータ
   * @returns 統合結果
   */
  private combineAndScoreResults(
    vectorResults: FAQ[],
    keywordResults: FAQ[],
    sessionData: any
  ): FAQ[] {
    // 結果をIDで統合
    const resultsMap = new Map<string, FAQ>();

    // ベクトル検索結果を追加（重み: 0.7）
    vectorResults.forEach(faq => {
      if (faq.relevanceScore && faq.relevanceScore >= this.relevanceThreshold) {
        resultsMap.set(faq.id, {
          ...faq,
          relevanceScore: (faq.relevanceScore || 0) * 0.7
        });
      }
    });

    // キーワード検索結果を追加/統合（重み: 0.3）
    keywordResults.forEach(faq => {
      const existing = resultsMap.get(faq.id);
      if (existing) {
        // 既存の結果とスコアを統合
        existing.relevanceScore = (existing.relevanceScore || 0) + 
                                  ((faq.relevanceScore || 0) * 0.3);
      } else if (faq.relevanceScore && faq.relevanceScore >= this.relevanceThreshold) {
        resultsMap.set(faq.id, {
          ...faq,
          relevanceScore: (faq.relevanceScore || 0) * 0.3
        });
      }
    });

    // セッションコンテキストによるブースト
    const boostedResults = Array.from(resultsMap.values()).map(faq => {
      let boost = 1.0;

      // キャリア特化情報のブースト
      if (faq.carrierSpecific === sessionData.currentCarrier) {
        boost += 0.2;
      }

      // 現在のステップに関連するカテゴリのブースト
      if (this.isRelevantToCurrentStep(faq.category, sessionData.currentStep)) {
        boost += 0.15;
      }

      // 優先度によるブースト
      boost += (faq.priority || 1) * 0.05;

      return {
        ...faq,
        relevanceScore: (faq.relevanceScore || 0) * boost
      };
    });

    // スコア順でソート
    return boostedResults
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, this.maxResults);
  }

  /**
   * 現在のステップとの関連性判定
   * @param category FAQカテゴリ
   * @param currentStep 現在のステップ
   * @returns 関連性
   */
  private isRelevantToCurrentStep(category: string, currentStep: string): boolean {
    const stepCategoryMapping: Record<string, string[]> = {
      'initial': ['mnp_basic'],
      'carrier_identification': ['carrier_process', 'mnp_basic'],
      'reservation_number': ['carrier_process', 'troubleshooting'],
      'application': ['carrier_process', 'troubleshooting'],
      'line_switching': ['troubleshooting'],
      'completion': ['mnp_basic', 'troubleshooting']
    };

    const relevantCategories = stepCategoryMapping[currentStep] || [];
    return relevantCategories.includes(category);
  }

  /**
   * コンテキスト関連性評価
   * @param results 検索結果
   * @param sessionData セッションデータ
   * @returns 関連性スコア
   */
  private evaluateContextRelevance(results: FAQ[], sessionData: any): number {
    if (results.length === 0) {
      return 0;
    }

    // 平均スコアを計算
    const averageScore = results.reduce((sum, faq) => 
      sum + (faq.relevanceScore || 0), 0) / results.length;

    // セッションコンテキストとの適合度
    let contextScore = averageScore;

    // キャリア情報の適合度
    if (sessionData.currentCarrier) {
      const carrierSpecificCount = results.filter(faq => 
        faq.carrierSpecific === sessionData.currentCarrier).length;
      contextScore += (carrierSpecificCount / results.length) * 0.2;
    }

    // ステップ適合度
    if (sessionData.currentStep) {
      const stepRelevantCount = results.filter(faq => 
        this.isRelevantToCurrentStep(faq.category, sessionData.currentStep)).length;
      contextScore += (stepRelevantCount / results.length) * 0.15;
    }

    return Math.min(contextScore, 1.0);
  }

  /**
   * FAQ埋め込みベクトル更新
   * @param faqId FAQ ID
   * @returns 更新結果
   */
  public async updateFAQEmbedding(faqId: string): Promise<boolean> {
    try {
      // FAQデータ取得
      const result = await database.query(
        'SELECT question, answer FROM faqs WHERE id = $1',
        [faqId]
      );

      if (result.rows.length === 0) {
        throw new Error('FAQ not found');
      }

      const faq = result.rows[0];
      const text = `${faq.question} ${faq.answer}`;

      // 埋め込みベクトル生成
      const embedding = await aiService.generateEmbedding(text);

      // データベース更新
      await database.query(
        'UPDATE faqs SET embedding_vector = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [embedding, faqId]
      );

      logger.info('FAQ embedding updated', { faqId });
      return true;

    } catch (error: any) {
      logger.error('Failed to update FAQ embedding:', {
        error: error.message,
        faqId
      });
      return false;
    }
  }
}

export const ragService = new RAGService();