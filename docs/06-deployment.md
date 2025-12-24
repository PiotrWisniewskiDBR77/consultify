# Deployment Guide

This guide covers deploying Consultify to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [Railway Deployment](#railway-deployment)
- [Manual Deployment](#manual-deployment)
- [Post-Deployment](#post-deployment)
- [Monitoring](#monitoring)
- [Backup & Recovery](#backup--recovery)

## Prerequisites

### Required Services

- **Node.js** >= 20.x (production runtime)
- **PostgreSQL** >= 15 (recommended for production)
- **Redis** >= 7 (required for rate limiting and caching)
- **Reverse Proxy** (Nginx or similar, optional but recommended)

### Production Environment Variables

Ensure all required environment variables are set. See [Environment Configuration](#environment-configuration) below.

## Environment Configuration

### Required Variables

Create a `.env.production` file with the following:

```bash
# Server Configuration
NODE_ENV=production
PORT=3005
FRONTEND_URL=https://yourdomain.com

# Database Configuration (PostgreSQL recommended)
DB_TYPE=postgres
DATABASE_URL=postgresql://user:password@host:5432/consultify
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=consultify
DB_USER=consultify
DB_PASSWORD=secure-password

# Redis Configuration
REDIS_URL=redis://your-redis-host:6379
MOCK_REDIS=false

# JWT & Security
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# LLM Provider (at least one required)
GEMINI_API_KEY=your_gemini_api_key
# OPENAI_API_KEY=your_openai_api_key
# ANTHROPIC_API_KEY=your_anthropic_api_key

# OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback

# Stripe (for billing)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key

# Sentry (error tracking)
SENTRY_DSN=your_sentry_dsn

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
SMTP_FROM="Consultify System" <system@consultify.com>
```

### Security Considerations

- **Never commit** `.env.production` to version control
- Use strong, unique `JWT_SECRET` (generate with `openssl rand -base64 32`)
- Use environment-specific API keys
- Enable HTTPS/TLS in production
- Configure CORS properly for your domain

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Prepare environment file:**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your values
   ```

2. **Build and start services:**
   ```bash
   docker-compose up -d
   ```

3. **Check service status:**
   ```bash
   docker-compose ps
   docker-compose logs -f app
   ```

4. **Stop services:**
   ```bash
   docker-compose down
   ```

### Using Dockerfile Directly

1. **Build the image:**
   ```bash
   docker build -t consultify:latest .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name consultify \
     -p 3005:3005 \
     --env-file .env.production \
     -v consultify_db:/app/server/consultify.db \
     -v consultify_uploads:/app/server/uploads \
     consultify:latest
   ```

### Docker Compose with PostgreSQL

The provided `docker-compose.yml` includes PostgreSQL and Redis:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

## Railway Deployment

Railway is a platform-as-a-service that simplifies deployment.

### Initial Setup

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Link project:**
   ```bash
   railway link
   ```

### Configuration

1. **Set environment variables** in Railway dashboard or CLI:
   ```bash
   railway variables set NODE_ENV=production
   railway variables set DATABASE_URL=$DATABASE_URL
   railway variables set JWT_SECRET=$JWT_SECRET
   # ... set all required variables
   ```

2. **Provision PostgreSQL:**
   - Add PostgreSQL service in Railway dashboard
   - Railway automatically provides `DATABASE_URL`

3. **Provision Redis:**
   - Add Redis service in Railway dashboard
   - Railway automatically provides `REDIS_URL`

### Deploy

```bash
# Deploy to Railway
railway up

# Or push to connected Git repository
git push origin main
```

Railway automatically:
- Builds the Docker image
- Runs database migrations
- Starts the application
- Monitors health checks

### Health Checks

Railway uses the health check endpoint configured in `railway.json`:
- Endpoint: `/api/health`
- Expected: HTTP 200 response
- Interval: 30 seconds

## Manual Deployment

### Server Setup

1. **Install Node.js:**
   ```bash
   # Using nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 20
   nvm use 20
   ```

2. **Install PostgreSQL:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql-15

   # macOS
   brew install postgresql@15
   ```

3. **Install Redis:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server

   # macOS
   brew install redis
   ```

### Application Deployment

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd consultify
   ```

2. **Install dependencies:**
   ```bash
   npm ci --omit=dev
   cd server && npm ci --omit=dev && cd ..
   ```

3. **Build frontend:**
   ```bash
   npm run build
   ```

4. **Set environment variables:**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production
   ```

5. **Run database migrations:**
   ```bash
   # If using PostgreSQL
   node server/scripts/migrate-to-postgres.js
   ```

6. **Start application:**
   ```bash
   # Using PM2 (recommended)
   npm install -g pm2
   pm2 start server/index.js --name consultify
   pm2 save
   pm2 startup  # Setup startup script
   ```

### Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Post-Deployment

### Verify Deployment

1. **Health Check:**
   ```bash
   curl https://yourdomain.com/api/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "latency": 5,
     "database": "connected"
   }
   ```

2. **Test Authentication:**
   - Register a new user
   - Login and verify JWT token

3. **Test AI Integration:**
   - Send a test AI request
   - Verify LLM provider connection

### Database Setup

1. **Run migrations:**
   ```bash
   # Migrations run automatically on startup
   # Or manually:
   node server/scripts/migrate-to-postgres.js
   ```

2. **Seed initial data (optional):**
   ```bash
   node server/scripts/seed_llm.js
   node server/scripts/seed_roles.js
   ```

### SSL/TLS Setup

Use Let's Encrypt for free SSL certificates:

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

## Monitoring

### Application Monitoring

**PM2 Monitoring:**
```bash
# View process status
pm2 status

# View logs
pm2 logs consultify

# Monitor resources
pm2 monit
```

**Sentry Integration:**
- Errors automatically sent to Sentry
- Configure alerts in Sentry dashboard
- Monitor error rates and trends

### Database Monitoring

**PostgreSQL:**
```bash
# Connect to database
psql $DATABASE_URL

# Check connections
SELECT count(*) FROM pg_stat_activity;

# Check database size
SELECT pg_size_pretty(pg_database_size('consultify'));
```

**Redis:**
```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Check memory usage
INFO memory

# Monitor commands
MONITOR
```

### Log Monitoring

**Application Logs:**
- Logs written to console (stdout/stderr)
- Use PM2 logs or Docker logs
- Consider log aggregation (e.g., Logtail, Datadog)

**Access Logs:**
- Nginx access logs: `/var/log/nginx/access.log`
- Application request logs via Winston logger

## Backup & Recovery

### Database Backup

**PostgreSQL:**
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore backup
psql $DATABASE_URL < backup_20240101.sql
```

**SQLite:**
```bash
# Copy database file
cp server/consultify.db backups/consultify_$(date +%Y%m%d).db
```

### Automated Backups

**Cron job for PostgreSQL:**
```bash
# Add to crontab (crontab -e)
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/consultify_$(date +\%Y\%m\%d).sql.gz
```

**Docker volume backup:**
```bash
# Backup volume
docker run --rm -v consultify_db:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/db_backup_$(date +%Y%m%d).tar.gz /data

# Restore volume
docker run --rm -v consultify_db:/data -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/db_backup_20240101.tar.gz -C /
```

### File Uploads Backup

```bash
# Backup uploads directory
tar czf uploads_backup_$(date +%Y%m%d).tar.gz server/uploads/

# Restore uploads
tar xzf uploads_backup_20240101.tar.gz
```

### Disaster Recovery Plan

1. **Regular Backups:**
   - Daily database backups
   - Weekly full system backups
   - Off-site backup storage

2. **Recovery Testing:**
   - Test restore procedures quarterly
   - Document recovery steps
   - Maintain recovery runbook

3. **High Availability:**
   - Consider database replication
   - Load balancer for multiple app instances
   - Redis cluster for high availability

## Troubleshooting

### Application Won't Start

1. **Check logs:**
   ```bash
   pm2 logs consultify
   # or
   docker-compose logs app
   ```

2. **Verify environment variables:**
   ```bash
   # Check if all required vars are set
   env | grep -E "DATABASE_URL|JWT_SECRET|GEMINI_API_KEY"
   ```

3. **Check port availability:**
   ```bash
   lsof -i :3005
   ```

### Database Connection Issues

1. **Test connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. **Check PostgreSQL status:**
   ```bash
   sudo systemctl status postgresql
   ```

3. **Verify credentials:**
   - Check `DATABASE_URL` format
   - Verify user permissions

### Redis Connection Issues

1. **Test connection:**
   ```bash
   redis-cli -u $REDIS_URL ping
   ```

2. **Check Redis status:**
   ```bash
   sudo systemctl status redis
   ```

3. **Fallback to mock:**
   - Set `MOCK_REDIS=true` temporarily
   - Note: Rate limiting won't work with mock

## Next Steps

- **[Architecture Guide](02-architecture.md)** – Understand system architecture
- **[API Reference](API_REFERENCE.md)** – API documentation
- **[Getting Started](01-getting-started.md)** – Development setup

---

*For deployment-specific questions, please open an issue or contact the DevOps team.*


