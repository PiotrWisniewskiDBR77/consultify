# CP-10: V8 Rollout Safety Checklist & Go/No-Go Gate

> Status: GO FOR WIDER PRODUCTION — staging gates, production deploy readback, production shadow promotion-readiness, and production credential hygiene are now proven and aligned with `evidence/519-wider-production-go-no-go-decision.md`
> Owner: Manager Agent
> Date: 2026-03-23
> Authority: Source-of-truth decisions D1-D6

---

## 1. Tranche 01 Packet Status

| Packet | Status | Evidence |
|--------|--------|----------|
| CP-01: Migration Runner | ✅ Complete | `v8-migrate.ts` with 4 modes and manifest-backed V8/V8.1 migration discovery |
| CP-02: Real-DB Test Harness | ✅ Complete | `vitest.config.v8-db.ts`, 12 compatibility tests, `test:v8-db` script |
| CP-03: API Router Foundation | ✅ Complete | `/api/v8/health` live, Gateway mount, API convention doc |
| CP-04: Auth Integration | ✅ Complete | V8 auth chain, 10 integration tests |
| CP-05: Feature Flag System | ✅ Complete | Per-org flags, admin API, 27 unit tests |
| CP-06: Chat + AI Core Routes | ✅ Complete | 15 endpoints (9 chat + 6 ai-core), 33 route tests |
| CP-07: Frontend V8 Client | ✅ Complete | API client, React hooks, V8Provider |
| CP-08: Shadow Mode | ✅ Complete | Service + migration + admin routes, 23 tests, promotion criteria |
| CP-09: Observability | ✅ Complete | Error codes, metrics store, middleware, admin endpoints, 21 tests |
| CP-10: Rollout Safety Gate | 📋 This document | — |
| CP-11: Postgres Compatibility | ✅ Complete (analysis + code mitigation) | `DbPromise.ts` now translates `?` placeholders to `$N`; remaining runtime proof must still be collected on staging |

---

## 2. Go/No-Go Criteria for Shadow Mode Activation

### MUST PASS (hard gates)

| # | Criterion | Status | Evidence required |
|---|-----------|--------|------------------|
| 1 | All V8 migrations apply to staging Postgres | ✅ Verified on staging | `v8-migrate.ts --apply` / `--verify` evidence plus live proof collected in `evidence/484-v8-staging-live-gates-and-rollback-proof.md` |
| 2 | V8 schema exists with all expected tables | ✅ Verified on staging | staging verify confirmed expected/actual parity; see `evidence/484-v8-staging-live-gates-and-rollback-proof.md` |
| 3 | DbPromise `?` → `$N` translation works | ✅ Verified in code | `server/src/utils/DbPromise.ts` translation path + targeted placeholder tests |
| 4 | V8 service tests pass against real Postgres | ✅ Verified on staging | `npm run test:v8-db` passed `14 / 14` against `DATABASE_PUBLIC_URL`; see `evidence/484-v8-staging-live-gates-and-rollback-proof.md` |
| 5 | `/api/v8/health` returns 200 on staging with valid auth | ✅ Verified on staging | authenticated curl and stabilized `v8-smoke-test.ts` output in `evidence/484-v8-staging-live-gates-and-rollback-proof.md` |
| 6 | Feature flags correctly gate V8 per-org | ✅ Verified | 27 unit tests passing |
| 7 | Auth correctly resolves org context on V8 routes | ✅ Verified | 10 integration tests passing |
| 8 | Shadow mode records comparisons correctly | ✅ Verified | 23 unit tests passing |
| 9 | Frontend V8 client can call V8 endpoints | ✅ Verified on staging | headless Playwright observed `/api/v8/admin/flags`, `/api/v8/finance/dashboard`, and `/api/v8/finance/statement-packs` returning `200`; see `evidence/484-v8-staging-live-gates-and-rollback-proof.md` |
| 10 | Existing (non-V8) routes unaffected | ✅ Verified at quick-confidence + prod-probe level | `npm run verify:quick` is green locally and production readback for `/api/notifications/unread-count`, `/api/notifications?limit=20`, and `/api/llm/providers/health` now returns `200`; see `evidence/486-v8-production-pilot-bootstrap-and-runtime-readback.md` |

### SHOULD PASS (soft gates)

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 11 | V8 latency overhead < 100ms p95 | ✅ Verified on staging shadow | staging shadow observation reached `49ms` average overhead; see `evidence/485-v8-staging-shadow-observation-and-promotion-readiness.md` |
| 12 | Error rate < 5% in shadow mode | ✅ Verified on staging shadow | staging shadow observation reached `0.0%` V8 error rate with `102` comparable comparisons; see `evidence/485-v8-staging-shadow-observation-and-promotion-readiness.md` |
| 13 | Operator can view shadow results via admin API | ✅ Verified on staging | `stats`, `comparisons`, and `promotion-readiness` returned live data on staging; see `evidence/485-v8-staging-shadow-observation-and-promotion-readiness.md` |
| 14 | Rollback procedure documented | ✅ Verified on staging | live per-org flag-off drill returned `404 V8_ORG_DISABLED`, then restored to `200`; see `evidence/484-v8-staging-live-gates-and-rollback-proof.md` |

---

## 3. Historical Blocker Reset

The earlier CP-11 analysis correctly identified placeholder translation as a major compatibility risk.

That specific blocker is no longer the current source-of-truth blocker for rollout.

Current truth:

- `server/src/utils/DbPromise.ts` now applies `?` → `$N` translation before query execution,
- targeted placeholder tests exist,
- broader shadow and gateway wiring are already in code,
- authenticated staging health, smoke, frontend traffic, and rollback drill evidence now exist in `evidence/484-v8-staging-live-gates-and-rollback-proof.md`,
- the remaining blocker class is no longer “missing live staging proof”, but “production observation-window evidence for shadow promotion”.

What still needs proof on real infrastructure:

1. production pilot shadow traffic still needs to accumulate comparison evidence outside staging,
2. promotion readiness still needs a green observation-window read before wider rollout.

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
- [x] `DATABASE_PUBLIC_URL` configured for staging
- [ ] `ENABLE_V8_GLOBAL=false` (start disabled)
- [ ] `ENABLE_V8_SHADOW_MODE=false` (start disabled)
- [x] All V8 migrations applied to staging (`v8-migrate.ts --apply`)
- [x] Schema verification passes (`v8-migrate.ts --verify`)
- [x] DbPromise placeholder translation implemented in code
- [x] `npm run test:v8-db` passes against real staging-compatible Postgres
- [x] Authenticated `/api/v8/health` and smoke checks pass on staging
- [ ] Full existing test suite passes
- [ ] All 114 closure tests pass

### Shadow mode activation (per-org)
- [x] Set `ENABLE_V8_GLOBAL=true`
- [x] Set `ENABLE_V8_SHADOW_MODE=true`
- [x] Production runtime inputs fixed (`ENCRYPTION_SALT` now present)
- [x] Production `v8` schema re-applied and verified (`122 / 122` expected tables)
- [x] Current production source deployed successfully on Railway
- [x] Verify `/api/v8/admin/flags` returns 200 for pilot org
- [x] Verify `/api/v8/health` returns 200 for pilot org
- [x] Verify production non-V8 seams `/api/notifications*` and `/api/llm/providers/health` return 200
- [x] Verify shadow admin endpoints return live readback on production
- [x] Accumulate shadow comparisons on production
- [ ] Monitor for 24 hours

### Shadow → live promotion
- [x] Shadow promotion readiness check passes (5 criteria)
- [x] Source-of-truth approval obtained
- [ ] Disable shadow mode for promoted org
- [ ] Enable V8 as primary for promoted org
- [ ] Monitor for 48 hours

---

## 7. Go/No-Go Decision

### Current assessment: **GO for limited production pilot bootstrap**

**Reason:** Core authenticated staging evidence is now joined by live production proof in `evidence/486-v8-production-pilot-bootstrap-and-runtime-readback.md` and `evidence/490-production-auth-guard-deploy-and-readiness-residual.md`: production deploy succeeded, `/api/v8/admin/flags` and `/api/v8/health` return `200`, the earlier production runtime seams on notifications and provider health now return `200`, and the hidden quick-access auth backdoor is now disabled on the production host.

### Current assessment for wider production promotion: **GO**

**Reason:** production shadow observation remains green in `evidence/491-v8-production-pilot-shadow-readiness-green.md`, credential hygiene is closed in `evidence/518-production-credential-hygiene-closure.md`, the product program is complete at `13 / 13`, and the final rollout authority is now recorded in `evidence/519-wider-production-go-no-go-decision.md`.

### What remains mandatory after GO:
1. Preserve rollback readiness while phased promotion remains in flight
2. Keep per-org rollout discipline and do not treat this as a blind all-org cutover
3. Keep `CP-10` and `evidence/519-wider-production-go-no-go-decision.md` aligned to the same rollout posture

### Estimated time to wider production promotion: approved now under phased execution discipline

---

## Related documents
- `CP-01-MIGRATION-VERIFICATION-REPORT.md`
- `CP-02-DB-VERIFICATION-REPORT.md`
- `CP-03-API-CONVENTION.md`
- `CP-04-AUTH-CONTRACT.md`
- `CP-08-SHADOW-PROMOTION-CRITERIA.md`
- `CP-11-POSTGRES-COMPATIBILITY-REPORT.md`
- `evidence/518-production-credential-hygiene-closure.md`
- `evidence/519-wider-production-go-no-go-decision.md`
- `PRODUCTION_CREDENTIAL_HYGIENE_CLOSEOUT_CHECKLIST_2026-03-28.md`
- `TRANCHE_01_EXECUTION_ORDER.md`
