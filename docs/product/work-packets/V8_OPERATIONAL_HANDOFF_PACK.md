# V8 Operational Handoff Pack

> Date: 2026-03-23
> Owner: Manager Agent
> Purpose: Enable immediate staging execution the moment operational inputs arrive
> Status: READY — awaiting inputs

---

## 1. Current Blocked Status Interpretation

The V8 program is at a hard operational boundary:

| Dimension | Status |
|-----------|--------|
| Code | COMPLETE — 2713 tests, 0 regressions |
| Offline validation | COMPLETE — Tranches 01-05, 60+ new tests |
| Plans & checklists | COMPLETE — execution plan, evidence pack, pilot gate, runbook |
| Live staging evidence | ZERO — no execution has occurred |
| Pilot readiness | NOT ASSESSED — no evidence to evaluate |
| Production readiness | NOT ASSESSED — pilot must pass first |

**Blocker**: 6 operational inputs must be provided before any live execution can begin. These are infrastructure secrets and access confirmations that only platform ops can provide.

---

## 2. Operational Handoff Pack — Required Inputs

### INPUT 1: DATABASE_PUBLIC_URL

| Field | Value |
|-------|-------|
| **What** | Public PostgreSQL connection string for staging database |
| **Format** | `postgresql://user:password@host:port/dbname` |
| **Why needed** | V8 migrations create tables in a `v8` schema on this database. Without it, Step 1-3 cannot run. The `databaseTargetResolver.ts` will reject `*.railway.internal` hosts when run from outside Railway. |
| **Where used** | Steps 1, 2, 3 (preflight, migration apply, migration verify) |
| **Who provides** | Platform ops / Railway admin |
| **What blocks** | ALL execution — this is the first dependency in the chain |
| **Safety** | Must point to STAGING, not production. Verify hostname before use. |

### INPUT 2: Staging Server URL

| Field | Value |
|-------|-------|
| **What** | Base URL of the deployed staging server |
| **Format** | `https://<staging-hostname>` (no trailing slash) |
| **Why needed** | Smoke tests, flag management, shadow stats, and operator monitoring all hit live HTTP endpoints. |
| **Where used** | Steps 5, 6, 7, 8 (smoke tests, flags, shadow mode, evidence collection) |
| **Who provides** | Platform ops |
| **What blocks** | Steps 5-8 — cannot validate live API behavior |

### INPUT 3: JWT Token (test org)

| Field | Value |
|-------|-------|
| **What** | Valid JWT bearer token for a test organization on staging |
| **Format** | `eyJ...` (standard JWT) |
| **Required claims** | `organizationId` (string), `userId` (string) |
| **Why needed** | V8 endpoints require authenticated requests with org context. The `verifyToken` middleware extracts `organizationId` from the token. |
| **Where used** | Steps 5, 7 (smoke tests, shadow observation) |
| **Who provides** | Platform ops (generate via staging login or API) |
| **What blocks** | Steps 5-8 — cannot authenticate to V8 endpoints |

### INPUT 4: Superadmin JWT Token

| Field | Value |
|-------|-------|
| **What** | JWT token with superadmin privileges on staging |
| **Format** | `eyJ...` (standard JWT) |
| **Required claims** | `isSuperAdmin: true`, `organizationId` (string) |
| **Why needed** | Flag management (`PUT /api/v8/admin/flags/*`), shadow stats, metrics, and promotion readiness endpoints require superadmin auth via `requireSuperAdmin` middleware. |
| **Where used** | Steps 6, 7, 8 (flag management, shadow stats, evidence collection) |
| **Who provides** | Platform ops (generate via superadmin login) |
| **What blocks** | Steps 6-8 — cannot manage feature flags or read admin endpoints |

### INPUT 5: Test Organization ID

| Field | Value |
|-------|-------|
| **What** | UUID of a safe test organization on staging |
| **Format** | UUID string (e.g., `550e8400-e29b-41d4-a716-446655440000`) |
| **Why needed** | Feature flags are set per-org. We need a known org to enable V8 for, generate traffic, and observe shadow comparisons. |
| **Where used** | Steps 6, 7 (flag enablement, traffic generation) |
| **Who provides** | Platform ops |
| **What blocks** | Steps 6-8 — cannot scope V8 enablement |
| **Recommendation** | Use `dbr77` or `atelier` if they exist on staging. Must NOT be a customer-facing org. |

### INPUT 6: Environment Variable Access Confirmation

| Field | Value |
|-------|-------|
| **What** | Confirmation that the following can be set on staging and take effect after redeploy |
| **Variables** | `ENABLE_V8_GLOBAL=true`, `ENABLE_V8_SHADOW_MODE=true` |
| **Why needed** | V8 API namespace is gated by `ENABLE_V8_GLOBAL`. Shadow mode is gated by `ENABLE_V8_SHADOW_MODE`. Without setting these, the server will not expose V8 routes. |
| **Where used** | Step 4 (enable V8 + deploy) |
| **Who provides** | Platform ops / Railway admin |
| **What blocks** | Steps 4-8 — V8 routes will return 404 without global flag |
| **Rollback** | Setting `ENABLE_V8_GLOBAL=false` and redeploying disables all V8 instantly |

---

## 3. Execution Console Sheet

Copy-paste operational reference. Replace `<placeholders>` with actual values.

### Variables to set once

```
DB_URL=<DATABASE_PUBLIC_URL>
STAGING=<staging-server-url>
TOKEN=<jwt-token>
SA_TOKEN=<superadmin-jwt-token>
ORG_ID=<test-org-id>
```

### Step 1 — Pre-flight

```bash
cd server
DATABASE_PUBLIC_URL=$DB_URL npm run v8:preflight
```

| Check | Value |
|-------|-------|
| Success | `All checks passed` + `dry-run: X migrations would be applied` |
| Fail | Connection refused / URL validation error / Node version error |
| Stop if | Any critical check fails |
| Save | `> ../evidence/01-preflight.txt` |

### Step 2 — Migration dry-run

```bash
DATABASE_PUBLIC_URL=$DB_URL npx tsx scripts/v8-migrate.ts --dry-run
```

| Check | Value |
|-------|-------|
| Success | Lists all 47 migrations, no SQL errors |
| Fail | SQL transformation error / connection error |
| Stop if | Any transformation error |
| Save | `> ../evidence/02a-migration-dryrun.txt` |

### Step 3 — Migration apply

```bash
DATABASE_PUBLIC_URL=$DB_URL npx tsx scripts/v8-migrate.ts --apply
```

| Check | Value |
|-------|-------|
| Success | `47/47 migrations applied, 0 failed` |
| Fail | Any migration fails |
| Stop if | > 0 failed migrations |
| Save | `> ../evidence/02b-migration-apply.txt` |
| **CHECKPOINT — report to source-of-truth before continuing** |

### Step 4 — Migration verify

```bash
DATABASE_PUBLIC_URL=$DB_URL npx tsx scripts/v8-migrate.ts --verify
```

| Check | Value |
|-------|-------|
| Success | `Verification: PASS` |
| Fail | Missing tables or indexes |
| Stop if | Any critical table missing |
| Save | `> ../evidence/03-migration-verify.txt` |

### Step 5 — Enable V8 on staging

Set in Railway / staging env:
```
ENABLE_V8_GLOBAL=true
ENABLE_V8_SHADOW_MODE=true
```
Redeploy. Then:

```bash
curl -s $STAGING/api/v8/health -H "Authorization: Bearer $TOKEN" | jq .
```

| Check | Value |
|-------|-------|
| Success | 200, `version: v8`, `overall: healthy` or `not_ready` (tables may need first request) |
| Fail | 404 (flag not set) / 500 (crash) / connection refused |
| Stop if | Server won't start or health returns 500 |
| Save | `> ../evidence/04-enable-v8.txt` |
| **CHECKPOINT — report to source-of-truth before continuing** |

### Step 6 — Smoke tests

```bash
npm run v8:smoke-test -- --url $STAGING --token $TOKEN --json
```

| Check | Value |
|-------|-------|
| Success | All endpoints pass |
| Fail | Health non-200 / > 2 failures |
| Stop if | Health endpoint fails |
| Save | `> ../evidence/05-smoke-test.json` |

### Step 7 — Enable flags for test org

```bash
curl -s -X PUT "$STAGING/api/v8/admin/flags/chat" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

curl -s -X PUT "$STAGING/api/v8/admin/flags/ai_core" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Verify
curl -s "$STAGING/api/v8/admin/flags" \
  -H "Authorization: Bearer $SA_TOKEN" | jq .
```

| Check | Value |
|-------|-------|
| Success | 200, flags show `chat: true, ai_core: true` |
| Fail | 500 / flag not persisted |
| Stop if | Flag write fails |
| Save | `> ../evidence/06-flags.txt` |

### Step 8 — Shadow mode observation (24h)

Generate traffic: use chat as test org. Then check at 1h, 6h, 24h:

```bash
curl -s "$STAGING/api/v8/admin/shadow/stats" \
  -H "Authorization: Bearer $SA_TOKEN" | jq .
```

| Check | Value |
|-------|-------|
| Success | `totalComparisons > 0`, `matchRate` reported |
| Fail | `totalComparisons = 0` after traffic / V8 errors in legacy |
| Stop if | V8 errors affect legacy responses |
| Save | `> ../evidence/07-shadow-1h.txt`, `07-shadow-6h.txt`, `07-shadow-24h.txt` |
| **CHECKPOINT — report to source-of-truth before pilot gate** |

### Step 9 — Pilot gate assessment

```bash
curl -s "$STAGING/api/v8/admin/shadow/promotion-readiness" \
  -H "Authorization: Bearer $SA_TOKEN" | jq .

curl -s "$STAGING/api/v8/admin/health" \
  -H "Authorization: Bearer $SA_TOKEN" | jq .

curl -s "$STAGING/api/v8/admin/metrics" \
  -H "Authorization: Bearer $SA_TOKEN" | jq .
```

| Check | Value |
|-------|-------|
| Success | All 10 evidence categories have data, no no-go conditions |
| Save | `> ../evidence/08-pilot-gate.json` |

---

## 4. Ready-to-Execute Gate

### Mandatory prerequisites (ALL must be true)

| # | Prerequisite | Verified by |
|---|-------------|-------------|
| 1 | `DATABASE_PUBLIC_URL` provided and verified as staging | `echo $DB_URL` + hostname check |
| 2 | Staging server URL provided and reachable | `curl -I $STAGING` returns HTTP response |
| 3 | JWT token provided and valid | `echo $TOKEN \| cut -d. -f2 \| base64 -d` shows `organizationId` |
| 4 | Superadmin JWT provided and valid | Decoded token shows `isSuperAdmin: true` |
| 5 | Test org ID provided | Non-empty UUID |
| 6 | Env var access confirmed | Platform ops confirms in writing |
| 7 | `evidence/` directory created | `mkdir -p evidence && ls evidence/` |
| 8 | Rollback path confirmed | Can set `ENABLE_V8_GLOBAL=false` within 5 min |

### Nice-to-have prerequisites

| # | Prerequisite | Impact if missing |
|---|-------------|-------------------|
| 1 | Second operator available for 24h window | Single point of failure during observation |
| 2 | Staging has recent production-like data | Shadow comparisons may not be representative |
| 3 | Automated alerting configured | Manual monitoring required |

### No-go conditions

| Condition | Action |
|-----------|--------|
| `DATABASE_PUBLIC_URL` points to production | ABORT — verify hostname |
| JWT token expired | ABORT — get fresh token |
| Staging server unreachable | ABORT — fix infrastructure first |
| No rollback access | ABORT — cannot proceed without safe abort path |
| Staging DB has active production traffic | ABORT — use isolated staging instance |

### Who must confirm readiness

| Role | Confirms |
|------|----------|
| Platform ops | All 6 inputs provided, env var access confirmed |
| Manager agent | Gate checklist passed, evidence directory ready |
| Source-of-truth | Approval to proceed with staging execution |

### What can be validated before secrets

| Item | How |
|------|-----|
| Node version >= 18 | `node --version` |
| `v8:preflight` script exists | `npm run v8:preflight --help` (will fail without DB but confirms script exists) |
| Migration files present | `ls server/migrations/v8/` |
| Evidence directory structure | `mkdir -p evidence` |
| Smoke test script exists | `npm run v8:smoke-test --help` |
| Operator runbook reviewed | Read `CP-21-V8-OPERATOR-RUNBOOK.md` |

### What can only be validated after secrets

| Item | Why |
|------|-----|
| DB connectivity | Requires real `DATABASE_PUBLIC_URL` |
| Migration apply | Requires real DB |
| Endpoint responses | Requires real staging URL + token |
| Shadow mode behavior | Requires real traffic on real server |
| Flag persistence | Requires real DB + real superadmin token |

---

## 5. What Can Be Done While Waiting

### Already done

| Item | Status |
|------|--------|
| Execution plan (8 steps) | COMPLETE |
| Evidence pack definition (10 categories) | COMPLETE |
| Pilot readiness gate | COMPLETE |
| Operator runbook | COMPLETE |
| Contingency packet definitions | COMPLETE |
| Console sheet (copy-paste commands) | COMPLETE (this document) |
| Pre-execution checklist | COMPLETE |

### Can be done now (no secrets needed)

| Action | Purpose | Priority |
|--------|---------|----------|
| Create `evidence/` directory | Ready for artifact storage | P0 |
| Verify Node >= 18 locally | Confirm runtime compatibility | P0 |
| Verify migration file count | Confirm 47 files present | P0 |
| Review operator runbook | Ensure operator is prepared | P1 |
| Prepare incident note template | Ready for any staging issues | P1 |
| Verify `v8:preflight` script runs (fails on DB, but runs) | Confirm script integrity | P1 |

### NOT to be done

| Action | Why not |
|--------|---------|
| New feature development | No evidence that new code is needed |
| Additional test suites | 2713 tests is sufficient for staging entry |
| New shadow route mappings | Scope is locked for staging execution |
| UI changes | No staging evidence to justify changes |
| Architecture changes | Program is in operational phase, not development |

---

## 6. Live Execution Trigger Protocol

### When inputs arrive, this is the exact sequence:

```
PHASE 1: VALIDATION (automatic, no checkpoint needed)
├── Verify DB_URL is staging hostname (not production)
├── Verify JWT decodes with organizationId
├── Verify superadmin JWT has isSuperAdmin: true
├── Create evidence/ directory
└── Run: npm run v8:preflight

    IF preflight PASSES → continue
    IF preflight FAILS → STOP, report blocker

PHASE 2: MIGRATION (checkpoint after)
├── Run: v8-migrate.ts --dry-run
├── Review output
├── Run: v8-migrate.ts --apply
├── Run: v8-migrate.ts --verify
└── ★ CHECKPOINT: report migration results to source-of-truth
    
    GO / NO-GO decision required before continuing

PHASE 3: ACTIVATION (checkpoint after)
├── Set ENABLE_V8_GLOBAL=true on staging
├── Set ENABLE_V8_SHADOW_MODE=true on staging
├── Redeploy
├── Verify health endpoint
└── ★ CHECKPOINT: report activation results

    GO / NO-GO decision required before continuing

PHASE 4: VALIDATION (automatic, no checkpoint needed)
├── Run smoke tests
├── Enable flags for test org
└── Verify flag persistence

    IF smoke tests PASS → continue
    IF smoke tests FAIL → STOP, report blocker

PHASE 5: OBSERVATION (24h, checkpoints at 1h/6h/24h)
├── Generate traffic as test org
├── Check shadow stats at 1h
│   └── ★ CHECKPOINT: report 1h shadow stats
├── Check shadow stats at 6h
│   └── ★ CHECKPOINT: report 6h shadow stats
├── Check shadow stats at 24h
│   └── ★ CHECKPOINT: report 24h shadow stats
└── Check promotion readiness

PHASE 6: ASSESSMENT (final)
├── Compile evidence pack
├── Evaluate pilot gate
└── ★ FINAL CHECKPOINT: pilot readiness verdict
```

### Checkpoint rules

| After | Checkpoint type | Can continue automatically? |
|-------|----------------|---------------------------|
| Phase 1 (preflight) | Informational | YES — if all checks pass |
| Phase 2 (migration) | GO / NO-GO | NO — requires explicit approval |
| Phase 3 (activation) | GO / NO-GO | NO — requires explicit approval |
| Phase 4 (smoke + flags) | Informational | YES — if smoke tests pass |
| Phase 5 (1h observation) | Informational | YES — if no anomalies |
| Phase 5 (6h observation) | Informational | YES — if no anomalies |
| Phase 5 (24h observation) | GO / NO-GO | NO — requires explicit approval |
| Phase 6 (pilot gate) | FINAL VERDICT | NO — requires source-of-truth approval |

### Emergency stop at any point

```bash
# Disable V8 globally (< 1 minute)
# Set ENABLE_V8_GLOBAL=false in Railway → redeploy

# Disable V8 for specific org (< 1 minute)
curl -X PUT "$STAGING/api/v8/admin/flags/chat" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Full schema rollback (< 5 minutes, DESTRUCTIVE)
V8_ROLLBACK_CONFIRM=YES_DROP_ALL_V8_TABLES \
  DATABASE_PUBLIC_URL=$DB_URL \
  npx tsx scripts/v8-migrate.ts --rollback
```

---

## 7. Current Blocking Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Staging DB has schema conflicts | P1 | `--verify` after apply will detect; rollback available |
| Real Postgres rejects transformed SQL | P1 | `--dry-run` first; 10 offline transformation tests passed |
| JWT claims differ from test mocks | P1 | Decode and verify token structure before execution |
| Shadow interceptor silent on real middleware chain | P1 | Check shadow stats after 1h; integration test passed offline |
| Staging env vars cannot be changed | P0 | Blocks all execution — must be confirmed before start |
| 24h observation window unavailable | P2 | Can compress to 12h if all other evidence is strong |

---

## 8. Exact Inputs Still Required

| # | Input | Format | Provided? |
|---|-------|--------|-----------|
| 1 | `DATABASE_PUBLIC_URL` | `postgresql://user:pass@host:port/db` | NO |
| 2 | Staging server URL | `https://hostname` | NO |
| 3 | JWT token (test org) | `eyJ...` with `organizationId` | NO |
| 4 | Superadmin JWT token | `eyJ...` with `isSuperAdmin: true` | NO |
| 5 | Test org ID | UUID | NO |
| 6 | Env var access confirmation | Written confirmation | NO |

**0/6 inputs provided. Execution cannot begin.**

---

## 9. Recommended Next Action

**For source-of-truth / platform ops:**

Provide the 6 inputs listed above. The moment all 6 are available, live staging execution begins immediately — no additional planning, no additional code changes, no additional preparation needed.

Everything is ready. The only missing piece is infrastructure access.

---

## Operational Input Blocked Board — Report #10

### 1. Blocking inputs

| Input | Status |
|-------|--------|
| DATABASE_PUBLIC_URL | NOT PROVIDED |
| Staging server URL | NOT PROVIDED |
| JWT token (test org) | NOT PROVIDED |
| Superadmin JWT token | NOT PROVIDED |
| Test org ID | NOT PROVIDED |
| Env var access confirmation | NOT PROVIDED |

### 2. What is already ready

- Execution plan: 8 steps, fully documented
- Console sheet: copy-paste commands for each step
- Evidence pack: 10 categories with success/partial/fail criteria
- Pilot gate: entry criteria, no-go conditions, approval logic
- Operator runbook: monitoring, troubleshooting, rollback
- Contingency packets: 5 defined, none pre-created
- Trigger protocol: phase sequence with checkpoint rules
- Handoff pack: this document

### 3. What was prepared while waiting

- Operational handoff pack with exact input requirements
- Execution console sheet (copy-paste ready)
- Pre-execution gate with mandatory/nice-to-have/no-go
- Live execution trigger protocol with checkpoint rules
- Evidence artifact naming convention
- Emergency stop commands

### 4. What can start immediately once inputs arrive

Phase 1 (preflight) can start within minutes of receiving `DATABASE_PUBLIC_URL`. Full execution through Phase 4 can complete in approximately 2 hours. Phase 5 (24h observation) adds 24 hours.

### 5. Remaining execution risks

See section 7 above.

### 6. Recommended next action from source-of-truth

**Provide the 6 operational inputs to unblock staging execution.**
