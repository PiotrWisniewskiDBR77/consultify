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

## Progress counters (updated 2026-02-19)

- Tickets total: **15**
- Status totals: **DONE 7**, **IN PROGRESS 1**, **TODO 7**
- By epic:
  - **EPIC A (QA-001..QA-004)**: DONE **4/4**
  - **EPIC B (QA-010..QA-013)**: DONE **3/4**, IN PROGRESS **1/4**
  - **EPIC D (QA-030..QA-033)**: TODO **4/4**
  - **EPIC E (QA-040..QA-041)**: TODO **2/2**
  - **EPIC F (QA-050)**: TODO **1/1**

---

## EPIC A — L4 runtime on external DB + environment contracts (P0)

### QA-001 (P0) — Define and lock “Test Deployment” contract
**Goal**: L4 runs against a dedicated deployment + external DB, never local file DB.

- **Status**: ✅ DONE (contract doc + CI remote-only job wiring)
- **Evidence**:
  - Contract doc: `docs/test-quality/l4-test-deployment-contract.md`
  - CI remote-only job: `.github/workflows/test-suite.yml` (`l4-smoke` uses `E2E_USE_WEB_SERVER=false` + `secrets.E2E_API_URL/E2E_BASE_URL/TEST_SUPPORT_KEY`)

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
    - bootstrap returns a **signed JWT** (no `E2E_MODE` auth bypass required)
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
  - `server/src/routes/legal.routes.ts` (removed hardcoded placeholder legal text; now 503 unless configured via DB or env)
  - `tests/integration/legal.test.ts`
  - `tests/integration/routes/legal.test.js`
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
  - Stub routers standardized to honest `503` (no `501`, no “Not implemented”):
    - `server/src/routes/task-advisor.routes.ts`
    - `server/src/routes/featureFlags.routes.ts`
    - `server/src/routes/workspace-defaults.routes.ts`
    - `server/src/routes/systemConfig.routes.ts`
    - `server/src/routes/governanceAdmin.routes.ts`
    - `server/src/routes/helpAnalytics.routes.ts`
    - `server/src/routes/benchmark.routes.ts`
    - `server/src/routes/locations.routes.ts`
    - `server/src/routes/referrals.routes.ts`
    - `server/src/routes/assessment/assessment.routes.ts`
  - `tests/integration/routes/stubbed-legacy-routes.no-501.test.ts`
  - `server/src/routes/documents.routes.ts` (removed fake `[]` degraded mode; consistent 503 for unavailable service; avoids runtime FS writes via multer memory storage)
  - `tests/integration/routes/documentsRoutes.no-stubs.test.ts`
  - `server/src/routes/settings.routes.ts` (fixes `user_preferences` schema drift; removes `preferences_type/preferences_data` usage and persists preferences via `user_id/key/value`)
  - `tests/integration/settings/settings-regional-preferences.test.ts`
  - `server/src/routes/notifications/notifications.routes.ts` (removes placeholder permission block; enforces real authz for escalation runs; broadcast uses strict DB reads)
  - `tests/integration/routes/notifications.escalations.authz.test.ts`
  - `server/src/middleware/demoGuard.middleware.ts` (demo mode uses real org context + DB-backed counts; write protection is enforced)
  - `server/src/routes/demo.routes.ts` (no hardcoded demo org/tours; honest 503 when unavailable or not configured)
  - `tests/integration/routes/demoRoutes.no-stubs.test.ts`
  - `tests/integration/middleware/demoWriteProtection.test.ts`
  - `server/src/services/trialService.ts` (removed lazy stub proxy; callers must treat missing methods as unavailable)
  - `server/src/routes/trial.routes.ts` (validates request first; honest 503 when TrialService missing)
  - `server/src/cron/TrialCron.ts` (skips daily tasks when TrialService missing; logs explicitly)
  - `server/src/cron/Scheduler.ts` (trial/usage cron jobs always `.catch` to avoid unhandled rejections)
  - `tests/integration/trialDemoIntegration.test.ts` (no mocks; real JWT auth + audit_log insert)
  - `server/src/utils/lazyServiceLoader.ts` (removed stub proxy fallback + removed test-mode mock loading; missing/circular lazy loads become explicit “unavailable” proxies instead of fake-null behavior)
  - `server/src/routes/media-ingestion.routes.ts` (removed degraded fake success; adds honest 503 for UI ingest endpoints)
  - `server/src/services/ai/mediaIngestionService.ts` (removes self-loading wrapper; explicit unavailable marker for honest 503)
  - `tests/integration/routes/mediaIngestion.no-stubs.test.ts`
  - `server/src/routes/agents.routes.ts` (removes degraded/fake success; consistent honest 503 when AIOrchestrator unavailable)
  - `server/src/routes/accessCodes.routes.ts` (removes “degraded mode” 400/false; honest 503 contracts for public endpoints when service missing)
  - `server/src/services/ai/startupValidator.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/ai/promptAssembler.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/ai/performanceOptimizer.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/ai/pipeline/index.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/ai/pipeline/reportAgents.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/ai/pipeline/reportPipeline.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/frameworkScoreCalculators.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/integrations/teamsUserIntegration.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/integrations/slackUserIntegration.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/integrations/clickupUserIntegration.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/integrations/jiraUserIntegration.ts` (removes self-loading lazy wrapper; explicit unavailable marker)
  - `server/src/services/ai/**` wrappers now load real modules via absolute `ai/**` paths (fixes “self-loading” wrapper recursion/unavailable proxies)
  - `server/src/database/DatabaseInitializer.ts` (adds `ensureBillingCoreTables()` so L4 deploy-gate `/api/billing/usage` doesn’t 503 on fresh SQLite)
  - `server/src/routes/ai.routes.ts` (AI memory metrics endpoints now return honest 503 instead of 500 when service is unavailable)
  - Eliminated remaining `{} as any` runtime stubs:
    - `server/src/services/dunningService.ts` (real `emailService` + audit adapter)
    - `server/src/services/slaService.ts` (real `NotificationOutboxService` import)
    - `server/src/services/genericReportService.ts` + `server/src/services/externalAssessmentService.ts` (real `PDFParserService`)
  - Added missing canonical service files (kept “ 2.ts” duplicates intact):
    - `server/src/services/notificationOutboxService.ts`
    - `server/src/services/pdfParserService.ts`
  - Removed AI “placeholder content” fallbacks (no fake success payloads):
    - `server/src/services/reportGenerationService.ts` now throws `503 FEATURE_UNAVAILABLE` when LLM missing/fails (no placeholder report sections)
    - `server/src/services/initiativeGenerationService.ts` now throws `503 FEATURE_UNAVAILABLE` when LLM missing/fails (no placeholder sections/suggestions)
    - `server/src/routes/pmo/initiatives.routes.ts` maps AI-generation failures to honest `503 FEATURE_UNAVAILABLE` (no generic 500)
    - `server/src/services/initiativeSectionTypeService.ts` uses `DbPromise` with `fallback:false` (missing schema no longer gets silently treated as “not found”)
    - `tests/integration/initiatives/initiatives.ai-generation.unavailable.no-placeholders.test.ts` (guards 503 contract; no fake AI payloads)
  - Removed dead placeholder generators from codebase (no “fake content” blocks left behind):
    - `server/src/services/reportGenerationService.ts` (removed `generatePlaceholderContent`)
    - `server/src/services/initiativeGenerationService.ts` (removed `generatePlaceholder`)
  - Self-heal for fresh SQLite (deploy gate / local smoke must not spam SQLITE_ERROR):
    - `server/src/database/DatabaseInitializer.ts` ensures `initiative_section_types` exists + seeds minimal system rows
    - `server/src/services/initiativeGenerationService.ts` returns `503 FEATURE_UNAVAILABLE` if a section lacks an AI prompt template
  - PPTX pipeline cleanup (no placeholder strings):
    - `server/src/services/report/pptx/UnifiedJsonTransformer.ts` no longer injects `"To be defined"` into risk mitigation
  - Removed remaining “stub success” responses:
    - `server/src/routes/billing/billing.routes.ts` `/setup-intent` returns honest `503 FEATURE_UNAVAILABLE` when Stripe is not configured (no `mode: 'stub'`)
    - `server/src/services/aiSettingsService.ts` compliance report PDF export returns `503 FEATURE_UNAVAILABLE` (no “return JSON with a marker”)
    - `server/src/services/ai/summarizationService.ts` no longer returns `"Summary stub"`/`"Summary unavailable"` strings; throws `503 FEATURE_UNAVAILABLE`
  - Removed “draft content” placeholders in assessment report generation:
  - `server/src/routes/assessment-reports.routes.ts` report generation now requires real LLM; otherwise returns `503 FEATURE_UNAVAILABLE` (no `createDraftContent` fallbacks)
  - `server/src/routes/assessment-reports.routes.ts` section AI actions no longer truncate/regenerate with fake drafts; failures return `503 FEATURE_UNAVAILABLE` and do not silently update content
  - `server/src/routes/partners.routes.ts` partner portal demo endpoints now return honest `503 FEATURE_UNAVAILABLE` (no fake clients/projects/certifications/licenses/invoices/resources/tiers/metrics/commissions)
  - `server/src/routes/partners.routes.ts` payouts now require a real partner org and return honest `503 FEATURE_UNAVAILABLE` on schema errors (no empty fallback)
  - `tests/integration/routes/partners.no-stubs.test.ts`
  - `server/src/routes/organization/organization-data.routes.ts` stats + export endpoints now return honest `503 FEATURE_UNAVAILABLE` (no default/demo payloads)
  - `tests/integration/routes/organizationData.no-stubs.test.ts`
  - `server/src/routes/billing/billing.routes.ts` removed mock invoice insertion in `/invoices` list (no demo invoice seeding)
  - `server/src/routes/project-members.routes.ts` now aliases the real PMO implementation (no missing JS stub import)
  - `server/src/routes/pmo/project-members.routes.ts` uses strict DB reads and returns `503 FEATURE_UNAVAILABLE` on schema drift
  - `server/src/Gateway.ts` mounts `/api/project-members` as a real compat route (no stub wrapper)
  - `server/src/routes/generic-reports.routes.ts` no longer returns fake success; missing schema/LLM yields `503 FEATURE_UNAVAILABLE`
  - `server/src/routes/premiumReports.routes.ts` + `server/src/routes/managementReports.routes.ts` standardize `503 FEATURE_UNAVAILABLE` payloads
  - `tests/integration/routes/projectMembers.compat.no-stubs.test.ts`
  - `tests/integration/routes/genericReports.no-stubs.test.ts`
  - AI async queue honesty (no mock jobs):
    - `server/src/queues/aiQueue.ts` mock queue removed; `MOCK_REDIS=true` now yields explicit `503 FEATURE_UNAVAILABLE`
    - `server/src/ai/asyncJobService.ts` marks enqueue failures as `FAILED` and surfaces `FEATURE_UNAVAILABLE`
    - `server/src/routes/actionDecisions.routes.ts` maps queue unavailability to `503 FEATURE_UNAVAILABLE`
  - Megatrends no longer use static fallback data:
    - `server/src/models/megatrend.ts` removes default datasets + placeholder insights; returns `503 FEATURE_UNAVAILABLE` when DB empty/unavailable
    - `server/src/routes/megatrend.routes.ts` surfaces `FEATURE_UNAVAILABLE` instead of 500
    - `tests/integration/megatrend.test.js` verifies 503 on empty table and real DB-backed responses
  - Removed AI nudges/feedback/settings mock fallbacks (honest 503 FEATURE_UNAVAILABLE):
    - `server/src/routes/ai/ai-nudges.routes.ts`
    - `server/src/routes/ai/ai-feedback.routes.ts`
    - `server/src/routes/ai/ai-settings.routes.ts`
    - `tests/integration/routes/aiNudges.unavailable.no-placeholders.test.ts`
    - `tests/integration/routes/aiFeedback.unavailable.no-placeholders.test.ts`
    - `tests/integration/routes/aiSettings.superadmin.unavailable.no-placeholders.test.ts`
  - AI health checks no longer report demo/not-implemented modes (unavailable now reported as unhealthy):
    - `server/src/routes/ai/ai-health-check.routes.ts`
  - Revenue payment failure retry no longer simulates success (honest 503 FEATURE_UNAVAILABLE):
    - `server/src/routes/revenue.routes.ts`
  - Health checks no longer report mocked Redis as “ready”:
    - `server/src/controllers/HealthCheckController.ts` (MOCK_REDIS now reports `mocked-unavailable`; readiness returns 503)
    - `tests/integration/health/health-endpoints.test.ts`
    - `tests/integration/routes/health.l3.test.ts`
    - `tests/integration/system/healthRoutes.readiness.ready.test.ts`
  - SuperAdmin IAM/compliance placeholders removed:
    - `server/src/controllers/SuperAdminController.ts` (permissions matrix uses real service; compliance status/summary return 503 when unavailable)
  - Memory cleanup jobs now do real cache/temp cleanup (no placeholder no-ops):
    - `server/src/cron/MemoryCleanupJob.ts`
    - `server/src/utils/BenchmarkCache.ts` (clearExpired counts, size exposed)
    - `server/src/utils/dbSchema.ts` (clear cache export)
    - `server/src/utils/orgColumn.ts` (clear cache export)
  - Trial cron demo cleanup no longer fakes success:
    - `server/src/cron/TrialCron.ts` (demo cleanup runs when service available; logs skip otherwise)
  - Local runs:
    - `cd server && npm run build`
    - `npm run test:quality-check`
    - `npm run test:l4:local:isolated`
  - Removed fallback stubs in AI policy core:
    - `server/src/services/aiPolicyEngine.ts` no longer installs minimal stub guards on import failure; project-scoped policy now fails honestly with `503 FEATURE_UNAVAILABLE`
  - Removed runtime “success stubs” (honest contracts instead of fake payloads):
    - `server/src/routes/performance.routes.ts` computes latency percentiles from in-process histograms (no placeholder zeros)
    - `tests/integration/routes/performanceRoutes.metrics.test.ts`
    - `server/src/ai/actionExecutors/taskExecutor.ts` + `server/src/ai/actionExecutors/meetingExecutor.ts` no longer return stub-success results (feature unavailable instead)
    - `server/src/ai/actionErrors.ts` includes `FEATURE_UNAVAILABLE` classification; `server/src/routes/actionDecisions.routes.ts` maps it to `503`
    - `server/src/services/aiSettingsService.ts` available-models errors are `503 FEATURE_UNAVAILABLE` (not silent `[]`), mapped in:
      - `server/src/routes/ai-settings.routes.ts`
      - `server/src/routes/ai/ai-settings.routes.ts`
    - `server/src/controllers/SuperAdminController.ts` invoice PDF + branding logo upload return honest `503 FEATURE_UNAVAILABLE`
    - `server/src/routes/organization/organization-profiles.routes.ts` logo upload + custom-domain verification no longer return placeholder success (503 FEATURE_UNAVAILABLE)
    - `tests/e2e/smoke/deploy-gate-api-branding-org-profile.spec.ts` updated to enforce “no fake uploads / no simulated DNS verify” and allow explicit 503 FEATURE_UNAVAILABLE
    - `server/src/controllers/SuperAdminController.ts` compliance audits placeholder now returns honest `503 FEATURE_UNAVAILABLE`
    - `server/src/controllers/SuperAdminController.ts` proration calculation no longer uses randomness (503 FEATURE_UNAVAILABLE)
    - `server/src/routes/integrations/calendarIntegrations.routes.ts` no longer returns placeholder `200` payload (503 FEATURE_UNAVAILABLE)
    - `server/src/routes/organization/branding.routes.ts` superadmin domain verification no longer simulates DNS verify (503 FEATURE_UNAVAILABLE)
    - `server/src/cron/ReportGenerationCron.js` legacy scheduled reports no longer generate fake IDs (disabled/unavailable)
    - `server/src/ai/simulationEngine.ts` removed test-stub/dummy outputs for advanced simulations (explicit feature unavailable unless a real `SimulationService` is provided)
    - `server/src/ai/connectorAdapter.ts` no longer returns mock “real execution” success for external connectors (dry-run only; otherwise FEATURE_UNAVAILABLE)
    - `server/src/services/aiService.ts` now routes chat generation through the real `llmService` (no empty-string placeholder)
    - `server/src/services/assessmentInitiativeService.ts` no longer returns silent `[]` when AI is missing/fails (503 FEATURE_UNAVAILABLE)
    - `server/src/routes/prompt-assistant.routes.ts` no longer returns simulated chat/test-bench outputs; uses real AI or returns honest 503
    - `server/src/routes/analytics-superadmin.routes.ts` removed demo/random fallbacks (unsupported formulas -> 400; model training -> 503)
    - `server/src/services/MFAService.ts` removed stub fake-success responses; MFA setup/enable/disable are honest 503 FEATURE_UNAVAILABLE
  - `tests/integration/routes/aiMemoryMetrics.no-stubs.test.ts`
  - `server/src/services/aiRoleGuard.ts` + `server/src/services/regulatoryModeGuard.ts` (removed placeholders; now DB-backed via `project_ai_settings`)
  - `server/src/controllers/ProjectController.ts` (removes `{ } as any` stubs; consistent availability + role normalization)
  - `server/src/database/DatabaseInitializer.ts` + `server/src/database/PostgresDatabase.ts` (creates `project_ai_settings` in SQLite + Postgres)
  - `tests/integration/routes/pmo/projects.aiRole-and-regulatory.real.test.ts`
  - `server/src/services/aiContextBuilder.ts` (removes `AISettingsService` `{ } as any` stub; imports real service)
  - AI explainability endpoints no longer return mock payloads:
    - `server/src/controllers/ai/AIExplainabilityController.ts` returns honest `503 FEATURE_UNAVAILABLE`
    - `tests/integration/routes/aiExplainability.no-stubs.test.js`
  - Metrics conversion intelligence and funnels no longer ship fake defaults:
    - `server/src/routes/metrics.routes.ts` `/conversion-intelligence` returns honest `503 FEATURE_UNAVAILABLE`
    - `server/src/routes/metrics.routes.ts` funnels use real counts (no fallback defaults)
    - `tests/integration/routes/metrics.conversion-intelligence.no-stub.test.js`
  - Token billing purchase requires Stripe (no demo credit path):
    - `server/src/routes/tokenBilling.routes.ts` now returns honest `503 FEATURE_UNAVAILABLE`
    - `tests/integration/routes/tokenBilling.test.js`
  - Stripe webhook dunning uses real PaymentIntent fetch (no mock payloads):
    - `server/src/routes/webhooks.routes.ts`
  - SMS delivery no longer returns mock success when Twilio is missing:
    - `server/src/services/smsService.ts`
- **Next targets (examples found via scan)**:
  - Remove/replace self-loading wrappers under `server/src/services/**` that lazy-load themselves (convert to real implementations or explicit 503 contracts)

---

## EPIC D — Coverage to 98% (P0/P1; staged rollout)

> Reality check: hitting 98% “whole repo” is extremely expensive. Do it professionally by **defining scope** and expanding it gradually with enforced gates.

### QA-030 (P0) — Define the coverage scope and exclusions
**Goal**: stop ambiguity and prevent disputes.

- **Status**: TODO
- **Acceptance criteria**:
  - Document exact include/exclude globs (frontend/backend/tests/scripts).
  - CI enforces the same scope locally and in GitHub Actions.

### QA-031 (P0) — Add a global 98% coverage gate (scoped)
**Goal**: hard CI failure when coverage drops below target.

- **Status**: TODO
- **Acceptance criteria**:
  - CI job fails if scoped totals < 98%.
  - Per-file thresholds remain for “critical path” (keep existing approach).
- **Depends on**: QA-030.

### QA-032 (P1) — Expand L1/L2/L3 per-file threshold profiles (progressive hardening)
**Goal**: systematically raise coverage where it matters.

- **Status**: TODO
- **Acceptance criteria**:
  - Add N new files per week into `scripts/testing/coverage-thresholds.ts` (or equivalent), each at ≥95% per-file.
  - Each addition comes with tests that exercise real code paths.
  - Each tranche is recorded in `docs/test-quality/levels-l1-l5-95-roadmap.md` (treat it as the execution checklist).

**2026-02-21 recommended first tranches (based on recent large merges touching `server/src/**` + `src/components/**`):**

- **L1 (security boundary middleware):**
  - `server/src/middleware/rateLimitUserId.middleware.ts`
  - `server/src/middleware/resourceQuota.middleware.ts`
  - `server/src/utils/security.utils.ts`
- **L2 (UI boundary — AI Chat):**
  - Ensure L2 runner includes `tests/components/AIChat/**` so it actually executes under `test:l2:coverage`.
  - Gate files:
    - `src/components/AIChat/UnifiedChatPanel.tsx`
    - `src/components/AIChat/CoThinkerModeSelector.tsx`
    - `src/components/AIChat/ToolsMenu.tsx`
    - `src/components/AIChat/ConversationList.tsx`
- **L3 (integration — deterministic DB-backed routes):**
  - `server/src/routes/billing/billing.routes.ts` (align with existing integration suites under `tests/integration/routes/billing*.test.*`)

### QA-033 (P1) — Remove dead/unreachable code that blocks coverage
**Goal**: don’t “test the impossible”; delete it.

- **Status**: TODO
- **Acceptance criteria**:
  - Dead code paths removed, or made reachable by product logic.
  - Coverage rises without artificial tests.

---

## EPIC E — Flake elimination + observability (P0/P1)

### QA-040 (P0) — Flake budget & quarantine rules
**Goal**: 100% pass is meaningless without flake control.

- **Status**: TODO
- **Acceptance criteria**:
  - Define “flake = any non-deterministic failure in 10 consecutive runs”.
  - Any flaky test must be fixed within 24–48h or removed from PR gate (but kept visible).

### QA-041 (P1) — Add test-run correlation IDs across backend logs
**Goal**: debug fails fast.

- **Status**: TODO
- **Acceptance criteria**:
  - L4 injects `x-test-run-id` header.
  - Backend logs include it; failures can be traced per run.

---

## EPIC F — Security / correctness hardening under real runtime (P1)

### QA-050 (P1) — Ensure E2E auth modes do not weaken production security
**Goal**: E2E convenience must not become prod backdoor.

- **Status**: TODO
- **Acceptance criteria**:
  - Any E2E-only auth path is hard-guarded by environment + secret.
  - Security tests verify the guard (cannot be enabled in prod).

---

## Delivery order (recommended)

1) **QA-001 → QA-004** (external DB L4 determinism)  
2) **QA-010 → QA-013** (remove runtime placeholders)  
3) **QA-030 → QA-033** (coverage to 98% with real scope)  
4) **QA-040 → QA-041 → QA-050** (flake/observability/security)
