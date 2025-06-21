/**
 * 認証コントローラー
 * Purpose: 認証とセッション管理のエンドポイント
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';
import { DatabaseConnection } from '../types/database';
import { 
  CreateSessionRequest, 
  CreateSessionResponse, 
  VerifySessionRequest, 
  VerifySessionResponse,
  APIResponse 
} from '../types/api';
import { 
  generateJWT, 
  generateRefreshToken, 
  verifyRefreshToken, 
  AuthRequest 
} from '../middleware/authentication';

class AuthController {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * セッション作成
   */
  createSession = async (req: Request<{}, CreateSessionResponse, CreateSessionRequest>, res: Response<APIResponse<CreateSessionResponse>>) => {
    try {
      logger.info('セッション作成開始', { body: req.body });

      const { phoneNumber, currentCarrier, targetCarrier, mode, preferences } = req.body;

      // トランザクション開始
      await this.db.query('BEGIN');

      try {
        // セッショントークン生成
        const sessionToken = this.generateSessionToken();
        const sessionId = sessionToken; // セッションIDとして使用

        // ユーザー作成
        const userQuery = `
          INSERT INTO users (id, session_id, phone_number, current_carrier, target_carrier, status, preferences, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;

        const userId = uuidv4();
        const now = new Date();
        const userResult = await this.db.query(userQuery, [
          userId,
          sessionId,
          phoneNumber || null,
          currentCarrier || null,
          targetCarrier || null,
          'active',
          JSON.stringify(preferences || {}),
          now,
          now
        ]);

        const user = userResult.rows[0];

        // チャットセッション作成
        const sessionQuery = `
          INSERT INTO chat_sessions (id, user_id, session_token, mode, current_step, scenario_data, context_data, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;

        const chatSessionId = uuidv4();
        const sessionResult = await this.db.query(sessionQuery, [
          chatSessionId,
          userId,
          sessionToken,
          mode,
          'initial',
          JSON.stringify({}),
          JSON.stringify({}),
          now,
          now
        ]);

        const session = sessionResult.rows[0];

        // アナリティクス記録
        await this.recordAnalyticsEvent(chatSessionId, 'session_created', {
          mode,
          carrier: currentCarrier,
          targetCarrier,
          hasPhoneNumber: !!phoneNumber
        }, req);

        // セッションログ記録
        await this.recordSessionLog(chatSessionId, 'session_created', {
          mode,
          userAgent: req.get('User-Agent'),
          sessionToken: sessionToken.substring(0, 8) + '...'
        }, req);

        await this.db.query('COMMIT');

        // 応答データ構築
        const response: CreateSessionResponse = {
          sessionToken,
          user: {
            sessionId: user.session_id,
            phoneNumber: user.phone_number,
            currentCarrier: user.current_carrier,
            targetCarrier: user.target_carrier,
            status: user.status,
            preferences: JSON.parse(user.preferences || '{}'),
            createdAt: new Date(user.created_at),
            updatedAt: new Date(user.updated_at)
          },
          session: {
            sessionToken: session.session_token,
            mode: session.mode,
            currentStep: session.current_step,
            scenarioData: JSON.parse(session.scenario_data || '{}'),
            contextData: JSON.parse(session.context_data || '{}'),
            createdAt: new Date(session.created_at),
            updatedAt: new Date(session.updated_at)
          }
        };

        logger.info('セッション作成完了', { 
          sessionToken: sessionToken.substring(0, 8) + '...', 
          userId, 
          mode 
        });

        res.status(201).json({
          success: true,
          data: response,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: uuidv4(),
            version: '1.0.0'
          }
        });

      } catch (error) {
        await this.db.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('セッション作成エラー', { error: error.message, body: req.body });
      
      res.status(500).json({
        success: false,
        error: {
          error: 'SESSION_CREATION_ERROR',
          code: 'INTERNAL_SERVER_ERROR',
          message: 'セッションの作成に失敗しました',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * セッション検証
   */
  verifySession = async (req: Request<{}, VerifySessionResponse, VerifySessionRequest>, res: Response<APIResponse<VerifySessionResponse>>) => {
    try {
      const { sessionToken } = req.body;
      
      logger.info('セッション検証開始', { sessionToken: sessionToken.substring(0, 8) + '...' });

      // セッション情報取得
      const query = `
        SELECT cs.*, u.session_id, u.phone_number, u.current_carrier, u.target_carrier, u.status, u.preferences
        FROM chat_sessions cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.session_token = $1
      `;

      const result = await this.db.query(query, [sessionToken]);

      if (result.rows.length === 0) {
        logger.warn('セッションが見つかりません', { sessionToken: sessionToken.substring(0, 8) + '...' });
        
        return res.status(404).json({
          success: false,
          error: {
            error: 'SESSION_NOT_FOUND',
            code: 'NOT_FOUND',
            message: 'セッションが見つかりません',
            timestamp: new Date().toISOString()
          }
        });
      }

      const sessionData = result.rows[0];

      // セッション有効性チェック
      const isExpired = this.isSessionExpired(sessionData.created_at);
      const isActive = sessionData.status === 'active';

      if (!isActive || isExpired) {
        logger.warn('セッションが無効または期限切れ', { 
          sessionToken: sessionToken.substring(0, 8) + '...',
          status: sessionData.status,
          expired: isExpired
        });

        return res.json({
          success: true,
          data: {
            valid: false,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24時間後
          }
        });
      }

      // 有効なセッション
      const response: VerifySessionResponse = {
        valid: true,
        user: {
          sessionId: sessionData.session_id,
          phoneNumber: sessionData.phone_number,
          currentCarrier: sessionData.current_carrier,
          targetCarrier: sessionData.target_carrier,
          status: sessionData.status,
          preferences: JSON.parse(sessionData.preferences || '{}'),
          createdAt: new Date(sessionData.created_at),
          updatedAt: new Date(sessionData.updated_at)
        },
        session: {
          sessionToken: sessionData.session_token,
          mode: sessionData.mode,
          currentStep: sessionData.current_step,
          scenarioData: JSON.parse(sessionData.scenario_data || '{}'),
          contextData: JSON.parse(sessionData.context_data || '{}'),
          createdAt: new Date(sessionData.created_at),
          updatedAt: new Date(sessionData.updated_at)
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24時間後
      };

      logger.info('セッション検証完了', { 
        sessionToken: sessionToken.substring(0, 8) + '...',
        valid: true
      });

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      logger.error('セッション検証エラー', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: {
          error: 'SESSION_VERIFICATION_ERROR',
          code: 'INTERNAL_SERVER_ERROR',
          message: 'セッションの検証に失敗しました',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * セッション削除
   */
  deleteSession = async (req: AuthRequest, res: Response) => {
    try {
      const sessionToken = req.sessionToken || req.params.sessionToken;
      
      if (!sessionToken) {
        return res.status(400).json({
          success: false,
          error: {
            error: 'MISSING_SESSION_TOKEN',
            code: 'BAD_REQUEST',
            message: 'セッショントークンが必要です',
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.info('セッション削除開始', { sessionToken: sessionToken.substring(0, 8) + '...' });

      // セッション状態を完了に更新（物理削除はしない）
      const query = `
        UPDATE chat_sessions 
        SET completed_at = $1, updated_at = $2
        WHERE session_token = $3
        RETURNING id
      `;

      const result = await this.db.query(query, [new Date(), new Date(), sessionToken]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            error: 'SESSION_NOT_FOUND',
            code: 'NOT_FOUND',
            message: 'セッションが見つかりません',
            timestamp: new Date().toISOString()
          }
        });
      }

      // ユーザー状態も更新
      await this.db.query(
        'UPDATE users SET status = $1, updated_at = $2 WHERE session_id = $3',
        ['completed', new Date(), sessionToken]
      );

      // セッションログ記録
      await this.recordSessionLog(result.rows[0].id, 'session_deleted', {
        userAgent: req.get('User-Agent')
      }, req);

      logger.info('セッション削除完了', { sessionToken: sessionToken.substring(0, 8) + '...' });

      res.json({
        success: true,
        data: {
          message: 'セッションが正常に削除されました'
        }
      });

    } catch (error) {
      logger.error('セッション削除エラー', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: {
          error: 'SESSION_DELETION_ERROR',
          code: 'INTERNAL_SERVER_ERROR',
          message: 'セッションの削除に失敗しました',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * セッション更新
   */
  refreshSession = async (req: AuthRequest, res: Response) => {
    try {
      const sessionToken = req.sessionToken;
      
      if (!sessionToken) {
        return res.status(400).json({
          success: false,
          error: {
            error: 'MISSING_SESSION_TOKEN',
            code: 'BAD_REQUEST',
            message: 'セッショントークンが必要です',
            timestamp: new Date().toISOString()
          }
        });
      }

      // セッション更新時刻を更新
      const query = `
        UPDATE chat_sessions 
        SET updated_at = $1
        WHERE session_token = $2
        RETURNING *
      `;

      const result = await this.db.query(query, [new Date(), sessionToken]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            error: 'SESSION_NOT_FOUND',
            code: 'NOT_FOUND',
            message: 'セッションが見つかりません',
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.info('セッション更新完了', { sessionToken: sessionToken.substring(0, 8) + '...' });

      res.json({
        success: true,
        data: {
          message: 'セッションが正常に更新されました',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });

    } catch (error) {
      logger.error('セッション更新エラー', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: {
          error: 'SESSION_REFRESH_ERROR',
          code: 'INTERNAL_SERVER_ERROR',
          message: 'セッションの更新に失敗しました',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * セッショントークン生成
   */
  private generateSessionToken(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    const hash = bcrypt.hashSync(`${timestamp}-${random}`, 8);
    return `mnp_${timestamp}_${random}_${hash.replace(/[^a-zA-Z0-9]/g, '')}`.substring(0, 64);
  }

  /**
   * セッション期限チェック
   */
  private isSessionExpired(createdAt: Date): boolean {
    const now = new Date();
    const sessionAge = now.getTime() - new Date(createdAt).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24時間
    return sessionAge > maxAge;
  }

  /**
   * アナリティクスイベント記録
   */
  private async recordAnalyticsEvent(
    sessionId: string, 
    eventType: string, 
    eventData: any, 
    req: Request
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO analytics_events (id, session_id, event_type, event_data, user_agent, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      await this.db.query(query, [
        uuidv4(),
        sessionId,
        eventType,
        JSON.stringify(eventData),
        req.get('User-Agent'),
        req.ip,
        new Date()
      ]);
    } catch (error) {
      logger.error('アナリティクス記録エラー', { error: error.message });
    }
  }

  /**
   * セッションログ記録
   */
  private async recordSessionLog(
    sessionId: string, 
    action: string, 
    details: any, 
    req: Request
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO session_logs (id, session_id, action, details, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      await this.db.query(query, [
        uuidv4(),
        sessionId,
        action,
        JSON.stringify(details),
        req.ip,
        req.get('User-Agent'),
        new Date()
      ]);
    } catch (error) {
      logger.error('セッションログ記録エラー', { error: error.message });
    }
  }
}

export default AuthController;