/**
 * チャットサービス
 * Purpose: チャット会話のビジネスロジック抽象化
 */

import { logger } from '../utils/logger';
import { ChatRequest, ChatResponse, ChatAction, Message } from '../types/api';
import { DatabaseConnection } from '../types/database';
import AIService from './aiService';
import EscalationService from './escalationService';
import ScenarioService from './scenarioService';

export interface ChatContext {
  sessionToken: string;
  userId: string;
  conversationHistory: Message[];
  currentStep?: string;
  mode: 'roadmap' | 'step_by_step';
  scenarioData: Record<string, any>;
  userPreferences: Record<string, any>;
}

export interface ProcessedChatResponse {
  response: ChatResponse;
  shouldSaveMessage: boolean;
  contextUpdates: Partial<ChatContext>;
  nextActions: string[];
}

class ChatService {
  private db: DatabaseConnection;
  private aiService: AIService;
  private escalationService: EscalationService;
  private scenarioService: ScenarioService;

  constructor(
    db: DatabaseConnection,
    aiService: AIService,
    escalationService: EscalationService,
    scenarioService: ScenarioService
  ) {
    this.db = db;
    this.aiService = aiService;
    this.escalationService = escalationService;
    this.scenarioService = scenarioService;
  }

  /**
   * チャットメッセージ処理
   */
  async processMessage(request: ChatRequest, context: ChatContext): Promise<ProcessedChatResponse> {
    try {
      logger.info('チャットメッセージ処理開始', { 
        sessionToken: context.sessionToken,
        messageLength: request.message.length,
        mode: context.mode 
      });

      // メッセージの前処理
      const preprocessedMessage = await this.preprocessMessage(request.message, context);

      // シナリオベースの処理判定
      const scenarioResult = await this.handleScenarioInteraction(preprocessedMessage, context);
      if (scenarioResult) {
        return scenarioResult;
      }

      // AI応答生成
      const aiResponse = await this.generateAIResponse(preprocessedMessage, context);

      // エスカレーション判定
      const escalationCheck = await this.checkEscalationNeeds(aiResponse, context);

      // 応答の後処理
      const finalResponse = await this.postprocessResponse(aiResponse, escalationCheck, context);

      // クイックリプライとアクション生成
      const actions = await this.generateChatActions(finalResponse, context);

      const chatResponse: ChatResponse = {
        message: finalResponse.message,
        sessionToken: context.sessionToken,
        suggestions: await this.generateSuggestions(context),
        actions,
        currentStep: context.currentStep,
        needsEscalation: escalationCheck.shouldEscalate,
        escalation: escalationCheck.shouldEscalate ? {
          reason: escalationCheck.reason || '詳細なサポートが必要です',
          lineUrl: 'https://line.me/ti/g2/support',
          contextData: {
            lastQuery: request.message,
            currentStep: context.currentStep || 'unknown',
            conversation: context.conversationHistory.slice(-5) // 直近5件
          }
        } : undefined,
        metadata: {
          responseTime: finalResponse.metadata?.responseTime || 0,
          confidenceScore: finalResponse.metadata?.confidenceScore,
          ragResults: finalResponse.metadata?.ragResults
        }
      };

      return {
        response: chatResponse,
        shouldSaveMessage: true,
        contextUpdates: {},
        nextActions: escalationCheck.shouldEscalate ? ['escalate'] : ['continue']
      };

    } catch (error) {
      logger.error('チャットメッセージ処理エラー', { 
        error: error.message, 
        sessionToken: context.sessionToken 
      });

      // エラー時のフォールバック応答
      return this.createErrorResponse(context.sessionToken, error.message);
    }
  }

  /**
   * 会話履歴取得
   */
  async getConversationHistory(sessionToken: string, limit: number = 20): Promise<Message[]> {
    try {
      const query = `
        SELECT m.* FROM messages m
        JOIN chat_sessions cs ON m.session_id = cs.id
        WHERE cs.session_token = $1
        ORDER BY m.created_at DESC
        LIMIT $2
      `;
      
      const result = await this.db.query(query, [sessionToken, limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        messageType: row.message_type,
        content: row.content,
        metadata: JSON.parse(row.metadata || '{}'),
        embeddingVector: row.embedding_vector,
        confidenceScore: row.confidence_score,
        responseTimeMs: row.response_time_ms,
        createdAt: new Date(row.created_at)
      })).reverse(); // 時系列順に並び替え

    } catch (error) {
      logger.error('会話履歴取得エラー', { error: error.message, sessionToken });
      return [];
    }
  }

  /**
   * チャットコンテキスト構築
   */
  async buildChatContext(sessionToken: string): Promise<ChatContext | null> {
    try {
      // セッション情報取得
      const sessionQuery = `
        SELECT cs.*, u.id as user_id, u.preferences
        FROM chat_sessions cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.session_token = $1
      `;
      
      const sessionResult = await this.db.query(sessionQuery, [sessionToken]);
      if (sessionResult.rows.length === 0) {
        return null;
      }

      const session = sessionResult.rows[0];
      
      // 会話履歴取得
      const conversationHistory = await this.getConversationHistory(sessionToken);

      return {
        sessionToken,
        userId: session.user_id,
        conversationHistory,
        currentStep: session.current_step,
        mode: session.mode,
        scenarioData: JSON.parse(session.scenario_data || '{}'),
        userPreferences: JSON.parse(session.preferences || '{}')
      };

    } catch (error) {
      logger.error('チャットコンテキスト構築エラー', { error: error.message, sessionToken });
      return null;
    }
  }

  /**
   * メッセージ保存
   */
  async saveMessage(
    sessionToken: string,
    messageType: 'user' | 'assistant' | 'system',
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      // セッションID取得
      const sessionQuery = `
        SELECT id FROM chat_sessions WHERE session_token = $1
      `;
      const sessionResult = await this.db.query(sessionQuery, [sessionToken]);
      
      if (sessionResult.rows.length === 0) {
        throw new Error('セッションが見つかりません');
      }

      const sessionId = sessionResult.rows[0].id;

      // メッセージ保存
      const messageQuery = `
        INSERT INTO messages (id, session_id, message_type, content, metadata, created_at)
        VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5)
        RETURNING id
      `;

      const result = await this.db.query(messageQuery, [
        sessionId,
        messageType,
        content,
        JSON.stringify(metadata),
        new Date()
      ]);

      return result.rows[0].id;

    } catch (error) {
      logger.error('メッセージ保存エラー', { 
        error: error.message, 
        sessionToken, 
        messageType 
      });
      throw error;
    }
  }

  /**
   * セッション状態更新
   */
  async updateSessionState(
    sessionToken: string,
    updates: {
      currentStep?: string;
      scenarioData?: Record<string, any>;
      contextData?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.currentStep) {
        updateFields.push(`current_step = $${paramIndex++}`);
        values.push(updates.currentStep);
      }

      if (updates.scenarioData) {
        updateFields.push(`scenario_data = $${paramIndex++}`);
        values.push(JSON.stringify(updates.scenarioData));
      }

      if (updates.contextData) {
        updateFields.push(`context_data = $${paramIndex++}`);
        values.push(JSON.stringify(updates.contextData));
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());

      values.push(sessionToken);

      const query = `
        UPDATE chat_sessions 
        SET ${updateFields.join(', ')}
        WHERE session_token = $${paramIndex}
      `;

      await this.db.query(query, values);

    } catch (error) {
      logger.error('セッション状態更新エラー', { error: error.message, sessionToken });
      throw error;
    }
  }

  /**
   * メッセージ前処理
   */
  private async preprocessMessage(message: string, context: ChatContext): Promise<string> {
    // 基本的なサニタイゼーション
    let processed = message.trim();
    
    // 特定のキーワードの正規化
    const normalizations = {
      'ＭＮＰ': 'MNP',
      'ｄｏｃｏｍｏ': 'docomo',
      'ａｕ': 'au',
      'ＡＵ': 'au',
      'ソフトバンク': 'SoftBank',
      'softbank': 'SoftBank'
    };

    for (const [from, to] of Object.entries(normalizations)) {
      processed = processed.replace(new RegExp(from, 'gi'), to);
    }

    return processed;
  }

  /**
   * シナリオインタラクション処理
   */
  private async handleScenarioInteraction(
    message: string,
    context: ChatContext
  ): Promise<ProcessedChatResponse | null> {
    try {
      // シナリオコマンドチェック
      if (message.includes('次へ') || message.includes('進む')) {
        const result = await this.scenarioService.proceedToNextStep(
          context.sessionToken,
          context.currentStep || '',
          message
        );

        if (result.completed) {
          return {
            response: {
              message: 'MNP手続きガイドが完了しました。お疲れ様でした！',
              sessionToken: context.sessionToken,
              suggestions: ['新しい質問をする', 'サポートに連絡'],
              actions: [],
              metadata: { responseTime: 100 }
            },
            shouldSaveMessage: true,
            contextUpdates: { currentStep: undefined },
            nextActions: ['complete']
          };
        }

        if (result.step) {
          return {
            response: {
              message: result.step.content,
              sessionToken: context.sessionToken,
              suggestions: result.step.options?.map(opt => opt.label) || [],
              actions: this.createScenarioActions(result.step),
              currentStep: result.step.id,
              metadata: { responseTime: 100 }
            },
            shouldSaveMessage: true,
            contextUpdates: { currentStep: result.step.id },
            nextActions: ['continue_scenario']
          };
        }
      }

      // スキップコマンド
      if (message.includes('スキップ') || message.includes('飛ばす')) {
        const result = await this.scenarioService.skipStep(context.sessionToken, 'ユーザー要求');
        
        if (result.step) {
          return {
            response: {
              message: `ステップをスキップしました。\n\n${result.step.content}`,
              sessionToken: context.sessionToken,
              suggestions: result.step.options?.map(opt => opt.label) || [],
              actions: this.createScenarioActions(result.step),
              currentStep: result.step.id,
              metadata: { responseTime: 100 }
            },
            shouldSaveMessage: true,
            contextUpdates: { currentStep: result.step.id },
            nextActions: ['continue_scenario']
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('シナリオインタラクション処理エラー', { error: error.message });
      return null;
    }
  }

  /**
   * AI応答生成
   */
  private async generateAIResponse(message: string, context: ChatContext) {
    return await this.aiService.generateResponse(
      message,
      context.sessionToken,
      context.conversationHistory,
      {
        mode: context.mode,
        currentStep: context.currentStep,
        userPreferences: context.userPreferences,
        scenarioData: context.scenarioData
      }
    );
  }

  /**
   * エスカレーション判定
   */
  private async checkEscalationNeeds(aiResponse: any, context: ChatContext) {
    return await this.escalationService.shouldEscalate(
      context.sessionToken,
      aiResponse.message,
      aiResponse.metadata?.confidenceScore,
      context.conversationHistory
    );
  }

  /**
   * 応答後処理
   */
  private async postprocessResponse(aiResponse: any, escalationCheck: any, context: ChatContext) {
    // エスカレーション必要時の応答調整
    if (escalationCheck.shouldEscalate) {
      return {
        ...aiResponse,
        message: `${aiResponse.message}\n\n詳細なサポートが必要かもしれません。お手伝いできることがあればお気軽にお声かけください。`
      };
    }

    return aiResponse;
  }

  /**
   * チャットアクション生成
   */
  private async generateChatActions(response: any, context: ChatContext): Promise<ChatAction[]> {
    const actions: ChatAction[] = [];

    // モード切り替えアクション
    if (context.mode === 'roadmap') {
      actions.push({
        type: 'button',
        label: '詳細ガイドに切り替え',
        value: 'switch_to_stepbystep',
        style: 'secondary'
      });
    } else {
      actions.push({
        type: 'button',
        label: '概要モードに切り替え',
        value: 'switch_to_roadmap',
        style: 'secondary'
      });
    }

    // エスカレーションアクション
    actions.push({
      type: 'escalation',
      label: 'サポートに連絡',
      value: 'escalate',
      style: 'danger'
    });

    return actions;
  }

  /**
   * 提案生成
   */
  private async generateSuggestions(context: ChatContext): Promise<string[]> {
    const baseSuggestions = [
      'MNP手続きについて教えて',
      '必要な書類は何ですか？',
      '手数料はいくらですか？',
      '手続きにかかる時間は？'
    ];

    // シナリオに基づく提案
    if (context.currentStep) {
      const stepInfo = await this.scenarioService.getCurrentStep(context.sessionToken);
      if (stepInfo?.step.options) {
        return stepInfo.step.options.map(opt => opt.label);
      }
    }

    return baseSuggestions;
  }

  /**
   * シナリオアクション作成
   */
  private createScenarioActions(step: any): ChatAction[] {
    const actions: ChatAction[] = [];

    if (step.options) {
      step.options.forEach((option: any) => {
        actions.push({
          type: 'quick_reply',
          label: option.label,
          value: option.value,
          style: 'primary'
        });
      });
    }

    if (step.type === 'question') {
      actions.push({
        type: 'button',
        label: 'スキップ',
        value: 'skip_step',
        style: 'secondary'
      });
    }

    return actions;
  }

  /**
   * エラー応答作成
   */
  private createErrorResponse(sessionToken: string, errorMessage: string): ProcessedChatResponse {
    return {
      response: {
        message: '申し訳ございませんが、システムエラーが発生しました。しばらく時間をおいてから再度お試しください。',
        sessionToken,
        suggestions: ['もう一度試す', 'サポートに連絡'],
        actions: [
          {
            type: 'button',
            label: 'もう一度試す',
            value: 'retry',
            style: 'primary'
          },
          {
            type: 'escalation',
            label: 'サポートに連絡',
            value: 'escalate',
            style: 'danger'
          }
        ],
        metadata: {
          responseTime: 0,
          error: errorMessage
        }
      },
      shouldSaveMessage: false,
      contextUpdates: {},
      nextActions: ['error']
    };
  }
}

export default ChatService;