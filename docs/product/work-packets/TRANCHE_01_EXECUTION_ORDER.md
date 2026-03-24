# Tranche 01 — Execution Order & Worker Assignments

> Status: ACTIVE
> Date: 2026-03-23
> Authority: Source-of-truth decisions D1-D6 (approved)
> Mode: Closure Execution

---

## 1. Decision lock summary

All 6 decisions from `V8_DECISION_PACKAGE_POST_AUDIT.md` are hereby locked as operational direction:

| Decision | Locked value | Operational consequence |
|----------|-------------|------------------------|
| **D1** | Chat + AI Core first | CP-06 targets `chatExecutionService`, `contextSnapshotService`, `contextConsumerBindingService`, `aiOperatingEnvironmentService`, `trustAuditService`, `toolGovernanceService` |
| **D2** | Phased replacement with shadow mode | CP-08 is in scope; legacy routes stay active; V8 routes are additive under `/api/v8/` |
| **D3** | 8-week conditional target | Calendar deadline: ~2026-05-18; conditional on exit criteria, not a hard promise |
| **D4** | Interview/Help/Partner deferred | No V8 backend services for these modules in Tranche 01; no route scaffolding |
| **D5** | Extend existing Socket.io | Multiplayer WebSocket work uses existing `collaborativeSession.gateway.ts` pattern; marked as **transitional** — not the V8 target standard |
| **D6** | Separate `v8` schema in same Postgres | All 45 `v8_*` migrations target a `v8` schema; `search_path` must be set for V8 queries |

---

## 2. Canonical docs to update

| Document | Update needed | Reason |
|----------|--------------|--------|
| `DOCUMENTATION_REGISTRY.md` | Add entries for all 4 new closure docs | New operational docs not yet registered |
| `V8_IMPLEMENTATION_MASTER_PROGRAM.md` | Add section 16: "Post-20-wave closure program reference" | Program has entered a new phase |
| `IMPLEMENTATION_CONTROL_BOARD.md` | Already updated to closure execution mode | Done |
| `FeatureFlags.ts` | Will be modified by CP-05 | V8 flags don't exist yet |
| `Gateway.ts` | Will be modified by CP-03 | V8 router mount doesn't exist yet |

---

## 3. Decision impact map

```
D6 (v8 schema) ──→ CP-01 (migration runner must target v8 schema)
                ──→ CP-02 (test harness must set search_path)
                ──→ CP-11 (Postgres adaptation must handle schema prefix)

D1 (Chat first) ──→ CP-06 (routes for Chat + AI Core services)
                ──→ CP-07 (frontend client for Chat)

D2 (shadow mode) ──→ CP-08 (shadow mode infrastructure)
                 ──→ CP-03 (V8 routes are additive, not replacement)
                 ──→ CP-05 (shadow mode flag needed)

D3 (8-week target) ──→ CP-10 (go/no-go gate at week 6-7)
                   ──→ All packets must complete within ~3 weeks for Phase 1

D5 (Socket.io extend) ──→ NOT in Tranche 01 (multiplayer is later)
                       ──→ Marked as transitional in all docs

D4 (defer peripherals) ──→ No packets for Interview/Help/Partner
```

---

## 4. Packets now unblocked

| Packet | Status | Unblocked by |
|--------|--------|-------------|
| **CP-01** | **READY TO START** | D6 (schema strategy confirmed) |
| **CP-03** | **READY TO START** | D2 (additive routes confirmed) |
| **CP-05** | **READY TO START** | D2 (shadow mode flag confirmed), D1 (module flags confirmed) |
| CP-09 | Ready after CP-01 + CP-03 partial | D6 (health check needs schema) |

---

## 5. Packets still gated

| Packet | Gate | Condition |
|--------|------|-----------|
| CP-02 | CP-01 must complete | Migrations must be applied before test harness runs |
| CP-04 | CP-03 must complete | Router must exist before auth can be tested on it |
| CP-06 | CP-03 + CP-04 must complete | Router + auth must exist before domain routes |
| CP-07 | CP-05 + CP-06 must complete | Flags + routes must exist before frontend client |
| CP-08 | CP-03 + CP-05 must complete | Router + flags must exist before shadow mode |
| CP-10 | All CP-01 through CP-09 + CP-11 | Manager-owned gate, not delegated |
| CP-11 | CP-02 must complete | Postgres compatibility report determines scope |

---

## 6. Tranche 01 objective

Bring V8 from `implemented` (level 2/8) to `wired` (level 3/8) for Chat + AI Core. Specifically: real database tables exist on Railway Postgres, API routes expose Chat + AI Core services behind auth and feature flags, a frontend client can call those routes, and shadow mode infrastructure enables safe parallel execution.

---

## 7. Execution order

```
Day 1-3:   CP-01 (Migration Runner) ║ CP-03 (API Router)
Day 2-4:   CP-05 (Feature Flags) — starts Day 2, parallel with CP-01/CP-03
Day 4-6:   CP-02 (Real-DB Tests) — after CP-01 ║ CP-04 (Auth) — after CP-03
Day 5-8:   CP-09 (Observability) — after CP-01 partial + CP-03
Day 7-10:  CP-06 (Chat Routes) — after CP-03 + CP-04
Day 7-10:  CP-08 (Shadow Mode) — after CP-03 + CP-05
Day 7-12:  CP-11 (Postgres Fixes) — after CP-02, scope variable
Day 10-14: CP-07 (Frontend Client) — after CP-05 + CP-06
Day 14-16: CP-10 (Go/No-Go Gate) — manager-owned, after all others
```

---

## 8. Parallel start group

| Worker | Day 1 | Day 4 | Day 7 | Day 10 |
|--------|-------|-------|-------|--------|
| Worker 1 | CP-01 | CP-02 | CP-11 | CP-10 (assist) |
| Worker 2 | CP-03 | CP-04 | CP-06 | CP-07 |
| Worker 3 | CP-05 (Day 2) | CP-09 | CP-08 | CP-10 (assist) |

Maximum 3 concurrent workers. No worker is idle for more than 1 day.

---

## 9. Dependency chain

```
CP-01 ──→ CP-02 ──→ CP-11 ──→ CP-10
CP-03 ──→ CP-04 ──→ CP-06 ──→ CP-07 ──→ CP-10
CP-05 ──→ CP-07
CP-05 ──→ CP-08
CP-01 + CP-03 ──→ CP-09

Critical path (longest): CP-03 → CP-04 → CP-06 → CP-07 → CP-10
Calendar length: ~16 working days
```

---

## 10. Worker-ready assignments

Three packets are ready for immediate assignment. Full briefs below.

---

## 11. Assignment brief: CP-01 — V8 Migration Runner

### 1. Packet name
CP-01: V8 Migration Runner & Schema Verification

### 2. Objective
Create a migration runner that applies all 45 `v8_*` SQL migrations to Railway Postgres in a dedicated `v8` schema, verify schema correctness, and produce a verification report.

### 3. Why this matters now
Every other packet depends on V8 tables existing in the real database. Today, 45 migration files exist as SQL but have never been executed against any real database. Without this, V8 services remain test-only code.

### 4. Exact scope
- Audit all 45 files in `server/migrations/20260323_v8_*.sql` for Postgres compatibility
- All migrations use `CREATE TABLE IF NOT EXISTS` (confirmed by audit) — verify `ALTER TABLE` and `CREATE INDEX` statements are also idempotent
- Create `server/scripts/v8-migrate.ts` with modes: `--dry-run`, `--apply`, `--verify`, `--rollback`
- The script must:
  - Connect via `DATABASE_PUBLIC_URL` (never `*.railway.internal` from local — per `.cursorrules`)
  - Create schema `v8` if not exists: `CREATE SCHEMA IF NOT EXISTS v8`
  - Set `search_path` to `v8,public` before running migrations
  - Execute migrations in lexicographic filename order (all share `20260323_` prefix)
  - Log each migration: filename, status (applied/skipped/failed), duration
- Create `server/migrations/v8-manifest.json` listing all 45 files in order
- Run the full set against staging Railway Postgres
- Produce `docs/product/work-packets/CP-01-MIGRATION-VERIFICATION-REPORT.md`

### 5. Out of scope
- Modifying existing non-V8 migrations
- Data seeding or fixture loading
- Performance tuning
- Modifying V8 service code
- Any migration for tables not prefixed with `v8_`

### 6. Required docs
- `.cursorrules` — Railway DB targeting rules (MUST read before any DB operation)
- `server/src/config/databaseTargetResolver.ts` — DB URL resolution logic
- `server/migrations/20260323_v8_*.sql` — all 45 files

### 7. Required code areas
- `server/migrations/` — all V8 SQL files
- `server/src/config/databaseTargetResolver.ts` — use `resolveReachableDatabaseUrl()` for connection
- `server/src/utils/DbPromise.ts` — understand the DB abstraction (uses `information_schema.tables` for `tableExists`, supports `$1` placeholders)

### 8. Dependencies
None — this is a root packet.

### 9. Expected deliverables
1. `server/scripts/v8-migrate.ts` — migration runner script
2. `server/migrations/v8-manifest.json` — ordered migration list
3. `docs/product/work-packets/CP-01-MIGRATION-VERIFICATION-REPORT.md` — schema verification report with:
   - Table count created
   - Index count created
   - Any ALTER TABLE results
   - Any errors or warnings
   - Idempotency verification (second run produces no errors)

### 10. Definition of done
- [ ] All 45 V8 migrations apply cleanly to staging Railway Postgres
- [ ] Schema `v8` exists and contains all expected tables
- [ ] Dry-run mode produces DDL output without side effects
- [ ] Re-running is idempotent (zero errors on second run)
- [ ] Verification report confirms all `v8_*` tables exist with correct columns
- [ ] Script uses `DATABASE_PUBLIC_URL`, never `*.railway.internal` from local
- [ ] Rollback mode can drop all `v8_*` tables (with confirmation prompt)

### 11. Evidence to return
- Console output of successful migration run
- Console output of idempotent re-run
- Schema verification report (markdown)
- `\dt v8.*` output from Postgres showing all tables

### 12. Escalation conditions
- If any migration references non-`v8_*` tables that don't exist → STOP, report missing dependency
- If `DATABASE_PUBLIC_URL` is not configured → STOP, escalate to infra
- If any migration has Postgres-incompatible syntax (e.g., SQLite-specific) → fix in-place, document in report
- If schema creation is blocked by permissions → escalate to infra

### 13. Required report format
```
## CP-01 Migration Verification Report
### Run summary
- Date:
- Target: staging Railway Postgres
- Schema: v8
- Migrations attempted: 45
- Migrations succeeded:
- Migrations failed:
- Tables created:
- Indexes created:
### Idempotency check
- Second run errors: 0 / N
### Issues found
- (list any)
### Postgres compatibility notes
- (list any SQLite-specific syntax found and fixed)
```

---

## 12. Assignment brief: CP-03 — V8 API Router Foundation

### 1. Packet name
CP-03: V8 API Router Foundation

### 2. Objective
Create the Express router infrastructure for V8 API routes under `/api/v8/`, wire it into the existing Gateway, and establish the first V8 endpoint (health check).

### 3. Why this matters now
V8 has 34 services and 413 functions but zero API routes. The existing app has 370+ route files mounted via `Gateway.ts` using `app.use('/api/<prefix>', router)`. This packet creates the V8 namespace so domain routes (CP-06) can be added.

### 4. Exact scope
- Create `server/src/routes/v8/index.ts` — V8 router aggregator using `Router()` from Express
- Create `server/src/routes/v8/health.routes.ts` — first V8 route:
  - `GET /api/v8/health` — calls `platformHealthService.getPlatformHealth(orgId)` and returns result
  - Protected by `verifyToken` from `server/src/middleware/auth.middleware.ts`
  - Uses `req.organizationId` (set by auth middleware, confirmed in `auth.middleware.ts` line ~200)
- Create `server/src/middleware/v8FeatureGate.middleware.ts` — middleware that:
  - Checks if V8 is globally enabled (env var `ENABLE_V8_GLOBAL`)
  - If disabled, returns `{ error: 'V8 features not available', code: 'V8_DISABLED' }` with 404
  - This is a placeholder; CP-05 will add per-org/per-module granularity
- Wire into Gateway: add to `server/src/Gateway.ts` method `initializeRoutes`:
  ```
  app.use('/api/v8', v8FeatureGate, v8Router);
  ```
  Place after existing route mounts, before error handlers.
- Create `docs/product/work-packets/CP-03-API-CONVENTION.md` documenting:
  - URL pattern: `/api/v8/<domain>/<resource>`
  - Auth: all routes use `verifyToken` (from existing middleware)
  - Org context: `req.organizationId` from JWT
  - Response envelope: `{ data, error, meta }`
  - Error format: `{ error: string, code: string, details?: unknown }`

### 5. Out of scope
- Domain-specific routes (Chat, AI Core, etc.) — that's CP-06
- Per-org feature flags — that's CP-05
- WebSocket routes
- Rate limiting specific to V8
- Frontend client code

### 6. Required docs
- `server/src/Gateway.ts` — understand `initializeRoutes` pattern (line ~264)
- `server/src/middleware/auth.middleware.ts` — `verifyToken` export, `AuthRequest` type, `req.organizationId`
- `server/src/routes/audit-events.routes.ts` — reference for route file pattern (`Router()` + `verifyToken` + `asyncHandler`)
- `server/src/services/v8/platformHealthService.ts` — first service to expose

### 7. Required code areas
- `server/src/Gateway.ts` — add V8 mount
- `server/src/routes/` — create `v8/` subdirectory
- `server/src/middleware/` — create V8 feature gate
- `server/src/services/v8/platformHealthService.ts` — import for health route

### 8. Dependencies
None — can run in parallel with CP-01.

### 9. Expected deliverables
1. `server/src/routes/v8/index.ts`
2. `server/src/routes/v8/health.routes.ts`
3. `server/src/middleware/v8FeatureGate.middleware.ts`
4. Modified `server/src/Gateway.ts` (V8 router mount added)
5. `docs/product/work-packets/CP-03-API-CONVENTION.md`

### 10. Definition of done
- [ ] `GET /api/v8/health` returns 200 with platform health data when `ENABLE_V8_GLOBAL=true` and valid auth token
- [ ] `GET /api/v8/health` returns 404 when `ENABLE_V8_GLOBAL=false`
- [ ] `GET /api/v8/health` returns 401 without auth token
- [ ] Existing routes (all 370+ non-V8 routes) are unaffected
- [ ] V8 router is cleanly mountable and removable
- [ ] API convention document covers URL pattern, auth, response envelope, error format

### 11. Evidence to return
- `curl` output showing 200 response from `/api/v8/health` with valid token
- `curl` output showing 404 when V8 disabled
- `curl` output showing 401 without token
- Confirmation that existing test suite still passes
- API convention document

### 12. Escalation conditions
- If `Gateway.ts` architecture doesn't support clean namespace mounting → propose refactor, don't force
- If `verifyToken` middleware has side effects that conflict with V8 → document and escalate
- If `platformHealthService` throws because V8 tables don't exist yet → handle gracefully (return `{ status: 'tables_not_ready' }`)

### 13. Required report format
```
## CP-03 API Router Foundation Report
### Deliverables
- Files created: (list)
- Files modified: (list)
### Verification
- Health endpoint 200: (pass/fail)
- Health endpoint 404 (disabled): (pass/fail)
- Health endpoint 401 (no auth): (pass/fail)
- Existing routes unaffected: (pass/fail)
### Notes
- (any issues found)
```

---

## 13. Assignment brief: CP-05 — V8 Feature Flag System

### 1. Packet name
CP-05: V8 Feature Flag System

### 2. Objective
Extend the existing feature flag system to support V8 module-level and per-org feature gating, enabling phased rollout with shadow mode control.

### 3. Why this matters now
The existing `FeatureFlags.ts` has 7 boolean env-var flags with no per-org granularity. V8 needs: (a) global V8 kill switch, (b) per-module flags (Chat V8, AI Core V8), (c) per-org override capability, (d) shadow mode flag. Without this, no controlled rollout is possible.

### 4. Exact scope
- Extend `server/src/config/FeatureFlags.ts`:
  - Add `ENABLE_V8_GLOBAL: boolean` (env var, default false)
  - Add `ENABLE_V8_SHADOW_MODE: boolean` (env var, default false)
  - Keep existing 7 flags unchanged
- Create `server/src/services/v8/featureFlagService.ts`:
  - `isV8Enabled(organizationId: string, module?: string): Promise<boolean>` — checks global + per-org + per-module
  - `getV8Flags(organizationId: string): Promise<Record<string, boolean>>` — all V8 flags for an org
  - `setV8OrgFlag(organizationId: string, module: string, enabled: boolean): Promise<void>` — set per-org override
  - `isV8ShadowMode(organizationId: string): Promise<boolean>` — check shadow mode for org
- Create `server/migrations/20260324_v8_feature_flags.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS v8_feature_flags (
    flag_id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    module TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    updated_by TEXT,
    UNIQUE(organization_id, module)
  );
  CREATE INDEX IF NOT EXISTS idx_v8_ff_org ON v8_feature_flags(organization_id);
  ```
- Update `server/src/middleware/v8FeatureGate.middleware.ts` (created by CP-03):
  - Replace env-var-only check with `featureFlagService.isV8Enabled(req.organizationId)`
  - Add `req.v8ShadowMode = await featureFlagService.isV8ShadowMode(req.organizationId)`
- Create `server/src/routes/v8/admin/feature-flags.routes.ts`:
  - `GET /api/v8/admin/flags` — list all V8 flags for current org
  - `PUT /api/v8/admin/flags/:module` — toggle a V8 flag for current org
  - Protected by `verifyToken` + `requireSuperAdmin` (from existing auth middleware)
- Create `server/src/services/v8/__tests__/featureFlagService.test.ts` — unit tests

### 5. Out of scope
- Percentage-based rollout (binary per-org for now)
- A/B testing framework
- Feature flag UI in frontend (later tranche)
- Flags for non-V8 features
- Modifying existing 7 feature flags

### 6. Required docs
- `server/src/config/FeatureFlags.ts` — existing flag system (7 flags, Zod schema, env-var based)
- `server/src/middleware/v8FeatureGate.middleware.ts` — from CP-03 (will be updated)
- `server/src/middleware/auth.middleware.ts` — `requireSuperAdmin` export for admin routes

### 7. Required code areas
- `server/src/config/FeatureFlags.ts` — extend with V8 flags
- `server/src/services/v8/` — create featureFlagService
- `server/src/middleware/` — update v8FeatureGate
- `server/src/routes/v8/admin/` — create flag admin routes
- `server/migrations/` — create flag table migration

### 8. Dependencies
- CP-03 must be at least partially complete (v8FeatureGate middleware must exist)
- Can start Day 2 while CP-03 is in progress

### 9. Expected deliverables
1. Updated `server/src/config/FeatureFlags.ts`
2. `server/src/services/v8/featureFlagService.ts`
3. `server/migrations/20260324_v8_feature_flags.sql`
4. Updated `server/src/middleware/v8FeatureGate.middleware.ts`
5. `server/src/routes/v8/admin/feature-flags.routes.ts`
6. `server/src/services/v8/__tests__/featureFlagService.test.ts`

### 10. Definition of done
- [ ] `ENABLE_V8_GLOBAL=false` blocks all V8 routes regardless of per-org flags
- [ ] `ENABLE_V8_GLOBAL=true` + no per-org flag → V8 disabled for that org (opt-in model)
- [ ] `ENABLE_V8_GLOBAL=true` + per-org flag `chat=true` → Chat V8 enabled for that org only
- [ ] Shadow mode flag is queryable and propagated to request context (`req.v8ShadowMode`)
- [ ] Admin API requires superadmin auth
- [ ] Admin API can list and toggle flags per org
- [ ] Existing 7 feature flags are completely unaffected
- [ ] Unit tests cover all flag resolution logic including edge cases

### 11. Evidence to return
- Unit test output (all passing)
- `curl` showing admin flag toggle
- `curl` showing V8 route blocked when flag disabled
- `curl` showing V8 route allowed when flag enabled
- Confirmation existing feature flags unchanged

### 12. Escalation conditions
- If per-org DB storage conflicts with existing config architecture → propose design, don't force
- If `v8FeatureGate` middleware from CP-03 doesn't exist yet → coordinate with CP-03 worker, use env-var fallback
- If shadow mode requires changes to legacy route handlers → document scope, escalate

### 13. Required report format
```
## CP-05 Feature Flag System Report
### Deliverables
- Files created: (list)
- Files modified: (list)
### Flag resolution matrix
| Global | Per-org | Result |
|--------|---------|--------|
| false  | any     | disabled |
| true   | unset   | disabled (opt-in) |
| true   | true    | enabled |
| true   | false   | disabled |
### Verification
- Global disable blocks all: (pass/fail)
- Per-org enable works: (pass/fail)
- Shadow mode flag propagates: (pass/fail)
- Admin API requires superadmin: (pass/fail)
- Existing flags unaffected: (pass/fail)
### Unit test results
- Tests: N passed, 0 failed
```

---

## 14. Evidence required per packet

| Packet | Required evidence |
|--------|------------------|
| CP-01 | Migration run log, idempotency re-run log, `\dt v8.*` output, verification report |
| CP-03 | curl outputs (200/404/401), existing test suite still passes, convention doc |
| CP-05 | Unit test output, curl outputs for flag toggle, flag resolution matrix verification |

---

## 15. Tranche 01 quality gate

### CP-01 Quality Gate

| # | What must be true | Evidence | Failure mode | Partial = |
|---|-------------------|----------|-------------|-----------|
| 1 | All 45 migrations execute without error | Migration run log | SQL syntax error → fix in-place | Some tables created, some failed |
| 2 | Schema `v8` exists in Postgres | `\dn v8` output | Permission denied → escalate | Schema exists but empty |
| 3 | All expected tables exist | `\dt v8.*` count matches manifest | Missing tables → check migration order | >90% tables but some ALTER failed |
| 4 | Idempotent re-run produces zero errors | Second run log | `IF NOT EXISTS` missing → fix | Some migrations not idempotent |
| 5 | Script uses correct DB target | Connection log shows public URL | Uses railway.internal → BLOCK | — |

**What blocks downstream**: If <100% of tables are created, CP-02 cannot run. If script doesn't use public URL, nothing can proceed.

### CP-03 Quality Gate

| # | What must be true | Evidence | Failure mode | Partial = |
|---|-------------------|----------|-------------|-----------|
| 1 | `/api/v8/health` returns 200 with auth | curl output | Route not mounted → check Gateway | Route exists but returns error |
| 2 | `/api/v8/health` returns 404 when disabled | curl output | Feature gate not working → fix | Returns 200 regardless |
| 3 | `/api/v8/health` returns 401 without auth | curl output | Auth middleware not applied → fix | Returns 200 without auth |
| 4 | Existing routes unaffected | Existing test suite passes | V8 mount breaks other routes → BLOCK | — |
| 5 | Convention doc exists | File exists with all sections | Missing → write before closing | — |

**What blocks downstream**: If route mount breaks existing routes, STOP and fix. If auth doesn't work on V8 routes, CP-04 scope changes.

### CP-05 Quality Gate

| # | What must be true | Evidence | Failure mode | Partial = |
|---|-------------------|----------|-------------|-----------|
| 1 | Global disable blocks all V8 | curl output | Gate doesn't check global → fix | — |
| 2 | Per-org flag enables correctly | curl + DB query | Flag not read from DB → fix | Global works but per-org doesn't |
| 3 | Shadow mode flag propagates | `req.v8ShadowMode` in handler | Not propagated → fix middleware | — |
| 4 | Admin API requires superadmin | curl with non-admin token → 403 | Missing auth → fix | — |
| 5 | Existing flags unchanged | Compare before/after FeatureFlags.ts | Existing flags broken → BLOCK | — |

**What blocks downstream**: If per-org flags don't work, CP-07 and CP-08 cannot implement org-level rollout.

---

## 16. Downstream go criteria

### Go criteria for CP-02 (Real-DB Test Harness)
- CP-01 quality gate passed (all 5 checks)
- All 45 migrations applied successfully
- Schema `v8` contains all expected tables
- `DATABASE_PUBLIC_URL` confirmed accessible for test runner

### Go criteria for CP-04 (Auth Integration)
- CP-03 quality gate passed (all 5 checks)
- `/api/v8/health` responds correctly with auth
- V8 router is mounted in Gateway without breaking existing routes
- `verifyToken` middleware works on V8 routes

### Go criteria for CP-06 (Chat + AI Core Routes)
- CP-03 quality gate passed
- CP-04 quality gate passed
- Auth correctly resolves `req.organizationId` for V8 routes
- V8 feature gate middleware is functional
- Chat + AI Core services are importable from route files

---

## 17. No-go conditions

| Condition | Impact | Action |
|-----------|--------|--------|
| `DATABASE_PUBLIC_URL` not configured | CP-01 cannot run | Escalate to infra immediately |
| V8 mount breaks existing routes | All V8 work blocked | Revert Gateway change, investigate |
| >50% migrations fail on Postgres | CP-02/CP-11 scope explodes | Escalate to re-scope, may delay 8-week target |
| Auth middleware incompatible with V8 | CP-04/CP-06 blocked | Escalate to determine refactor scope |
| Existing feature flags broken by V8 additions | Production risk | Revert FeatureFlags.ts changes immediately |
| `DbPromise` fundamentally SQLite-only | All V8 services need adapter | Escalate — this is a program-level risk |

---

## 18. Main delivery risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | SQLite-specific SQL in V8 migrations | Medium | High — blocks DB foundation | CP-01 worker audits each file; fixes in-place |
| R2 | `DbPromise` can't talk to Postgres | Low-Medium | Critical — blocks everything | `DbPromise.tableExists` already uses `information_schema` (Postgres-style); but `run`/`all`/`get` may use SQLite driver |
| R3 | Gateway mount breaks existing routes | Low | High — production impact | Test existing suite before and after mount |
| R4 | Per-org flag storage adds latency | Low | Medium — every V8 request checks DB | Cache flags per-org with 60s TTL |
| R5 | 8-week target is too aggressive | Medium | Medium — credibility risk | D3 says "conditional" — adjust transparently if exit criteria not met |

---

## 19. Recommended start today

**Immediate actions (Day 1):**

1. **Assign Worker 1 → CP-01** (V8 Migration Runner)
   - First task: audit all 45 SQL files for Postgres compatibility
   - Second task: build migration runner script
   - Third task: run against staging

2. **Assign Worker 2 → CP-03** (API Router Foundation)
   - First task: read `Gateway.ts` `initializeRoutes` method
   - Second task: create `server/src/routes/v8/` directory and router
   - Third task: mount in Gateway, test health endpoint

3. **Assign Worker 3 → CP-05** (Feature Flags) — start Day 2
   - First task: read existing `FeatureFlags.ts`
   - Second task: create `featureFlagService.ts` with per-org logic
   - Third task: create migration and admin routes

**Manager actions today:**
- Verify `DATABASE_PUBLIC_URL` is configured for staging
- Verify existing test suite passes (baseline before any changes)
- Create tracking entries in IMPLEMENTATION_CONTROL_BOARD for CP-01, CP-03, CP-05

---

## Related docs
- `CP_TRANCHE_01_POST_WAVE_20_CLOSURE.md`
- `V8_DECISION_PACKAGE_POST_AUDIT.md`
- `V8_POST_20_WAVE_CLOSURE_PROGRAM.md`
- `POST_20_WAVE_CLOSURE_AUDIT.md`
