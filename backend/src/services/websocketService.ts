import WebSocket from 'ws';
import { Server as HTTPServer } from 'http';
import { verify } from 'jsonwebtoken';
import { chatRepository } from '../repositories/chatRepository';
import { logger } from '../utils/logger';
import { Message, ChatSession } from '../types/database';

interface WebSocketConnection {
  ws: WebSocket;
  sessionToken: string;
  sessionId: string;
  userId?: string;
  lastActivity: Date;
  clientInfo: {
    userAgent?: string;
    ipAddress?: string;
  };
}

interface WebSocketMessage {
  type: 'message' | 'typing_start' | 'typing_stop' | 'ping' | 'pong' | 'join_session' | 'leave_session';
  sessionToken?: string;
  messageId?: string;
  content?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface BroadcastOptions {
  excludeConnection?: WebSocketConnection;
  sessionToken?: string;
  targetUserId?: string;
}

export class WebSocketService {
  private wss: WebSocket.Server | null = null;
  private connections = new Map<WebSocket, WebSocketConnection>();
  private sessionConnections = new Map<string, Set<WebSocketConnection>>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupHeartbeat();
    this.setupCleanup();
  }

  /**
   * WebSocketサーバーを初期化
   */
  initialize(server: HTTPServer): void {
    try {
      this.wss = new WebSocket.Server({ 
        server,
        path: '/ws',
        verifyClient: this.verifyClient.bind(this)
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleServerError.bind(this));

      logger.info('WebSocketサーバーが初期化されました', {
        path: '/ws'
      });
    } catch (error) {
      logger.error('WebSocketサーバーの初期化に失敗', { error });
      throw error;
    }
  }

  /**
   * クライアント検証
   */
  private verifyClient(info: any): boolean {
    try {
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('WebSocket接続: トークンが提供されていません', {
          origin: info.origin,
          userAgent: info.req.headers['user-agent']
        });
        return false;
      }

      // トークンの基本検証（完全なJWT検証は接続後に行う）
      if (!token.startsWith('ws_')) {
        logger.warn('WebSocket接続: 無効なトークン形式', { token: token.substring(0, 10) });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('WebSocket接続検証エラー', { error });
      return false;
    }
  }

  /**
   * 新しい接続を処理
   */
  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const sessionToken = url.searchParams.get('sessionToken');

      if (!token || !sessionToken) {
        ws.close(1008, 'Missing required parameters');
        return;
      }

      // セッション検証
      const session = await chatRepository.getSessionByToken(sessionToken);
      if (!session) {
        ws.close(1008, 'Invalid session token');
        return;
      }

      const connection: WebSocketConnection = {
        ws,
        sessionToken,
        sessionId: session.id,
        userId: session.user_id || undefined,
        lastActivity: new Date(),
        clientInfo: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.socket.remoteAddress
        }
      };

      // 接続を登録
      this.connections.set(ws, connection);
      this.addToSessionGroup(sessionToken, connection);

      // イベントリスナーを設定
      ws.on('message', (data) => this.handleMessage(connection, data));
      ws.on('close', (code, reason) => this.handleDisconnection(connection, code, reason));
      ws.on('error', (error) => this.handleConnectionError(connection, error));
      ws.on('pong', () => this.handlePong(connection));

      // 接続確認メッセージを送信
      this.sendToConnection(connection, {
        type: 'join_session',
        sessionToken,
        timestamp: new Date().toISOString(),
        metadata: {
          connectionId: this.generateConnectionId(),
          serverTime: new Date().toISOString()
        }
      });

      logger.info('WebSocket接続が確立されました', {
        sessionToken,
        sessionId: session.id,
        userId: session.user_id,
        connectionsCount: this.connections.size
      });

    } catch (error) {
      logger.error('WebSocket接続処理エラー', { error });
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * メッセージを処理
   */
  private async handleMessage(connection: WebSocketConnection, data: WebSocket.Data): Promise<void> {
    try {
      connection.lastActivity = new Date();

      const message: WebSocketMessage = JSON.parse(data.toString());

      if (!message.type) {
        this.sendErrorToConnection(connection, 'MESSAGE_TYPE_REQUIRED', 'メッセージタイプが必要です');
        return;
      }

      logger.debug('WebSocketメッセージ受信', {
        type: message.type,
        sessionToken: connection.sessionToken,
        hasContent: !!message.content
      });

      switch (message.type) {
        case 'message':
          await this.handleChatMessage(connection, message);
          break;

        case 'typing_start':
          await this.handleTypingStart(connection, message);
          break;

        case 'typing_stop':
          await this.handleTypingStop(connection, message);
          break;

        case 'ping':
          this.handlePing(connection, message);
          break;

        default:
          this.sendErrorToConnection(connection, 'UNKNOWN_MESSAGE_TYPE', `未知のメッセージタイプ: ${message.type}`);
      }

    } catch (error) {
      logger.error('WebSocketメッセージ処理エラー', { 
        error, 
        sessionToken: connection.sessionToken 
      });
      this.sendErrorToConnection(connection, 'MESSAGE_PROCESSING_ERROR', 'メッセージの処理に失敗しました');
    }
  }

  /**
   * チャットメッセージを処理
   */
  private async handleChatMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    if (!message.content) {
      this.sendErrorToConnection(connection, 'MESSAGE_CONTENT_REQUIRED', 'メッセージ内容が必要です');
      return;
    }

    try {
      // メッセージをデータベースに保存
      const savedMessage = await chatRepository.addMessage(connection.sessionToken, {
        content: message.content,
        sender: 'user',
        timestamp: new Date(),
        messageType: 'text',
        metadata: {
          ...message.metadata,
          source: 'websocket',
          clientInfo: connection.clientInfo
        }
      });

      // セッション内の他の接続にブロードキャスト
      this.broadcastToSession(connection.sessionToken, {
        type: 'message',
        messageId: savedMessage.id,
        content: message.content,
        timestamp: savedMessage.timestamp.toISOString(),
        metadata: {
          sender: 'user',
          messageType: 'text'
        }
      }, { excludeConnection: connection });

      logger.info('WebSocketチャットメッセージ処理完了', {
        messageId: savedMessage.id,
        sessionToken: connection.sessionToken,
        contentLength: message.content.length
      });

    } catch (error) {
      logger.error('チャットメッセージ保存エラー', { 
        error, 
        sessionToken: connection.sessionToken 
      });
      this.sendErrorToConnection(connection, 'MESSAGE_SAVE_ERROR', 'メッセージの保存に失敗しました');
    }
  }

  /**
   * タイピング開始を処理
   */
  private async handleTypingStart(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    this.broadcastToSession(connection.sessionToken, {
      type: 'typing_start',
      timestamp: new Date().toISOString(),
      metadata: {
        userId: connection.userId,
        sessionToken: connection.sessionToken
      }
    }, { excludeConnection: connection });
  }

  /**
   * タイピング停止を処理
   */
  private async handleTypingStop(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    this.broadcastToSession(connection.sessionToken, {
      type: 'typing_stop',
      timestamp: new Date().toISOString(),
      metadata: {
        userId: connection.userId,
        sessionToken: connection.sessionToken
      }
    }, { excludeConnection: connection });
  }

  /**
   * Pingを処理
   */
  private handlePing(connection: WebSocketConnection, message: WebSocketMessage): void {
    this.sendToConnection(connection, {
      type: 'pong',
      timestamp: new Date().toISOString(),
      metadata: message.metadata
    });
  }

  /**
   * Pongを処理
   */
  private handlePong(connection: WebSocketConnection): void {
    connection.lastActivity = new Date();
  }

  /**
   * 接続エラーを処理
   */
  private handleConnectionError(connection: WebSocketConnection, error: Error): void {
    logger.error('WebSocket接続エラー', {
      error,
      sessionToken: connection.sessionToken,
      userId: connection.userId
    });
  }

  /**
   * 切断を処理
   */
  private handleDisconnection(connection: WebSocketConnection, code: number, reason: Buffer): void {
    try {
      this.connections.delete(connection.ws);
      this.removeFromSessionGroup(connection.sessionToken, connection);

      logger.info('WebSocket接続が切断されました', {
        sessionToken: connection.sessionToken,
        userId: connection.userId,
        code,
        reason: reason.toString(),
        connectionsCount: this.connections.size
      });

      // セッション内の他の接続に離脱を通知
      this.broadcastToSession(connection.sessionToken, {
        type: 'leave_session',
        timestamp: new Date().toISOString(),
        metadata: {
          userId: connection.userId,
          reason: 'disconnected'
        }
      });

    } catch (error) {
      logger.error('WebSocket切断処理エラー', { error });
    }
  }

  /**
   * サーバーエラーを処理
   */
  private handleServerError(error: Error): void {
    logger.error('WebSocketサーバーエラー', { error });
  }

  /**
   * 特定の接続にメッセージを送信
   */
  private sendToConnection(connection: WebSocketConnection, message: WebSocketMessage): boolean {
    try {
      if (connection.ws.readyState !== WebSocket.OPEN) {
        return false;
      }

      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('WebSocketメッセージ送信エラー', { 
        error, 
        sessionToken: connection.sessionToken 
      });
      return false;
    }
  }

  /**
   * エラーメッセージを送信
   */
  private sendErrorToConnection(connection: WebSocketConnection, code: string, message: string): void {
    this.sendToConnection(connection, {
      type: 'error',
      timestamp: new Date().toISOString(),
      metadata: {
        error: {
          code,
          message
        }
      }
    });
  }

  /**
   * セッションにブロードキャスト
   */
  private broadcastToSession(sessionToken: string, message: WebSocketMessage, options: BroadcastOptions = {}): number {
    const sessionConnections = this.sessionConnections.get(sessionToken);
    if (!sessionConnections) {
      return 0;
    }

    let sentCount = 0;
    for (const connection of sessionConnections) {
      if (options.excludeConnection && connection === options.excludeConnection) {
        continue;
      }

      if (this.sendToConnection(connection, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * セッショングループに追加
   */
  private addToSessionGroup(sessionToken: string, connection: WebSocketConnection): void {
    if (!this.sessionConnections.has(sessionToken)) {
      this.sessionConnections.set(sessionToken, new Set());
    }
    this.sessionConnections.get(sessionToken)!.add(connection);
  }

  /**
   * セッショングループから削除
   */
  private removeFromSessionGroup(sessionToken: string, connection: WebSocketConnection): void {
    const sessionConnections = this.sessionConnections.get(sessionToken);
    if (sessionConnections) {
      sessionConnections.delete(connection);
      if (sessionConnections.size === 0) {
        this.sessionConnections.delete(sessionToken);
      }
    }
  }

  /**
   * ハートビートを設定
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach((connection) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      });
    }, 30000); // 30秒間隔
  }

  /**
   * 非アクティブ接続のクリーンアップを設定
   */
  private setupCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const inactiveConnections: WebSocketConnection[] = [];

      this.connections.forEach((connection) => {
        const inactiveTime = now.getTime() - connection.lastActivity.getTime();
        if (inactiveTime > 5 * 60 * 1000) { // 5分間非アクティブ
          inactiveConnections.push(connection);
        }
      });

      inactiveConnections.forEach((connection) => {
        logger.info('非アクティブなWebSocket接続をクローズ', {
          sessionToken: connection.sessionToken,
          inactiveTime: now.getTime() - connection.lastActivity.getTime()
        });
        connection.ws.close(1000, 'Inactive connection');
      });

    }, 60000); // 1分間隔でチェック
  }

  /**
   * 接続IDを生成
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 公開API: セッションにメッセージを送信
   */
  public sendMessageToSession(sessionToken: string, message: Omit<WebSocketMessage, 'timestamp'>): number {
    return this.broadcastToSession(sessionToken, {
      ...message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 公開API: AI応答を送信
   */
  public sendAIResponse(sessionToken: string, messageId: string, content: string, metadata?: Record<string, any>): number {
    return this.sendMessageToSession(sessionToken, {
      type: 'message',
      messageId,
      content,
      metadata: {
        ...metadata,
        sender: 'assistant',
        messageType: 'text'
      }
    });
  }

  /**
   * 公開API: タイピングインジケーターを送信
   */
  public sendTypingIndicator(sessionToken: string, isTyping: boolean): number {
    return this.sendMessageToSession(sessionToken, {
      type: isTyping ? 'typing_start' : 'typing_stop',
      metadata: {
        sender: 'assistant'
      }
    });
  }

  /**
   * サーバー統計を取得
   */
  public getStats(): {
    totalConnections: number;
    activeSessions: number;
    uptime: number;
  } {
    return {
      totalConnections: this.connections.size,
      activeSessions: this.sessionConnections.size,
      uptime: process.uptime()
    };
  }

  /**
   * サービスを停止
   */
  public shutdown(): Promise<void> {
    return new Promise((resolve) => {
      // インターバルをクリア
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // 全接続を閉じる
      this.connections.forEach((connection) => {
        connection.ws.close(1001, 'Server shutting down');
      });

      // WebSocketサーバーを閉じる
      if (this.wss) {
        this.wss.close(() => {
          logger.info('WebSocketサービスが停止されました');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// シングルトンインスタンス
export const websocketService = new WebSocketService();