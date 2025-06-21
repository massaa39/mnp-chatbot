import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { logger } from '../utils/logger';

interface WebSocketMessage {
  type: 'message' | 'typing_start' | 'typing_stop' | 'ping' | 'pong' | 'join_session' | 'leave_session' | 'error';
  sessionToken?: string;
  messageId?: string;
  content?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: Omit<WebSocketMessage, 'timestamp'>) => boolean;
  sendTypingStart: () => boolean;
  sendTypingStop: () => boolean;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    pingInterval = 30000
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const pingTimer = useRef<NodeJS.Timeout | null>(null);
  const wsToken = useRef<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const { sessionToken, addMessage, setTyping, updateConnectionStatus } = useChatStore();

  /**
   * WebSocketトークンを取得
   */
  const getWebSocketToken = useCallback(async (): Promise<string | null> => {
    if (!sessionToken) {
      logger.warn('WebSocket: セッショントークンが見つかりません');
      return null;
    }

    try {
      const response = await fetch(`/api/v1/sessions/${sessionToken}/ws-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`WebSocketトークン取得失敗: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'WebSocketトークン取得失敗');
      }

      return data.data.wsToken;
    } catch (err) {
      logger.error('WebSocketトークン取得エラー', { error: err });
      return null;
    }
  }, [sessionToken]);

  /**
   * WebSocket接続を確立
   */
  const connect = useCallback(async () => {
    if (ws.current?.readyState === WebSocket.OPEN || isConnecting) {
      return;
    }

    if (!sessionToken) {
      setError('セッショントークンが必要です');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // WebSocketトークンを取得
      const token = await getWebSocketToken();
      if (!token) {
        throw new Error('WebSocketトークンの取得に失敗しました');
      }

      wsToken.current = token;

      // WebSocket接続を確立
      const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:3001'}/ws?token=${token}&sessionToken=${sessionToken}`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttempts.current = 0;
        updateConnectionStatus('connected');

        // Pingタイマーを開始
        startPingTimer();

        logger.info('WebSocket接続が確立されました', { sessionToken });
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          handleIncomingMessage(message);
        } catch (err) {
          logger.error('WebSocketメッセージ解析エラー', { error: err, data: event.data });
        }
      };

      ws.current.onerror = (event) => {
        logger.error('WebSocketエラー', { event });
        setError('WebSocket接続エラーが発生しました');
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        updateConnectionStatus('disconnected');
        stopPingTimer();

        logger.info('WebSocket接続が閉じられました', { 
          code: event.code, 
          reason: event.reason,
          wasClean: event.wasClean
        });

        // 自動再接続
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          scheduleReconnect();
        }
      };

    } catch (err) {
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : 'WebSocket接続エラー');
      logger.error('WebSocket接続失敗', { error: err });
    }
  }, [sessionToken, getWebSocketToken, maxReconnectAttempts, updateConnectionStatus]);

  /**
   * 受信メッセージを処理
   */
  const handleIncomingMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'message':
        if (message.content && message.messageId) {
          addMessage({
            id: message.messageId,
            content: message.content,
            sender: message.metadata?.sender || 'assistant',
            messageType: message.metadata?.messageType || 'text',
            timestamp: new Date(message.timestamp || new Date()),
            metadata: message.metadata
          });
        }
        break;

      case 'typing_start':
        if (message.metadata?.sender === 'assistant') {
          setTyping(true);
        }
        break;

      case 'typing_stop':
        if (message.metadata?.sender === 'assistant') {
          setTyping(false);
        }
        break;

      case 'join_session':
        logger.info('WebSocketセッション参加確認', { sessionToken: message.sessionToken });
        break;

      case 'leave_session':
        logger.info('WebSocketセッション離脱通知', { metadata: message.metadata });
        break;

      case 'error':
        const errorMessage = message.metadata?.error?.message || 'WebSocketエラーが発生しました';
        setError(errorMessage);
        logger.error('WebSocketサーバーエラー', { error: message.metadata?.error });
        break;

      case 'pong':
        // Pong応答を受信（Pingの応答）
        logger.debug('WebSocket Pong受信');
        break;

      default:
        logger.warn('未知のWebSocketメッセージタイプ', { type: message.type, message });
    }
  }, [addMessage, setTyping]);

  /**
   * WebSocket切断
   */
  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    stopPingTimer();

    if (ws.current) {
      ws.current.close(1000, 'Client disconnect');
      ws.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
    updateConnectionStatus('disconnected');
  }, [updateConnectionStatus]);

  /**
   * 再接続をスケジュール
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }

    reconnectAttempts.current++;
    updateConnectionStatus('reconnecting');

    const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttempts.current - 1), 30000);

    logger.info('WebSocket再接続をスケジュール', { 
      attempt: reconnectAttempts.current,
      delay,
      maxAttempts: maxReconnectAttempts
    });

    reconnectTimer.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect, reconnectInterval, maxReconnectAttempts, updateConnectionStatus]);

  /**
   * 手動再接続
   */
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    setTimeout(() => connect(), 100);
  }, [disconnect, connect]);

  /**
   * Pingタイマーを開始
   */
  const startPingTimer = useCallback(() => {
    stopPingTimer();
    pingTimer.current = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping' });
      }
    }, pingInterval);
  }, [pingInterval]);

  /**
   * Pingタイマーを停止
   */
  const stopPingTimer = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
  }, []);

  /**
   * メッセージ送信
   */
  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp'>): boolean => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket: 接続が利用できません', { readyState: ws.current?.readyState });
      return false;
    }

    try {
      const messageWithTimestamp: WebSocketMessage = {
        ...message,
        timestamp: new Date().toISOString()
      };

      ws.current.send(JSON.stringify(messageWithTimestamp));
      return true;
    } catch (err) {
      logger.error('WebSocketメッセージ送信エラー', { error: err, message });
      return false;
    }
  }, []);

  /**
   * タイピング開始通知
   */
  const sendTypingStart = useCallback((): boolean => {
    return sendMessage({ type: 'typing_start' });
  }, [sendMessage]);

  /**
   * タイピング停止通知
   */
  const sendTypingStop = useCallback((): boolean => {
    return sendMessage({ type: 'typing_stop' });
  }, [sendMessage]);

  // セッショントークンが変更された場合は再接続
  useEffect(() => {
    if (sessionToken && autoConnect) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [sessionToken, autoConnect, connect, disconnect]);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      stopPingTimer();
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [stopPingTimer]);

  return {
    isConnected,
    isConnecting,
    error,
    lastMessage,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    connect,
    disconnect,
    reconnect
  };
};
