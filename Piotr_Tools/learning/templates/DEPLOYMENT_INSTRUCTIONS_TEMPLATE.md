# Deployment Instructions Template

**Purpose**: Document what needs to happen during deployment that can't be done locally  
**Audience**: DevOps team, CI/CD pipeline, future maintainers  
**Created By**: AI/Developer creating the feature

---

## Why This Matters

When AI generates code or you build features, some things can't be tested/run locally:

- Environment variables that only exist in production
- Database migrations on production DB
- External service configurations (Stripe, AWS, etc.)
- DNS changes
- SSL certificates
- Secrets rotation

**This file ensures the deployment doesn't fail!**

---

## Template Structure

````markdown
# Deployment Instructions - [Feature Name]

**Created**: YYYY-MM-DD  
**Author**: [Your Name / AI]  
**Target Environment**: Production / Staging / Both  
**Risk Level**: 🟢 Low / 🟡 Medium / 🔴 High

---

## 📋 Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] Database backup taken
- [ ] Rollback plan ready
- [ ] Team notified of deployment window

---

## 🔧 Environment Variables

### New Variables (Add to production .env)

```bash
# Feature: [Feature Name]
NEW_API_KEY=xxx                    # Get from: [service dashboard]
FEATURE_ENABLED=true               # Set to false to disable
MAX_UPLOAD_SIZE=10485760          # 10MB in bytes
```
````

### Modified Variables

```bash
# OLD
DATABASE_POOL_SIZE=10

# NEW
DATABASE_POOL_SIZE=20              # Increased for new feature load
```

### Where to Set

**Vercel/Railway/Render**:

- Dashboard → Settings → Environment Variables

**Docker/Manual**:

- Update `/etc/app/.env` on server
- Restart service: `systemctl restart app`

---

## 🗄️ Database Changes

### Migrations to Run

**Order matters!** Run in this sequence:

```bash
# 1. Add new columns (safe - no downtime)
npm run migrate -- 20260111_add_user_preferences.sql

# 2. Backfill data (can be slow on large tables)
npm run migrate -- 20260111_backfill_preferences.sql

# 3. Add constraints (may fail if data invalid)
npm run migrate -- 20260111_add_constraints.sql
```

### Expected Runtime

- **Small DB (<1M rows)**: ~30 seconds
- **Medium DB (1M-10M rows)**: ~5 minutes
- **Large DB (>10M rows)**: ~30 minutes

### Rollback Commands

If deployment fails:

```bash
# Revert migrations
npm run migrate:rollback -- 20260111_add_user_preferences.sql

# Or manual SQL
psql $DATABASE_URL -c "DROP COLUMN preferences FROM users;"
```

---

## 🔐 Secrets & API Keys

### Create New Secrets

**Stripe API Key** (for payment feature):

1. Go to https://dashboard.stripe.com/apikeys
2. Create new restricted key with permissions:
   - `Customers: Read/Write`
   - `Subscriptions: Read/Write`
3. Copy secret key
4. Add to environment: `STRIPE_SECRET_KEY=sk_live_...`

**OpenAI API Key**:

1. Get from: https://platform.openai.com/api-keys
2. Set quota limit: $100/month
3. Add to environment: `OPENAI_API_KEY=sk-...`

### Rotate Existing Secrets

⚠️ **IMPORTANT**: If rotating secrets, update in this order:

1. Update secret in external service
2. Add NEW secret to environment (keep old temporarily)
3. Deploy app with dual-secret support
4. Remove OLD secret after 24 hours

---

## 🌐 External Services Configuration

### Stripe Webhooks

**Setup webhook endpoint**:

1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook secret: `whsec_...`
5. Add to environment: `STRIPE_WEBHOOK_SECRET=whsec_...`

### DNS Changes

**Add CNAME records**:

```
api.yourdomain.com  → your-app.vercel.app
cdn.yourdomain.com  → your-bucket.s3.amazonaws.com
```

**Propagation time**: 5-30 minutes

---

## 📦 Build Configuration

### Build Commands Updated

**Old**:

```bash
npm run build
```

**New**:

```bash
# Now requires compilation step
npm run compile:workers && npm run build
```

**Update in**:

- `package.json` → `"build"` script
- CI/CD pipeline → build step
- Vercel/Railway → Build Command setting

### Environment-Specific Builds

**Production**:

```bash
NODE_ENV=production npm run build
```

**Staging**:

```bash
NODE_ENV=staging API_URL=https://staging-api.com npm run build
```

---

## 🚀 Deployment Steps (Exact Order)

### 1. Pre-Deployment (30 minutes before)

```bash
# Take database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Notify team
# Post in #deployments Slack channel
```

### 2. Deploy Code

```bash
# Merge to main (triggers auto-deploy)
git checkout main
git merge feature/new-feature
git push origin main

# OR manual deploy
npm run deploy:production
```

### 3. Run Migrations (Immediately After Deploy)

```bash
# SSH to production server
ssh production-server

# Run migrations
cd /app
npm run migrate

# Verify migrations succeeded
npm run migrate:status
```

### 4. Configure External Services

- [ ] Set up Stripe webhook (see above)
- [ ] Configure CloudFlare CDN
- [ ] Update Auth0 callback URLs

### 5. Smoke Tests

```bash
# Health check
curl https://yourdomain.com/api/health

# Test new endpoint
curl https://yourdomain.com/api/new-feature

# Check logs for errors
tail -f /var/log/app/error.log
```

### 6. Enable Feature Flag (If Applicable)

```bash
# In admin panel or database
UPDATE feature_flags SET enabled = true WHERE name = 'new_feature';

# OR via environment variable (requires restart)
# Set FEATURE_NEW_FEATURE_ENABLED=true
```

---

## ⚠️ Potential Issues & Solutions

### Issue 1: Migration Timeout

**Symptom**: Migration runs for >10 minutes  
**Cause**: Large table, missing index  
**Solution**:

```sql
-- Create index first (can run concurrently)
CREATE INDEX CONCURRENTLY idx_users_created_at ON users(created_at);

-- Then run migration
```

### Issue 2: Environment Variable Not Set

**Symptom**: `Error: NEW_API_KEY is undefined`  
**Solution**:

1. Check `.env` file on server
2. Restart service: `systemctl restart app`
3. Verify with: `printenv | grep NEW_API_KEY`

### Issue 3: Webhook Not Receiving Events

**Symptom**: No webhook events logged  
**Solution**:

1. Check webhook URL is accessible: `curl https://yourdomain.com/api/webhooks/stripe`
2. Verify webhook secret matches
3. Check Stripe dashboard → Webhooks → Logs

---

## 🔙 Rollback Plan

**If deployment fails, follow these steps**:

### 1. Revert Code (Fast - 2 minutes)

```bash
# Revert to previous deployment
git revert HEAD
git push origin main

# OR manual rollback
vercel rollback  # For Vercel deployments
```

### 2. Rollback Database (Slower - 10 minutes)

```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# OR revert migrations
npm run migrate:rollback
```

### 3. Remove New Environment Variables

```bash
# Comment out in .env
# NEW_API_KEY=xxx

# Restart service
systemctl restart app
```

### 4. Notify Team

- Post in #incidents
- Update status page
- Investigate root cause

---

## ✅ Post-Deployment Verification

### Automated Checks

```bash
# Run E2E tests against production
npm run test:e2e:prod

# Check error rates (should be <0.1%)
npm run check:errors

# Verify performance (P95 <500ms)
npm run check:performance
```

### Manual Verification

- [ ] Login flow works
- [ ] New feature accessible
- [ ] No errors in Sentry
- [ ] Database queries performing well
- [ ] External integrations working (Stripe, email, etc.)

### Monitor for 24 Hours

- Check error rates hourly
- Monitor database performance
- Watch for user-reported issues
- Be ready to rollback if needed

---

## 📞 Emergency Contacts

**If deployment goes wrong**:

- **Primary**: [Your Name] - [phone/slack]
- **DevOps**: [DevOps Lead] - [phone/slack]
- **Database**: [DBA] - [phone/slack]
- **On-Call**: See PagerDuty rotation

---

## 📝 Deployment Checklist

Copy this for each deployment:

```markdown
## Deployment Checklist - [Date]

### Pre-Deployment

- [ ] Tests passing
- [ ] Code reviewed
- [ ] Backup taken
- [ ] Team notified

### Environment

- [ ] New variables added
- [ ] Secrets rotated (if needed)
- [ ] External services configured

### Deployment

- [ ] Code deployed
- [ ] Migrations run
- [ ] Smoke tests passed
- [ ] Feature flags enabled

### Post-Deployment

- [ ] E2E tests passed
- [ ] No errors in logs
- [ ] Performance acceptable
- [ ] Team notified of success

### If Issues

- [ ] Rollback executed
- [ ] Root cause identified
- [ ] Postmortem scheduled
```

---

## 🎓 Best Practices

### 1. Write During Development

**Don't wait until deployment time!**

When AI generates code or you build a feature:

```markdown
# Immediately create DEPLOYMENT_INSTRUCTIONS.md

What I just built requires:

- New env var: API_KEY
- Database migration: add_users_table.sql
- External service: Stripe webhook setup
```

### 2. Be Specific

**Bad**:

> "Set up environment variables"

**Good**:

> "Add `STRIPE_SECRET_KEY=sk_live_...` to `.env`  
> Get key from: https://dashboard.stripe.com/apikeys  
> Set quota: $100/month"

### 3. Include Exact Commands

**Not**: "Run migrations"

**But**:

```bash
npm run migrate -- 20260111_add_users.sql
# Expected output: Migration completed successfully
# Runtime: ~30 seconds
```

### 4. Document Dependencies

```markdown
## Dependencies

This feature requires:

- PostgreSQL 14+ (for JSONB operators)
- Redis 6+ (for caching)
- Node.js 20+ (for native crypto)

Check versions:

- `psql --version` (should be ≥14)
- `redis-cli --version` (should be ≥6)
```

### 5. Test Instructions Locally

**Simulate production**:

```bash
# 1. Fresh environment
docker run -it node:20 bash

# 2. Follow your deployment instructions
# 3. Fix any gaps or errors
# 4. Update instructions
```

---

## 📁 Where to Put This File

```
/docs/
├── operations/
│   ├── DEPLOYMENT_PROCEDURES.md        # General procedures
│   └── deployments/
│       ├── 2026-01-11-payment-feature.md
│       ├── 2026-01-15-ai-integration.md
│       └── 2026-01-20-database-migration.md
```

**Naming**: `YYYY-MM-DD-feature-name.md`

---

## 🤖 How AI Should Use This

**When generating code, AI should**:

1. **Detect deployment requirements**:

   ```typescript
   // Generated code
   const apiKey = process.env.NEW_API_KEY;
   if (!apiKey) throw new Error('NEW_API_KEY required');
   ```

2. **Create instruction section**:

   ```markdown
   ## ⚠️ DEPLOYMENT REQUIRED

   This feature requires:

   - Environment variable: `NEW_API_KEY`
   - Get from: [service]
   - Add to production .env
   ```

3. **Update DEPLOYMENT_INSTRUCTIONS.md**:
   - Add to existing file OR
   - Create new file with date

4. **Link in PR description**:

   ```markdown
   ## Deployment Notes

   See: docs/operations/deployments/2026-01-11-new-feature.md

   **Action Required**:

   - [ ] Add NEW_API_KEY to production
   - [ ] Run migration
   ```

---

**Remember**: Good deployment instructions = No surprises = Happy team = Successful deployment! 🚀
