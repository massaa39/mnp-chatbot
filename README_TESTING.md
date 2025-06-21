# MNP Chatbot - Testing Guide

このドキュメントは、MNP Chatbotアプリケーションのテスト実行方法とテスト構造について説明します。

## テスト構造

```
tests/
├── unit/                     # 単体テスト
│   ├── backend/             # バックエンド単体テスト
│   │   ├── controllers/     # コントローラーテスト
│   │   ├── services/        # サービスクラステスト
│   │   └── utils/           # ユーティリティ関数テスト
│   └── frontend/            # フロントエンド単体テスト
│       ├── components/      # コンポーネントテスト
│       ├── hooks/           # カスタムフックテスト
│       └── store/           # 状態管理テスト
├── integration/             # 統合テスト
│   ├── api/                # API統合テスト
│   ├── database/           # データベース統合テスト
│   └── external/           # 外部サービス統合テスト
├── e2e/                    # E2Eテスト
│   ├── chat_flow.test.ts   # チャットフロー全体のテスト
│   ├── escalation.test.ts  # エスカレーション機能のテスト
│   └── mobile_ui.test.ts   # モバイルUI/UXテスト
├── fixtures/               # テストデータ
│   ├── mock_responses.json # モックAPI応答
│   └── sample_conversations.json # サンプル会話データ
└── helpers/                # テストヘルパー
    ├── testSetup.ts        # テスト環境セットアップ
    ├── testUtils.ts        # テストユーティリティ
    ├── testApp.ts          # テスト用アプリケーション
    └── mockServices.ts     # サービスモック
```

## テスト実行方法

### 前提条件

```bash
# 依存関係のインストール
npm run install:all

# テスト用データベースの準備（必要に応じて）
npm run db:setup:test
```

### 全テスト実行

```bash
# 全てのテストを実行
npm test

# カバレッジレポート付きで実行
npm run test:coverage
```

### 個別テスト実行

```bash
# バックエンドテストのみ
npm run test:backend

# フロントエンドテストのみ  
npm run test:frontend

# 統合テストのみ
npm run test:integration

# E2Eテストのみ
npm run test:e2e
```

### ウォッチモード

```bash
# ファイル変更を監視してテストを自動実行
npm run test:watch
```

## テストカテゴリ

### 単体テスト (Unit Tests)

- **対象**: 個別の関数、クラス、コンポーネント
- **フレームワーク**: Jest (バックエンド), Vitest (フロントエンド)
- **モック**: 外部依存を完全にモック化
- **実行時間**: 高速 (< 10ms/テスト)

#### バックエンド単体テスト例

```typescript
// controllers/chatController.test.ts
describe('ChatController', () => {
  it('新しいセッションを正常に作成できる', async () => {
    const req = mockRequest({ body: { mode: 'step_by_step' } });
    const res = mockResponse();
    
    await chatController.createSession(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          sessionToken: expect.any(String)
        })
      })
    );
  });
});
```

#### フロントエンド単体テスト例

```typescript
// components/ChatScreen.test.tsx
describe('ChatScreen', () => {
  it('メッセージを正常に送信できる', async () => {
    render(<ChatScreen />);
    
    const input = screen.getByPlaceholderText('メッセージを入力...');
    const sendButton = screen.getByLabelText('メッセージを送信');
    
    fireEvent.change(input, { target: { value: 'テストメッセージ' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('テストメッセージ');
    });
  });
});
```

### 統合テスト (Integration Tests)

- **対象**: 複数のモジュール間の連携
- **フレームワーク**: Jest + Supertest
- **データベース**: テスト用DB使用
- **実行時間**: 中程度 (100ms-1s/テスト)

#### API統合テスト例

```typescript
// integration/api/chat.test.ts
describe('Chat API Integration', () => {
  it('メッセージ送信APIが正常に動作する', async () => {
    const response = await request(app)
      .post('/api/chat/message')
      .send({
        sessionToken: testSession.sessionToken,
        message: 'MNPの手続きについて教えてください'
      })
      .expect(200);
      
    expect(response.body.data.message).toMatch(/MNP|ポータビリティ/);
  });
});
```

### E2Eテスト (End-to-End Tests)

- **対象**: ユーザーシナリオ全体
- **フレームワーク**: Playwright
- **環境**: 実際のブラウザ環境
- **実行時間**: 長い (1s-10s/テスト)

#### E2Eテスト例

```typescript
// e2e/chat_flow.test.ts
describe('Chat Flow E2E', () => {
  test('完全なMNP相談フローが動作する', async ({ page }) => {
    await page.goto('/');
    
    // 新規セッション開始
    await page.click('[data-testid="start-chat"]');
    
    // メッセージ送信
    await page.fill('[data-testid="message-input"]', 'MNPについて教えて');
    await page.click('[data-testid="send-button"]');
    
    // AI応答を確認
    await expect(page.locator('[data-testid="ai-message"]').last())
      .toContainText('MNP');
  });
});
```

## テストデータ管理

### テストファクトリー

```typescript
// helpers/testSetup.ts
export const testDataFactory = {
  createUser: (overrides = {}) => ({
    id: 'test-user-id',
    phoneNumber: '09012345678',
    currentCarrier: 'docomo',
    targetCarrier: 'au',
    ...overrides
  }),
  
  createChatSession: (overrides = {}) => ({
    id: 'test-session-id',
    sessionToken: 'test-session-token',
    mode: 'step_by_step',
    ...overrides
  })
};
```

### モックサービス

```typescript
// helpers/mockServices.ts
export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'テスト用AI応答' } }],
        usage: { total_tokens: 150 }
      })
    }
  }
};
```

## カバレッジ要件

- **ライン**: 70%以上
- **関数**: 70%以上
- **ブランチ**: 70%以上
- **ステートメント**: 70%以上

### カバレッジレポート確認

```bash
npm run test:coverage
open coverage/index.html  # ブラウザでレポートを開く
```

## CI/CDでのテスト実行

### GitHub Actions設定例

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm run install:all
      
      - name: Run unit tests
        run: npm test
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          REDIS_URL: ${{ secrets.TEST_REDIS_URL }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## パフォーマンステスト

### ベンチマークテスト

```typescript
describe('Performance Tests', () => {
  it('AI応答生成が2秒以内に完了する', async () => {
    const { duration } = await benchmark.time(async () => {
      return await aiService.generateChatResponse(testRequest);
    });
    
    expect(duration).toBeLessThan(2000);
  });
});
```

### 負荷テスト

```bash
# Artillery.jsを使用した負荷テスト
npm run test:load
```

## デバッグ方法

### テストデバッグ

```bash
# 特定のテストファイルのみ実行
npm test -- chatController.test.ts

# テストを一時停止してデバッグ
npm test -- --detectOpenHandles --forceExit

# デバッグモードで実行
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

### ログ確認

```typescript
// テスト内でのログ確認
console.log = jest.fn(); // ログをキャプチャ
expect(console.log).toHaveBeenCalledWith(expectedMessage);
```

## ベストプラクティス

### 1. テスト命名規則

```typescript
describe('機能名', () => {
  describe('メソッド名', () => {
    it('正常系: 期待される動作を記述', () => {});
    it('異常系: エラーケースを記述', () => {});
  });
});
```

### 2. AAA パターン

```typescript
it('テストケース', () => {
  // Arrange: テストデータの準備
  const input = 'test input';
  
  // Act: 実際の処理実行
  const result = targetFunction(input);
  
  // Assert: 結果の検証
  expect(result).toBe('expected output');
});
```

### 3. モック使用方針

- 外部API: 常にモック
- データベース: 統合テストでは実DB、単体テストではモック
- ファイルシステム: モック推奨
- 時間関連: モック（一貫性のため）

### 4. 非同期テスト

```typescript
// Promise使用
it('非同期処理テスト', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// タイムアウト設定
it('長時間処理テスト', async () => {
  // 処理
}, 30000); // 30秒タイムアウト
```

## トラブルシューティング

### よくある問題

1. **テストタイムアウト**
   ```typescript
   // jest.config.js
   module.exports = {
     testTimeout: 30000 // 30秒に延長
   };
   ```

2. **メモリリーク**
   ```typescript
   afterEach(() => {
     jest.clearAllMocks();
     jest.clearAllTimers();
   });
   ```

3. **非同期処理の競合**
   ```typescript
   // waitFor を使用して処理完了を待機
   await waitFor(() => {
     expect(mockFunction).toHaveBeenCalled();
   });
   ```

## 追加リソース

- [Jest Documentation](https://jestjs.io/docs)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

## 質問・サポート

テストに関する質問は、開発チームまでお気軽にお問い合わせください。