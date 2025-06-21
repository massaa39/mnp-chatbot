/**
 * OpenAI設定
 * Purpose: OpenAI APIの設定とクライアント管理
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  defaultModel: string;
  embeddingModel: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  maxRetries: number;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  pricing: {
    inputTokenCost: number;  // per 1K tokens
    outputTokenCost: number; // per 1K tokens
    embeddingCost: number;   // per 1K tokens
  };
}

export interface RequestConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
}

class OpenAIConfigManager {
  private static instance: OpenAIConfigManager;
  private client: OpenAI | null = null;
  private config: OpenAIConfig;
  private requestCount: { minute: number; timestamp: number } = { minute: 0, timestamp: Date.now() };
  private tokenCount: { minute: number; timestamp: number } = { minute: 0, timestamp: Date.now() };

  constructor() {
    this.config = this.loadConfig();
    this.initializeClient();
  }

  public static getInstance(): OpenAIConfigManager {
    if (!OpenAIConfigManager.instance) {
      OpenAIConfigManager.instance = new OpenAIConfigManager();
    }
    return OpenAIConfigManager.instance;
  }

  /**
   * OpenAIクライアント取得
   */
  public getClient(): OpenAI {
    if (!this.client) {
      throw new Error('OpenAI client is not initialized');
    }
    return this.client;
  }

  /**
   * 設定取得
   */
  public getConfig(): OpenAIConfig {
    return this.config;
  }

  /**
   * レート制限チェック
   */
  public async checkRateLimit(estimatedTokens: number = 0): Promise<{ allowed: boolean; waitTime?: number }> {
    const now = Date.now();
    
    // 1分経過した場合はカウンターをリセット
    if (now - this.requestCount.timestamp > 60000) {
      this.requestCount = { minute: 0, timestamp: now };
      this.tokenCount = { minute: 0, timestamp: now };
    }

    // リクエスト制限チェック
    if (this.requestCount.minute >= this.config.rateLimits.requestsPerMinute) {
      const waitTime = 60000 - (now - this.requestCount.timestamp);
      return { allowed: false, waitTime };
    }

    // トークン制限チェック
    if (this.tokenCount.minute + estimatedTokens > this.config.rateLimits.tokensPerMinute) {
      const waitTime = 60000 - (now - this.tokenCount.timestamp);
      return { allowed: false, waitTime };
    }

    return { allowed: true };
  }

  /**
   * 使用量記録
   */
  public recordUsage(requestTokens: number, responseTokens: number = 0): void {
    this.requestCount.minute++;
    this.tokenCount.minute += requestTokens + responseTokens;

    logger.info('OpenAI使用量記録', {
      requestsThisMinute: this.requestCount.minute,
      tokensThisMinute: this.tokenCount.minute,
      requestTokens,
      responseTokens
    });
  }

  /**
   * コスト計算
   */
  public calculateCost(inputTokens: number, outputTokens: number, isEmbedding: boolean = false): number {
    if (isEmbedding) {
      return (inputTokens / 1000) * this.config.pricing.embeddingCost;
    }

    const inputCost = (inputTokens / 1000) * this.config.pricing.inputTokenCost;
    const outputCost = (outputTokens / 1000) * this.config.pricing.outputTokenCost;
    
    return inputCost + outputCost;
  }

  /**
   * デフォルトリクエスト設定取得
   */
  public getDefaultRequestConfig(): RequestConfig {
    return {
      model: this.config.defaultModel,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      timeout: this.config.timeout
    };
  }

  /**
   * モデル固有設定取得
   */
  public getModelConfig(model: string): RequestConfig {
    const baseConfig = this.getDefaultRequestConfig();

    // モデル固有の最適化
    switch (model) {
      case 'gpt-4-turbo-preview':
        return {
          ...baseConfig,
          model,
          maxTokens: 4096,
          temperature: 0.7
        };
      
      case 'gpt-4':
        return {
          ...baseConfig,
          model,
          maxTokens: 8192,
          temperature: 0.7
        };
      
      case 'gpt-3.5-turbo':
        return {
          ...baseConfig,
          model,
          maxTokens: 4096,
          temperature: 0.8
        };
      
      case 'text-embedding-3-large':
      case 'text-embedding-ada-002':
        return {
          ...baseConfig,
          model,
          maxTokens: 8191 // エンベディングモデルの最大入力長
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * システムプロンプト取得
   */
  public getSystemPrompt(mode: 'roadmap' | 'step_by_step' = 'roadmap'): string {
    const basePrompt = `あなたはMNP（携帯電話番号ポータビリティ）の専門アドバイザーです。
日本のMNP手続きについて、正確で分かりやすい情報を提供してください。

重要な原則：
1. 常に最新の正確な情報を提供する
2. 複雑な手続きを分かりやすく説明する
3. ユーザーの状況に応じてパーソナライズされたアドバイスを行う
4. 不明な点がある場合は、適切な問い合わせ先を案内する
5. セキュリティとプライバシーに配慮する

対象キャリア：
- docomo（ドコモ）
- au（KDDI）
- SoftBank（ソフトバンク）
- その他MVNO

主要な手続き項目：
- MNP予約番号の取得
- 本人確認書類の準備
- 契約解除料・手数料の確認
- 転出・転入手続きのタイミング
- 手続き完了までの流れ`;

    if (mode === 'step_by_step') {
      return `${basePrompt}

現在はステップバイステップモードです。
詳細な手順を段階的に案内し、各ステップでユーザーの理解を確認しながら進めてください。
必要に応じて追加の質問を行い、ユーザーの状況に最適化された案内を提供してください。`;
    } else {
      return `${basePrompt}

現在はロードマップモードです。
MNP手続きの全体像を把握できるよう、概要と主要なポイントを整理して説明してください。
必要に応じて詳細なステップバイステップガイドへの切り替えを提案してください。`;
    }
  }

  /**
   * 設定再読み込み
   */
  public reloadConfig(): void {
    logger.info('OpenAI設定を再読み込みします');
    this.config = this.loadConfig();
    this.initializeClient();
  }

  /**
   * ヘルスチェック
   */
  public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // 簡単なテストリクエストでAPI接続確認
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        temperature: 0
      });

      return {
        status: 'healthy',
        details: {
          apiKey: this.config.apiKey ? 'configured' : 'missing',
          model: this.config.defaultModel,
          rateLimits: this.config.rateLimits,
          usage: {
            requestsThisMinute: this.requestCount.minute,
            tokensThisMinute: this.tokenCount.minute
          },
          testResponse: response.id ? 'success' : 'failed'
        }
      };
    } catch (error) {
      logger.error('OpenAI health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          apiKey: this.config.apiKey ? 'configured' : 'missing',
          model: this.config.defaultModel
        }
      };
    }
  }

  /**
   * 設定読み込み
   */
  private loadConfig(): OpenAIConfig {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    return {
      apiKey,
      organization: process.env.OPENAI_ORGANIZATION,
      baseURL: process.env.OPENAI_BASE_URL,
      defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4-turbo-preview',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3'),
      rateLimits: {
        requestsPerMinute: parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE || '60'),
        tokensPerMinute: parseInt(process.env.OPENAI_TOKENS_PER_MINUTE || '90000')
      },
      pricing: {
        inputTokenCost: parseFloat(process.env.OPENAI_INPUT_TOKEN_COST || '0.01'), // $0.01 per 1K tokens
        outputTokenCost: parseFloat(process.env.OPENAI_OUTPUT_TOKEN_COST || '0.03'), // $0.03 per 1K tokens
        embeddingCost: parseFloat(process.env.OPENAI_EMBEDDING_COST || '0.0001') // $0.0001 per 1K tokens
      }
    };
  }

  /**
   * クライアント初期化
   */
  private initializeClient(): void {
    try {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        organization: this.config.organization,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries
      });

      logger.info('OpenAI client initialized successfully', {
        model: this.config.defaultModel,
        organization: this.config.organization ? 'configured' : 'not set',
        baseURL: this.config.baseURL || 'default',
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries
      });
    } catch (error) {
      logger.error('Failed to initialize OpenAI client', { error: error.message });
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const openAIConfig = OpenAIConfigManager.getInstance();

// 便利関数をエクスポート
export const getOpenAIClient = () => openAIConfig.getClient();
export const getOpenAIConfig = () => openAIConfig.getConfig();
export const checkRateLimit = (tokens?: number) => openAIConfig.checkRateLimit(tokens);
export const recordUsage = (requestTokens: number, responseTokens?: number) => 
  openAIConfig.recordUsage(requestTokens, responseTokens);
export const calculateCost = (inputTokens: number, outputTokens: number, isEmbedding?: boolean) =>
  openAIConfig.calculateCost(inputTokens, outputTokens, isEmbedding);
export const getModelConfig = (model: string) => openAIConfig.getModelConfig(model);
export const getSystemPrompt = (mode?: 'roadmap' | 'step_by_step') => openAIConfig.getSystemPrompt(mode);

export default OpenAIConfigManager;