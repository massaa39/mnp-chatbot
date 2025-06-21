/**
 * AI連携サービス
 * Purpose: OpenAI GPT-4との通信とRAG実装
 */
import { OpenAIRequest, RAGSearchResult, ChatResponse } from '../types';
import { ragService } from './ragService';
import { logger } from '../utils/logger';
import { openAIConfig, getOpenAIClient, getSystemPrompt, recordUsage, calculateCost } from '../config/openai';

class AIService {
  private readonly maxRetries: number = 3;

  constructor() {
    logger.info('AI Service initialized');
  }

  /**
   * RAG拡張チャット応答生成
   * @param request チャットリクエスト
   * @returns AI応答
   */
  public async generateChatResponse(request: OpenAIRequest): Promise<ChatResponse> {
    try {
      const startTime = Date.now();

      // 1. RAG検索でFAQから関連情報を取得
      const ragResults: RAGSearchResult = await ragService.searchRelevantFAQs(
        request.prompt,
        request.sessionData
      );

      // 2. システムプロンプト構築
      const systemPrompt = this.buildSystemPrompt(ragResults, request.sessionData);

      // 3. GPT-4で応答生成
      const completion = await this.callOpenAI(systemPrompt, request);

      // 4. 応答解析と構造化
      const response = this.parseAndStructureResponse(
        completion,
        ragResults,
        request.sessionData
      );

      const responseTime = Date.now() - startTime;
      
      logger.info('Chat response generated', {
        responseTime: `${responseTime}ms`,
        ragResultsCount: ragResults.faqs.length,
        contextRelevance: ragResults.contextRelevance,
        sessionStep: request.sessionData.currentStep
      });

      return response;

    } catch (error: any) {
      logger.error('AI response generation failed:', {
        error: error.message,
        prompt: request.prompt.substring(0, 100),
        sessionData: request.sessionData,
        timestamp: new Date().toISOString()
      });

      // フォールバック応答
      return this.generateFallbackResponse(error);
    }
  }

  /**
   * システムプロンプト構築
   * @param ragResults RAG検索結果
   * @param sessionData セッションデータ
   * @returns システムプロンプト
   */
  private buildSystemPrompt(ragResults: RAGSearchResult, sessionData: any): string {
    const relevantFAQs = ragResults.faqs
      .map(faq => `Q: ${faq.question}\nA: ${faq.answer}`)
      .join('\n\n');

    // モード別のシステムプロンプトを取得
    const baseSystemPrompt = getSystemPrompt(sessionData.mode || 'step_by_step');

    return `${baseSystemPrompt}

## 現在のユーザー状況
- 進行モード: ${sessionData.mode || '未設定'}
- 現在のステップ: ${sessionData.currentStep || '初期'}
- 現在のキャリア: ${sessionData.currentCarrier || '未設定'}
- 移行先キャリア: ${sessionData.targetCarrier || '未設定'}

## 参考情報（FAQ検索結果）
${relevantFAQs || '関連するFAQが見つかりませんでした。一般的なMNP情報を基に回答してください。'}

## 応答形式
以下のJSON形式で応答してください：
{
  "message": "ユーザーへの応答メッセージ",
  "suggestions": ["提案1", "提案2", "提案3"],
  "actions": [
    {
      "type": "button|link|escalation",
      "label": "ボタンラベル",
      "value": "値",
      "url": "URL（linkの場合）"
    }
  ],
  "needsEscalation": false
}

応答は必ず上記JSON形式で行い、適切な改行とフォーマットを使用してください。`;
  }

  /**
   * OpenAI API呼び出し
   * @param systemPrompt システムプロンプト
   * @param request リクエスト情報
   * @returns API応答
   */
  private async callOpenAI(systemPrompt: string, request: OpenAIRequest): Promise<string> {
    let lastError: Error;
    const client = getOpenAIClient();
    const config = openAIConfig.getConfig();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // レート制限チェック
        const rateLimitCheck = await openAIConfig.checkRateLimit(1000);
        if (!rateLimitCheck.allowed) {
          if (rateLimitCheck.waitTime) {
            logger.warn('Rate limit reached, waiting...', { waitTime: rateLimitCheck.waitTime });
            await new Promise(resolve => setTimeout(resolve, rateLimitCheck.waitTime));
          }
        }

        const completion = await client.chat.completions.create({
          model: config.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: request.prompt }
          ],
          max_tokens: request.maxTokens || config.maxTokens,
          temperature: request.temperature || config.temperature,
          response_format: { type: 'json_object' }
        });

        const response = completion.choices[0]?.message?.content;
        if (!response) {
          throw new Error('Empty response from OpenAI');
        }

        // 使用量記録
        if (completion.usage) {
          recordUsage(completion.usage.prompt_tokens, completion.usage.completion_tokens);
          
          // コスト計算
          const cost = calculateCost(completion.usage.prompt_tokens, completion.usage.completion_tokens);
          logger.info('OpenAI API call completed', {
            attempt,
            model: config.defaultModel,
            tokensUsed: completion.usage.total_tokens,
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            estimatedCost: `$${cost.toFixed(4)}`
          });
        }

        return response;

      } catch (error: any) {
        lastError = error;
        logger.warn(`OpenAI API call failed (attempt ${attempt}/${this.maxRetries}):`, {
          error: error.message,
          attempt,
          willRetry: attempt < this.maxRetries
        });

        if (attempt < this.maxRetries) {
          // 指数バックオフで待機
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError!;
  }

  /**
   * 応答解析と構造化
   * @param completion OpenAI応答
   * @param ragResults RAG結果
   * @param sessionData セッションデータ
   * @returns 構造化された応答
   */
  private parseAndStructureResponse(
    completion: string,
    ragResults: RAGSearchResult,
    sessionData: any
  ): ChatResponse {
    try {
      const parsed = JSON.parse(completion);

      // エスカレーション判定
      if (parsed.needsEscalation || ragResults.contextRelevance < 0.5) {
        return {
          ...parsed,
          escalation: {
            reason: 'complex_inquiry',
            lineUrl: `${process.env.FRONTEND_URL}/escalation`,
            contextData: {
              lastQuery: sessionData.lastQuery,
              currentStep: sessionData.currentStep,
              conversation: sessionData.conversation?.slice(-5) // 直近5件の対話
            }
          }
        };
      }

      return parsed;

    } catch (error) {
      logger.error('Failed to parse AI response:', {
        error: error,
        completion: completion.substring(0, 200)
      });

      // パース失敗時のフォールバック
      return {
        message: completion,
        suggestions: ['詳細を教えてください', 'オペレーターに相談する'],
        actions: [{
          type: 'escalation',
          label: 'オペレーターに相談',
          value: 'escalate'
        }]
      };
    }
  }

  /**
   * フォールバック応答生成
   * @param error エラー情報
   * @returns フォールバック応答
   */
  private generateFallbackResponse(error: Error): ChatResponse {
    logger.error('Generating fallback response due to error:', error);

    return {
      message: '申し訳ございません。一時的にサービスに問題が発生しています。お急ぎの場合は、オペレーターにご相談ください。',
      suggestions: [
        'しばらく待ってから再試行',
        'オペレーターに相談',
        'よくある質問を確認'
      ],
      actions: [
        {
          type: 'escalation',
          label: 'オペレーターに相談',
          value: 'escalate'
        },
        {
          type: 'link',
          label: 'よくある質問',
          value: 'faq',
          url: '/faq'
        }
      ]
    };
  }

  /**
   * 埋め込みベクトル生成
   * @param text テキスト
   * @returns ベクトル配列
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      const client = getOpenAIClient();
      const config = openAIConfig.getConfig();

      const response = await client.embeddings.create({
        model: config.embeddingModel,
        input: text
      });

      // 使用量記録（埋め込み用）
      if (response.usage) {
        recordUsage(response.usage.total_tokens, 0);
        
        const cost = calculateCost(response.usage.total_tokens, 0, true);
        logger.debug('Embedding generated', {
          model: config.embeddingModel,
          tokensUsed: response.usage.total_tokens,
          textLength: text.length,
          estimatedCost: `$${cost.toFixed(6)}`
        });
      }

      return response.data[0].embedding;

    } catch (error: any) {
      logger.error('Embedding generation failed:', {
        error: error.message,
        textLength: text.length
      });
      throw error;
    }
  }
}

export const aiService = new AIService();