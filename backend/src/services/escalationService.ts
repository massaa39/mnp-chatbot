import { v4 as uuidv4 } from 'uuid';
import { chatRepository } from '../repositories/chatRepository';
import { logger } from '../utils/logger';
import { DatabaseConnection } from '../config/database';
import type { EscalationPriority, EscalationStatus } from '../types/database';

interface EscalationData {
  sessionId: string;
  sessionToken: string;
  reason: string;
  priority: EscalationPriority;
  contactInfo?: {
    email?: string;
    phone?: string;
    preferredContact?: 'email' | 'phone' | 'chat';
  };
  context?: Record<string, any>;
}

interface EscalationResult {
  ticketId: string;
  status: EscalationStatus;
  estimatedWaitTime: number;
  assignedAgent?: string;
  priority: EscalationPriority;
  createdAt: Date;
  queuePosition?: number;
}

interface EscalationUpdateData {
  status?: EscalationStatus;
  assignedAgent?: string;
  notes?: string;
  estimatedWaitTime?: number;
  resolution?: string;
  feedback?: string;
  rating?: number;
}

interface EscalationListOptions {
  status?: EscalationStatus;
  priority?: EscalationPriority;
  assignedAgent?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
}

interface EscalationStats {
  totalEscalations: number;
  byStatus: Record<EscalationStatus, number>;
  byPriority: Record<EscalationPriority, number>;
  averageWaitTime: number;
  averageResolutionTime: number;
  satisfactionRating: number;
  activeAgents: number;
  queueLength: number;
}

export class EscalationService {
  private db: DatabaseConnection;
  private baseLineUrl: string = process.env.LINE_SUPPORT_URL || 'https://line.me/R/oaMessage/@mnpsupport';

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * エスカレーション開始
   */
  async initiateEscalation(data: EscalationData): Promise<EscalationResult> {
    try {
      logger.info('エスカレーション開始', { sessionToken: data.sessionToken });

      const ticketId = uuidv4();
      const estimatedWaitTime = await this.estimateWaitTime(data.priority);
      const queuePosition = await this.getCurrentQueuePosition();

      // エスカレーションチケット作成
      const query = `
        INSERT INTO escalation_tickets (
          id, session_id, reason, priority, status, contact_info, context,
          estimated_wait_time, queue_position, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const result = await this.db.query(query, [
        ticketId,
        data.sessionId,
        data.reason,
        data.priority,
        'pending' as EscalationStatus,
        JSON.stringify(data.contactInfo || {}),
        JSON.stringify(data.context || {}),
        estimatedWaitTime,
        queuePosition,
        new Date(),
        new Date()
      ]);

      const response: EscalationResult = {
        ticketId,
        status: 'pending' as EscalationStatus,
        estimatedWaitTime,
        priority: data.priority,
        createdAt: new Date(),
        queuePosition
      };

      logger.info('エスカレーション完了', { ticketId });
      return response;
    } catch (error) {
      logger.error('エスカレーション失敗', { error: error.message, sessionToken: data.sessionToken });
      throw error;
    }
  }

  /**
   * エスカレーション判定
   */
  async shouldEscalate(
    sessionToken: string, 
    lastResponse: string, 
    confidenceScore?: number,
    conversationHistory?: Message[]
  ): Promise<{ shouldEscalate: boolean; reason?: string; urgencyLevel?: 'low' | 'medium' | 'high' }> {
    try {
      // 低信頼度チェック
      if (confidenceScore !== undefined && confidenceScore < 0.3) {
        return {
          shouldEscalate: true,
          reason: 'AI回答の信頼度が低いため',
          urgencyLevel: 'medium'
        };
      }

      // 繰り返し質問チェック
      if (conversationHistory) {
        const repeatCount = this.countRepeatedQuestions(conversationHistory);
        if (repeatCount >= 3) {
          return {
            shouldEscalate: true,
            reason: '同じ質問が繰り返されているため',
            urgencyLevel: 'high'
          };
        }
      }

      // ネガティブセンチメントチェック
      const sentiment = await this.analyzeSentiment(lastResponse);
      if (sentiment === 'negative') {
        return {
          shouldEscalate: true,
          reason: '顧客の感情がネガティブなため',
          urgencyLevel: 'high'
        };
      }

      // セッション長時間チェック
      const sessionDuration = await this.getSessionDuration(sessionToken);
      if (sessionDuration > 1800) { // 30分以上
        return {
          shouldEscalate: true,
          reason: 'セッションが長時間継続しているため',
          urgencyLevel: 'medium'
        };
      }

      return { shouldEscalate: false };
    } catch (error) {
      logger.error('エスカレーション判定エラー', { error: error.message, sessionToken });
      return { shouldEscalate: false };
    }
  }

  /**
   * エスカレーション状況取得
   */
  async getEscalationStatus(sessionId: string): Promise<any | null> {
    try {
      const query = `
        SELECT * FROM escalation_tickets 
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const result = await this.db.query(query, [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ticketId: row.id,
        status: row.status,
        priority: row.priority,
        estimatedWaitTime: row.estimated_wait_time,
        assignedAgent: row.assigned_agent,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        queuePosition: row.queue_position
      };
    } catch (error) {
      logger.error('エスカレーション状況取得エラー', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * セッション情報取得
   */
  private async getSessionInfo(sessionToken: string): Promise<any> {
    const query = `
      SELECT cs.*, u.phone_number, u.current_carrier, u.target_carrier
      FROM chat_sessions cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.session_token = $1
    `;
    const result = await this.db.query(query, [sessionToken]);
    return result.rows[0] || null;
  }

  /**
   * エスカレーションチケット作成
   */
  private async createEscalationTicket(request: EscalationRequest, sessionInfo: any): Promise<EscalationTicket> {
    const ticketId = uuidv4();
    const ticketNumber = this.generateTicketNumber();
    
    const ticket: EscalationTicket = {
      id: ticketId,
      sessionId: sessionInfo.id,
      ticketNumber,
      reason: request.reason,
      urgencyLevel: request.urgencyLevel,
      status: 'pending',
      customerInfo: {
        ...request.customerInfo,
        phoneNumber: sessionInfo.phone_number
      },
      contextData: {
        ...request.contextData,
        sessionDuration: await this.getSessionDuration(request.sessionToken),
        previousAttempts: 0
      },
      estimatedWaitTime: await this.estimateWaitTime(request.urgencyLevel),
      lineUrl: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // データベースに保存
    const query = `
      INSERT INTO escalation_tickets (
        id, session_id, ticket_number, reason, urgency_level, status,
        customer_info, context_data, estimated_wait_time, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    await this.db.query(query, [
      ticket.id,
      ticket.sessionId,
      ticket.ticketNumber,
      ticket.reason,
      ticket.urgencyLevel,
      ticket.status,
      JSON.stringify(ticket.customerInfo),
      JSON.stringify(ticket.contextData),
      ticket.estimatedWaitTime,
      ticket.createdAt,
      ticket.updatedAt
    ]);

    return ticket;
  }

  /**
   * セッションステータス更新
   */
  private async updateSessionStatus(sessionToken: string, status: string, escalationReason: string): Promise<void> {
    const query = `
      UPDATE chat_sessions 
      SET escalation_reason = $1, escalated_at = $2, updated_at = $3
      WHERE session_token = $4
    `;
    
    await this.db.query(query, [escalationReason, new Date(), new Date(), sessionToken]);

    // ユーザーステータスも更新
    const userQuery = `
      UPDATE users 
      SET status = $1, updated_at = $2
      WHERE session_id = (
        SELECT session_token FROM chat_sessions WHERE session_token = $3
      )
    `;
    
    await this.db.query(userQuery, [status, new Date(), sessionToken]);
  }

  /**
   * LINE URL生成
   */
  private generateLineUrl(ticket: EscalationTicket): string {
    const params = new URLSearchParams({
      ticket: ticket.ticketNumber,
      urgency: ticket.urgencyLevel,
      category: this.categorizeByReason(ticket.reason)
    });

    return `${this.baseLineUrl}?${params.toString()}`;
  }

  /**
   * 待ち時間推定
   */
  private async estimateWaitTime(priority: EscalationPriority): Promise<number> {
    const baseWaitTimes = {
      urgent: 5,    // 5分
      high: 10,     // 10分
      medium: 20,   // 20分
      low: 30      // 30分
    };

    // 現在の待ち行列数を考慮
    const queueLength = await this.getCurrentQueueLength();
    const additionalWait = Math.floor(queueLength / 2) * 5; // 2件毎に5分追加
    
    return (baseWaitTimes[priority] || 20) + additionalWait;
  }

  /**
   * チケット番号生成
   */
  private generateTicketNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `MNP${timestamp}${random}`.toUpperCase();
  }

  /**
   * エスカレーションメッセージ生成
   */
  private generateEscalationMessage(urgencyLevel: string, waitTime: number): string {
    const messages = {
      high: `お急ぎの件として承りました。オペレーターが約${waitTime}分でご対応いたします。`,
      medium: `担当者にエスカレーションいたします。約${waitTime}分でご連絡いたします。`,
      low: `詳しい担当者におつなぎいたします。約${waitTime}分でご対応いたします。`
    };

    return messages[urgencyLevel] || messages.medium;
  }

  /**
   * 繰り返し質問カウント
   */
  private countRepeatedQuestions(conversation: Message[]): number {
    const userMessages = conversation
      .filter(msg => msg.messageType === 'user')
      .map(msg => msg.content.toLowerCase());

    let maxRepeats = 0;
    for (let i = 0; i < userMessages.length; i++) {
      let repeats = 1;
      for (let j = i + 1; j < userMessages.length; j++) {
        if (this.isSimilarQuestion(userMessages[i], userMessages[j])) {
          repeats++;
        }
      }
      maxRepeats = Math.max(maxRepeats, repeats);
    }

    return maxRepeats;
  }

  /**
   * 類似質問判定
   */
  private isSimilarQuestion(q1: string, q2: string): boolean {
    // 簡単な類似度判定（実際の実装ではより高度なアルゴリズムを使用）
    const similarity = this.calculateStringSimilarity(q1, q2);
    return similarity > 0.7;
  }

  /**
   * 文字列類似度計算
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    const distance = matrix[len2][len1];
    return 1 - distance / Math.max(len1, len2);
  }

  /**
   * センチメント分析
   */
  private async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    // 簡単なネガティブワード検出（実際の実装ではより高度なNLP処理）
    const negativeWords = ['困る', '分からない', '難しい', '問題', 'エラー', '失敗', '不安'];
    const lowerText = text.toLowerCase();
    
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (negativeCount >= 2) return 'negative';
    if (negativeCount === 1) return 'neutral';
    return 'positive';
  }

  /**
   * セッション継続時間取得
   */
  private async getSessionDuration(sessionToken: string): Promise<number> {
    const query = `
      SELECT created_at FROM chat_sessions WHERE session_token = $1
    `;
    const result = await this.db.query(query, [sessionToken]);
    
    if (result.rows.length === 0) return 0;
    
    const createdAt = new Date(result.rows[0].created_at);
    const now = new Date();
    return Math.floor((now.getTime() - createdAt.getTime()) / 1000); // 秒単位
  }

  /**
   * 理由別カテゴリ分類
   */
  private categorizeByReason(reason: string): string {
    const categories = {
      'AI回答の信頼度が低いため': 'technical',
      '同じ質問が繰り返されているため': 'general',
      '顧客の感情がネガティブなため': 'urgent',
      'セッションが長時間継続しているため': 'general'
    };

    return categories[reason] || 'general';
  }

  /**
   * エスカレーションルール初期化
   */
  private initializeEscalationRules(): EscalationRule[] {
    return [
      {
        trigger: 'low_confidence',
        threshold: 0.3,
        priority: 'medium',
        routeTo: 'technical'
      },
      {
        trigger: 'repeated_question',
        threshold: 3,
        priority: 'high',
        routeTo: 'general'
      },
      {
        trigger: 'negative_sentiment',
        priority: 'high',
        routeTo: 'urgent'
      },
      {
        trigger: 'manual_request',
        priority: 'medium',
        routeTo: 'general'
      },
      {
        trigger: 'timeout',
        threshold: 1800, // 30分
        priority: 'medium',
        routeTo: 'general'
      }
    ];
  }

  /**
   * データベース行をチケット型に変換
   */
  /**
   * エスカレーション更新
   */
  async updateEscalation(ticketId: string, updateData: EscalationUpdateData): Promise<any | null> {
    try {
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      if (updateData.status) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updateData.status);
      }
      if (updateData.assignedAgent) {
        setClauses.push(`assigned_agent = $${paramIndex++}`);
        values.push(updateData.assignedAgent);
      }
      if (updateData.notes) {
        setClauses.push(`notes = $${paramIndex++}`);
        values.push(updateData.notes);
      }
      if (updateData.estimatedWaitTime) {
        setClauses.push(`estimated_wait_time = $${paramIndex++}`);
        values.push(updateData.estimatedWaitTime);
      }

      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(ticketId);

      const query = `
        UPDATE escalation_tickets 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ticketId: row.id,
        status: row.status,
        priority: row.priority,
        assignedAgent: row.assigned_agent,
        estimatedWaitTime: row.estimated_wait_time,
        updatedAt: row.updated_at.toISOString()
      };
    } catch (error) {
      logger.error('エスカレーション更新エラー', { error: error.message, ticketId });
      throw error;
    }
  }

  /**
   * エスカレーション一覧取得
   */
  async getEscalations(options: EscalationListOptions): Promise<any[]> {
    try {
      const whereClauses = [];
      const values = [];
      let paramIndex = 1;

      if (options.status) {
        whereClauses.push(`status = $${paramIndex++}`);
        values.push(options.status);
      }
      if (options.priority) {
        whereClauses.push(`priority = $${paramIndex++}`);
        values.push(options.priority);
      }
      if (options.assignedAgent) {
        whereClauses.push(`assigned_agent = $${paramIndex++}`);
        values.push(options.assignedAgent);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const orderBy = options.orderBy || 'created_at DESC';
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      const query = `
        SELECT id, session_id, reason, priority, status, assigned_agent,
               estimated_wait_time, created_at, updated_at
        FROM escalation_tickets
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `;

      const result = await this.db.query(query, values);
      
      return result.rows.map(row => ({
        id: row.id,
        ticketId: row.id,
        sessionToken: row.session_id,
        reason: row.reason,
        priority: row.priority,
        status: row.status,
        assignedAgent: row.assigned_agent,
        estimatedWaitTime: row.estimated_wait_time,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }));
    } catch (error) {
      logger.error('エスカレーション一覧取得エラー', { error: error.message });
      throw error;
    }
  }

  /**
   * エスカレーション詳細取得
   */
  async getEscalationDetails(ticketId: string): Promise<any | null> {
    try {
      const query = `
        SELECT et.*, cs.user_id, u.phone_number
        FROM escalation_tickets et
        LEFT JOIN chat_sessions cs ON et.session_id = cs.id
        LEFT JOIN users u ON cs.user_id = u.id
        WHERE et.id = $1
      `;
      
      const result = await this.db.query(query, [ticketId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ticketId: row.id,
        sessionId: row.session_id,
        reason: row.reason,
        priority: row.priority,
        status: row.status,
        assignedAgent: row.assigned_agent,
        contactInfo: JSON.parse(row.contact_info || '{}'),
        context: JSON.parse(row.context || '{}'),
        estimatedWaitTime: row.estimated_wait_time,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        customerInfo: {
          phoneNumber: row.phone_number
        }
      };
    } catch (error) {
      logger.error('エスカレーション詳細取得エラー', { error: error.message, ticketId });
      throw error;
    }
  }

  /**
   * エスカレーション統計取得
   */
  async getEscalationStats(period: string): Promise<EscalationStats> {
    try {
      const days = this.parsePeriod(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 総数取得
      const totalQuery = `
        SELECT COUNT(*) as total FROM escalation_tickets
        WHERE created_at >= $1
      `;
      const totalResult = await this.db.query(totalQuery, [startDate]);
      const totalEscalations = parseInt(totalResult.rows[0].total);

      // ステータス別統計
      const statusQuery = `
        SELECT status, COUNT(*) as count FROM escalation_tickets
        WHERE created_at >= $1
        GROUP BY status
      `;
      const statusResult = await this.db.query(statusQuery, [startDate]);
      const byStatus = statusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<EscalationStatus, number>);

      // 優先度別統計
      const priorityQuery = `
        SELECT priority, COUNT(*) as count FROM escalation_tickets
        WHERE created_at >= $1
        GROUP BY priority
      `;
      const priorityResult = await this.db.query(priorityQuery, [startDate]);
      const byPriority = priorityResult.rows.reduce((acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      }, {} as Record<EscalationPriority, number>);

      // 平均待ち時間・解決時間（仮の値）
      const averageWaitTime = 15;
      const averageResolutionTime = 45;
      const satisfactionRating = 4.2;
      const activeAgents = 5;
      const queueLength = await this.getCurrentQueueLength();

      return {
        totalEscalations,
        byStatus,
        byPriority,
        averageWaitTime,
        averageResolutionTime,
        satisfactionRating,
        activeAgents,
        queueLength
      };
    } catch (error) {
      logger.error('エスカレーション統計取得エラー', { error: error.message });
      throw error;
    }
  }

  /**
   * エスカレーション終了
   */
  async resolveEscalation(ticketId: string, resolutionData: any): Promise<any | null> {
    try {
      const query = `
        UPDATE escalation_tickets 
        SET status = 'resolved', resolution = $1, feedback = $2, rating = $3, 
            resolved_at = $4, updated_at = $5
        WHERE id = $6
        RETURNING *
      `;

      const result = await this.db.query(query, [
        resolutionData.resolution,
        resolutionData.feedback,
        resolutionData.rating,
        resolutionData.resolvedAt,
        new Date(),
        ticketId
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ticketId: row.id,
        status: row.status,
        resolution: row.resolution,
        feedback: row.feedback,
        rating: row.rating,
        resolvedAt: row.resolved_at?.toISOString()
      };
    } catch (error) {
      logger.error('エスカレーション終了エラー', { error: error.message, ticketId });
      throw error;
    }
  }

  /**
   * 現在のキュー長取得
   */
  private async getCurrentQueueLength(): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count FROM escalation_tickets
        WHERE status IN ('pending', 'assigned')
      `;
      const result = await this.db.query(query);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('キュー長取得エラー', { error: error.message });
      return 0;
    }
  }

  /**
   * 現在のキューポジション取得
   */
  private async getCurrentQueuePosition(): Promise<number> {
    const queueLength = await this.getCurrentQueueLength();
    return queueLength + 1;
  }

  /**
   * 期間パース
   */
  private parsePeriod(period: string): number {
    const periodMap: Record<string, number> = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    return periodMap[period] || 7;
  }
}

export default EscalationService;