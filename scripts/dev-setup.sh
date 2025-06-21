#!/bin/bash

# MNP Chatbot Development Environment Setup Script
# This script sets up the complete development environment

set -e

echo "🚀 MNP Chatbot Development Environment Setup"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_step "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "Docker and Docker Compose are installed."
}

# Check if Node.js is installed
check_node() {
    print_step "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    print_status "Node.js version: $NODE_VERSION"
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
}

# Create necessary directories
create_directories() {
    print_step "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p uploads
    mkdir -p data/backups
    mkdir -p infrastructure/nginx/ssl
    mkdir -p config/ssl
    
    print_status "Directories created successfully."
}

# Copy environment files
setup_environment() {
    print_step "Setting up environment files..."
    
    if [ ! -f .env ]; then
        if [ -f .env.template ]; then
            cp .env.template .env
            print_status "Copied .env.template to .env"
            print_warning "Please update .env with your actual configuration values."
        else
            print_error ".env.template not found. Please create environment configuration."
            exit 1
        fi
    else
        print_status ".env file already exists."
    fi
}

# Install backend dependencies
install_backend_deps() {
    print_step "Installing backend dependencies..."
    
    if [ -d "backend" ]; then
        cd backend
        npm install
        cd ..
        print_status "Backend dependencies installed."
    else
        print_warning "Backend directory not found. Skipping backend dependency installation."
    fi
}

# Install frontend dependencies
install_frontend_deps() {
    print_step "Installing frontend dependencies..."
    
    if [ -d "frontend" ]; then
        cd frontend
        npm install
        cd ..
        print_status "Frontend dependencies installed."
    else
        print_warning "Frontend directory not found. Skipping frontend dependency installation."
    fi
}

# Build Docker images
build_images() {
    print_step "Building Docker images..."
    
    docker-compose -f docker-compose.dev.yml build
    print_status "Docker images built successfully."
}

# Start services
start_services() {
    print_step "Starting development services..."
    
    docker-compose -f docker-compose.dev.yml up -d postgres redis
    print_status "Database and cache services started."
    
    # Wait for services to be ready
    print_step "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are healthy
    if docker-compose -f docker-compose.dev.yml ps | grep -q "healthy"; then
        print_status "Services are healthy."
    else
        print_warning "Some services may not be fully ready. Check with 'docker-compose logs'."
    fi
}

# Run database migrations
run_migrations() {
    print_step "Running database migrations..."
    
    if [ -d "database/migrations" ]; then
        # This would typically run the migration command
        # For now, we'll just copy the SQL files
        print_status "Database migration files are ready."
        print_warning "Run migrations manually: npm run migrate"
    else
        print_warning "No migration files found."
    fi
}

# Generate SSL certificates for development
generate_ssl() {
    print_step "Generating SSL certificates for development..."
    
    SSL_DIR="infrastructure/nginx/ssl"
    
    if [ ! -f "$SSL_DIR/localhost.crt" ]; then
        mkdir -p $SSL_DIR
        
        # Generate self-signed certificate
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout $SSL_DIR/localhost.key \
            -out $SSL_DIR/localhost.crt \
            -subj "/C=JP/ST=Tokyo/L=Tokyo/O=MNP Chatbot/CN=localhost"
        
        print_status "SSL certificates generated."
    else
        print_status "SSL certificates already exist."
    fi
}

# Create development scripts
create_dev_scripts() {
    print_step "Creating development scripts..."
    
    # Start script
    cat > scripts/start-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting MNP Chatbot Development Environment"
docker-compose -f docker-compose.dev.yml up -d
echo "✅ Development environment started"
echo "Frontend: http://localhost:3001"
echo "Backend API: http://localhost:3000"
echo "Database Admin: http://localhost:8080"
echo "Redis Admin: http://localhost:8081"
EOF

    # Stop script
    cat > scripts/stop-dev.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping MNP Chatbot Development Environment"
docker-compose -f docker-compose.dev.yml down
echo "✅ Development environment stopped"
EOF

    # Reset script
    cat > scripts/reset-dev.sh << 'EOF'
#!/bin/bash
echo "🔄 Resetting MNP Chatbot Development Environment"
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d --build
echo "✅ Development environment reset"
EOF

    # Logs script
    cat > scripts/logs-dev.sh << 'EOF'
#!/bin/bash
echo "📋 MNP Chatbot Development Logs"
docker-compose -f docker-compose.dev.yml logs -f $@
EOF

    chmod +x scripts/*.sh
    print_status "Development scripts created."
}

# Print final instructions
print_instructions() {
    echo ""
    echo "🎉 Development Environment Setup Complete!"
    echo "=========================================="
    echo ""
    echo "📋 Next Steps:"
    echo "1. Update .env file with your configuration"
    echo "2. Add your OpenAI API key to .env"
    echo "3. Start the development environment:"
    echo "   ./scripts/start-dev.sh"
    echo ""
    echo "🔗 Development URLs:"
    echo "   Frontend:      http://localhost:3001"
    echo "   Backend API:   http://localhost:3000"
    echo "   API Docs:      http://localhost:3000/api-docs"
    echo "   Database Admin: http://localhost:8080"
    echo "   Redis Admin:   http://localhost:8081"
    echo ""
    echo "🛠️  Useful Commands:"
    echo "   Start:  ./scripts/start-dev.sh"
    echo "   Stop:   ./scripts/stop-dev.sh"
    echo "   Reset:  ./scripts/reset-dev.sh"
    echo "   Logs:   ./scripts/logs-dev.sh [service]"
    echo ""
    echo "📚 Documentation:"
    echo "   API Docs: docs/api/"
    echo "   Setup Guide: docs/development/setup-guide.md"
    echo ""
}

# Main execution
main() {
    check_docker
    check_node
    create_directories
    setup_environment
    install_backend_deps
    install_frontend_deps
    generate_ssl
    build_images
    start_services
    run_migrations
    create_dev_scripts
    print_instructions
}

# Run main function
main