# Production Deployment Guide

**Version**: 1.0  
**Last Updated**: March 2026  
**Status**: Ready for Production

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Deployment Platforms](#deployment-platforms)
4. [Security Configuration](#security-configuration)
5. [Database Setup](#database-setup)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Recovery](#backup--recovery)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Security
- [ ] Generate strong JWT_SECRET (32+ characters, alphanumeric + symbols)
- [ ] Update all credentials and API keys
- [ ] Enable HTTPS on all endpoints
- [ ] Configure CORS for production domain
- [ ] Review database access controls
- [ ] Enable firewall rules
- [ ] Disable debug mode (NODE_ENV=production)
- [ ] Update API rate limiting
- [ ] Configure CSP headers

### Code
- [ ] Run all tests and verify passing
- [ ] Code review completed
- [ ] Remove console.logs and debug code
- [ ] No hardcoded secrets in code
- [ ] Update dependencies to latest stable versions
- [ ] Test error handling edge cases
- [ ] Verify all API endpoints working

### Infrastructure
- [ ] Production database provisioned
- [ ] Backup system configured
- [ ] CDN setup (if needed)
- [ ] Monitoring and alerting configured
- [ ] Logging system ready
- [ ] Load balancer (if needed)
- [ ] SSL certificates installed

### Documentation
- [ ] Deployment runbook ready
- [ ] Rollback procedure documented
- [ ] Incident response plan
- [ ] API documentation updated
- [ ] Database schema documented
- [ ] Team trained on deployment

---

## Environment Setup

### 1. Generate Production Secrets

```bash
# Generate strong JWT_SECRET (macOS/Linux)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use OpenSSL
openssl rand -hex 32
```

**Create `.env.production` file in `backend/` directory:**

```bash
# Production Environment
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-travel-planner?retryWrites=true&w=majority
MONGODB_CONNECTION_POOL=50
MONGODB_TIMEOUT=30000

# Authentication
JWT_SECRET=<YOUR_STRONG_SECRET_HERE>
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12

# API Configuration
FRONTEND_URL=https://yourdomain.com
API_BASE_URL=https://api.yourdomain.com
CORS_ORIGIN=https://yourdomain.com

# Email (optional)
EMAIL_SERVICE=gmail
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASSWORD=<APP_PASSWORD>

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
SENTRY_DSN=https://sentry-key@sentry.io/project-id

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100

# Session
SESSION_SECRET=<YOUR_SESSION_SECRET>

# Other
ENVIRONMENT=production
DEPLOY_VERSION=1.0.0
```

### 2. Update `backend/package.json` scripts

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "build": "echo 'No build step needed'",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "db:backup": "mongodump --uri=$MONGODB_URI --out=./backups/$(date +%Y%m%d_%H%M%S)",
    "db:restore": "mongorestore --uri=$MONGODB_URI ./backups/latest/",
    "health-check": "curl http://localhost:5000/api/health"
  }
}
```

### 3. Update `frontend/.env.production`

```bash
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_ENV=production
REACT_APP_VERSION=1.0.0
REACT_APP_SENTRY_DSN=https://sentry-key@sentry.io/project-id
PUBLIC_URL=https://yourdomain.com
GENERATE_SOURCEMAP=false
```

---

## Deployment Platforms

### Option A: Heroku (Easiest)

```bash
# 1. Install Heroku CLI
npm install -g heroku

# 2. Login to Heroku
heroku login

# 3. Create Heroku app
heroku create your-app-name

# 4. Add MongoDB Atlas URI
heroku config:set MONGODB_URI="mongodb+srv://..."

# 5. Add JWT Secret
heroku config:set JWT_SECRET="your_secret_here"

# 6. Deploy
git push heroku main

# 7. View logs
heroku logs --tail

# 8. Scale dynos
heroku ps:scale web=2
```

### Option B: Render (Recommended for simplicity)

Render is a modern PaaS that can host both the backend API and the frontend as two separate services. It integrates with GitHub/ GitLab and manages build, deploy, and scaling automatically.

1. **Backend Web Service**
   - Go to the [Render dashboard](https://dashboard.render.com) and click **New → Web Service**.
   - Connect your repository and select the branch (e.g. `main`).
   - **Environment**: Node.js
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `node src/index.js` (or `npm run start`)
   - **Instance Type**: Standard (e.g. `Starter`) or above.
   - Add the following environment variables under **Environment**:
     ```
     MONGODB_URI=your_mongo_connection_string
     JWT_SECRET=your_strong_jwt_secret
     FRONTEND_URL=https://your-render-domain.or-custom-domain
     API_BASE_URL=https://your-render-domain
     # any other settings from your `.env.production` file
     ```
   - Save and click **Create Web Service**. Render will build and deploy automatically.
   - (Optional) Add a custom domain in the service settings and configure DNS records as instructed.

2. **Frontend Static Site**
   - In the Render dashboard click **New → Static Site**.
   - Link the same repository and branch.
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/build`
   - **Environment Variables**:
     ```
     REACT_APP_API_URL=https://your-render-domain-or-custom-domain
     REACT_APP_ENV=production
     REACT_APP_VERSION=1.0.0
     ```
   - Create the static site and once deployed, attach a custom domain if you have one.

3. **Database & Backups**
   - Use MongoDB Atlas or a self‑hosted cluster as described in the [Database Setup](#database-setup) section.
   - If you need scheduled backups, use a Render [cron job](https://render.com/docs/cron-jobs) pointing at `backup-database.sh` or an external storage service. AWS S3 is optional; you can also push archives to any cloud storage provider.

4. **Monitoring & Logs**
   - Render provides realtime logs and health checks in the dashboard. Configure alerts as needed.

5. **Scaling**
   - Adjust instance size or add additional services through the Render UI. Deployments occur on every git push.

*(Any references to AWS EC2 in earlier versions of this document are now superseded by Render instructions. AWS content may still exist for historical purposes.)*

### Option C: DigitalOcean

```bash
# 1. Create Droplet (Ubuntu 20.04, $12/month minimum)
# SSH into droplet

# 2. Install Node.js & MongoDB
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PM2 for process management
sudo npm install -g pm2

# 4. Clone and setup
git clone https://github.com/your-repo/ai-travel-planner.git
cd ai-travel-planner/backend
npm install --production

# 5. Start with PM2
pm2 start src/index.js --name "travel-planner"
pm2 startup
pm2 save

# 6. Configure Nginx using the examples earlier in this document (see Option B: Render or other web server guidance)
```

### Option D: Docker + Kubernetes

See [Docker Deployment](#docker-deployment) section below.

---

## Security Configuration

### 1. Enable HTTPS

```bash
# Generate self-signed cert (development)
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# Use Let's Encrypt (production)
sudo apt-get install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

### 2. Configure Security Headers

**Update `backend/src/index.js`:**

```javascript
const helmet = require('helmet');

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.yourdomain.com"]
  }
}));
```

### 3. Rate Limiting

**Install and configure:**

```bash
npm install express-rate-limit express-slow-down
```

**Update `backend/src/index.js`:**

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

### 4. Environment Variables Protection

- Never commit `.env.production` to git
- Use `.env.production.example` as template
- Store secrets in secure vault (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly

### 5. Database Security

```javascript
// Enable connection pooling
mongoose.connect(mongoUri, {
  maxPoolSize: 50,
  minPoolSize: 10,
  socketTimeoutMS: 45000,
});

// Validate input
const { body, validationResult } = require('express-validator');

app.post('/api/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().escape(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Process request
});
```

---

## Database Setup

### MongoDB Atlas (Recommended for Production)

1. **Create Account**: https://www.mongodb.com/cloud/atlas
2. **Create Cluster**: M10 or larger (production workload)
3. **Security**:
   - Enable IP Whitelist (only your server IPs)
   - Create database user with strong password
   - Enable encryption at rest
4. **Backup**: Enable "Backup & Restore"
5. **Connection String**:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/ai-travel-planner?retryWrites=true&w=majority
   ```

### Self-Hosted MongoDB

```bash
# Install MongoDB
sudo apt-get install -y mongodb-org

# Enable and start
sudo systemctl enable mongod
sudo systemctl start mongod

# Create admin user
mongo <<EOF
use admin
db.createUser({
  user: "admin",
  pwd: "strong_password_here",
  roles: ["root"]
})
EOF

# Create app user
mongo <<EOF
use ai-travel-planner
db.createUser({
  user: "app_user",
  pwd: "strong_app_password",
  roles: ["dbOwner"]
})
EOF

# Enable authentication in /etc/mongod.conf
sudo sed -i 's/^#.*security:/security:/; /security:/a\  authorization: enabled' /etc/mongod.conf
sudo systemctl restart mongod
```

---

## Monitoring & Logging

### 1. Sentry (Error Tracking)

```bash
npm install @sentry/node
```

**Update `backend/src/index.js`:**

```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### 2. Winston (Logging)

```bash
npm install winston
```

**Create `backend/src/utils/logger.js`:**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

module.exports = logger;
```

### 3. PM2 Monitoring

```bash
# Install PM2
npm install -g pm2

# Install PM2 monitoring
pm2 install pm2-auto-pull

# Start app with PM2
pm2 start src/index.js --name "travel-planner"

# Monitor
pm2 monit

# View logs
pm2 logs travel-planner
```

### 4. Health Check Endpoint

Already implemented in `backend/src/index.js`:

```bash
curl https://api.yourdomain.com/api/health
```

### 5. Uptime Monitoring

Services to monitor health:
- Uptime Robot (free tier)
- StatusPage.io
- New Relic

---

## Backup & Recovery

### Automated MongoDB Backups

**Create `backend/scripts/backup.js`:**

```javascript
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, '../backups');

async function backup() {
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db('ai-travel-planner');
    const collections = await db.listCollections().toArray();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);
    
    fs.mkdirSync(backupPath, { recursive: true });
    
    for (const collection of collections) {
      const docs = await db.collection(collection.name).find().toArray();
      fs.writeFileSync(
        path.join(backupPath, `${collection.name}.json`),
        JSON.stringify(docs, null, 2)
      );
    }
    
    console.log(`✅ Backup completed: ${backupPath}`);
    await client.close();
  } catch (error) {
    console.error('❌ Backup failed:', error);
  }
}

backup();
```

**Add to crontab (daily at 2 AM):**

```bash
crontab -e

# Add line:
0 2 * * * cd /path/to/backend && node scripts/backup.js
```

---

## Performance Optimization

### 1. Frontend Build Optimization

```bash
# In frontend directory
npm run build
# Creates optimized production build in build/

# Analyze bundle
npm install --save-dev source-map-explorer
npm run build
npm run analyze
```

### 2. Gzip Compression

```javascript
const compression = require('compression');
app.use(compression());
```

### 3. Database Indexing

```javascript
// In User model
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });

// In Itinerary model
itinerarySchema.index({ userId: 1, createdAt: -1 });
itinerarySchema.index({ destination: 1 });
```

### 4. Caching Strategy

```javascript
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});

// Cache itinerary recommendations
app.get('/api/itinerary/:id', async (req, res) => {
  const cached = await client.get(`itinerary:${req.params.id}`);
  if (cached) return res.json(JSON.parse(cached));
  
  const data = await fetchItinerary(req.params.id);
  await client.setex(`itinerary:${req.params.id}`, 3600, JSON.stringify(data));
  res.json(data);
});
```

---

## Deployment Scripts

### Automated Deployment Script

**Create `deploy.sh`:**

```bash
#!/bin/bash

set -e

echo "🚀 Starting Production Deployment..."

# Variables
REPO_PATH="/home/ubuntu/ai-travel-planner"
BRANCH="main"

# Pull latest code
cd $REPO_PATH
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# Backend setup
cd backend
npm install --production
npm run build

# Frontend setup
cd ../frontend
npm install --production
npm run build

# Restart service
sudo systemctl restart travel-planner

echo "✅ Deployment completed successfully!"
echo "🔍 Checking health..."
curl http://localhost:5000/api/health || echo "⚠️ Health check pending..."
```

**Add to crontab for automatic deployments:**

```bash
# Deploy every day at 2 AM
0 2 * * * /home/ubuntu/ai-travel-planner/deploy.sh >> /var/log/deploy.log 2>&1
```

---

## Rollback Procedure

```bash
# If deployment fails, rollback to previous version
cd /home/ubuntu/ai-travel-planner

# View git history
git log --oneline -10

# Rollback to previous version
git reset --hard <commit-hash>

# Reinstall and restart
cd backend && npm install --production
cd ../frontend && npm run build
sudo systemctl restart travel-planner
```

---

## Troubleshooting

### Issue: High Memory Usage

**Solution:**
```javascript
// Set Node memory limit
NODE_OPTIONS=--max-old-space-size=1024 node src/index.js

// Check memory leaks
npm install clinic
clinic doctor -- node src/index.js
```

### Issue: Slow Database Queries

**Solution:**
```javascript
// Enable query profiling
db.setProfilingLevel(1, { slowms: 100 })

// Analyze slow queries
db.system.profile.find().pretty()
```

### Issue: Certificate Errors

**Solution:**
```bash
# Renew Let's Encrypt certificate
sudo certbot renew --dry-run
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal
```

### Issue: Port Already in Use

**Solution:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

---

## Docker Deployment

**Create `Dockerfile`:**

```dockerfile
# Backend Dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000
CMD ["node", "src/index.js"]
```

**Create `docker-compose.yml`:**

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:5
    container_name: travel-planner-db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  backend:
    build: ./backend
    container_name: travel-planner-api
    ports:
      - "5000:5000"
    environment:
      MONGODB_URI: mongodb://admin:password@mongodb:27017/ai-travel-planner
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    container_name: travel-planner-web
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:5000

volumes:
  mongo_data:
```

**Deploy:**

```bash
docker-compose up -d
docker-compose logs -f
```

---

## Success Metrics

After deployment, monitor:
- ✅ API response time < 200ms (p95)
- ✅ Zero unhandled errors
- ✅ Database uptime > 99.9%
- ✅ Successful user registrations
- ✅ Itinerary generation success rate > 99%
- ✅ Zero unauthorized access attempts

---

**Need help?** Check error logs and refer to platform-specific documentation.

**Last Updated**: March 2026  
**Status**: Production Ready ✅
