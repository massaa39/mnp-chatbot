# MNP Chatbot - デプロイメントガイド

このドキュメントは、MNP Chatbotアプリケーションの本番環境へのデプロイメント手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [環境設定](#環境設定)
3. [デプロイメント手順](#デプロイメント手順)
4. [Docker デプロイ](#docker-デプロイ)
5. [Kubernetes デプロイ](#kubernetes-デプロイ)
6. [CI/CD パイプライン](#cicd-パイプライン)
7. [監視・運用](#監視運用)
8. [トラブルシューティング](#トラブルシューティング)

## 前提条件

### システム要件

- **OS**: Ubuntu 20.04 LTS / Amazon Linux 2 / RHEL 8
- **Node.js**: v18.x 以上
- **PostgreSQL**: v14 以上
- **Redis**: v6 以上
- **Docker**: v20.10 以上 (Docker デプロイの場合)
- **Kubernetes**: v1.25 以上 (K8s デプロイの場合)

### 最小ハードウェア要件

```bash
# 本番環境 (推奨)
CPU: 4 vCPU
RAM: 8GB
Storage: 100GB SSD
Network: 1Gbps

# 開発/ステージング環境 (最小)
CPU: 2 vCPU
RAM: 4GB
Storage: 50GB SSD
Network: 100Mbps
```

### 外部依存サービス

- **OpenAI API**: GPT-4 アクセス権限
- **LINE Business API**: チャットボット連携用 (オプション)
- **CDN**: 静的ファイル配信 (推奨)
- **Load Balancer**: 負荷分散 (本番環境推奨)

## 環境設定

### 1. 本番環境変数設定

```bash
# 本番環境用 .env ファイルを作成
cp .env.template .env.production

# 必須環境変数を設定
cat << EOF > .env.production
# 環境
NODE_ENV=production
PORT=3000

# データベース
DATABASE_URL=postgresql://user:password@db-host:5432/mnp_chatbot
DATABASE_SSL=true
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis
REDIS_URL=redis://redis-host:6379
REDIS_PASSWORD=your-redis-password

# 認証・セキュリティ
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000

# CORS
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# レート制限
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
AUTH_RATE_LIMIT_MAX=5

# データ保護
MASK_PERSONAL_DATA=true
LOG_PERSONAL_DATA=false
DATA_RETENTION_DAYS=30
GDPR_COMPLIANCE=true

# SSL/HTTPS
SSL_CERT_PATH=/etc/ssl/certs/your-cert.pem
SSL_KEY_PATH=/etc/ssl/private/your-key.pem
HTTPS_PORT=443

# 監視
ENABLE_AUDIT_LOGS=true
LOG_LEVEL=info

# 外部サービス
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
LINE_CHANNEL_SECRET=your-line-secret
EOF
```

### 2. データベース準備

```bash
# PostgreSQL データベース作成
sudo -u postgres psql << EOF
CREATE DATABASE mnp_chatbot;
CREATE USER mnp_app WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE mnp_chatbot TO mnp_app;

-- 拡張機能のインストール
\c mnp_chatbot
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
EOF

# スキーマ適用
psql -h your-db-host -U mnp_app -d mnp_chatbot -f database/schema.sql

# シードデータ投入
psql -h your-db-host -U mnp_app -d mnp_chatbot -f database/seeds/mnp_faqs.sql
```

### 3. SSL証明書設定

```bash
# Let's Encrypt を使用した証明書取得
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 証明書の自動更新設定
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

## デプロイメント手順

### 1. 従来型デプロイ (PM2)

```bash
# 1. サーバーへの接続
ssh user@your-server

# 2. Node.js と依存関係のインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. PM2 のインストール
npm install -g pm2

# 4. アプリケーションのクローン
git clone https://github.com/yourusername/mnp-chatbot.git
cd mnp-chatbot

# 5. 依存関係のインストール
npm run install:all

# 6. 環境変数設定
cp .env.template .env
# .env ファイルを編集

# 7. ビルド
npm run build

# 8. PM2 設定ファイル作成
cat << EOF > ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'mnp-chatbot-backend',
      script: './backend/dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    }
  ]
};
EOF

# 9. PM2 でアプリケーション開始
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 10. Nginx 設定
sudo apt install nginx
sudo cat << EOF > /etc/nginx/sites-available/mnp-chatbot
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # フロントエンド静的ファイル
    location / {
        root /path/to/mnp-chatbot/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # キャッシュ設定
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API プロキシ
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket サポート
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/mnp-chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 2. 本番環境確認

```bash
# アプリケーション状態確認
pm2 status
pm2 logs

# サービス状態確認
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis

# ポート確認
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :443

# SSL証明書確認
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

## Docker デプロイ

### 1. Docker Compose 設定

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.production
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/mnp_chatbot
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.production
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - backend
    networks:
      - app-network

  postgres:
    image: postgres:14-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=mnp_chatbot
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./database/seeds:/docker-entrypoint-initdb.d/02-seeds
    networks:
      - app-network

  redis:
    image: redis:6-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - backend
      - frontend
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

### 2. Docker デプロイ実行

```bash
# 環境変数設定
export DB_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)

# Docker Compose でデプロイ
docker-compose -f docker-compose.production.yml up -d

# コンテナ状態確認
docker-compose -f docker-compose.production.yml ps
docker-compose -f docker-compose.production.yml logs -f

# ヘルスチェック
curl -f http://localhost/health || exit 1
```

## Kubernetes デプロイ

### 1. Kubernetes マニフェスト

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mnp-chatbot

---
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mnp-chatbot-secrets
  namespace: mnp-chatbot
type: Opaque
data:
  db-password: <base64-encoded-password>
  redis-password: <base64-encoded-password>
  jwt-secret: <base64-encoded-secret>
  openai-api-key: <base64-encoded-key>

---
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mnp-chatbot-backend
  namespace: mnp-chatbot
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mnp-chatbot-backend
  template:
    metadata:
      labels:
        app: mnp-chatbot-backend
    spec:
      containers:
      - name: backend
        image: your-registry/mnp-chatbot-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: mnp-chatbot-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: mnp-chatbot-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mnp-chatbot-frontend
  namespace: mnp-chatbot
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mnp-chatbot-frontend
  template:
    metadata:
      labels:
        app: mnp-chatbot-frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/mnp-chatbot-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"

---
# k8s/services.yaml
apiVersion: v1
kind: Service
metadata:
  name: mnp-chatbot-backend-service
  namespace: mnp-chatbot
spec:
  selector:
    app: mnp-chatbot-backend
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP

---
apiVersion: v1
kind: Service
metadata:
  name: mnp-chatbot-frontend-service
  namespace: mnp-chatbot
spec:
  selector:
    app: mnp-chatbot-frontend
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mnp-chatbot-ingress
  namespace: mnp-chatbot
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - yourdomain.com
    secretName: mnp-chatbot-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: mnp-chatbot-backend-service
            port:
              number: 3000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mnp-chatbot-frontend-service
            port:
              number: 80
```

### 2. Kubernetes デプロイ実行

```bash
# シークレット作成
kubectl create secret generic mnp-chatbot-secrets \
  --from-literal=db-password=$(openssl rand -base64 32) \
  --from-literal=redis-password=$(openssl rand -base64 32) \
  --from-literal=jwt-secret=$(openssl rand -base64 32) \
  --from-literal=openai-api-key=your-openai-key \
  --namespace=mnp-chatbot

# マニフェスト適用
kubectl apply -f k8s/

# デプロイ状況確認
kubectl get pods -n mnp-chatbot
kubectl get services -n mnp-chatbot
kubectl get ingress -n mnp-chatbot

# ログ確認
kubectl logs -f deployment/mnp-chatbot-backend -n mnp-chatbot
```

## CI/CD パイプライン

### GitHub Actions 設定

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm run install:all
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Run security audit
      run: npm audit --audit-level=high
    
    - name: Production readiness check
      run: ./scripts/production-readiness-check.sh

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm run install:all
    
    - name: Build applications
      run: npm run build
    
    - name: Build Docker images
      run: |
        docker build -t mnp-chatbot-backend:${{ github.sha }} ./backend
        docker build -t mnp-chatbot-frontend:${{ github.sha }} ./frontend
    
    - name: Push to registry
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push mnp-chatbot-backend:${{ github.sha }}
        docker push mnp-chatbot-frontend:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production
      run: |
        # デプロイスクリプトの実行
        ./scripts/deploy.sh ${{ github.sha }}
```

## 監視・運用

### 1. ヘルスチェック設定

```typescript
// backend/src/routes/health.ts
app.get('/health', async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      openai: await checkOpenAI(),
      diskSpace: await checkDiskSpace(),
      memory: process.memoryUsage(),
    }
  };
  
  res.status(200).json(healthCheck);
});
```

### 2. ログ監視

```bash
# ログ集約設定 (ELK Stack)
# Filebeat 設定
cat << EOF > /etc/filebeat/filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/mnp-chatbot/*.log
  fields:
    app: mnp-chatbot
    env: production

output.elasticsearch:
  hosts: ["elasticsearch:9200"]

setup.kibana:
  host: "kibana:5601"
EOF
```

### 3. メトリクス監視

```yaml
# Prometheus 設定
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mnp-chatbot'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### 4. アラート設定

```yaml
# AlertManager 設定
groups:
- name: mnp-chatbot
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    annotations:
      summary: "High error rate detected"
      
  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    annotations:
      summary: "Database is down"
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. データベース接続エラー

```bash
# 接続確認
psql -h your-db-host -U mnp_app -d mnp_chatbot -c "SELECT 1;"

# 接続プール設定確認
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

#### 2. Redis 接続エラー

```bash
# Redis 接続確認
redis-cli -h redis-host -p 6379 ping

# 認証確認
redis-cli -h redis-host -p 6379 -a your-password ping
```

#### 3. OpenAI API エラー

```bash
# API キー確認
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# レート制限確認
# ログでレート制限エラーを確認
```

#### 4. 高負荷時の対応

```bash
# PM2 スケールアウト
pm2 scale mnp-chatbot-backend +2

# CPU/メモリ使用量確認
pm2 monit

# データベース接続数確認
SELECT count(*) FROM pg_stat_activity;
```

### 5. SSL 証明書エラー

```bash
# 証明書確認
openssl x509 -in /etc/ssl/certs/your-cert.pem -text -noout

# 証明書更新
sudo certbot renew
sudo systemctl reload nginx
```

## ロールバック手順

```bash
# PM2 での前バージョンへのロールバック
pm2 stop mnp-chatbot-backend
git checkout previous-version-tag
npm run build
pm2 start mnp-chatbot-backend

# Docker でのロールバック
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --build

# Kubernetes でのロールバック
kubectl rollout undo deployment/mnp-chatbot-backend -n mnp-chatbot
kubectl rollout status deployment/mnp-chatbot-backend -n mnp-chatbot
```

## パフォーマンス最適化

### 1. データベース最適化

```sql
-- インデックス作成
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_faqs_keywords_gin ON faqs USING gin(keywords);

-- 統計情報更新
ANALYZE;
```

### 2. キャッシュ戦略

```typescript
// Redis キャッシュ実装
const cacheKey = `faq:${query}`;
const cachedResult = await redis.get(cacheKey);

if (cachedResult) {
  return JSON.parse(cachedResult);
}

const result = await searchFAQs(query);
await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

### 3. CDN 設定

```nginx
# 静的ファイルのキャッシュ設定
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Vary "Accept-Encoding";
}
```

## セキュリティ

本番環境でのセキュリティ設定については、[SECURITY.md](./SECURITY.md) を参照してください。

## サポート

デプロイメントに関する質問や問題は、以下の連絡先までお問い合わせください：

- 技術サポート: tech-support@company.com
- 緊急時対応: emergency@company.com