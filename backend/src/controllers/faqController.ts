import { Request, Response } from 'express';
import { faqRepository } from '../repositories/faqRepository';
import { ragService } from '../services/ragService';
import { aiService } from '../services/aiService';
import { logger } from '../utils/logger';
import { APIResponse } from '../types/api';
import type { FAQCategory, Carrier } from '../types/database';

/**
 * FAQ検索（複合検索）
 */
export const searchFAQs = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { 
      query, 
      category, 
      carrier, 
      limit = 10,
      useVectorSearch = true,
      useFullTextSearch = true
    } = req.body;

    if (!query) {
      logger.warn('FAQ検索: クエリが必要', { body: req.body });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: '検索クエリが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    let results: any[] = [];
    let searchMethod = '';

    // ベクトル検索を優先
    if (useVectorSearch) {
      try {
        const vectorResults = await ragService.searchSimilarFAQs(query, {
          category: category as FAQCategory,
          carrier: carrier as Carrier,
          limit: Math.ceil(limit * 0.7) // 70%をベクトル検索
        });

        if (vectorResults.length > 0) {
          results = vectorResults.map(result => ({
            ...result,
            searchMethod: 'vector',
            relevanceScore: result.similarity || 0
          }));
          searchMethod = 'vector';
        }
      } catch (vectorError) {
        logger.warn('ベクトル検索失敗、全文検索にフォールバック', { error: vectorError, query });
      }
    }

    // ベクトル検索で十分な結果が得られなかった場合、全文検索で補完
    if (results.length < limit && useFullTextSearch) {
      try {
        const fullTextResults = await faqRepository.fullTextSearchFAQs(query, {
          category: category as FAQCategory,
          carrier: carrier as Carrier
        }, {
          limit: limit - results.length
        });

        const fullTextMapped = fullTextResults.map(result => ({
          ...result,
          searchMethod: 'fulltext',
          relevanceScore: result.rank || 0
        }));

        results = [...results, ...fullTextMapped];
        searchMethod = results.length > 0 ? (searchMethod ? 'hybrid' : 'fulltext') : searchMethod;
      } catch (fullTextError) {
        logger.error('全文検索エラー', { error: fullTextError, query });
      }
    }

    // 結果がない場合、基本検索にフォールバック
    if (results.length === 0) {
      const basicResults = await faqRepository.searchFAQs({
        searchText: query,
        category: category as FAQCategory,
        carrier: carrier as Carrier
      }, { limit });

      results = basicResults.map(result => ({
        ...result,
        searchMethod: 'basic',
        relevanceScore: 0.5
      }));
      searchMethod = 'basic';
    }

    const responseTime = Date.now() - startTime;

    logger.info('FAQ検索完了', {
      query,
      category,
      carrier,
      resultCount: results.length,
      searchMethod,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: {
        results,
        metadata: {
          query,
          category,
          carrier,
          searchMethod,
          totalResults: results.length,
          responseTime
        }
      },
      timestamp: new Date().toISOString()
    } as APIResponse<{ results: typeof results; metadata: any }>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('FAQ検索エラー', { error, query: req.body.query, responseTime });

    res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: 'FAQ検索に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * FAQ詳細取得
 */
export const getFAQById = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { faqId } = req.params;

    if (!faqId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FAQ_ID',
          message: 'FAQ IDが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const faq = await faqRepository.getFAQById(faqId);

    if (!faq) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FAQ_NOT_FOUND',
          message: '指定されたFAQが見つかりません'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const responseTime = Date.now() - startTime;

    logger.info('FAQ詳細取得', {
      faqId,
      category: faq.category,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: faq,
      timestamp: new Date().toISOString()
    } as APIResponse<typeof faq>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('FAQ詳細取得エラー', { 
      error, 
      faqId: req.params.faqId,
      responseTime 
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'FAQ詳細の取得に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * FAQ一覧取得
 */
export const getFAQs = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { 
      category, 
      carrier, 
      searchText,
      priority,
      limit = 20, 
      offset = 0,
      orderBy = 'priority DESC, created_at DESC'
    } = req.query;

    const faqs = await faqRepository.searchFAQs({
      category: category as FAQCategory,
      carrier: carrier as Carrier,
      searchText: searchText as string,
      priority: priority ? parseInt(priority as string) : undefined
    }, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      orderBy: orderBy as string
    });

    const responseTime = Date.now() - startTime;

    logger.info('FAQ一覧取得', {
      category,
      carrier,
      searchText,
      resultCount: faqs.length,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: {
        faqs,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: faqs.length
        }
      },
      timestamp: new Date().toISOString()
    } as APIResponse<{ faqs: typeof faqs; pagination: any }>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('FAQ一覧取得エラー', { error, responseTime });

    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_FETCH_ERROR',
        message: 'FAQ一覧の取得に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * FAQ作成
 */
export const createFAQ = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { question, answer, category, carrier, tags, priority } = req.body;

    if (!question || !answer || !category) {
      logger.warn('FAQ作成: 必要なパラメータが不足', { 
        question: !!question, 
        answer: !!answer, 
        category: !!category 
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: '質問、回答、カテゴリは必須です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    // 埋め込みベクトル生成
    let embeddingVector: number[] | undefined;
    try {
      const embeddingText = `${question} ${answer}`;
      embeddingVector = await aiService.generateEmbedding(embeddingText);
    } catch (embeddingError) {
      logger.warn('埋め込みベクトル生成失敗、FAQは作成を続行', { 
        error: embeddingError, 
        question 
      });
    }

    const newFAQ = await faqRepository.createFAQ({
      question,
      answer,
      category: category as FAQCategory,
      carrier: carrier as Carrier,
      tags: tags || [],
      embeddingVector,
      priority: priority || 5,
      isActive: true
    });

    const responseTime = Date.now() - startTime;

    logger.info('FAQ作成完了', {
      faqId: newFAQ.id,
      category,
      carrier,
      hasEmbedding: !!embeddingVector,
      responseTime
    });

    res.status(201).json({
      success: true,
      data: newFAQ,
      timestamp: new Date().toISOString()
    } as APIResponse<typeof newFAQ>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('FAQ作成エラー', { error, responseTime });

    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_ERROR',
        message: 'FAQの作成に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * FAQ更新
 */
export const updateFAQ = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { faqId } = req.params;
    const updates = req.body;

    if (!faqId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FAQ_ID',
          message: 'FAQ IDが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    // 質問または回答が更新された場合、埋め込みベクトルを再生成
    if (updates.question || updates.answer) {
      try {
        const currentFAQ = await faqRepository.getFAQById(faqId);
        if (currentFAQ) {
          const embeddingText = `${updates.question || currentFAQ.question} ${updates.answer || currentFAQ.answer}`;
          updates.embeddingVector = await aiService.generateEmbedding(embeddingText);
        }
      } catch (embeddingError) {
        logger.warn('埋め込みベクトル再生成失敗、更新は続行', { 
          error: embeddingError, 
          faqId 
        });
      }
    }

    const updatedFAQ = await faqRepository.updateFAQ(faqId, updates);

    if (!updatedFAQ) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FAQ_NOT_FOUND',
          message: '指定されたFAQが見つかりません'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const responseTime = Date.now() - startTime;

    logger.info('FAQ更新完了', {
      faqId,
      updatedFields: Object.keys(updates),
      responseTime
    });

    res.status(200).json({
      success: true,
      data: updatedFAQ,
      timestamp: new Date().toISOString()
    } as APIResponse<typeof updatedFAQ>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('FAQ更新エラー', { 
      error, 
      faqId: req.params.faqId,
      responseTime 
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: 'FAQの更新に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * FAQ削除
 */
export const deleteFAQ = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { faqId } = req.params;

    if (!faqId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FAQ_ID',
          message: 'FAQ IDが必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const deleted = await faqRepository.deleteFAQ(faqId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FAQ_NOT_FOUND',
          message: '指定されたFAQが見つかりません'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const responseTime = Date.now() - startTime;

    logger.info('FAQ削除完了', {
      faqId,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'FAQが正常に削除されました',
        deletedId: faqId
      },
      timestamp: new Date().toISOString()
    } as APIResponse<{ message: string; deletedId: string }>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('FAQ削除エラー', { 
      error, 
      faqId: req.params.faqId,
      responseTime 
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: 'FAQの削除に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * FAQ統計取得
 */
export const getFAQStats = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const [categoryStats, carrierStats, popularFAQs] = await Promise.all([
      faqRepository.getFAQCountByCategory(),
      faqRepository.getFAQCountByCarrier(),
      faqRepository.getPopularFAQs(10)
    ]);

    const responseTime = Date.now() - startTime;

    logger.info('FAQ統計取得', {
      categoryCount: categoryStats.length,
      carrierCount: carrierStats.length,
      popularCount: popularFAQs.length,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: {
        categoryStats,
        carrierStats,
        popularFAQs,
        totalCategories: categoryStats.length,
        totalCarriers: carrierStats.length
      },
      timestamp: new Date().toISOString()
    } as APIResponse<{
      categoryStats: typeof categoryStats;
      carrierStats: typeof carrierStats;
      popularFAQs: typeof popularFAQs;
      totalCategories: number;
      totalCarriers: number;
    }>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('FAQ統計取得エラー', { error, responseTime });

    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_ERROR',
        message: 'FAQ統計の取得に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};

/**
 * FAQ埋め込みベクトル一括更新
 */
export const batchUpdateEmbeddings = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { faqIds, force = false } = req.body;

    if (!faqIds || !Array.isArray(faqIds)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FAQ_IDS',
          message: 'FAQ IDの配列が必要です'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<never>);
    }

    const updates: Array<{ id: string; embeddingVector: number[] }> = [];
    let processed = 0;
    let errors = 0;

    for (const faqId of faqIds) {
      try {
        const faq = await faqRepository.getFAQById(faqId);
        if (!faq) {
          errors++;
          continue;
        }

        // 既に埋め込みベクトルがある場合、forceフラグをチェック
        if (faq.embedding_vector && !force) {
          processed++;
          continue;
        }

        const embeddingText = `${faq.question} ${faq.answer}`;
        const embeddingVector = await aiService.generateEmbedding(embeddingText);
        
        updates.push({
          id: faqId,
          embeddingVector
        });
        processed++;

        // APIレート制限を考慮して少し待機
        if (processed % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        logger.error('FAQ埋め込みベクトル生成エラー', { error, faqId });
        errors++;
      }
    }

    // バッチ更新実行
    const updatedCount = updates.length > 0 ? await faqRepository.batchUpdateEmbeddingVectors(updates) : 0;

    const responseTime = Date.now() - startTime;

    logger.info('FAQ埋め込みベクトル一括更新完了', {
      totalRequested: faqIds.length,
      processed,
      updated: updatedCount,
      errors,
      responseTime
    });

    res.status(200).json({
      success: true,
      data: {
        totalRequested: faqIds.length,
        processed,
        updated: updatedCount,
        errors,
        message: `${updatedCount}件のFAQの埋め込みベクトルを更新しました`
      },
      timestamp: new Date().toISOString()
    } as APIResponse<{
      totalRequested: number;
      processed: number;
      updated: number;
      errors: number;
      message: string;
    }>);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('FAQ埋め込みベクトル一括更新エラー', { error, responseTime });

    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_UPDATE_ERROR',
        message: '埋め込みベクトルの一括更新に失敗しました'
      },
      timestamp: new Date().toISOString()
    } as APIResponse<never>);
  }
};