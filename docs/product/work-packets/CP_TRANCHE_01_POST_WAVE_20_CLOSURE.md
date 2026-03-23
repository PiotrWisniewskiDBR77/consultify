# CP Tranche 01 — Post-Wave-20 Closure: DB Foundation → First V8 Feature

> Status: Ready for assignment
> Owner: Manager Agent
> Tranche target: bring V8 from "34 services / 413 functions / ~2,590 tests / 44 migrations / zero routes / zero frontend" to "first V8 feature (Chat + AI Core) running in production behind feature flag with real-DB verification"
> Date: 2026-03-23

---

## 1. Execution tranche goal

This tranche closes the gap between the V8 backend code (services, migrations, tests) and production reality. Today V8 has 34 backend services with 413 exported functions, 44 `v8_*` migration files, and ~2,590 unit/integration tests — but zero API routes, zero frontend wiring, zero feature flags, and zero real-DB verification. This tranche delivers the infrastructure spine that makes V8 code reachable from production: real-DB migrations running against Railway Postgres, an API exposure layer with auth, a feature flag system for phased rollout, and the first frontend client wiring for Chat + AI Core. Completing this tranche means the first V8 capability can be shadow-tested in production within the 8-week target.

---

## 2. Packet queue

---

### CP-01: V8 Migration Runner & Real-DB Verification

**Objective:** Create a reliable, idempotent migration runner that can apply all 44 `v8_*` migrations against the real Railway Postgres database and verify schema correctness.

**Why now:** Every other packet depends on V8 tables existing in the real database. Without this, all services remain test-only. The existing 44 migration files (e.g., `20260323_v8_context_snapshot.sql`, `20260323_v8_tool_governance.sql`, `20260323_v8_chat_execution.sql`) have never been applied to the production or staging database.

**Scope:**
- Audit all 44 `server/migrations/20260323_v8_*.sql` files for correctness, idempotency, and ordering
- Create a V8-specific migration manifest that declares dependency order
- Build a migration runner script that targets `DATABASE_PUBLIC_URL` (never `*.railway.internal` from local)
- Add dry-run mode that reports planned DDL without executing
- Add rollback stubs for each migration (at minimum `DROP TABLE IF EXISTS`)
- Run the full migration set against staging Railway Postgres
- Produce a schema verification report comparing expected vs actual tables/columns

**Out of scope:**
- Modifying existing (non-V8) migration files
- Data seeding or fixture loading
- Performance tuning of V8 tables
- Any migration for tables not prefixed with `v8_`

**Dependencies:** None — this is the root packet.

**Required docs:**
- `V8_IMPLEMENTATION_MASTER_PROGRAM.md` (section 2 — source-of-truth model)
- `server/migrations/20260323_v8_*.sql` (all 44 files)
- `server/src/config/databaseTargetResolver.ts` (DB targeting rules)
- `.cursorrules` (Railway DB targeting rules)

**Deliverables:**
- `server/scripts/v8-migrate.ts` — migration runner with dry-run, apply, rollback modes
- `server/migrations/v8-manifest.json` — ordered list of V8 migrations with dependency metadata
- `docs/product/work-packets/CP-01-MIGRATION-VERIFICATION-REPORT.md` — schema verification report

**Definition of done:**
- All 44 V8 migrations apply cleanly to staging Railway Postgres in a single run
- Dry-run mode produces correct DDL output without side effects
- Re-running the migration set is idempotent (no errors on second run)
- Schema verification report confirms all expected `v8_*` tables exist with correct columns
- Rollback stubs exist for every migration

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If any migration file references tables outside the `v8_*` namespace that don't exist → escalate to determine if a dependency migration is missing
- If `DATABASE_PUBLIC_URL` is not configured for staging → escalate to infra
- If any migration conflicts with existing schema → escalate with conflict report

---

### CP-02: V8 Real-DB Integration Test Harness

**Objective:** Create a test harness that runs V8 service tests against real Railway Postgres instead of mocked/in-memory DB, proving that the 34 services work with actual schema.

**Why now:** The existing ~2,590 tests use `DbPromise` with SQLite-compatible queries. We need proof that V8 services work against the real Postgres schema before exposing them via API. This is the verification gate for CP-01.

**Scope:**
- Create a `v8-db-test` configuration that connects to a dedicated test database on Railway
- Adapt the test runner to support Postgres-compatible execution for V8 tests
- Run the existing unit tests in `server/src/services/v8/__tests__/` against real DB
- Run the existing integration tests in `server/src/services/v8/__tests__/integration/` against real DB
- Identify and document any SQLite-vs-Postgres incompatibilities
- Produce a compatibility report with pass/fail per service

**Out of scope:**
- Rewriting tests to fix Postgres incompatibilities (that's a follow-up packet)
- Testing non-V8 services
- Load testing or performance benchmarking
- Creating new tests

**Dependencies:** CP-01 (migrations must be applied first)

**Required docs:**
- `server/src/services/v8/__tests__/` (all test files)
- `server/src/utils/DbPromise.ts` (DB abstraction layer)
- `server/src/database/Database.js` (connection management)
- `server/src/config/databaseTargetResolver.ts`

**Deliverables:**
- `server/jest.config.v8-db.ts` — test configuration for real-DB V8 tests
- `docs/product/work-packets/CP-02-DB-VERIFICATION-REPORT.md` — pass/fail report per service, listing incompatibilities
- List of services requiring Postgres-specific fixes

**Definition of done:**
- Test harness connects to Railway Postgres and runs V8 test suites
- Compatibility report covers all 34 V8 services
- Pass rate and failure reasons are documented per service
- No test modifies production data (test isolation confirmed)

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If `DbPromise` abstraction is fundamentally SQLite-only → escalate to determine Postgres adapter strategy
- If test database provisioning on Railway is blocked → escalate to infra
- If >50% of tests fail due to dialect differences → escalate to re-scope the Postgres adaptation effort

---

### CP-03: V8 API Router Foundation

**Objective:** Create the Express router infrastructure for V8 API routes, establishing the `/api/v8/` namespace, versioning convention, and shared middleware chain.

**Why now:** V8 has 34 services and 413 functions but zero API routes (`server/src/routes/` has 370+ route files, none for V8). The API layer is the bridge between backend services and frontend. This must exist before any V8 feature can be wired.

**Scope:**
- Create `server/src/routes/v8/index.ts` as the V8 router aggregator
- Define the `/api/v8/` URL namespace convention
- Wire the V8 router into the main Express app (update `server/src/routes/index.ts`)
- Create shared V8 middleware chain: auth → org-context → V8-feature-flag-gate → request validation
- Create `server/src/routes/v8/health.routes.ts` as the first V8 route (health check using `platformHealthService.ts`)
- Define the V8 route naming convention and file structure standard
- Add OpenAPI/Swagger stub for V8 routes

**Out of scope:**
- Implementing domain-specific V8 routes (Chat, AI Core, etc.)
- Frontend client generation
- Rate limiting specific to V8 (reuse existing)
- WebSocket/Socket.io routes

**Dependencies:** None (can run in parallel with CP-01)

**Required docs:**
- `server/src/routes/index.ts` (existing route registration pattern)
- `server/src/middleware/auth.middleware.ts` (existing auth pattern)
- `server/src/middleware/orgContext.middleware.ts` (existing org resolution)
- `server/src/services/v8/platformHealthService.ts` (first service to expose)

**Deliverables:**
- `server/src/routes/v8/index.ts` — V8 router aggregator
- `server/src/routes/v8/health.routes.ts` — health check route
- `server/src/middleware/v8FeatureGate.middleware.ts` — V8 feature flag middleware
- Updated `server/src/routes/index.ts` with V8 router mount
- `docs/product/work-packets/CP-03-API-CONVENTION.md` — V8 API naming and structure standard

**Definition of done:**
- `GET /api/v8/health` returns a valid response when V8 feature flag is enabled
- `GET /api/v8/health` returns 404 or 503 when V8 feature flag is disabled
- V8 router is mounted in the main Express app without breaking existing routes
- Auth middleware correctly gates V8 routes
- Org-context middleware correctly resolves organization for V8 routes

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If the existing Express app architecture doesn't support clean namespace mounting → escalate with proposed refactor
- If auth middleware requires V8-specific changes → escalate to determine scope

---

### CP-04: V8 Auth Integration Layer

**Objective:** Ensure V8 API routes integrate correctly with the existing authentication and authorization system, including org-scoped access control for V8 resources.

**Why now:** V8 services use `organizationId` for tenant isolation (visible in `contextSnapshotService.ts` and all other services). The auth layer must correctly propagate user identity and org context into V8 service calls. Without this, V8 routes would be either unauthenticated or incorrectly scoped.

**Scope:**
- Audit existing `auth.middleware.ts` for compatibility with V8 route requirements
- Verify `orgContext.middleware.ts` correctly resolves org for V8 endpoints
- Create V8-specific auth helpers if needed (e.g., V8 resource ownership checks)
- Define the V8 permission model: which existing roles can access V8 features
- Create integration tests for auth flow on V8 routes
- Document the auth contract for V8 API consumers

**Out of scope:**
- Creating new auth providers or SSO integrations
- Changing the existing auth middleware for non-V8 routes
- Role-based access control beyond basic org membership
- Admin/superadmin V8 permissions (later tranche)

**Dependencies:** CP-03 (V8 router must exist to test auth integration)

**Required docs:**
- `server/src/middleware/auth.middleware.ts`
- `server/src/middleware/orgContext.middleware.ts`
- `server/src/services/v8/contextSnapshotService.ts` (reference for org isolation pattern)
- `AI_IDENTITY_ROLES_AND_SCOPE_ARCHITECTURE_V8.md`

**Deliverables:**
- `server/src/middleware/v8Auth.middleware.ts` — V8-specific auth utilities (if needed beyond existing middleware)
- `server/src/routes/v8/__tests__/auth-integration.test.ts` — auth integration tests
- `docs/product/work-packets/CP-04-AUTH-CONTRACT.md` — V8 auth contract document

**Definition of done:**
- Authenticated requests to `/api/v8/*` correctly resolve user identity
- Org-scoped V8 endpoints correctly enforce org membership
- Unauthenticated requests receive 401
- Wrong-org requests receive 403
- Auth contract document covers all V8 auth scenarios

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If existing auth middleware cannot be extended for V8 without breaking changes → escalate with migration plan
- If V8 requires a different permission model than existing roles → escalate to source-of-truth chat

---

### CP-05: V8 Feature Flag System

**Objective:** Extend the existing feature flag system to support V8 module-level and per-org feature gating, enabling phased rollout with shadow mode.

**Why now:** The existing `server/src/config/FeatureFlags.ts` has 7 boolean flags with no per-org or per-module granularity. V8 needs: (a) a global V8 kill switch, (b) per-module flags (Chat V8, AI Core V8, etc.), (c) per-org rollout capability, and (d) shadow mode support. This is a prerequisite for safe production deployment.

**Scope:**
- Extend `FeatureFlags.ts` with V8-specific flags: `ENABLE_V8_GLOBAL`, `ENABLE_V8_CHAT`, `ENABLE_V8_AI_CORE`
- Add per-org flag override capability (stored in DB, not just env vars)
- Create `server/src/services/v8/featureFlagService.ts` with: `isV8Enabled(orgId, module)`, `getV8Flags(orgId)`, `setV8Flag(orgId, module, enabled)`
- Create the `v8_feature_flags` migration for per-org flag storage
- Integrate with the `v8FeatureGate.middleware.ts` from CP-03
- Add shadow mode flag: `V8_SHADOW_MODE` that enables V8 processing without replacing legacy responses
- Create admin API for managing V8 flags per org

**Out of scope:**
- A/B testing framework
- Percentage-based rollout (binary per-org for now)
- Feature flag UI in frontend (later tranche)
- Flags for non-V8 features

**Dependencies:** CP-03 (middleware integration point)

**Required docs:**
- `server/src/config/FeatureFlags.ts` (existing flag system)
- `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` (canary/rollout doctrine)
- `V8_IMPLEMENTATION_MASTER_PROGRAM.md` (phased rollout principle)

**Deliverables:**
- Updated `server/src/config/FeatureFlags.ts` with V8 flags
- `server/src/services/v8/featureFlagService.ts` — per-org flag management
- `server/migrations/20260324_v8_feature_flags.sql` — per-org flag storage
- Updated `server/src/middleware/v8FeatureGate.middleware.ts` — per-org flag checking
- `server/src/routes/v8/admin/feature-flags.routes.ts` — admin API for flag management
- `server/src/services/v8/__tests__/featureFlagService.test.ts` — unit tests

**Definition of done:**
- `ENABLE_V8_GLOBAL=false` blocks all V8 routes
- `ENABLE_V8_CHAT=true` for org X enables Chat V8 routes only for org X
- Shadow mode flag enables V8 processing without replacing legacy responses
- Admin API can toggle flags per org
- Feature flag state is queryable for monitoring/observability
- Existing non-V8 feature flags are unaffected

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If per-org flag storage conflicts with existing config architecture → escalate with proposed design
- If shadow mode requires changes to legacy route handlers → escalate to determine scope

---

### CP-06: Chat + AI Core API Routes (First V8 Module Exposure)

**Objective:** Create the API routes that expose Chat and AI Core V8 services, making them the first V8 module reachable from the frontend.

**Why now:** The decision package recommends Chat + AI Core as the first module to wire. The services already exist: `chatExecutionService.ts`, `contextSnapshotService.ts`, `contextConsumerBindingService.ts`, `aiOperatingEnvironmentService.ts`. This packet creates the HTTP surface for these services.

**Scope:**
- Create `server/src/routes/v8/chat.routes.ts` exposing:
  - Context snapshot CRUD (capture, get, list by conversation, list by run)
  - Context consumer binding operations
  - Chat execution service endpoints
- Create `server/src/routes/v8/ai-core.routes.ts` exposing:
  - AI operating environment status
  - Trust audit endpoints (from `trustAuditService.ts`)
  - Tool governance query endpoints (from `toolGovernanceService.ts`)
- Wire both route files into `server/src/routes/v8/index.ts`
- Add request validation using Zod schemas (reuse existing type schemas from services)
- Add response envelope standardization for V8 routes

**Out of scope:**
- WebSocket/real-time endpoints
- Execution Agent routes
- Knowledge RAG routes
- Prompt OS routes
- Frontend client code
- Full CRUD for all V8 services

**Dependencies:** CP-03 (router foundation), CP-04 (auth integration)

**Required docs:**
- `server/src/services/v8/chatExecutionService.ts`
- `server/src/services/v8/contextSnapshotService.ts`
- `server/src/services/v8/contextConsumerBindingService.ts`
- `server/src/services/v8/aiOperatingEnvironmentService.ts`
- `server/src/services/v8/trustAuditService.ts`
- `server/src/services/v8/toolGovernanceService.ts`
- `CHAT_V8_SSOT.md`
- `AI_CORE_V8_READINESS_AUDIT.md`

**Deliverables:**
- `server/src/routes/v8/chat.routes.ts`
- `server/src/routes/v8/ai-core.routes.ts`
- `server/src/routes/v8/__tests__/chat.routes.test.ts`
- `server/src/routes/v8/__tests__/ai-core.routes.test.ts`
- Updated `server/src/routes/v8/index.ts`

**Definition of done:**
- All Chat V8 endpoints return correct data when called with valid auth
- All AI Core V8 endpoints return correct data when called with valid auth
- Request validation rejects malformed input with 400
- Org isolation is enforced on all endpoints
- Feature flag gate blocks access when Chat/AI Core V8 is disabled for the org
- Route tests pass with mocked services

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If service function signatures don't map cleanly to REST endpoints → escalate with proposed API design
- If Chat V8 requires WebSocket for core functionality → escalate to determine if REST-first is viable

---

### CP-07: Frontend V8 Client Foundation

**Objective:** Create the frontend API client layer and React provider infrastructure for consuming V8 API routes, establishing the pattern all V8 UI work will follow.

**Why now:** Without a frontend client layer, no V8 UI work can begin. This packet creates the shared infrastructure: API client, React context/providers, hooks pattern, and feature flag integration on the client side.

**Scope:**
- Create `src/api/v8/client.ts` — typed API client for V8 endpoints (using existing fetch/axios pattern)
- Create `src/api/v8/chat.ts` — Chat V8 API functions
- Create `src/api/v8/ai-core.ts` — AI Core V8 API functions
- Create `src/providers/V8Provider.tsx` — React context provider for V8 feature flag state
- Create `src/hooks/useV8FeatureFlag.ts` — hook for checking V8 feature availability
- Create `src/hooks/useV8Chat.ts` — hook for Chat V8 operations (React Query)
- Integrate V8Provider into `src/providers/AppProviders.tsx`
- Add V8 feature flag check to existing Chat UI entry point (conditional rendering)

**Out of scope:**
- Building new Chat UI components
- Replacing existing Chat functionality
- V8 UI for modules other than Chat + AI Core
- Mobile/responsive considerations
- Offline support

**Dependencies:** CP-05 (feature flags for client-side gating), CP-06 (API routes to call)

**Required docs:**
- `src/providers/AppProviders.tsx` (existing provider pattern)
- `src/components/settings/FeatureFlagsDevToolsToggleButton.tsx` (existing client-side flag pattern)
- Existing API client patterns in `src/api/` or equivalent
- `CHAT_V8_SSOT.md`

**Deliverables:**
- `src/api/v8/client.ts` — base V8 API client
- `src/api/v8/chat.ts` — Chat V8 API functions
- `src/api/v8/ai-core.ts` — AI Core V8 API functions
- `src/providers/V8Provider.tsx` — V8 context provider
- `src/hooks/useV8FeatureFlag.ts` — feature flag hook
- `src/hooks/useV8Chat.ts` — Chat V8 data hook
- Updated `src/providers/AppProviders.tsx`

**Definition of done:**
- V8Provider correctly fetches and caches V8 feature flag state for the current org
- `useV8FeatureFlag('chat')` returns correct enabled/disabled state
- `useV8Chat` hooks can fetch data from V8 Chat API endpoints
- V8 client handles auth token propagation correctly
- Existing app functionality is unaffected when V8 flags are disabled
- TypeScript types are fully generated from API contract

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If existing frontend architecture doesn't support provider injection → escalate with proposed approach
- If existing Chat component is too tightly coupled for conditional V8 rendering → escalate to determine refactor scope

---

### CP-08: Shadow Mode Infrastructure

**Objective:** Build the shadow mode infrastructure that allows V8 services to process requests in parallel with legacy services, comparing outputs without affecting users.

**Why now:** The decision package mandates "phased replacement with shadow mode" as the rollout strategy. Shadow mode is the safety mechanism that enables the 8-week target — it allows V8 to run in production without risk. This must be ready before any V8 feature goes live.

**Scope:**
- Create `server/src/services/v8/shadowModeService.ts` — orchestrates parallel execution of legacy + V8 paths
- Create shadow mode middleware that intercepts requests and runs both paths
- Create comparison/diff logic for legacy vs V8 responses
- Create shadow mode logging/metrics (response time, output diff, error rate)
- Store shadow comparison results in `v8_shadow_results` table
- Create admin API to view shadow mode results and metrics
- Define shadow → live promotion criteria

**Out of scope:**
- Actual migration of any feature from legacy to V8
- Frontend shadow mode UI
- Shadow mode for WebSocket/real-time features
- Automated promotion (manual decision for now)

**Dependencies:** CP-03 (router), CP-05 (feature flags for shadow mode toggle)

**Required docs:**
- `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` (canary/rollout doctrine)
- `V8_IMPLEMENTATION_MASTER_PROGRAM.md` (phased rollout)
- Existing Chat route handlers (legacy path to shadow)

**Deliverables:**
- `server/src/services/v8/shadowModeService.ts`
- `server/src/middleware/v8Shadow.middleware.ts`
- `server/migrations/20260324_v8_shadow_results.sql`
- `server/src/routes/v8/admin/shadow-results.routes.ts`
- `server/src/services/v8/__tests__/shadowModeService.test.ts`
- `docs/product/work-packets/CP-08-SHADOW-PROMOTION-CRITERIA.md`

**Definition of done:**
- Shadow mode can be enabled per org via feature flag
- When enabled, both legacy and V8 paths execute for the same request
- Legacy response is always returned to the user (V8 response is logged only)
- Response time overhead of shadow mode is <100ms p95
- Shadow comparison results are stored and queryable
- Promotion criteria document defines when shadow → live is safe

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If legacy Chat handlers are not cleanly separable for parallel execution → escalate with refactor proposal
- If shadow mode overhead exceeds acceptable latency → escalate to determine optimization strategy

---

### CP-09: V8 Observability & Health Dashboard

**Objective:** Create the observability foundation for V8 services: structured logging, health checks, and a basic metrics endpoint that operators can use to monitor V8 rollout.

**Why now:** Before V8 goes to production (even in shadow mode), operators need visibility into V8 service health, error rates, and performance. This is a rollout safety prerequisite.

**Scope:**
- Extend `platformHealthService.ts` to report per-service health for all 34 V8 services
- Create structured logging convention for V8 services (already partially exists with `LOG_PREFIX` pattern)
- Create `/api/v8/admin/health` endpoint with detailed service status
- Create `/api/v8/admin/metrics` endpoint with basic counters (requests, errors, latency)
- Add V8-specific error codes and error response format
- Create a health check that verifies V8 DB tables exist and are accessible

**Out of scope:**
- Grafana/Datadog integration
- Alerting rules
- Full APM instrumentation
- Non-V8 service monitoring

**Dependencies:** CP-01 (DB must exist for health checks), CP-03 (router for endpoints)

**Required docs:**
- `server/src/services/v8/platformHealthService.ts`
- `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
- `server/src/utils/Logger.ts`

**Deliverables:**
- Updated `server/src/services/v8/platformHealthService.ts` with per-service health
- `server/src/routes/v8/admin/health.routes.ts`
- `server/src/routes/v8/admin/metrics.routes.ts`
- `server/src/utils/v8ErrorCodes.ts` — V8 error code registry
- `server/src/services/v8/__tests__/platformHealthService.test.ts` — updated tests

**Definition of done:**
- `/api/v8/admin/health` returns status for all 34 V8 services
- `/api/v8/admin/metrics` returns request count, error count, avg latency
- Health check verifies V8 DB tables are accessible
- V8 error codes are documented and consistent
- Operators can determine V8 system state from health endpoint alone

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If existing logging infrastructure doesn't support structured V8 logs → escalate with proposed approach
- If health check requires DB access patterns not supported by current architecture → escalate

---

### CP-10: V8 Rollout Safety Checklist & Go/No-Go Gate

**Objective:** Produce the definitive rollout safety checklist and go/no-go gate criteria for enabling the first V8 feature (Chat + AI Core) in production shadow mode.

**Why now:** This is the verification and governance packet that ensures all technical prerequisites are met before any V8 code touches production traffic. It synthesizes the outputs of all other packets into a single decision-ready document.

**Scope:**
- Audit outputs of CP-01 through CP-09 for completeness
- Define the exact go/no-go criteria for shadow mode activation
- Define the exact go/no-go criteria for shadow → live promotion
- Create rollback procedures for each V8 component
- Define monitoring thresholds that trigger automatic V8 disable
- Create the production deployment checklist (Railway-specific)
- Define the communication plan for V8 shadow activation

**Out of scope:**
- Executing the actual production deployment
- Creating monitoring dashboards (CP-09 covers the data)
- Business stakeholder communication
- Legal/compliance review

**Dependencies:** CP-01 through CP-09 (all must be at least 80% complete)

**Required docs:**
- All CP-01 through CP-09 deliverable documents
- `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
- `V8_IMPLEMENTATION_MASTER_PROGRAM.md`
- `.cursorrules` (Railway safety rules)

**Deliverables:**
- `docs/product/work-packets/CP-10-ROLLOUT-SAFETY-CHECKLIST.md`
- `docs/product/work-packets/CP-10-GO-NOGO-GATE.md`
- `docs/product/work-packets/CP-10-ROLLBACK-PROCEDURES.md`

**Definition of done:**
- Every go/no-go criterion is binary (yes/no) and testable
- Rollback procedure is documented for each V8 component
- Monitoring thresholds are defined with specific numbers
- Deployment checklist is Railway-specific and actionable
- Document has been reviewed against all CP outputs

**Owner type:** `manager-owned`

**Execution type:** `analysis-only`

**Blockers / escalation conditions:**
- If any CP packet reveals a fundamental architectural issue → escalate before completing this gate
- If Railway deployment constraints require changes to the rollout plan → escalate to infra

---

### CP-11: V8 Postgres Dialect Adaptation

**Objective:** Fix all SQLite-vs-Postgres incompatibilities discovered by CP-02, ensuring V8 services work correctly against real Postgres.

**Why now:** CP-02 will produce a compatibility report. This packet fixes the identified issues. It's sequenced after CP-02 but is critical path — V8 cannot go to production if services fail against real Postgres.

**Scope:**
- Fix all Postgres-incompatible SQL in V8 services (based on CP-02 report)
- Update `DbPromise` usage in V8 services to use Postgres-compatible patterns
- Ensure all V8 Zod schemas handle Postgres data types correctly (e.g., boolean vs integer, timestamp formats)
- Re-run the full V8 test suite against Postgres after fixes
- Update migration files if schema changes are needed for Postgres compatibility

**Out of scope:**
- Fixing non-V8 services for Postgres
- Migrating the entire app from SQLite to Postgres
- Query optimization
- Connection pooling changes

**Dependencies:** CP-02 (compatibility report must exist)

**Required docs:**
- CP-02 verification report (deliverable)
- `server/src/utils/DbPromise.ts`
- All V8 service files in `server/src/services/v8/`

**Deliverables:**
- Updated V8 service files with Postgres-compatible queries
- Updated V8 migration files (if needed)
- `docs/product/work-packets/CP-11-POSTGRES-FIXES.md` — change log of all fixes applied
- Green test suite against Postgres

**Definition of done:**
- 100% of V8 unit tests pass against Postgres
- 100% of V8 integration tests pass against Postgres
- No SQLite-specific syntax remains in V8 service code
- Change log documents every fix with before/after

**Owner type:** `worker-eligible`

**Execution type:** `code-eligible`

**Blockers / escalation conditions:**
- If `DbPromise` abstraction fundamentally cannot support Postgres → escalate to determine adapter strategy
- If >20% of services need major rewrites → escalate to re-scope the effort

---

## 3. Sequential dependencies

```
CP-01 (Migration Runner)
  │
  ├──→ CP-02 (Real-DB Test Harness)
  │       │
  │       └──→ CP-11 (Postgres Dialect Adaptation)
  │
  └──→ CP-09 (Observability) ←── CP-03
                                    │
CP-03 (API Router Foundation) ──────┤
  │                                 │
  ├──→ CP-04 (Auth Integration) ────┤
  │       │                         │
  │       └──→ CP-06 (Chat + AI Core Routes) ──→ CP-07 (Frontend Client)
  │                                                     │
  ├──→ CP-05 (Feature Flags) ──→ CP-07 ────────────────┘
  │       │                         │
  │       └──→ CP-08 (Shadow Mode) ─┘
  │
  └──→ CP-09 (Observability)

CP-10 (Rollout Safety Gate) ←── ALL packets (CP-01 through CP-09, CP-11)
```

**Critical path:** CP-01 → CP-02 → CP-11 → CP-10 (DB readiness chain)

**Critical path (API):** CP-03 → CP-04 → CP-06 → CP-07 → CP-10 (API + frontend chain)

---

## 4. Parallel packet groups

### Group A — Can start immediately (Day 1)
| Packet | Duration | Notes |
|--------|----------|-------|
| CP-01: Migration Runner | 2-3 days | Root dependency, no blockers |
| CP-03: API Router Foundation | 2-3 days | Independent of DB work |

### Group B — Can start after Group A begins (Day 2-3)
| Packet | Duration | Trigger |
|--------|----------|---------|
| CP-05: Feature Flags | 3-4 days | Can start in parallel with CP-03, shares middleware |
| CP-09: Observability | 2-3 days | Needs CP-01 partial + CP-03 partial |

### Group C — Requires Group A completion (Day 4-5)
| Packet | Duration | Trigger |
|--------|----------|---------|
| CP-02: Real-DB Test Harness | 3-4 days | After CP-01 completes |
| CP-04: Auth Integration | 2-3 days | After CP-03 completes |

### Group D — Requires Group B+C completion (Day 7-10)
| Packet | Duration | Trigger |
|--------|----------|---------|
| CP-06: Chat + AI Core Routes | 3-5 days | After CP-03 + CP-04 |
| CP-08: Shadow Mode | 3-4 days | After CP-03 + CP-05 |
| CP-11: Postgres Adaptation | 2-5 days | After CP-02 (scope depends on findings) |

### Group E — Requires Group D completion (Day 10-14)
| Packet | Duration | Trigger |
|--------|----------|---------|
| CP-07: Frontend Client | 3-5 days | After CP-05 + CP-06 |

### Group F — Final gate (Day 14-16)
| Packet | Duration | Trigger |
|--------|----------|---------|
| CP-10: Rollout Safety Gate | 2-3 days | After all others are ≥80% |

**Maximum parallelism:** 3 workers simultaneously (Groups A+B overlap)

**Estimated total calendar time:** 14-18 working days with 2-3 parallel workers

---

## 5. Packets requiring source-of-truth approval

### Before starting
| Packet | Decision needed | Why |
|--------|----------------|-----|
| CP-05 | Confirm per-org flag granularity is sufficient (vs percentage rollout) | Affects rollout strategy for all future V8 modules |
| CP-08 | Confirm shadow mode is the approved rollout mechanism for Chat V8 | Determines whether CP-08 is needed at all |

### Before completing
| Packet | Decision needed | Why |
|--------|----------------|-----|
| CP-02 | If >50% Postgres failures: approve expanded adaptation scope | May significantly expand CP-11 |
| CP-10 | Approve go/no-go criteria before shadow activation | Business decision, not just technical |
| CP-11 | If `DbPromise` needs Postgres adapter: approve the adapter architecture | Cross-cutting change affecting all future V8 work |

---

## 6. Recommended first worker assignments

### Immediate assignment (Day 1)

**Worker 1 → CP-01: V8 Migration Runner**
- **Why first:** Root dependency. Every other packet that touches DB depends on this. The 44 migration files already exist — this is verification and tooling, not creation.
- **Expected duration:** 2-3 days
- **Risk:** Low. Migration files exist. Main risk is Postgres dialect issues in DDL.

**Worker 2 → CP-03: V8 API Router Foundation**
- **Why first:** Second root dependency. All API work depends on the router existing. This is infrastructure scaffolding with clear patterns to follow from the existing 370+ route files.
- **Expected duration:** 2-3 days
- **Risk:** Low. Clear patterns exist. Main risk is namespace conflicts.

### Second wave assignment (Day 2-3)

**Worker 3 → CP-05: V8 Feature Flag System**
- **Why second:** Unblocks both CP-07 (frontend) and CP-08 (shadow mode). The existing `FeatureFlags.ts` provides a clear extension point. Can start before CP-03 finishes since the middleware integration is a small final step.
- **Expected duration:** 3-4 days
- **Risk:** Medium. Per-org storage is new capability. Needs careful design.

### Third wave assignment (Day 4-5)

**Worker 1 (recycled) → CP-02: Real-DB Test Harness** (after CP-01 completes)

**Worker 2 (recycled) → CP-04: Auth Integration** (after CP-03 completes)

### Deferred until findings

**CP-11: Postgres Dialect Adaptation** — scope depends entirely on CP-02 findings. Do not assign until CP-02 report is complete.

**CP-10: Rollout Safety Gate** — manager-owned. Do not delegate. Compile from all other packet outputs.

---

## 7. Related canonical docs

- `V8_IMPLEMENTATION_MASTER_PROGRAM.md`
- `V8_FINAL_20_WAVE_IMPLEMENTATION_CLOSURE_PROGRAM.md`
- `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md`
- `AI_CORE_V8_READINESS_AUDIT.md`
- `AGENT_PROGRAM_OPERATING_MODEL_V8.md`
- `WORK_PACKET_TEMPLATE_V8.md`
- `MANAGER_AGENT_HANDOFF_BRIEF_V8.md`
- `CHAT_V8_SSOT.md`
- `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
- `AI_IDENTITY_ROLES_AND_SCOPE_ARCHITECTURE_V8.md`
- `DOCUMENTATION_REGISTRY.md`
