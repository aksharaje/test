#!/bin/bash
# scripts/deploy.sh
# Production deployment script

set -e

# =============================================================================
# Configuration
# =============================================================================

SERVER_USER="${DEPLOY_USER:-deploy}"
SERVER_HOST="${DEPLOY_HOST:-your-server.com}"
SERVER_PATH="${DEPLOY_PATH:-/var/www/app}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Helper Functions
# =============================================================================

echo_step() {
    echo -e "${GREEN}==>${NC} $1"
}

echo_info() {
    echo -e "${BLUE}   $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

echo_error() {
    echo -e "${RED}Error:${NC} $1"
}

confirm() {
    read -p "$1 (y/n) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

echo_step "Running pre-flight checks..."

# Must be in project root
if [ ! -f "package.json" ]; then
    echo_error "Must run from project root (package.json not found)"
    exit 1
fi

# Check for required commands
for cmd in npm tar scp ssh; do
    if ! command -v $cmd &> /dev/null; then
        echo_error "$cmd is required but not installed"
        exit 1
    fi
done

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo_warning "You have uncommitted changes:"
    git status --short
    if ! confirm "Continue anyway?"; then
        exit 1
    fi
fi

# Test SSH connection
echo_info "Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 "$SERVER_USER@$SERVER_HOST" "echo 'SSH OK'" &> /dev/null; then
    echo_error "Cannot connect to $SERVER_HOST"
    echo_info "Check your SSH configuration and try:"
    echo_info "  ssh $SERVER_USER@$SERVER_HOST"
    exit 1
fi

# =============================================================================
# Run Tests
# =============================================================================

echo_step "Running tests..."
if ! npm test; then
    echo_error "Tests failed. Fix tests before deploying."
    exit 1
fi

# =============================================================================
# Build Application
# =============================================================================

echo_step "Building application..."

echo_info "Building frontend..."
npm run build:client

echo_info "Building backend..."
npm run build:server

# Verify build outputs
if [ ! -d "client/dist" ]; then
    echo_error "Frontend build failed (client/dist not found)"
    exit 1
fi

if [ ! -d "server/dist" ]; then
    echo_error "Backend build failed (server/dist not found)"
    exit 1
fi

# =============================================================================
# Create Deployment Package
# =============================================================================

echo_step "Creating deployment package..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEPLOY_PACKAGE="deploy-${TIMESTAMP}.tar.gz"

tar -czf "$DEPLOY_PACKAGE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.env.local' \
    --exclude='.env.development' \
    client/dist \
    server/dist \
    server/prisma \
    package.json \
    package-lock.json \
    ecosystem.config.js

PACKAGE_SIZE=$(du -h "$DEPLOY_PACKAGE" | cut -f1)
echo_info "Package created: $DEPLOY_PACKAGE ($PACKAGE_SIZE)"

# =============================================================================
# Upload to Server
# =============================================================================

echo_step "Uploading to $SERVER_HOST..."

scp "$DEPLOY_PACKAGE" "$SERVER_USER@$SERVER_HOST:/tmp/"

# =============================================================================
# Deploy on Server
# =============================================================================

echo_step "Deploying on server..."

ssh "$SERVER_USER@$SERVER_HOST" << REMOTE_SCRIPT
    set -e
    
    cd $SERVER_PATH
    
    echo "Creating backup of current deployment..."
    if [ -d "current" ]; then
        BACKUP_NAME="backup-\$(date +%Y%m%d-%H%M%S)"
        mv current "\$BACKUP_NAME"
        echo "Backed up to \$BACKUP_NAME"
    fi
    
    echo "Extracting new deployment..."
    mkdir -p current
    tar -xzf /tmp/$DEPLOY_PACKAGE -C current
    
    echo "Installing dependencies..."
    cd current
    npm ci --production --silent
    
    echo "Running database migrations..."
    cd server
    npx prisma migrate deploy
    cd ..
    
    echo "Restarting application..."
    pm2 reload ecosystem.config.js --env production
    
    echo "Cleaning up..."
    rm /tmp/$DEPLOY_PACKAGE
    
    # Keep only last 3 backups
    cd $SERVER_PATH
    ls -dt backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
    
    echo "Deployment complete!"
REMOTE_SCRIPT

# =============================================================================
# Cleanup Local
# =============================================================================

echo_step "Cleaning up..."
rm "$DEPLOY_PACKAGE"

# =============================================================================
# Verify Deployment
# =============================================================================

echo_step "Verifying deployment..."

sleep 3  # Give PM2 time to restart

HEALTH_CHECK=$(ssh "$SERVER_USER@$SERVER_HOST" "curl -s http://localhost:3001/health" 2>/dev/null || echo "FAILED")

if [[ "$HEALTH_CHECK" == *"ok"* ]]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo_warning "Health check may have failed. Check logs:"
    echo_info "  ssh $SERVER_USER@$SERVER_HOST 'pm2 logs --lines 50'"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Server:     $SERVER_HOST"
echo "  Path:       $SERVER_PATH/current"
echo "  Timestamp:  $TIMESTAMP"
echo ""
echo "  Useful commands:"
echo "    View logs:     ssh $SERVER_USER@$SERVER_HOST 'pm2 logs'"
echo "    Check status:  ssh $SERVER_USER@$SERVER_HOST 'pm2 status'"
echo "    Rollback:      ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && ./rollback.sh'"
echo ""
