# <�SIM MNP����������� �������

## =� ��

<�SIM�m�MNP����������ȷ���n,j���������K��z��K�,j��~g���j�����ՒsWO�

## <� ���

### ��.%

| �� | ( | URL� | ����;� |
|------|------|-------|-------------|
| **�z (Development)** | ��z���ð | http://localhost:3000 | �B |
| **����� (Staging)** | ƹ��< | https://staging.mnp-chatbot.example.com | �PR |
| **,j (Production)** | �������Q | https://mnp-chatbot.example.com | �1�� |

### �����

####  ��
- **CPU**: 2 cores�

- **���**: 4GB�

- **�����**: 50GB�

- **������**: 1Gbps�


#### �h��,j��	
- **CPU**: 4 cores�

- **���**: 8GB�

- **�����**: 100GB�
SSD�h	
- **������**: 10Gbps�


## =3 Docker �(W_����

### 1. �M��

```bash
# 1. �ݸ�����
git clone https://github.com/your-org/mnp-chatbot.git
cd mnp-chatbot

# 2. ��	p-�
cp .env.template .env
# .envա������n��	p������g	

# 3. Docker������\
docker network create mnp-chatbot-network
```

### 2. ��	p-�

```bash
# .env ա��n-��
NODE_ENV=production
PORT=3001

# ������-�
DATABASE_URL=postgresql://mnp_user:secure_password@postgres:5432/mnp_chatbot
POSTGRES_DB=mnp_chatbot
POSTGRES_USER=mnp_user
POSTGRES_PASSWORD=secure_password

# Redis-�
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=redis_secure_password

# OpenAI API-�
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-ada-002

# ����ƣ-�
JWT_SECRET=your-jwt-secret-256-bit-key
SESSION_SECRET=your-session-secret-key
ENCRYPTION_KEY=your-encryption-key-32-chars

# CORS-�
CORS_ORIGIN=https://mnp-chatbot.example.com,https://app.mnp-chatbot.example.com

# ���6P-�
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ��-�
LOG_LEVEL=info
LOG_FILE_PATH=/app/logs

# ��ӹ-�
LINE_CHANNEL_ACCESS_TOKEN=your-line-bot-token
LINE_WEBHOOK_URL=https://api.line.me/v2/bot/message/push

# �-�
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
```

### 3. Docker Compose ����

```bash
# ,j��(docker-compose-�
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  # ��������
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/prod:/etc/nginx/conf.d
      - ./ssl:/etc/ssl
    depends_on:
      - backend
      - frontend
    networks:
      - mnp-chatbot-network

  # PostgreSQL ������
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
      - ./database/migrations:/docker-entrypoint-initdb.d/migrations
    ports:
      - "5432:5432"
    networks:
      - mnp-chatbot-network
    restart: unless-stopped

  # Redis ��÷�
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - mnp-chatbot-network
    restart: unless-stopped

  # �ï���API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - ./logs:/app/logs
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    networks:
      - mnp-chatbot-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ���Ȩ��
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      REACT_APP_API_URL: https://api.mnp-chatbot.example.com
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - mnp-chatbot-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  mnp-chatbot-network:
    driver: bridge
EOF

# �����L
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Nginx -�

```nginx
# nginx/prod/default.conf
upstream backend {
    server backend:3001;
}

upstream frontend {
    server frontend:3000;
}

# HTTP to HTTPS �����
server {
    listen 80;
    server_name mnp-chatbot.example.com api.mnp-chatbot.example.com;
    return 301 https://$server_name$request_uri;
}

# ���Ȩ��
server {
    listen 443 ssl http2;
    server_name mnp-chatbot.example.com;

    ssl_certificate /etc/ssl/mnp-chatbot.crt;
    ssl_certificate_key /etc/ssl/mnp-chatbot.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;

    # ����ƣ����
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# �ï���API
server {
    listen 443 ssl http2;
    server_name api.mnp-chatbot.example.com;

    ssl_certificate /etc/ssl/mnp-chatbot.crt;
    ssl_certificate_key /etc/ssl/mnp-chatbot.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # ���6P
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # ��ࢦ�-�
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # ����ï
    location /health {
        proxy_pass http://backend/health;
        access_log off;
    }
}
```

## 8 Kubernetes ����

### 1. Kubernetes ��է��

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mnp-chatbot

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mnp-chatbot-config
  namespace: mnp-chatbot
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  CORS_ORIGIN: "https://mnp-chatbot.example.com"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mnp-chatbot-secrets
  namespace: mnp-chatbot
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  OPENAI_API_KEY: <base64-encoded-openai-key>
  JWT_SECRET: <base64-encoded-jwt-secret>

---
# k8s/postgres.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: mnp-chatbot
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: "mnp_chatbot"
        - name: POSTGRES_USER
          value: "mnp_user"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mnp-chatbot-secrets
              key: POSTGRES_PASSWORD
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc

---
# k8s/backend.yaml
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
        image: mnp-chatbot-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: mnp-chatbot-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: mnp-chatbot-secrets
              key: DATABASE_URL
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: mnp-chatbot-secrets
              key: OPENAI_API_KEY
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mnp-chatbot-backend-service
  namespace: mnp-chatbot
spec:
  selector:
    app: mnp-chatbot-backend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3001
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
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - mnp-chatbot.example.com
    - api.mnp-chatbot.example.com
    secretName: mnp-chatbot-tls
  rules:
  - host: api.mnp-chatbot.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mnp-chatbot-backend-service
            port:
              number: 80
```

### 2. Kubernetes �����L

```bash
# 1. Secretn\�Mkbase64����LŁ	
echo -n "your-database-url" | base64
echo -n "your-openai-key" | base64
echo -n "your-jwt-secret" | base64

# 2. ��է��i(
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# 3. ��������
kubectl get pods -n mnp-chatbot
kubectl get services -n mnp-chatbot
kubectl logs -f deployment/mnp-chatbot-backend -n mnp-chatbot
```

## = CI/CD Ѥ���

### GitHub Actions ������

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

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
      run: |
        npm ci
        cd backend && npm ci
        cd ../frontend && npm ci
    
    - name: Run tests
      run: |
        npm run lint
        npm run test:coverage
        npm run build
    
    - name: Security audit
      run: npm audit --audit-level=high

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Login to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push Backend
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:${{ github.sha }}
    
    - name: Build and push Frontend
      uses: docker/build-push-action@v4
      with:
        context: ./frontend
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.27.0'
    
    - name: Configure kubectl
      run: |
        echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
    
    - name: Deploy to Kubernetes
      run: |
        export KUBECONFIG=kubeconfig
        kubectl set image deployment/mnp-chatbot-backend \
          backend=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:${{ github.sha }} \
          -n mnp-chatbot
        kubectl rollout status deployment/mnp-chatbot-backend -n mnp-chatbot
    
    - name: Run smoke tests
      run: |
        # ,j��n����ï
        curl -f https://api.mnp-chatbot.example.com/health
```

## =� ����-�

### Prometheus + Grafana

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mnp-chatbot-api'
    static_configs:
      - targets: ['backend:3001']
    scrape_interval: 30s
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### ����-�

```yaml
# monitoring/alert_rules.yml
groups:
- name: mnp-chatbot
  rules:
  - alert: HighErrorRate
    expr: rate(api_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "�D������"
      description: "{{ $value }}% nꯨ��L���gY"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(api_response_time_seconds_bucket[5m])) > 3
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "�TB�LED"
      description: "95%ilen�TB�L {{ $value }}�gY"

  - alert: DatabaseDown
    expr: pg_up == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "�����������"
      description: "PostgreSQLk��gM~[�"
```

## =' ,jK(K

### ����M��ï��

- [ ] ��	pn-���
- [ ] SSL<�n	�'��
- [ ] �������ï���֗
- [ ] ����ƣ����L
- [ ] �թ���ƹȟL
- [ ] ����󰰃gn�\��

### ���������K

```bash
# 1. �WD����n���
docker build -t mnp-chatbot-backend:v1.1.0 ./backend

# 2. ����n�÷�
docker push ghcr.io/your-org/mnp-chatbot-backend:v1.1.0

# 3. Kubernetes���������
kubectl set image deployment/mnp-chatbot-backend \
  backend=ghcr.io/your-org/mnp-chatbot-backend:v1.1.0 \
  -n mnp-chatbot

# 4. ��������ȶ���
kubectl rollout status deployment/mnp-chatbot-backend -n mnp-chatbot

# 5. OLLB�4n����ï
kubectl rollout undo deployment/mnp-chatbot-backend -n mnp-chatbot
```

### ���գï�K

```bash
# �%BnK
# 1. ���գï�����\
git checkout -b hotfix/critical-bug-fix

# 2. �c�ƹ�
# ... ����c ...

# 3. �%����
git push origin hotfix/critical-bug-fix
# CI/CDѤ���g������

# 4. ,j����
curl -f https://api.mnp-chatbot.example.com/health

# 5. ������k���
git checkout main
git merge hotfix/critical-bug-fix
```

## = ����ƣ-�

### SSL/TLS<�-�

```bash
# Let's Encrypt <�֗
certbot certonly --webroot \
  -w /var/www/html \
  -d mnp-chatbot.example.com \
  -d api.mnp-chatbot.example.com

# <�����-�
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

### ա������-�

```bash
# UFW ա������-�
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 5432/tcp   # PostgreSQL袯���b	
ufw deny 6379/tcp   # Redis袯���b	
ufw enable
```

## =� �թ��� i

### ������ i

```sql
-- ��L�����
-- 1. q�1��
ANALYZE;

-- 2. ���ï����
REINDEX DATABASE mnp_chatbot;

-- 3. ����������
DELETE FROM messages WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM chat_sessions WHERE expires_at < NOW() - INTERVAL '7 days';

-- 4. VACUUM�L
VACUUM ANALYZE;
```

### Redis  i

```bash
# Redis-��t
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET save "900 1 300 10 60 1000"
```

## <� ������ƣ�

###  ,�jOLh�z��

#### 1. �����������
```bash
# ���
kubectl logs deployment/postgres -n mnp-chatbot
kubectl exec -it postgres-pod -n mnp-chatbot -- psql -U mnp_user -d mnp_chatbot

# ���
kubectl restart deployment/postgres -n mnp-chatbot
```

#### 2. API�TB�E�
```bash
# ��꯹��
curl https://api.mnp-chatbot.example.com/metrics

# ���(Ϻ�
kubectl top pods -n mnp-chatbot

# ������
kubectl scale deployment/mnp-chatbot-backend --replicas=5 -n mnp-chatbot
```

#### 3. SSL<����
```bash
# <�	�P��
openssl x509 -in /etc/ssl/mnp-chatbot.crt -text -noout | grep "Not After"

# <���
certbot renew --force-renewal
nginx -s reload
```

---

**�������**: 1.0.0  
** B��**: 2024t618�  
**\**: MNP Chatbot DevOps Team

Sn�������k�FShg<�SIM MNP����������ȷ�����hKd���k,j��k����gM~Y