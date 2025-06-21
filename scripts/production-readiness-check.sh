#!/bin/bash

# MNP Chatbot Production Readiness Check
# Purpose: 本番環境デプロイ前の総合チェック

set -e

echo "🚀 MNP Chatbot Production Readiness Check"
echo "========================================"

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# チェック結果を記録
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# ログ関数
log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS_COUNT++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL_COUNT++))
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARN_COUNT++))
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 環境変数チェック
echo -e "\n${BLUE}1. Environment Variables Check${NC}"
echo "================================"

required_env_vars=(
    "NODE_ENV"
    "DATABASE_URL" 
    "REDIS_URL"
    "OPENAI_API_KEY"
    "JWT_SECRET"
    "SESSION_SECRET"
    "ENCRYPTION_KEY"
    "CORS_ORIGIN"
)

for var in "${required_env_vars[@]}"; do
    if [ -z "${!var}" ]; then
        log_fail "Environment variable $var is not set"
    else
        if [[ $var == *"SECRET"* || $var == *"KEY"* ]]; then
            # セキュリティ関連の変数の場合、値の長さのみチェック
            if [ ${#!var} -lt 32 ]; then
                log_warn "$var appears to be too short (should be at least 32 characters)"
            else
                log_pass "$var is set (length: ${#!var} characters)"
            fi
        else
            log_pass "$var is set: ${!var}"
        fi
    fi
done

# 本番環境固有のチェック
if [ "$NODE_ENV" = "production" ]; then
    if [[ "$CORS_ORIGIN" == *"localhost"* ]]; then
        log_warn "CORS_ORIGIN contains localhost in production environment"
    fi
    
    if [[ "$JWT_SECRET" == *"development"* ]]; then
        log_fail "JWT_SECRET contains 'development' in production"
    fi
fi

# ファイル存在チェック
echo -e "\n${BLUE}2. Required Files Check${NC}"
echo "=========================="

required_files=(
    ".env.template"
    "package.json"
    "backend/package.json"
    "frontend/package.json"
    "docker-compose.yml"
    "database/schema.sql"
    "database/seeds/mnp_faqs.sql"
    "SECURITY.md"
    "README_TESTING.md"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        log_pass "File exists: $file"
    else
        log_fail "Missing required file: $file"
    fi
done

# 依存関係チェック
echo -e "\n${BLUE}3. Dependencies Check${NC}"
echo "======================"

log_info "Checking backend dependencies..."
if cd backend && npm audit --audit-level=high > /dev/null 2>&1; then
    log_pass "Backend dependencies security check passed"
else
    log_warn "Backend has high severity vulnerabilities - run 'npm audit' to check"
fi

log_info "Checking frontend dependencies..."
if cd ../frontend && npm audit --audit-level=high > /dev/null 2>&1; then
    log_pass "Frontend dependencies security check passed"
else
    log_warn "Frontend has high severity vulnerabilities - run 'npm audit' to check"
fi

cd ..

# TypeScript コンパイルチェック
echo -e "\n${BLUE}4. TypeScript Compilation Check${NC}"
echo "================================="

log_info "Checking backend TypeScript compilation..."
if cd backend && npx tsc --noEmit > /dev/null 2>&1; then
    log_pass "Backend TypeScript compilation successful"
else
    log_fail "Backend TypeScript compilation failed"
fi

log_info "Checking frontend TypeScript compilation..."
if cd ../frontend && npx tsc --noEmit > /dev/null 2>&1; then
    log_pass "Frontend TypeScript compilation successful"
else
    log_fail "Frontend TypeScript compilation failed"
fi

cd ..

# ビルドテスト
echo -e "\n${BLUE}5. Build Test${NC}"
echo "=============="

log_info "Testing backend build..."
if cd backend && npm run build > /dev/null 2>&1; then
    log_pass "Backend build successful"
else
    log_fail "Backend build failed"
fi

log_info "Testing frontend build..."
if cd ../frontend && npm run build > /dev/null 2>&1; then
    log_pass "Frontend build successful"
else
    log_fail "Frontend build failed"
fi

cd ..

# データベーススキーマチェック
echo -e "\n${BLUE}6. Database Schema Check${NC}"
echo "=========================="

if [ -f "database/schema.sql" ]; then
    log_info "Checking database schema syntax..."
    if command -v psql > /dev/null 2>&1; then
        if psql --set ON_ERROR_STOP=1 -f database/schema.sql -d postgres > /dev/null 2>&1; then
            log_pass "Database schema syntax is valid"
        else
            log_warn "Database schema syntax check failed (PostgreSQL not available or schema invalid)"
        fi
    else
        log_warn "PostgreSQL not available for schema validation"
    fi
fi

# セキュリティ設定チェック
echo -e "\n${BLUE}7. Security Configuration Check${NC}"
echo "=================================="

# SSL/HTTPS チェック
if [ "$NODE_ENV" = "production" ]; then
    if [ -z "$SSL_CERT_PATH" ] && [ -z "$HTTPS_PORT" ]; then
        log_warn "SSL certificate configuration not found for production"
    fi
fi

# セキュリティヘッダーチェック
if grep -r "helmet" backend/src/ > /dev/null 2>&1; then
    log_pass "Security headers (Helmet) configured"
else
    log_fail "Security headers not configured"
fi

# レート制限チェック
if grep -r "rateLimit" backend/src/ > /dev/null 2>&1; then
    log_pass "Rate limiting configured"
else
    log_fail "Rate limiting not configured"
fi

# CORS チェック
if grep -r "cors" backend/src/ > /dev/null 2>&1; then
    log_pass "CORS configuration found"
else
    log_fail "CORS not configured"
fi

# Docker設定チェック
echo -e "\n${BLUE}8. Docker Configuration Check${NC}"
echo "==============================="

if [ -f "docker-compose.yml" ]; then
    log_info "Validating docker-compose.yml..."
    if docker-compose config > /dev/null 2>&1; then
        log_pass "docker-compose.yml is valid"
    else
        log_fail "docker-compose.yml validation failed"
    fi
else
    log_warn "docker-compose.yml not found"
fi

if [ -f "Dockerfile" ]; then
    log_pass "Dockerfile exists"
else
    log_warn "Dockerfile not found"
fi

# パフォーマンスチェック
echo -e "\n${BLUE}9. Performance Optimization Check${NC}"
echo "==================================="

# バンドルサイズチェック
if [ -f "frontend/package.json" ]; then
    if grep -q "webpack-bundle-analyzer" frontend/package.json; then
        log_pass "Bundle analyzer configured for frontend"
    else
        log_warn "Bundle analyzer not configured - consider adding for optimization"
    fi
fi

# キャッシュ設定チェック
if grep -r "Cache-Control\|ETag" backend/src/ > /dev/null 2>&1; then
    log_pass "HTTP caching headers configured"
else
    log_warn "HTTP caching not configured"
fi

# 監視・ログ設定チェック
echo -e "\n${BLUE}10. Monitoring and Logging Check${NC}"
echo "=================================="

# ログ設定チェック
if grep -r "winston\|logger" backend/src/ > /dev/null 2>&1; then
    log_pass "Logging framework configured"
else
    log_fail "Logging framework not found"
fi

# ヘルスチェックエンドポイント
if grep -r "/health" backend/src/ > /dev/null 2>&1; then
    log_pass "Health check endpoint configured"
else
    log_warn "Health check endpoint not found"
fi

# APIドキュメントチェック
echo -e "\n${BLUE}11. Documentation Check${NC}"
echo "========================"

documentation_files=(
    "README.md"
    "SECURITY.md" 
    "README_TESTING.md"
    "API.md"
)

for doc in "${documentation_files[@]}"; do
    if [ -f "$doc" ]; then
        log_pass "Documentation exists: $doc"
    else
        log_warn "Missing documentation: $doc"
    fi
done

# 最終結果サマリー
echo -e "\n${BLUE}📊 Production Readiness Summary${NC}"
echo "================================="
echo -e "✅ Passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "❌ Failed: ${RED}$FAIL_COUNT${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARN_COUNT${NC}"

total_checks=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
pass_percentage=$((PASS_COUNT * 100 / total_checks))

echo -e "\nOverall Score: ${pass_percentage}%"

if [ $FAIL_COUNT -eq 0 ] && [ $WARN_COUNT -le 3 ]; then
    echo -e "\n${GREEN}🎉 Production Ready!${NC}"
    echo "Your application is ready for production deployment."
    exit 0
elif [ $FAIL_COUNT -eq 0 ]; then
    echo -e "\n${YELLOW}⚠️  Ready with Warnings${NC}"
    echo "Your application is mostly ready, but please review the warnings above."
    exit 0
else
    echo -e "\n${RED}❌ Not Ready for Production${NC}"
    echo "Please fix the failed checks before deploying to production."
    exit 1
fi