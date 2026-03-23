# V8 Operator Runbook

> Version: 1.0
> Date: 2026-03-23
> Owner: Platform Operations
> Status: Ready for staging use

---

## 1. V8 Architecture Overview

### Components
- **V8 API Layer**: `/api/v8/` namespace on the existing Express server
- **V8 Feature Flags**: Per-org, per-module flags controlling V8 activation
- **V8 Shadow Mode**: Parallel execution for safe comparison
- **V8 Database**: Separate `v8` schema in the same Postgres instance
- **V8 Frontend Client**: React hooks + V8Provider for conditional UI rendering

### Key decisions
- D1: Chat + AI Core are the first V8 modules
- D2: Phased replacement with shadow mode
- D3: 8-week conditional target
- D6: Separate `v8` schema in same Postgres DB

---

## 2. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_V8_GLOBAL` | `false` | Master switch for all V8 features |
| `ENABLE_V8_SHADOW_MODE` | `false` | Enable shadow mode (parallel execution) |
| `DATABASE_URL` | — | Primary database connection |
| `DATABASE_PUBLIC_URL` | — | Public database URL (for external access) |

---

## 3. Monitoring Endpoints

Replace `<api-base-url>` with your deployment base (no trailing slash), e.g. `https://api.example.com`.

### Health
```
GET <api-base-url>/api/v8/health
Authorization: Bearer <token>
```
Returns platform health for the authenticated organization. Typical shape: `{ data: { overall: 'healthy' | 'degraded' | 'critical', domains: {...}, timestamp: string }, meta: { version: 'v8' } }`. If V8 tables are not initialized, the handler may return `overall: 'not_ready'` with a note in `meta`.

### Readiness
```
GET <api-base-url>/api/v8/health/readiness
Authorization: Bearer <token>
```
Returns per-domain readiness. Use to check if specific modules are operational.

### Feature Flags (current org)
```
GET <api-base-url>/api/v8/admin/flags
Authorization: Bearer <token>
```
Returns V8 flags for the authenticated org (`organizationId` in `meta`).

### Feature Flags — all organizations (Superadmin)
```
GET <api-base-url>/api/v8/admin/flags/all
Authorization: Bearer <superadmin-token>
```
Returns flags across orgs (superadmin only).

### Detailed Health (Superadmin)
```
GET <api-base-url>/api/v8/admin/health
Authorization: Bearer <superadmin-token>
```
Returns cross-domain integrity, platform metrics, and domain readiness.

### Request Metrics (Superadmin)
```
GET <api-base-url>/api/v8/admin/metrics
Authorization: Bearer <superadmin-token>
```
Returns request count, error count, and average latency (`avgLatencyMs`).

### Shadow Mode Stats (Superadmin)
```
GET <api-base-url>/api/v8/admin/shadow/stats
Authorization: Bearer <superadmin-token>
```
Returns shadow comparison statistics.

### Shadow Promotion Readiness (Superadmin)
```
GET <api-base-url>/api/v8/admin/shadow/promotion-readiness
Authorization: Bearer <superadmin-token>
```
Returns whether shadow mode criteria are met for promotion.

---

## 4. Common Operations

### Enable V8 for an organization
```bash
# 1. Ensure global V8 is enabled
# Set ENABLE_V8_GLOBAL=true in Railway environment

# 2. Enable specific modules for the org (superadmin; org comes from auth context)
curl -X PUT "<api-base-url>/api/v8/admin/flags/chat" \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

curl -X PUT "<api-base-url>/api/v8/admin/flags/ai_core" \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

### Disable V8 for an organization
```bash
curl -X PUT "<api-base-url>/api/v8/admin/flags/chat" \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Enable shadow mode
```bash
# Set ENABLE_V8_SHADOW_MODE=true in Railway environment
# Then enable V8 for the org (see above)
# Shadow comparisons will be recorded automatically
```

### Check shadow mode results
```bash
curl "<api-base-url>/api/v8/admin/shadow/stats" \
  -H "Authorization: Bearer <superadmin-token>"

curl "<api-base-url>/api/v8/admin/shadow/promotion-readiness" \
  -H "Authorization: Bearer <superadmin-token>"
```

### Run V8 migrations
```bash
cd server

# Dry run first
npx tsx scripts/v8-migrate.ts --dry-run

# Apply migrations
npx tsx scripts/v8-migrate.ts --apply

# Verify schema
npx tsx scripts/v8-migrate.ts --verify
```

### Run smoke tests
```bash
cd server
npm run v8:smoke-test -- --url https://staging.example.com --token "$JWT_TOKEN"
```

---

## 5. Troubleshooting

### V8 endpoints return 404
**Cause**: `ENABLE_V8_GLOBAL` is not set to `true`
**Fix**: Set `ENABLE_V8_GLOBAL=true` in Railway environment variables and redeploy

### V8 endpoints return 400 "Organization context required"
**Cause**: Request is missing organization context (no org selected)
**Fix**: Ensure the user has selected an organization before accessing V8 features

### V8 endpoints return 404 "V8 not enabled for this organization"
**Cause**: V8 is globally enabled but not enabled for this specific org
**Fix**: Enable V8 for the org via admin API (see section 4)

### Shadow mode not recording comparisons
**Cause**: `ENABLE_V8_SHADOW_MODE` is not set, or no shadow route mappings are configured
**Fix**:
1. Set `ENABLE_V8_SHADOW_MODE=true`
2. Check that shadow route mappings exist in `v8ShadowInterceptor.middleware.ts`
3. Verify via `GET /api/v8/admin/shadow/stats`

### Database errors in V8 services
**Cause**: V8 migrations not applied, or placeholder translation issue
**Fix**:
1. Run `npx tsx scripts/v8-migrate.ts --verify` to check schema
2. If tables are missing, run `npx tsx scripts/v8-migrate.ts --apply`
3. Check logs for `[DB:Promise]` errors

### V8 latency is high
**Cause**: V8 services may be doing unnecessary work or DB queries are slow
**Fix**:
1. Check `GET /api/v8/admin/metrics` for latency data
2. Check `GET /api/v8/admin/health` for domain-specific issues
3. If shadow mode is active, check if V8 calls are adding overhead

---

## 6. Rollback Procedures

### Emergency: Disable all V8 features
**Time to recover: < 1 minute**
```bash
# Set in Railway environment:
ENABLE_V8_GLOBAL=false
# Redeploy if your platform does not hot-reload env vars at runtime.
```

### Disable V8 for specific org
**Time to recover: < 1 minute**
```bash
curl -X PUT "<api-base-url>/api/v8/admin/flags/chat" \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Rollback V8 database schema
**Time to recover: < 5 minutes**
**WARNING: This drops all V8 data**
```bash
V8_ROLLBACK_CONFIRM=YES_DROP_ALL_V8_TABLES npx tsx scripts/v8-migrate.ts --rollback
```

### Rollback frontend V8 features
**Time to recover: Immediate**
V8Provider returns `isV8Enabled: false` when flags are off. No code deployment needed.

---

## 7. Escalation Matrix

| Severity | Condition | Action | Escalate to |
|----------|-----------|--------|-------------|
| P0 | V8 affects legacy functionality | Disable V8 globally immediately | Engineering lead |
| P1 | V8 error rate > 10% | Disable V8 for affected org | Platform team |
| P2 | Shadow mismatch rate > 20% | Pause shadow mode, investigate | V8 team |
| P3 | V8 latency > 500ms p95 | Monitor, investigate if persistent | V8 team |
| P4 | Feature request / minor issue | Log in backlog | Product team |

---

## 8. Monitoring Checklist (Daily)

- [ ] Check `/api/v8/health` returns `healthy` overall (or acceptable degraded state per policy)
- [ ] Check `/api/v8/admin/metrics` — error rate < 5%
- [ ] Check `/api/v8/admin/shadow/stats` — match rate > 95% (if shadow active)
- [ ] Review any P0/P1 alerts from the last 24 hours
- [ ] Verify no new migration drift (if deployment occurred)

---

## 9. Shadow → Live Promotion Checklist

Before promoting from shadow mode to live V8:

- [ ] Minimum 100 shadow comparisons recorded
- [ ] Match rate >= 95%
- [ ] V8 error rate < 5%
- [ ] V8 latency overhead < 100ms average
- [ ] No mismatches in last 24 hours
- [ ] Source-of-truth approval obtained
- [ ] Rollback procedure tested
- [ ] Monitoring alerts configured
- [ ] Support team briefed

---

## 10. Related Documents

| Document | Location |
|----------|----------|
| V8 API Convention | `docs/product/work-packets/CP-03-API-CONVENTION.md` |
| Auth Contract | `docs/product/work-packets/CP-04-AUTH-CONTRACT.md` |
| Shadow Promotion Criteria | `docs/product/work-packets/CP-08-SHADOW-PROMOTION-CRITERIA.md` |
| Rollout Safety Checklist | `docs/product/work-packets/CP-10-ROLLOUT-SAFETY-CHECKLIST.md` |
| Postgres Compatibility | `docs/product/work-packets/CP-11-POSTGRES-COMPATIBILITY-REPORT.md` |
| Shadow Route Mappings | `docs/product/work-packets/CP-18-SHADOW-ROUTE-MAPPINGS.md` |
