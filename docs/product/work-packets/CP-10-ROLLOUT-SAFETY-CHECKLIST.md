# CP-10: V8 Rollout Safety Checklist & Go/No-Go Gate

> Status: DRAFT — awaiting Postgres adaptation (CP-11 P0 fixes) before final approval
> Owner: Manager Agent
> Date: 2026-03-23
> Authority: Source-of-truth decisions D1-D6

---

## 1. Tranche 01 Packet Status

| Packet | Status | Evidence |
|--------|--------|----------|
| CP-01: Migration Runner | ✅ Complete | `v8-migrate.ts` with 4 modes, `v8-manifest.json` (45 migrations) |
| CP-02: Real-DB Test Harness | ✅ Complete | `vitest.config.v8-db.ts`, 12 compatibility tests, `test:v8-db` script |
| CP-03: API Router Foundation | ✅ Complete | `/api/v8/health` live, Gateway mount, API convention doc |
| CP-04: Auth Integration | ✅ Complete | V8 auth chain, 10 integration tests |
| CP-05: Feature Flag System | ✅ Complete | Per-org flags, admin API, 27 unit tests |
| CP-06: Chat + AI Core Routes | ✅ Complete | 15 endpoints (9 chat + 6 ai-core), 33 route tests |
| CP-07: Frontend V8 Client | ✅ Complete | API client, React hooks, V8Provider |
| CP-08: Shadow Mode | ✅ Complete | Service + migration + admin routes, 23 tests, promotion criteria |
| CP-09: Observability | ✅ Complete | Error codes, metrics store, middleware, admin endpoints, 21 tests |
| CP-10: Rollout Safety Gate | 📋 This document | — |
| CP-11: Postgres Compatibility | ✅ Complete (analysis) | Report: ~1,138 P0 issues (placeholder translation needed) |

---

## 2. Go/No-Go Criteria for Shadow Mode Activation

### MUST PASS (hard gates)

| # | Criterion | Status | Evidence required |
|---|-----------|--------|------------------|
| 1 | All V8 migrations apply to staging Postgres | ⏳ Pending | `v8-migrate.ts --apply` output + `--verify` output |
| 2 | V8 schema exists with all expected tables | ⏳ Pending | `\dt v8.*` output showing 45+ tables |
| 3 | DbPromise `?` → `$N` translation works | ❌ **BLOCKER** | CP-11 P0 fix required — 33 services use `?` placeholders |
| 4 | V8 service tests pass against real Postgres | ⏳ Pending | `npm run test:v8-db` output |
| 5 | `/api/v8/health` returns 200 on staging | ⏳ Pending | curl output |
| 6 | Feature flags correctly gate V8 per-org | ✅ Verified | 27 unit tests passing |
| 7 | Auth correctly resolves org context on V8 routes | ✅ Verified | 10 integration tests passing |
| 8 | Shadow mode records comparisons correctly | ✅ Verified | 23 unit tests passing |
| 9 | Frontend V8 client can call V8 endpoints | ⏳ Pending | Manual verification on staging |
| 10 | Existing (non-V8) routes unaffected | ⏳ Pending | Full existing test suite passes |

### SHOULD PASS (soft gates)

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 11 | V8 latency overhead < 100ms p95 | ⏳ Pending | Measurable only after shadow mode activation |
| 12 | Error rate < 5% in shadow mode | ⏳ Pending | Measurable only after shadow mode activation |
| 13 | Operator can view shadow results via admin API | ✅ Ready | Admin shadow routes exist |
| 14 | Rollback procedure documented | ⏳ Pending | See section 4 below |

---

## 3. Critical Blocker: Postgres Placeholder Translation

CP-11 analysis revealed that **33 out of 36 V8 service files use `?` placeholders** which will fail on Postgres. This is the single biggest blocker for production deployment.

### Recommended fix strategy (from CP-11 report)

**Phase 1 (unblocks everything):** Add `?` → `$N` auto-translation in `DbPromise.ts`
- Intercept SQL strings before passing to the driver
- Replace sequential `?` with `$1`, `$2`, `$3`, etc.
- This fixes ~1,135 placeholder issues across 33 files in one change
- Low risk: the translation is mechanical and deterministic

**Phase 2 (3 specific fixes):**
- Fix `datetime('now', '-24 hours')` in `shadowModeService.ts` → `NOW() - INTERVAL '24 hours'`
- Fix 2x `json_extract()` in `reportsPresModelService.ts` → Postgres JSONB operators
- Fix `LIKE` case sensitivity in `multiplayerHardeningService.ts` → `ILIKE`

**This blocker must be resolved before shadow mode can be activated on staging.**

---

## 4. Rollback Procedures

### V8 API Routes
- Set `ENABLE_V8_GLOBAL=false` → all V8 routes return 404 immediately
- No code deployment needed — env var change only
- Recovery time: < 1 minute

### V8 Feature Flags (per-org)
- Set per-org flag to `false` via admin API → V8 disabled for that org
- Other orgs unaffected
- Recovery time: < 1 minute

### V8 Database Schema
- `v8-migrate.ts --rollback` drops all `v8_*` tables
- Requires `V8_ROLLBACK_CONFIRM=YES_DROP_ALL_V8_TABLES` env var
- Non-V8 tables unaffected (separate schema)
- Recovery time: < 5 minutes

### Frontend V8 Client
- V8Provider returns `isV8Enabled: false` when flags are off
- All V8 UI conditionally renders — no V8 UI shown when disabled
- Recovery time: immediate (follows flag state)

### Shadow Mode
- Disable shadow mode flag → V8 stops processing in parallel
- Legacy responses are always returned regardless of shadow state
- Recovery time: < 1 minute

---

## 5. Monitoring Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| V8 error rate | > 10% | Auto-disable V8 for affected org |
| V8 p95 latency | > 500ms | Alert operator, investigate |
| Shadow mismatch rate | > 20% | Pause shadow mode, investigate |
| V8 health endpoint | `critical` | Alert operator immediately |
| Migration failure | Any | Block deployment, escalate |

---

## 6. Production Deployment Checklist (Railway-specific)

### Pre-deployment
- [ ] `DATABASE_PUBLIC_URL` configured for staging
- [ ] `ENABLE_V8_GLOBAL=false` (start disabled)
- [ ] `ENABLE_V8_SHADOW_MODE=false` (start disabled)
- [ ] All V8 migrations applied to staging (`v8-migrate.ts --apply`)
- [ ] Schema verification passes (`v8-migrate.ts --verify`)
- [ ] DbPromise placeholder translation implemented (CP-11 P0 fix)
- [ ] Full existing test suite passes
- [ ] All 114 closure tests pass

### Shadow mode activation (per-org)
- [ ] Set `ENABLE_V8_GLOBAL=true`
- [ ] Set `ENABLE_V8_SHADOW_MODE=true`
- [ ] Enable V8 for test org via admin API: `PUT /api/v8/admin/flags/chat { enabled: true }`
- [ ] Verify `/api/v8/health` returns 200 for test org
- [ ] Verify shadow comparisons are being recorded
- [ ] Monitor for 24 hours

### Shadow → live promotion
- [ ] Shadow promotion readiness check passes (5 criteria)
- [ ] Source-of-truth approval obtained
- [ ] Disable shadow mode for promoted org
- [ ] Enable V8 as primary for promoted org
- [ ] Monitor for 48 hours

---

## 7. Go/No-Go Decision

### Current assessment: **NO-GO**

**Reason:** CP-11 P0 blocker — DbPromise placeholder translation not yet implemented. 33 V8 services will fail on Postgres.

### What must happen before GO:
1. Implement `?` → `$N` translation in `DbPromise.ts`
2. Fix 3 specific DML issues (datetime, json_extract, LIKE)
3. Run V8 migrations on staging
4. Run V8 test suite against real Postgres
5. Verify `/api/v8/health` on staging
6. Verify existing test suite still passes

### Estimated time to GO: 2-3 working days (for DbPromise fix + verification)

---

## Related documents
- `CP-01-MIGRATION-VERIFICATION-REPORT.md`
- `CP-02-DB-VERIFICATION-REPORT.md`
- `CP-03-API-CONVENTION.md`
- `CP-04-AUTH-CONTRACT.md`
- `CP-08-SHADOW-PROMOTION-CRITERIA.md`
- `CP-11-POSTGRES-COMPATIBILITY-REPORT.md`
- `TRANCHE_01_EXECUTION_ORDER.md`
