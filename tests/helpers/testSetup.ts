/**
 * テスト環境セットアップ
 * Purpose: Jest テストの共通設定とモック
 */

import { jest } from '@jest/globals';

// 環境変数のモック設定
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/mnp_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.SESSION_SECRET = 'test-session-secret';

// グローバルモック設定
beforeAll(() => {
  // タイムゾーンを統一
  process.env.TZ = 'Asia/Tokyo';
  
  // console.logをモック（テスト出力をクリーンに）
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  // モックをリストア
  jest.restoreAllMocks();
});

// 各テストの前にモックをクリア
beforeEach(() => {
  jest.clearAllMocks();
});

// データベースモック
export const mockDatabase = {
  query: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  transaction: jest.fn(),
};

// Redisモック
export const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  flushall: jest.fn(),
};

// OpenAI APIモック
export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'テスト用のAI応答です。MNPに関するご質問にお答えします。'
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      })
    }
  },
  embeddings: {
    create: jest.fn().mockResolvedValue({
      data: [{
        embedding: Array(1536).fill(0.1) // テスト用ベクトル
      }]
    })
  }
};

// WebSocketモック
export const mockWebSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
};

// Express Request/Responseモック
export const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  ip: '127.0.0.1',
  user: null,
  session: {},
  ...overrides,
});

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

export const mockNext = jest.fn();

// テスト用データファクトリー
export const testDataFactory = {
  // ユーザーデータ
  createUser: (overrides = {}) => ({
    id: 'test-user-id',
    sessionId: 'test-session-id',
    phoneNumber: '09012345678',
    currentCarrier: 'docomo',
    targetCarrier: 'au',
    status: 'active',
    preferences: {},
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),

  // チャットセッションデータ
  createChatSession: (overrides = {}) => ({
    id: 'test-session-id',
    sessionToken: 'test-session-token',
    userId: 'test-user-id',
    mode: 'step_by_step',
    currentStep: 'initial',
    scenarioData: {},
    contextData: {},
    status: 'active',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24時間後
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),

  // メッセージデータ
  createMessage: (overrides = {}) => ({
    id: 'test-message-id',
    sessionId: 'test-session-id',
    messageType: 'user',
    content: 'テストメッセージです',
    metadata: {},
    embeddingVector: null,
    confidenceScore: 0.9,
    responseTimeMs: 150,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),

  // FAQデータ
  createFAQ: (overrides = {}) => ({
    id: 'test-faq-id',
    category: 'mnp_basic',
    subcategory: 'process',
    question: 'MNPの手続きについて教えてください',
    answer: 'MNPの手続きは以下の通りです...',
    keywords: ['MNP', '手続き', '番号移行'],
    priority: 1,
    carrierSpecific: null,
    isActive: true,
    version: 1,
    embeddingVector: Array(1536).fill(0.1),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),

  // APIレスポンスデータ
  createAPIResponse: (data: any, overrides = {}) => ({
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id',
      version: '1.0.0',
    },
    ...overrides,
  }),

  // エラーレスポンスデータ
  createErrorResponse: (code = 'TEST_ERROR', message = 'テストエラーです') => ({
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
  }),
};

// テスト用ヘルパー関数
export const testHelpers = {
  // 日付比較（秒単位）
  expectDateToBeCloseTo: (actual: Date, expected: Date, deltaSeconds = 5) => {
    const diff = Math.abs(actual.getTime() - expected.getTime()) / 1000;
    expect(diff).toBeLessThanOrEqual(deltaSeconds);
  },

  // 非同期関数のテスト
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // UUIDの検証
  expectToBeUUID: (value: string) => {
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  },

  // API応答の検証
  expectAPISuccess: (response: any, expectedData?: any) => {
    expect(response.success).toBe(true);
    expect(response.error).toBeUndefined();
    if (expectedData) {
      expect(response.data).toEqual(expectedData);
    }
  },

  expectAPIError: (response: any, expectedCode?: string) => {
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    if (expectedCode) {
      expect(response.error.code).toBe(expectedCode);
    }
  },
};

// データベース接続のクリーンアップ
export const cleanupDatabase = async () => {
  // テスト用データベースのクリーンアップ処理
  // 実際の実装では適切なクリーンアップ処理を実装
  if (mockDatabase.disconnect) {
    await mockDatabase.disconnect();
  }
};

// Redis接続のクリーンアップ
export const cleanupRedis = async () => {
  // テスト用Redisのクリーンアップ処理
  if (mockRedis.flushall) {
    await mockRedis.flushall();
  }
};

// テスト環境のセットアップ完了をログ出力
console.log('✅ Test environment setup completed');