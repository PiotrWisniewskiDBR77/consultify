# V8 Live Staging Execution + Pilot Readiness Gate

> Date: 2026-03-23
> Owner: Manager Agent
> Authority: Source-of-truth decisions D1-D6 + Tranche 04-05 evidence
> Status: AWAITING OPERATIONAL EXECUTION
> Prerequisite: Tranche 05 complete, offline validation passed (2713 tests, 0 regressions)

---

## 1. Operational Objective

Execute V8 against a real staging environment and collect hard evidence to answer one question:

**Is V8 pilot-ready?**

This is not a development phase. This is an operational validation phase. No new features. No scope expansion. Evidence collection only.

---

## 2. Why This Is the Correct Next Stage

| What we have | What we don't have |
|-------------|-------------------|
| 47 migration files validated offline | Migrations applied to real Postgres |
| 14 V8 endpoints tested via supertest | Endpoints responding on real server |
| Shadow interceptor mounted with 2 mappings | Shadow comparisons on real traffic |
| Rollback procedure tested in isolation | Rollback executed on real schema |
| Operator monitoring endpoints tested | Operator observing real metrics |
| 2713 tests passing | Zero evidence from live environment |

The gap is entirely operational. Code is ready. Infrastructure proof is missing.

---

## 3. Execution Sequence

### Step 1: Pre-flight Check

| Field | Value |
|-------|-------|
| **Purpose** | Verify environment configuration before touching the database |
| **Inputs required** | `DATABASE_PUBLIC_URL` set in shell environment |
| **Exact execution** | `cd server && DATABASE_PUBLIC_URL=<url> npm run v8:preflight` |
| **Expected success signals** | All checks pass: DB URL resolved, ENABLE_V8_GLOBAL configured, Node >= 18 |
| **Failure signals** | "No DATABASE_URL or DATABASE_PUBLIC_URL configured"; connection refused |
| **Immediate stop condition** | Any critical check fails → do not proceed to Step 2 |
| **Rollback action** | No changes made — nothing to roll back |
| **Evidence to capture** | Full preflight output (copy to `evidence/01-preflight.txt`) |

### Step 2: Migration Apply

| Field | Value |
|-------|-------|
| **Purpose** | Create `v8` schema and all V8 tables on staging Postgres |
| **Inputs required** | Step 1 passed; `DATABASE_PUBLIC_URL` set |
| **Exact execution** | `cd server && DATABASE_PUBLIC_URL=<url> npx tsx scripts/v8-migrate.ts --dry-run` (review output), then `DATABASE_PUBLIC_URL=<url> npx tsx scripts/v8-migrate.ts --apply` |
| **Expected success signals** | `47/47 migrations applied, 0 failed`; all CREATE TABLE statements succeed |
| **Failure signals** | Any migration fails; SQL syntax error; connection lost mid-migration |
| **Immediate stop condition** | > 0 failed migrations → run `--verify` to assess damage, then decide |
| **Rollback action** | `V8_ROLLBACK_CONFIRM=YES_DROP_ALL_V8_TABLES DATABASE_PUBLIC_URL=<url> npx tsx scripts/v8-migrate.ts --rollback` |
| **Evidence to capture** | Full apply output + verify output (copy to `evidence/02-migration-apply.txt` and `evidence/02-migration-verify.txt`) |

### Step 3: Migration Verify

| Field | Value |
|-------|-------|
| **Purpose** | Confirm all expected tables and indexes exist in the `v8` schema |
| **Inputs required** | Step 2 completed |
| **Exact execution** | `cd server && DATABASE_PUBLIC_URL=<url> npx tsx scripts/v8-migrate.ts --verify` |
| **Expected success signals** | `Verification: PASS`; expected tables = actual tables; 0 missing |
| **Failure signals** | Missing tables; missing indexes; table count mismatch |
| **Immediate stop condition** | Any missing table that is required by V8 routes |
| **Rollback action** | Investigate specific failure; re-run apply if partial; rollback if corrupt |
| **Evidence to capture** | Full verify output (copy to `evidence/03-migration-verify.txt`) |

### Step 4: Enable V8 Global + Deploy

| Field | Value |
|-------|-------|
| **Purpose** | Turn on V8 API namespace on staging |
| **Inputs required** | Step 3 passed; staging deployment access |
| **Exact execution** | Set `ENABLE_V8_GLOBAL=true` and `ENABLE_V8_SHADOW_MODE=true` in staging environment variables; redeploy/restart |
| **Expected success signals** | Server starts without errors; `/api/v8/health` returns 200 |
| **Failure signals** | Server crash on startup; health returns 500 or V8_DISABLED |
| **Immediate stop condition** | Server won't start → set `ENABLE_V8_GLOBAL=false` and redeploy |
| **Rollback action** | Set `ENABLE_V8_GLOBAL=false`; redeploy |
| **Evidence to capture** | Server startup logs; first health check response (copy to `evidence/04-enable-v8.txt`) |

### Step 5: Smoke Tests

| Field | Value |
|-------|-------|
| **Purpose** | Verify all V8 endpoints respond correctly on live staging |
| **Inputs required** | Step 4 completed; staging URL; valid JWT token |
| **Exact execution** | `cd server && npm run v8:smoke-test -- --url <staging-url> --token <jwt> --json > evidence/05-smoke-test.json` |
| **Expected success signals** | `10/10 smoke tests passed`; all endpoints return expected status codes |
| **Failure signals** | Health non-200; > 2 endpoint failures; auth failures |
| **Immediate stop condition** | Health endpoint fails → investigate before proceeding |
| **Rollback action** | Disable V8 global flag if smoke tests reveal critical issues |
| **Evidence to capture** | JSON smoke test output (copy to `evidence/05-smoke-test.json`) |

### Step 6: Enable Feature Flags for Test Org

| Field | Value |
|-------|-------|
| **Purpose** | Enable V8 features for a specific test organization |
| **Inputs required** | Step 5 passed; test org ID; superadmin JWT |
| **Exact execution** | `curl -X PUT <staging-url>/api/v8/admin/flags/chat -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"enabled": true}'` and same for `ai_core` |
| **Expected success signals** | 200 response; flags show `chat: true, ai_core: true` |
| **Failure signals** | 500 response; flag not persisted |
| **Immediate stop condition** | Flag write fails → check DB connectivity |
| **Rollback action** | PUT with `{"enabled": false}` to disable |
| **Evidence to capture** | Flag set response + flag read response (copy to `evidence/06-flags.txt`) |

### Step 7: Shadow Mode Activation + 24h Observation

| Field | Value |
|-------|-------|
| **Purpose** | Verify shadow mode records comparisons on real traffic |
| **Inputs required** | Step 6 completed; test org has real or simulated traffic |
| **Exact execution** | Shadow mode is already enabled via `ENABLE_V8_SHADOW_MODE=true`. Generate traffic by using the chat feature as the test org. After 24h, check: `curl <staging-url>/api/v8/admin/shadow/stats -H "Authorization: Bearer <token>"` |
| **Expected success signals** | `totalComparisons > 0`; `matchRate` reported; no V8 errors leaking to legacy |
| **Failure signals** | `totalComparisons = 0` after traffic; V8 errors in legacy responses; shadow interceptor not firing |
| **Immediate stop condition** | V8 errors affect legacy responses → disable shadow mode immediately |
| **Rollback action** | Set `ENABLE_V8_SHADOW_MODE=false`; redeploy |
| **Evidence to capture** | Shadow stats at 1h, 6h, 24h intervals; any error logs (copy to `evidence/07-shadow-*.txt`) |

### Step 8: Evidence Collection + Pilot Gate Assessment

| Field | Value |
|-------|-------|
| **Purpose** | Compile full evidence pack and make pilot readiness determination |
| **Inputs required** | Steps 1-7 completed |
| **Exact execution** | Collect all evidence files; run promotion readiness check: `curl <staging-url>/api/v8/admin/shadow/promotion-readiness -H "Authorization: Bearer <token>"` |
| **Expected success signals** | All 10 evidence categories have data; no critical gaps |
| **Failure signals** | Any evidence category empty; any no-go condition triggered |
| **Immediate stop condition** | N/A — this is the assessment step |
| **Rollback action** | N/A |
| **Evidence to capture** | Complete evidence pack document (copy to `evidence/08-pilot-gate-assessment.md`) |

---

## 4. Pre-Execution Checklist

| # | Item | Required | How to verify | Owner | What blocks execution |
|---|------|----------|---------------|-------|----------------------|
| 1 | `DATABASE_PUBLIC_URL` available | YES | `echo $DATABASE_PUBLIC_URL` returns valid postgres:// URL | Platform ops | Cannot run migrations without it |
| 2 | DB URL points to staging (not production) | YES | Verify hostname is staging instance, not prod | Platform ops | Running against prod is a P0 safety violation |
| 3 | Staging server URL known | YES | `curl <staging-url>/api/v8/health` (expect 404 if V8 not yet enabled) | Platform ops | Cannot run smoke tests |
| 4 | Valid JWT token for staging | YES | Token decodes correctly; has `organizationId` claim | Platform ops | Cannot authenticate to V8 endpoints |
| 5 | Superadmin JWT for flag management | YES | Token has `isSuperAdmin: true` | Platform ops | Cannot enable per-org flags |
| 6 | Test org ID identified | YES | Known org that is safe for testing | Platform ops | Cannot scope flag enablement |
| 7 | `ENABLE_V8_GLOBAL` can be set on staging | YES | Access to Railway/staging env vars | Platform ops | Cannot activate V8 namespace |
| 8 | `ENABLE_V8_SHADOW_MODE` can be set | YES | Same as above | Platform ops | Cannot activate shadow mode |
| 9 | Server can be redeployed after env change | YES | Deployment pipeline works | Platform ops | Cannot apply env var changes |
| 10 | Rollback access confirmed | YES | Can set `ENABLE_V8_GLOBAL=false` and redeploy within 5 min | Platform ops | No safe abort path |
| 11 | Evidence storage location ready | YES | `mkdir -p evidence/` in project root | Manager agent | Cannot store proof |
| 12 | Operator has access to monitoring endpoints | YES | Can call `/api/v8/admin/*` with superadmin token | Platform ops | Cannot observe system |

---

## 5. Evidence Pack Definition

### E1: Migration Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| All 47 migrations applied | 47/47 applied, 0 failed | > 40 applied, < 5 failed (non-critical) | > 5 failed OR any critical table missing |
| Schema `v8` exists | Schema present | N/A | Schema not created |
| Verify passes | `PASS` verdict | Some extra tables, 0 missing | Missing tables detected |

### E2: Schema / Table Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| Expected table count matches | Actual = Expected | Actual > Expected (extra OK) | Actual < Expected |
| Key tables exist | `v8_context_snapshots`, `v8_feature_flags`, `v8_shadow_comparisons` all present | 2/3 present | Any key table missing |
| Indexes created | All indexes present | > 80% present | < 80% present |

### E3: API Route Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| Health returns 200 | 200 with `version: v8` | 200 but degraded status | Non-200 or timeout |
| All smoke endpoints respond | 10/10 pass | 8-9/10 pass (non-critical failures) | < 8/10 pass |
| Auth chain works | Authenticated requests succeed; unauthenticated get 401 | N/A | Auth bypass or 500 on valid token |

### E4: Smoke Test Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| JSON output captured | Full JSON with all results | Partial output | No output or script error |
| All expected status codes match | 100% match | > 80% match | < 80% match |
| Response times reasonable | All < 2000ms | Some > 2000ms but < 5000ms | Any timeout |

### E5: Shadow Mode Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| Comparisons recorded | `totalComparisons > 0` after traffic | Comparisons recorded but low count | 0 comparisons after confirmed traffic |
| Legacy unaffected | Legacy responses identical with/without shadow | N/A | Legacy responses changed or errored |
| V8 error rate | < 20% | 20-50% | > 50% |

### E6: Flag Behavior Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| Flags persist after set | Read returns what was written | N/A | Flag not persisted |
| V8 disabled when flag off | 404 for disabled org | N/A | V8 responds when should be disabled |
| V8 enabled when flag on | 200 for enabled org | N/A | V8 blocked when should be enabled |

### E7: Operator Monitoring Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| Health endpoint works live | Returns real data | Returns but with errors | Does not respond |
| Metrics endpoint works live | Shows request counts | Shows zeros (no traffic yet) | Does not respond |
| Shadow stats work live | Shows comparison data | Shows zeros | Does not respond |

### E8: Error / Degraded-State Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| No unhandled exceptions | 0 uncaught errors in logs | < 3 non-critical errors | Any crash or data corruption |
| Graceful degradation | V8 errors don't affect legacy | Minor log noise | V8 errors leak to users |

### E9: Rollback Readiness Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| `ENABLE_V8_GLOBAL=false` disables V8 | All V8 routes return 404 | N/A | V8 still responds when disabled |
| Flag disable works | Per-org disable confirmed | N/A | Flag disable doesn't take effect |
| Schema rollback tested | Rollback drops all v8 tables | Partial drop | Rollback fails or leaves orphans |

### E10: 24h Observation Evidence

| Criterion | Success | Partial | Fail |
|-----------|---------|---------|------|
| No degradation over time | Metrics stable at 1h, 6h, 24h | Minor fluctuation | Progressive degradation |
| No memory leaks | Server memory stable | Slight increase (< 20%) | Continuous growth |
| Shadow mode stable | Comparison count grows steadily | Intermittent recording | Recording stops |

---

## 6. Pilot-Ready Gate

### Entry Criteria
1. All 8 execution steps completed
2. Evidence pack has data for all 10 categories
3. No no-go conditions triggered
4. Manager assessment completed

### Mandatory Evidence
- E1: Migration — PASS or PARTIAL (no FAIL)
- E3: API routes — PASS (health must be 200)
- E4: Smoke tests — PASS or PARTIAL (> 80%)
- E5: Shadow mode — at least PARTIAL (comparisons > 0)
- E9: Rollback — PASS (must be confirmed working)

### No-Go Conditions
- Any migration failure on a critical table (context_snapshots, feature_flags, shadow_comparisons)
- V8 errors leaking into legacy user responses
- Server crash or restart loop caused by V8
- Auth bypass discovered
- Data corruption in any table
- Rollback procedure fails

### Escalation Conditions
- Shadow mode match rate < 50% → investigate before proceeding
- V8 error rate > 30% → investigate before proceeding
- > 3 smoke test failures → investigate before proceeding
- Any evidence category at FAIL → block pilot, create fix packet

### What Can Still Be Partial
- Shadow mode comparison count (low traffic is OK if mechanism works)
- 24h observation (can be shortened to 12h if all other evidence is strong)
- Operator monitoring (endpoints work, even if metrics are low)

### What Absolutely Cannot Be Partial
- Migration success (all critical tables must exist)
- Health endpoint (must return 200)
- Rollback readiness (must be confirmed)
- Legacy isolation (V8 must not affect legacy responses)

### Approval Recommendation Logic
```
IF all mandatory evidence >= PARTIAL
AND zero no-go conditions
AND zero escalation conditions unresolved
THEN → GO FOR PILOT

IF any mandatory evidence = FAIL
OR any no-go condition triggered
THEN → NOT READY (create fix packet)

IF escalation conditions exist but resolved
AND all mandatory evidence >= PARTIAL
THEN → CONDITIONAL GO (document conditions)
```

---

## 7. Pilot Recommendation

### Tenant Profile
- **Type**: Internal team org (e.g., `dbr77` or `atelier`)
- **Why**: Known users, controllable traffic, fast feedback loop
- **Not**: Customer-facing org, demo org, or org with critical production workflows

### Pilot Scope
- **Modules**: Chat + AI Core only (per D1)
- **Features**: V8 context snapshots visible in chat header (V8ContextIndicator)
- **Shadow**: All mapped legacy endpoints compared in background
- **Duration**: Minimum 7 days shadow mode before any user-visible V8 feature

### Shadow Mode Before Pilot
- Minimum 7 days with `ENABLE_V8_SHADOW_MODE=true`
- Minimum 100 shadow comparisons
- Match rate must be >= 95% before enabling user-visible V8 features
- V8 error rate must be < 5%

### Success Metrics During Pilot
| Metric | Target | Measurement |
|--------|--------|-------------|
| Shadow match rate | >= 95% | `/api/v8/admin/shadow/stats` |
| V8 error rate | < 5% | `/api/v8/admin/shadow/stats` |
| V8 latency overhead | < 100ms | `/api/v8/admin/shadow/stats` |
| Recent mismatches (24h) | 0 | `/api/v8/admin/shadow/stats` |
| User-reported issues | 0 | Support channel |
| Server stability | No restarts caused by V8 | Server logs |

### Abort Conditions
1. V8 errors leak into legacy responses → immediate disable
2. Shadow match rate drops below 80% → investigate, disable if not resolved in 4h
3. V8 latency overhead > 200ms → investigate, disable if not resolved in 4h
4. Any user-reported regression → immediate disable
5. Server crash caused by V8 → immediate disable
6. Data corruption → immediate disable + rollback

### Pilot → Broader Rollout Criteria
ALL of the following must be true for 7 consecutive days:
1. Shadow match rate >= 95%
2. V8 error rate < 5%
3. V8 latency overhead < 100ms
4. Zero recent mismatches in last 24h
5. Zero user-reported issues
6. Operator confirms system is stable
7. Source-of-truth approves broader rollout

---

## 8. Residual Path to Full Production

Even after a successful pilot, the following gaps remain before `full production readiness`:

| Gap | Severity | What's needed |
|-----|----------|---------------|
| Only 1 UI surface consumes V8 | P1 | More chat surfaces, AI core surfaces |
| Only 2 shadow route mappings | P1 | Map all critical legacy → V8 flows |
| No mutation shadow mappings | P2 | Add POST/PUT shadow comparisons |
| No multi-org pilot data | P1 | Expand pilot to 2-3 orgs |
| No load testing | P2 | Verify V8 under production traffic levels |
| No full browser E2E test | P2 | Automated browser test for V8ContextIndicator |
| Interview/Help/Partner not V8 | Info | Per D4, these are later onboarding waves |

### What `pilot-ready` means
- V8 works on staging
- Shadow mode proves V8 matches legacy
- One internal org can safely use V8 features
- Rollback is confirmed working
- Operator can monitor and respond

### What `full production-ready` means (NOT yet)
- Multiple orgs tested
- All critical legacy flows shadowed
- Load tested
- Full UI integration (not just 1 indicator)
- Legacy cutover plan executed
- Support model trained

---

## 9. Possible Contingency Packets

| Packet | Trigger | Type | Scope |
|--------|---------|------|-------|
| CP-FIX-01: Migration repair | Migration fails on staging | code-eligible | Fix specific SQL that fails on real Postgres |
| CP-FIX-02: Shadow interceptor fix | Shadow mode doesn't fire on real traffic | code-eligible | Debug middleware chain in production context |
| CP-FIX-03: Auth chain fix | Auth fails on staging but works in tests | code-eligible | Fix JWT validation in real environment |
| CP-FIX-04: Performance fix | V8 latency overhead > 200ms | code-eligible | Optimize slow V8 service queries |
| CP-FIX-05: Rollback repair | Rollback procedure fails on real schema | code-eligible | Fix CASCADE or table dependency issues |

These are contingency only. They should NOT be pre-created. They should be created only if staging execution reveals the specific problem.

---

## 10. Recommended Start Conditions

### When to start
- All 12 pre-execution checklist items are confirmed
- Platform ops confirms staging DB access
- At least 2 hours of uninterrupted execution time available
- Operator is available for 24h observation period

### Who needs to be involved
- **Manager agent**: Executes steps, collects evidence, makes assessment
- **Platform ops**: Provides DB URL, staging URL, JWT tokens, env var access
- **Source-of-truth**: Approves pilot after evidence review

### What to do first
1. Confirm `DATABASE_PUBLIC_URL` is available and points to staging
2. Run `npm run v8:preflight` — if it passes, proceed
3. If it fails, stop and resolve the blocker before continuing

---

## Operational Staging Execution Board — Report #9 (Pre-Execution)

### 1. Current live readiness
**AWAITING OPERATIONAL INPUTS** — all code is ready, no live evidence yet.

### 2. Execution step completed
None — execution has not started.

### 3. Execution step blocked
**Step 1 (Pre-flight)** — blocked on `DATABASE_PUBLIC_URL` availability.

### 4. Evidence collected
None — no live execution performed.

### 5. Failures or anomalies
None — no live execution performed.

### 6. Shadow mode status
**NOT ACTIVE** — `ENABLE_V8_GLOBAL` is not set on staging.

### 7. Operator observation status
**NOT STARTED** — no live system to observe.

### 8. Pilot gate status
**NOT ASSESSED** — no evidence to evaluate.

### 9. Residual risks
- Staging DB may have schema conflicts with existing tables
- Real Postgres may reject SQL that passed offline transformation
- JWT tokens may have different claims than test mocks
- Shadow interceptor may behave differently under real Express middleware chain

### 10. Recommended next action
**Provide `DATABASE_PUBLIC_URL` and staging access credentials to begin execution.**
