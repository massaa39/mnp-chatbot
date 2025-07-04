# <�SIM MNP����������� ����-�

## =� ��

�,n<�SIM�m�gnMNPMobile Number Portability	��H�/�Y�AI������ȷ���ns0-�})�Ф�mineoUQ�Ф�Y!mobileIIJmioIn<�SIM�mkyW_���ȒЛ

## <� ������Ư��

### hS�

```mermaid
graph TB
    User[����] --> LB[�������]
    LB --> FE[���Ȩ��<br/>React + TypeScript]
    FE --> API[�ï���API<br/>Node.js + Express]
    
    API --> DB[(PostgreSQL<br/>��������)]
    API --> Cache[(Redis<br/>�÷�����÷�)]
    API --> AI[OpenAI GPT-4<br/>AI�T]
    API --> Vector[Vector Search<br/>RAG"���]
    
    API --> Webhook[Webhook<br/>���������]
    Webhook --> LINE[LINE Bot<br/>������]
    
    Monitor[㖷���] --> API
    Monitor --> DB
    Monitor --> Cache
```

### ����

| ��� | �S��ï | �� |
|---------|-------------|------|
| **��������d** | React 18, TypeScript, Tailwind CSS | UI/UX�����\� |
| **APId** | Node.js, Express, TypeScript | RESTful API�<��� |
| **Ӹ͹��ïd** | ��ӹ��������� | m���ïAIq |
| **�������d** | Repository ѿ��SQL | ���8�" |
| **���d** | PostgreSQL, Redis | ����������÷� |
| **�#:d** | OpenAI API, LINE API | AI���ӹ#: |

## =� ������-

### ER�

```mermaid
erDiagram
    users ||--o{ chat_sessions : "1:N"
    chat_sessions ||--o{ messages : "1:N"
    faqs ||--o{ faq_embeddings : "1:N"
    escalations ||--|| chat_sessions : "1:1"
    
    users {
        uuid id PK
        varchar session_id UK
        varchar phone_number
        varchar current_carrier
        varchar target_carrier
        varchar status
        jsonb preferences
        timestamp created_at
        timestamp updated_at
    }
    
    chat_sessions {
        uuid id PK
        varchar session_token UK
        uuid user_id FK
        varchar mode
        varchar current_step
        jsonb scenario_data
        jsonb context_data
        varchar status
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
    }
    
    messages {
        uuid id PK
        uuid session_id FK
        varchar message_type
        text content
        jsonb metadata
        vector embedding_vector
        float confidence_score
        integer response_time_ms
        timestamp created_at
    }
    
    faqs {
        uuid id PK
        varchar category
        varchar subcategory
        text question
        text answer
        text[] keywords
        integer priority
        varchar carrier_specific
        boolean is_active
        integer version
        vector embedding_vector
        timestamp created_at
        timestamp updated_at
    }
    
    escalations {
        uuid id PK
        uuid session_id FK
        varchar reason
        varchar urgency_level
        jsonb customer_info
        jsonb context_data
        varchar status
        varchar ticket_number
        varchar line_url
        timestamp created_at
        timestamp resolved_at
    }
```

### ���ï�&e

```sql
-- �թ��� in_�n���ï�
-- ����"(
CREATE INDEX idx_users_session_id ON users(session_id);
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_status_created ON users(status, created_at);

-- �÷��(
CREATE INDEX idx_chat_sessions_token ON chat_sessions(session_token);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_expires ON chat_sessions(expires_at);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);

-- �û��"(
CREATE INDEX idx_messages_session_id_created ON messages(session_id, created_at DESC);
CREATE INDEX idx_messages_type_created ON messages(message_type, created_at DESC);

-- FAQ"(Vector Similarity Search	
CREATE INDEX idx_faqs_embedding_vector ON faqs USING ivfflat (embedding_vector vector_cosine_ops);
CREATE INDEX idx_faqs_category_active ON faqs(category, is_active);
CREATE INDEX idx_faqs_carrier_active ON faqs(carrier_specific, is_active);
CREATE INDEX idx_faqs_keywords_gin ON faqs USING gin(keywords);

-- ��������(
CREATE INDEX idx_escalations_session_id ON escalations(session_id);
CREATE INDEX idx_escalations_status_created ON escalations(status, created_at);
CREATE INDEX idx_escalations_urgency ON escalations(urgency_level);
```

## =' �������-

### �ï��� ���Ư��

```
backend/
   src/
      controllers/          # API���ݤ��6�
         chatController.ts      # ����_�
         sessionController.ts   # �÷��
         faqController.ts       # FAQ"
         escalationController.ts # ��������
   
      services/             # Ӹ͹��ïd
         aiService.ts           # OpenAI GPT-4#:
         ragService.ts          # RAG"���
         chatService.ts         # �����
         escalationService.ts   # ���������
         scenarioService.ts     # ��ꪡ
   
      repositories/         # �������d
         userRepository.ts      # �����
         chatRepository.ts      # ����et
         faqRepository.ts       # FAQ�
   
      middleware/           # q��릧�
         authentication.ts     # �<�
         security.ts           # ����ƣ
         validation.ts         # e�<
         rateLimit.ts          # ���6P
         errorHandler.ts       # ����
   
      models/              # ������
         User.ts               # �������
         ChatSession.ts        # �÷�����
         Message.ts            # �û�����
         FAQ.ts                # FAQ���
   
      config/              # -��
         database.ts           # DB��-�
         redis.ts              # Redis-�
         openai.ts             # OpenAI-�
         app.ts                # ���-�
   
      utils/               # ��ƣ�ƣ
          logger.ts             # ���
          encryption.ts         # ��
          validators.ts         # ������
          constants.ts          # �p��
```

### ���Ȩ�� ���Ư��

```
frontend/
   src/
      components/          # UI�������
         chat/                 # ���Ȣ#
            ChatMessage.tsx        # �û��h:
            ChatInput.tsx          # e�գ���
            ChatBubble.tsx         # �û�����
            QuickReply.tsx         # ��ï���
      
         common/               # q�������
            Button.tsx             # ܿ�
            Loading.tsx            # ��ǣ�
            ErrorBoundary.tsx      # ����L
      
         navigation/           # �Ӳ����
            TabBar.tsx             # ����
            SwipeNavigation.tsx    # ����\
      
         escalation/           # ��������
             EscalationButton.tsx   # ���������
             EscalationStatus.tsx   # �����h:
   
      hooks/               # �����ï
         useChat.ts            # ���ȶK�
         useWebSocket.ts       # WebSocket�
         useSwipeGesture.ts    # ��׸�����
   
      services/            # API�d
         chatApi.ts            # ����API
         authService.ts        # �<��ӹ
         escalationService.ts  # ��������
   
      store/               # �K�Zustand	
         chatStore.ts          # ���ȶK
         authStore.ts          # �<�K
         userStore.ts          # �����K
   
      types/               # TypeScript���
         api.ts                # API�
         chat.ts               # ���ȋ
         user.ts               # �����
   
      utils/               # ��ƣ�ƣ
          constants.ts          # �p
          helpers.ts            # �����p
          validation.ts         # �������
```

## > AI ����-

### RAGRetrieval-Augmented Generation	���Ư��

```mermaid
graph LR
    Query[�����O] --> Embed[���ǣ�]
    Embed --> Search[ٯ��"]
    Search --> FAQ[(FAQ ������)]
    FAQ --> Results["P�]
    Results --> Context[��ƭ����]
    Context --> GPT[GPT-4 ]
    GPT --> Response[AI�T]
```

### AI����

1. **�O��**: ����K�n�6 ��O
2. **���ǣ�**: OpenAI text-embedding-ada-002gٯ��
3. **^<�"**: PostgreSQL pgvectorg����^<�"
4. **��ƭ����**: "P�h�����D�[
5. **GPT-4**: ��ƭ�Ȓ+������g�T
6. **��**: �Tn�<������������

### ����Ȩ�ˢ��

```typescript
// <�SIMy�����������
const SYSTEM_PROMPT = `
Bj_o�,n<�SIM�m�nMNPj������ƣ	K�M��hY�����AIgY

## ��
- })�Ф�mineoUQ�Ф�Y!mobileIIJmioIn<�SIM�m
- MNP�j�֗K��~gn�h����
- iSIM�eSIMn-�K
- APN-�h������ƣ�

## �T�����
1. <�SIM�mnc�j�1nЛ
2. K�Mo���kK��YO�
3. �S�j���K��YD Ig
4. j�o �k��LŁh�T
5. �j���oMu�k��������h

## ��b
- !Tg�(�j�T
- Łk�Xf�a�M�����b
- �#Y�FAQ����H
- !k֋yM�����:
`;
```

## = ����ƣ-

### ����ƣ���

| ��� | �Ņ� | �S���� |
|---------|---------|-------------|
| **������** | HTTPS76CORS-� | Helmet.js, CORS middleware |
| **�<���** | �÷���������6P | JWT, Express Rate Limit |
| **e�<** | �<j��������˿������ | Express Validator, DOMPurify |
| **����w** | ����1޹�� | AES-256, bcrypt |
| **API����ƣ** | CSRF�wSQL injection�V | CSRF tokens, Parameterized queries |
| **����** | ������p8� | Winston, Morgan |

### �÷��

```typescript
// ���j�÷��
interface SecureSession {
  sessionToken: string;    // UUID v4
  userId: string;         // ������ID
  expiresAt: Date;        // 24B�	�P
  ipAddress: string;      // IP6P�׷��	
  userAgent: string;      // User-Agent<
  csrfToken: string;      // CSRF�w
}

// �÷��<��ï
const validateSession = async (token: string): Promise<boolean> => {
  // 1. ����b<
  // 2. Redis/DBK�֗
  // 3. 	�P��
  // 4. IP�User-Agent<
  // 5. CSRF ����
};
```

### �����

```typescript
// ��1��
const encryptPII = (data: string): string => {
  const algorithm = 'aes-256-gcm';
  const key = process.env.ENCRYPTION_KEY;
  // AES-256-GCM k����
};

// �qj�޹��
const maskPhoneNumber = (phone: string): string => {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};
```

## =� �թ���-

### ���B��

| ���ݤ�� | ��TB� | 95%ile |  '1�B� |
|---------------|-------------|--------|-------------|
| `/health` | < 100ms | < 200ms | 500ms |
| `/chat/sessions` | < 500ms | < 1s | 2s |
| `/chat/messages` | < 2s | < 3s | 5s |
| `/faq/search` | < 300ms | < 500ms | 1s |
| `/chat/history` | < 200ms | < 400ms | 1s |

### ��÷�&e

```typescript
// Redis ��÷�-
interface CacheStrategy {
  sessions: {
    ttl: 86400,        // 24B�
    pattern: 'session:*'
  },
  faqResults: {
    ttl: 3600,         // 1B�
    pattern: 'faq:*'
  },
  userPreferences: {
    ttl: 604800,       // 7�
    pattern: 'user:*'
  },
  aiResponses: {
    ttl: 1800,         // 30
    pattern: 'ai:*'
  }
}
```

### ������ i

```sql
-- ��ƣ�����û������	
CREATE TABLE messages_2024_06 PARTITION OF messages
  FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

-- ��jVACUUM�ANALYZE
VACUUM ANALYZE messages;
VACUUM ANALYZE faqs;

-- q�1��
UPDATE pg_stat_user_tables SET n_tup_ins = 0, n_tup_upd = 0, n_tup_del = 0;
```

## =� ������ƣ-

### 4s�����

```yaml
# Kubernetes ������ȋ
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mnp-chatbot-api
spec:
  replicas: 3              #  3���
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
      - name: api
        image: mnp-chatbot:latest
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
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
```

### ��ȹ����

```yaml
# HPA-�
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mnp-chatbot-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mnp-chatbot-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## =� ��K(-

### ��꯹��

```typescript
// Prometheus ��꯹
import { Counter, Histogram, Gauge } from 'prom-client';

const metrics = {
  // API|s�Wp
  apiCalls: new Counter({
    name: 'api_requests_total',
    help: 'Total API requests',
    labelNames: ['method', 'endpoint', 'status']
  }),
  
  // ���B�
  responseTime: new Histogram({
    name: 'api_response_time_seconds',
    help: 'API response time',
    labelNames: ['endpoint'],
    buckets: [0.1, 0.5, 1, 2, 5]
  }),
  
  // ��ƣֻ÷��p
  activeSessions: new Gauge({
    name: 'active_sessions_total',
    help: 'Total active sessions'
  }),
  
  // AI�TB�
  aiResponseTime: new Histogram({
    name: 'ai_response_time_seconds',
    help: 'AI response generation time',
    buckets: [1, 2, 3, 5, 10]
  })
};
```

### ��-

```typescript
// � ��
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'mnp-chatbot-api',
    version: process.env.APP_VERSION
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// �����-
// ERROR: ������API��
// WARN:  ���6P�<1W�թ���fJ
// INFO:  API|s�W�÷��\AI�T
// DEBUG: s0j��ð�1�z��n	
```

## = }�����m��

### �ï���&e

```bash
# �������ï�����L	
#!/bin/bash
pg_dump -h localhost -U mnp_user -d mnp_chatbot \
  --format=custom \
  --compress=9 \
  --file="/backups/mnp_chatbot_$(date +%Y%m%d_%H%M%S).backup"

# Redis AOF�ï���
redis-cli BGREWRITEAOF
cp /var/lib/redis/appendonly.aof "/backups/redis_$(date +%Y%m%d_%H%M%S).aof"
```

### ����K

1. **���**: Prometheus Alert Manager � PagerDuty
2. **��**: ����ï�����
3. **q���y�**: in_������kq�LB�K
4. **�%�n**: է�����������
5. **9,��**: ��y��cƹ�
6. **���**: ݹ�����9�HV�

## =� �z�K(����

### CI/CDѤ���

```yaml
# GitHub Actions ������
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run lint
    - run: npm run test:coverage
    - run: npm run build
    
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
    - run: docker build -t mnp-chatbot:${{ github.sha }} .
    - run: kubectl set image deployment/mnp-chatbot api=mnp-chatbot:${{ github.sha }}
```

### �����

```json
// package.json - ����ï�����
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "test": "jest --coverage",
    "test:e2e": "playwright test",
    "security:audit": "npm audit --audit-level=high",
    "security:scan": "snyk test",
    "type-check": "tsc --noEmit",
    "build": "tsc && vite build"
  }
}
```

---

**�������**: 1.0.0  
** B��**: 2024t618�  
**\**: MNP Chatbot Development Team

,-�o<�SIM MNP����������ȷ���n�S�ؒ��W�z�K(n�hj��jɭ����gY