/**
 * テスト用Express アプリケーション作成
 */

import express, { Express } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// テスト環境用のミドルウェアとルーター
import { errorHandler } from '../../backend/src/middleware/errorHandler';
import { requestLogger } from '../../backend/src/middleware/requestLogger';
import { chatRouter } from '../../backend/src/routes/chatRoutes';
import { mockDatabase, mockRedis, mockOpenAI } from './testSetup';

/**
 * テスト用のExpressアプリケーションを作成
 */
export const createTestApp = async (): Promise<Express> => {
  const app = express();

  // 基本ミドルウェア
  app.use(helmet({
    contentSecurityPolicy: false, // テスト環境では無効
  }));
  app.use(compression());
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // レート制限（テスト用の緩い設定）
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1分
    max: 100, // 100リクエスト/分
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // リクエストログ（テスト環境では簡素化）
  app.use(requestLogger);

  // テスト用のヘルスチェックエンドポイント
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: 'test',
    });
  });

  // API ルーター
  app.use('/api/chat', chatRouter);

  // 404ハンドラー
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'リクエストされたリソースが見つかりません',
      },
    });
  });

  // エラーハンドラー
  app.use(errorHandler);

  return app;
};

/**
 * テスト用のWebSocketサーバーを作成
 */
export const createTestWebSocketServer = (app: Express) => {
  const server = createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // テスト用のWebSocketイベントハンドラー
  io.on('connection', (socket) => {
    console.log('Test WebSocket client connected:', socket.id);

    socket.on('join_session', (sessionToken: string) => {
      socket.join(`session_${sessionToken}`);
      socket.emit('session_joined', { sessionToken });
    });

    socket.on('chat_message', async (data) => {
      try {
        // テスト用の簡単な応答
        const response = {
          id: `msg_${Date.now()}`,
          type: 'ai',
          content: `テスト応答: ${data.message}`,
          timestamp: new Date().toISOString(),
        };

        socket.emit('chat_response', response);
        socket.to(`session_${data.sessionToken}`).emit('chat_response', response);
      } catch (error) {
        socket.emit('error', { message: 'メッセージ処理エラー' });
      }
    });

    socket.on('typing_start', (data) => {
      socket.to(`session_${data.sessionToken}`).emit('user_typing', {
        userId: data.userId,
        isTyping: true,
      });
    });

    socket.on('typing_stop', (data) => {
      socket.to(`session_${data.sessionToken}`).emit('user_typing', {
        userId: data.userId,
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      console.log('Test WebSocket client disconnected:', socket.id);
    });
  });

  return { server, io };
};

/**
 * テスト用のデータベース接続をセットアップ
 */
export const setupTestDatabase = async () => {
  // テスト用データベーススキーマの作成
  const schemas = [
    `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR(255) UNIQUE NOT NULL,
      phone_number VARCHAR(20),
      current_carrier VARCHAR(50),
      target_carrier VARCHAR(50),
      status VARCHAR(20) DEFAULT 'active',
      preferences JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_token VARCHAR(255) UNIQUE NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      mode VARCHAR(50) DEFAULT 'step_by_step',
      current_step VARCHAR(100) DEFAULT 'initial',
      scenario_data JSONB DEFAULT '{}',
      context_data JSONB DEFAULT '{}',
      status VARCHAR(20) DEFAULT 'active',
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
      message_type VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      embedding_vector VECTOR(1536),
      confidence_score DECIMAL(3,2),
      response_time_ms INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS faqs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category VARCHAR(100) NOT NULL,
      subcategory VARCHAR(100),
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      keywords TEXT[] DEFAULT '{}',
      priority INTEGER DEFAULT 1,
      carrier_specific VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      version INTEGER DEFAULT 1,
      embedding_vector VECTOR(1536),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS escalations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
      ticket_id VARCHAR(255) UNIQUE NOT NULL,
      reason TEXT NOT NULL,
      priority VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(20) DEFAULT 'pending',
      context_data JSONB DEFAULT '{}',
      assigned_operator_id VARCHAR(255),
      estimated_wait_time INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
  ];

  // モックデータベースでスキーマ作成をシミュレート
  for (const schema of schemas) {
    mockDatabase.query.mockResolvedValueOnce({ rows: [] });
  }

  console.log('✅ Test database schema created');
};

/**
 * テスト用のRedis接続をセットアップ
 */
export const setupTestRedis = async () => {
  // テスト用のRedis設定
  mockRedis.flushall.mockResolvedValue('OK');
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue('OK');
  mockRedis.del.mockResolvedValue(1);
  mockRedis.exists.mockResolvedValue(0);
  mockRedis.expire.mockResolvedValue(1);

  console.log('✅ Test Redis connection established');
};

/**
 * テスト用の外部サービス接続をセットアップ
 */
export const setupTestExternalServices = async () => {
  // OpenAI APIのモック設定
  mockOpenAI.chat.completions.create.mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          message: 'MNPに関するご質問ありがとうございます。詳しくご案内いたします。',
          suggestions: ['詳細を確認', 'ステップガイド', 'オペレーターに相談'],
          actions: [
            {
              type: 'button',
              label: '次のステップ',
              value: 'next_step'
            }
          ],
          needsEscalation: false
        })
      }
    }],
    usage: {
      prompt_tokens: 150,
      completion_tokens: 80,
      total_tokens: 230
    }
  });

  mockOpenAI.embeddings.create.mockResolvedValue({
    data: [{
      embedding: Array(1536).fill(0.1)
    }],
    usage: {
      total_tokens: 10
    }
  });

  console.log('✅ Test external services mocked');
};

/**
 * 統合テスト用の完全なアプリケーション環境を構築
 */
export const createIntegrationTestEnvironment = async () => {
  // データベースとRedisのセットアップ
  await setupTestDatabase();
  await setupTestRedis();
  await setupTestExternalServices();

  // Expressアプリケーションの作成
  const app = await createTestApp();

  // WebSocketサーバーの作成
  const { server, io } = createTestWebSocketServer(app);

  return {
    app,
    server,
    io,
    cleanup: async () => {
      await mockDatabase.disconnect();
      await mockRedis.flushall();
      server.close();
    },
  };
};

/**
 * パフォーマンステスト用のベンチマーク関数
 */
export const benchmark = {
  /**
   * 関数の実行時間を測定
   */
  time: async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // nanoseconds to milliseconds

    return { result, duration };
  },

  /**
   * メモリ使用量を測定
   */
  memory: (): NodeJS.MemoryUsage => {
    return process.memoryUsage();
  },

  /**
   * 複数回実行して平均パフォーマンスを測定
   */
  average: async <T>(
    fn: () => Promise<T>,
    iterations: number = 10
  ): Promise<{ avgDuration: number; minDuration: number; maxDuration: number }> => {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { duration } = await benchmark.time(fn);
      durations.push(duration);
    }

    return {
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
    };
  },
};