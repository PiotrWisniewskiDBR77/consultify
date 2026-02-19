# Testing Backlog (98% coverage, 100% pass, zero placeholders) — 2026-02-18

Owner: Engineering / QA  
Execution agent: Codex (implementation), Human (review/merge)

## Canonical file (iCloud duplicates)

This is the canonical file name (no iCloud “ 2/3” suffixes).

If you see another copy like `docs/plans/TESTING_BACKLOG_98_COVERAGE_ZERO_PLACEHOLDERS_2026-02-18 2.md`, treat **this** file as the source of truth and copy updates here.

## Reality check (2026-02-18)

Verified in this workspace:
- L4 smoke is green locally with isolated SQLite: `npm run test:l4:local:isolated`
- Removed/implemented multiple runtime placeholders:
  - `server/src/routes/help.routes.ts` no longer returns hardcoded categories or empty stub search.
  - `server/src/routes/performance-metrics.routes.ts` no longer returns 501 stub; provides real runtime payload.
  - Removed `{} as any` stubs from:
    - `server/src/routes/notifications/notifications.routes.ts` (uses real `EscalationService`)
    - `server/src/routes/feedback.routes.ts` (uses real `WhatsAppService` w/ config gating)
  - Implemented real email verification module: `server/src/services/emailVerificationService.ts`
- Added proof tests:
  - `tests/integration/routes/helpRoutes.test.ts`
  - `tests/integration/routes/performanceMetricsRoutes.test.ts`

Not yet verified (must be treated as TODO until proven):
- Remote-only L4 against a real deployment (needs real `E2E_API_URL` + `E2E_BASE_URL` in CI).
- “Zero placeholders” across **all** runtime routes (there are additional stub routers and stubbed responses to remove).

## Non‑negotiables (hard constraints)

- **Zero shortcuts**: no mocks, no placeholders, no “degraded mode” endpoints masking missing functionality (except *explicitly approved* “feature not available” contracts that are documented and enforced).
- **98% coverage target**: tracked and enforced by CI gates (not “best effort”).
- **100% pass**: CI green is mandatory; flaky tests must be eliminated or rewritten.
- **External DB via API**: L4 (Playwright runtime tests) must run against an environment where the backend uses the **external DB** (no local SQLite file DB). Prefer running L4 against a dedicated test deployment via `E2E_API_URL`/`E2E_BASE_URL` with `E2E_USE_WEB_SERVER=false`.

## CTO decisions (locked execution path)

These choices are **mandatory** for implementation. No alternative paths unless explicitly re‑approved.

- **L4 runs remote-only**: CI L4 must run with `E2E_USE_WEB_SERVER=false` against a real deployment (`E2E_API_URL` + `E2E_BASE_URL`). Starting local servers in CI is optional and cannot be required for correctness.
- **Isolation model = tenant-per-run**: every L4 run creates a unique organization (“test tenant”) and scopes all created data to it. Cleanup is done by tenant key.
- **Test-support endpoints are allowed only with hard guards**:
  - enabled only when `NODE_ENV=test` **and** `ENABLE_TEST_SUPPORT=true`
  - require `x-test-support-key` matching `TEST_SUPPORT_KEY`
  - must be impossible to enable or call in production
- **No shared fixed demo identities** (e.g. `demo-org`, `demo-user-id`) for L4 against external DB. Any “demo login” behavior must be per-run/per-tenant.

## Definitions (to avoid “metric gaming”)

- **Coverage definition**: line + statement + function + branch coverage. Target 98% applies to *defined scope* (see tickets below), with explicit excludes documented (generated files, vendor bundles, etc.).
- **“Zero placeholders” definition**:
  - No stub services like `const service = {} as any`.
  - No hardcoded fake datasets returned from production routes (unless that route is explicitly documented as static content and owned as such).
  - No “always return empty array” as a temporary implementation.
  - No endpoints intentionally returning 4xx just to avoid 5xx (unless the product contract is genuinely “not available”, and UI/clients are aligned).

## Current state snapshot (evidence)

- L4 smoke suite exists under `tests/e2e/smoke/**` with API “deploy gate” checks and minimal UI render checks.
- Honesty tooling exists: `npm run test:quality-check` and documented L1–L5 readiness in `docs/test-quality/levels-readiness.md`.

---

## EPIC A — L4 runtime on external DB + environment contracts (P0)

### QA-001 (P0) — Define and lock “Test Deployment” contract
**Goal**: L4 runs against a dedicated deployment + external DB, never local file DB.

- **Status**: TODO (needs CI wiring + target env)
- **Acceptance criteria**:
  - One canonical doc section that defines required env vars and guarantees (DB is external, data isolation, reset policy).
  - CI job(s) can run L4 with `E2E_USE_WEB_SERVER=false` against that target.

### QA-002 (P0) — Make Playwright configs support “remote-only” L4
**Goal**: deterministic, repeatable L4 against `E2E_API_URL`/`E2E_BASE_URL`.

- **Status**: ✅ DONE (local config + preflight)
- **Evidence**:
  - `package.json` has `test:l4:remote` and `test:l4:local`
  - `playwright.config.ts` fails early in CI when remote URLs are missing/localhost

### QA-003 (P0) — Test data isolation strategy for external DB
**Goal**: no flakiness and no cross-run collisions when using external DB.

- **Status**: ✅ DONE (bootstrap/cleanup + per-run tenant token)
- **Evidence**:
  - `server/src/routes/testSupport.routes.ts`
  - `tests/e2e/smoke/global-setup.ts` + `tests/e2e/smoke/global-teardown.ts`

### QA-004 (P0) — Add a secure test-only cleanup/reset mechanism
**Goal**: deterministic state without manual DB resets.

- **Status**: ✅ DONE
- **Evidence**:
  - `tests/integration/test-support/testSupportRoutes.test.ts`

---

## EPIC B — Remove runtime placeholders / degraded endpoints (P0)

### QA-010 (P0) — Replace `help.routes.ts` stubbed endpoints with real implementation
**Goal**: help system is real, DB-backed (or owned static), and testable.

- **Status**: ✅ DONE (initial)
- **Evidence**:
  - `server/src/routes/help.routes.ts`
  - `tests/integration/routes/helpRoutes.test.ts`

### QA-011 (P0) — Implement `performance-metrics.routes.ts` (no stub router shipped)
**Goal**: no stub router shipped.

- **Status**: ✅ DONE (initial)
- **Evidence**:
  - `server/src/routes/performance-metrics.routes.ts`
  - `tests/integration/routes/performanceMetricsRoutes.test.ts`

### QA-012 (P0) — Remove stubbed services in auth/notifications/feedback flows (no `{} as any`)
**Goal**: no placeholder service objects in runtime codepaths.

- **Status**: ✅ DONE (partial; keep scanning)
- **Evidence**:
  - `server/src/services/emailVerificationService.ts`
  - `server/src/routes/notifications/notifications.routes.ts`
  - `server/src/routes/feedback.routes.ts`

### QA-013 (P0) — Audit & eliminate remaining placeholders/degraded patterns
**Goal**: systematic cleanup beyond the known files.

- **Status**: IN PROGRESS
- **Evidence (recent removals)**:
  - `server/src/routes/admin/backup.routes.ts` (removed demo backups/status → honest 503)
  - `tests/integration/admin/adminBackup.no-demo.test.ts`
  - `server/src/routes/billing/tokenBilling.routes.ts` (removed “demo mode” token credit on purchase → honest 503)
  - `tests/integration/routes/tokenBilling.test.js` (adds purchase 503 assertion)
  - `server/src/controllers/ai/AIPlaybooksController.ts` (removed fallback/demo templates & runs; strict DB reads + 503 on schema missing)
  - `tests/integration/ai/aiPlaybooks.runs.no-demo.test.ts`
  - `server/src/routes/billing/billing.routes.ts` (removed demo analytics + removed ASC606 demo endpoints; revenue-forecasts no longer random demo)
  - `tests/integration/routes/billing.no-demo.analytics-and-revenue.test.ts`
  - `server/src/routes/user/user-profile-extended.routes.ts` (stub 501 → honest 503)
  - `server/src/routes/user/user-profile-completeness.routes.ts` (stub 501 → honest 503)
  - `server/src/routes/user/user-professional-profile.routes.ts` (stub 501 → honest 503)
  - `server/src/routes/user/user-privacy-extended.routes.ts` (stub 501 → honest 503)
  - `server/src/routes/report-comments.routes.ts` (stub 501 → honest 503)
  - `tests/integration/user/user-stubbed-routes.no-501.test.ts`
  - `server/src/routes/backup.routes.ts` (stub 501 → honest 503)
  - `tests/integration/routes/backups.no-stub.test.ts`
  - `server/src/routes/oauthRoutes.routes.ts` (adds real `/oauth/status` for UI; removes 501 catch-all)
  - `tests/integration/auth/oauthRoutes.status.test.ts`
- **Next targets (examples found via scan)**:
  - `server/src/routes/systemConfig.routes.ts` (stub router)
  - `server/src/routes/task-advisor.routes.ts` (stub router)
  - `server/src/routes/report-comments.routes.ts` (stub router)
  - `server/src/routes/documents.routes.ts` (contains stub response)
  - `server/src/routes/settings.routes.ts` (stub endpoints)
  - `server/src/routes/notifications/notifications.routes.ts` (permission check comment mentions placeholder logic)

---

## EPIC D — Coverage to 98% (P0/P1; staged rollout)

> Reality check: hitting 98% “whole repo” is extremely expensive. Do it professionally by **defining scope** and expanding it gradually with enforced gates.

### QA-030 (P0) — Define the coverage scope and exclusions
**Goal**: stop ambiguity and prevent disputes.

- **Acceptance criteria**:
  - Document exact include/exclude globs (frontend/backend/tests/scripts).
  - CI enforces the same scope locally and in GitHub Actions.

### QA-031 (P0) — Add a global 98% coverage gate (scoped)
**Goal**: hard CI failure when coverage drops below target.

- **Acceptance criteria**:
  - CI job fails if scoped totals < 98%.
  - Per-file thresholds remain for “critical path” (keep existing approach).
- **Depends on**: QA-030.

### QA-032 (P1) — Expand L1/L2/L3 per-file threshold profiles (progressive hardening)
**Goal**: systematically raise coverage where it matters.

- **Acceptance criteria**:
  - Add N new files per week into `scripts/testing/coverage-thresholds.ts` (or equivalent), each at ≥95% per-file.
  - Each addition comes with tests that exercise real code paths.

### QA-033 (P1) — Remove dead/unreachable code that blocks coverage
**Goal**: don’t “test the impossible”; delete it.

- **Acceptance criteria**:
  - Dead code paths removed, or made reachable by product logic.
  - Coverage rises without artificial tests.

---

## EPIC E — Flake elimination + observability (P0/P1)

### QA-040 (P0) — Flake budget & quarantine rules
**Goal**: 100% pass is meaningless without flake control.

- **Acceptance criteria**:
  - Define “flake = any non-deterministic failure in 10 consecutive runs”.
  - Any flaky test must be fixed within 24–48h or removed from PR gate (but kept visible).

### QA-041 (P1) — Add test-run correlation IDs across backend logs
**Goal**: debug fails fast.

- **Acceptance criteria**:
  - L4 injects `x-test-run-id` header.
  - Backend logs include it; failures can be traced per run.

---

## EPIC F — Security / correctness hardening under real runtime (P1)

### QA-050 (P1) — Ensure E2E auth modes do not weaken production security
**Goal**: E2E convenience must not become prod backdoor.

- **Acceptance criteria**:
  - Any E2E-only auth path is hard-guarded by environment + secret.
  - Security tests verify the guard (cannot be enabled in prod).

---

## Delivery order (recommended)

1) **QA-001 → QA-004** (external DB L4 determinism)  
2) **QA-010 → QA-013** (remove runtime placeholders)  
3) **QA-030 → QA-033** (coverage to 98% with real scope)  
4) **QA-040 → QA-041 → QA-050** (flake/observability/security)
