# AWS Deployment Guide for AI Travel Planner

**Version**: 1.0  
**Platform**: AWS EC2  
**Operating System**: Ubuntu 20.04 LTS  
**Instance Type**: t3.medium (minimum)  
**Estimated Cost**: $30-50/month  
**Deployment Time**: 30-45 minutes

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [AWS Account Setup](#aws-account-setup)
3. [EC2 Instance Launch](#ec2-instance-launch)
4. [Environment Configuration](#environment-configuration)
5. [Application Deployment](#application-deployment)
6. [Nginx Configuration](#nginx-configuration)
7. [SSL/TLS Setup](#ssltls-setup)
8. [Database Setup](#database-setup)
9. [Monitoring & Backup](#monitoring--backup)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required
- [ ] AWS Account with billing enabled
- [ ] Domain name (e.g., yourdomain.com)
- [ ] SSH key pair generated locally
- [ ] Git repository with code pushed to GitHub/GitLab
- [ ] MongoDB Atlas account created (or plan to use on-EC2)
- [ ] Email configured for notifications (optional)

### Cost Estimate
| Component | Cost/Month |
|-----------|-----------|
| EC2 t3.medium (24/7) | $29.73 |
| Elastic IP (if needed) | $0-3 |
| MongoDB Atlas (free tier) | $0 |
| Data transfer | $0-5 |
| **Total** | **~$35-40** |

### Estimated Deployment Timeline
| Phase | Time |
|-------|------|
| AWS Setup & EC2 Launch | 10 min |
| SSH & Initial Config | 5 min |
| Dependencies Installation | 5 min |
| Code Clone & Build | 5 min |
| Nginx & SSL Setup | 5 min |
| Testing | 5 min |
| **Total** | **35 min** |

---

## AWS Account Setup

### Step 1: Create AWS Account (if needed)
1. Go to https://aws.amazon.com
2. Click "Create an AWS Account"
3. Follow the registration process
4. Verify email and add billing information
5. Enable MFA (multi-factor authentication) - recommended for security

### Step 2: Set Up IAM User (Recommended)
```bash
# Instead of using root account, create an IAM user
# 1. Go to IAM Dashboard
# 2. Click "Users" > "Add user"
# 3. Username: deploy-user
# 4. Access type: Programmatic access + AWS Management Console
# 5. Permissions: EC2FullAccess, RDS FullAccess
# 6. Download access keys CSV
```

### Step 3: Create Key Pair
```bash
# In AWS Console:
# 1. Go to EC2 Dashboard
# 2. Left sidebar > "Key Pairs"
# 3. Click "Create key pair"
# 4. Name: ai-travel-planner-key
# 5. File format: .pem (for macOS/Linux) or .ppk (for Windows PuTTY)
# 6. Download and save securely
# 
# Set permissions (macOS/Linux):
chmod 400 ai-travel-planner-key.pem
```

### Step 4: Create Security Group
```bash
# In AWS Console:
# 1. Go to EC2 Dashboard
# 2. Left sidebar > "Security Groups"
# 3. Click "Create security group"
# 4. Group name: travel-planner-sg
# 5. Description: Security group for AI Travel Planner
# 6. VPC: Default VPC
#
# Add inbound rules:
# - Type: HTTP, Protocol: TCP, Port: 80, Source: 0.0.0.0/0
# - Type: HTTPS, Protocol: TCP, Port: 443, Source: 0.0.0.0/0
# - Type: SSH, Protocol: TCP, Port: 22, Source: YOUR_IP/32
# - Type: Custom TCP, Port: 5000, Source: 127.0.0.1/32 (internal)
#
# Outbound rules (default):
# - All traffic allowed
```

---

## EC2 Instance Launch

### Step 1: Launch Instance
```bash
# In AWS Console:
# 1. Go to EC2 Dashboard
# 2. Click "Launch Instances"
# 3. Choose AMI: Ubuntu Server 20.04 LTS (free tier eligible)
# 4. Instance type: t3.medium (or t2.small for cost-cutting)
# 5. Storage: 20 GB, gp2
# 6. Security group: travel-planner-sg (created above)
# 7. Key pair: ai-travel-planner-key (created above)
# 8. Click "Launch"
```

### Step 2: Allocate Elastic IP (Optional)
```bash
# Recommended to keep the same IP address
# In AWS Console:
# 1. Go to EC2 Dashboard
# 2. Left sidebar > "Elastic IPs"
# 3. Click "Allocate Elastic IP address"
# 4. Domain: VPC
# 5. Click "Allocate"
# 6. Select the new Elastic IP
# 7. "Associate Elastic IP address"
# 8. Select your new instance
# 9. Click "Associate"
```

### Step 3: Get Instance Details
```bash
# In AWS Console:
# 1. Go to EC2 Dashboard > Instances
# 2. Select your instance (travel-planner)
# 3. Note these values:
#    - Public IPv4 address: xxx.xxx.xxx.xxx
#    - Public IPv4 DNS: ec2-xxx-xxx-xxx-xxx.compute-1.amazonaws.com
#
# Update your domain DNS records:
# Domain Registrar Settings:
#   A Record: yourdomain.com → xxx.xxx.xxx.xxx (Elastic IP)
#   CNAME: www.yourdomain.com → yourdomain.com
#
# Wait 24 hours for DNS propagation (usually 5 minutes)
```

---

## Environment Configuration

### Step 1: SSH into Instance
```bash
# macOS/Linux:
ssh -i /path/to/ai-travel-planner-key.pem ubuntu@YOUR_ELASTIC_IP

# Windows (using WSL or Git Bash):
ssh -i "C:\Users\YourName\Desktop\ai-travel-planner-key.pem" ubuntu@YOUR_ELASTIC_IP

# If using PuTTY on Windows:
# 1. Convert .pem to .ppk (use PuTTYgen)
# 2. Open PuTTY
# 3. Host: YOUR_ELASTIC_IP
# 4. Connection > SSH > Auth: Browse for .ppk file
# 5. Click Open
```

### Step 2: Update System
```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y curl wget git vim
```

### Step 3: Install Node.js 16+
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Step 4: Install Core Services
```bash
# Nginx (web server)
sudo apt-get install -y nginx

# Certbot (for SSL certificates)
sudo apt-get install -y certbot python3-certbot-nginx

# PM2 (process manager)
sudo npm install -g pm2

# Verify installations
nginx -v
certbot --version
pm2 --version
```

---

## Application Deployment

### Step 1: Clone Repository
```bash
# Navigate to home directory
cd /home/ubuntu

# Clone your repository
git clone https://github.com/YOUR_USERNAME/ai-travel-planner.git
cd ai-travel-planner

# Verify structure
ls -la
# Expected: backend/, frontend/, README.md, etc.
```

### Step 2: Configure Environment Variables
```bash
# Create production .env file
sudo cp backend/.env.production.example backend/.env.production
sudo nano backend/.env.production

# Fill in the following (replace with your values):
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-travel-planner?retryWrites=true&w=majority
JWT_SECRET=<your-strong-secret-32-chars>
FRONTEND_URL=https://yourdomain.com
API_BASE_URL=https://yourdomain.com/api
CORS_ORIGIN=https://yourdomain.com

# Save and exit (Ctrl+X, Y, Enter)

# Set proper permissions
sudo chmod 640 backend/.env.production
sudo chown ubuntu:ubuntu backend/.env.production
```

### Step 3: Install Backend Dependencies
```bash
cd /home/ubuntu/ai-travel-planner/backend
npm install --production

# Verify installation
ls node_modules | head -5
npm list | head -10
```

### Step 4: Build Frontend
```bash
cd /home/ubuntu/ai-travel-planner/frontend
npm install --production
npm run build

# Verify build
ls -la build/
# Expected: Static files in build/ directory
```

### Step 5: Create Systemd Service
```bash
# Create service file
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

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable travel-planner
sudo systemctl start travel-planner

# Check status
sudo systemctl status travel-planner
sudo journalctl -u travel-planner -n 20
```

---

## Nginx Configuration

### Step 1: Create Nginx Config
```bash
# Create configuration file
sudo tee /etc/nginx/sites-available/travel-planner > /dev/null <<'EOF'
upstream travel_planner_backend {
    server 127.0.0.1:5000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL certificates (will be updated by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
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
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|eot|ttf)$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
        }
        
        # Don't cache HTML
        location ~* \.html$ {
            add_header Cache-Control "public, max-age=0, must-revalidate";
        }
    }
}

# Redirect www to non-www (optional)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    return 301 https://yourdomain.com$request_uri;
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/travel-planner /etc/nginx/sites-enabled/

# Verify configuration
sudo nginx -t
# Expected: "nginx: configuration file test is successful"

# Reload Nginx
sudo systemctl reload nginx
```

### Step 2: Update Domain in Config
```bash
# Replace yourdomain.com with your actual domain
# Option 1: Use sed
sudo sed -i 's/yourdomain.com/your-actual-domain.com/g' /etc/nginx/sites-available/travel-planner

# Option 2: Edit manually
sudo nano /etc/nginx/sites-available/travel-planner
# Find and replace all instances of "yourdomain.com"
# Ctrl+O to save, Ctrl+X to exit

# Reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL/TLS Setup

### Step 1: Install SSL Certificate
```bash
# Using Let's Encrypt (FREE)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# During setup:
# - Enter your email: your-email@example.com
# - Accept terms (A)
# - Share email with EFF (Y/N - your choice)
# - Choose redirect (2 for http->https)

# Verify certificate
sudo certbot certificates

# Expected output shows:
# Certificate Name: yourdomain.com
# Expiry Date: 90 days from now
```

### Step 2: Auto-Renew Certificate
```bash
# Certbot automatically renews 30 days before expiry
# Verify auto-renewal is enabled
sudo systemctl list-timers snap.certbot.renew.timer

# Or manually: sudo certbot renew --dry-run

# Optional: Email renewal reminders
sudo certbot renew --email your-email@example.com
```

### Step 3: Test SSL Security
```bash
# Visit these sites to verify SSL setup:
# - https://www.ssllabs.com/ssltest/ (enter yourdomain.com)
# - https://www.sslshopper.com/ssl-checker.html

# Expected: A or A+ rating
```

---

## Database Setup

### Option A: MongoDB Atlas (RECOMMENDED - Free)

```bash
# 1. Go to https://www.mongodb.com/cloud/atlas
# 2. Sign up for free account
# 3. Create cluster:
#    - Cluster name: ai-travel-planner
#    - Cloud provider: AWS
#    - Region: US East (or closest to you)
# 4. Create database user:
#    - Username: admin
#    - Password: Generate strong password
# 5. Add IP whitelist:
#    - Your EC2 Elastic IP: xxx.xxx.xxx.xxx/32
#    - Or allow all: 0.0.0.0/0 (less secure)
# 6. Get connection string:
#    - Copy connection string
#    - Format: mongodb+srv://admin:password@cluster.mongodb.net/ai-travel-planner?retryWrites=true&w=majority
# 7. Update .env.production with connection string

cd /home/ubuntu/ai-travel-planner/backend
nano .env.production
# Update MONGODB_URI with your connection string
```

### Option B: MongoDB on EC2 (Optional)

```bash
# 1. Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

# 2. Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list

# 3. Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# 4. Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# 5. Verify installation
mongo --version
mongo --eval "db.version()"

# 6. Create database and user
mongo <<EOF
use ai-travel-planner
db.createUser({
  user: "admin",
  pwd: "strong-password-here",
  roles: ["readWrite"]
})
EOF

# 7. Update .env.production
MONGODB_URI=mongodb://admin:strong-password-here@localhost:27017/ai-travel-planner
```

---

## Monitoring & Backup

### Step 1: Verify Application
```bash
# Check if backend is running
sudo systemctl status travel-planner

# Check logs
sudo journalctl -u travel-planner -n 50 --no-pager

# Test API endpoint
curl http://localhost:5000/api/health
# Expected: {"status":"ok"} or similar

# Test through Nginx
curl https://yourdomain.com/api/health -k
# Expected: Same response
```

### Step 2: Setup CloudWatch Monitoring
```bash
# In AWS Console:
# 1. Go to CloudWatch Dashboard
# 2. Click "Create dashboard"
# 3. Add widgets:
#    - EC2 CPU utilization
#    - EC2 Network in/out
#    - Memory usage (requires CloudWatch agent)
# 4. Set alarms:
#    - CPU > 80% (alert)
#    - Disk space < 10% (alert)
#    - Network errors > 100 (alert)
```

### Step 3: Setup Email Alerts
```bash
# In AWS Console:
# 1. Go to SNS (Simple Notification Service)
# 2. Create topic: "travel-planner-alerts"
# 3. Create subscription:
#    - Protocol: Email
#    - Endpoint: your-email@example.com
# 4. Confirm subscription (click link in email)
# 5. In CloudWatch, set alarms to use this SNS topic

# Test alert
aws sns publish --topic-arn arn:aws:sns:us-east-1:123456789:travel-planner-alerts --message "Test alert"
```

### Step 4: Setup Automated Backups
```bash
# Copy backup script to server
scp -i ai-travel-planner-key.pem backup-database.sh ubuntu@YOUR_ELASTIC_IP:/home/ubuntu/ai-travel-planner/

# SSH into server
ssh -i ai-travel-planner-key.pem ubuntu@YOUR_ELASTIC_IP

# Make script executable
chmod +x /home/ubuntu/ai-travel-planner/backup-database.sh

# Create cron job for daily backup at 2 AM
sudo crontab -e

# Add this line:
0 2 * * * /home/ubuntu/ai-travel-planner/backup-database.sh backup

# Verify cron job
sudo crontab -l
```

---

## Performance Optimization

### Step 1: Enable Gzip Compression
```bash
# Already configured in Nginx config above
# Verify:
curl -H "Accept-Encoding: gzip" -I https://yourdomain.com/
# Look for: "Content-Encoding: gzip"
```

### Step 2: Setup CloudFront CDN (Optional)
```bash
# In AWS Console:
# 1. Go to CloudFront
# 2. Create distribution
# 3. Origin: yourdomain.com
# 4. Viewer protocol policy: Redirect HTTP to HTTPS
# 5. Cache behaviors: Default settings
# 6. Wait ~15 minutes for deployment
# 7. Update DNS: Point yourdomain.com to CloudFront domain
```

### Step 3: Monitor Performance
```bash
# SSH into EC2
ssh -i ai-travel-planner-key.pem ubuntu@YOUR_ELASTIC_IP

# Check CPU usage
top -b -n 1 | head -15

# Check disk usage
df -h

# Check memory usage
free -h

# Check network
netstat -an | grep :443 | wc -l
```

---

## Troubleshooting

### Service Not Starting
```bash
# Check service status
sudo systemctl status travel-planner

# View detailed logs
sudo journalctl -u travel-planner -n 100

# Common issues:
# - Port 5000 already in use: sudo lsof -i :5000
# - Missing .env file: ls -la backend/.env.production
# - Database connection: telnet mongodb-server 27017

# Restart service
sudo systemctl restart travel-planner
```

### Nginx Not Routing
```bash
# Check Nginx status
sudo nginx -t
sudo systemctl status nginx

# View error logs
sudo tail -100 /var/log/nginx/error.log

# Check if backend is running
curl http://localhost:5000/api/health

# Reload Nginx
sudo systemctl reload nginx
```

### SSL Certificate Issues
```bash
# Check certificate validity
sudo certbot certificates

# Renew manually
sudo certbot renew

# Check renewal log
sudo tail -50 /var/log/letsencrypt/letsencrypt.log

# Test auto-renewal
sudo certbot renew --dry-run
```

### Database Connection Failed
```bash
# For MongoDB Atlas:
# 1. Check IP whitelist in Atlas console
# 2. Verify connection string in .env.production
# 3. Test connection: mongo "mongodb+srv://user:pwd@cluster/db"

# For local MongoDB:
# 1. Check service running: sudo systemctl status mongod
# 2. Check port open: sudo lsof -i :27017
# 3. Check user permissions: mongo -u admin -p <password> --authenticationDatabase admin
```

### High CPU/Memory Usage
```bash
# Identify resource-heavy processes
top -b -n 1 | sort -k 9 | tail -10

# Kill process (if needed)
sudo kill -9 <PID>

# Restart service
sudo systemctl restart travel-planner

# Check logs for memory leaks
sudo journalctl -u travel-planner | grep -i memory
```

---

## Post-Deployment Checklist

After deployment, verify:

- [ ] Website loads: https://yourdomain.com
- [ ] API responds: https://yourdomain.com/api/health
- [ ] Login works: https://yourdomain.com (register/login)
- [ ] Can create itinerary
- [ ] Can view travel history
- [ ] Recommendations displaying
- [ ] SSL certificate valid (green lock)
- [ ] No console errors (F12 in browser)
- [ ] Backend logs clean (no errors)
- [ ] Database connected and saving data
- [ ] Daily backups scheduled
- [ ] Monitoring/alerts configured
- [ ] Auto-renewal configured for SSL

---

## Cost Optimization

### Reduce Monthly Costs

```bash
# Option 1: Use smaller instance (t2.micro = free tier)
# Downside: Less performance, ~512MB RAM

# Option 2: Use spot instances (~70% discount)
# Downside: Can be interrupted

# Option 3: Use auto-scaling
# Automatically scale up/down based on load

# Option 4: Use S3 for static files (+ CloudFront)
# Move frontend build to S3 bucket
# Serve via CloudFront CDN
# Cost: ~$0.50/month for static storage
```

### Estimated Annual Cost
```
- EC2 t3.medium: $356
- Elastic IP: $36
- Data transfer: $50
- SSL (free with Let's Encrypt)
- MongoDB Atlas (free tier): $0
- CloudFront (if used): $10-50
──────────────────────
TOTAL: ~$450-500/year
```

OR use cheaper option:

```
- EC2 t2.micro (free tier): $0
- MongoDB Atlas (free): $0
- CloudFront: $0
──────────────────────
TOTAL: ~$0/year (first 12 months)
```

---

## Deployment Automation

### One-Command Deployment
```bash
# Create deploy script on local machine
# File: deploy-to-aws.sh

#!/bin/bash
set -e

PRIVATE_KEY="ai-travel-planner-key.pem"
EC2_USER="ubuntu"
EC2_HOST="YOUR_ELASTIC_IP"

echo "🚀 Deploying to AWS EC2..."

# 1. Copy deployment script
scp -i $PRIVATE_KEY deploy-production.sh $EC2_USER@$EC2_HOST:/home/ubuntu/ai-travel-planner/

# 2. SSH and run deployment
ssh -i $PRIVATE_KEY $EC2_USER@$EC2_HOST << 'EOF'
cd /home/ubuntu/ai-travel-planner
chmod +x deploy-production.sh
./deploy-production.sh
EOF

echo "✅ Deployment complete!"
```

---

## Support & Resources

- **AWS EC2 Docs**: https://docs.aws.amazon.com/ec2/
- **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas/
- **Nginx Docs**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/
- **Ubuntu Server Guide**: https://ubuntu.com/server/docs

---

**Status**: ✅ Ready for AWS Deployment  
**Last Updated**: March 2026  
**Support**: Contact DevOps team
