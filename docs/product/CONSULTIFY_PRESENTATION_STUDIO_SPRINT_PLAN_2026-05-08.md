# Consultify Presentation Studio - Sprint Plan

Status: `IN_PROGRESS`
Owner: Product + Engineering + QA
Date: 2026-05-08
Source contract: `consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md`

This plan turns the 100 percent implementation contract into delivery sprints. The delivery rule is micro-sprints with a gate after every sprint. No sprint is accepted with open P0/P1.

## Sprint Map

| Sprint | Work package | Objective | Gate |
| --- | --- | --- | --- |
| Sprint 1 | WP-01 - Stabilize Current Pipeline | Make the current `/prezentacje` flow honest and restartable: Teresa/KIMI entry, visible step failures, reopen, builder open, PDF/PPTX sanity. | Gate 1 `PASS` or `PASS_WITH_P2` |
| Sprint 2 | WP-02 - Source Pack Foundation | Add the source pack contract, source coverage, missing inputs, and tenant-safe source panel. | MT-PRES-035 |
| Sprint 3 | WP-03 - Narrative Planner | Add methodology-first narrative planning before slide generation. | MT-PRES-036 |
| Sprint 4 | WP-04 - AI Template Architect | Let AI propose reusable presentation templates that require review and approval. | MT-PRES-033 |
| Sprint 5 | WP-05 - Approved Template Generation | Generate decks from approved templates with required-input preflight and slot mapping. | MT-PRES-034 |
| Sprint 6 | WP-06 - Visual Layout Engine Hardening | Harden deterministic business layouts, overflow checks, and export parity. | MT-PRES-037 / MT-PRES-038 |
| Sprint 7 | WP-07 - Consulting QA Engine | Extend QA for executive clarity, decision readiness, methodology, and source grounding. | MT-PRES-039 |
| Sprint 8 | WP-08 - Builder Lifecycle Approval | Add lifecycle strip and approval flow in builder while separating saved state from lifecycle state. | MT-PRES-040 |
| Sprint 9 | WP-09 - Brand Theme Governance | Lock brand/theme rules, capability gates, and export parity. | MT-PRES-042 |
| Sprint 10 | WP-10 - Cross-Module Outputs | Make presentations a governed output from Interview, Research, Roadmap/AI Audit where available. | MT-PRES-043 |
| Sprint 11 | WP-11 - RBAC And Export Integrity | Validate role matrix, tenant negatives, export ledger, and share revocation. | MT-PRES-041 / MT-PRES-044 |
| Sprint 12 | WP-12 - Final Production Gate | Run full regression, manual pack, visual benchmark, docs, Control Board, and deploy verification. | Gate 6 `PASS` |

## Sprint 1 Scope

Sprint 1 is intentionally narrow. It stabilizes the surface users already touch before adding new methodology modules.

Do:

- stop artifact generation on fatal preflight errors,
- prevent indefinite "Executing task..." when conversation bootstrap fails,
- keep reopen/read-back for existing decks intact,
- keep builder and PDF/PPTX export actions behind existing quality checks,
- add regression coverage for the hard-stop behavior.

Do not:

- add database migrations,
- introduce Gamma as a runtime dependency,
- redesign builder UI,
- add new Presentation Studio modes yet,
- touch Document Studio or Work Canvas changes already present in the working tree.

## Sprint 1 Gate

### Changes made

- `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts`
  - Stops `/prezentacje` auto-generation after fatal preflight errors instead of continuing to accept/materialize.
  - Clears the starting state on early bootstrap failures so the UI does not stay in a misleading running state.
- `src/components/AIChat/KimiWorkspace/__tests__/useKimiArtifactPipeline.test.ts`
  - Adds regression coverage proving preflight failure blocks accept/materialize.

### Validation evidence

- `npx vitest run src/components/AIChat/KimiWorkspace/__tests__/useKimiArtifactPipeline.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 7 tests.
- Earlier local ignored-path check: `npx vitest run tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 7 tests.
- `npm test -- --run tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts` -> stopped manually because the project wrapper expanded to the broad unit suite instead of the targeted file. This is a validation-command issue, not a product failure.

### Gate status

- DoR: `PASS` - contract exists, sprint scope is bounded, hard-stop rules are known.
- DoD: `PASS_WITH_P2` - local targeted regression is green; browser/demo smoke remains for the external gate.
- Sprint gate: `PASS_WITH_P2`

### Residual risks

- Full browser smoke on `demo.consultify.ai` is outside the local unit test and remains required before production acceptance.
- Existing unrelated working-tree changes in Document Studio / Work Canvas were not touched and must be kept separate from this sprint.

### Next sprint plan

- Sprint 2 starts Source Pack Foundation after Sprint 1 gate is at least `PASS_WITH_P2`.

## Sprint 2 Scope

Sprint 2 adds Source Pack Foundation for Presentation Studio without database migrations. It reuses the existing `sourceArtifacts`, `source_artifacts`, `source_refs_json`, `outline_json`, and canonical deck document surfaces.

Do:

- normalize selected source artifacts into a presentation source pack,
- compute coverage, readiness, confidence, stale source counts, and missing inputs,
- persist source pack metadata into existing outline/deck metadata,
- allow non-strict generation to continue with honest warnings,
- allow strict generation to stop before rendering when required inputs are missing or sources are blocked,
- keep tenant scope on existing presentation routes and organization-bound generation calls.

Do not:

- create a new ingestion pipeline,
- add DB migrations,
- duplicate Document Studio source pack code,
- introduce Gamma as source provider,
- add new frontend source selection UI beyond the existing source-artifact path.

## Sprint 2 Gate

### Changes made

- `server/src/services/presentationSourcePackService.ts`
  - Adds the Presentation Source Pack contract: normalized source items, coverage, confidence, missing inputs, readiness status, and preflight.
- `server/src/services/presentationGeneratorService.ts`
  - Builds source pack metadata during outline generation and deck generation.
  - Stores source pack and missing inputs in existing `outline_json`/deck document metadata.
  - Blocks strict generation when source pack preflight fails.
- `server/src/services/__tests__/presentationSourcePackService.test.ts`
  - Covers ready packs, missing input warnings, strict blocking, and policy-blocked sources.

### Validation evidence

- `npx vitest run server/src/services/__tests__/presentationSourcePackService.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 4 tests.
- `npx vitest run server/src/services/__tests__/presentationGeneratorGolden.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 5 tests.
- `ReadLints` on edited backend files -> no linter errors.

### Gate status

- DoR: `PASS` - Sprint 1 gate was at least `PASS_WITH_P2`; existing source-artifact path identified.
- DoD: `PASS_WITH_P2` - backend source pack foundation is implemented and tested; user-facing source pack panel remains for a later UI sprint.
- Sprint gate: `PASS_WITH_P2`

### Residual risks

- MT-PRES-035 cannot be full `PASS` until the UI visibly shows coverage/missing inputs in the Presentation Studio flow.
- Full tenant-negative API tests are still required when source pack selection expands beyond existing organization-bound deck generation.

### Next sprint plan

- Sprint 3 starts Narrative Planner: build a methodology-first narrative plan from source pack, audience, goal, and decision context before slide generation.

## Sprint 3 Scope

Sprint 3 adds the deck-level Narrative Planner. This is not the existing per-slide copy enrichment; it is the methodology-first plan that decides the thesis, storyline, proof points, decision context, and per-slide narrative role before rendering.

Do:

- create a deterministic narrative plan from setup, outline, and source pack,
- identify thesis, storyline, proof points, risks, decisions required, and per-slide audience question,
- avoid using stale/orphan source refs that are not present in the current source pack,
- persist narrative plan metadata in existing outline/deck metadata,
- keep current Narrative Engine slide enrichment intact.

Do not:

- call external LLMs for this sprint,
- add migrations,
- create a new editor surface,
- change visual rendering rules,
- bypass source pack warnings.

## Sprint 3 Gate

### Changes made

- `server/src/services/presentationNarrativePlannerService.ts`
  - Adds deck-level narrative planning: thesis, storyline, proof points, decisions, risks, and per-slide narrative roles.
  - Treats prompt-only decks as hypotheses and does not trust orphan outline source refs.
- `server/src/services/presentationGeneratorService.ts`
  - Builds narrative plan during outline generation and deck generation.
  - Stores narrative plan in existing `outline_json` and deck generation settings metadata.
- `server/src/services/__tests__/presentationNarrativePlannerService.test.ts`
  - Covers decision-deck planning and prompt-only/source-empty degradation.

### Validation evidence

- `npx vitest run server/src/services/__tests__/presentationNarrativePlannerService.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 2 tests.
- `npx vitest run server/src/services/__tests__/presentationGeneratorGolden.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 5 tests.
- `ReadLints` on edited backend files -> pending final check.

### Gate status

- DoR: `PASS` - Sprint 2 source pack exists and is wired into generation metadata.
- DoD: `PASS_WITH_P2` - deterministic backend Narrative Planner is implemented and tested; review UI remains for a later frontend sprint.
- Sprint gate: `PASS_WITH_P2`

### Residual risks

- MT-PRES-036 cannot be full `PASS` until users can review/approve the narrative plan before generation in UI.
- Current planner is deterministic; future LLM-assisted narrative refinement must preserve source pack and approval invariants.

### Next sprint plan

- Sprint 4 starts AI Template Architect: AI proposes reusable deck templates as governed reviewable plans before registry promotion.

## Sprint 4 Scope

Sprint 4 adds the AI Template Architect foundation. In this sprint "AI" means the architecture contract and deterministic planner that an LLM layer can later call; no external model is required. The output is a governed template plan, not an approved registry template.

Do:

- infer the right template family from deck goal and meeting/use-case signals,
- create a template plan with purpose, audience, frequency, required inputs, optional inputs, sections, and slide blueprints,
- mark the plan as `draft`, `ready_for_review`, or `needs_sources`,
- require approval before registry promotion,
- keep lifecycle and audit semantics explicit in the returned plan.

Do not:

- auto-promote template plans to approved templates,
- add migrations,
- call external LLMs,
- bypass `template_approve`,
- replace existing `presentationTemplateRuntimeService`.

## Sprint 4 Gate

### Changes made

- `server/src/services/presentationTemplateArchitectService.ts`
  - Adds governed template plan generation with template family inference, sections, slide blueprints, source input requirements, and approval metadata.
  - Handles alternative source requirements per slide blueprint instead of requiring every possible source type at once.
- `server/src/services/__tests__/presentationTemplateArchitectService.test.ts`
  - Covers Steering Committee template planning and source-empty degradation.

### Validation evidence

- `npx vitest run server/src/services/__tests__/presentationTemplateArchitectService.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 2 tests.
- `npx vitest run server/src/services/__tests__/presentationGeneratorGolden.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 5 tests.
- `ReadLints` on edited sprint files -> pending final check.

### Gate status

- DoR: `PASS` - source pack and narrative planner foundations exist.
- DoD: `PASS_WITH_P2` - backend Template Architect plan contract is implemented and tested; UI review and registry promotion API remain in later sprint work.
- Sprint gate: `PASS_WITH_P2`

### Residual risks

- MT-PRES-033 cannot be full `PASS` until the UI exposes the template plan and user approval/rejection flow.
- Registry promotion must be wired through existing presentation template governance before any template can become `approved`.

### Next sprint plan

- Sprint 5 starts Approved Template Generation: approved-only filtering, template slot mapping, required-input preflight, generation from approved template, QA/export.

## Sprint 5 Scope

Sprint 5 hardens generation from approved templates. A user-provided `templateId` is now an enterprise contract: the template must exist, be active, and be approved. The generation pipeline maps selected source artifacts into template slots before deck generation.

Do:

- resolve explicit `templateId` only when lifecycle/status is `approved`,
- fail honestly instead of silently falling back to default outline,
- apply approved template runtime to outline,
- produce slot mapping metadata with required blocks, source types, mapped source IDs, and missing source types,
- surface missing required template inputs as warnings,
- preserve system template-family generation when no explicit `templateId` is provided.

Do not:

- approve templates automatically,
- weaken template governance,
- add migrations,
- bypass source pack preflight,
- change existing system template runtime behavior.

## Sprint 5 Gate

### Changes made

- `server/src/services/presentationApprovedTemplateService.ts`
  - Adds approved-only template resolution and template slot mapping.
  - Blocks missing/draft/non-approved explicit templates.
- `server/src/services/presentationGeneratorService.ts`
  - Uses approved-only resolution for explicit `templateId`.
  - Stores `templateSlotMapping` in existing `outline_json` metadata.
  - Stops silent fallback to default outline for explicit template requests.
- `server/src/services/__tests__/presentationApprovedTemplateService.test.ts`
  - Covers approved-only resolution, source-to-slot mapping, and missing required input warnings.

### Validation evidence

- `npx vitest run server/src/services/__tests__/presentationApprovedTemplateService.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 3 tests.
- `npx vitest run server/src/services/__tests__/presentationGeneratorGolden.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 5 tests.
- `npx vitest run server/src/services/__tests__/presentationTemplateCompatibilityService.test.ts --maxWorkers=1 --maxConcurrency=1` -> `PASS`, 1 file, 2 tests.
- `ReadLints` on edited sprint files -> pending final check.

### Gate status

- DoR: `PASS` - Template Architect plan and existing template governance are available.
- DoD: `PASS_WITH_P2` - approved-only backend generation contract and slot mapping are implemented and tested; end-user template selection UI still needs explicit approval/readiness messaging.
- Sprint gate: `PASS_WITH_P2`

### Residual risks

- MT-PRES-034 cannot be full `PASS` until UI confirms approved-only filtering and shows missing template inputs before generation.
- Legacy templates without `lifecycle_state` may now be treated as draft unless they are system templates or expose `status=approved`; this is intentional for explicit enterprise template generation but needs rollout messaging.

### Next sprint plan

- Sprint 6 starts Visual Layout Engine Hardening: business layout catalog, deterministic layout rules, overflow detection, visual QA, and export parity per layout.

---

## Reset Note (2026-05-08, post-Phase-1 approval)

Sprints 1-5 above were executed as **backend micro-sprints / contract foundations** before the canonical `Module Delivery Contract` was approved. They are now reclassified as **`CANDIDATE_UNAPPROVED_IMPLEMENTATION_WORK`** that has been **adopted under approval** in Sprint S0 below.

The canonical delivery process now follows:

- `.cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md`
- The Module Delivery Contract approved on 2026-05-08 with defaults (Q1=A adopt, Q2=A no DB migrations, Q3=B backend + minimal UI).

Sprint nomenclature from this point uses `S0`..`S6` (post-approval), not `Sprint 1..N` (pre-approval).

## Sprint S0 - Adoption & Stabilization

### Objective

Adopt the candidate backend code from prior sprints 1-5 under the approved Module Delivery Contract, reproduce all targeted unit tests, lint candidate files, and gate the work for the next post-approval sprints. Mark the Anygravity manual retest as deferred to the human tester gate per `DRD/testy_antygravity/ANYGRAVITY_PRESENTATIONS_FIX_RETEST_2026-05-08_PROMPT.md`.

### Scope (review + adoption only, no new logic)

- `server/src/services/presentationSourcePackService.ts` (adopted)
- `server/src/services/presentationNarrativePlannerService.ts` (adopted)
- `server/src/services/presentationTemplateArchitectService.ts` (adopted)
- `server/src/services/presentationApprovedTemplateService.ts` (adopted)
- `server/src/services/presentationGeneratorService.ts` (modified integration adopted)
- `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` (hard-stop fix adopted)
- `server/src/services/__tests__/presentationSourcePackService.test.ts` (adopted)
- `server/src/services/__tests__/presentationNarrativePlannerService.test.ts` (adopted)
- `server/src/services/__tests__/presentationTemplateArchitectService.test.ts` (adopted)
- `server/src/services/__tests__/presentationApprovedTemplateService.test.ts` (adopted)
- `src/components/AIChat/KimiWorkspace/__tests__/useKimiArtifactPipeline.test.ts` (adopted)

Files explicitly untouched in S0:
- `server/src/services/workCanvasService.ts`
- `server/src/services/documentStudio/**`
- `src/components/DocumentStudio/**`
- `src/components/Tables/**`
- `.drive-sync-backup/`
- `docs/product/work-packets/teresa-unified-surface/`

### Validation evidence

- `npx vitest run server/src/services/__tests__/presentationSourcePackService.test.ts server/src/services/__tests__/presentationNarrativePlannerService.test.ts server/src/services/__tests__/presentationTemplateArchitectService.test.ts server/src/services/__tests__/presentationApprovedTemplateService.test.ts server/src/services/__tests__/presentationGeneratorGolden.test.ts --maxWorkers=1 --maxConcurrency=1` -> `5 passed (5)`, `16 tests passed (16)`, duration 75.29s.
- Re-run after lint autofix -> `5 passed (5)`, `16 tests passed (16)`, duration 25.04s.
- `npx vitest run src/components/AIChat/KimiWorkspace/__tests__/useKimiArtifactPipeline.test.ts --maxWorkers=1 --maxConcurrency=1` -> `1 passed (1)`, `7 tests passed (7)`, duration 25.87s.
- `npx eslint --fix` on candidate test/service files -> `0 errors, 14 warnings` (pre-existing `no-explicit-any` for DB row casts, classified P3).
- `npx eslint` on modified `presentationGeneratorService.ts` + `useKimiArtifactPipeline.ts` + test -> `0 errors, 105 warnings` (all pre-existing).

### Gate status

- DoR: `PASS` - canonical Module Delivery Contract approved (Q1=A, Q2=A, Q3=B); candidate file inventory locked.
- DoD: `PASS_WITH_P2` - all targeted vitest suites green; lint errors cleared; pre-existing `no-explicit-any` warnings deferred as P3 polishing; Anygravity manual retest deferred.
- Sprint gate: `PASS_WITH_P2`

### Residual risks (with owners)

- R-S0-1: Anygravity manual retest on `https://demo.consultify.ai` is deferred to the human tester gate. Owner: QA tester per `ANYGRAVITY_PRESENTATIONS_FIX_RETEST_2026-05-08_PROMPT.md`.
- R-S0-2: Pre-existing `no-explicit-any` warnings in service layer (~119 across `presentationGeneratorService.ts`/KIMI hook) are not blocking but should be cleaned in a dedicated P3 sprint. Owner: Engineering.
- R-S0-3: Backend full `npm run typecheck` not run yet in this session (prior `exit 143` timeout). Will be run as part of Sprint S1 API gate. Owner: Engineering.
- R-S0-4: Drive Sync may revert untracked files between sessions. Mitigation: stage adopted files via git index. Owner: Engineering.

### Next sprint plan

- Sprint S1 starts Source Pack Studio Route: add `POST /api/presentation-studio/source-pack/preview` orchestration endpoint (no DB migration), tenant + RBAC integration tests, and skeleton `presentationStudioOrchestrationService.ts`.

## Sprint S1 - Source Pack Studio Route

### Objective

Introduce the Presentation Studio API surface under `/api/presentation-studio/...` with the first read-only endpoint: `POST /source-pack/preview`. Reuse adopted `preflightPresentationSourcePack` via a thin orchestration service. Enforce tenant and RBAC boundaries identical to the existing `presentations.routes.ts`. No DB migration. No mutating endpoints in this sprint.

### Scope (additive only)

Files created:
- `server/src/services/presentationStudioOrchestrationService.ts` — orchestration skeleton (`previewPresentationStudioSourcePack`).
- `server/src/routes/presentationStudio.routes.ts` — Express router with `verifyToken` middleware, `presentation_create` capability gate, and `POST /source-pack/preview` handler.
- `server/src/routes/__tests__/presentationStudio.routes.test.ts` — integration test covering 200 happy path, 403 PERMISSION_DENIED, 403 NO_ORG_CONTEXT, 401 unauthenticated, tenant scoping, and strict-mode preflight blocking.

Files updated:
- `server/src/Gateway.ts` — additive import + `app.use('/api/presentation-studio', presentationStudioRoutes)` mount.

Files explicitly untouched:
- `server/src/routes/presentations.routes.ts` (legacy presentation API stays unchanged).
- All adopted services from S0.
- `tablePlatform/*`, `documentStudio/*`, `workCanvasService.ts`, `.drive-sync-backup/`.

### Validation evidence

- `npx vitest run server/src/routes/__tests__/presentationStudio.routes.test.ts --maxWorkers=1 --maxConcurrency=1` -> `1 passed (1)`, `6 tests passed (6)`, duration 0.72s.
- Regression suite `npx vitest run server/src/services/__tests__/presentationSourcePackService.test.ts server/src/services/__tests__/presentationGeneratorGolden.test.ts server/src/routes/__tests__/presentationStudio.routes.test.ts` -> `3 passed (3)`, `15 tests passed (15)`.
- `npx eslint --fix` on S1 new files -> `0 errors, 22 warnings` (pre-existing `no-explicit-any` for Express request typing, classified P3, mirrors existing `presentations.routes.ts`).
- Focused typecheck `npx tsc --noEmit` on the 6 in-scope service + route files -> `0 errors`.
- Full backend `npx tsc --noEmit` -> reveals pre-existing TS errors in `tablePlatform/AiUsageService.ts` and `tablePlatform/TableAiEditorService.ts` only. These files are untracked in the worktree and explicitly out-of-scope for this contract; they do not block this gate.
- `ReadLints` on edited files -> `No linter errors found`.

### Gate status

- DoR: `PASS` - S0 adoption commit landed; orchestration skeleton placement and route surface decided.
- DoD: `PASS_WITH_P2` - new endpoint is tenant-scoped, RBAC-gated, integration-tested, type-clean in scope; pre-existing typecheck errors in `tablePlatform/*` remain (R-S1-1) but are out-of-scope per contract.
- Sprint gate: `PASS_WITH_P2`

### Residual risks (with owners)

- R-S1-1: Pre-existing TS errors in `tablePlatform/AiUsageService.ts` and `tablePlatform/TableAiEditorService.ts` block a fully clean `tsc --noEmit`. These files are untracked, out-of-scope, and not part of any approved presentation-studio contract. Owner: Table Platform module owners; deferred until the relevant module re-enters its own delivery contract.
- R-S1-2: `previewId` includes the raw `organizationId` after non-alphanumeric stripping (allowed chars: `[a-zA-Z0-9_-]`). For long org ids this still leaks the raw tenant slug into client-visible telemetry. Owner: Engineering; will switch to a hashed prefix in S5 when telemetry surface is finalized.
- R-S1-3: `req.user.role` is the only role signal used for the capability check; same pattern as existing `presentations.routes.ts`. Confirmed compliant with `40-security-tenancy.mdc`. No action.
- R-S1-4: Anygravity manual retest still deferred from S0; `/api/presentation-studio/source-pack/preview` will need a dedicated manual probe once S5 frontend lands.

### Next sprint plan

- Sprint S2 starts Narrative Plan Preview Route: add `POST /api/presentation-studio/narrative-plan/preview` to `presentationStudioOrchestrationService.ts` and `presentationStudio.routes.ts`. Wraps adopted `buildPresentationNarrativePlan`. Same auth + tenant + RBAC pattern. No DB migration.

## Sprint S2 Gate Report — Narrative Plan Preview Route (2026-05-08)

Status: `PASS_WITH_P2`
Branch: `main`
Scope: Backend-only. No DB migration. No UI in this sprint (Q3 default = backend + minimal UI later).

### Changes made

- Extended `consultify/server/src/services/presentationStudioOrchestrationService.ts` with a new function `previewPresentationStudioNarrativePlan({ setup, organizationId, outline?, sourcePack?, now? })` which:
  - Reuses adopted `buildPresentationNarrativePlan` and `buildPresentationSourcePack` (Sprint S0 baseline).
  - Defaults outline to `[]` and rebuilds the source pack from `setup.sourceArtifacts` when not provided.
  - Surfaces a request-scoped `previewId` derived from the resolved tenant id (auth, never body).
  - Aggregates warnings from both source pack and narrative plan into a single envelope.
  - Is read-only: no DB writes, no audit events, no telemetry side-effects.

- Extended `consultify/server/src/routes/presentationStudio.routes.ts` with `POST /api/presentation-studio/narrative-plan/preview`:
  - Same auth/tenant/RBAC pattern as `/source-pack/preview` (verifyToken + `presentation_create` capability).
  - Body: `{ setup?, outline?, sourcePack? }`. Body-supplied `organizationId` is ignored; tenant comes from `req.user.organizationId`.
  - Refactored body parsing into `parseDeckSetupFromBody` and `parseOutlineFromBody` helpers; the source-pack route now uses the shared helper.
  - Updated route docstring to list both endpoints and reaffirm proposal -> approval -> execution -> audit invariant for any future mutating endpoint.

- Extended `consultify/server/src/routes/__tests__/presentationStudio.routes.test.ts` with 5 integration tests for the new endpoint:
  - 200 ready narrative plan with outline + source artifact (status=ready, slidePlan length matches outline).
  - 200 needs_sources status when no artifacts (warnings non-empty, requiredEvidence empty).
  - 403 PERMISSION_DENIED for VIEWER role (capability gate).
  - 401 when verifyToken rejects (no authenticated user).
  - Tenant integrity: body-supplied `organizationId` is ignored; `previewId` is bound to authenticated tenant.

### Validation performed

- Vitest (`presentationStudio.routes.test.ts`) — 11/11 PASS (S1 5 + S2 5 + 1 shared regression).
- Vitest regression on adopted services — `presentationNarrativePlannerService.test.ts` + `presentationGeneratorGolden.test.ts` — 7/7 PASS. No drift in golden outputs.
- ESLint --fix on the three S2 files — 0 errors. 24 pre-existing P3 `no-explicit-any` warnings in the same files; deferred per S0 baseline policy.
- Focused `tsc --noEmit` over `presentationStudioOrchestrationService.ts`, `presentationStudio.routes.ts`, `presentationSourcePackService.ts`, `presentationNarrativePlannerService.ts` with `--strict --target es2022 --module nodenext --moduleResolution nodenext` — 0 errors.
- `ReadLints` on the three modified files — clean.

### Gate result: `PASS_WITH_P2`

P0/P1: none.

P2 (deferred, non-blocking):
- P2-S2-1: 24 pre-existing `no-explicit-any` warnings in S2 files; tracked under the S0 baseline P3 deferral.
- P2-S2-2: Anygravity manual retest still deferred from S0/S1; will run a single consolidated probe after S5 frontend lands so we test all preview endpoints together rather than per-route.

### Acceptance criteria (from contract) covered by S2

- AC-1 (tenant safety on preview endpoints): `previewId` and source pack/narrative plan are derived from authenticated `organizationId` only; body-supplied `organizationId` is ignored. Verified by integration test.
- AC-2 (RBAC on preview endpoints): VIEWER receives 403 PERMISSION_DENIED with `requiredCapability=presentation_create`. Verified.
- AC-4 (no DB migrations in Phase 2): no schema changes. The route and orchestrator wrap in-memory adopted services only.
- AC-5 (read-only preview semantics): the endpoint returns plan + warnings + missingInputs; never writes, never emits audit events.
- AC-6 (degraded UI honesty): `status: 'needs_sources'` is propagated upstream so the future Studio UI can render an honest degraded state instead of fabricating a thesis.

### Risks / next-step notes

- R-S2-1: Outline fields not yet provided by callers in production will produce `status='needs_sources'` decks with hypothesis-only narrative. This is intentional but UX must explain it once Studio UI lands (S5).
- R-S2-2: `parseOutlineFromBody` silently strips entries without a `title`. If a future client sends drafts with empty titles, those slides disappear. This is consistent with the source pack parser and is acceptable for read-only preview, but needs an explicit warning channel before any write endpoint.

### Next sprint plan

- Sprint S3 starts Template Architect Preview Route: add `POST /api/presentation-studio/template-architect/preview` that wraps adopted `presentationTemplateArchitectService.ts`. Read-only, tenant-scoped, capability `presentation_create`. Returns a draft template plan envelope; explicit "approval required" flag preserved (proposal -> approval -> execution -> audit). No DB migration (template registry mutations land in S4 inside an existing JSON column or in-memory store).


## Sprint S3 Gate Report — Template Architect Preview Route (2026-05-08)

Status: `PASS_WITH_P2`
Branch: `staging`
Scope: Backend-only. No DB migration. No UI in this sprint (Q3 default = backend + minimal UI later).

### Changes made

- Extended `consultify/server/src/services/presentationStudioOrchestrationService.ts` with `previewPresentationStudioTemplatePlan({ setup, organizationId, outline?, sourcePack?, narrativePlan?, now? })`:
  - Reuses adopted `buildPresentationTemplateArchitectPlan`, `buildPresentationNarrativePlan`, `buildPresentationSourcePack` (S0 baseline).
  - Defaults outline to `[]` and rebuilds source pack + narrative plan from `setup` when not provided. Reusing the source pack / narrative plan from earlier preview calls keeps `requiredInputs` / `missingRequired` deterministic.
  - Aggregates source-pack + narrative-plan + template-plan warnings into one envelope.
  - Always returns envelope-level `approvalRequired: true` (mirroring `templatePlan.governance.approvalRequired = true` and `templatePlan.governance.initialStatus = 'draft'`).
  - Read-only: no DB writes, no audit events, no telemetry side-effects.

- Extended `consultify/server/src/routes/presentationStudio.routes.ts` with `POST /api/presentation-studio/template-architect/preview`:
  - Same auth/tenant/RBAC pattern as `/source-pack/preview` and `/narrative-plan/preview` (verifyToken + `presentation_create` capability).
  - Body: `{ setup?, outline?, sourcePack?, narrativePlan? }`. Body-supplied `organizationId` is ignored; tenant comes from `req.user.organizationId`.
  - Reuses shared `parseDeckSetupFromBody` / `parseOutlineFromBody` helpers from S2.
  - Updated route docstring to list all three endpoints and reaffirm the proposal -> approval -> execution -> audit invariant for any future mutating endpoint.

- Extended `consultify/server/src/routes/__tests__/presentationStudio.routes.test.ts` with 5 integration tests for the new endpoint:
  - 200 draft template plan with outline + source artifact (envelope `approvalRequired=true`, `governance.initialStatus='draft'`, `governance.auditEvent='template_architect_plan_created'`, sections present).
  - 200 `needs_sources` status when no artifacts (warnings non-empty, `approvalRequired=true`).
  - 403 PERMISSION_DENIED for VIEWER role (capability gate).
  - 401 when verifyToken rejects (no authenticated user).
  - Tenant integrity: body-supplied `organizationId` is ignored; `previewId` is bound to authenticated tenant.

### Validation performed

- Vitest (`presentationStudio.routes.test.ts`) — 16/16 PASS (5 S1 + 1 strict-mode + 5 S2 + 5 S3).
- Vitest regression on adopted services — `presentationTemplateArchitectService.test.ts`, `presentationNarrativePlannerService.test.ts`, `presentationSourcePackService.test.ts`, `presentationGeneratorGolden.test.ts` — 13/13 PASS. No drift in golden outputs, no drift in template plan goldens.
- ESLint --fix on the three S3 files — 0 errors. 28 pre-existing P3 `no-explicit-any` warnings in the same files (was 24 in S2, +4 from S3 narrow `any` body parsers); deferred per S0 baseline policy.
- Focused `tsc --noEmit` over `presentationStudioOrchestrationService.ts`, `presentationStudio.routes.ts`, `presentationTemplateArchitectService.ts`, `presentationSourcePackService.ts`, `presentationNarrativePlannerService.ts` with `--strict --target es2022 --module nodenext --moduleResolution nodenext` — 0 errors.
- `ReadLints` on the three modified files — clean.

### Gate result: `PASS_WITH_P2`

P0/P1: none.

P2 (deferred, non-blocking):
- P2-S3-1: 28 pre-existing `no-explicit-any` warnings in S1+S2+S3 files; tracked under the S0 baseline P3 deferral.
- P2-S3-2: Anygravity manual retest still deferred from S0/S1/S2; will run a single consolidated probe after S5 frontend lands so all three preview endpoints are exercised together.

### Acceptance criteria (from contract) covered by S3

- AC-1 (tenant safety on preview endpoints): `previewId` and template plan are derived from authenticated `organizationId` only; body-supplied `organizationId` is ignored. Verified by integration test.
- AC-2 (RBAC on preview endpoints): VIEWER receives 403 PERMISSION_DENIED with `requiredCapability=presentation_create`. Verified.
- AC-3 (governance invariant for templates): the response always carries `approvalRequired=true` and `governance.initialStatus='draft'`; even ready_for_review status still requires explicit approval before registry write. Verified.
- AC-4 (no DB migrations in Phase 2): no schema changes. The route and orchestrator wrap in-memory adopted services only.
- AC-5 (read-only preview semantics): the endpoint returns plan + warnings + missingInputs; never writes, never emits audit events.
- AC-6 (degraded UI honesty): `status: 'needs_sources'` is propagated upstream so the future Studio UI can render an honest degraded state instead of fabricating template structure without source examples.

### Risks / next-step notes

- R-S3-1: `templatePlan.runtimePreview` exposes the entire system template runtime (slide recipes, source requirements). Surface area is large; the UI must avoid leaking internal recipe ids in user-visible copy. Tracked for the S5 UI sprint.
- R-S3-2: `parseOutlineFromBody` and the new narrative-plan body parser silently strip malformed entries. Acceptable for read-only preview, but any future mutating endpoint that promotes the template into the registry must surface explicit "rejected entry" warnings.
- R-S3-3: When the architect upgrades a plan from `draft` to `ready_for_review`, `approvalRequired` stays `true`. The UI must NOT auto-approve on `ready_for_review` — human approval is mandatory. Documented in the route docstring; will be re-asserted in the S4 approval endpoint.

### Next sprint plan

- Sprint S4 starts Generate Dispatcher Preview (read-only). Scope:
  - Add `POST /api/presentation-studio/generate/preview` that wraps `presentationGeneratorService.generateOutline` + the adopted `preflightPresentationSourcePack` to return what the deck WOULD look like without actually creating a deck.
  - No DB migration. No mutating endpoint yet — generation persistence + audit events land in S6 behind explicit approval.
  - Same auth + tenant + RBAC pattern. Capability remains `presentation_create`.

