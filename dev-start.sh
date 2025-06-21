#!/bin/bash

# MNP Chatbot Development Server Startup Script
# This script starts the complete development environment

echo "🚀 Starting MNP Chatbot Development Environment..."

# Check if .env files exist
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from template..."
    cp .env.template .env
    echo "📝 Please edit .env file with your OpenAI API key and other settings"
fi

if [ ! -f backend/.env ]; then
    echo "⚠️  Backend .env file not found. Creating..."
    cp backend/.env .env
fi

if [ ! -f frontend/.env ]; then
    echo "⚠️  Frontend .env file not found. Creating..."
    cp frontend/.env .env
fi

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Check if Docker containers are running
echo "🐳 Checking Docker services..."
if ! docker-compose ps | grep -q "Up"; then
    echo "🐳 Starting Docker services (PostgreSQL + Redis)..."
    docker-compose up -d postgres redis
    
    echo "⏳ Waiting for database to be ready..."
    sleep 10
fi

# Check database connection
echo "🗄️  Checking database connection..."
if ! PGPASSWORD=password psql -h localhost -U postgres -d mnp_chatbot -c "SELECT 1;" >/dev/null 2>&1; then
    echo "⚠️  Database not ready. Creating database..."
    PGPASSWORD=password createdb -h localhost -U postgres mnp_chatbot 2>/dev/null || true
    
    echo "🗄️  Running database migrations..."
    cd backend && npm run db:migrate && cd ..
    
    echo "🌱 Seeding database with sample data..."
    cd backend && npm run db:seed && cd ..
fi

echo "✅ Environment setup complete!"
echo ""
echo "🚀 Starting development servers..."
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:3001"
echo "   - API Docs: http://localhost:3001/api-docs"
echo ""

# Start the development servers
npm run dev