# Tranche 04: Staging Execution + First Real Integration

> Date: 2026-03-23
> Owner: Manager Agent
> Authority: Corrected status assessment + source-of-truth decisions D1-D6
> Prerequisite: Tranche 01-03 complete (21 packets)
> Status: EXECUTION

---

## 1. Tranche 04 Objective

Move the V8 program from `implemented but partially wired` to `staging-verified with real integration evidence`.

Specifically:
- First UI component genuinely consuming V8 data (not just provider mount)
- Shadow interceptor mounted on Gateway with real route mappings
- All code changes committed, tested, and pushed
- Staging execution plan ready for immediate operational execution

This tranche does NOT claim pilot-ready or production-ready. It produces the **code and tooling** required for staging validation. Actual staging execution (DB migration, smoke tests against live server) requires operational access that is a separate step.

---

## 2. Why Tranche 04 Is the Correct Next Step

The corrected assessment identified 4 P0 gaps:
1. Zero UI consumers of V8 → users cannot see V8 features
2. Migrations never applied to real DB → V8 services will fail at runtime
3. Shadow interceptor not mounted → shadow mode is inert
4. Shadow route mappings empty → nothing to compare

Tranche 04 addresses gaps #1, #3, #4 with code changes, and prepares gap #2 for operational execution.

---

## 3. Tranche 04 Packet List

| # | Packet | Type | Owner | Priority |
|---|--------|------|-------|----------|
| CP-22 | First V8 UI Surface — Chat Context Indicator | code-eligible | worker | P0 |
| CP-23 | Mount Shadow Interceptor + First Route Mapping | code-eligible | worker | P0 |
| CP-24 | Gateway E2E Test for V8 Routes | code-eligible | worker | P1 |
| CP-25 | Shadow Mode Integration Test | code-eligible | worker | P1 |
| CP-26 | Staging Execution Preflight Hardening | code-eligible | worker | P1 |
| CP-27 | Tranche 04 Quality Gate Assessment | analysis-only | manager | P0 |

---

## 4. Execution Order

```
Day 1:  CP-22 + CP-23 + CP-24  (parallel — no dependencies between them)
Day 2:  CP-25 + CP-26           (parallel — depend on CP-23 for shadow, CP-24 for gateway)
Day 3:  CP-27                   (manager — after all code packets complete)
```

---

## 5. Parallel vs Sequential

| Group | Packets | Rationale |
|-------|---------|-----------|
| Parallel Group 1 | CP-22, CP-23, CP-24 | Independent: UI, shadow mount, gateway test |
| Parallel Group 2 | CP-25, CP-26 | CP-25 needs CP-23 (shadow mounted); CP-26 is independent |
| Sequential | CP-27 | Manager assessment after all code packets |

---

## 6. Manager-Owned vs Worker-Eligible

| Packet | Assignment |
|--------|-----------|
| CP-22 | Worker-eligible (code) |
| CP-23 | Worker-eligible (code) |
| CP-24 | Worker-eligible (code) |
| CP-25 | Worker-eligible (code) |
| CP-26 | Worker-eligible (code) |
| CP-27 | Manager-owned (assessment) |

---

## 7. Assignment Brief: CP-22 — First V8 UI Surface

| Field | Value |
|-------|-------|
| **Packet name** | CP-22: First V8 UI Surface — Chat Context Indicator |
| **Objective** | Create the first UI component that genuinely consumes V8 data and renders differently based on V8 state |
| **Why now** | Frontend integration is 2/8 because zero components use V8. This is the P0 gap that proves V8 can flow from backend → API → hook → component → user screen. |
| **Exact scope** | Create a `V8ContextIndicator` component inside `src/components/AIChat/` that: (1) imports `useV8Gate()` from `@/hooks/useV8Gate`, (2) when `showV8Chat` is true AND a conversation is active, calls `useV8Snapshots(conversationId)` from `@/hooks/useV8Chat`, (3) renders a small indicator badge showing V8 context snapshot count for the current conversation, (4) when `showLegacyChat` is true, renders nothing (null), (5) handles loading and error states gracefully. Then import and render this component inside `UnifiedChatPanel.tsx` — add it near the header area, gated by `useV8Gate().showV8Chat`. |
| **Out of scope** | Full V8 chat replacement; modifying message rendering; modifying chat input; any changes to conversation store; any changes to legacy chat API calls |
| **Required docs** | `docs/product/work-packets/V8_STAGING_EXECUTION_AND_PRODUCTION_READINESS.md` §E3 |
| **Required code areas** | `src/components/AIChat/UnifiedChatPanel.tsx` (read, minimal edit to add indicator), `src/hooks/useV8Gate.ts`, `src/hooks/useV8Chat.ts`, `src/providers/V8Provider.tsx` |
| **Dependencies** | CP-07 (V8 client — complete), CP-20 (V8Provider in app — complete) |
| **Expected deliverables** | (1) `src/components/AIChat/V8ContextIndicator.tsx` — new component, (2) Minimal edit to `UnifiedChatPanel.tsx` to render it, (3) Vitest test for the component |
| **Definition of done** | (1) Component renders V8 snapshot count when V8 chat flag is on, (2) Component renders null when V8 is off, (3) Component handles API errors gracefully (no crash), (4) Test passes, (5) No existing tests broken |
| **Evidence to return** | (1) Component file, (2) Test output, (3) Screenshot or description of what renders when V8 is on vs off |
| **Escalation conditions** | If `UnifiedChatPanel.tsx` structure has changed in ways that prevent safe insertion; if `useV8Gate` or `useV8Chat` hooks have bugs |
| **Required report format** | Files created/modified, test results, evidence of real V8 data consumption |

---

## 8. Assignment Brief: CP-23 — Mount Shadow Interceptor + First Route Mapping

| Field | Value |
|-------|-------|
| **Packet name** | CP-23: Mount Shadow Interceptor in Gateway + First Route Mapping |
| **Objective** | Make shadow mode functional: mount the interceptor on the Gateway and add the first real route mapping |
| **Why now** | Shadow interceptor exists but is not mounted in Gateway.ts and has empty route mappings. Shadow mode is completely inert. This is a P0 gap. |
| **Exact scope** | (1) In `server/src/Gateway.ts`, import `v8ShadowInterceptor` and mount it AFTER auth middleware but BEFORE the legacy AI routes. The interceptor needs `v8ShadowMode` on the request, so also import and mount a lightweight shadow-mode-check middleware that calls `isV8ShadowMode(orgId)` and sets `req.v8ShadowMode`. (2) In `server/src/middleware/v8ShadowInterceptor.middleware.ts`, add the first route mapping: legacy `GET /api/ai/status` (or similar health-like AI endpoint) → V8 `GET /ai-core/environment`. This is a safe, read-only comparison. (3) Add a second mapping if a simple legacy chat-related GET exists. |
| **Out of scope** | Mapping POST/mutation endpoints; mapping all legacy routes; modifying legacy route handlers; modifying V8 route handlers |
| **Required docs** | `docs/product/work-packets/CP-18-SHADOW-ROUTE-MAPPINGS.md` |
| **Required code areas** | `server/src/Gateway.ts` (mount interceptor), `server/src/middleware/v8ShadowInterceptor.middleware.ts` (add mappings), `server/src/middleware/v8FeatureGate.middleware.ts` (reference for shadow mode check pattern) |
| **Dependencies** | CP-08 (shadow service — complete), CP-18 (interceptor — complete) |
| **Expected deliverables** | (1) Updated `Gateway.ts` with shadow interceptor mounted, (2) Updated `v8ShadowInterceptor.middleware.ts` with >= 1 real route mapping, (3) Lightweight shadow-mode-check middleware for legacy routes, (4) Updated test for interceptor |
| **Definition of done** | (1) Shadow interceptor is in the Gateway middleware chain, (2) At least 1 route mapping exists, (3) When shadow mode is active for an org, hitting the mapped legacy endpoint triggers a V8 comparison call, (4) Tests pass |
| **Evidence to return** | (1) Gateway.ts diff showing mount, (2) Route mapping entries, (3) Test output, (4) Explanation of which legacy → V8 flows are now shadowed |
| **Escalation conditions** | If Gateway.ts middleware ordering creates conflicts; if shadow mode check causes performance issues on legacy routes |
| **Required report format** | Files modified, route mappings added, test results |

---

## 9. Assignment Brief: CP-24 — Gateway E2E Test for V8 Routes

| Field | Value |
|-------|-------|
| **Packet name** | CP-24: Gateway E2E Test for V8 Routes |
| **Objective** | Verify V8 routes work through the full Gateway (not just isolated router) |
| **Why now** | All existing V8 tests mount the router in isolation. No test verifies the full middleware chain: Gateway → v8FeatureGate → verifyToken → requireV8OrgContext → attachV8Context → route handler. |
| **Exact scope** | Create a Vitest test that: (1) Imports `ApiGateway` or creates a minimal Express app that mirrors Gateway's V8 mounting (v8FeatureGate + v8Router), (2) Tests that `ENABLE_V8_GLOBAL=false` → all V8 routes return 404, (3) Tests that `ENABLE_V8_GLOBAL=true` + valid auth → health returns 200, (4) Tests that unauthenticated request → 401, (5) Tests the full chain end-to-end. Use supertest. |
| **Out of scope** | Testing all 24 V8 endpoints; testing legacy routes; modifying Gateway.ts |
| **Required docs** | `docs/product/work-packets/CP-03-API-CONVENTION.md` |
| **Required code areas** | `server/src/Gateway.ts` (read only), `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/routes/v8/index.ts` |
| **Dependencies** | None (can run in parallel) |
| **Expected deliverables** | `server/src/services/v8/__tests__/v8-gateway-e2e.test.ts` |
| **Definition of done** | (1) Test verifies feature gate blocks when V8 disabled, (2) Test verifies auth chain works, (3) Test verifies health endpoint responds through full chain, (4) All tests pass |
| **Evidence to return** | Test file, test output |
| **Escalation conditions** | If Gateway singleton pattern prevents test isolation |
| **Required report format** | Test file, pass/fail results |

---

## 10. Assignment Brief: CP-25 — Shadow Mode Integration Test

| Field | Value |
|-------|-------|
| **Packet name** | CP-25: Shadow Mode Integration Test |
| **Objective** | Prove that shadow mode actually records comparisons when a mapped legacy endpoint is hit |
| **Why now** | Shadow mode has unit tests but no integration test proving the full flow: request → interceptor → V8 call → comparison recorded. |
| **Exact scope** | Create a Vitest integration test that: (1) Sets up an Express app with auth mock + shadow interceptor + a mock legacy route + V8 router, (2) Configures shadow mode as active, (3) Hits the mapped legacy endpoint, (4) Verifies that `recordShadowComparison` was called with correct parameters, (5) Verifies the legacy response was returned unchanged to the caller. |
| **Out of scope** | Testing against real database; testing all route mappings; performance testing |
| **Required docs** | `docs/product/work-packets/CP-18-SHADOW-ROUTE-MAPPINGS.md` |
| **Required code areas** | `server/src/middleware/v8ShadowInterceptor.middleware.ts`, `server/src/services/v8/shadowModeService.ts` |
| **Dependencies** | CP-23 (shadow interceptor mounted with mappings) |
| **Expected deliverables** | `server/src/services/v8/__tests__/v8-shadow-integration.test.ts` |
| **Definition of done** | (1) Test proves shadow comparison is recorded, (2) Test proves legacy response is unaffected, (3) Test proves V8 call happens in background, (4) All tests pass |
| **Evidence to return** | Test file, test output |
| **Escalation conditions** | If the fire-and-forget pattern makes assertions unreliable (timing issues) |
| **Required report format** | Test file, pass/fail results |

---

## 11. Assignment Brief: CP-26 — Staging Execution Preflight Hardening

| Field | Value |
|-------|-------|
| **Packet name** | CP-26: Staging Execution Preflight Hardening |
| **Objective** | Ensure the deployment scripts are robust and the migration runner handles edge cases |
| **Why now** | Deploy and smoke scripts exist but have never been executed. Before staging, we need to harden them against common failure modes. |
| **Exact scope** | (1) Add `--force` flag to `v8-migrate.ts` that skips interactive confirmation, (2) Add proper exit codes to `v8-deploy.ts` (exit 0 on success, exit 1 on failure), (3) Add `--json` output option to `v8-smoke-test.ts` for machine-readable results, (4) Add a `v8:preflight` npm script that runs: deploy check + migrate dry-run + test suite in sequence, (5) Create a Vitest test for the `translatePlaceholders` function that tests edge cases found in CP-11 report (nested quotes, escaped quotes, multiline SQL). |
| **Out of scope** | Actually running against staging; modifying V8 services; adding new endpoints |
| **Required docs** | `docs/product/work-packets/CP-11-POSTGRES-COMPATIBILITY-REPORT.md` |
| **Required code areas** | `server/scripts/v8-deploy.ts`, `server/scripts/v8-smoke-test.ts`, `server/scripts/v8-migrate.ts`, `server/src/utils/DbPromise.ts` |
| **Dependencies** | None (can run in parallel) |
| **Expected deliverables** | (1) Updated scripts with hardened flags, (2) `v8:preflight` npm script, (3) Additional placeholder translation edge-case tests |
| **Definition of done** | (1) `v8:preflight` runs successfully, (2) Scripts have proper exit codes, (3) Edge-case tests pass |
| **Evidence to return** | Updated script files, npm script output, test results |
| **Escalation conditions** | If migration runner has bugs discovered during hardening |
| **Required report format** | Files modified, test results |

---

## 12. CP-27: Tranche 04 Quality Gate Assessment (Manager-Owned)

After all code packets complete, the manager will assess:

### What must be true
1. At least 1 UI component renders V8 data when V8 flag is on, renders nothing when off
2. Shadow interceptor is mounted in Gateway.ts
3. At least 1 shadow route mapping exists and is tested
4. Gateway E2E test proves full middleware chain works
5. Shadow integration test proves comparison recording works
6. All new and existing tests pass
7. No regressions in existing functionality

### Evidence required
- CP-22: Component file + test + evidence of conditional rendering
- CP-23: Gateway.ts diff + mapping entries + test
- CP-24: Gateway E2E test output
- CP-25: Shadow integration test output
- CP-26: Preflight script output + edge-case tests
- Full closure test suite: all passing

### What counts as partial only
- UI component exists but doesn't actually call V8 API (just checks flag)
- Shadow interceptor mounted but no mappings (still inert)
- Tests pass but only with mocks (no integration proof)

### No-go conditions
- Any existing test broken by Tranche 04 changes
- UI component crashes when V8 is disabled
- Shadow interceptor affects legacy response time or content
- Gateway test reveals auth bypass

### Escalation thresholds
- > 2 packets fail their definition of done
- Shadow interceptor causes any legacy route regression
- V8Provider causes app-wide errors

### Exact criteria to unlock Tranche 05
ALL of the following must be true:
1. CP-22 done: UI component genuinely consumes V8 data
2. CP-23 done: Shadow interceptor mounted with >= 1 mapping
3. CP-24 done: Gateway E2E proves full chain
4. CP-25 done: Shadow integration proves comparison recording
5. CP-26 done: Preflight scripts hardened
6. Full test suite passes with 0 regressions
7. Manager assessment confirms no pseudo-integration

---

## 13. First UI Surface Decision

### Which surface: Chat Context Indicator in UnifiedChatPanel

### Why this surface
- `UnifiedChatPanel` is the primary chat interface used across the app
- It already imports feature flag context (`useFeatureFlagsContext`)
- Chat is the first V8 module per D1
- A context indicator is minimal, safe, and non-disruptive
- It proves the full data flow: V8 API → React Query hook → component render

### Minimal end-to-end scope
1. `V8ContextIndicator` component calls `useV8Gate()` to check if V8 chat is enabled
2. If enabled, calls `useV8Snapshots(conversationId)` to fetch V8 context snapshots
3. Renders a small badge/indicator showing snapshot count (or "V8 Active" label)
4. If V8 is disabled, renders `null` — zero visual impact

### How we know UI genuinely consumes V8
- The component makes a real HTTP call to `/api/v8/chat/snapshots?conversationId=X`
- The component renders data from the response (snapshot count)
- The component renders differently when V8 is on vs off
- The component handles API errors without crashing

### Evidence that confirms real integration
| Aspect | Evidence |
|--------|---------|
| Rendering | Component renders badge when V8 on; renders null when V8 off |
| Data flow | React Query devtools show `/api/v8/chat/snapshots` call |
| Action flow | Not applicable for indicator (read-only) |
| Fallback | Component renders null on API error; app doesn't crash |
| Gate behavior | `useV8Gate().showV8Chat` correctly gates the component |

### What is NOT acceptable as evidence
- Provider exists but no component reads from it
- Hook exists but no component calls it
- Component exists but is never rendered in any route

---

## 14. Shadow Mode Activation Plan

### What must happen
1. Mount `v8ShadowInterceptor` in Gateway.ts AFTER auth, BEFORE legacy AI routes
2. Add shadow-mode-check middleware for legacy routes (sets `req.v8ShadowMode`)
3. Add at least 1 route mapping in `SHADOW_ROUTE_MAPPINGS`

### First shadow pass — request flows
| Legacy endpoint | V8 endpoint | Method | Why this mapping |
|----------------|-------------|--------|-----------------|
| `GET /api/ai/status` or similar AI health | `GET /ai-core/environment` | GET | Safe read-only; both return AI system status |

### Metrics compared
- Response status code (legacy vs V8)
- Response body structure match
- Response time (legacy vs V8)

### What counts as mismatch
- Different HTTP status codes
- Different response body (JSON deep comparison)
- V8 returns error when legacy succeeds

### What blocks progression
- V8 errors leak into legacy responses (P0 — immediate disable)
- Shadow interceptor adds > 50ms to legacy response time (P1)
- V8 error rate > 20% in shadow comparisons (P1)

---

## 15. Staging Execution Plan

### Step 1: Pre-flight
| Field | Value |
|-------|-------|
| Purpose | Verify environment configuration |
| Preconditions | `DATABASE_PUBLIC_URL` available |
| Expected outcome | All checks pass |
| Failure signals | DB URL not resolved; Node version mismatch |
| Stop condition | Any critical check fails |
| Evidence | Full check output |

### Step 2: Migration apply
| Field | Value |
|-------|-------|
| Purpose | Create v8 schema + 120 tables |
| Preconditions | Step 1 passed |
| Expected outcome | 47/47 migrations applied, 0 errors |
| Failure signals | SQL error; connection refused |
| Stop condition | Any migration error → rollback |
| Evidence | Apply + verify output |

### Step 3: Smoke tests
| Field | Value |
|-------|-------|
| Purpose | Verify V8 endpoints respond |
| Preconditions | Step 2 passed; ENABLE_V8_GLOBAL=true |
| Expected outcome | 10/10 pass |
| Failure signals | Health non-200; > 2 failures |
| Stop condition | Health fails → investigate |
| Evidence | Full smoke output |

### Step 4: Shadow mode activation
| Field | Value |
|-------|-------|
| Purpose | Enable parallel V8 processing |
| Preconditions | Step 3 passed; CP-23 deployed |
| Expected outcome | Comparisons appear in shadow stats |
| Failure signals | 0 comparisons after traffic |
| Stop condition | V8 errors affect legacy |
| Evidence | Shadow stats output |

### Step 5: Evidence collection
| Field | Value |
|-------|-------|
| Purpose | Capture proof for gate assessment |
| Preconditions | Steps 1-4 passed |
| Expected outcome | All 9 evidence categories captured |
| Failure signals | Any category missing |
| Stop condition | N/A |
| Evidence | Full evidence pack document |

### Step 6: Reassessment
| Field | Value |
|-------|-------|
| Purpose | Determine if Tranche 05 is justified |
| Preconditions | Step 5 complete |
| Expected outcome | One of: NOT READY / STAGING PASSED / GO FOR T05 |
| Failure signals | N/A |
| Stop condition | N/A |
| Evidence | Manager verdict document |

---

## 16. Corrected Readiness Verdicts

After Tranche 04, only these verdicts are valid:

| Verdict | Meaning |
|---------|---------|
| `NOT READY` | Tranche 04 packets failed or evidence insufficient |
| `STAGING PASSED BUT NOT PILOT-READY` | Code works on staging but gaps remain |
| `GO FOR TRANCHE 05 PILOT PREP` | All evidence collected, pilot preparation justified |

Forbidden verdicts after Tranche 04:
- `production-ready`
- `fully closed`
- `ready for full rollout`

---

## 17. Main Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Shadow interceptor affects legacy performance | Medium | High | Fire-and-forget pattern; test latency impact |
| V8 API returns errors on staging (no tables) | High until migration | High | Run migrations before smoke tests |
| UI component crashes when V8 API unavailable | Low | Medium | Graceful degradation in useV8FeatureFlag |
| Gateway middleware ordering conflict | Low | High | E2E test (CP-24) catches this |
| Existing tests break from Gateway changes | Medium | Medium | Run full suite after changes |

---

## 18. Recommended Start Today

**Parallel Group 1 — start immediately:**
- **Worker 1 → CP-22** (First V8 UI Surface)
- **Worker 2 → CP-23** (Mount Shadow Interceptor)
- **Worker 3 → CP-24** (Gateway E2E Test)

**After Group 1 completes:**
- **Worker 1 → CP-25** (Shadow Integration Test — needs CP-23)
- **Worker 2 → CP-26** (Preflight Hardening)

**After all code packets:**
- **Manager → CP-27** (Quality Gate Assessment)
