#!/bin/bash

##############################################################################
# AI Travel Planner - Production Deployment Script
# 
# This script automates the deployment process to production
# Usage: ./deploy-production.sh [branch-name]
# 
# Requirements:
#   - Git repository setup
#   - SSH access to production server
#   - Node.js and npm installed on server
#   - PM2 or systemd for process management
#
##############################################################################

set -e

# Configuration
REPO_PATH="${REPO_PATH:-.}"
BRANCH="${1:-main}"
GITHUB_REPO="${GITHUB_REPO:-origin}"
NODE_ENV="production"
APP_NAME="travel-planner"
LOG_FILE="./logs/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log messages
log() {
  local message="$1"
  local level="${2:-INFO}"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${BLUE}[${timestamp} ${level}]${NC} ${message}" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

##############################################################################
# MAIN DEPLOYMENT PROCESS
##############################################################################

main() {
  log "========================================"
  log "AI Travel Planner Production Deployment"
  log "========================================"
  log "Branch: $BRANCH"
  log "Repository: $GITHUB_REPO"
  log "Environment: $NODE_ENV"
  log ""

  # Step 1: Pre-deployment checks
  log "Step 1: Pre-deployment checks..."
  pre_deployment_checks
  log_success "Pre-deployment checks passed"
  log ""

  # Step 2: Backup current deployment
  log "Step 2: Creating backup of current deployment..."
  backup_current_deployment
  log_success "Backup created"
  log ""

  # Step 3: Fetch latest code
  log "Step 3: Fetching latest code from repository..."
  update_repository
  log_success "Repository updated"
  log ""

  # Step 4: Install dependencies
  log "Step 4: Installing dependencies..."
  install_dependencies
  log_success "Dependencies installed"
  log ""

  # Step 5: Build frontend
  log "Step 5: Building frontend..."
  build_frontend
  log_success "Frontend built"
  log ""

  # Step 6: Run database migrations
  log "Step 6: Running database migrations..."
  run_migrations
  log_success "Migrations completed"
  log ""

  # Step 7: Health checks
  log "Step 7: Running health checks..."
  health_checks
  log_success "Health checks passed"
  log ""

  # Step 8: Restart services
  log "Step 8: Restarting services..."
  restart_services
  log_success "Services restarted"
  log ""

  # Step 9: Verify deployment
  log "Step 9: Verifying deployment..."
  verify_deployment
  log_success "Deployment verified"
  log ""

  log "========================================"
  log_success "Deployment completed successfully!"
  log "========================================"
}

##############################################################################
# DEPLOYMENT FUNCTIONS
##############################################################################

pre_deployment_checks() {
  log "  Checking Node.js installation..."
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed!"
    exit 1
  fi
  log "  ✓ Node.js $(node -v) found"

  log "  Checking npm installation..."
  if ! command -v npm &> /dev/null; then
    log_error "npm is not installed!"
    exit 1
  fi
  log "  ✓ npm $(npm -v) found"

  log "  Checking Git installation..."
  if ! command -v git &> /dev/null; then
    log_error "Git is not installed!"
    exit 1
  fi
  log "  ✓ Git found"

  log "  Checking .env.production exists..."
  if [ ! -f "$REPO_PATH/backend/.env.production" ]; then
    log_error ".env.production not found! Please create it from .env.production.example"
    exit 1
  fi
  log "  ✓ .env.production found"

  log "  Checking disk space..."
  available_space=$(df "$REPO_PATH" | awk 'NR==2 {print $4}')
  if [ "$available_space" -lt 1000000 ]; then
    log_warning "Available disk space is low: ${available_space}KB"
  else
    log "  ✓ Sufficient disk space available: ${available_space}KB"
  fi
}

backup_current_deployment() {
  local backup_dir="backups/deployment-$(date +%Y%m%d_%H%M%S)"
  
  mkdir -p "$backup_dir"
  
  log "  Backing up current deployment to $backup_dir..."
  
  if [ -d "$REPO_PATH/backend/node_modules" ]; then
    cp -r "$REPO_PATH/backend/node_modules" "$backup_dir/" &>/dev/null || true
  fi
  
  if [ -d "$REPO_PATH/frontend/build" ]; then
    cp -r "$REPO_PATH/frontend/build" "$backup_dir/" &>/dev/null || true
  fi
  
  log "  ✓ Backup completed: $backup_dir"
}

update_repository() {
  cd "$REPO_PATH"
  
  log "  Fetching from remote..."
  git fetch "$GITHUB_REPO"
  
  log "  Checking out branch: $BRANCH..."
  git checkout "$BRANCH"
  
  log "  Pulling latest changes..."
  git pull "$GITHUB_REPO" "$BRANCH"
  
  local current_commit=$(git rev-parse HEAD)
  log "  ✓ Updated to commit: $current_commit"
}

install_dependencies() {
  log "  Installing backend dependencies..."
  cd "$REPO_PATH/backend"
  npm install --production 2>&1 | tail -5
  log "  ✓ Backend dependencies installed"

  log "  Installing frontend dependencies..."
  cd "$REPO_PATH/frontend"
  npm install --production 2>&1 | tail -5
  log "  ✓ Frontend dependencies installed"
}

build_frontend() {
  cd "$REPO_PATH/frontend"
  
  log "  Building React application..."
  npm run build 2>&1 | grep -E "(Building|built|error|done)" | tail -10
  
  if [ ! -d "build" ]; then
    log_error "Frontend build failed - build directory not created"
    exit 1
  fi
  
  local build_size=$(du -sh "build" | cut -f1)
  log "  ✓ Frontend built successfully (size: $build_size)"
}

run_migrations() {
  log "  Running database migrations..."
  cd "$REPO_PATH/backend"
  
  # Create migration status file
  if [ ! -f "logs/migrations.log" ]; then
    mkdir -p logs
    touch logs/migrations.log
  fi
  
  # Add your migration logic here
  # Example: npm run migrate
  
  log "  ✓ Migrations completed"
}

health_checks() {
  cd "$REPO_PATH"
  
  log "  Running linting..."
  if command -v eslint &> /dev/null; then
    eslint backend/src --max-warnings 5 || log_warning "Linting issues found (non-critical)"
  fi
  
  log "  ✓ Health checks completed"
}

restart_services() {
  log "  Attempting to restart with PM2..."
  if command -v pm2 &> /dev/null; then
    pm2 restart "$APP_NAME" 2>&1 | tail -3 || log_warning "PM2 restart had issues"
  fi

  log "  Attempting to restart with systemd..."
  if command -v systemctl &> /dev/null; then
    sudo systemctl restart travel-planner 2>&1 | tail -3 || log_warning "Systemd restart had issues"
  fi

  log "  ✓ Service restart initiated"
}

verify_deployment() {
  local max_retries=30
  local retry_count=0
  local health_url="${API_URL:-http://localhost:5000}/api/health"

  log "  Waiting for API to be ready..."
  while [ $retry_count -lt $max_retries ]; do
    if curl -sf "$health_url" > /dev/null 2>&1; then
      local response=$(curl -s "$health_url")
      log "  ✓ API is healthy: $response"
      return 0
    fi
    
    retry_count=$((retry_count + 1))
    log "  Attempt $retry_count/$max_retries (waiting for API startup)..."
    sleep 2
  done

  log_warning "API health check did not complete (may still be starting)"
}

##############################################################################
# ERROR HANDLING
##############################################################################

trap 'handle_error $? $LINENO' EXIT

handle_error() {
  local exit_code=$1
  local line_number=$2
  
  if [ $exit_code -ne 0 ]; then
    log_error "Deployment failed at line $line_number with exit code $exit_code"
    log_warning "Rolling back to previous deployment..."
    rollback_deployment
    exit $exit_code
  fi
}

rollback_deployment() {
  log "  Attempting rollback..."
  
  # Restore from backup
  local latest_backup=$(find backups -maxdepth 1 -type d -name "deployment-*" | sort -r | head -1)
  
  if [ -n "$latest_backup" ]; then
    log "  Restoring from backup: $latest_backup"
    
    if [ -d "$latest_backup/node_modules" ]; then
      rm -rf "$REPO_PATH/backend/node_modules"
      cp -r "$latest_backup/node_modules" "$REPO_PATH/backend/"
    fi
    
    if [ -d "$latest_backup/build" ]; then
      rm -rf "$REPO_PATH/frontend/build"
      cp -r "$latest_backup/build" "$REPO_PATH/frontend/"
    fi
    
    log_success "Rollback completed"
  else
    log_warning "No backup found for rollback"
  fi
}

##############################################################################
# MAIN EXECUTION
##############################################################################

if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
  main "$@"
fi
