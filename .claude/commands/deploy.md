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
   - Drizzle migrations up to date

4. **All Tests Pass**
   ```bash
   npm test                    # Frontend tests
   cd server && pytest      # Backend tests
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

   # Build Node server (if needed)
   cd server && npm run build
   ```

3. **Create Deployment Package**
   ```bash
   tar -czf deploy.tar.gz \
     --exclude='node_modules' \
     --exclude='venv' \
     --exclude='__pycache__' \
     --exclude='.git' \
     --exclude='*.log' \
     client/dist \
     server/dist \
     server/drizzle \
     server/app \
     server/requirements.txt \
     package.json \
     package-lock.json \
     render.yaml
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

     # Install Node.js dependencies
     npm ci --production

     # Set up Python virtual environment
     cd server
     python3 -m venv venv
     source venv/bin/activate
     pip install -r requirements.txt
     cd ..

     # Run database migrations
     cd server && npm run db:push && cd ..

     # Restart services
     sudo systemctl restart api        # Python FastAPI
     pm2 reload ecosystem.config.js --env production  # Node.js if needed

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
# 1. Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PM2
sudo npm install -g pm2

# 4. Install Nginx
sudo apt install -y nginx

# 5. Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 6. Create app directory
sudo mkdir -p /var/www/app
sudo chown $USER:$USER /var/www/app

# 7. Create Python systemd service
sudo nano /etc/systemd/system/api.service
# (see deployer.md for service config)
sudo systemctl daemon-reload
sudo systemctl enable api

# 8. Configure Nginx (see deployer.md for config)
sudo nano /etc/nginx/sites-available/app
sudo ln -s /etc/nginx/sites-available/app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 9. Set up SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Environment Variables on Server

```bash
# Create production env file
nano /var/www/app/.env

# Contents:
ENVIRONMENT=production
PORT=8000
DATABASE_URL=postgresql://user:password@localhost:5432/app_production
CORS_ORIGINS=["https://your-domain.com"]
SPRINGBOARD_API_KEY=your-key

# Node server (if needed)
NODE_ENV=production
NODE_PORT=3001
```

## Monitoring After Deploy

```bash
# Watch Python API logs in real-time
ssh deploy@your-server.com "sudo journalctl -u api -f"

# Check PM2 logs (if using Node.js)
ssh deploy@your-server.com "pm2 logs"

# Check resource usage
ssh deploy@your-server.com "pm2 monit"

# Check Nginx access logs
ssh deploy@your-server.com "sudo tail -f /var/log/nginx/access.log"

# Check Python processes
ssh deploy@your-server.com "ps aux | grep uvicorn"
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
