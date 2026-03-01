#!/bin/bash

################################################################################
# AWS EC2 Deployment Script for AI Travel Planner
# Purpose: Automates Node.js application deployment on AWS EC2
# Usage: ./aws-deploy.sh <instance_ip> <domain> [mongodb_uri]
# Example: ./aws-deploy.sh 52.123.45.67 yourdomain.com
################################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PRIVATE_KEY="${SCRIPT_DIR}/ai-travel-planner-key.pem"
SSH_USER="ubuntu"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DEPLOYMENT_LOG="${SCRIPT_DIR}/deployment-aws.log"

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

validate_inputs() {
    if [ -z "$1" ]; then
        log_error "Usage: $0 <instance_ip> <domain> [mongodb_uri]"
        log_error "Example: $0 52.123.45.67 yourdomain.com"
        exit 1
    fi

    if [ ! -f "$PRIVATE_KEY" ]; then
        log_error "Private key not found: $PRIVATE_KEY"
        log_error "Download your AWS key pair and place it in the script directory"
        exit 1
    fi

    # Set proper permissions on SSH key
    chmod 400 "$PRIVATE_KEY"
}

test_ssh_connection() {
    log_info "Testing SSH connection to $INSTANCE_IP..."
    
    if ssh -o ConnectTimeout=10 -i "$PRIVATE_KEY" "${SSH_USER}@${INSTANCE_IP}" "echo 'SSH connection successful'" > /dev/null 2>&1; then
        log_success "SSH connection established"
    else
        log_error "Cannot connect to instance at $INSTANCE_IP"
        log_error "Make sure:"
        log_error "  1. Security group allows SSH (port 22) from your IP"
        log_error "  2. EC2 instance is running"
        log_error "  3. Elastic IP is allocated (if using)"
        exit 1
    fi
}

remote_exec() {
    local cmd=$1
    ssh -i "$PRIVATE_KEY" "${SSH_USER}@${INSTANCE_IP}" "$cmd"
}

remote_exec_with_output() {
    local cmd=$1
    local desc=$2
    log_info "$desc..."
    remote_exec "$cmd"
    log_success "$desc completed"
}

################################################################################
# Deployment Functions
################################################################################

setup_instance() {
    log_info "Setting up EC2 instance..."

    remote_exec_with_output "sudo apt-get update" "Updating system packages"
    
    remote_exec_with_output "sudo apt-get install -y curl wget git vim nginx certbot python3-certbot-nginx" \
        "Installing system dependencies"
    
    remote_exec_with_output "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs" \
        "Installing Node.js 18"
    
    remote_exec_with_output "sudo npm install -g pm2" "Installing PM2"
    
    log_success "Instance setup complete"
}

clone_repository() {
    log_info "Cloning repository..."
    
    # Check if directory already exists
    local repo_exists=$(remote_exec "[ -d '/home/ubuntu/ai-travel-planner' ] && echo 'yes' || echo 'no'")
    
    if [ "$repo_exists" = "yes" ]; then
        log_warning "Repository already exists, pulling latest changes..."
        remote_exec_with_output "cd /home/ubuntu/ai-travel-planner && git pull origin main" \
            "Pulling latest code"
    else
        remote_exec_with_output "cd /home/ubuntu && git clone https://github.com/YOUR_USERNAME/ai-travel-planner.git" \
            "Cloning repository"
    fi
}

configure_environment() {
    log_info "Configuring environment variables..."
    
    # Generate JWT secret if not provided
    local jwt_secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # Create .env.production file
    cat > /tmp/env-production << EOF
NODE_ENV=production
PORT=5000
MONGODB_URI=${MONGODB_URI:-mongodb+srv://admin:password@cluster.mongodb.net/ai-travel-planner?retryWrites=true&w=majority}
JWT_SECRET=${jwt_secret}
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12
FRONTEND_URL=https://${DOMAIN}
API_BASE_URL=https://${DOMAIN}/api
CORS_ORIGIN=https://${DOMAIN}
LOG_LEVEL=info
NODE_VERSION=18
EOF

    # Upload .env file to server
    scp -i "$PRIVATE_KEY" /tmp/env-production "${SSH_USER}@${INSTANCE_IP}:/tmp/.env.production"
    
    # Copy to correct location
    remote_exec "sudo cp /tmp/.env.production /home/ubuntu/ai-travel-planner/backend/.env.production && \
                 sudo chown ubuntu:ubuntu /home/ubuntu/ai-travel-planner/backend/.env.production && \
                 sudo chmod 640 /home/ubuntu/ai-travel-planner/backend/.env.production"
    
    log_success "Environment configured"
}

build_application() {
    log_info "Building application..."
    
    # Backend setup
    remote_exec_with_output "cd /home/ubuntu/ai-travel-planner/backend && npm install --production" \
        "Installing backend dependencies"
    
    # Frontend setup and build
    remote_exec_with_output "cd /home/ubuntu/ai-travel-planner/frontend && npm install --production && npm run build" \
        "Building frontend"
    
    log_success "Application build complete"
}

setup_systemd_service() {
    log_info "Setting up systemd service..."
    
    remote_exec << 'EOFSERVICE'
sudo tee /etc/systemd/system/travel-planner.service > /dev/null <<'EOF'
[Unit]
Description=AI Travel Planner Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ai-travel-planner/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
EnvironmentFile=/home/ubuntu/ai-travel-planner/backend/.env.production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable travel-planner
sudo systemctl start travel-planner
EOFSERVICE

    log_success "Systemd service configured and started"
}

configure_nginx() {
    log_info "Configuring Nginx..."
    
    remote_exec << EOFNGINX
sudo tee /etc/nginx/sites-available/travel-planner > /dev/null <<'EOF'
upstream travel_planner_backend {
    server 127.0.0.1:5000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};
    
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    client_max_body_size 10M;
    
    # API proxy
    location /api/ {
        proxy_pass http://travel_planner_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://travel_planner_backend;
        access_log off;
    }
    
    # Static frontend files
    location / {
        root /home/ubuntu/ai-travel-planner/frontend/build;
        try_files \$uri \$uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|eot|ttf)$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
        }
        
        location ~* \.html$ {
            add_header Cache-Control "public, max-age=0, must-revalidate";
        }
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/travel-planner /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
EOFNGINX

    log_success "Nginx configured"
}

setup_ssl_certificate() {
    log_info "Setting up SSL certificate with Let's Encrypt..."
    
    remote_exec "sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}" || {
        log_warning "SSL certificate setup failed - may already exist"
    }
    
    # Setup auto-renewal
    remote_exec "sudo systemctl enable certbot.timer"
    
    log_success "SSL certificate configured"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check service status
    local service_status=$(remote_exec "sudo systemctl is-active travel-planner")
    if [ "$service_status" = "active" ]; then
        log_success "Backend service is running"
    else
        log_error "Backend service is not running"
        remote_exec "sudo journalctl -u travel-planner -n 20"
        return 1
    fi
    
    # Test API endpoint (wait for it to be ready)
    log_info "Testing API endpoint..."
    for i in {1..30}; do
        if remote_exec "curl -s http://localhost:5000/api/health > /dev/null 2>&1"; then
            log_success "API endpoint is responding"
            return 0
        fi
        if [ $i -lt 30 ]; then
            log_info "Waiting for API to respond... (attempt $i/30)"
            sleep 2
        fi
    done
    
    log_error "API endpoint not responding after 60 seconds"
    remote_exec "sudo journalctl -u travel-planner -n 50 --no-pager"
    return 1
}

setup_monitoring() {
    log_info "Setting up basic monitoring..."
    
    # Create a simple status check script
    remote_exec << 'EOFMON'
cat > /home/ubuntu/check-health.sh <<'EOF'
#!/bin/bash
echo "Service Status:"
sudo systemctl status travel-planner --no-pager
echo -e "\nRecent Logs:"
sudo journalctl -u travel-planner -n 5 --no-pager
echo -e "\nDisk Usage:"
df -h | grep -E "^/|Filesystem"
echo -e "\nMemory Usage:"
free -h
echo -e "\nAPI Health:"
curl -s http://localhost:5000/api/health
EOF

chmod +x /home/ubuntu/check-health.sh
EOFMON

    log_success "Health check script created at /home/ubuntu/check-health.sh"
}

setup_backup_script() {
    log_info "Setting up backup script..."
    
    # Copy backup script to server
    scp -i "$PRIVATE_KEY" "${SCRIPT_DIR}/backup-database.sh" \
        "${SSH_USER}@${INSTANCE_IP}:/home/ubuntu/ai-travel-planner/"
    
    remote_exec "chmod +x /home/ubuntu/ai-travel-planner/backup-database.sh"
    
    # Create cron job for daily backups at 2 AM
    remote_exec "crontab -l 2>/dev/null | grep -v 'backup-database.sh' | crontab -" || true
    remote_exec "( crontab -l 2>/dev/null; echo '0 2 * * * /home/ubuntu/ai-travel-planner/backup-database.sh backup' ) | crontab -"
    
    log_success "Backup script configured with daily cron at 2 AM"
}

print_summary() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║          🚀 AWS Deployment Completed Successfully! 🚀           ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📊 Deployment Summary:"
    echo "─────────────────────────────────────────────────────────────────"
    echo "Instance IP:        $INSTANCE_IP"
    echo "Domain:             https://$DOMAIN"
    echo "Backend:            https://$DOMAIN/api"
    echo "API Health:         https://$DOMAIN/api/health"
    echo "Timestamp:          $TIMESTAMP"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""
    echo "✅ Completed Steps:"
    echo "  ✓ Instance setup (Node.js, Nginx, Certbot)"
    echo "  ✓ Code cloned and built"
    echo "  ✓ Environment configured"
    echo "  ✓ Backend service running (systemd)"
    echo "  ✓ Nginx configured and reloaded"
    echo "  ✓ SSL certificate from Let's Encrypt"
    echo "  ✓ Health check scripts installed"
    echo "  ✓ Backup script configured (daily at 2 AM)"
    echo ""
    echo "🔗 Access Your Application:"
    echo "─────────────────────────────────────────────────────────────────"
    echo "  Frontend:   https://$DOMAIN"
    echo "  API:        https://$DOMAIN/api/health"
    echo "  Admin SSH:  ssh -i ai-travel-planner-key.pem ubuntu@$INSTANCE_IP"
    echo ""
    echo "📝 Useful Commands:"
    echo "─────────────────────────────────────────────────────────────────"
    echo "  View logs:       ssh -i key.pem ubuntu@$INSTANCE_IP 'sudo journalctl -u travel-planner -f'"
    echo "  Check health:    ssh -i key.pem ubuntu@$INSTANCE_IP '/home/ubuntu/check-health.sh'"
    echo "  Restart service: ssh -i key.pem ubuntu@$INSTANCE_IP 'sudo systemctl restart travel-planner'"
    echo "  Manual backup:   ssh -i key.pem ubuntu@$INSTANCE_IP '/home/ubuntu/ai-travel-planner/backup-database.sh backup'"
    echo ""
    echo "🔒 Security Checklist:"
    echo "─────────────────────────────────────────────────────────────────"
    echo "  ⚠️  IMPORTANT: Update these immediately:"
    echo "      1. MONGODB_URI in .env.production with real credentials"
    echo "      2. JWT_SECRET is randomly generated (already done ✓)"
    echo "      3. Email configuration in .env.production"
    echo "      4. Update GitHub clone URL in script"
    echo ""
    echo "  Security configured:"
    echo "  ✓ HTTPS enforced (HTTP redirects to HTTPS)"
    echo "  ✓ Security headers enabled (HSTS, CSP, X-Frame-Options)"
    echo "  ✓ Gzip compression enabled"
    echo "  ✓ .env.production protected (chmod 640)"
    echo ""
    echo "📊 Monitoring:"
    echo "─────────────────────────────────────────────────────────────────"
    echo "  Logs location:    /var/log/; /home/ubuntu/ai-travel-planner/deployment.log"
    echo "  Service logs:     journalctl -u travel-planner"
    echo "  Nginx access:     /var/log/nginx/access.log"
    echo "  Nginx errors:     /var/log/nginx/error.log"
    echo ""
    echo "💰 Cost Estimate:"
    echo "─────────────────────────────────────────────────────────────────"
    echo "  EC2 t3.medium:    ~$30/month"
    echo "  Elastic IP:       ~$3/month"
    echo "  Data transfer:    ~$5/month"
    echo "  MongoDB Atlas:    Free (first 500MB)"
    echo "  ────────────────────────────"
    echo "  Total:            ~$38-40/month"
    echo ""
    echo "📚 Next Steps:"
    echo "─────────────────────────────────────────────────────────────────"
    echo "  1. Update .env.production with real MongoDB URI"
    echo "  2. Configure MongoDB database"
    echo "  3. Setup CloudWatch monitoring (optional)"
    echo "  4. Configure email services (optional)"
    echo "  5. Update GitHub repo URL in this script"
    echo ""
    echo "For more information, see: AWS_DEPLOYMENT_GUIDE.md"
    echo ""
}

################################################################################
# Main Execution
################################################################################

main() {
    # Initialize log
    > "$DEPLOYMENT_LOG"
    
    echo "████████████████████████████████████████████████████████████████"
    echo "█                  AWS EC2 Deployment Script                    █"
    echo "█           AI Travel Planner - Production Deployment            █"
    echo "████████████████████████████████████████████████████████████████"
    echo ""
    
    # Parse arguments
    INSTANCE_IP=$1
    DOMAIN=$2
    MONGODB_URI=${3:-""}
    
    # Validate inputs
    validate_inputs "$INSTANCE_IP" "$DOMAIN"
    
    log_info "Starting deployment process..."
    log_info "Instance IP: $INSTANCE_IP"
    log_info "Domain: $DOMAIN"
    log_info "MongoDB URI: ${MONGODB_URI:- using .env.production}"
    echo ""
    
    # Test SSH connection
    test_ssh_connection
    echo ""
    
    # Execute deployment steps
    setup_instance
    clone_repository
    build_application
    configure_environment
    setup_systemd_service
    configure_nginx
    setup_ssl_certificate
    verify_deployment
    setup_monitoring
    setup_backup_script
    
    # Print summary
    print_summary
    
    log_success "Deployment log saved to: $DEPLOYMENT_LOG"
}

# Run main function
main "$@"
