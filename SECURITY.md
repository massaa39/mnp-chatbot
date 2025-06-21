# MNP Chatbot - セキュリティガイド

このドキュメントは、MNP Chatbotアプリケーションのセキュリティ実装と設定について説明します。

## セキュリティ概要

MNP Chatbotは、顧客の機密情報（電話番号、キャリア情報等）を扱うため、包括的なセキュリティ対策を実装しています。

### セキュリティ原則

1. **多層防御**: 複数のセキュリティレイヤーでアプリケーションを保護
2. **最小権限**: 必要最小限のアクセス権限のみ付与
3. **データ保護**: 個人情報の暗号化とマスキング
4. **監査**: 全てのセキュリティイベントを記録
5. **準拠**: GDPR等のプライバシー規制に準拠

## 実装されているセキュリティ機能

### 1. 認証・認可

#### セッションベース認証
```typescript
// セッショントークンの生成・検証
export const generateSessionToken = (): string => {
  return `mnp_${uuidv4()}_${Date.now()}`;
};

export const verifySessionToken = async (sessionToken: string): Promise<{
  valid: boolean;
  user?: any;
  session?: any;
}>;
```

#### JWT認証（管理機能用）
```typescript
// JWTトークンの生成・検証
export const generateJWTToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, secret, {
    expiresIn: '24h',
    issuer: 'mnp-chatbot',
    audience: 'mnp-users',
  });
};
```

#### 権限管理
- `authenticateSession`: チャット用の軽量認証
- `authenticateJWT`: 管理機能用の厳格な認証
- `requireAdmin`: 管理者権限の確認
- `requireRole`: 特定の権限レベルの確認

### 2. セキュリティヘッダー

```typescript
// Helmet設定
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.openai.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
});
```

### 3. CORS設定

```typescript
export const corsConfig = cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN.split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});
```

### 4. レート制限

#### API レート制限
```typescript
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: (req) => req.user ? 200 : 100, // 認証済みユーザーは緩い制限
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'レート制限に達しました。',
    }
  },
});
```

#### 認証エンドポイント用の厳しい制限
```typescript
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 認証試行は5回まで
});
```

### 5. 入力検証

```typescript
export const validationRules = {
  message: body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .escape(),
    
  phoneNumber: body('phoneNumber')
    .optional()
    .matches(/^(070|080|090)[0-9]{8}$/),
    
  sessionToken: body('sessionToken')
    .isLength({ min: 10, max: 255 }),
};
```

### 6. データ保護

#### 個人情報のマスキング
```typescript
export const maskPhoneNumber = (phoneNumber: string): string => {
  const start = phoneNumber.substring(0, 3);
  const end = phoneNumber.substring(phoneNumber.length - 4);
  const middle = '*'.repeat(phoneNumber.length - 7);
  return `${start}-${middle}-${end}`;
};
```

#### データ暗号化
```typescript
export const encryptPersonalData = (data: string, key?: string): string => {
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};
```

### 7. CSRF保護

```typescript
export const csrfProtection = (req, res, next) => {
  const token = req.headers['x-csrf-token'];
  const sessionToken = req.headers['session-token'];
  
  const expectedToken = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(sessionToken)
    .digest('hex');
    
  if (token !== expectedToken) {
    return res.status(403).json({
      error: { code: 'CSRF_TOKEN_INVALID' }
    });
  }
  
  next();
};
```

### 8. SQL インジェクション対策

```typescript
export const sqlInjectionProtection = (req, res, next) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b)/i,
    /(--|\/\*|\*\/|;|'|")/,
  ];
  
  const checkForSQLInjection = (obj) => {
    // パターンマッチングでSQLインジェクションを検出
  };
  
  if (checkForSQLInjection(req.body)) {
    return res.status(400).json({
      error: { code: 'MALICIOUS_INPUT' }
    });
  }
};
```

### 9. フロントエンド セキュリティ

#### 入力サニタイゼーション
```typescript
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // HTMLタグの除去
    .replace(/javascript:/gi, '') // JavaScriptプロトコルの除去
    .trim();
};
```

#### セキュアストレージ
```typescript
export const secureStorage = {
  setItem: (key: string, value: any): void => {
    const encodedValue = btoa(JSON.stringify(value));
    localStorage.setItem(key, encodedValue);
  },
  
  getItem: <T>(key: string): T | null => {
    const encodedValue = localStorage.getItem(key);
    return encodedValue ? JSON.parse(atob(encodedValue)) : null;
  },
};
```

## 環境変数設定

### 必須セキュリティ設定

```bash
# 認証
JWT_SECRET=your-super-secure-jwt-secret-here
SESSION_SECRET=your-super-secure-session-secret-here

# 暗号化
ENCRYPTION_KEY=your-encryption-key-here

# CORS
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# レート制限
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# データ保護
MASK_PERSONAL_DATA=true
LOG_PERSONAL_DATA=false
DATA_RETENTION_DAYS=30

# ファイルアップロード
UPLOAD_MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,txt

# 監査・コンプライアンス
ENABLE_AUDIT_LOGS=true
GDPR_COMPLIANCE=true
```

### 本番環境での追加設定

```bash
NODE_ENV=production
ENABLE_DEBUG_LOGS=false

# 本番環境では強力なシークレットを使用
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
```

## セキュリティベストプラクティス

### 1. シークレット管理

- 本番環境では強力なランダムシークレットを使用
- 環境変数でシークレットを管理
- ソースコードにシークレットを含めない
- 定期的なシークレットローテーション

### 2. HTTPS の強制

```nginx
# Nginx設定例
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
}
```

### 3. データベースセキュリティ

```sql
-- 最小権限でのデータベースユーザー作成
CREATE USER 'mnp_app'@'localhost' IDENTIFIED BY 'strong_password';
GRANT SELECT, INSERT, UPDATE ON mnp_chatbot.* TO 'mnp_app'@'localhost';

-- 個人情報テーブルの暗号化
CREATE TABLE users (
    id UUID PRIMARY KEY,
    phone_number_encrypted VARCHAR(255),
    -- その他のフィールド
);
```

### 4. ログ管理

```typescript
// 個人情報を含まないログ出力
logger.info('User session created', {
  sessionId: session.id,
  mode: session.mode,
  // 電話番号は記録しない
});

// セキュリティイベントの記録
logger.warn('Authentication failed', {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  timestamp: new Date().toISOString(),
});
```

## セキュリティ監視

### 1. ヘルスチェック

```bash
# セキュリティ設定の検証
curl -X GET https://api.yourdomain.com/health/security

# レスポンス例
{
  "status": "healthy",
  "checks": [
    {
      "name": "Configuration Validation",
      "status": "pass"
    },
    {
      "name": "Environment Variable: JWT_SECRET",
      "status": "pass"
    }
  ]
}
```

### 2. セキュリティメトリクス

```typescript
export const getSecurityMetrics = () => ({
  rateLimitViolations: 0,
  authenticationFailures: 0,
  maliciousInputAttempts: 0,
  activeSessionCount: 150,
  lastSecurityScan: '2024-01-15T10:30:00Z',
});
```

### 3. インシデント対応

```typescript
export const recordSecurityIncident = (incident: {
  type: 'authentication_failure' | 'rate_limit_exceeded' | 'malicious_input';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ip?: string;
}) => {
  logger.warn('Security incident', incident);
  
  // 重大なインシデントの場合
  if (incident.severity === 'critical') {
    // アラート通知
    // IP制限
    // 管理者通知
  }
};
```

## プライバシー・GDPR準拠

### 1. 同意管理

```typescript
export const gdprConsentMiddleware = (req, res, next) => {
  const consentHeader = req.headers['x-privacy-consent'];
  
  if (privacyRoutes.includes(req.path) && !consentHeader) {
    return res.status(400).json({
      error: {
        code: 'PRIVACY_CONSENT_REQUIRED',
        message: 'プライバシーポリシーへの同意が必要です',
      }
    });
  }
  
  next();
};
```

### 2. データ保持期間

```typescript
export const checkDataRetention = async () => {
  const retentionDays = 30;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  // 古いデータの自動削除
  await db.query(
    'DELETE FROM messages WHERE created_at < $1',
    [cutoffDate]
  );
};
```

### 3. データ匿名化

```typescript
export const anonymizeData = (data: any): any => {
  const anonymized = { ...data };
  
  // 識別可能な情報を削除
  delete anonymized.phoneNumber;
  delete anonymized.email;
  delete anonymized.sessionId;
  
  return anonymized;
};
```

## セキュリティテスト

### 1. 脆弱性スキャン

```bash
# npm audit で依存関係の脆弱性チェック
npm audit

# セキュリティテストの実行
npm run test:security
```

### 2. ペネトレーションテスト

定期的な外部セキュリティ監査の実施を推奨します：

- SQLインジェクションテスト
- XSSテスト
- CSRF攻撃テスト
- 認証バイパステスト
- レート制限テスト

## インシデント対応手順

### 1. セキュリティインシデント発生時

1. **検出・報告**
   - 自動監視システムによる検出
   - ユーザーからの報告
   - 定期監査での発見

2. **初期対応**
   - インシデントの確認と分類
   - 影響範囲の特定
   - 緊急時の対応（サービス停止等）

3. **詳細調査**
   - ログ分析
   - 侵入経路の特定
   - 被害状況の把握

4. **復旧・対策**
   - 脆弱性の修正
   - システムの復旧
   - 再発防止策の実装

5. **事後対応**
   - インシデント報告書の作成
   - 関係者への報告
   - 改善策の検討

### 2. 緊急連絡先

- 開発チーム: dev-team@company.com
- セキュリティチーム: security@company.com
- 経営陣: management@company.com

## 今後の改善計画

1. **WAF（Web Application Firewall）の導入**
2. **侵入検知システム（IDS）の実装**
3. **ゼロトラスト・アーキテクチャの採用**
4. **定期的なセキュリティ監査の実施**
5. **セキュリティ意識向上のための社内研修**

## 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [GDPR Guidelines](https://gdpr.eu/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## サポート

セキュリティに関する質問や問題の報告は、security@company.com までご連絡ください。