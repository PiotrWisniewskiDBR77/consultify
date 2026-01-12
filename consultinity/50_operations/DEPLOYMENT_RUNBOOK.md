# Deployment Runbook - Consultify

## Overview

This runbook provides step-by-step instructions for deploying Consultify to production.

---

## Pre-Deployment

### 1. Verify Pre-Production Checklist
- [ ] Complete all items in PRE_PRODUCTION_CHECKLIST.md
- [ ] Obtain sign-off from all stakeholders

### 2. Backup Current Production
```bash
# Database backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Upload to S3 (if configured)
aws s3 cp backup_*.sql s3://$BACKUP_BUCKET/
```

### 3. Notify Team
- [ ] Send deployment notification to team
- [ ] Ensure on-call engineer is available

---

## Deployment Steps

### Option A: Railway Deployment

1. **Push to main branch**
```bash
git push origin main
```

2. **Railway auto-deploys from main**
- Monitor deployment at: https://railway.app/project/your-project

3. **Verify deployment**
```bash
curl https://your-domain.com/api/health
```

### Option B: Docker Deployment

1. **Build Docker image**
```bash
docker build -t consultify:$(git rev-parse --short HEAD) .
docker tag consultify:$(git rev-parse --short HEAD) consultify:latest
```

2. **Push to registry**
```bash
docker push your-registry/consultify:latest
```

3. **Deploy with docker-compose**
```bash
docker-compose pull
docker-compose up -d
```

4. **Verify deployment**
```bash
docker-compose ps
docker-compose logs -f app
```

### Option C: Manual Deployment

1. **Pull latest code**
```bash
git pull origin main
```

2. **Install dependencies**
```bash
npm ci --omit=dev
```

3. **Build frontend**
```bash
npm run build
```

4. **Run database migrations**
```bash
node scripts/migrate.cjs
```

5. **Restart server**
```bash
pm2 restart consultify
# or
systemctl restart consultify
```

---

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-domain.com/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 2. Smoke Tests
- [ ] Login page loads
- [ ] User can log in
- [ ] Dashboard displays correctly
- [ ] AI chat responds
- [ ] Assessment module loads

### 3. Monitor Logs
```bash
# Railway
railway logs

# Docker
docker-compose logs -f app

# PM2
pm2 logs consultify
```

### 4. Check Sentry
- [ ] No new errors in last 15 minutes
- [ ] Error rate normal

### 5. Verify LLM Providers
```bash
curl https://your-domain.com/api/llm-health
# Check all providers are healthy
```

---

## Rollback Procedure

### Railway
1. Go to Railway dashboard
2. Click on deployment
3. Click "Rollback to previous deployment"

### Docker
```bash
docker-compose down
docker tag consultify:previous consultify:latest
docker-compose up -d
```

### Manual
```bash
git checkout $PREVIOUS_COMMIT
npm ci --omit=dev
npm run build
pm2 restart consultify
```

### Database Rollback
```bash
# Restore from backup
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_YYYYMMDD_HHMMSS.sql
```

---

## Monitoring

### Key Metrics to Watch

1. **Response Time**
   - Target: < 200ms (p95)
   - Alert threshold: > 500ms

2. **Error Rate**
   - Target: < 0.1%
   - Alert threshold: > 1%

3. **CPU Usage**
   - Target: < 70%
   - Alert threshold: > 90%

4. **Memory Usage**
   - Target: < 70%
   - Alert threshold: > 90%

5. **Database Connections**
   - Monitor connection pool usage

### Dashboards

- Sentry: Error tracking
- Railway Metrics: Resource usage
- Custom: /api/metrics endpoint

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Complete outage | < 15 min |
| P2 | Major feature broken | < 1 hour |
| P3 | Minor issue | < 4 hours |
| P4 | Low priority | Next business day |

### Escalation Path

1. On-call engineer
2. Team lead
3. Engineering manager
4. CTO

### Communication Template

```
INCIDENT: [Brief description]
SEVERITY: P[1-4]
STATUS: [Investigating/Identified/Monitoring/Resolved]
IMPACT: [User impact description]
NEXT UPDATE: [Time]
```

---

## Contacts

| Role | Name | Contact |
|------|------|---------|
| On-call | TBD | TBD |
| Team Lead | TBD | TBD |
| DevOps | TBD | TBD |

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-01-01 | 1.0.0 | Initial runbook | - |

