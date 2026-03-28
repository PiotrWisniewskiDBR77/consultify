# V8 Staging Execution & Production Readiness Validation

> Date: 2026-03-23
> Owner: Manager Agent
> Authority: Source-of-truth decisions D1-D6
> Status: STAGING SHADOW EVIDENCE LANDED — code and staging shadow validation are now ahead of the older rollout narrative, but non-V8 confidence and post-staging promotion are still incomplete

---

## 1. Corrected Status Assessment

### Internal consistency check

The older rollout narrative correctly warned against claiming production readiness too early, but several of its code-level assumptions are now stale.

**Current frontend truth:**

- `V8Provider` is mounted in `AppProviders.tsx`
- `useV8Gate()` is exported and consumed
- V8 UI consumers now exist, including `V8ContextIndicator` and `V8ArtifactRunControl`
- this is still a narrow first surface, not full product integration
- honest rating remains **wired**, not pilot-ready

**Current deployment/runtime truth:**

- deploy helper exists (`v8-deploy.ts`)
- migration runner exists (`v8-migrate.ts`)
- smoke harness exists (`v8-smoke-test.ts`)
- shadow interceptor is mounted in `Gateway.ts`
- shadow route mappings are no longer empty
- gateway E2E coverage exists
- real staging migration / smoke / rollback evidence now exists
- staging shadow observation now exists with live operator diagnostics and passing promotion-readiness

The honest interpretation today is:

- **code and wiring are materially ready for staging execution**
- **pilot-readiness is still unproven**
- **production-readiness is still unproven**

### Why the production-readiness claim was not justified

The previous report conflated:
- "infrastructure exists" with "infrastructure works in production"
- "tests pass in isolation" with "verified on real infrastructure"
- "documentation written" with "procedures tested"
- "hooks exported" with "features integrated"

What still has not been demonstrated:
1. non-V8 confidence green enough for a full user-ready claim
2. pilot observation window outside staging completed successfully
3. production promotion monitoring completed successfully

### Correct status as of today

| Status level | Justified? | Evidence |
|-------------|-----------|----------|
| `staging-ready` | **YES, on live evidence** | Real staging migration, smoke, rollback, and shadow observation evidence now exist |
| `pilot-ready` | **NO** | Staging shadow is proven, but pilot evidence outside staging does not exist yet |
| `production-ready` | **NO** | Multiple hard gaps remain |
| `partial` | **YES** | This is the honest status |

**Verdict: The rollout is `staging-validated`, but still `not pilot-complete` and `not production-ready`.**

---

## 2. Why Production-Readiness Is Not Justified Yet

### Hard gaps preventing production-ready status

| # | Gap | Severity | Why it blocks |
|---|-----|----------|---------------|
| 1 | **Non-V8 confidence remains incomplete** | P1 | Existing app confidence is still not green enough for a full user-ready claim |
| 2 | **Pilot / canary observation outside staging has not happened** | P1 | Staging shadow proof is not the same as a real pilot window |
| 3 | **Operator monitoring outside staging has not happened** | P1 | Admin workflow is proven on staging only |
| 4 | **UI V8 coverage is still narrow** | P1 | First surfaces exist, but broader user-facing coverage is still limited |
| 5 | **Shadow route coverage is still narrow** | P1 | The operator gate is green, but only on the first mapped coarse routes |

---

## 3. Staging Execution Plan

### Step 1: Pre-flight checks

| Field | Value |
|-------|-------|
| **Purpose** | Verify environment is configured for V8 deployment |
| **Preconditions** | `DATABASE_PUBLIC_URL` available; Railway project accessible |
| **Command** | `npm run v8:deploy:check` (from `server/`) |
| **Exact expected outcome** | All checks pass: DB URL resolved, `ENABLE_V8_GLOBAL` configured, Node >= 18 |
| **Failure signals** | "No DATABASE_URL or DATABASE_PUBLIC_URL configured"; Node version mismatch |
| **Rollback / stop condition** | If DB URL check fails → STOP. Configure env vars first. |
| **Evidence to capture** | Screenshot/log of full check output with all items green |

### Step 2: V8 migration execution

| Field | Value |
|-------|-------|
| **Purpose** | Create the `v8` schema and the full manifest-backed V8/V8.1 table set in staging Postgres |
| **Preconditions** | Step 1 passed; `DATABASE_PUBLIC_URL` resolves to staging Postgres |
| **Commands** | `npx tsx scripts/v8-migrate.ts --dry-run` → review → `npx tsx scripts/v8-migrate.ts --apply` → `npx tsx scripts/v8-migrate.ts --verify` |
| **Exact expected outcome** | Dry-run lists the full migration set with transformations shown. Apply finishes with 0 failed migrations. Verify confirms all expected tables exist in the `v8` schema. |
| **Failure signals** | Any SQL error during apply; verify shows missing tables; connection refused |
| **Rollback / stop condition** | If apply fails on any migration → STOP. Do not proceed. Fix the failing migration. If partial apply → `--rollback` to clean state. |
| **Evidence to capture** | Full output of `--dry-run`, `--apply`, and `--verify`. Staging schema inventory showing the expected `v8` objects. |

### Step 3: Smoke test execution

| Field | Value |
|-------|-------|
| **Purpose** | Verify V8 API endpoints respond correctly on deployed server |
| **Preconditions** | Step 2 passed; server deployed with `ENABLE_V8_GLOBAL=true`; valid JWT token available |
| **Command** | `npm run v8:smoke-test -- --url <staging-url> --token <jwt>` |
| **Exact expected outcome** | The smoke harness passes against staging and confirms health, readiness, admin, and live V8 route contracts under real auth. |
| **Failure signals** | Any endpoint returns 500; health returns non-200; connection timeout |
| **Rollback / stop condition** | If health endpoint fails → STOP. Check server logs. If > 2 endpoints fail → STOP. Investigate before proceeding. |
| **Evidence to capture** | Full smoke test output with pass/fail per endpoint and response times |

### Step 4: Shadow mode activation

| Field | Value |
|-------|-------|
| **Purpose** | Enable V8 parallel processing for a test org without affecting users |
| **Preconditions** | Step 3 passed; shadow interceptor is already mounted in `Gateway.ts`; at least one shadow route mapping is already configured; staging auth and admin access are available |
| **Commands** | Set `ENABLE_V8_SHADOW_MODE=true` → `PUT /api/v8/admin/flags/chat {"enabled": true}` for test org |
| **Exact expected outcome** | Shadow comparisons appear in `GET /api/v8/admin/shadow/stats` within minutes of test traffic |
| **Failure signals** | Stats show 0 comparisons after traffic; errors in server logs |
| **Rollback / stop condition** | If V8 errors affect legacy responses → disable immediately (`ENABLE_V8_GLOBAL=false`). If error rate > 10% → disable for that org. |
| **Evidence to capture** | Shadow stats output showing comparison count, match rate, latency delta |

**Current note:** Step 4 is now proven on staging.

Live staging observation reached `102` comparable comparisons, `100.0%` match rate, `0` recent mismatches, and passing `promotion-readiness`; see `evidence/485-v8-staging-shadow-observation-and-promotion-readiness.md`.

### Step 5: Monitoring verification

| Field | Value |
|-------|-------|
| **Purpose** | Verify operator can monitor V8 health using documented procedures |
| **Preconditions** | Steps 3-4 passed; superadmin token available |
| **Commands** | Follow daily checklist from CP-21 runbook |
| **Exact expected outcome** | All monitoring endpoints return valid data; operator can interpret results |
| **Failure signals** | Any monitoring endpoint returns 500; data is empty/meaningless |
| **Rollback / stop condition** | If monitoring is unreliable → do not proceed to pilot |
| **Evidence to capture** | Screenshots of each monitoring endpoint response; operator notes |

---

## 4. Evidence Pack

### E1: Migration evidence

| Field | Value |
|-------|-------|
| **What proves success** | `--apply` output showing 47/47 migrations applied with 0 errors; `--verify` output confirming all tables exist; `\dt v8.*` showing 120 tables |
| **What counts as partial** | Some migrations applied but verify shows missing tables; warnings during apply |
| **What fails the gate** | Any migration error; verify shows < 120 tables; schema doesn't exist |

### E2: API route evidence

| Field | Value |
|-------|-------|
| **What proves success** | Live staging smoke harness passes and `GET /api/v8/health` returns `{ data: {...}, meta: { version: 'v8' } }` with 200 under valid auth |
| **What counts as partial** | Health works but some domain endpoints return 500 |
| **What fails the gate** | Health endpoint returns non-200; > 3 endpoints fail |

### E3: Frontend wiring evidence

| Field | Value |
|-------|-------|
| **What proves success** | At least 1 UI component conditionally renders V8 content based on `useV8Gate()`; user can see V8 feature when flag is on, legacy when off |
| **What counts as partial** | V8Provider runs and fetches flags, but no UI consumes the result (CURRENT STATE) |
| **What fails the gate** | V8Provider crashes the app; flag fetch causes errors visible to users |

### E4: Shadow mode evidence

| Field | Value |
|-------|-------|
| **What proves success** | Shadow stats show >= 100 comparisons with >= 95% match rate; promotion readiness check passes |
| **What counts as partial** | Shadow comparisons recorded but match rate < 95% or count < 100 |
| **What fails the gate** | Zero comparisons recorded; shadow interceptor not mounted; V8 errors leak to legacy responses |

### E5: Smoke test evidence

| Field | Value |
|-------|-------|
| **What proves success** | `v8-smoke-test.ts` output showing the full harness passes against the staging URL |
| **What counts as partial** | 7-9/10 pass with known non-critical failures |
| **What fails the gate** | Health endpoint fails or multiple live smoke contracts fail |

### E6: Operator monitoring evidence

| Field | Value |
|-------|-------|
| **What proves success** | Operator follows daily checklist; all monitoring endpoints return meaningful data; operator can interpret V8 health status |
| **What counts as partial** | Endpoints work but data is empty (no traffic yet) |
| **What fails the gate** | Monitoring endpoints return errors; operator cannot determine V8 health |

### E7: Auth / permission evidence

| Field | Value |
|-------|-------|
| **What proves success** | Unauthenticated request → 401; wrong org → 404; superadmin endpoints reject non-superadmin; org isolation verified |
| **What counts as partial** | Auth works but org isolation not verified on staging |
| **What fails the gate** | Any auth bypass; cross-org data leak; superadmin endpoints accessible to regular users |

### E8: Error / degraded-state evidence

| Field | Value |
|-------|-------|
| **What proves success** | V8 disabled globally → all V8 routes return 404; V8 disabled per-org → that org gets 404, others unaffected; error codes are correct |
| **What counts as partial** | Global disable works but per-org disable not tested |
| **What fails the gate** | Disabling V8 affects legacy routes; error responses don't match documented codes |

### E9: Rollback evidence

| Field | Value |
|-------|-------|
| **What proves success** | `ENABLE_V8_GLOBAL=false` → V8 routes return 404 within 1 minute; `--rollback` drops V8 tables cleanly; frontend shows legacy UI |
| **What counts as partial** | Global disable works but DB rollback not tested |
| **What fails the gate** | Rollback affects non-V8 functionality; rollback leaves orphaned state |

---

## 5. Module Readiness Matrix

### First deployment track: Chat + AI Core + Platform Infrastructure

| Module / Area | Implemented | Wired | Integrated | Verified on staging | Operator-ready | Pilot-ready | Full-prod-ready | Main remaining gap |
|---------------|:-----------:|:-----:|:----------:|:-------------------:|:--------------:|:-----------:|:---------------:|-------------------|
| **DB Foundation** | YES | YES | NO | NO | NO | NO | NO | Migrations never applied to real DB |
| **API Router** | YES | YES | NO | NO | NO | NO | NO | Never tested on deployed server |
| **Auth Integration** | YES | YES | NO | NO | NO | NO | NO | Never verified on staging |
| **Feature Flags** | YES | YES | PARTIAL | NO | NO | NO | NO | Per-org flags untested on real DB |
| **Chat API (9 endpoints)** | YES | YES | NO | NO | NO | NO | NO | Never called from UI or staging |
| **AI Core API (6 endpoints)** | YES | YES | NO | NO | NO | NO | NO | Never called from UI or staging |
| **Frontend V8 Client** | YES | YES | NO | NO | NO | NO | NO | Zero UI consumers |
| **V8Provider + hooks** | YES | YES | PARTIAL | NO | NO | NO | NO | Mounted but unused by any component |
| **Shadow Mode Service** | YES | YES | NO | NO | NO | NO | NO | Interceptor not mounted, mappings empty |
| **Observability** | YES | YES | NO | NO | NO | NO | NO | Never exercised on real traffic |
| **Deployment Scripts** | YES | YES | NO | NO | NO | NO | NO | Never executed |
| **Operator Runbook** | YES | N/A | N/A | NO | PARTIAL | NO | NO | Written but never followed |
| **Rollback Procedures** | YES | N/A | N/A | NO | NO | NO | NO | Documented but never tested |
| **Smoke Tests** | YES | YES | NO | NO | NO | NO | NO | Never run against real server |

### Modules NOT in first track (deferred per D4)

| Module | Status | Notes |
|--------|--------|-------|
| Interview | `implemented` only | Not in V8 first track |
| Help/KB | `implemented` only | Not in V8 first track |
| Partner | `implemented` only | Not in V8 first track |
| Multiplayer (WebSocket) | `implemented` only | Deferred per D5 |

---

## 6. Production Gate Model

### Gate 1: Staging Pass

| Field | Value |
|-------|-------|
| **Entry criteria** | All 21 closure packets complete (MET); code merged to staging branch |
| **Evidence required** | E1 (migration), E2 (API routes), E5 (smoke tests), E7 (auth), E8 (error states) |
| **No-go conditions** | Any migration failure; health endpoint non-200; auth bypass detected |
| **Escalation conditions** | > 3 smoke test failures; unexpected errors in server logs |
| **Approval required** | Manager agent confirms all evidence captured |

### Gate 2: Pilot Production (Shadow Mode)

| Field | Value |
|-------|-------|
| **Entry criteria** | Gate 1 passed; shadow interceptor mounted with >= 1 route mapping; test org identified |
| **Evidence required** | E4 (shadow mode — >= 100 comparisons, >= 95% match), E6 (operator monitoring), E3 (at least 1 UI surface) |
| **No-go conditions** | Shadow match rate < 80%; V8 errors leak to legacy; zero comparisons after 24h |
| **Escalation conditions** | Match rate between 80-95%; V8 latency > 200ms overhead; any P0 error |
| **Approval required** | Source-of-truth chat confirms pilot org selection and scope |

### Gate 3: Full Production Cutover

| Field | Value |
|-------|-------|
| **Entry criteria** | Gate 2 passed for >= 2 weeks; shadow promotion readiness check passes; all 5 criteria met |
| **Evidence required** | E4 (promotion readiness pass), E3 (full UI integration for Chat + AI Core), E6 (operator monitoring stable for 2 weeks), E9 (rollback tested) |
| **No-go conditions** | Any promotion criterion fails; rollback not tested; operator cannot manage V8 independently |
| **Escalation conditions** | New failure modes discovered during pilot; performance degradation; user complaints |
| **Approval required** | Source-of-truth chat explicitly approves production cutover with defined org scope |

---

## 7. Pilot Rollout Recommendation

### Tenant / org profile for pilot

- **Recommended:** Internal team org (`dbr77` or `atelier`) — real usage patterns, controlled environment
- **NOT recommended:** External customer org for first pilot
- **Rationale:** Internal pilot allows rapid iteration without customer impact

### Rollout type

- **Phase 1:** Internal only (1 org, shadow mode)
- **Phase 2:** Single external org pilot (shadow mode → live, with explicit consent)
- **Phase 3:** Limited cohort (5-10 orgs, phased enablement)
- **Phase 4:** General availability

### Shadow mode duration

- **Minimum:** 1 week of shadow mode with >= 100 comparisons
- **Recommended:** 2 weeks to capture edge cases and weekly patterns
- **Maximum before decision:** 4 weeks — if not ready after 4 weeks, re-evaluate approach

### Comparison metrics (V3/V4 vs V8)

| Metric | Source | Threshold |
|--------|--------|-----------|
| Response match rate | Shadow comparisons | >= 95% |
| V8 error rate | Shadow stats | < 5% |
| V8 latency overhead | Shadow stats | < 100ms average |
| Recent mismatches (24h) | Shadow stats | 0 |
| User-visible errors | Application logs | 0 |

### Pilot abort conditions

- V8 errors appear in legacy responses (P0 — immediate abort)
- Shadow match rate drops below 80% (P1 — pause and investigate)
- V8 latency overhead exceeds 500ms (P1 — pause)
- Any data integrity issue (P0 — immediate abort)
- User reports issue attributable to V8 (P0 — immediate abort)

### Progression criteria

- Shadow → live for pilot org: All 5 promotion criteria met for >= 48 hours
- Pilot → limited cohort: Pilot stable for >= 2 weeks, no P0/P1 issues
- Limited cohort → GA: All cohort orgs stable for >= 2 weeks, operator workflow proven

---

## 8. Residual Gaps After Staging

Even if staging passes perfectly, these remain:

### Still NOT pilot-ready

| Gap | Why | Required packet / action |
|-----|-----|--------------------------|
| No real staging migration evidence | Schema creation is still unproven on the target DB | CP-25 style staging migration execution |
| No authenticated live smoke evidence | Route wiring is still unproven on the deployed server | CP-26 style staging smoke execution |
| No real shadow comparison window | Wired shadow mode is not yet pilot evidence | CP-27 style shadow observation |
| Rollback and flag-off not drilled live | Pilot safety is still only documented | Rollback verification packet |
| UI and shadow coverage remain narrow | First surface and first mappings do not yet equal broad pilot confidence | Additional post-staging breadth only if staging proof shows the need |

### Still NOT full-prod-ready

| Gap | Why | Required packet |
|-----|-----|----------------|
| Only Chat + AI Core wired | Other modules (Prompt OS, Knowledge, Multiplayer, etc.) have no API routes | Future tranches |
| WebSocket/realtime not addressed | Multiplayer requires Socket.io extension per D5 | Future tranche |
| Legacy cutover plan not defined | No plan for when/how to disable legacy paths | Future tranche |
| Operator workflow unproven | Runbook exists but never followed in practice | Proven during pilot |

---

## 9. Recommended Next Work Packets

### Tranche 04 / Operational follow-through

| # | Packet | Type | Priority | Depends on |
|---|--------|------|----------|-----------|
| CP-22 | First V8 UI surface — Chat context panel | completed | P0 | done in code |
| CP-23 | Mount shadow interceptor + first route mapping | completed | P0 | done in code |
| CP-24 | Gateway E2E test for V8 routes | completed | P1 | done in code |
| CP-25 | Staging migration execution + evidence capture | verification-only | P0 | DB access |
| CP-26 | Staging smoke test execution + evidence capture | verification-only | P0 | CP-25 |
| CP-27 | Shadow mode activation + monitoring (24h) | verification-only | P0 | CP-25 + CP-26 |

### Tranche 05: Pilot Preparation (after Tranche 04)

| # | Packet | Type | Priority |
|---|--------|------|----------|
| CP-28 | Rollback procedure test on staging | verification-only | P0 |
| CP-29 | Operator monitoring walkthrough | verification-only | P1 |
| CP-30 | Pilot org selection + configuration | analysis-only | P1 |
| CP-31 | Pilot success criteria definition | analysis-only | P1 |

---

## 10. Explicit Verdict

### `GO for staging only`

**Justification:**
- Code infrastructure is complete enough to justify staging execution
- Deployment tooling exists and is ready to execute
- The system has still not been fully exercised on real infrastructure
- Initial UI integration and initial shadow wiring now exist, but they are not yet a pilot or production proof

**What this means:**
- We CAN deploy to staging and start collecting real evidence
- We CANNOT claim pilot-readiness until staging evidence is captured and shadow observation succeeds
- We CANNOT claim production-readiness until pilot is proven and rollback/monitoring are exercised
- The program is at the **beginning of operational validation**, not the end

**Estimated timeline to pilot-ready:** 2-3 weeks (staging validation + first UI surface + shadow mode activation)
**Estimated timeline to full-prod-ready:** 6-8 weeks (pilot + limited cohort + GA preparation)

---

## Related documents

| Document | Purpose |
|----------|---------|
| `IMPLEMENTATION_CONTROL_BOARD.md` | Closure execution reports #1-#6 |
| `CP-10-ROLLOUT-SAFETY-CHECKLIST.md` | Go/No-Go gate criteria |
| `CP-11-POSTGRES-COMPATIBILITY-REPORT.md` | Postgres adaptation analysis |
| `CP-18-SHADOW-ROUTE-MAPPINGS.md` | Shadow mode route configuration |
| `CP-21-V8-OPERATOR-RUNBOOK.md` | Operator procedures |
| `TRANCHE_01_EXECUTION_ORDER.md` | Original execution plan |
