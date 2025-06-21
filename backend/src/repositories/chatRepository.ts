import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../config/database';
import { logger } from '../utils/logger';
import type { 
  ChatSession, 
  Message, 
  CreateChatSessionRequest,
  CreateMessageRequest,
  ChatSessionWithMessages,
  MessageFilter,
  PaginationOptions
} from '../types/database';

export class ChatRepository {
  private pool: Pool;

  constructor() {
    this.pool = DatabasePool.getInstance();
  }

  /**
   * チャットセッションを作成
   */
  async createSession(sessionData: CreateChatSessionRequest): Promise<ChatSession> {
    const client = await this.pool.connect();
    try {
      const sessionId = uuidv4();
      const query = `
        INSERT INTO chat_sessions (
          id, session_token, user_id, mode, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
      `;
      
      const values = [
        sessionId,
        sessionData.sessionToken,
        sessionData.userId || null,
        sessionData.mode || 'step_by_step'
      ];

      const result = await client.query(query, values);
      
      logger.info('チャットセッション作成', {
        sessionId,
        sessionToken: sessionData.sessionToken,
        mode: sessionData.mode
      });

      return result.rows[0];
    } catch (error) {
      logger.error('チャットセッション作成エラー', { error, sessionData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * セッショントークンでセッションを取得
   */
  async getSessionByToken(sessionToken: string): Promise<ChatSession | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM chat_sessions 
        WHERE session_token = $1 AND is_active = true
      `;
      
      const result = await client.query(query, [sessionToken]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('セッション取得エラー', { error, sessionToken });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * セッションを更新
   */
  async updateSession(sessionToken: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
    const client = await this.pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'session_token') {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });

      if (fields.length === 0) return null;

      fields.push('updated_at = NOW()');
      values.push(sessionToken);

      const query = `
        UPDATE chat_sessions 
        SET ${fields.join(', ')}
        WHERE session_token = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length > 0) {
        logger.info('セッション更新', {
          sessionToken,
          updates
        });
      }

      return result.rows[0] || null;
    } catch (error) {
      logger.error('セッション更新エラー', { error, sessionToken, updates });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * セッションを無効化
   */
  async deactivateSession(sessionToken: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE chat_sessions 
        SET is_active = false, updated_at = NOW()
        WHERE session_token = $1
      `;
      
      const result = await client.query(query, [sessionToken]);
      
      logger.info('セッション無効化', { sessionToken });
      return result.rowCount > 0;
    } catch (error) {
      logger.error('セッション無効化エラー', { error, sessionToken });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * メッセージを作成
   */
  async createMessage(messageData: CreateMessageRequest): Promise<Message> {
    const client = await this.pool.connect();
    try {
      const messageId = uuidv4();
      const query = `
        INSERT INTO messages (
          id, session_id, type, content, sender, metadata, 
          embedding_vector, confidence_score, response_time_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;
      
      const values = [
        messageId,
        messageData.sessionId,
        messageData.type,
        messageData.content,
        messageData.sender,
        messageData.metadata ? JSON.stringify(messageData.metadata) : null,
        messageData.embeddingVector || null,
        messageData.confidenceScore || null,
        messageData.responseTimeMs || null
      ];

      const result = await client.query(query, values);
      
      logger.info('メッセージ作成', {
        messageId,
        sessionId: messageData.sessionId,
        type: messageData.type,
        sender: messageData.sender,
        contentLength: messageData.content.length
      });

      return result.rows[0];
    } catch (error) {
      logger.error('メッセージ作成エラー', { error, messageData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * セッションのメッセージ履歴を取得
   */
  async getMessagesBySession(
    sessionToken: string, 
    options: PaginationOptions = {}
  ): Promise<Message[]> {
    const client = await this.pool.connect();
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      
      const query = `
        SELECT m.* FROM messages m
        JOIN chat_sessions cs ON m.session_id = cs.id
        WHERE cs.session_token = $1
        ORDER BY m.created_at ASC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await client.query(query, [sessionToken, limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('メッセージ履歴取得エラー', { error, sessionToken, options });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * セッションとメッセージを一括取得
   */
  async getSessionWithMessages(sessionToken: string): Promise<ChatSessionWithMessages | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // セッション取得
      const sessionQuery = `
        SELECT * FROM chat_sessions 
        WHERE session_token = $1 AND is_active = true
      `;
      const sessionResult = await client.query(sessionQuery, [sessionToken]);
      
      if (sessionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const session = sessionResult.rows[0];

      // メッセージ取得
      const messagesQuery = `
        SELECT * FROM messages 
        WHERE session_id = $1 
        ORDER BY created_at ASC
      `;
      const messagesResult = await client.query(messagesQuery, [session.id]);

      await client.query('COMMIT');

      return {
        ...session,
        messages: messagesResult.rows
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('セッション・メッセージ一括取得エラー', { error, sessionToken });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * メッセージを検索（フィルター対応）
   */
  async searchMessages(filter: MessageFilter, options: PaginationOptions = {}): Promise<Message[]> {
    const client = await this.pool.connect();
    try {
      const conditions: string[] = ['1=1'];
      const values: any[] = [];
      let paramCount = 0;

      if (filter.sessionId) {
        paramCount++;
        conditions.push(`session_id = $${paramCount}`);
        values.push(filter.sessionId);
      }

      if (filter.type) {
        paramCount++;
        conditions.push(`type = $${paramCount}`);
        values.push(filter.type);
      }

      if (filter.sender) {
        paramCount++;
        conditions.push(`sender = $${paramCount}`);
        values.push(filter.sender);
      }

      if (filter.searchText) {
        paramCount++;
        conditions.push(`content ILIKE $${paramCount}`);
        values.push(`%${filter.searchText}%`);
      }

      if (filter.dateFrom) {
        paramCount++;
        conditions.push(`created_at >= $${paramCount}`);
        values.push(filter.dateFrom);
      }

      if (filter.dateTo) {
        paramCount++;
        conditions.push(`created_at <= $${paramCount}`);
        values.push(filter.dateTo);
      }

      const limit = options.limit || 50;
      const offset = options.offset || 0;

      paramCount++;
      values.push(limit);
      paramCount++;
      values.push(offset);

      const query = `
        SELECT * FROM messages 
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await client.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('メッセージ検索エラー', { error, filter, options });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * セッション統計を取得
   */
  async getSessionStats(sessionToken: string): Promise<{
    messageCount: number;
    averageResponseTime: number;
    lastActivity: Date;
    userMessageCount: number;
    aiMessageCount: number;
  }> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          COUNT(*) as message_count,
          AVG(response_time_ms) as avg_response_time,
          MAX(created_at) as last_activity,
          COUNT(CASE WHEN sender = 'user' THEN 1 END) as user_message_count,
          COUNT(CASE WHEN sender = 'ai' THEN 1 END) as ai_message_count
        FROM messages m
        JOIN chat_sessions cs ON m.session_id = cs.id
        WHERE cs.session_token = $1
      `;

      const result = await client.query(query, [sessionToken]);
      const row = result.rows[0];

      return {
        messageCount: parseInt(row.message_count) || 0,
        averageResponseTime: parseFloat(row.avg_response_time) || 0,
        lastActivity: row.last_activity,
        userMessageCount: parseInt(row.user_message_count) || 0,
        aiMessageCount: parseInt(row.ai_message_count) || 0,
      };
    } catch (error) {
      logger.error('セッション統計取得エラー', { error, sessionToken });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 古いセッションをクリーンアップ
   */
  async cleanupOldSessions(daysOld: number = 30): Promise<number> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE chat_sessions 
        SET is_active = false, updated_at = NOW()
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
        AND is_active = true
      `;

      const result = await client.query(query);
      
      logger.info('古いセッションクリーンアップ', {
        daysOld,
        cleanedCount: result.rowCount
      });

      return result.rowCount || 0;
    } catch (error) {
      logger.error('セッションクリーンアップエラー', { error, daysOld });
      throw error;
    } finally {
      client.release();
    }
  }
}

export const chatRepository = new ChatRepository();