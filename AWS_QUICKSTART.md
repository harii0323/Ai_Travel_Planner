# AWS Deployment Quick Start

**Estimated Time**: 35 minutes | **Cost**: ~$40/month | **Status**: Ready to Deploy

## 🎯 Quick Reference

### Prerequisites Checklist
```
☐ AWS Account created (with billing enabled)
☐ Domain name registered (e.g., yourdomain.com)
☐ SSH key pair generated (ai-travel-planner-key.pem)
☐ MongoDB Atlas account created (free)
☐ GitHub repository with code pushed
```

---

## 📋 Step-by-Step Deployment (5 Commands)

### 1. Create AWS Resources (5 minutes)

**A. Create EC2 Instance:**
```bash
# In AWS Console:
# - EC2 Dashboard > Instances > Launch Instances
# - AMI: Ubuntu Server 20.04 LTS
# - Instance type: t3.medium
# - Storage: 20GB
# - Security Group: Allow ports 80, 443, 22
# - Key Pair: ai-travel-planner-key.pem (download this)
# - Launch and wait 2 minutes
```

**B. Allocate Elastic IP:**
```bash
# In AWS Console:
# - EC2 Dashboard > Elastic IPs > Allocate
# - Associate with your new instance
# - Save the IP address (e.g., 52.123.45.67)
```

**C. Update DNS:**
```bash
# In your domain registrar (GoDaddy, Namecheap, etc.):
# A Record: yourdomain.com → 52.123.45.67
# CNAME: www.yourdomain.com → yourdomain.com
# Wait 5 minutes for DNS to propagate
```

### 2. Setup MongoDB (2 minutes)

**Option A: Free MongoDB Atlas (RECOMMENDED)**
```bash
# 1. Go to https://www.mongodb.com/cloud/atlas
# 2. Create free cluster:
#    - Cluster name: ai-travel-planner
#    - Cloud: AWS
#    - Region: US-EAST-1
# 3. Create database user: admin / your-password
# 4. Whitelist IP: YOUR_ELASTIC_IP or 0.0.0.0/0
# 5. Get connection string:
#    mongodb+srv://admin:password@cluster.mongodb.net/ai-travel-planner?retryWrites=true&w=majority
```

### 3. Deploy with One Command (3 minutes)

**On your local machine:**

```bash
# 1. Make script executable
chmod +x aws-deploy.sh

# 2. Run deployment
./aws-deploy.sh 52.123.45.67 yourdomain.com

# 3. Script will:
#    ✓ Install Node.js, Nginx, SSL
#    ✓ Clone and build your app
#    ✓ Configure environment
#    ✓ Start backend service
#    ✓ Setup HTTPS certificate
#    ✓ Configure monitoring
#    ✓ Setup daily backups
```

### 4. Verify Deployment (2 minutes)

```bash
# In browser:
https://yourdomain.com              # Frontend loads
https://yourdomain.com/api/health   # API responds ✓

# In terminal:
curl https://yourdomain.com/api/health

# Expected output:
# {"status":"ok"} or similar health response
```

### 5. Update Configuration (1 minute)

```bash
# SSH into your server
ssh -i ai-travel-planner-key.pem ubuntu@52.123.45.67

# Update MongoDB credentials
nano /home/ubuntu/ai-travel-planner/backend/.env.production

# Update MONGODB_URI with your Atlas connection string
# Save (Ctrl+O, Ctrl+X)

# Restart service
sudo systemctl restart travel-planner
```

---

## 🚀 One-Liner Deployment

After prerequisites are ready:

```bash
chmod +x aws-deploy.sh && ./aws-deploy.sh 52.123.45.67 yourdomain.com
```

That's it! Your app is now live at `https://yourdomain.com` ✅

---

## 📊 Post-Deployment Verification

| Check | Command | Expected |
|-------|---------|----------|
| **Service Running** | `ssh -i key.pem ubuntu@IP 'sudo systemctl status travel-planner'` | `active (running)` ✓ |
| **API Health** | `curl https://yourdomain.com/api/health` | `{"status":"ok"}` |
| **Frontend Loads** | Open `https://yourdomain.com` in browser | Displays login page ✓ |
| **HTTPS Works** | Check URL bar | Green lock 🔒 |
| **Database Connected** | Try to register user | Account created ✓ |

---

## 🔐 Security Checklist

After deployment, update these:

```bash
SSH into server: ssh -i key.pem ubuntu@YOUR_IP

1. Update MongoDB inside .env.production
   nano /home/ubuntu/ai-travel-planner/backend/.env.production
   # Update MONGODB_URI with real credentials

2. Configure email (optional)
   # Update EMAIL_SERVICE, EMAIL_USER, EMAIL_PASSWORD

3. Set strong JWT secret
   # Already randomly generated ✓

4. Enable automated backups
   # Already configured ✓ (daily at 2 AM)

5. Monitor application
   # Check logs: sudo journalctl -u travel-planner -f
```

---

## 🔧 Common Commands

```bash
# SSH into server
ssh -i ai-travel-planner-key.pem ubuntu@YOUR_ELASTIC_IP

# View real-time logs
sudo journalctl -u travel-planner -f

# Check service status
sudo systemctl status travel-planner

# Restart service
sudo systemctl restart travel-planner

# View system health
free -h              # Memory
df -h               # Disk space
top -b -n 1 | head  # CPU usage

# Manual database backup
/home/ubuntu/ai-travel-planner/backup-database.sh backup

# View recent backups
/home/ubuntu/ai-travel-planner/backup-database.sh list
```

---

## 💰 Cost Monitor

```bash
# Monthly cost breakdown:
EC2 t3.medium:    $29.73 (best for small-medium traffic)
Elastic IP:       $3.00  (static IP)
Data transfer:    $0-5   (minimal for most cases)
MongoDB Atlas:    $0     (free tier: 512MB storage)
────────────────────────
TOTAL:           ~$35-40/month

# To reduce costs:
- Use t2.micro (free tier, but slower)
- Use spot instances (70% cheaper, less reliable)
- Use auto-scaling (scales down when idle)
```

---

## ⚠️ Important Notes

### Before Deployment
- ✓ Ensure GitHub repository is public or you have SSH key setup
- ✓ Update the GitHub clone URL in `aws-deploy.sh`
- ✓ Ensure MongoDB Atlas IP whitelist includes your EC2 instance
- ✓ Domain must point to Elastic IP

### During Deployment
- All steps automated - just watch the output
- Takes 30-45 minutes total
- SSL certificate automatically installed

### After Deployment
- Update .env.production with REAL MongoDB credentials
- Configure email service (optional)
- Monitor for first 24 hours
- Check daily backup logs

---

## 🆘 Troubleshooting

### "SSH connection failed"
```bash
# Check 1: Is instance running?
# In AWS Console: EC2 > Instances > Instance should be "running"

# Check 2: Is security group allowing SSH from your IP?
# EC2 > Security Groups > Check inbound SSH rule > Source: YOUR_IP

# Check 3: Is key file correct?
ls -la ai-travel-planner-key.pem
chmod 400 ai-travel-planner-key.pem
```

### "API not responding"
```bash
# SSH into server and check logs:
ssh -i key.pem ubuntu@IP

sudo systemctl status travel-planner
sudo journalctl -u travel-planner -n 50

# Common causes:
# 1. MONGODB_URI not set correctly
# 2. Port 5000 already in use
# 3. Node.js process crashed
```

### "SSL certificate error"
```bash
# Let's Encrypt auto-renews, but you can manually renew:
ssh -i key.pem ubuntu@IP
sudo certbot renew --dry-run
sudo certbot renew
```

### "Deployment script fails"
```bash
# Read the full logs:
cat deployment-aws.log

# Verify prerequisites:
# 1. Instance IP is correct
# 2. Domain is correct
# 3. SSH key has 400 permissions: chmod 400 ai-travel-planner-key.pem
# 4. Security group allows SSH from your IP
```

---

## 📚 Full Documentation

For more detailed information, see:
- **[AWS_DEPLOYMENT_GUIDE.md](AWS_DEPLOYMENT_GUIDE.md)** - Comprehensive guide
- **[PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md)** - All deployment platforms
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Before/during/after checklist

---

## ✅ Success Indicators

You'll know deployment is successful when:

1. ✅ No errors in deployment script output
2. ✅ Service status shows "active (running)"
3. ✅ `https://yourdomain.com` loads in browser
4. ✅ `https://yourdomain.com/api/health` returns 200 OK
5. ✅ Can register a new user account
6. ✅ Can create an itinerary
7. ✅ Website shows green lock 🔒 for HTTPS
8. ✅ Backup script runs daily at 2 AM

---

## 📞 Support Resources

- **AWS EC2 Documentation**: https://docs.aws.amazon.com/ec2/
- **MongoDB Atlas Help**: https://docs.atlas.mongodb.com/
- **Nginx Configuration**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/docs/
- **Ubuntu Server Guide**: https://ubuntu.com/server/docs
- **Node.js Docs**: https://nodejs.org/en/docs/

---

**Status**: ✅ Ready for AWS Deployment  
**Last Updated**: March 2026  
**Version**: 1.0  
**Difficulty**: ⭐⭐ (Automated, minimal manual work)
