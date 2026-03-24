# V8 Post-20-Wave Closure Program

> Status: Draft v8
> Owner: Product + Engineering
> Scope: historical execution-grade program for closing the gap between V8 maturity level 2 (implemented, not wired) and full production closure across all 34 V8 services, 413 functions, 31 type files, 64 test files, 45 migrations and zero API routes / zero frontend integration / zero feature flags / zero operator surfaces

---

> Historical note (2026-03-24): this document remains a baseline snapshot of the post-20-wave closure starting point. It is no longer the primary source for current repo/runtime truth where later code, `IMPLEMENTATION_CONTROL_BOARD.md`, or `V8_V81_FINAL_COMPLETION_PROGRAM.md` show a more advanced state.

## 1. Closure program objective

This program transforms the V8 codebase from its current state — 34 isolated backend services with 413 exported functions, comprehensive unit tests but zero API routes, zero frontend wiring, zero feature flags and zero operator surfaces — into a fully integrated, production-verified, operator-ready platform layer. The program does not create new product vision; it closes the last mile between strong implementation and real production behavior. Every phase produces testable, deployable increments that move specific modules from "code exists" to "feature works end-to-end for real users."

---

## 2. Current maturity baseline

The V8 maturity model uses 8 levels:

| Level | Name | Definition |
| --- | --- | --- |
| 1 | Documented | Canonical product docs exist |
| 2 | Implemented | Backend services and logic exist in code |
| 3 | Wired | API routes exist, auth middleware applied, validation active |
| 4 | Integrated | Frontend calls API, UI renders real data, feature flags gate access |
| 5 | Verified | Integration tests pass against real DB, E2E tests pass, error paths tested |
| 6 | Operator-ready | Admin UI, monitoring dashboards, support diagnostics, rollback procedures exist |
| 7 | Rollout-ready | Feature flags configured, canary plan exists, rollback tested, documentation updated |
| 8 | Fully closed | Live in production, legacy cutover complete, old code removed, support model active |

### Current state per domain

| Domain | Services | Functions (approx) | Current level | Key evidence |
| --- | --- | --- | --- | --- |
| Context Snapshot / Identity | `contextSnapshotService`, `contextConsumerBindingService`, `sourceTruthService` | ~35 | 2 — Implemented | No routes, no frontend consumer, no real DB test |
| Governed Retrieval / Knowledge | `governedRetrievalService`, `knowledgeRetrievalService` | ~28 | 2 — Implemented | No retrieval gateway route, no ACL enforcement test against real DB |
| Chat Execution | `chatExecutionService`, `aiOperatingEnvironmentService` | ~24 | 2 — Implemented | No chat-to-execution API route, no frontend handoff |
| Execution Spine | `executionSpineService`, `executionVisibilityService` | ~30 | 2 — Implemented | No proposal/approval API, no execution dashboard wiring |
| Tool Governance | `toolGovernanceService`, `toolCollaborationService` | ~22 | 2 — Implemented | No tool catalog route, no risk-class enforcement in live runtime |
| Trust / Audit | `trustAuditService` | ~18 | 2 — Implemented | No provenance API, no support trace UI |
| Prompt OS Runtime | `promptOsRuntimeService` | ~16 | 2 — Implemented | No release bundle route, no eval gate integration |
| Multiplayer / Collaboration | `collaborationRoomService`, `concurrentEditingService`, `multiplayerHardeningService`, `workspaceCollaborationService` | ~40 | 2 — Implemented | No WebSocket room route, no presence API, no frontend collaboration |
| Version / Replay | `versionReplayService`, `replayDeadLetterService` | ~20 | 2 — Implemented | No version history API, no replay UI |
| Planning Continuity | `planningContinuityService` | ~14 | 2 — Implemented | No planning API route, no initiative-to-execution handoff |
| PM Sync | `pmSyncTruthService`, `pmSyncAuthService` | ~22 | 2 — Implemented | No sync webhook route, no OAuth flow, no operator recovery UI |
| Workspace Governance | `workspaceGovernanceService`, `workspaceAIFacilitationService`, `workspaceCrossModuleService` | ~30 | 2 — Implemented | No workspace governance route, no cross-module API |
| Publish / Review | `publishReviewService` | ~12 | 2 — Implemented | No publish lifecycle API, no review state UI |
| Reports / Presentations | `reportsPresModelService` | ~16 | 2 — Implemented | No output generation route, no template runtime API |
| Results / ROI | `resultsROIService` | ~18 | 2 — Implemented | No KPI lifecycle route, no ROI dashboard wiring |
| Finance Integration | `financeIntegrationService` | ~16 | 2 — Implemented | No ingestion route, no promotion API, no CFO workflow UI |
| MyWork Roof | `myWorkRoofService` | ~14 | 2 — Implemented | No cross-surface API, no unified inbox route |
| Operator / Admin | `operatorAdminService` | ~12 | 2 — Implemented | No admin dashboard route, no diagnostic API |
| Platform Health | `platformHealthService` | ~10 | 2 — Implemented | No health check route, no monitoring integration |
| Landing / Superadmin | `landingSuperadminService`, `toolsOrgAdminService` | ~16 | 2 — Implemented | No superadmin route, no landing integration |

**Summary: all 34 services sit at level 2. Zero services have reached level 3 or above.**

---

## 3. Target maturity model

Not every domain needs to reach level 8. The target depends on production criticality and user-facing importance.

| Domain | Target level | Rationale |
| --- | --- | --- |
| Context Snapshot / Identity | 7 — Rollout-ready | Foundation for all AI behavior; must be verified and rollback-safe before dependent modules go live |
| Governed Retrieval / Knowledge | 7 — Rollout-ready | Core AI grounding; enterprise trust depends on ACL and freshness being provably correct |
| Chat Execution | 8 — Fully closed | Primary user-facing AI surface; must complete legacy cutover |
| Execution Spine | 7 — Rollout-ready | Proposal/approval is cross-cutting; must be verified but can coexist with legacy execution during transition |
| Tool Governance | 6 — Operator-ready | Must be enforceable and auditable; full rollout follows AI operating environment proof |
| Trust / Audit | 7 — Rollout-ready | Support-visible trust trace is a hard requirement for enterprise customers |
| Prompt OS Runtime | 6 — Operator-ready | Release bundles and eval gates must work; full closure follows AI ops maturity |
| Multiplayer / Collaboration | 7 — Rollout-ready | Must be proven per-module before broad rollout; degraded states must be tested |
| Version / Replay | 6 — Operator-ready | History and replay must work; full closure is module-dependent |
| Planning Continuity | 7 — Rollout-ready | Initiative-to-execution handoff is core business value |
| PM Sync | 7 — Rollout-ready | External system integration must be auth-safe, recoverable and operator-visible |
| Workspace Governance | 6 — Operator-ready | Cross-module governance must be enforceable; full closure follows module onboarding |
| Publish / Review | 7 — Rollout-ready | Output lifecycle is client-facing |
| Reports / Presentations | 8 — Fully closed | Client deliverable; must complete legacy cutover |
| Results / ROI | 7 — Rollout-ready | Executive visibility; must be verified end-to-end |
| Finance Integration | 7 — Rollout-ready | Financial data trust requires verification; full closure follows ingestion quality proof |
| MyWork Roof | 6 — Operator-ready | Unified surface; full closure follows module hardening |
| Operator / Admin | 6 — Operator-ready | Must exist for support; iterates with each module |
| Platform Health | 6 — Operator-ready | Monitoring baseline; grows with production load |
| Landing / Superadmin | 5 — Verified | Lower priority; verified is sufficient for initial closure |

---

## 4. Post-20-wave closure phases

### Phase 1: Database Foundation and API Skeleton

**Objective:** Establish the database layer, API routing infrastructure, auth middleware, and validation pipeline that all 34 V8 services need before any frontend integration is possible.

**Duration estimate:** 2-3 weeks

**Entry criteria:**
- All 34 V8 services compile and pass existing unit tests (47 unit + 17 integration = 64 test files)
- Database connection to staging environment is verified via `DATABASE_PUBLIC_URL`
- Current migration state is known and documented

**Exit criteria:**
- All 45 V8 migrations run successfully against staging DB in sequence
- At least 1 API route exists per service cluster (minimum 20 route files covering all 34 services)
- Auth middleware (`requireAuth`, `requireOrgMembership`, `requireRole`) is applied to every V8 route
- Zod validation schemas exist for every route input; invalid input returns 400 with structured error
- Health check endpoint returns service status for all V8 service clusters
- At least 5 integration tests pass against real staging DB (not mocked)

**Key deliverables:**
- `server/src/routes/v8/` directory with route files for all service clusters
- `server/src/middleware/v8Auth.ts` — shared auth middleware for V8 routes
- `server/src/validators/v8/` — Zod schemas for all route inputs
- Migration verification script that runs all 45 migrations and reports status
- 5+ real-DB integration tests proving the stack works end-to-end

**Gaps addressed:** G-01 (zero API routes), G-02 (zero auth middleware), G-03 (zero input validation), G-09 (zero real DB tests), G-17 (no migration verification)

---

### Phase 2: API Layer Completion and Service Wiring

**Objective:** Complete the full API surface so that every one of the 413 exported functions that needs HTTP exposure has a route, and the API layer is internally consistent with proper error handling, pagination, rate limiting, and audit logging.

**Duration estimate:** 3-4 weeks

**Entry criteria:**
- Phase 1 exit criteria met
- All route skeletons from Phase 1 are deployed to staging
- Auth middleware passes integration test

**Exit criteria:**
- Every V8 service function that represents a user-facing or system-facing operation has a corresponding API route
- Error responses follow one consistent schema across all V8 routes
- Pagination is implemented for all list endpoints
- Rate limiting is configured for mutation endpoints
- Audit logging captures who/what/when for every state-changing V8 API call
- API documentation (OpenAPI/Swagger) is generated for all V8 routes
- All 64 existing test files still pass; at least 20 new integration tests added

**Key deliverables:**
- Complete `server/src/routes/v8/` with full CRUD for all service clusters
- Shared error handling middleware for V8 routes
- Pagination utilities for V8 list endpoints
- Rate limiting configuration for V8 mutation endpoints
- Audit log integration for V8 state changes
- OpenAPI spec for V8 API surface

**Gaps addressed:** G-01 (zero API routes — full closure), G-04 (no error handling standardization), G-10 (no audit logging), G-11 (no rate limiting), G-18 (no API documentation)

---

### Phase 3: Feature Flag Infrastructure and Frontend Client

**Objective:** Build the feature flag system that gates V8 features, create the frontend API client layer, and establish the pattern for progressive V8 feature activation.

**Duration estimate:** 2-3 weeks

**Entry criteria:**
- Phase 2 exit criteria met
- At least 3 V8 API routes are verified working in staging with real auth

**Exit criteria:**
- Feature flag service exists with per-org, per-user, and percentage-based rollout support
- Every V8 API route is gated behind a feature flag (default: off)
- Frontend API client (`src/services/v8Client.ts`) exists with typed methods for all V8 routes
- Client handles auth token refresh, error mapping, and retry logic
- At least 3 V8 features can be toggled on/off per organization without deployment
- Feature flag admin UI exists in superadmin panel
- Rollback procedure is documented and tested: disabling a flag immediately stops V8 behavior

**Key deliverables:**
- `server/src/services/featureFlagService.ts` — flag evaluation engine
- `server/src/routes/v8/featureFlags.ts` — admin API for flag management
- `src/services/v8Client.ts` — typed frontend client for all V8 APIs
- `src/hooks/useV8Feature.ts` — React hook for feature flag checks
- Feature flag admin panel in superadmin UI
- Rollback runbook document

**Gaps addressed:** G-05 (zero feature flags), G-06 (zero frontend integration — client layer), G-12 (no rollback mechanism), G-19 (no progressive rollout capability)

---

### Phase 4: UI Integration — Foundation Modules

**Objective:** Wire the first wave of V8 services into the existing frontend, starting with the modules that form the critical path: Context/Identity, Chat Execution, Execution Spine, and Governed Retrieval. This phase proves the full stack works end-to-end for the most important AI operating environment.

**Duration estimate:** 4-6 weeks

**Entry criteria:**
- Phase 3 exit criteria met
- Feature flag infrastructure is deployed and tested
- Frontend client is available and typed

**Exit criteria:**
- Context Snapshot is consumed by Chat and Execution UIs; support can inspect active context
- Chat-to-Execution handoff works in the UI: user starts in chat, agent proposes action, user approves, execution runs
- Governed Retrieval results appear in chat with source attribution and freshness indicators
- Execution Spine proposal/approval flow has full UI: propose → review → approve/reject → apply → audit trail
- Tool Governance enforcement is visible: blocked tools show explanation, allowed tools show risk class
- Trust/Audit provenance is visible in chat responses and execution results
- All foundation module UIs are behind feature flags
- At least 10 E2E tests cover the critical path (chat → execution → retrieval → trust)

**Key deliverables:**
- Chat execution UI integration with V8 `chatExecutionService`
- Execution proposal/approval UI with V8 `executionSpineService`
- Retrieval source attribution UI with V8 `governedRetrievalService`
- Context inspector (support tool) with V8 `contextSnapshotService`
- Tool governance enforcement UI with V8 `toolGovernanceService`
- Trust provenance display with V8 `trustAuditService`
- 10+ E2E tests for the critical AI operating environment path

**Gaps addressed:** G-06 (zero frontend integration — first real closure), G-07 (zero end-to-end feature), G-08 (zero support diagnostics — first real closure), G-13 (no source attribution UI), G-14 (no approval flow UI), G-20 (no E2E test coverage)

---

### Phase 5: UI Integration — Business Modules

**Objective:** Wire the business-critical modules: Planning Continuity, PM Sync, Results/ROI, Finance Integration, Reports/Presentations, and Publish/Review. This phase makes the transformation lifecycle work end-to-end from initiative creation through delivery to results tracking.

**Duration estimate:** 6-8 weeks

**Entry criteria:**
- Phase 4 exit criteria met
- Foundation modules are stable in staging behind feature flags
- At least one org has tested the foundation modules

**Exit criteria:**
- Planning Continuity: initiative creation → task decomposition → execution assignment works in UI
- PM Sync: at least Jira and one additional provider (Asana or ClickUp) sync bidirectionally with proper auth, conflict resolution, and degraded-state handling
- Results/ROI: KPI lifecycle from definition through measurement to deviation-action loop works in UI
- Finance Integration: document ingestion → recognition → first model → promotion to initiative works in UI
- Reports/Presentations: template selection → AI-assisted generation → review → publish works in UI
- Publish/Review: shared publish lifecycle with review states works across Reports and Presentations
- All business module UIs are behind feature flags
- At least 15 E2E tests cover business module flows
- Operator can see sync status, finance ingestion status, and output generation status

**Key deliverables:**
- Initiative lifecycle UI wired to V8 `planningContinuityService`
- PM Sync configuration and status UI wired to V8 `pmSyncTruthService` and `pmSyncAuthService`
- KPI/ROI dashboard wired to V8 `resultsROIService`
- Finance ingestion and promotion UI wired to V8 `financeIntegrationService`
- Report/Presentation generation UI wired to V8 `reportsPresModelService`
- Publish/review lifecycle UI wired to V8 `publishReviewService`
- Sync operator recovery UI wired to V8 `replayDeadLetterService`
- 15+ E2E tests for business module flows

**Gaps addressed:** G-06 (frontend integration — business modules), G-07 (end-to-end features — business flows), G-13 (source attribution — finance and results), G-15 (no sync operator recovery), G-16 (no output lifecycle UI), G-21 (no finance ingestion verification), G-22 (no KPI deviation loop)

---

### Phase 6: UI Integration — Collaboration and Workspace Modules

**Objective:** Wire the multiplayer, workspace collaboration, version/replay, MyWork roof, and workspace governance modules. This phase makes shared work real.

**Duration estimate:** 4-6 weeks

**Entry criteria:**
- Phase 4 exit criteria met (foundation modules stable)
- Multiplayer platform baseline is verified in staging
- WebSocket infrastructure is deployed

**Exit criteria:**
- Collaboration rooms work: users see each other's presence, cursors, and edits in real time
- Concurrent editing has conflict resolution that users can understand
- Version history and replay work for at least Notebook and Idea Workspace
- MyWork roof shows unified cross-surface state (Home, Inbox, Calendar)
- Workspace governance rules are enforced in the UI
- Degraded collaboration states (network loss, stale data) are handled gracefully
- All collaboration UIs are behind feature flags
- At least 10 E2E tests cover collaboration scenarios including degraded states

**Key deliverables:**
- Real-time collaboration UI wired to V8 `collaborationRoomService` and `concurrentEditingService`
- Multiplayer presence UI wired to V8 `multiplayerHardeningService`
- Version history and replay UI wired to V8 `versionReplayService`
- MyWork unified surface wired to V8 `myWorkRoofService`
- Workspace governance enforcement UI wired to V8 `workspaceGovernanceService`
- Workspace AI facilitation UI wired to V8 `workspaceAIFacilitationService`
- 10+ E2E tests for collaboration flows

**Gaps addressed:** G-06 (frontend integration — collaboration), G-07 (end-to-end features — collaboration), G-23 (no real-time collaboration UI), G-24 (no degraded state handling UI)

---

### Phase 7: Operator Surfaces and Support Model

**Objective:** Build the operator, admin, and support surfaces that make V8 features supportable in production. Without this phase, V8 features cannot be safely enabled for real customers.

**Duration estimate:** 3-4 weeks

**Entry criteria:**
- Phases 4-6 exit criteria met for at least the foundation and business modules
- Feature flag infrastructure is proven stable
- Audit logging is capturing V8 events

**Exit criteria:**
- Operator dashboard shows: active V8 features per org, sync status, AI execution status, collaboration room status, platform health
- Support diagnostics allow: inspecting context snapshots, replaying trust audit trails, viewing sync dead letters, checking feature flag state per user
- Monitoring dashboards exist for: V8 API latency, error rates, sync job health, AI execution duration, collaboration room count
- Alert rules are configured for: V8 API errors > threshold, sync failures, AI execution timeouts, collaboration room crashes
- Admin UI allows: managing feature flags, viewing audit logs, triggering sync recovery, inspecting platform health
- Runbooks exist for: V8 rollback, sync recovery, AI execution failure, collaboration room recovery, feature flag emergency disable
- At least 5 operator workflow tests verify the support model works

**Key deliverables:**
- Operator dashboard (superadmin) wired to V8 `operatorAdminService` and `platformHealthService`
- Support diagnostic tools wired to V8 `trustAuditService` and `contextSnapshotService`
- Monitoring integration (metrics, dashboards, alerts)
- Sync recovery UI wired to V8 `replayDeadLetterService`
- Runbook documents for all critical V8 failure scenarios
- 5+ operator workflow tests

**Gaps addressed:** G-08 (zero operator UI — full closure), G-09 (zero real DB tests — operator verification), G-10 (audit logging — operator visibility), G-15 (sync operator recovery — full closure), G-16 (output lifecycle — operator visibility)

---

### Phase 8: Legacy Cutover and Production Closure

**Objective:** Complete the transition from legacy systems to V8 for all modules that target level 8 (Fully closed). Remove legacy code paths, migrate data, and establish the permanent production support model.

**Duration estimate:** 3-5 weeks

**Entry criteria:**
- Phases 4-7 exit criteria met
- All V8 features have been running behind feature flags in staging for at least 2 weeks
- At least 2 organizations have tested V8 features in production behind flags
- No P0 bugs in V8 features

**Exit criteria:**
- Chat Execution: legacy chat-to-action paths are removed; all chat execution goes through V8 `chatExecutionService`
- Reports/Presentations: legacy generation paths are removed; all output generation goes through V8 `reportsPresModelService`
- Data migration scripts have run for all orgs; legacy data is accessible through V8 APIs
- Feature flags for fully-closed modules are removed; V8 is the default path
- Legacy code paths are deleted or clearly marked as deprecated with removal timeline
- Production support model is documented and support team is trained
- Post-cutover monitoring shows no regression in error rates, latency, or user satisfaction
- Rollback plan is tested and documented for emergency reversion

**Key deliverables:**
- Data migration scripts for legacy → V8 transition
- Legacy code removal PRs for fully-closed modules
- Production support model document
- Support team training materials
- Post-cutover monitoring dashboard
- Emergency rollback procedure (tested)

**Gaps addressed:** All remaining gaps from G-01 through G-24 that are not yet closed by previous phases

---

## 5. Critical path

The critical path determines the minimum time to first production V8 feature. Every item on this path blocks the next.

```
Phase 1: DB Foundation (2-3 wk)
    ↓
    Migrations verified → Routes exist → Auth works → Validation returns 400
    ↓
Phase 2: API Layer (3-4 wk)
    ↓
    All 34 services have routes → Error handling consistent → Audit logging active
    ↓
Phase 3: Feature Flags + Client (2-3 wk)
    ↓
    Flags work → Frontend client typed → Rollback tested
    ↓
Phase 4: Foundation UI (4-6 wk)
    ↓
    Chat Execution works E2E → Context visible → Retrieval attributed → Execution approved
    ↓
Phase 7: Operator Surfaces (3-4 wk) [partial — enough for foundation modules]
    ↓
    Support can diagnose → Monitoring alerts → Runbooks exist
    ↓
Phase 8: Legacy Cutover (3-5 wk) [for Chat Execution first]
    ↓
    First V8 feature live in production without legacy fallback
```

**Minimum time to first production feature: 17-25 weeks**

The dependency chain:

```
DB migrations → API routes → Auth middleware → Feature flags → Frontend client
→ Chat Execution UI → Operator diagnostics → Legacy cutover for Chat
```

Each link is a hard dependency. You cannot wire frontend without routes. You cannot do routes without migrations. You cannot go to production without operator surfaces.

---

## 6. Parallelizable workstreams

The following work can run in parallel with the critical path without blocking it:

### Parallel Stream A: Collaboration Infrastructure (starts with Phase 1)

- WebSocket server setup and room management protocol
- Presence service design and implementation
- Conflict resolution algorithm selection and implementation
- Can run from week 1; feeds into Phase 6

### Parallel Stream B: PM Sync Provider Adapters (starts with Phase 2)

- Jira adapter implementation and OAuth flow
- Asana adapter implementation
- ClickUp adapter implementation
- Dead letter queue and replay mechanism
- Can run from week 3; feeds into Phase 5

### Parallel Stream C: Finance Ingestion Pipeline (starts with Phase 2)

- PDF/Excel document recognition pipeline
- Line mapping and confidence scoring
- First model creation from recognized documents
- Can run from week 3; feeds into Phase 5

### Parallel Stream D: Monitoring and Alerting Setup (starts with Phase 1)

- Metrics collection infrastructure
- Dashboard templates for V8 services
- Alert rule definitions
- Can run from week 1; feeds into Phase 7

### Parallel Stream E: E2E Test Framework (starts with Phase 1)

- Test infrastructure setup (Playwright or Cypress)
- Test data seeding scripts
- CI pipeline for E2E tests
- Can run from week 1; feeds into all phases

### Parallel Stream F: Documentation and Training (starts with Phase 3)

- API documentation generation
- Support runbook drafting
- Training material preparation
- Can run from week 5; feeds into Phase 7 and 8

---

## 7. Module onboarding order

Modules are ranked by: (a) how many other modules depend on them, (b) user-facing impact, (c) implementation readiness.

| Rank | Module | Services | Reason for position |
| --- | --- | --- | --- |
| 1 | Context Snapshot / Identity | `contextSnapshotService`, `contextConsumerBindingService`, `sourceTruthService` | Foundation for all AI behavior; every other AI module depends on context identity chain |
| 2 | Governed Retrieval | `governedRetrievalService`, `knowledgeRetrievalService` | AI grounding depends on retrieval; chat and execution both consume it |
| 3 | Chat Execution | `chatExecutionService`, `aiOperatingEnvironmentService` | Primary user-facing AI surface; highest visibility |
| 4 | Execution Spine | `executionSpineService`, `executionVisibilityService` | Proposal/approval is cross-cutting; chat, planning, and business modules all need it |
| 5 | Tool Governance | `toolGovernanceService`, `toolCollaborationService` | Must be enforced before AI execution scales; safety gate |
| 6 | Trust / Audit | `trustAuditService` | Support-visible trust trace; required for enterprise customers |
| 7 | Prompt OS Runtime | `promptOsRuntimeService` | Release bundles gate AI behavior changes; must be active before broad rollout |
| 8 | Planning Continuity | `planningContinuityService` | Core business value: initiative → task → execution |
| 9 | Results / ROI | `resultsROIService` | Executive visibility; depends on execution spine being wired |
| 10 | Finance Integration | `financeIntegrationService` | High-value module; depends on ingestion pipeline (parallel stream C) |
| 11 | PM Sync | `pmSyncTruthService`, `pmSyncAuthService` | External integration; depends on auth infrastructure and provider adapters |
| 12 | Reports / Presentations | `reportsPresModelService` | Client deliverable; depends on publish/review lifecycle |
| 13 | Publish / Review | `publishReviewService` | Output lifecycle; depends on reports/presentations being wired |
| 14 | Multiplayer / Collaboration | `collaborationRoomService`, `concurrentEditingService`, `multiplayerHardeningService`, `workspaceCollaborationService` | Shared work; depends on WebSocket infrastructure (parallel stream A) |
| 15 | Version / Replay | `versionReplayService`, `replayDeadLetterService` | History and recovery; depends on collaboration rooms being active |
| 16 | Workspace Governance | `workspaceGovernanceService`, `workspaceAIFacilitationService`, `workspaceCrossModuleService` | Cross-module enforcement; depends on individual modules being wired |
| 17 | MyWork Roof | `myWorkRoofService` | Unified surface; depends on individual modules being wired |
| 18 | Operator / Admin | `operatorAdminService` | Support tooling; grows incrementally with each module |
| 19 | Platform Health | `platformHealthService` | Monitoring; grows incrementally with production load |
| 20 | Landing / Superadmin | `landingSuperadminService`, `toolsOrgAdminService` | Lowest priority; verified is sufficient |

---

## 8. Exit criteria per phase

### Phase 1: Database Foundation and API Skeleton

| # | Criterion | Verification method |
| --- | --- | --- |
| 1.1 | All 45 V8 migrations execute without error against staging DB | Migration script exits 0; `SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'v8_%'` returns expected count |
| 1.2 | At least 20 route files exist in `server/src/routes/v8/` covering all 34 services | `ls server/src/routes/v8/*.ts \| wc -l` ≥ 20 |
| 1.3 | Every V8 route requires authentication | Unauthenticated request to any V8 route returns 401 |
| 1.4 | Every V8 route validates input with Zod | Request with invalid body to any V8 mutation route returns 400 with `{ error: string, details: ZodError[] }` |
| 1.5 | Health check endpoint returns status for all V8 service clusters | `GET /api/v8/health` returns JSON with status per cluster |
| 1.6 | At least 5 integration tests pass against real staging DB | `npm run test:integration:v8` exits 0 with ≥ 5 passing tests |

### Phase 2: API Layer Completion

| # | Criterion | Verification method |
| --- | --- | --- |
| 2.1 | Every user-facing V8 service function has a corresponding route | Audit script compares exported functions to route handlers; coverage ≥ 90% |
| 2.2 | All error responses follow `{ error: string, code: string, details?: any }` | Schema validation test against all V8 error responses |
| 2.3 | All list endpoints support `?page=N&limit=N` pagination | Pagination test against every list route |
| 2.4 | Mutation endpoints have rate limiting | Rate limit test: 100 rapid requests to mutation endpoint; responses include `429` after threshold |
| 2.5 | Audit log captures all V8 state changes | Query audit log after test mutations; verify who/what/when/orgId present |
| 2.6 | OpenAPI spec is generated and valid | `swagger-cli validate openapi-v8.yaml` exits 0 |
| 2.7 | All 64 existing tests + 20 new integration tests pass | `npm run test:v8` exits 0 with ≥ 84 passing tests |

### Phase 3: Feature Flags and Frontend Client

| # | Criterion | Verification method |
| --- | --- | --- |
| 3.1 | Feature flag service supports per-org, per-user, and percentage rollout | Unit tests for all three rollout strategies |
| 3.2 | Every V8 route checks feature flag before processing | Request to V8 route with flag disabled returns 404 or feature-not-available response |
| 3.3 | Frontend client has typed methods for all V8 routes | TypeScript compilation succeeds; client method count matches route count |
| 3.4 | Client handles auth refresh and retry | Integration test: expired token → refresh → retry succeeds |
| 3.5 | Disabling a feature flag immediately stops V8 behavior | E2E test: enable flag → verify feature works → disable flag → verify feature stops → re-enable → verify feature works again |
| 3.6 | Feature flag admin UI exists in superadmin | Manual verification: superadmin can list, enable, disable, configure percentage for V8 flags |

### Phase 4: Foundation Module UI Integration

| # | Criterion | Verification method |
| --- | --- | --- |
| 4.1 | Chat execution handoff works: user message → agent proposal → approval → execution → result displayed | E2E test with real chat session |
| 4.2 | Context snapshot is visible in support diagnostic tool | Support user can open context inspector and see workspace/project/conversation/run/artifact chain |
| 4.3 | Retrieval results show source, freshness, and confidence | Chat response with retrieval shows source name, last-synced timestamp, and confidence indicator |
| 4.4 | Execution proposal shows: what will change, risk level, required approval | Execution proposal UI displays structured diff, risk class from `toolGovernanceService`, and approval button |
| 4.5 | Blocked tool shows explanation | When tool is denied, UI shows reason from `toolGovernanceService` |
| 4.6 | Trust audit trail is visible for chat responses | Click "show sources" on chat response → see provenance chain from `trustAuditService` |
| 4.7 | At least 10 E2E tests cover the critical path | `npm run test:e2e:v8:foundation` exits 0 with ≥ 10 passing tests |

### Phase 5: Business Module UI Integration

| # | Criterion | Verification method |
| --- | --- | --- |
| 5.1 | Initiative creation → task decomposition → execution assignment works in UI | E2E test: create initiative → add tasks → assign → verify in execution view |
| 5.2 | Jira sync works bidirectionally | E2E test: create task in Consultify → verify in Jira; create task in Jira → verify in Consultify |
| 5.3 | KPI lifecycle works: define → measure → deviate → act | E2E test: create KPI → enter measurement → trigger deviation → verify action prompt |
| 5.4 | Finance ingestion works: upload PDF → recognize → create model | E2E test: upload financial PDF → verify recognition → verify first model creation |
| 5.5 | Report generation works: select template → generate → review → publish | E2E test: full report lifecycle |
| 5.6 | Sync dead letter recovery works | E2E test: simulate sync failure → verify dead letter → trigger recovery → verify resolution |
| 5.7 | At least 15 E2E tests cover business flows | `npm run test:e2e:v8:business` exits 0 with ≥ 15 passing tests |

### Phase 6: Collaboration Module UI Integration

| # | Criterion | Verification method |
| --- | --- | --- |
| 6.1 | Two users see each other's presence in a shared workspace | E2E test with two browser sessions |
| 6.2 | Concurrent edits are merged without data loss | E2E test: two users edit same document simultaneously → both changes preserved |
| 6.3 | Version history shows change timeline | UI shows version list with timestamps and authors for a document with multiple edits |
| 6.4 | MyWork shows unified state across Home, Inbox, Calendar | E2E test: action in one surface reflects in others |
| 6.5 | Network loss degrades gracefully | E2E test: disconnect network → verify degraded UI → reconnect → verify recovery |
| 6.6 | At least 10 E2E tests cover collaboration | `npm run test:e2e:v8:collab` exits 0 with ≥ 10 passing tests |

### Phase 7: Operator Surfaces

| # | Criterion | Verification method |
| --- | --- | --- |
| 7.1 | Operator dashboard shows V8 feature status per org | Manual verification: superadmin sees feature flag state, active users, error counts per org |
| 7.2 | Support can inspect context snapshot for any active session | Manual verification: support tool shows context chain for a given user session |
| 7.3 | Monitoring dashboards show V8 API health | Grafana/equivalent shows latency p50/p95/p99, error rate, request rate for V8 routes |
| 7.4 | Alerts fire on V8 API degradation | Test: inject error spike → verify alert fires within 5 minutes |
| 7.5 | Runbooks exist for all critical failure scenarios | Document review: runbooks cover rollback, sync recovery, AI failure, collaboration crash, flag emergency |
| 7.6 | At least 5 operator workflow tests pass | `npm run test:e2e:v8:operator` exits 0 with ≥ 5 passing tests |

### Phase 8: Legacy Cutover

| # | Criterion | Verification method |
| --- | --- | --- |
| 8.1 | Legacy chat execution paths are removed | `grep -r "legacyChatExecution" server/src/` returns 0 results |
| 8.2 | Legacy report generation paths are removed | `grep -r "legacyReportGen" server/src/` returns 0 results |
| 8.3 | Data migration scripts have run for all orgs | Migration status table shows all orgs at V8 |
| 8.4 | Feature flags for fully-closed modules are removed | No feature flag checks remain in code for Chat Execution and Reports/Presentations |
| 8.5 | Production error rate is not higher than pre-cutover baseline | Monitoring comparison: 7-day post-cutover error rate ≤ pre-cutover + 5% |
| 8.6 | Support team has completed training | Training completion records for all support staff |
| 8.7 | Emergency rollback procedure is tested | Runbook test: execute rollback → verify system reverts to pre-V8 behavior → re-enable V8 |

---

## 9. Main risks

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R-01 | **45 migrations fail or conflict with existing schema** — V8 migrations were written without running against real DB; column conflicts, index collisions, or data type mismatches could block Phase 1 | High | Critical | Run all migrations against a clone of production DB in week 1. Fix conflicts before any route work begins. Maintain migration test in CI. |
| R-02 | **413 functions have inconsistent interfaces** — services were built independently; function signatures, error handling, and return types may not align with a unified API contract | High | High | Audit all 34 service files in Phase 1 for interface consistency. Define shared response types before route creation. Accept that some services may need refactoring. |
| R-03 | **Auth middleware reveals permission gaps** — V8 services may assume permissions that don't exist in the current role model; applying auth middleware may expose missing role definitions | Medium | High | Map all V8 service operations to existing role model in Phase 1. Identify gaps early. Extend role model only where necessary; do not invent new permission systems. |
| R-04 | **Feature flag system adds latency** — checking flags on every request could add measurable latency to V8 routes, especially if flag evaluation requires DB queries | Medium | Medium | Use in-memory flag cache with short TTL (30s). Benchmark flag evaluation latency. Accept that flag checks add < 5ms per request. |
| R-05 | **Frontend integration reveals service API mismatches** — services may return data shapes that don't match what the frontend needs; discovery happens late in Phase 4 | High | High | Create typed API contracts (OpenAPI) in Phase 2 and share with frontend team. Build frontend client against contracts, not against live APIs. Catch mismatches in Phase 2, not Phase 4. |
| R-06 | **Multiplayer WebSocket infrastructure is not ready** — collaboration modules depend on WebSocket support that may not exist in the current deployment infrastructure (Railway) | Medium | Critical | Validate WebSocket support on Railway in week 1 (parallel stream A). If not supported, evaluate alternatives (separate WebSocket service, Socket.io with polling fallback) before Phase 6. |
| R-07 | **PM Sync OAuth flows break in production** — external provider OAuth (Jira, Asana) may have redirect URI, scope, or token refresh issues that only appear in production | High | Medium | Test OAuth flows against real provider sandboxes in parallel stream B. Document every redirect URI and scope requirement. Build token refresh retry logic from day 1. |
| R-08 | **Legacy cutover causes data loss** — migrating from legacy data structures to V8 may lose data that doesn't fit the new schema, especially for edge cases in finance and reports | Medium | Critical | Run migration scripts against production DB clone. Compare record counts before and after. Build rollback migration for every forward migration. Never delete legacy tables until 30 days after successful cutover. |
| R-09 | **64 existing tests are brittle or mock-dependent** — current tests may pass only because they mock everything; adding real DB tests may reveal logic bugs hidden by mocks | High | Medium | Run existing tests against real DB in Phase 1 to identify which ones are truly valid. Accept that some tests may need rewriting. Prioritize tests that cover critical business logic. |
| R-10 | **Scope creep from 20-wave backlog** — the 20-wave program defined many aspirational goals; post-20-wave closure must resist re-opening those goals and focus only on wiring what exists | Medium | High | This program explicitly targets only the 34 existing services and their 413 functions. No new services, no new product features. If a gap requires new service code, it is escalated to the source-of-truth chat, not absorbed into this program. |

---

## 10. Recommended first execution tranche

The first 2-3 weeks of work, broken into specific tasks.

### Week 1: Database and Infrastructure Verification

| # | Task | Owner | Duration | Deliverable |
| --- | --- | --- | --- | --- |
| T-01 | Clone production DB to staging environment | DevOps | 1 day | Staging DB with production schema and anonymized data |
| T-02 | Run all 45 V8 migrations against staging DB; document failures | Backend | 2 days | Migration status report; list of failing migrations with root cause |
| T-03 | Fix migration conflicts and re-run until all 45 pass | Backend | 2 days | All 45 migrations pass; CI job verifies |
| T-04 | Audit all 34 V8 service files for interface consistency | Backend | 2 days | Interface audit report: shared types needed, inconsistencies found, refactoring needed |
| T-05 | Verify WebSocket support on Railway deployment | DevOps | 1 day | WebSocket feasibility report |
| T-06 | Set up E2E test framework (Playwright) | QA/Frontend | 2 days | E2E test runner in CI; one smoke test passes |
| T-07 | Set up monitoring infrastructure for V8 metrics | DevOps | 2 days | Metrics collection endpoint; empty dashboard template |

### Week 2: Route Skeleton and Auth Middleware

| # | Task | Owner | Duration | Deliverable |
| --- | --- | --- | --- | --- |
| T-08 | Create shared V8 auth middleware (`requireAuth`, `requireOrgMembership`, `requireRole`) | Backend | 1 day | `server/src/middleware/v8Auth.ts` with integration test |
| T-09 | Create shared V8 error handling middleware | Backend | 1 day | `server/src/middleware/v8ErrorHandler.ts` with consistent error schema |
| T-10 | Create route skeletons for Context/Identity cluster (3 services) | Backend | 1 day | Routes for `contextSnapshotService`, `contextConsumerBindingService`, `sourceTruthService` |
| T-11 | Create route skeletons for AI/Execution cluster (5 services) | Backend | 2 days | Routes for `chatExecutionService`, `aiOperatingEnvironmentService`, `executionSpineService`, `executionVisibilityService`, `toolGovernanceService` |
| T-12 | Create route skeletons for Retrieval/Knowledge cluster (2 services) | Backend | 1 day | Routes for `governedRetrievalService`, `knowledgeRetrievalService` |
| T-13 | Create Zod validation schemas for all week-2 routes | Backend | 2 days | Validation schemas; invalid input returns 400 |
| T-14 | Write 5 real-DB integration tests for Context and Retrieval services | Backend | 2 days | 5 integration tests passing against staging DB |

### Week 3: Remaining Routes and First Frontend Client

| # | Task | Owner | Duration | Deliverable |
| --- | --- | --- | --- | --- |
| T-15 | Create route skeletons for Collaboration cluster (4 services) | Backend | 2 days | Routes for `collaborationRoomService`, `concurrentEditingService`, `multiplayerHardeningService`, `workspaceCollaborationService` |
| T-16 | Create route skeletons for Business cluster (6 services) | Backend | 2 days | Routes for `planningContinuityService`, `pmSyncTruthService`, `pmSyncAuthService`, `resultsROIService`, `financeIntegrationService`, `reportsPresModelService` |
| T-17 | Create route skeletons for remaining clusters (14 services) | Backend | 3 days | Routes for all remaining services |
| T-18 | Create health check endpoint aggregating all V8 service clusters | Backend | 0.5 day | `GET /api/v8/health` returns cluster status |
| T-19 | Begin feature flag service implementation | Backend | 2 days | `featureFlagService.ts` with per-org flag support |
| T-20 | Begin typed frontend client for Context and Chat Execution routes | Frontend | 2 days | `src/services/v8Client.ts` with typed methods for first 2 clusters |
| T-21 | Write 5 more real-DB integration tests for Execution and Tool Governance | Backend | 2 days | 10 total integration tests passing against staging DB |

### Week 3 parallel work (streams A, D, E):

| # | Task | Owner | Duration | Deliverable |
| --- | --- | --- | --- | --- |
| T-22 | WebSocket room management protocol design and implementation start | Backend | 3 days | Room join/leave/presence protocol; initial implementation |
| T-23 | Jira OAuth adapter: redirect flow, token storage, refresh logic | Backend | 3 days | Jira OAuth flow working against Jira sandbox |
| T-24 | V8 API metrics collection: request count, latency, error rate per route | DevOps | 2 days | Metrics flowing to monitoring system |

---

## Appendix A: Gap reference

| Gap ID | Description | Priority | Phase addressed |
| --- | --- | --- | --- |
| G-01 | Zero API routes for 34 V8 services | P0 | Phase 1, Phase 2 |
| G-02 | Zero auth middleware on V8 routes | P0 | Phase 1 |
| G-03 | Zero input validation on V8 routes | P0 | Phase 1 |
| G-04 | No standardized error handling across V8 API | P0 | Phase 2 |
| G-05 | Zero feature flags for V8 features | P0 | Phase 3 |
| G-06 | Zero frontend integration with V8 services | P0 | Phase 4, 5, 6 |
| G-07 | Zero end-to-end features working through V8 stack | P0 | Phase 4, 5, 6 |
| G-08 | Zero operator UI / support diagnostics for V8 | P0 | Phase 7 |
| G-09 | Zero real DB tests (all tests use mocks) | P1 | Phase 1, 2 |
| G-10 | No audit logging for V8 state changes | P1 | Phase 2 |
| G-11 | No rate limiting on V8 mutation endpoints | P1 | Phase 2 |
| G-12 | No rollback mechanism for V8 features | P1 | Phase 3 |
| G-13 | No source attribution UI for retrieval results | P1 | Phase 4 |
| G-14 | No approval flow UI for execution proposals | P1 | Phase 4 |
| G-15 | No sync operator recovery UI | P1 | Phase 5, 7 |
| G-16 | No output lifecycle UI (publish/review states) | P1 | Phase 5, 7 |
| G-17 | No migration verification process | P2 | Phase 1 |
| G-18 | No API documentation for V8 routes | P2 | Phase 2 |
| G-19 | No progressive rollout capability | P2 | Phase 3 |
| G-20 | No E2E test coverage for V8 features | P2 | Phase 4 |
| G-21 | No finance ingestion verification flow | P2 | Phase 5 |
| G-22 | No KPI deviation-to-action loop in UI | P2 | Phase 5 |
| G-23 | No real-time collaboration UI | P2 | Phase 6 |
| G-24 | No degraded state handling UI for collaboration | P2 | Phase 6 |

---

## Appendix B: Service-to-phase mapping

| Service file | Phase first wired | Phase target maturity reached |
| --- | --- | --- |
| `contextSnapshotService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 7 |
| `contextConsumerBindingService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 7 |
| `sourceTruthService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 7 |
| `governedRetrievalService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 7 |
| `knowledgeRetrievalService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 7 |
| `chatExecutionService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 8 |
| `aiOperatingEnvironmentService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 7 |
| `executionSpineService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 7 |
| `executionVisibilityService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 7 |
| `toolGovernanceService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 6 |
| `toolCollaborationService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 6 |
| `trustAuditService.ts` | Phase 1 (route) → Phase 4 (UI) | Phase 7 |
| `promptOsRuntimeService.ts` | Phase 2 (route) → Phase 4 (UI) | Phase 6 |
| `collaborationRoomService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 7 |
| `concurrentEditingService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 7 |
| `multiplayerHardeningService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 7 |
| `workspaceCollaborationService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 7 |
| `versionReplayService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 6 |
| `replayDeadLetterService.ts` | Phase 2 (route) → Phase 5 (UI) | Phase 7 |
| `planningContinuityService.ts` | Phase 2 (route) → Phase 5 (UI) | Phase 7 |
| `pmSyncTruthService.ts` | Phase 2 (route) → Phase 5 (UI) | Phase 7 |
| `pmSyncAuthService.ts` | Phase 2 (route) → Phase 5 (UI) | Phase 7 |
| `resultsROIService.ts` | Phase 2 (route) → Phase 5 (UI) | Phase 7 |
| `financeIntegrationService.ts` | Phase 2 (route) → Phase 5 (UI) | Phase 7 |
| `reportsPresModelService.ts` | Phase 2 (route) → Phase 5 (UI) | Phase 8 |
| `publishReviewService.ts` | Phase 2 (route) → Phase 5 (UI) | Phase 7 |
| `workspaceGovernanceService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 6 |
| `workspaceAIFacilitationService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 6 |
| `workspaceCrossModuleService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 6 |
| `myWorkRoofService.ts` | Phase 2 (route) → Phase 6 (UI) | Phase 6 |
| `operatorAdminService.ts` | Phase 2 (route) → Phase 7 (UI) | Phase 6 |
| `platformHealthService.ts` | Phase 1 (route) → Phase 7 (UI) | Phase 6 |
| `landingSuperadminService.ts` | Phase 2 (route) → Phase 7 (UI) | Phase 5 |
| `toolsOrgAdminService.ts` | Phase 2 (route) → Phase 7 (UI) | Phase 5 |

---

## Appendix C: Cross-cutting requirements by phase

| Requirement | Where needed | Phase introduced | Phase verified |
| --- | --- | --- | --- |
| Auth middleware (JWT + org membership + role) | Every V8 route | Phase 1 | Phase 1 |
| Feature flags (per-org, per-user, percentage) | Every V8 route | Phase 3 | Phase 3 |
| Monitoring (latency, errors, throughput) | Every V8 route | Phase 1 (parallel D) | Phase 7 |
| Audit logging (who/what/when/orgId) | Every V8 mutation route | Phase 2 | Phase 7 |
| Rollback (feature flag disable + data revert) | Every V8 feature | Phase 3 | Phase 8 |
| Support diagnostics (context inspect, trust trace) | AI modules | Phase 4 | Phase 7 |
| Degraded state handling (network loss, provider down) | Sync, collaboration, retrieval | Phase 5, 6 | Phase 7 |
| Legacy cutover (code removal, data migration) | Chat, Reports/Presentations | Phase 8 | Phase 8 |

---

## Related canonical docs

- `V8_IMPLEMENTATION_MASTER_PROGRAM.md`
- `V8_FINAL_20_WAVE_IMPLEMENTATION_CLOSURE_PROGRAM.md`
- `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md`
- `AI_CORE_V8_READINESS_AUDIT.md`
- `AGENT_PROGRAM_OPERATING_MODEL_V8.md`
- `WORK_PACKET_TEMPLATE_V8.md`
- `MANAGER_AGENT_HANDOFF_BRIEF_V8.md`
- `SYSTEMATYKA_PRZEGLADU_V8.md`
- `DOCUMENTATION_REGISTRY.md`
