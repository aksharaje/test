# Deploy Command

Build and deploy the application to production.

## Usage

```
/deploy [target]
```

**Targets:**
- `production` - Deploy to production server (default)
- `staging` - Deploy to staging environment
- `preview` - Build only, no deploy
- `github` - Push to GitHub and trigger CI/CD

## Prerequisites

Before deploying, ensure:

1. **Server Access**
   ```bash
   # Test SSH connection
   ssh deploy@your-server.com "echo 'Connection OK'"
   ```

2. **Environment Variables Set**
   - Local: `.env.production` exists
   - Server: `/var/www/app/.env.production` configured

3. **Database Ready**
   - PostgreSQL running on server
   - Migrations up to date

4. **All Tests Pass**
   ```bash
   npm test
   ```

## Deployment Workflow

### Option 1: Direct Deploy (rsync)

For quick deployments to your Linux server:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Build   │────▶│ Package  │────▶│  Upload  │────▶│ Restart  │
│ (local)  │     │ (tar.gz) │     │  (scp)   │     │  (PM2)   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

**Steps:**

1. **Pre-flight Checks**
   ```bash
   # Ensure clean working directory
   git status
   
   # Run tests
   npm test
   
   # Check for uncommitted changes
   git diff --exit-code
   ```

2. **Build Application**
   ```bash
   # Build frontend
   cd client && npm run build
   
   # Build backend
   cd server && npm run build
   ```

3. **Create Deployment Package**
   ```bash
   tar -czf deploy.tar.gz \
     --exclude='node_modules' \
     --exclude='.git' \
     --exclude='*.log' \
     client/dist \
     server/dist \
     server/prisma \
     package.json \
     package-lock.json \
     ecosystem.config.js
   ```

4. **Upload to Server**
   ```bash
   scp deploy.tar.gz deploy@your-server.com:/tmp/
   ```

5. **Execute Remote Deployment**
   ```bash
   ssh deploy@your-server.com << 'DEPLOY'
     cd /var/www/app
     
     # Backup current
     [ -d "current" ] && mv current "backup-$(date +%Y%m%d-%H%M%S)"
     
     # Extract new
     mkdir -p current
     tar -xzf /tmp/deploy.tar.gz -C current
     cd current
     
     # Install production dependencies
     npm ci --production
     
     # Run database migrations
     cd server && npx prisma migrate deploy && cd ..
     
     # Restart with PM2
     pm2 reload ecosystem.config.js --env production
     
     # Cleanup
     rm /tmp/deploy.tar.gz
   DEPLOY
   ```

6. **Verify Deployment**
   ```bash
   # Check health endpoint
   curl https://your-domain.com/health
   
   # Check PM2 status
   ssh deploy@your-server.com "pm2 status"
   
   # Check logs
   ssh deploy@your-server.com "pm2 logs --lines 50"
   ```

7. **Cleanup Old Backups**
   ```bash
   ssh deploy@your-server.com << 'CLEANUP'
     cd /var/www/app
     ls -dt backup-* | tail -n +4 | xargs rm -rf
   CLEANUP
   ```

### Option 2: GitHub CI/CD

For automated deployments via GitHub Actions:

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **GitHub Actions Workflow Runs**
   - Runs tests
   - Builds application
   - Deploys via SSH

3. **Monitor Deployment**
   - Check Actions tab in GitHub
   - Verify deployment completes
   - Check production site

**Required GitHub Secrets:**
- `SERVER_HOST` - Your server hostname
- `SERVER_USER` - SSH username
- `SSH_PRIVATE_KEY` - SSH private key for authentication

### Option 3: Preview Build

Build without deploying:

```bash
# Build both frontend and backend
npm run build

# Test production build locally
cd server && NODE_ENV=production node dist/server.js

# In another terminal
cd client && npx serve dist
```

## Rollback Procedure

If deployment fails:

```bash
ssh deploy@your-server.com << 'ROLLBACK'
  cd /var/www/app
  
  # List available backups
  ls -la backup-*
  
  # Rollback to previous version
  mv current failed-$(date +%Y%m%d-%H%M%S)
  mv backup-YYYYMMDD-HHMMSS current
  
  # Restart
  pm2 reload ecosystem.config.js --env production
  
  # Verify
  curl http://localhost:3001/health
ROLLBACK
```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Environment variables updated
- [ ] Database migrations tested locally
- [ ] Build succeeds locally
- [ ] Changelog updated

### During Deployment
- [ ] Backup created
- [ ] Files uploaded
- [ ] Dependencies installed
- [ ] Migrations applied
- [ ] PM2 restarted

### Post-Deployment
- [ ] Health check passes
- [ ] Application loads in browser
- [ ] API requests work
- [ ] No errors in logs
- [ ] Monitoring shows normal metrics
- [ ] Stakeholders notified

## Server Configuration

Reference: `.claude/agents/deployer.md`

### First-Time Server Setup

```bash
# On your Linux server
# 1. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Install PM2
sudo npm install -g pm2

# 3. Install Nginx
sudo apt install -y nginx

# 4. Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 5. Create app directory
sudo mkdir -p /var/www/app
sudo chown $USER:$USER /var/www/app

# 6. Configure Nginx (see deployer.md for config)
sudo nano /etc/nginx/sites-available/app
sudo ln -s /etc/nginx/sites-available/app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 7. Set up SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Environment Variables on Server

```bash
# Create production env file
nano /var/www/app/.env.production

# Contents:
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/app_production
CORS_ORIGIN=https://your-domain.com
```

## Monitoring After Deploy

```bash
# Watch logs in real-time
ssh deploy@your-server.com "pm2 logs"

# Check resource usage
ssh deploy@your-server.com "pm2 monit"

# Check Nginx access logs
ssh deploy@your-server.com "tail -f /var/log/nginx/access.log"
```

## Output

After deployment, report:

1. **Deployment Status**
   - Success/Failure
   - Deployment time
   - Version deployed

2. **Verification Results**
   - Health check status
   - API response times
   - Any errors encountered

3. **Next Steps**
   - Monitor logs for 15 minutes
   - Check error rates
   - Rollback instructions if needed
