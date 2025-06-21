/**
 * チャットコントローラー
 * Purpose: チャット関連のAPI エンドポイント実装
 */
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatRequest, 
  ChatResponse as APIChatResponse, 
  CreateSessionRequest, 
  CreateSessionResponse,
  GetHistoryResponse,
  APIResponse 
} from '../types/api';
import { User, ChatSession, Message } from '../types/database';
import { aiService } from '../services/aiService';
import { database } from '../config/database';
import { logger } from '../utils/logger';

export class ChatController {
  /**
   * 新しいチャットセッション作成
   * POST /api/v1/sessions
   */
  public async createSession(
    req: Request<{}, CreateSessionResponse, CreateSessionRequest>,
    res: Response<APIResponse<CreateSessionResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { phoneNumber, currentCarrier, targetCarrier, mode, preferences } = req.body;
      const sessionToken = uuidv4();
      const sessionId = uuidv4();

      // トランザクション開始
      await database.query('BEGIN');

      try {
        // ユーザー作成
        const userResult = await database.query(`
          INSERT INTO users (session_id, phone_number, current_carrier, target_carrier, preferences)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [sessionId, phoneNumber, currentCarrier, targetCarrier, preferences || {}]);

        const user = userResult.rows[0];

        // セッション作成
        const sessionResult = await database.query(`
          INSERT INTO chat_sessions (user_id, session_token, mode, current_step, scenario_data, context_data)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [
          user.id,
          sessionToken,
          mode,
          'initial',
          {},
          { currentCarrier, targetCarrier }
        ]);

        const session = sessionResult.rows[0];

        // 初期システムメッセージ作成
        await database.query(`
          INSERT INTO messages (session_id, message_type, content, metadata)
          VALUES ($1, $2, $3, $4)
        `, [
          session.id,
          'system',
          'チャットセッションが開始されました。MNP手続きについてお手伝いします。',
          { initialSetup: true }
        ]);

        await database.query('COMMIT');

        const response: CreateSessionResponse = {
          sessionToken,
          user: {
            sessionId: user.session_id,
            phoneNumber: user.phone_number,
            currentCarrier: user.current_carrier,
            targetCarrier: user.target_carrier,
            status: user.status,
            preferences: user.preferences,
            createdAt: new Date(user.created_at),
            updatedAt: new Date(user.updated_at)
          },
          session: {
            sessionToken: session.session_token,
            mode: session.mode,
            currentStep: session.current_step,
            scenarioData: session.scenario_data,
            contextData: session.context_data,
            createdAt: new Date(session.created_at),
            updatedAt: new Date(session.updated_at)
          }
        };

        logger.info('New chat session created', {
          sessionToken,
          mode,
          currentCarrier,
          targetCarrier
        });

        res.status(201).json({
          success: true,
          data: response,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId || '',
            version: '1.0.0'
          }
        });

      } catch (error) {
        await database.query('ROLLBACK');
        throw error;
      }

    } catch (error: any) {
      logger.error('Failed to create chat session:', {
        error: error.message,
        body: req.body
      });
      next(error);
    }
  }

  /**
   * チャットメッセージ送信
   * POST /api/v1/chat/messages
   */
  public async sendMessage(
    req: Request<{}, APIChatResponse, ChatRequest>,
    res: Response<APIResponse<APIChatResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { message, sessionToken, mode, contextData } = req.body;
      const startTime = Date.now();

      // セッション取得
      const sessionResult = await database.query(`
        SELECT cs.*, u.current_carrier, u.target_carrier, u.preferences
        FROM chat_sessions cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.session_token = $1
      `, [sessionToken]);

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            error: 'Session not found',
            code: 'SESSION_NOT_FOUND',
            message: 'The specified session token was not found',
            details: null,
            timestamp: new Date().toISOString()
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId || '',
            version: '1.0.0'
          }
        });
      }

      const sessionData = sessionResult.rows[0];

      // ユーザーメッセージを保存
      const userMessageResult = await database.query(`
        INSERT INTO messages (session_id, message_type, content, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        sessionData.id,
        'user',
        message,
        { contextData: contextData || {} }
      ]);

      // AI応答生成
      const aiRequest = {
        prompt: message,
        sessionData: {
          sessionToken: sessionData.session_token,
          mode: mode || sessionData.mode,
          currentStep: sessionData.current_step,
          currentCarrier: sessionData.current_carrier,
          targetCarrier: sessionData.target_carrier,
          conversation: await this.getRecentConversation(sessionData.id),
          lastQuery: message,
          preferences: sessionData.preferences
        }
      };

      const aiResponse = await aiService.generateChatResponse(aiRequest);
      const responseTime = Date.now() - startTime;

      // AI応答を保存
      await database.query(`
        INSERT INTO messages (session_id, message_type, content, metadata, confidence_score, response_time_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        sessionData.id,
        'assistant',
        aiResponse.message,
        {
          suggestions: aiResponse.suggestions,
          actions: aiResponse.actions,
          escalation: aiResponse.escalation
        },
        aiResponse.confidenceScore || null,
        responseTime
      ]);

      // セッション更新（必要に応じて）
      if (mode && mode !== sessionData.mode) {
        await database.query(`
          UPDATE chat_sessions 
          SET mode = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [mode, sessionData.id]);
      }

      const response: APIChatResponse = {
        message: aiResponse.message,
        sessionToken: sessionData.session_token,
        suggestions: aiResponse.suggestions || [],
        actions: aiResponse.actions || [],
        currentStep: sessionData.current_step,
        needsEscalation: aiResponse.needsEscalation,
        escalation: aiResponse.escalation,
        metadata: {
          responseTime,
          confidenceScore: aiResponse.confidenceScore,
          ragResults: aiResponse.ragResults?.length || 0
        }
      };

      logger.info('Chat message processed', {
        sessionToken: sessionData.session_token,
        messageLength: message.length,
        responseTime,
        confidenceScore: aiResponse.confidenceScore,
        needsEscalation: aiResponse.needsEscalation
      });

      res.status(200).json({
        success: true,
        data: response,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId || '',
          version: '1.0.0'
        }
      });

    } catch (error: any) {
      logger.error('Failed to process chat message:', {
        error: error.message,
        body: req.body
      });
      next(error);
    }
  }

  /**
   * 会話履歴取得
   * GET /api/v1/chat/history/:sessionToken
   */
  public async getHistory(
    req: Request<{ sessionToken: string }, GetHistoryResponse, {}, { page?: string; limit?: string }>,
    res: Response<APIResponse<GetHistoryResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionToken } = req.params;
      const page = parseInt(req.query.page || '1');
      const limit = parseInt(req.query.limit || '50');
      const offset = (page - 1) * limit;

      // セッション取得
      const sessionResult = await database.query(`
        SELECT cs.*, u.*
        FROM chat_sessions cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.session_token = $1
      `, [sessionToken]);

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            error: 'Session not found',
            code: 'SESSION_NOT_FOUND',
            message: 'The specified session token was not found',
            details: null,
            timestamp: new Date().toISOString()
          }
        });
      }

      const sessionData = sessionResult.rows[0];

      // メッセージ取得
      const messagesResult = await database.query(`
        SELECT * FROM messages
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [sessionData.id, limit, offset]);

      // 総数取得
      const countResult = await database.query(`
        SELECT COUNT(*) as total FROM messages WHERE session_id = $1
      `, [sessionData.id]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      const response: GetHistoryResponse = {
        messages: messagesResult.rows.map(row => ({
          id: row.id,
          sessionId: row.session_id,
          messageType: row.message_type,
          content: row.content,
          metadata: row.metadata,
          embeddingVector: row.embedding_vector,
          confidenceScore: row.confidence_score,
          responseTimeMs: row.response_time_ms,
          createdAt: new Date(row.created_at)
        })),
        session: {
          id: sessionData.id,
          userId: sessionData.user_id,
          sessionToken: sessionData.session_token,
          mode: sessionData.mode,
          currentStep: sessionData.current_step,
          scenarioData: sessionData.scenario_data,
          contextData: sessionData.context_data,
          escalationReason: sessionData.escalation_reason,
          escalatedAt: sessionData.escalated_at ? new Date(sessionData.escalated_at) : undefined,
          completedAt: sessionData.completed_at ? new Date(sessionData.completed_at) : undefined,
          createdAt: new Date(sessionData.created_at),
          updatedAt: new Date(sessionData.updated_at)
        },
        user: {
          id: sessionData.id,
          sessionId: sessionData.session_id,
          phoneNumber: sessionData.phone_number,
          currentCarrier: sessionData.current_carrier,
          targetCarrier: sessionData.target_carrier,
          status: sessionData.status,
          preferences: sessionData.preferences,
          createdAt: new Date(sessionData.created_at),
          updatedAt: new Date(sessionData.updated_at)
        },
        pagination: {
          total,
          page,
          limit,
          hasNext: page < totalPages
        }
      };

      res.status(200).json({
        success: true,
        data: response,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId || '',
          version: '1.0.0'
        }
      });

    } catch (error: any) {
      logger.error('Failed to get chat history:', {
        error: error.message,
        sessionToken: req.params.sessionToken
      });
      next(error);
    }
  }

  /**
   * セッション検証
   * POST /api/v1/sessions/verify
   */
  public async verifySession(
    req: Request<{}, any, { sessionToken: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionToken } = req.body;

      const result = await database.query(`
        SELECT cs.*, u.*
        FROM chat_sessions cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.session_token = $1
      `, [sessionToken]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found'
          }
        });
      }

      const sessionData = result.rows[0];

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          user: {
            id: sessionData.id,
            sessionId: sessionData.session_id,
            phoneNumber: sessionData.phone_number,
            currentCarrier: sessionData.current_carrier,
            targetCarrier: sessionData.target_carrier,
            status: sessionData.status,
            preferences: sessionData.preferences,
            createdAt: new Date(sessionData.created_at),
            updatedAt: new Date(sessionData.updated_at)
          },
          session: {
            id: sessionData.id,
            userId: sessionData.user_id,
            sessionToken: sessionData.session_token,
            mode: sessionData.mode,
            currentStep: sessionData.current_step,
            scenarioData: sessionData.scenario_data,
            contextData: sessionData.context_data,
            createdAt: new Date(sessionData.created_at),
            updatedAt: new Date(sessionData.updated_at)
          }
        }
      });

    } catch (error: any) {
      logger.error('Failed to verify session:', error);
      next(error);
    }
  }

  /**
   * 最近の会話を取得（内部使用）
   */
  private async getRecentConversation(sessionId: string, limit: number = 10): Promise<Message[]> {
    try {
      const result = await database.query(`
        SELECT * FROM messages
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [sessionId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        messageType: row.message_type,
        content: row.content,
        metadata: row.metadata,
        embeddingVector: row.embedding_vector,
        confidenceScore: row.confidence_score,
        responseTimeMs: row.response_time_ms,
        createdAt: new Date(row.created_at)
      })).reverse(); // 時系列順に並び替え

    } catch (error: any) {
      logger.error('Failed to get recent conversation:', {
        error: error.message,
        sessionId
      });
      return [];
    }
  }
}

export const chatController = new ChatController();
