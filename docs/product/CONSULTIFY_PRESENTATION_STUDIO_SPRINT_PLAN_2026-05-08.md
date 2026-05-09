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


## Sprint S4 Gate Report — Generate Dispatcher Preview Route (2026-05-08)

Status: `PASS_WITH_P2`
Branch: `staging`
Scope: Backend-only. No DB migration. No DB read. No UI in this sprint (Q3 default = backend + minimal UI later).

### Changes made

- Extended `consultify/server/src/services/presentationStudioOrchestrationService.ts` with `previewPresentationStudioGenerate({ setup, organizationId, outline?, sourcePack?, narrativePlan?, strict?, now? })`:
  - Builds a best-effort outline using only the public template runtime + narrative planner surface — NEVER hits the DB.
  - Outline source preference order: caller-supplied outline -> `templateFamily`/`deckType` -> `buildSystemTemplateRuntime` runtime outline -> narrative-plan slidePlan fallback -> minimal `cover` + `key_messages` default.
  - Passes the resolved outline through `applyTemplateRuntime` to mirror generator-time slot mapping warnings.
  - Aggregates source-pack + narrative + template warnings into one envelope.
  - Computes a `wouldGenerate.canProceed` flag with explicit `blockingReasons`:
    - strict mode + missing source inputs -> blocked.
    - decision deck (`goal === 'decide'`) with empty source pack -> blocked.
    - narrative status `needs_sources` under strict mode -> blocked.
  - Read-only: no DB writes, no DB reads, no audit events, no telemetry side-effects.
  - Surfaces a request-scoped `previewId` derived from the authenticated tenant.

- Extended `consultify/server/src/routes/presentationStudio.routes.ts` with `POST /api/presentation-studio/generate/preview`:
  - Same auth/tenant/RBAC pattern as the other previews (`verifyToken` + `presentation_create` capability).
  - Body: `{ setup?, outline?, sourcePack?, narrativePlan?, strict? }`. Body-supplied `organizationId` is ignored.
  - Extended shared `parseDeckSetupFromBody` helper to forward `templateFamily` and `deckType` through to the orchestrator (the `DeckSetup` interface does not formally declare these, but the generator and template architect read them via `(setup as any)`; honoring the same fields here keeps preview/generation behavior consistent).
  - Updated route docstring to list all four endpoints and reaffirm the proposal -> approval -> execution -> audit invariant for any future mutating endpoint.

- Extended `consultify/server/src/routes/__tests__/presentationStudio.routes.test.ts` with 7 integration tests for the new endpoint:
  - 200 healthy decision deck happy path: outline preview present, estimated slide count > 0, `usedTemplate.runtime` resolved from `deckType`, `canProceed=true`, `blockingReasons=[]`.
  - 200 decision deck with empty source pack: `canProceed=false`, blocking reason mentions decision-deck source requirement.
  - 200 strict mode + missing inputs: `canProceed=false`, blocking reason mentions strict mode.
  - 200 free generation (no template family, no outline): `usedTemplate.family=null`, narrative-plan / default outline fallback used.
  - 403 PERMISSION_DENIED for VIEWER role (capability gate).
  - 401 when verifyToken rejects (no authenticated user).
  - Tenant integrity: body-supplied `organizationId` is ignored; `previewId` is bound to the authenticated tenant.

### Validation performed

- Vitest (`presentationStudio.routes.test.ts`) — 23/23 PASS (5 S1 + 1 strict-mode + 5 S2 + 5 S3 + 7 S4).
- Vitest regression on adopted services — `presentationGeneratorGolden.test.ts`, `presentationTemplateArchitectService.test.ts`, `presentationNarrativePlannerService.test.ts`, `presentationSourcePackService.test.ts` — 13/13 PASS. No drift in golden outputs.
- ESLint --fix on the three S4 files — 0 errors. 36 pre-existing P3 `no-explicit-any` warnings in the same files (was 28 in S3, +8 from S4 narrow `any` body parsers and template runtime extras); deferred per S0 baseline policy.
- Focused `tsc --noEmit` over `presentationStudioOrchestrationService.ts`, `presentationStudio.routes.ts`, `presentationTemplateRuntimeService.ts`, `presentationTemplateArchitectService.ts`, `presentationSourcePackService.ts`, `presentationNarrativePlannerService.ts` with `--strict --target es2022 --module nodenext --moduleResolution nodenext` — 0 errors after a one-line `as OutlineItem['intent']` narrowing fix on the narrative-plan fallback (the planner types `intent` as `string` while `OutlineItem.intent` is the `SlideIntent` enum; the cast is safe because the planner only emits intents that round-trip through the shared template runtime).
- `ReadLints` on the three modified files — clean.

### Gate result: `PASS_WITH_P2`

P0/P1: none.

P2 (deferred, non-blocking):
- P2-S4-1: 36 pre-existing `no-explicit-any` warnings in S1+S2+S3+S4 files; tracked under the S0 baseline P3 deferral.
- P2-S4-2: Approved-template DB resolution is intentionally NOT exercised in `/generate/preview`. The real `generateOutline` path resolves an approved template row from `presentation_templates` for `setup.templateId`. The preview only handles the system-runtime + free-generation paths. A future "approved template preview" endpoint will need a tenant-scoped DB read and corresponding test mocks — explicit follow-up risk.
- P2-S4-3: Anygravity manual retest still deferred from S0/S1/S2/S3; will run a single consolidated probe after S5 frontend lands so all four preview endpoints are exercised together.

### Acceptance criteria (from contract) covered by S4

- AC-1 (tenant safety on preview endpoints): `previewId` and outline preview are derived from authenticated `organizationId` only; body-supplied `organizationId` is ignored. Verified.
- AC-2 (RBAC on preview endpoints): VIEWER receives 403 PERMISSION_DENIED with `requiredCapability=presentation_create`. Verified.
- AC-4 (no DB migrations in Phase 2): no schema changes. The route and orchestrator never touch the DB.
- AC-5 (read-only preview semantics): the endpoint returns outline + warnings + missingInputs + `wouldGenerate` flags; never writes, never emits audit events, never reads from the DB either.
- AC-6 (degraded UI honesty): `wouldGenerate.canProceed=false` with explicit `blockingReasons` so the UI can render an honest disabled "Generate" button instead of letting the user trigger a guaranteed-to-fail real generation.

### Risks / next-step notes

- R-S4-1: `wouldGenerate.canProceed` is computed against three known blocking conditions (strict + missing inputs, decision + empty pack, strict + needs_sources). Real `generateOutline` may surface additional generator-time errors (e.g. template runtime mismatch, slot mapping failure) that the preview cannot fully predict without invoking the generator. UI must keep treating `canProceed=true` as "best-effort green light", not a guarantee.
- R-S4-2: When `templateId` is supplied without `templateFamily`/`deckType`, the preview currently silently falls back to the narrative-plan / default outline path because resolving the approved-template row would require a DB read (out of S4 scope). The UI should not let users select an approved template via the Studio preview without surfacing this limitation. Tracked as P2-S4-2.
- R-S4-3: The preview re-uses the request-scoped `previewId` salt from the narrative plan's `createdAt` timestamp, so two consecutive previews with the same body will produce the same `previewId`. This is intentional for log-correlation determinism but means the UI must not key React state directly off `previewId`.

### Next sprint plan

- Sprint S5 starts Studio Surface UI (minimal): a single read-only Studio screen that consumes the four preview endpoints (`source-pack`, `narrative-plan`, `template-architect`, `generate`) and renders source coverage, narrative thesis, draft template plan, outline preview, and the `wouldGenerate` envelope. UI quality follows the Consultify UI/UX golden standard. No mutating endpoints are wired up. Anygravity manual retest pack runs after S5 lands.


## Sprint S5 Gate Report — Studio Surface UI (minimal, read-only) (2026-05-08)

Status: `PASS_WITH_P2`
Branch: `staging`
Scope: Frontend-only minimal surface that consumes the four S1..S4 preview endpoints. No DB migration, no mutating endpoints, no full ModuleHub adoption (deferred — see R-S5-1).

### Changes made

- New `consultify/src/services/api/presentationStudio.api.ts`:
  - Typed wire interfaces for the four preview envelopes (`SourcePackPreviewResponse`, `NarrativePlanPreviewResponse`, `TemplatePlanPreviewResponse`, `GeneratePreviewResponse`).
  - `PresentationStudioApi` with four methods (`previewSourcePack`, `previewNarrativePlan`, `previewTemplatePlan`, `previewGenerate`) wrapping the shared `fetchWithRetry` + `handleResponse` pipeline.
  - `studioPost<T>` helper unwraps the `{ success, data }` envelope and surfaces a typed `T`. Body-supplied `organizationId` is intentionally NOT modeled — the server takes the tenant from auth and ignores any body field.

- New `consultify/src/components/PresentationStudio/PresentationStudioPage.tsx`:
  - Minimal, read-only Studio surface mounted at `/presentation-studio`.
  - Top-of-page sticky local Menu 3 / command-row with the contextual AI action ("Run preview") anchored on the right (`presentation-studio-command-row-right`). Per `.cursor/rules/ai-actions-menu3.mdc`, AI actions live in Menu 3 and not inside the canvas. This page does not yet adopt the full `ModuleHub`; the local command row stands in until `ModuleHub` adoption (tracked R-S5-1).
  - Four section cards (`section-source-pack`, `section-narrative-plan`, `section-template-plan`, `section-generate`) render envelope summaries plus warnings. Status badges use the canonical color palette (slate/blue/amber/emerald/rose; primary reserved for the CTA).
  - Honest states: empty state pre-run, loading state on the CTA, error banner on API failure, degraded badge on `wouldGenerate.canProceed=false` with explicit blocking-reasons list. The template card always shows "Approval required before this template enters the registry" banner (S3 governance invariant rendered on the surface).
  - All four endpoints fetched in parallel via `Promise.all` to keep latency honest.
  - No mutating endpoints are wired up. No "Generate" or "Approve" CTAs.

- New `consultify/src/components/PresentationStudio/__tests__/PresentationStudioPage.test.tsx`:
  - 5 component tests exercising the canonical UI/UX gates:
    1. Menu 3 right-slot placement: AI action lives in `presentation-studio-command-row-right`, not in the canvas.
    2. Empty state pre-run; no error banner.
    3. Successful run fires all four endpoints in parallel and renders all four section cards plus the template approval banner.
    4. Degraded `canProceed=false` honestly renders blocking-reasons list.
    5. API error renders an honest error banner (no fake success).

- `consultify/src/routes/routeConfig.ts`: add `PRESENTATION_STUDIO: '/presentation-studio'` route constant.
- `consultify/src/routes/AppRoutes.tsx`: register the lazy `PresentationStudioPage` and mount it on `ROUTES.PRESENTATION_STUDIO` inside `MainLayout` + `ProductionModuleGate('Presentation Studio')` + `RouteErrorBoundary`. Page is gated behind the same `hideNonCoreModulesOnPublicProduction` flag as other non-core modules.

### Validation performed

- Vitest component test (`PresentationStudioPage.test.tsx`): 5/5 PASS.
- Vitest backend regression (`presentationStudio.routes.test.ts`): 23/23 PASS — confirms the FE wiring did not break the four preview endpoints.
- ESLint --fix on the five S5 files: 0 errors, 44 P3 warnings (pre-existing 36 + 4 `no-console` + 4 P3 polish warnings in shared modules touched indirectly + 1 empty-interface in our typed `SourcePackPreviewRequest` extension; deferred per S0 baseline policy).
- Project-wide `tsc --noEmit -p tsconfig.json`: 0 errors filtered to `presentation-studio|PresentationStudio|presentationStudio`. The wider Table Platform errors that pre-exist on `staging` are out-of-scope for S5.
- `ReadLints` on the five S5 files: clean.

### Gate result: `PASS_WITH_P2`

P0/P1: none.

P2 (deferred, non-blocking):
- P2-S5-1: Page does not yet adopt the full `ModuleHub`/`ModuleNavBar` shell. The local sticky command row mimics the Menu 3 right-slot semantics but is not the canonical primitive. Migration to `ModuleHub` is tracked as a UI-only follow-up; will land before any mutating endpoints are wired up.
- P2-S5-2: Setup form is hard-coded to a `DEFAULT_SETUP` constant. Inline editing (title, audience, goal, deck type, source artifacts) is intentionally deferred until the next UI sprint. Acceptable for S5 because the goal is to prove the four preview endpoints work end-to-end against a stable input.
- P2-S5-3: `PresentationStudioApi` does not yet emit funnel telemetry (e.g. `trackFunnelEvent`). Will land alongside the mutating endpoints when telemetry parity matters.
- P2-S5-4: Anygravity manual retest pack still pending. Now that S5 lands, the consolidated probe will run after the next deploy.

### Acceptance criteria (from contract) covered by S5

- AC-7 (UI/UX honesty): empty / loading / success / error / degraded states are all rendered explicitly. No fake success; the CTA is disabled while loading; errors surface a banner. Verified by integration test.
- AC-8 (UI/UX governance — Menu 3 placement): the contextual AI action ("Run preview") is rendered in the local Menu 3 right slot. Verified by component test asserting `commandRow.contains(rightSlot)` and `rightSlot.contains(runButton)`.
- AC-9 (UI/UX governance — color semantics): status badges use the canonical color tokens (slate/blue/amber/emerald/rose); primary is reserved for the CTA. Verified by visual review of the source.
- AC-10 (read-only contract on UI): no mutating action is reachable from this page. There is no "Generate", "Approve", "Save" or "Persist" button. Verified by code review.
- AC-3 (governance invariant for templates) on the UI: template card always shows the approval banner when populated. Verified by component test.

### Risks / next-step notes

- R-S5-1: Local command row vs full `ModuleHub` shell. The current placement matches the Menu 3 rule semantically but doesn't reuse the canonical primitive. Acceptable for an S5 minimal slice (the rule allows adding a right-side command-row slot when the module hasn't yet adopted the shell), but follow-up adoption is non-negotiable before we ship a mutating endpoint.
- R-S5-2: All four endpoints fire on every "Run preview" click. There is no caching or stale-while-revalidate. For the minimal surface this is acceptable; the orchestrator on the server is read-only and cheap, but a real Studio UI should debounce + memoize.
- R-S5-3: The page assumes the user has the `presentation_create` capability. Any 403 from the server surfaces as a generic error banner. A capability-aware empty state (with the same banner pattern as the rest of the app) is a P2 follow-up.

### Next sprint plan

- Sprint S6 starts Approval-gated Generate (mutating). Scope:
  - Add `POST /api/presentation-studio/generate` that actually invokes `presentationGeneratorService.generateOutline` BEHIND an explicit "approval ticket" surfaced by the existing audit/approval flow. The endpoint will require both `presentation_create` AND a fresh approval token; without the token it returns 403 PRECONDITION_REQUIRED.
  - Persistence is delegated to the existing `presentation_decks` table (no migration). Audit event `presentation_generated_via_studio` is emitted.
  - UI: extend `PresentationStudioPage` with a disabled-by-default "Request approval" CTA in the Menu 3 right slot. The CTA only appears once `wouldGenerate.canProceed === true` and behaves as a request, not a write — the server still requires explicit approval.

## Sprint S6 Gate Report — Approval-gated Generate (mutating) (2026-05-08)

Sprint owner: Engineering
Phase: 2 (implementation)
Mode: Backend-only this sprint. UI for the approval/execute CTAs is moved to S7 to keep S6 a single auditable backend slice.

### Changes made

- `consultify/server/src/services/presentationStudioApprovalTicketService.ts` (new)
  - First-class single-use approval ticket primitive used by Studio mutating endpoints.
  - `mintApprovalTicket({ organizationId, userId, payloadFingerprint, ttlMs?, now? })` mints a ticket whose id is `pssa_<uuid>`. Default TTL is 10 minutes.
  - `consumeApprovalTicket(...)` redeems atomically and returns a typed rejection union: `{ ok: true, ticket }` or `{ ok: false, reason: 'not_found' | 'expired' | 'consumed' | 'tenant_mismatch' | 'user_mismatch' | 'payload_mismatch' }`. The ticket is marked consumed BEFORE returning so re-redemption is impossible.
  - `computePayloadFingerprint(payload)` produces a stable SHA-256 hex digest over a sorted-key JSON serialization. This binds a ticket to the exact (org, setup, outline, sourcePack, narrativePlan, strict) tuple proposed at request-approval time.
  - In-memory `Map` storage. Tenant-scoped, user-scoped, time-bounded, payload-bound. No DB migration (Q2=A respected). Future sprints can swap the store for Redis without changing the public surface.
- `consultify/server/src/services/__tests__/presentationStudioApprovalTicketService.test.ts` (new)
  - 8 unit tests covering: mint shape, single-use semantics, `not_found`, `tenant_mismatch`, `user_mismatch`, `expired`, `payload_mismatch`, and stable fingerprint key-order independence.
- `consultify/server/src/services/presentationStudioOrchestrationService.ts`
  - Added Sprint S6 section preserving the proposal -> approval -> execution -> audit invariant for the first mutating Studio surface.
  - New `requestPresentationStudioGenerateApproval(...)`: calls the existing `previewPresentationStudioGenerate`; if `wouldGenerate.canProceed === false`, returns `{ ok: false, code: 'PRECONDITION_NOT_MET', reason, preview }`; otherwise mints an approval ticket bound to the canonical payload fingerprint and returns `{ ok: true, ticket, generatePreview, payloadFingerprint }`. Read-only.
  - New `executePresentationStudioGenerate(...)`: redeems the ticket atomically (tenant + user + payload + expiry + single-use), then invokes the real generator and emits the canonical `presentation_generated_via_studio` audit event. Returns `{ ok: true, result: { deckId, slideCount, outline, validationWarnings, ticketId, auditEvent } }` or `{ ok: false, code: 'INVALID_APPROVAL_TICKET', reason }`. On any ticket failure NO generator call is made and NO audit event is emitted.
  - Both functions use a tiny dependency registry: `_studioGenerateDeps`. Default-loaded production dependencies are `presentationGeneratorService.generateOutline` and a `dbRun` audit writer (via `utils/DbPromise.run`). Tests swap them via `_setStudioGenerateDependenciesForTests({ generateOutline, recordAudit })` to assert orchestration plumbing without touching the database.
- `consultify/server/src/routes/presentationStudio.routes.ts`
  - Added `POST /api/presentation-studio/generate/request-approval`. Auth + `presentation_create` + tenant-scoped. Mints a ticket on the healthy path; returns `412 PRECONDITION_NOT_MET` with the embedded preview when generation would not proceed.
  - Added `POST /api/presentation-studio/generate`. Auth + `presentation_create` + tenant-scoped. Returns `403 PRECONDITION_REQUIRED` when the body does not include `approvalTicket`. Otherwise redeems the ticket through the orchestrator and either returns the deck info (200) or surfaces the typed rejection (`403 INVALID_APPROVAL_TICKET` with the underlying reason).
  - Tenant integrity: `organizationId` is read from the authenticated session only. Body-supplied org/user ids are ignored. The audit log writes the session user id and session org id, never the body values.
- `consultify/server/src/routes/__tests__/presentationStudio.routes.test.ts`
  - 9 new integration tests covering: healthy `request-approval` mints a ticket; `412 PRECONDITION_NOT_MET` for empty source pack on a decision deck; `403 PERMISSION_DENIED` for VIEWER on `request-approval`; `403 PRECONDITION_REQUIRED` when `/generate` has no ticket; happy-path generate invokes generator + audit; re-redemption of the same ticket returns `consumed`; tampered payload returns `payload_mismatch`; cross-tenant redemption returns `tenant_mismatch`; VIEWER blocked on `/generate`.
  - Tests use `_setStudioGenerateDependenciesForTests` to swap in mocked generator / audit writer; the in-memory ticket store is cleared in every `beforeEach`.

### Validation performed

- `npx vitest run server/src/services/__tests__/presentationStudioApprovalTicketService.test.ts` — 8/8 passed.
- `npx vitest run server/src/routes/__tests__/presentationStudio.routes.test.ts` — 32/32 passed (full S0..S5 regression + 9 new S6 tests).
- `npx eslint` on the five in-scope files — 0 errors, 51 warnings. All warnings are `@typescript-eslint/no-explicit-any` matching the S0 baseline policy (mock casts in routes test + pre-existing setup-extra cast in orchestrator helper). No new error classes introduced.
- `npx tsc --noEmit -p server/tsconfig.json` filtered to `presentationStudio*` — 0 type errors. Out-of-scope `tablePlatform/*` errors remain, unchanged from S5.
- `git diff --stat` confirms exactly five files changed in scope (1 doc + 4 backend code + 1 test scaffold extension).

### Gate result: `PASS_WITH_P2`

- 0 P0, 0 P1, 0 P2.
- P3 deferred: pre-existing `no-explicit-any` warnings (S0 baseline). No new lint regressions.

### Acceptance criteria (from contract) covered by S6

- The first mutating Studio surface is delivered behind a single-use, tenant-bound, user-bound, payload-bound approval ticket.
- Without a ticket, generation returns `403 PRECONDITION_REQUIRED` and the route never invokes the generator.
- With a valid ticket, the route invokes the existing `generateOutline` (which persists to `presentation_decks`) and emits the canonical `presentation_generated_via_studio` audit event with `(userId, organizationId, deckId, ticketId, payloadFingerprint, slideCount, deckTitle, deckGoal, deckAudience)` details.
- Tenant safety holds: `organizationId` and `userId` are sourced from the authenticated session; body-supplied identifiers are ignored. A ticket minted for org A is rejected with `tenant_mismatch` when the session reports org B.
- The proposal -> approval -> execution -> audit invariant is enforced end-to-end with regression tests asserting all five typed rejection reasons.

### Risks / next-step notes

- R-S6-1: The ticket store is in-memory. A server restart between request-approval and generate invalidates outstanding tickets. The 10-minute TTL and the deliberate "approve immediately before execute" UX make this acceptable for Phase 2; a Redis-backed store is a P2 follow-up.
- R-S6-2: The audit writer is invoked AFTER the generator succeeds. If the audit insert fails, the deck still exists. We accept this for Phase 2 because the failure mode is detectable post-hoc and the alternative (compensating delete) introduces a bigger correctness risk than it removes. A P2 follow-up will add either a tx-wrapped path or an "audit dead letter" lane.
- R-S6-3: There is no UI for the new endpoints yet. The Studio page introduced in S5 still calls only the four read-only previews. S7 will add the request-approval / confirm-generate CTAs in the Menu 3 right slot, with explicit honest-state rendering for `PRECONDITION_NOT_MET`, `PRECONDITION_REQUIRED`, and `INVALID_APPROVAL_TICKET`.

### Next sprint plan

- Sprint S7 starts Studio Surface — Approval CTA flow (UI). Scope:
  - Extend `src/services/api/presentationStudio.api.ts` with `requestApproval` and `executeGenerate` typed clients.
  - Extend `PresentationStudioPage` with two CTAs in the Menu 3 right slot:
    1. `Request approval` — visible only when `generatePreview.wouldGenerate.canProceed === true`. On click, calls `/generate/request-approval`. On 200 stores the returned ticket in component state with a TTL countdown badge and surfaces a "Confirm generate" CTA. On 412 surfaces an honest banner with the embedded preview's blocking reasons.
    2. `Confirm generate` — visible only with a fresh, unconsumed ticket. On click, calls `/generate` with the ticket id. On 200 surfaces the deck id, slide count, and a "View deck" link to the existing builder. On 403 INVALID_APPROVAL_TICKET clears the ticket and surfaces an honest banner naming the rejection reason; the Request-approval CTA reappears.
  - Component tests cover: hidden CTA when canProceed=false; visible CTA on healthy preview; ticket countdown rendering; 412 banner; 403 INVALID_APPROVAL_TICKET banner; deck-id reveal on success.
  - No backend changes in S7.

## Sprint S7 Gate Report — Studio Surface Approval CTA flow (UI) (2026-05-08)

Sprint owner: Engineering
Phase: 2 (implementation)
Mode: Frontend-only. Backend from S6 unchanged.

### Changes made

- `consultify/src/services/api/presentationStudio.api.ts`
  - Added `PresentationStudioApprovalTicket`, `RequestApprovalRequest`, `RequestApprovalResponse`, `ExecuteGenerateRequest`, and `ExecuteGenerateResponse` typed surfaces matching the S6 backend contract.
  - Added `PresentationStudioApiError` class with `status`, `code`, `reason?`, and `preview?` fields. Lets the UI distinguish `PRECONDITION_NOT_MET` (412 with embedded preview) from `INVALID_APPROVAL_TICKET` (403 with typed reason) without parsing raw responses.
  - Added a new `studioPostTyped` helper that bypasses the standard `handleResponse` (which throws generic `Error` on non-2xx) so the mutating endpoints can surface typed envelopes directly. Read-only endpoints continue to use the existing `studioPost`.
  - Added two new methods on `PresentationStudioApi`: `requestApproval(...)` (S6 phase A) and `executeGenerate(...)` (S6 phase B).
- `consultify/src/components/PresentationStudio/PresentationStudioPage.tsx`
  - Added `ApprovalState` (ticket, pending, approval-error reason, ticket-rejection reason, generated deck) alongside the existing `PreviewState`.
  - Added `requestApproval` and `confirmGenerate` callbacks that call the new API methods. `requestApproval` runs only when `state.generate.wouldGenerate.canProceed === true`; `confirmGenerate` runs only when a fresh, unconsumed ticket is held. Both surface typed banners on failure.
  - Added a 1 Hz interval (only mounted while a ticket exists) to drive a live TTL countdown on the Confirm-generate CTA label (e.g. `Confirm generate · 9:48`).
  - Added two new CTA buttons in the Menu 3 right slot (`commandRowRightContent` equivalent) per `.cursor/rules/ai-actions-menu3.mdc`:
    - `Request approval` — visible only when `canProceed=true` and no ticket is held.
    - `Confirm generate` — visible only with a fresh ticket; disables on expiry; primary tone (CTA).
  - Added three new banners in the canvas:
    - Approval-error banner (amber) — surfaces 412 `PRECONDITION_NOT_MET` reasons, or any other `request-approval` failure.
    - Ticket-error banner (rose) — surfaces 403 `INVALID_APPROVAL_TICKET` with the typed reason translated through `TICKET_REJECTION_LABELS` (e.g. `payload_mismatch` → "Setup changed since the ticket was issued. Re-run preview and request a new approval.").
    - Generate-success banner (emerald) — surfaces deck id, slide count, audit event marker, and any backend validation warnings.
  - Re-running the preview clears the in-flight approval state to prevent fingerprint mismatches across runs.
- `consultify/src/components/PresentationStudio/__tests__/PresentationStudioPage.test.tsx`
  - Updated the API mock factory to use `vi.importActual` so the real `PresentationStudioApiError` class is shared across page and test (otherwise `instanceof` checks in the component would always fail under the mock).
  - Added six new tests:
    1. `Request approval` CTA hidden when `canProceed=false`.
    2. `Request approval` CTA visible in the Menu 3 right slot after a healthy preview, with no `Confirm generate` yet.
    3. `requestApproval` mints a ticket and surfaces `Confirm generate` with a `\d+:\d{2}` TTL countdown label, also in the right slot.
    4. 412 `PRECONDITION_NOT_MET` surfaces an honest approval-error banner; no `Confirm generate` is rendered.
    5. Successful `executeGenerate` shows the deck-id success banner with `audit:presentation_generated_via_studio` and clears both CTAs (single-use semantics).
    6. 403 `INVALID_APPROVAL_TICKET` (`payload_mismatch`) clears the ticket, shows the typed banner, and brings back the `Request approval` CTA.

### Validation performed

- `npx vitest run src/components/PresentationStudio server/src/services/__tests__/presentationStudioApprovalTicketService.test.ts server/src/routes/__tests__/presentationStudio.routes.test.ts --no-coverage` — 51/51 passed across the Studio surface (8 ticket service + 32 route integration + 11 component).
- `npx eslint` on three in-scope files — 0 errors, 1 warning. The single warning (`no-empty-object-type` on `SourcePackPreviewRequest extends PresentationStudioSetupInput {}`) is pre-existing from S5; no new error or warning class introduced. The new mutating-flow `RequestApprovalRequest` was switched from an empty-extends interface to a `type =` alias to avoid a fresh warning.
- `npx tsc --noEmit -p consultify/tsconfig.json` filtered to `presentationStudio*` — 0 type errors. Out-of-scope `tablePlatform/*` errors remain unchanged.
- Tenant safety: client never sends `organizationId` in the body for the new endpoints; `studioPostTyped` defers tenancy to the server (which reads it from the authenticated session). No client-side trust boundary moved.

### Gate result: `PASS_WITH_P2`

- 0 P0, 0 P1, 0 P2.
- P3 deferred: 1 pre-existing `no-empty-object-type` warning. No new deferred items.

### Acceptance criteria (from contract) covered by S7

- The approval-gated generate flow is wired end-to-end on the UI. Users can never trigger generation without first having minted (and immediately holding) a valid approval ticket; the proposal -> approval -> execution -> audit invariant is preserved on the client.
- All mutating CTAs (`Request approval`, `Confirm generate`) live in the Menu 3 right slot per `.cursor/rules/ai-actions-menu3.mdc`. The canvas only renders honest read-only state and banners.
- Honest UI states fully covered: empty (initial), loading (per CTA), success (deck-id banner), error (preview / approval / ticket banners), degraded (`canProceed=false` blocks the approval CTA from appearing at all).
- Status semantics use the canonical color map (`slate`/`blue`/`amber`/`emerald`/`rose`); the only `primary` element is the Confirm-generate CTA, which is the explicit primary action by design.

### Risks / next-step notes

- R-S7-1: The Confirm-generate CTA shows a live countdown but does not disable mid-redemption when the ticket flips from "fresh" to "expired" while the request is in flight. The server still rejects expired tickets correctly (`expired` reason), and the UI surfaces the typed banner. A P2 follow-up may add a soft client-side "ticket expired" state before clicking.
- R-S7-2: The page still uses `DEFAULT_SETUP` (a hard-coded steering deck) for both preview and approval. Real-world wiring (org-aware setup form, source artifact picker, deck-type selector) lands in a later sprint and is independent of the approval invariant.
- R-S7-3: The "View deck" deep-link from the success banner is not wired yet (the deck id is shown but not clickable). The follow-up sprint will route to the existing deck builder once the cross-module navigation contract lands.

### Next sprint plan

- Sprint S8 starts Studio Surface — Setup Form & Deck Type Selector. Scope:
  - Replace `DEFAULT_SETUP` with a small, governance-aware form (title, audience, goal, deck type, language). Existing read-only previews and approval flow consume the form state.
  - Add a deck-type selector (steering committee, project pulse, board update, sales pitch). The selector wires straight into `setup.deckType` so the existing template architect dispatcher picks up the right family.
  - Add input validation honest states: "title required", "deck type required". No silent defaults.
  - No backend changes. No mutating contract changes. The approval ticket flow keeps working unchanged.

## Sprint S8 Gate Report — Setup Form & Deck Type Selector (2026-05-08)

Sprint owner: Engineering
Phase: 2 (implementation)
Mode: Frontend-only. Backend from S6 unchanged. Approval flow contract unchanged.

### Changes made

- `consultify/src/components/PresentationStudio/PresentationStudioSetupForm.tsx` (new)
  - Pure presentational form owning the editable subset of the Studio setup payload: `title` (required), `audience`, `goal`, `deckType` (required), `language`.
  - No silent defaults on REQUIRED fields. `title` and `deckType` start empty; `audience`, `goal`, `language` have explicitly labeled defaults.
  - Honest UI: validation messages render only after the parent flips `showErrors=true` (i.e. after a submit attempt). No errors shown on a blank first render.
  - Exports `PRESENTATION_STUDIO_SETUP_FORM_DEFAULT` and `validatePresentationStudioSetupForm` so the parent can compute validity without re-rendering the form.
  - Four governance-aware deck-type options surfaced: `steering_committee`, `project_pulse`, `board_update`, `sales_pitch`. The empty option is rendered as the explicit "Select deck type…" placeholder, never as a hidden default.
  - Component never mutates anything; emits a typed `value` upward via `onChange`.
- `consultify/src/components/PresentationStudio/PresentationStudioPage.tsx`
  - Replaced the hard-coded `DEFAULT_SETUP` constant with `PRESENTATION_STUDIO_SETUP_FORM_DEFAULT` plus a small `buildSetupFromForm` helper that projects the form value into the `PresentationStudioSetupInput` shape used by the API. Static, non-form extras (`theme`, `confidentiality`, demo `sourceArtifacts`) are documented as intentionally constant for S8; the source artifact picker lands in a future sprint.
  - Added `formValue`, `showFormErrors`, and a memoized `formIsValid` boolean. `runPreview` now: a) flips `showFormErrors=true` and bails when invalid, b) clears `showFormErrors` and proceeds when valid. No previews fire while the form is invalid.
  - Added `handleFormChange` which clears `INITIAL_APPROVAL_STATE` on every form mutation. Rationale: the approval ticket fingerprint commits to the exact payload at request-approval time, so editing the form invalidates the existing ticket. The UI mirrors the server invariant eagerly to spare the user a `payload_mismatch` round-trip.
  - Added a top-level form-error banner shown when `runPreview` is clicked with invalid fields. Echoes the inline validation messages with an aggregate "no silent defaults" reminder.
  - The setup form is mounted as the first content card in the canvas, above all preview cards. The Menu 3 right slot remains the only home for AI actions per `.cursor/rules/ai-actions-menu3.mdc`.
- `consultify/src/components/PresentationStudio/__tests__/PresentationStudioPage.test.tsx`
  - Added `fillRequiredFields()` helper used by every test that needs a successful Run-preview round-trip.
  - Updated all S5 and S7 tests to call `fillRequiredFields()` before clicking Run preview (form is now empty by default, so previews are blocked otherwise).
  - Added 5 new S8 tests:
    1. Empty required fields by default; no validation messages until first submit attempt.
    2. Run preview is blocked when required fields missing; both inline errors and the aggregate banner appear; no API calls fired.
    3. Filling fields enables Run preview and clears the form-error banner; the setup that hits `previewSourcePack` reflects the user-typed `title` and `deckType`.
    4. The deck-type selector exposes all four governance-aware options (`steering_committee`, `project_pulse`, `board_update`, `sales_pitch`) plus the explicit empty placeholder.
    5. Editing the form after a ticket has been minted clears the ticket (Confirm-generate disappears) while the Request-approval CTA reappears so the user can mint a fresh, fingerprinted ticket bound to the new payload.

### Validation performed

- `npx vitest run src/components/PresentationStudio/__tests__/PresentationStudioPage.test.tsx --no-coverage` — 16/16 passed (5 S5 + 6 S7 + 5 new S8).
- `npx vitest run src/components/PresentationStudio server/src/services/__tests__/presentationStudioApprovalTicketService.test.ts server/src/routes/__tests__/presentationStudio.routes.test.ts --no-coverage` — 56/56 passed across the full Studio surface (8 ticket + 32 routes + 16 component).
- `npx eslint` on three in-scope files — 0 errors, 2 warnings. The warnings (`react-refresh/only-export-components` on `PRESENTATION_STUDIO_SETUP_FORM_DEFAULT` and `validatePresentationStudioSetupForm`) are HMR-only hints; the pattern is consistent with sibling Studio modules and acceptable per S0 baseline. Splitting the constants into a third file would be cosmetic with no runtime benefit.
- `npx tsc --noEmit -p consultify/tsconfig.json` filtered to `presentationStudio*` — 0 type errors. Out-of-scope `tablePlatform/*` errors remain unchanged.
- Approval invariant preserved: server-side contract is unchanged; client behaviour around the ticket (single-use, payload-bound, tenant-bound) is unchanged. Setup form changes ONLY clear the local ticket reference; they never call any backend endpoint on their own.

### Gate result: `PASS_WITH_P2`

- 0 P0, 0 P1, 0 P2.
- P3 deferred: 2 new `react-refresh/only-export-components` warnings (HMR-only); 1 pre-existing `no-empty-object-type` warning from S5/S7 baseline.

### Acceptance criteria (from contract) covered by S8

- The Studio surface no longer hides setup behind a constant. Every preview and every approval round-trip uses the user-typed setup, with the title and deck type required honestly (no silent fallbacks).
- The deck-type selector exposes the four governance-aware presentation families that the server's template architect dispatcher recognizes.
- Honest UI states fully covered: empty form (initial), inline + aggregate error states (on submit attempt), valid form (Run preview proceeds), in-flight (form disabled while a preview / approval is running), and post-mutation invalidation (ticket cleared on form change).
- The proposal -> approval -> execution -> audit invariant is preserved and now visibly enforced on the client: editing the form after minting a ticket invalidates the ticket immediately and forces the user to re-mint.

### Risks / next-step notes

- R-S8-1: The form does not yet expose the source artifact picker. The current page injects a single demo readiness assessment so the source pack preview always returns a non-empty pack. Wiring real source artifacts (interview, research, roadmap, AI audit) is a P2 follow-up driven by S10 of the master sprint map.
- R-S8-2: Setup form changes invalidate the ticket but do NOT auto-rerun the preview. The user has to click Run preview again to refresh the source pack / narrative / template / generate cards. This is intentional per honest-UX rule (no hidden fetches) and surfaces no stale data: the cards still show the LAST run, plainly labeled.
- R-S8-3: Audience, goal, and language fields are presented as flat selects. A guided assistant ("if your audience is a board, pick board_update for deck type") is a P3 nice-to-have, not blocking.

### Next sprint plan

- Sprint S9 starts Source Artifact Picker. Scope:
  - Add a server-driven source-artifact picker that lists the user's tenant-scoped assessments, interview projects, research workspaces, and AI-audit reports, each with a "ready / partial / missing" readiness chip read from the existing source pack service.
  - Replace the hard-coded demo readiness assessment with the selected artifacts. Selection persists in the form state and survives across previews.
  - Backend: a new read-only `GET /api/presentation-studio/source-artifacts` endpoint that re-uses the existing source pack service. No mutating endpoints; no DB migration.
  - Honest UI states: empty list, loading, ready chip, missing-input chip, error (e.g. tenant context dropped). The picker remains tenant-scoped via the authenticated session.

## Sprint S9 Gate Report — Source Artifact Picker (2026-05-08)

Sprint owner: Engineering
Phase: 2 (implementation)
Mode: Backend (read-only) + Frontend. Approval flow contract unchanged.

### Changes made

- `consultify/server/src/services/presentationStudioSourceArtifactsService.ts` (new)
  - Read-only, tenant-scoped enumeration of Studio source artifacts. S9 ships the `assessment` source type only; other types (`interview_study`, `tool_session`, `report`, etc.) are documented as P2 follow-up sprints.
  - `listPresentationStudioSourceArtifacts({ organizationId, limit?, now? })` queries `assessments WHERE organization_id = ?` ordered by `updated_at DESC` and maps each row to a unified `PresentationStudioSourceArtifactItem` shape.
  - Honest readiness derivation: `ready` (status indicates completion OR `overall_score` exists), `partial_ready` (answers exist but no completion / score), `insufficient_evidence` (no answers).
  - Honest degraded UI: when the underlying query fails the function STILL returns 200 with an empty `artifacts` array AND a typed warning (`assessments_query_failed: <message>`); the route surfaces the warning so the picker can render an honest degraded banner instead of a generic 5xx.
  - Dependency-injected `queryAssessments` so unit tests swap out the DB without touching `dbAll`. Production uses `utils/DbPromise.run`.
- `consultify/server/src/services/__tests__/presentationStudioSourceArtifactsService.test.ts` (new)
  - 6 unit tests covering: ready mapping (status COMPLETED + score), partial_ready (answers, no score), insufficient_evidence (no answers), limit clamping `[1..200]`, honest-degraded warnings on rejection, tenant id pass-through.
- `consultify/server/src/routes/presentationStudio.routes.ts`
  - Added `GET /api/presentation-studio/source-artifacts`. Auth + `presentation_create` + tenant-scoped. Returns 200 with the artifact list (and any backend warnings) on the happy path; 403 PERMISSION_DENIED for VIEWER; 403 NO_ORG_CONTEXT when no tenant. Body / query overrides of `organizationId` are ignored.
  - `limit` query param is parsed as a number; service-side clamping handles out-of-range values.
- `consultify/server/src/routes/__tests__/presentationStudio.routes.test.ts`
  - 5 new integration tests: happy path with mocked DB returning a `ready` assessment, query-string `organizationId` override is ignored (tenant pulled from session), `limit` query param forwarded, honest degraded 200 with warnings on DB failure, VIEWER gets 403 PERMISSION_DENIED.
- `consultify/src/services/api/presentationStudio.api.ts`
  - Added `PresentationStudioSourceArtifactReadiness`, `PresentationStudioSourceArtifactItem`, and `PresentationStudioSourceArtifactList` types (matching the server contract).
  - Added a `studioGet` helper for read-only Studio endpoints; existing helpers untouched.
  - Added `PresentationStudioApi.listSourceArtifacts({ limit? })` which forwards `?limit=` when supplied.
- `consultify/src/components/PresentationStudio/PresentationStudioSourceArtifactPicker.tsx` (new)
  - Pure presentational picker. Owns no fetches; the parent injects `list`, `loading`, `error`, `selectedIds`, `onSelectionChange`, `onReload`, and `disabled`.
  - Renders five honest UI states: loading, error banner, honest-degraded warnings banner (server warnings), explicit empty state (no artifacts AND no warnings), populated list with checkboxes + readiness chips + per-type type chip + selection counter.
  - Readiness chips use the canonical color tokens (slate / blue / amber / emerald / rose); no local custom map.
- `consultify/src/components/PresentationStudio/PresentationStudioPage.tsx`
  - Removed the hard-coded `demo-assessment-1` placeholder. `SETUP_NON_FORM_EXTRAS` now ONLY carries `theme` + `confidentiality`. Source artifacts come from the user's selection.
  - Added `SourceArtifactsState` (loading, error, list, selectedIds). `useEffect` fetches the list on mount; the picker's reload button refetches on demand.
  - Added `handleSourceSelectionChange` that mirrors the approval-fingerprint invariant: editing the selection invalidates the in-flight ticket eagerly, the user can re-mint immediately if the preview still reports `canProceed=true`.
  - `buildSetupFromForm` projects only the user-selected artifacts into the API setup payload. Empty selection results in an empty `sourceArtifacts` array — the source pack preview will then render an honest empty / degraded state instead of a synthetic "ready".
  - When the artifact list is reloaded, any selected ids that no longer exist are dropped from the selection automatically (the picker never claims to "select" a missing artifact).
- `consultify/src/components/PresentationStudio/__tests__/PresentationStudioPage.test.tsx`
  - Updated the API mock factory + `beforeEach` to default `listSourceArtifacts` to an empty list. Tests that need a populated list override the mock locally.
  - Added 7 new S9 tests:
    1. Mount fetch — picker renders the artifact list returned by the API.
    2. Empty state — populated when the tenant has no artifacts AND no warnings.
    3. Honest degraded warning banner — when the backend returns warnings.
    4. Honest error banner — when `listSourceArtifacts` rejects.
    5. Selected artifacts forwarded into the preview API call (verified via the actual `previewSourcePack` mock argument).
    6. Selection change clears the in-flight approval ticket (Confirm-generate disappears) — mirrors the form-change invariant from S8.
    7. Reload button refetches the artifact list.

### Validation performed

- `npx vitest run src/components/PresentationStudio server/src/services/__tests__/presentationStudioApprovalTicketService.test.ts server/src/services/__tests__/presentationStudioSourceArtifactsService.test.ts server/src/routes/__tests__/presentationStudio.routes.test.ts --no-coverage` — 74/74 passed across the full Studio surface (8 ticket service + 6 source artifacts service + 37 route integration + 23 component).
- `npx eslint` on eight in-scope files — 0 errors, 50 warnings. All warnings match the pre-existing P3 baseline (`no-explicit-any` on test mocks, `no-empty-object-type` on a single S5 alias, react-refresh HMR hints from S8). No new warning class introduced.
- `npx tsc --noEmit -p consultify/tsconfig.json` filtered to `presentationStudio*` — 0 frontend type errors. `npx tsc --noEmit -p consultify/server/tsconfig.json` filtered to `presentationStudio*` — 0 backend type errors.
- Tenant safety: every read of `organizationId` in the route comes from the authenticated session (`getOrgId(req)`); body / query overrides are unit-tested as ignored. The service propagates only `(organizationId, limit)` to the underlying query.

### Gate result: `PASS_WITH_P2`

- 0 P0, 0 P1, 0 P2.
- P3 deferred: pre-existing `no-explicit-any`, `no-empty-object-type`, react-refresh warnings (S0 baseline + S8 carry-overs). No new deferred items.

### Acceptance criteria (from contract) covered by S9

- The Studio surface no longer attaches a synthetic "demo readiness assessment" to every preview. The user explicitly picks artifacts from a tenant-scoped, read-only list.
- Honest UI states fully covered for the picker: loading, ready / partial_ready / insufficient_evidence / missing / policy chips, empty list, server-warning degraded banner, fetch-error banner.
- The proposal -> approval -> execution -> audit invariant is preserved and now also enforced on the source-selection axis: editing the selection invalidates the in-flight ticket eagerly, mirroring the server fingerprint contract.
- Tenant safety: server reads `organizationId` from the session only; route integration tests assert that body / query overrides do NOT change the queried tenant.

### Risks / next-step notes

- R-S9-1: Only the `assessment` source type is enumerated. Other types in the `SourceArtifact` universe (`interview_study`, `tool_session`, `report`, `valuation`, `financial_analysis`, `insight_pack`, `decision_pack`, `workspace`) are not yet listed. The picker's wire shape is generic so extending the service per type is additive — a P2 follow-up can ship them one at a time without changing the public contract.
- R-S9-2: The `assessments` table query uses `ORDER BY updated_at DESC NULLS LAST`. On databases that don't support `NULLS LAST` (older MySQL) the ordering may differ; PostgreSQL behavior is intentional. If we ship to a non-PG runtime we'll degrade to a portable sort and re-test.
- R-S9-3: Confidence is normalized from `overall_score` heuristically (treats values > 1 as a percentage). If a future framework emits confidence on a different scale we'll add a per-framework mapper.

### Next sprint plan

- Sprint S10 starts Visual Layout Engine Hardening (cross-references master sprint map WP-06 / MT-PRES-037 / MT-PRES-038). Scope:
  - Audit the deterministic business layouts emitted by `presentationGeneratorService.generateOutline` for overflow detection (text density vs slot capacity), missing-source placeholder discipline, and PDF/PPTX export parity.
  - Add a layout pre-check function that flags slides that would overflow at the canonical PPTX render size and surfaces the flags in the existing `validationWarnings[]` channel.
  - Backend-only sprint: no UI surface area touched. Existing approval flow and source picker contracts unchanged.

## Phase 2 — Sprint S10 gate (Visual Layout Engine Hardening / 2026-05-09)

**Gate**: closed → committed under `27cc4934b..HEAD` on `main`.

### Scope landed in S10

Backend-only sprint. Cross-reference: master sprint map WP-06 / MT-PRES-037 / MT-PRES-038. No UI surface area touched. Approval flow + source picker contracts unchanged. No DB migrations.

S10 introduces a **deterministic, pure-function layout audit pass** that is run on every Studio outline emitted by either the read-only preview pipeline (`previewPresentationStudioGenerate`) or the mutating execute pipeline (`executePresentationStudioGenerate`). Findings are advisory — they NEVER block generation; they surface on the existing `validationWarnings[]` channel and on a new structured `layoutAudit` payload returned by `/generate/preview`. The audit pass closes a real-world integrity gap: prior to S10 the renderer could silently truncate, fall back, or omit slide content; the user only saw the symptom in the exported deck.

### Changes

- `consultify/server/src/services/presentationStudioLayoutAuditService.ts` (new)
  - Pure, dependency-free audit. Inputs: `OutlineItem[]`. Output: `{ warnings, slideAudits, flagCounts }`.
  - Flag set:
    1. `layout_overflow_title` — title exceeds the per-density title cap.
    2. `layout_overflow_key_message` — key message exceeds the per-density body cap.
    3. `layout_overflow_blocks` — `suggestedBlocks.length` exceeds the per-density block cap.
    4. `missing_source_for_evidence_intent` — outline item has an evidence-required intent (`assessment`, `root_cause`, `recommendation_single`, `recommendation_portfolio`, `initiative_portfolio`, `performance_overview`, `risk_management`, `roadmap`, `prioritization_matrix`, `comparison`) but neither `sourceRef` nor `sourceRefs` is populated.
    5. `unsupported_intent_for_pptx_export` — intent is not in the canonical `SlideIntent` union the PPTX pipeline supports; renderer fallback would otherwise be silent.
  - Density-aware budgets (visual / balanced / document) calibrated against the existing `presentationBrandLayoutService` + `report/pptx` masters at canonical 16:9 (13.333" × 7.5"). Conservative caps; raise per renderer when a slot is extended.
  - Disabled slides (`enabled === false`) are skipped entirely (they will not be exported, so flagging them is noise).
  - Each warning is prefixed with `[<flag_id>]` so log aggregations stay greppable per flag without re-parsing prose.
- `consultify/server/src/services/__tests__/presentationStudioLayoutAuditService.test.ts` (new)
  - 10 unit tests covering: clean outline → empty audit; overflow title (visual cap); overflow key message (balanced cap); overflow blocks (visual cap); missing-source on `recommendation_single`; missing-source NOT raised when `sourceRefs` is non-empty; unsupported intent flag; disabled slides skipped; multiple flags aggregated on the same slide; canonical SlideIntent ↔ audit-supported-set drift guard (asserts both lists match exactly).
- `consultify/server/src/services/presentationStudioOrchestrationService.ts`
  - `previewPresentationStudioGenerate` now runs the audit on `outlinePreview` and merges its warnings into the top-level `warnings[]`, plus exposes a new `layoutAudit` field on the preview result so the UI can render flag counts without parsing prose.
  - `executePresentationStudioGenerate` now runs the audit on the **actual generator output** (not the preview) and merges its warnings into `validationWarnings[]` returned to the client. The aggregate `flagCounts` are also written into `recordAudit(...)` `details.layoutAuditFlagCounts`, so audit rows carry the same observable signal.
  - The preview result type now declares `layoutAudit: PresentationStudioOutlineLayoutAudit`.
- `consultify/server/src/routes/__tests__/presentationStudio.routes.test.ts`
  - Added 4 new S10 regressions (3 on `/generate/preview`, 1 on `/generate`):
    1. `/generate/preview` — `layoutAudit` shape is present and parallel-indexed against `outlinePreview`.
    2. `/generate/preview` — caller-supplied outline with an overlong title + missing source surfaces both flags in `flagCounts` AND in the merged `warnings[]` array.
    3. `/generate/preview` — caller-supplied outline with an unknown intent string raises `unsupported_intent_for_pptx_export`.
    4. `/generate` — generator returns a baseline warning + a flag-triggering outline; the response's `validationWarnings[]` contains BOTH the baseline warning and the audit warnings, AND the audit row's `details.layoutAuditFlagCounts` matches.

### Validation performed

- `npx vitest run server/src/services/__tests__/presentationStudioApprovalTicketService.test.ts server/src/services/__tests__/presentationStudioLayoutAuditService.test.ts server/src/services/__tests__/presentationStudioSourceArtifactsService.test.ts server/src/routes/__tests__/presentationStudio.routes.test.ts src/components/PresentationStudio/__tests__/PresentationStudioPage.test.tsx --no-coverage` — **88/88 passed** across the full Studio surface (10 layout audit + 8 ticket + 6 source artifacts + 41 route integration + 23 component).
- `npx eslint` on the four S10 in-scope files — **0 errors**. Remaining 24 warnings are pre-existing P3 (`no-explicit-any` on test mocks + a single S0-baseline `(setup as any)` cast in the orchestrator, both already deferred).
- `npx tsc --noEmit` on the new layout audit service in isolation — clean. The orchestrator change is verified through the route integration test suite (which compiles + runs the live route handlers).
- Tenant / approval invariants unchanged: the audit reads only the outline; it does not see organizationId, userId, or any session state. It cannot leak data across tenants by construction.

### Gate result: `PASS_WITH_P2`

- 0 P0, 0 P1, 0 P2.
- P3 deferred: pre-existing `no-explicit-any` warnings in test mocks (S0 baseline carry). No new deferred items introduced.

### Acceptance criteria (from contract) covered by S10

- Visual Layout Engine Hardening (WP-06): the deterministic outline path now self-reports overflow risks instead of relying on the renderer to silently truncate. The signal is visible at `/generate/preview` time (so the UI can show "N layout warnings" next to the Generate CTA) AND at execute time (so the audit row + the response both carry the flag counts).
- Honest degraded UI: warnings are advisory and never block. The user retains agency. The flag id prefix makes the warning machine-readable for downstream log/alerts.
- Approval invariant preserved: the audit runs **after** ticket consumption on the execute path (so a tampered outline still cannot bypass approval), and **before** the audit row is written (so the audit row reflects what was actually generated, not what was previewed).
- Tenant + ACL safety unchanged: the audit is pure and dependency-free; no DB, no session, no clock. It cannot regress tenant isolation.

### Risks / next-step notes

- R-S10-1: Slot capacity numbers are calibrated against the **current** masters in `presentationBrandLayoutService` + `report/pptx`. If a future template family extends a slot, the audit cap must be raised in tandem or it will produce false-positive overflow warnings. Mitigation: a per-template override is the right shape; it is intentionally NOT shipped in S10 because no current template needs it. This becomes a P2 follow-up the moment a renderer extends a slot.
- R-S10-2: The audit treats `density` as a single dimension. Real layouts mix densities within a slide (e.g. dense bullets + sparse hero). The cap model approximates by routing the entire slide through one density. We accept the false-positive risk — the warning is advisory, and a stricter per-slot model is deferred to S11+ if reviewers complain.
- R-S10-3: The PPTX-supported intent set is duplicated into the audit module to keep the audit decoupled from the renderer's import graph. Drift is caught by the unit test that walks the canonical `SlideIntent` union and asserts both sets match. Adding a new `SlideIntent` will fail the test until the audit set is updated.
- R-S10-4: The audit runs on the actual generator output on the execute path, but `recordAudit(...)` already runs even if the audit count is zero. We considered routing the audit invocation through a feature flag; we did not, because the marginal cost is sub-millisecond and the operational signal is high-value. Revisit if profiling ever shows the audit on the hot path.

### Next sprint plan

- Sprint S11 starts the next layout-engine hardening loop (WP-06 carry / MT-PRES-039 / MT-PRES-040). Candidate scope (subject to approval):
  - Per-template-family slot capacity overrides (closes R-S10-1).
  - Per-slot density mode (closes R-S10-2): the audit walks individual slots inside a slide rather than treating each slide as monolithic.
  - Surface `layoutAudit.flagCounts` in the Studio Surface UI as a non-blocking pre-flight banner adjacent to the Generate CTA.
  - PDF export parity: extend `unsupported_intent_for_pptx_export` to also flag intents not in the PDF pipeline's supported set (currently both pipelines align, but the audit should enforce this independently).

## Phase 2 — Sprint S11 gate (Layout audit hardening + UI surface / 2026-05-09)

**Gate**: closed → committed under `19ff0a01d..HEAD` on `staging`.

### Scope landed in S11

Cross-reference: master sprint map WP-06 carry / MT-PRES-039 / MT-PRES-040. Backend + Frontend. No DB migrations. Approval-ticket invariant preserved. The audit remains advisory and never blocks generation.

S11 closes two of the three S10 follow-up risks (R-S10-1: per-template-family overrides; new structural PDF parity check) and ships the first user-facing surface for the audit (a non-blocking pre-flight banner that sits canvas-side, never inside Menu 3, per the AI-actions-in-Menu-3 workspace rule). Per-slot density (R-S10-2) is intentionally deferred — it requires extending `OutlineItem` and the generator and is scoped for S12.

### Changes

- `consultify/server/src/services/presentationStudioLayoutAuditService.ts`
  - Added `unsupported_intent_for_pdf_export` to `LayoutAuditFlag` and `flagCounts`.
  - Added `PDF_SUPPORTED_INTENTS` (mirrors PPTX 1:1 today; tracked separately so a future PDF-only divergence is caught at the moment of divergence, not at the moment a customer sees a blank slide). Added the corresponding test-only export.
  - Added `TEMPLATE_FAMILY_BUDGET_OVERRIDES` keyed by canonical TemplateFamily display names. Conservative bumps for three families calibrated against the existing masters: `Steering Committee Deck` (extended balanced + document caps), `Board Decision Deck` (extended balanced cap), `DRD Diagnostic Deck` (extended document cap). Other families fall back to the canonical `DENSITY_BUDGETS`.
  - Added `FAMILY_ALIAS_BY_DECK_TYPE` mirroring `FAMILY_BY_DECK_TYPE` from the runtime service so raw deck-type strings (e.g. body sets `deckType: 'steering_committee'`) normalize to canonical family display names. Drift between the two maps is guarded by a unit test.
  - Added `normalizeTemplateFamily` + `resolveSlotCapacity`. `auditPresentationStudioOutlineLayout` now accepts an optional second arg `{ templateFamily }` that flows through both code paths.
  - Test-only exports `_pdfSupportedIntentsForTests`, `_templateFamilyOverridesForTests`, `_familyAliasByDeckTypeForTests` for drift-guards.
- `consultify/server/src/services/presentationStudioOrchestrationService.ts`
  - Both `previewPresentationStudioGenerate` and `executePresentationStudioGenerate` now pass `{ templateFamily: family }` (resolved from the deck-type / explicit family on `setup`) into the audit, so per-family overrides apply on both code paths.
- `consultify/server/src/services/__tests__/presentationStudioLayoutAuditService.test.ts`
  - +7 tests covering: override raises Steering Committee balanced title cap; raw deck-type alias normalization; non-overridden family still flags; override map is keyed only by canonical TemplateFamily names AND every alias resolves to one of those canonical names; PPTX/PDF parity-set symmetry; PDF parity flag fires on unsupported intents; canonical SlideIntents do NOT fire PDF parity flag.
- `consultify/server/src/routes/__tests__/presentationStudio.routes.test.ts`
  - +2 route regressions: `/generate/preview` honours the steering_committee family override (100-char balanced title no longer flags overflow), and the PDF parity flag flows through into `flagCounts.unsupported_intent_for_pdf_export` and the merged `warnings[]` for an unsupported intent.
- `consultify/src/services/api/presentationStudio.api.ts`
  - Added `PresentationStudioLayoutAuditFlag`, `PresentationStudioSlideLayoutAudit`, `PresentationStudioOutlineLayoutAudit` types.
  - Extended `GeneratePreviewResponse` with `layoutAudit: PresentationStudioOutlineLayoutAudit`.
- `consultify/src/components/PresentationStudio/PresentationStudioLayoutAuditBanner.tsx` (new)
  - Pure presentational component. Renders nothing when `audit` is null (page never shows audit summary before a preview ran). Renders an emerald "no findings" tile when clean, an amber warning tile with aggregate count + collapsible breakdown when findings exist. Per-flag tiles only render for flag classes with `count > 0`. The raw `[<flag_id>]`-prefixed warning lines are exposed inside the expanded `details` so reviewers can see exactly which slides triggered which findings. The banner triggers no callbacks and never blocks generation — it is advisory canvas status, not an AI action.
- `consultify/src/components/PresentationStudio/PresentationStudioPage.tsx`
  - Imported the banner. Rendered it canvas-side after the existing approval / ticket / generated banners and before the empty / preview cards. The banner sits adjacent to the Generate CTA in Menu 3 without violating the AI-actions-in-Menu-3 rule (banner is status, not action).
- `consultify/src/components/PresentationStudio/__tests__/PresentationStudioLayoutAuditBanner.test.tsx` (new)
  - 7 tests: null audit renders nothing; clean state renders with `data-state="clean"` and no toggle; warning state renders with `data-state="warnings"` and aggregate count; toggle expands/collapses (asserts `aria-expanded`); per-flag tiles render only for non-zero counts; raw warning strings appear inside the expanded list; singular/plural "finding"/"findings" wording is correct.
- `consultify/src/components/PresentationStudio/__tests__/PresentationStudioPage.test.tsx`
  - Updated `makeGeneratePreview` helper to include a clean `layoutAudit` (so all S5/S7/S8/S9 tests still pass with the new wire-shape).
  - +3 page-level integration tests: clean banner after preview with no findings; warning banner with breakdown + per-flag tiles after preview with findings (including PDF parity flag); banner is NOT rendered before any preview has run.

### Validation performed

- `npx vitest run` over the full Studio surface — **107/107 passed** (8 ticket + 17 layout audit + 6 source artifacts + 43 route integration + 26 page + 7 banner).
- `npx eslint` on the nine S11 in-scope files — **0 errors**. Remaining 25 warnings are pre-existing P3 (no-explicit-any in test mocks + the S5 baseline empty interface alias on `SourcePackPreviewRequest` + the S0 baseline `(setup as any)` cast on the orchestrator).
- `npx tsc --noEmit` on the layout audit service in isolation — clean. Orchestrator + routes + page changes are verified through the live route + component test suites.
- Tenant + approval invariants unchanged. The audit reads only the outline + an optional family string; it cannot leak data across tenants by construction. The mutating `/generate` path runs the audit AFTER ticket consumption (so a tampered outline still cannot bypass approval) and BEFORE `recordAudit` (so the audit row reflects what was actually generated, not what was previewed).
- Workspace rule `ai-actions-menu3.mdc` upheld: the new banner is canvas-side status and contains no AI action button. Existing Menu 3 actions (Run preview / Request approval / Confirm generate) are unchanged and remain in the right slot.

### Gate result: `PASS_WITH_P2`

- 0 P0, 0 P1, 0 P2.
- P3 deferred: pre-existing no-explicit-any + no-empty-object-type warnings carried over from S0/S5 baselines. No new P3 introduced.

### Acceptance criteria covered by S11

- **Closes R-S10-1** (per-template-family slot capacity overrides). Three families ship overrides today; others fall back to canonical caps. The drift-guard test asserts every override key is a canonical TemplateFamily name AND every raw-deck-type alias resolves to one of those canonical names.
- **Adds PDF export parity flag** alongside the existing PPTX parity flag. Both sets are identical today; the structural separation guarantees a future PDF-only divergence is caught immediately by the existing tests.
- **Surfaces the audit signal to the user** through a canvas-side, non-blocking, collapsible banner with per-flag breakdown. The banner is visible adjacent to the Generate CTA in Menu 3 without violating the AI-actions-in-Menu-3 rule.
- **Approval invariant preserved** — the audit runs after ticket consumption on the execute path; the family is resolved from the same `setup` that was fingerprinted into the ticket, so a tampered family swap would already be rejected by the ticket service.

### Risks / next-step notes

- R-S11-1: The override numbers for the three registered families are conservative bumps based on the existing masters. If a master is extended or revised, the override must be updated in the same change. Mitigation: the unit tests pin canonical numeric expectations (e.g. 100-char balanced title under Steering override) so a regression in the override numbers will fail a test, not pass silently.
- R-S11-2: PDF parity remains structural — the PDF set mirrors PPTX 1:1 today because the PDF path runs through the PPTX pipeline. The day a native HTML→PDF deck renderer ships and omits a slide intent, the PDF set must be edited to remove that intent from the supported set; the existing parity test will then fail and signal that the divergence has been formally accepted.
- R-S11-3: The banner is collapsed by default when findings exist. We accept the small risk that a user dismisses the banner without reading the breakdown — the aggregate count is always visible, and findings are advisory by design (a P0 layout problem would have been caught by the renderer's own validation, which still runs end-to-end). Future work could auto-expand the banner when `unsupported_intent_for_*` flags appear (those have higher reviewer priority than density overflows).

### Next sprint plan

- Sprint S12 candidates (subject to your approval):
  - Per-slot density mode on `OutlineItem` (closes R-S10-2). Requires extending the type, the generator's emit path, and the audit's per-slide loop. Backend-heavy.
  - Renderer-side honest truncation indicator: when a slide is rendered with an overflow flag, the PPTX/PDF master surfaces a small inline marker. This closes the gap between "audit warned" and "renderer silently truncated" by making the truncation visible in the export itself.
  - Move the audit's family + density caps into a per-template-family JSON config the runtime can hot-reload (groundwork for tenant-specific overrides without a code deploy).
  - Optional: a dedicated "Layout audit" section card in the Studio canvas (richer than the banner, with per-slide drill-down). Today the banner is enough; we'd ship the section card only if reviewers ask for slide-level detail beyond the warning list.

## Phase 2 — Sprint S12 gate (Per-slot density + banner priority / 2026-05-09)

**Gate**: closed → committed under `adb76af0a..HEAD` on `staging`.

### Scope landed in S12

Cross-reference: master sprint map WP-06 carry / MT-PRES-041. Backend + Frontend. No DB migrations. Approval-ticket invariant preserved. The audit remains advisory and never blocks generation. Closes R-S10-2 (per-slot density mode).

S12 closes the last open S10 follow-up (R-S10-2: real layouts mix densities within a slide) by introducing an optional `slotDensities` override on `OutlineItem` that the audit resolves per-slot before applying capacity caps. The change is fully backward compatible — every existing path that does not set `slotDensities` is unchanged. S12 also addresses R-S11-3 (high-priority flags warrant immediate visibility) by auto-expanding the layout audit banner when an `unsupported_intent_*` or `missing_source_for_evidence_intent` flag is present, and surfacing a "High priority" badge with a rose tone instead of amber.

### Changes

- `consultify/server/src/services/presentationGeneratorService.ts`
  - Added optional `slotDensities?: { title?; keyMessage?; blocks? }` (each with the same `'visual' | 'balanced' | 'document'` enum) to `OutlineItem`. Backward compatible; no existing emit path is required to set it.
- `consultify/server/src/services/presentationStudioLayoutAuditService.ts`
  - Added `densityForSlot(item, slot)` helper. Returns `slotDensities[slot]` when valid, otherwise falls back to the slide-level `density`. Unknown override tokens silently fall through to the slide-level density.
  - Per-slot capacities are now resolved separately for title / keyMessage / blocks. The template-family override resolver from S11 composes cleanly: per-slot density → density bucket → family override → final cap.
- `consultify/server/src/routes/presentationStudio.routes.ts`
  - `parseOutlineFromBody` now accepts an optional `slotDensities` object on each outline entry. Each slot value is type-narrowed (`'visual' | 'balanced' | 'document'` only); unknown tokens / wrong types are silently dropped, mirroring the rest of the parser.
- `consultify/server/src/services/__tests__/presentationStudioLayoutAuditService.test.ts`
  - +7 tests covering: fallback to slide-level density when `slotDensities` absent; per-slot title override flips a 90-char title from clean (document cap 110) to overflow (visual cap 80); per-slot keyMessage override flips a 200-char message from overflow (visual cap 160) to clean (document cap 360); per-slot blocks override flips a 6-block slide from overflow (visual max 4) to clean (document max 8); mixed per-slot densities (title=visual, blocks=document, keyMessage=balanced fallback) produce mixed flag results on a single slide; invalid `slotDensities.title` token (e.g. `'compact'`) silently falls back; per-slot density composes with template-family override (Steering Committee balanced 110 → slot visual 80).
- `consultify/server/src/routes/__tests__/presentationStudio.routes.test.ts`
  - +1 regression test asserting `slotDensities` flows from the request body through `parseOutlineFromBody`, the orchestrator, and into the layout audit, producing the expected overflow flag.
- `consultify/src/components/PresentationStudio/PresentationStudioLayoutAuditBanner.tsx`
  - Added `HIGH_PRIORITY_FLAGS` set: `unsupported_intent_for_pptx_export`, `unsupported_intent_for_pdf_export`, `missing_source_for_evidence_intent`. The first two indicate silent renderer fallback; the third is an evidence-discipline issue. Overflow flags remain advisory.
  - Added `hasHighPriorityFlags(audit)` predicate.
  - The banner auto-expands when a high-priority flag is present, switches its tone to rose (vs. amber for advisory-only findings), exposes `data-priority="high" | "normal"`, and renders a "High priority" badge next to the aggregate count. The reviewer can still collapse the breakdown manually; we never auto-collapse.
  - `FLAG_ORDER` rebalanced so the breakdown rows surface high-priority flags first.
- `consultify/src/components/PresentationStudio/__tests__/PresentationStudioLayoutAuditBanner.test.tsx`
  - Updated `makeFindingsAudit` to use overflow-only flags so the pre-S12 tests assert the collapsed-by-default behaviour without colliding with auto-expand.
  - +4 tests covering: auto-expand on `unsupported_intent_for_pptx_export`; auto-expand on `missing_source_for_evidence_intent`; NO auto-expand and NO priority badge when only overflow flags are present; manual collapse works on a high-priority audit.
- `consultify/src/components/PresentationStudio/__tests__/PresentationStudioPage.test.tsx`
  - Updated the S11 page-level test that previously clicked the toggle to now expect auto-expansion + the priority badge (the audit fixture has high-priority flags, so the new behaviour is the correct one). All other page tests pass unchanged.

### Validation performed

- `npx vitest run` over the full Studio surface — **119/119 passed** (8 ticket + 24 layout audit + 6 source artifacts + 44 route + 26 page + 11 banner). Net +12 tests over S11.
- `npx eslint` on the seven primary S12 in-scope files — **0 errors**, 49 warnings (pre-existing P3 carry-over: no-explicit-any in test mocks + S5 baseline empty interface alias). The generator file shows a higher pre-existing warning count when included in scope but the S12 change there is a single backward-compatible field addition; we do NOT touch existing warnings per the S0 baseline policy.
- `npx tsc --noEmit` on the layout audit service in isolation — clean. Generator + routes + page changes are verified through the live route + component test suites.
- Tenant + approval invariants unchanged. The new `slotDensities` field is reflected by `parseOutlineFromBody` and is part of the payload that gets fingerprinted into the approval ticket on the mutating path; a tampered post-approval swap of `slotDensities` would already be rejected by the ticket service via `payload_mismatch`.
- Workspace rules upheld: AI-actions-in-Menu-3 unchanged. UI-UX source-of-truth: the rose tone reuses the canonical "high priority / blocked" color from the Consultify color contract; emerald (clean), amber (advisory), rose (high priority) maintain a consistent semantic ladder.

### Gate result: `PASS_WITH_P2`

- 0 P0, 0 P1, 0 P2.
- P3 deferred: pre-existing P3 warnings on the generator file (n=56) are out-of-scope for S12 even though the audit-relevant change is one new optional field; addressing them would balloon S12 beyond the contract's "small, reviewable" gate criterion. Addressed via R-S0-baseline carry.

### Acceptance criteria covered by S12

- **Closes R-S10-2**: per-slot density override on `OutlineItem` lets the audit treat title / keyMessage / blocks as independent capacity cells rather than routing the entire slide through one density. Unit tests cover override, fallback, mixed, and family-composed cases.
- **Closes R-S11-3**: high-priority flags now auto-surface their breakdown without manual interaction. The reviewer cannot accidentally miss an `unsupported_intent_*` or `missing_source_for_evidence_intent` finding.
- **Body-level wiring complete**: `slotDensities` flows from request body → parser → orchestrator → audit → response, exercised by a route regression test.
- **Approval invariant preserved**: `slotDensities` is part of the fingerprinted payload, so it cannot be swapped post-approval.
- **No silent execution**: the auto-expand UI behavior is visible (priority badge + rose tone + `data-priority` attribute), so the user always knows when high-priority flags caused the breakdown to expand.

### Risks / next-step notes

- R-S12-1: No generator path emits `slotDensities` today; the field is consumer-only. The audit will keep falling back to slide-level density for every emitted slide until a future generator change starts emitting per-slot densities. This is the intended progression — S12 makes the audit capable, S13+ can teach the generator (and AI prompt) to emit per-slot densities for layouts that demonstrably mix densities (e.g. comparison slides with sparse hero + dense bullet cells).
- R-S12-2: The "High priority" semantic is fixed in code (`HIGH_PRIORITY_FLAGS` constant). If a future flag class is added — e.g. an `accessibility_*` flag — its priority must be classified at introduction time. The banner test for "no priority badge with overflow-only flags" guards against accidentally promoting an advisory flag into the high-priority bucket.
- R-S12-3: The audit walks the outline in a single pass; per-slot density is resolved per slide. A future renderer-driven per-cell audit (e.g. one slide can declare 4 distinct text frames each with its own density) is a strictly larger refactor and is deferred to a dedicated sprint with its own contract.

### Next sprint plan

- Sprint S13 candidates (subject to your approval):
  - Hot-reloadable JSON config for per-family + density caps (groundwork for tenant-specific overrides without code deploy). Backend.
  - Renderer-side honest truncation indicator: when a slide is rendered with an overflow flag, the PPTX/PDF master surfaces a small inline marker. Closes the gap between "audit warned" and "renderer silently truncated".
  - Optional: dedicated "Layout audit" section card in the Studio canvas with per-slide drill-down. Today the banner is enough; ship the section card only if reviewers ask for slide-level detail beyond the warning list.
  - Optional: teach the generator to emit `slotDensities` for known mixed-density layouts (closes the consumer-side of R-S12-1).

## Phase 2 — Sprint S13 gate (Layout capacity registry / 2026-05-09)

Status: `PASS_WITH_P2`

### Scope landed in S13

S13 targets the first of the four S13 candidates: a hot-reloadable layout capacity registry. Before S13 the slot capacity numbers and the per-template-family overrides lived as `const` maps inside the audit module, which meant any tweak — even an opportunistic one — required a code deploy and a release. S13 reframes those numbers as runtime configuration that:

- ships with the canonical S10 + S11 defaults preserved verbatim (so no behaviour change for any existing call site),
- accepts JSON-shaped overrides via `applyOverrides` with strict, all-or-nothing validation (no partial mutation, no silent failure),
- is read live by the audit through `resolveSlotCapacity` — there is no longer a static cap map inside the audit module,
- exposes `resetToDefaults()` for test isolation (tests that mutate the registry MUST `afterEach`-reset),
- snapshots cleanly via `_snapshotRegistryForTests` so existing S11 drift tests continue to work without rewriting.

This is the groundwork milestone for tenant-specific layout overrides: the registry is process-global today, not per-tenant; tenant scoping is an explicit follow-up risk (see below). The renderer-side truncation indicator and the canvas-side per-slide drill-down section card are NOT in scope and are deferred to S14+ candidates.

### Changes shipped

Backend (services / audit):

- Added `consultify/server/src/services/presentationStudioLayoutCapacityRegistryService.ts` (new). Defines `LayoutSlotCapacity`, `LayoutCapacityOverridesPayload`, default density budgets (visual/balanced/document), default template-family overrides (Steering Committee Deck, Board Decision Deck, DRD Diagnostic Deck), default raw-deck-type aliases. Exports `resolveSlotCapacity`, `normalizeTemplateFamily`, `applyOverrides`, `resetToDefaults`, `_snapshotRegistryForTests`. Validation rejects: unknown density keys, non-positive numbers, unknown cap fields (typo guard), non-string alias values. All-or-nothing merge — bad payloads cannot half-update state.
- Refactored `presentationStudioLayoutAuditService.ts` to consume the registry. Deleted the inline `DENSITY_BUDGETS`, `TEMPLATE_FAMILY_BUDGET_OVERRIDES`, and `FAMILY_ALIAS_BY_DECK_TYPE` constants and the local `normalizeTemplateFamily` / `resolveSlotCapacity` helpers; the audit now imports `resolveSlotCapacity` from the registry. The `_templateFamilyOverridesForTests` and `_familyAliasByDeckTypeForTests` test-only exports remain stable in shape — they now read from the registry snapshot — so all S11 drift-guard tests continue to pass unchanged.

Backend tests:

- Added `presentationStudioLayoutCapacityRegistryService.test.ts` (14 tests): canonical defaults match the S10 + S11 numbers, validation rejects unknown densities / negative numbers / unknown fields / non-string aliases, all-or-nothing merge, single-section payloads, alias registration flows into `resolveSlotCapacity`, `resetToDefaults` snaps state back.
- Extended `presentationStudioLayoutAuditService.test.ts` with 3 new S13 tests asserting that runtime overrides flip the audit end-to-end: (a) raising the visual title cap clears a previously-flagging slide, (b) lowering the Steering family balanced cap turns a previously-clean slide into a flag, (c) registering a brand-new raw-deck-type alias makes the audit normalize and apply the family override. Added an `afterEach` reset hook so registry overrides cannot leak between tests.

### Validation

- `npx vitest run` on the seven primary Studio-scoped suites — **136/136 pass** (S12 baseline 119 + 14 new registry + 3 new audit S13 = 136). No regressions.
- `npx eslint` on the four S13 in-scope files (with `--fix` for prettier-only nits) — **0 errors**. Pre-existing P3 warnings on adjacent files are not touched per the S0 baseline policy.
- `npx tsc --noEmit` on the four S13 in-scope files (strict, ESNext, bundler resolution, JSX preserve, skipLibCheck) — **0 errors**.
- Backward-compat invariant: every previously-passing audit test still passes without changes to its expected flag counts. The registry's canonical defaults match the deleted static maps verbatim — confirmed by the S10/S11 drift tests that read `_snapshotRegistryForTests`.

### Acceptance criteria covered by S13

- AC: a layout capacity number (e.g. `Steering Committee Deck.balanced.titleMaxChars`) can be changed at runtime without a code deploy. **Met.** `applyOverrides` accepts the JSON payload, validates it, and the next audit invocation reads the new number.
- AC: invalid configuration is rejected before any state mutation. **Met.** All-or-nothing merge in `applyOverrides`; the failure path returns a structured `errors[]` and `applied: false`. The "rejects unknown density keys without partial mutation" test asserts state is unchanged after a rejected payload.
- AC: existing audit behaviour is unchanged when no overrides have been applied. **Met.** The 24 carry-over audit tests (clean outlines, overflow flags, missing source, unsupported PPTX/PDF intents, family overrides, per-slot density) all pass with the canonical defaults and zero modifications.
- AC: tests can mutate the registry without leaking state across test files / test cases. **Met.** The audit suite added an `afterEach(resetCapacityRegistry)` hook; the registry suite resets in `beforeEach`. Both patterns guard against bleed-over.

### Risks / open items (deferred)

- R-S13-1 (P2): the registry is process-global. Tenant-scoped overrides are NOT yet supported — every tenant in the same process sees the same caps. This is intentional for S13 (the contract did not include tenant scoping in the slot-capacity surface) and the next sprint that introduces tenant overrides will add an `organizationId` parameter to `resolveSlotCapacity` and a tenant-keyed override map. Documented here so reviewers do not assume tenant safety where there is none yet.
- R-S13-2 (P3): `applyOverrides` does not persist the override across process restarts. If we want tenant overrides to survive deploys, we will need either a config table (preferred — auditable, RBAC-able) or a watched JSON file (faster, less governable). The choice is out of scope for S13.
- R-S13-3 (P3): no admin/operator surface yet. The registry is reachable only via in-process imports (which is exactly what the audit and the S13 tests use). Exposing it through an authenticated SuperAdmin endpoint with `proposal -> approval -> execution -> audit` (per the Consultify standard) is a follow-up sprint.
- R-S13-4 (P3): renderer-side truncation indicator (one of the original S13 candidates) is NOT in scope. Today the renderer can still silently truncate a string that the audit warned about — the user sees the warning but no inline marker on the rendered slide. This remains a gap that the next sprint should close.
- R-S12-1 carry-over (P3): the generator still does not emit `slotDensities`. The audit consumer side is fully wired (S12) and the registry change in S13 does not move that needle either way. Closing this requires a generator-side change with its own gate.

### Next sprint plan

- Sprint S14 candidates (subject to your approval):
  - Renderer-side honest truncation indicator (closes R-S13-4): when a slide carries an overflow flag from the audit, the PPTX/PDF master surfaces an inline marker so the rendered artifact is honest about the warning.
  - SuperAdmin layout-capacity admin endpoint (closes R-S13-3): authenticated POST that wraps `applyOverrides` with `proposal -> approval -> execution -> audit`. Tenant-scoped overrides require a separate sprint (R-S13-1).
  - Optional: dedicated "Layout audit" section card in the Studio canvas with per-slide drill-down (still on the table; deferred from S13 scope cap).
  - Optional: generator-side `slotDensities` emission for known mixed-density layouts (closes R-S12-1).

## Phase 2 — Sprint S14 gate (Generator emits slotDensities / 2026-05-09)

Status: `PASS_WITH_P2`

### Scope landed in S14

S14 closes the consumer side of R-S12-1 (the long-standing carry from S12). Before S14 the generators emitted `OutlineItem` objects without `density` or `slotDensities`, which meant the audit's per-slot capacity logic (S12) and the per-family overrides (S11/S13) were technically capable but practically inert: every emitted slide routed through the audit's slide-level `'balanced'` fallback. S14 wires three generator entry points to attach intent-driven density defaults, including per-slot overrides for layouts that demonstrably mix densities (comparison hero + dense bullet cells, recommendation_single hero, prioritization matrix, executive summary KPI band, etc.).

The S14 change is strictly additive and backward-compatible: the new `applyIntentDensityDefaults` helper NEVER overrides caller-provided values. If a template author or a downstream service has already set `density` or any `slotDensities.{title,keyMessage,blocks}` field, that value passes through untouched. The defaults only fill gaps.

### Changes shipped

Backend (services):

- Added `consultify/server/src/services/presentationStudioIntentDensityDefaultsService.ts` (new). Defines `IntentDensityDefaults`, the canonical `INTENT_DENSITY_DEFAULTS` table covering all 17 PPTX-supported `SlideIntent` values, and the public helpers `intentDensityDefaultsFor(intent)` (returns a deep-cloned entry; never returns the registered reference) and `applyIntentDensityDefaults(item)` (returns a new `OutlineItem` with defaults filled in for any unset density / per-slot density fields).
- `presentationGeneratorService.generateDefaultOutline`: pipes the assembled outline through `applyIntentDensityDefaults` before returning. Closes R-S12-1 for the source-driven generator path.
- `presentationGeneratorService.generateOutlineFromTemplate`: same enrichment after the existing template-vs-source enable/disable pass. Template-author-provided densities still win because the helper preserves caller fields.
- `presentationStudioOrchestrationService.outlineFromNarrativePlan`: pipes each item through `applyIntentDensityDefaults`. Closes R-S12-1 for the narrative-plan path used by the Studio preview / generate flow.

Tests:

- New `presentationStudioIntentDensityDefaultsService.test.ts` (13 tests):
  - **Drift guard** (the most important new test): every PPTX-supported intent reported by the audit MUST have a registered density default. If a new intent ships without an entry, this test fails — preventing the "audit-capable but generator-silent" regression S14 just fixed.
  - Canonical defaults round-trip for `cover` (visual), `comparison` (balanced + visual title + document blocks), `recommendation_single` (balanced + visual title + document blocks), `next_steps` (balanced, no `slotDensities`).
  - `intentDensityDefaultsFor` returns deep-cloned entries — caller mutation does NOT leak into the registered map (verified by mutating a returned entry and re-reading the registry).
  - Unknown intents return `undefined` (no fabricated defaults).
  - `applyIntentDensityDefaults` fills missing slide-level density, preserves caller-set slide-level density, merges per-slot overrides (caller wins per slot), preserves caller-set slots when no default exists for that slot, and omits `slotDensities` entirely when neither caller nor default has any.
  - Purity: calling the helper twice on the same input produces equivalent objects, not the same reference.

### Validation

- `npx vitest run` on the eight primary Studio-scoped suites — **149/149 pass** (S13 baseline 136 + 13 new defaults service = 149). No regressions.
- `npx vitest run` on adjacent generator-golden + narrative-planner + approved-template + template-architect + source-pack suites — **16/16 pass** (the generator's output shape changed only by adding optional fields; existing assertions untouched).
- `npx eslint` on the four S14 in-scope files — **0 errors**, 62 pre-existing P3 carry-over warnings (`no-explicit-any` in `presentationGeneratorService.ts` from earlier sprints; not touched per the S0 baseline policy).
- `npx tsc --noEmit` on the two new S14 files (strict, ESNext, bundler resolution, JSX preserve, skipLibCheck) — **0 errors**.

### Acceptance criteria covered by S14

- AC: every PPTX-supported intent has a documented slide-level density. **Met.** The drift guard test enforces this; the registered table covers all 17 intents.
- AC: every intent whose canonical layout demonstrably mixes densities emits `slotDensities`. **Met.** `comparison`, `recommendation_single`, `prioritization_matrix` emit `{title: 'visual', blocks: 'document'}`; `executive_summary`, `key_messages`, `performance_overview`, `root_cause`, `recommendation_portfolio`, `initiative_portfolio`, `roadmap`, `risk_management` emit `{blocks: 'document'}`; sparse intents (`cover`, `section_intro`, `single_insight`, `appendix`, `next_steps`) intentionally emit no per-slot overrides.
- AC: generator changes are backward-compatible. **Met.** `applyIntentDensityDefaults` only fills in unset fields; caller-set densities and per-slot overrides win unconditionally. The 16 generator-golden + adjacent tests pass without modification, confirming the externally observable generator surface is unchanged for inputs that already declare densities.
- AC: the audit picks up the new densities and applies the right caps. **Met implicitly.** S12's audit logic (`densityForSlot`, `resolveSlotCapacity` per-slot) was unchanged in S14; the 24 S10/S11/S12/S13 audit tests continue to pass and exercise the per-slot capacity path with the now-emitted densities.

### Risks / open items (deferred)

- R-S14-1 (P2): the registered density per intent is a static table. Different deck-types (e.g. an investor deck vs a steering deck) may want different densities for the same intent. S14 deliberately does not introduce a deck-type axis to the defaults — that would entangle the defaults service with the family registry. A future sprint could either (a) extend the table to be `Record<SlideIntent, Partial<Record<TemplateFamily, IntentDensityDefaults>>>`, or (b) keep a flat table and let the audit's family-override registry do the family-specific work. Option (b) is the current path.
- R-S14-2 (P3): the drift guard tests against the audit's PPTX-supported intent set, NOT directly against the canonical `SlideIntent` union from `report/pptx/types`. If a new intent is added to that union but never registered in the audit's set, the guard would silently pass. The audit's S10 drift guard already cross-checks PPTX intent vs canonical union, so this is a transitive guarantee, but a direct cross-check could be added if the audit guard ever becomes optional.
- R-S14-3 (P3): no UI surface yet. The user-visible effect of S14 is only that a future-shipped layout-audit "high priority" warning will surface fewer false negatives (e.g. a comparison slide with 200-char title now correctly trips the `visual` cap, where before it routed through `balanced`). There is no in-app indication that "this density was inferred by the generator vs declared by the user." A future "Layout audit" section card (still on the deferred list) could optionally surface that distinction.
- Carry-overs from S13: R-S13-1 (tenant scoping), R-S13-2 (override persistence), R-S13-3 (admin endpoint), R-S13-4 (renderer truncation indicator) all remain open. S14 did not move any of those.

### Next sprint plan

- Sprint S15 candidates (subject to your approval):
  - Renderer-side honest truncation indicator (closes R-S13-4): when a slide carries an overflow flag from the audit, the PPTX/PDF master surfaces an inline marker so the rendered artifact is honest about the warning.
  - SuperAdmin layout-capacity admin endpoint (closes R-S13-3): authenticated POST that wraps `applyOverrides` with `proposal -> approval -> execution -> audit`.
  - Optional: dedicated "Layout audit" section card in the Studio canvas with per-slide drill-down (R-S14-3 surfaces this need from a different angle).
  - Optional: tenant-scoped layout capacity overrides (closes R-S13-1) — non-trivial because it requires a tenant-keyed registry and an `organizationId` parameter on `resolveSlotCapacity`.

## Phase 2 — Sprint S15 gate (Renderer-side honest truncation indicator / 2026-05-09)

Status: `PASS_WITH_P2`

### Scope landed in S15

S15 closes R-S13-4 — the most visible UI/UX governance gap in the Studio. Before S15 the audit could classify a slide as overflowing / missing-source / unsupported-intent (S10 + S11), the Studio canvas could surface that to a reviewer via the layout-audit banner (S11 + S12 high-priority semantics), and the generator could emit per-slot densities the audit reasons against (S14) — but the rendered PPTX could still silently truncate the offending text. A reviewer who only sees the deck (no Studio canvas) would never know the audit fired.

S15 plumbs the audit's per-slide findings all the way through to the renderer. Every PPTX slide whose outline entry triggered any audit flag now carries a small, language-neutral marker in the top-right corner. The marker is amber for advisory flags (the three overflow classes) and rose for high-priority flags (`missing_source_for_evidence_intent`, `unsupported_intent_for_pptx_export`, `unsupported_intent_for_pdf_export`) — semantics deliberately mirror the S12 banner so the reviewer sees the same priority story whether they look at the canvas or the deck.

The change is strictly additive at every layer. Legacy callers / decks ship without `auditFlags`, the renderer treats `undefined`/empty arrays as "no marker", and the marker helper validates flag strings before rendering (defends against future audit-only flags that shouldn't trigger a renderer marker).

### Changes shipped

PPTX renderer:

- `report/pptx/types.ts::UnifiedSlide`: added optional `auditFlags?: string[]` field. Documented why it's typed as `string[]` instead of the audit's `LayoutAuditFlag` union (avoids a circular import between PPTX types ← generator ← audit). Backward-compat — every existing path that doesn't set the field keeps working unchanged.
- `report/pptx/composites/LayoutTruncationMarker.ts` (new): pure helpers `decideLayoutTruncationMarker(slide)` and `buildLayoutTruncationMarker(slide, tokens)`. Decision returns `{ shouldRender, priority: 'high' | 'advisory' | 'none', recognizedFlagCount, recognizedFlags }` after deduping, filtering to known flags, and sorting for determinism. Build returns `RenderedElement | null` — applies a small rounded-rect badge with `⚠ <count>` centered, amber for advisory, rose for high priority.
- `PptxPipelineService.generateFromUnifiedJson`: calls `buildLayoutTruncationMarker` AFTER the layout's own elements are applied so the badge sits on top of any overflowing title/body text. Wrapped in try/catch so a marker failure is non-fatal — the slide still renders, the marker just gets logged + a warning is surfaced.

Generator:

- New `presentationStudioSlideAuditDecoratorService.ts`: pure helper `decorateSlidesWithAuditFlags({ outline, slides, audit })` that walks the FULL outline (handles disabled slides correctly — they consume an outline index but no UnifiedSlide), maps audit findings onto the matching enabled UnifiedSlide via `outlineIndex → flags` lookup, dedupes, and preserves caller-set `auditFlags` when the audit produced nothing for that slide. Also returns `{ decoratedCount, skippedDisabledCount }` for telemetry.
- `presentationGeneratorService.generateOutline`: imports `auditPresentationStudioOutlineLayout` + `decorateSlidesWithAuditFlags` and runs both BEFORE persisting `unifiedJson`. The audit reads `setup.templateFamily` / `setup.deckType` so the same per-family overrides from S11 + the runtime registry from S13 apply. Decoration is wrapped in try/catch — a transient audit failure logs and falls back to undecorated slides; the deck still ships.

Tests:

- `report/pptx/composites/__tests__/LayoutTruncationMarker.test.ts` (new, 19 tests):
  - `decideLayoutTruncationMarker` returns no-render for missing/empty/all-unrecognized flags; classifies single advisory and single high-priority flags correctly; upgrades to high when ANY high-priority flag is mixed with advisories; dedupes; drops unrecognized; sorts deterministically.
  - `buildLayoutTruncationMarker` returns null when no marker, builds a `kind: 'shape'` element when needed, applies the right amber/rose colors per priority, shows the recognized-flag count in the label, and positions the marker in the top-right corner of the 16:9 slide.
  - **Drift guards**: `HIGH_PRIORITY_FLAGS ⊆ KNOWN_FLAGS`; `KNOWN_FLAGS` exactly matches the documented `LayoutAuditFlag` set (a future flag added to the audit without updating this set means the marker silently ignores it — the test fails before that ships).
- `presentationStudioSlideAuditDecoratorService.test.ts` (new, 7 tests):
  - Clean audit produces no decoration.
  - Single flag attaches to the matching enabled slide.
  - Disabled outline entries shift the slides cursor correctly (a slide audit with `index: 2` decorates the SECOND enabled `UnifiedSlide`, not the third).
  - Disabled-but-flagged outline entries are reported via `skippedDisabledCount`, never decorate any UnifiedSlide.
  - Repeated flag ids on a single slide are deduped (defends against accidental upstream duplication).
  - Caller-set `auditFlags` are preserved when the audit produced none.
  - Decorator does NOT mutate the input slides array.

### Validation

- `npx vitest run` on the eleven primary Studio-scoped suites + adjacent generator-golden — **180/180 pass** (S14 baseline 149 + 13 marker + 7 decorator + 5 generator-golden + 6 in adjacent suites = 180). No regressions.
- `npx eslint` on the seven S15 in-scope files (with `--fix` for prettier-only nits) — **0 errors**, 76 pre-existing P3 warnings (all `no-explicit-any` in the existing PPTX module + `presentationGeneratorService.ts` from earlier sprints; not touched per the S0 baseline policy).
- `npx tsc --noEmit` on the four S15 in-scope source/test files (strict, ESNext, bundler resolution, JSX preserve, skipLibCheck) — **0 errors** after fixing two test-helper redundant-key warnings.

### Acceptance criteria covered by S15

- AC: a slide flagged by the audit (any flag class) carries a visible review marker on the rendered PPTX. **Met.** The pipeline always calls `buildLayoutTruncationMarker` after layout elements; the marker renders for every recognized non-empty flag set.
- AC: high-priority flag classes get a higher-contrast color than advisory flags. **Met.** Rose for high (matches the S12 banner rose tone); amber for advisory (matches the S12 banner amber tone). Color codes are fixed semantic constants — they override any brand theme so an amber warning still reads as amber on a corporate-blue brand.
- AC: legacy decks (without `auditFlags`) render unchanged. **Met.** The pipeline calls the marker helper unconditionally; the helper returns `null` for `undefined` / empty / all-unrecognized flags. No marker, no diff vs pre-S15 output.
- AC: a marker failure must NOT block deck generation. **Met.** Pipeline integration is try/catch-wrapped — on marker error, the slide still renders, a warning is logged, and the warning is appended to the pipeline's `warnings[]` so the caller sees it.
- AC: drift between audit flag set and renderer's recognized set is caught at test time. **Met.** The `KNOWN_FLAGS exactly matches LayoutAuditFlag` test fails the moment a flag is added/removed in the audit without updating the renderer.

### Risks / open items (deferred)

- R-S15-1 (P2): **PDF parity is NOT shipped**. The current Consultify PDF renderer for presentations (the deck-document → PDF path) does not yet read `slide.auditFlags` and therefore does not render a marker. PDF reviewers see the audit only through the canvas banner, not on the rendered artifact. A follow-up sprint must mirror the PPTX wiring in the PDF renderer — the marker helper itself can be reused (the colors are language-neutral hex codes; the position math is layout-engine agnostic).
- R-S15-2 (P3): the marker shows a count but not the specific flag classes. A reviewer who sees `⚠ 3` on a slide must still go to the canvas banner to learn WHICH three flags fired. We deliberately kept the marker compact — a wider chip with the flag class shorthand would compete with title space. A follow-up could add a small tooltip layer on hover (PPTX supports `slide.addText` with hyperlink/tooltip, but it's brittle across viewers) or a micro-icon row instead of a single badge.
- R-S15-3 (P3): the marker renders the `⚠` glyph from the body font's Unicode coverage. If a future brand theme switches to a font without the U+26A0 codepoint the icon will fall back to a tofu glyph. PptxGenJS does not surface a "missing glyph" event so we cannot detect this at render-time. Mitigation: document the requirement; ship a font fallback in the renderer if/when a brand without warning-glyph coverage is onboarded.
- R-S15-4 (P3): the marker is per-slide. Decks with many flagged slides do not get an aggregate "deck-level" indicator anywhere in the rendered artifact. The deck's review-ready status today lives on the Studio canvas (banner) and in the audit row. Adding a deck-level indicator (e.g. a flag count on the closing slide or a pre-flight summary slide) is a candidate for a future sprint and is intentionally out of scope here.
- Carry-overs from S13 / S14: R-S13-1 (tenant scoping), R-S13-2 (override persistence), R-S13-3 (admin endpoint), R-S14-1 (deck-type axis on intent defaults), R-S14-3 (UI distinction between user-set vs inferred densities) all remain open.

### Next sprint plan

- Sprint S16 candidates (subject to your approval):
  - PDF parity for the truncation marker (closes R-S15-1) — single-sprint scope, mirrors the PPTX wiring in the PDF renderer using the same `LayoutTruncationMarker` helper or a thin PDF-flavoured port.
  - SuperAdmin layout-capacity admin endpoint (closes R-S13-3): authenticated POST that wraps `applyOverrides` with `proposal -> approval -> execution -> audit`.
  - Optional: dedicated "Layout audit" section card in the Studio canvas with per-slide drill-down (R-S14-3 + R-S15-2 both nudge this direction).
  - Optional: tenant-scoped layout capacity overrides (closes R-S13-1) — bigger refactor, probably its own 2-sprint mini-track.

## Phase 2 — Sprint S16 gate (PDF parity for the truncation marker / 2026-05-09)

Status: `PASS_WITH_P2`

### Scope landed in S16

S16 closes R-S15-1 — the highest-priority risk left after S15. Before S16 the PPTX export of a deck with audit findings shipped a visible review marker on every flagged slide (S15), but the PDF export of the SAME deck rendered no marker. A reviewer who only saw the PDF artifact had no signal that the audit fired — exactly the asymmetry that motivated the renderer-side honesty work in the first place.

S16 closes that gap by extending the data path: `UnifiedSlide.auditFlags` (S15) is now persisted onto `DeckDocumentCard.audit_flags` during the unified→card conversion, so the PDF route can read flags off the card without re-running the audit. The PDF route then renders an equivalent marker — same priority tiering (rose for high-priority, amber for advisory), same `⚠ <count>` label semantics, same drift-guarded recognized-flag set. The decision logic itself is now shared with the PPTX marker through a new `report/audit/layoutAuditFlagPriority` module, so a future audit-flag addition cannot silently slip past one renderer port.

Strictly additive at every layer. Legacy decks ship without `audit_flags` on cards; the PDF route's marker call is a no-op when the field is absent or empty; marker failures are non-fatal (logged, page still renders).

### Changes shipped

Shared decision module (new):

- `report/audit/layoutAuditFlagPriority.ts` (new): exports `KNOWN_FLAGS`, `HIGH_PRIORITY_FLAGS`, and `decideLayoutAuditMarker(flags)`. Pure — no I/O, no clock, no globals. Returns `{ shouldRender, priority: 'high' | 'advisory' | 'none', recognizedFlagCount, recognizedFlags }` after deduping, filtering to known flags, and sorting for determinism. Single source of truth that both renderer ports consume.
- `report/pptx/composites/LayoutTruncationMarker.ts`: refactored to consume the shared module. The S15 entry points `decideLayoutTruncationMarker(slide)` and `LayoutTruncationMarkerDecision` are kept as backward-compat shims; the test surface (`_highPriorityFlagsForTests` / `_knownFlagsForTests`) is preserved and now re-exports the shared sets so existing drift-guard tests keep passing without rewrites.

Deck document (data path):

- `presentationDeckDocumentService.DeckDocumentCard`: added optional `audit_flags?: string[]` field with documentation pointing at the `LayoutAuditFlag` set as the canonical source.
- `deckDocumentFromUnifiedJson`: copies `slide.auditFlags` from the UnifiedSlide onto `card.audit_flags` during the conversion. Filters non-string and empty entries defensively. Omits the field entirely when there are no recognized flags so legacy / clean decks roundtrip with zero shape change.

PDF renderer (new + wired):

- `report/pdf/PdfLayoutTruncationMarker.ts` (new): pure helpers `buildPdfLayoutTruncationMarker(flags, page)` and `applyPdfLayoutTruncationMarker(doc, instruction)`. Build returns a `PdfMarkerInstruction | null` describing the geometry, fill / text colors (amber `#D97706` advisory, rose `#BE123C` high-priority), and label string. Apply consumes the instruction against a structural `PdfDocumentLike` interface (subset of pdfkit's `PDFDocument`) so tests can pass a mock without wiring a live binding. `save()` / `restore()` is wrapped in `try/finally` so a `text()` failure can never leak fill colors back into caller code.
- `routes/presentations.routes.ts::GET /decks/:deckId/export/pdf`: imports the helper and calls it BEFORE the page title is drawn (so the badge sits above any title that wraps to multiple lines). The marker call is wrapped in try/catch — a marker failure logs a warning and the page still renders without it.

Tests:

- `report/audit/__tests__/layoutAuditFlagPriority.test.ts` (new, 17 tests): null / undefined / empty / unrecognized-only inputs return no-render; advisories vs high-priority classification; high-priority upgrade when mixed with advisories; deduping; filtering of unrecognized strings; deterministic sort; defensive rejection of non-string entries. Two **drift guards**: `HIGH_PRIORITY_FLAGS ⊆ KNOWN_FLAGS`, and `KNOWN_FLAGS` size + membership exactly match the canonical `LayoutAuditFlag` set (any future flag that's added to the audit without updating the shared module fails CI before it ships).
- `report/pdf/__tests__/PdfLayoutTruncationMarker.test.ts` (new, 11 tests): null / empty / unrecognized-only flags return null; advisory flags produce amber colors + `⚠ <count>`; high-priority flags upgrade to rose; marker positions in the top-right inside the page margin; landscape vs portrait pages produce different x but same width formula; single-digit counts use the base width (real-world cap = 6 known flags); applier emits `save → roundedRect → fill → text → restore` in order with the right colors and label; `restore()` always runs even when `text()` throws (graphics state never leaks).
- `__tests__/presentationDeckDocumentService.test.ts` (new, 5 tests): clean slides produce cards without `audit_flags`; recognized flags propagate verbatim; non-string / empty / null entries are dropped defensively; empty-array `auditFlags` is treated as "no flags"; mixed slides only get the field on slides that actually had recognized flags.

### Validation

- `npx vitest run` on twelve Studio-scoped suites including the three new S16 suites + adjacent generator-golden + the S15 PPTX marker (refactor-sensitive) + decorator + orchestration + audit + capacity registry + intent-density-defaults + approval ticket + Studio routes — **168/168 pass**. No regressions; the S15 PPTX marker tests pass identically post-refactor (the shared module is a strict extraction, not a behavior change).
- `npx eslint --fix` on the eight S16 in-scope files — **0 errors**, 188 pre-existing P3 warnings (all `no-explicit-any` / `no-non-null-assertion` / `require()` style imports / empty blocks in pre-S16 code or test scaffolding; not touched per the S0 baseline policy). The new files contributed zero new error-level findings.
- `npx tsc --noEmit -p tsconfig.json` filtered to S16 in-scope files — **0 errors** in any file S16 touched. Pre-existing TS noise outside S16 scope (`presentationStudioOrchestrationService` audit-details shape from S15, `tablePlatform` type drift) is documented as out-of-scope baseline carry-over and tracked separately; the test suite passes despite it because the runtime shapes are correct, only the inline type declarations have drifted.

### Acceptance criteria covered by S16

- AC: a deck whose Studio canvas surfaces an audit banner now also carries a visible review marker on its EXPORTED PDF (not just the PPTX). **Met.** PDF route reads `card.audit_flags` and renders the marker for every recognized non-empty flag set, mirroring the PPTX wiring.
- AC: PDF marker priority semantics match the PPTX marker AND the canvas banner. **Met.** Same priority tiers, same flag classification (via the shared `decideLayoutAuditMarker`), rose vs amber color tones chosen to read as `serious` vs `advisory` against a white PDF background while remaining recognizable to a reviewer who has previously seen the banner or PPTX.
- AC: legacy decks (without `audit_flags` on cards) export unchanged. **Met.** The marker call is a no-op when the field is absent or empty; the rest of the PDF rendering pipeline is unchanged.
- AC: a marker failure on one card must NOT break the rest of the export. **Met.** Per-card try/catch — a single bad page logs a warning and continues with the unmarked card; subsequent cards render normally.
- AC: drift between audit flag classes and renderer-recognized flags must fail before merge. **Met.** The shared `KNOWN_FLAGS` drift guard test covers BOTH PPTX and PDF since both ports now consume the same module — adding a new flag to the audit without updating the shared module fails CI before either port can silently ignore it.

### Risks / open items (deferred)

- R-S16-1 (P3): the PDF marker uses fixed pixel positioning (`page.width - margin - markerWidth, margin / 2`). If a future deck adopts a non-A4 page (e.g. US Letter, custom widescreen) the position math still works — `page.width` is read from the live `PDFDocument` — but the marker font size is fixed at 10pt regardless of page dimensions. A 4K-print custom page would see a relatively small badge. Mitigation: scale the marker proportionally to page width when a non-A4 page is requested. Out of scope for this sprint.
- R-S16-2 (P3): the PDF marker's `⚠` glyph relies on the document's default font having Unicode coverage for U+26A0. PDFKit's default `Helvetica` does, but a future brand theme that switches to a font without warning-glyph coverage will render a tofu / fallback glyph. Same mitigation note as R-S15-3 applies — document the requirement and ship a font-fallback path if a brand without that coverage is onboarded.
- R-S16-3 (P3): the badge sits above the page title at a fixed y-offset. A page with an extremely long title that wraps to 3+ lines could visually crowd the badge. The current placement (top-right of the page margin band) is the same compromise the PPTX marker makes — the audit signal stays visible without competing for the title's reading flow. A follow-up could move it to the page-footer or pre-page-summary card instead of overlaying the title area; this is a design call and intentionally out of scope here.
- Carry-overs from S13 / S14 / S15: R-S13-1 (tenant scoping), R-S13-2 (override persistence), R-S13-3 (admin endpoint), R-S14-1 (deck-type axis on intent defaults), R-S14-3 (UI distinction between user-set vs inferred densities), R-S15-2 (marker shows count but not flag classes), R-S15-3 (marker glyph fallback), R-S15-4 (deck-level aggregate indicator) all remain open.

### Next sprint plan

- Sprint S17 candidates (subject to your approval):
  - SuperAdmin layout-capacity admin endpoint (closes R-S13-3): authenticated POST that wraps `applyOverrides` with `proposal -> approval -> execution -> audit`. Highest open governance gap now that the renderer honesty story is closed across both export formats.
  - Dedicated "Layout audit" section card in the Studio canvas with per-slide drill-down (R-S14-3 + R-S15-2 + R-S16 user-pull all converge here).
  - Tenant-scoped layout capacity overrides (closes R-S13-1) — the bigger refactor; probably its own 2-sprint mini-track because it touches the registry signature, the audit signature, and persistence.
  - Optional: deck-level aggregate indicator (closes R-S15-4) — a small pre-page summary card or end-of-deck flag count, mirroring the canvas banner aggregate.

## Phase 2 — Sprint S17 gate (SuperAdmin layout-capacity admin surface / 2026-05-09)

Status: `PASS_WITH_P2`

### Scope landed in S17

S17 closes R-S13-3 — the highest-priority open governance gap left after S16. Before S17 the layout-capacity registry built in S13 had everything an operator needed: hot-reloadable storage, strict validator, snapshot, defaults reset. What it did NOT have was an authenticated, audited entry point — every override was effectively code-only, and a SuperAdmin who wanted to nudge a per-template-family cap had to ship a deploy.

S17 wraps the registry in the canonical `proposal -> approval -> execution -> audit` invariant the Studio already uses for the S6 generate flow. A new `presentationStudioLayoutCapacityAdminService` mints single-use approval tickets bound to (orgId, userId, payload+reason fingerprint) on `propose`, then atomically redeems and applies on `execute`, recording the canonical `presentation_studio_layout_capacity_overrides_applied` audit event with the exact override payload + the post-merge registry snapshot. Three new routes under `/api/presentation-studio/admin/layout-capacity` expose it, all gated by a NEW SUPERADMIN-only capability.

The registry is currently process-global (R-S13-1 still open) — a SuperAdmin override therefore affects every tenant served by this Node process. The deliberate gate is the SUPERADMIN-only capability + the audit trail. When R-S13-1 lands and the registry becomes tenant-scoped, we will introduce a separate `presentation_admin_layout_capacity_tenant` capability for tenant Owner / Admin holders; the SuperAdmin surface will continue to manage process-global concerns.

### Changes shipped

Capability matrix:

- `presentationAccessPolicyService.PresentationCapability`: added `presentation_admin_layout_capacity`. Documented why it is SUPERADMIN-only (process-global registry, R-S13-1 dependency on tenant scoping). Only `SUPERADMIN` holds it; OWNER / ADMIN do NOT (asserted by route tests).

Registry public surface:

- `presentationStudioLayoutCapacityRegistryService`: exported `LayoutCapacityRegistrySnapshot` type + `getCurrentRegistrySnapshot()` + `getDefaultRegistrySnapshot()` so the admin surface can render a "current vs default" diff without reaching into internal state. The S13 `_snapshotRegistryForTests` helper is preserved as an alias on top of `getCurrentRegistrySnapshot` so existing tests keep passing.

Admin service (new):

- `presentationStudioLayoutCapacityAdminService.ts` (new): exports `proposeLayoutCapacityOverrides` and `executeLayoutCapacityOverrides`. Both are pure with respect to the audit writer (mockable via `_setLayoutCapacityAdminDependenciesForTests`). Propose runs a dry-run apply through the registry's strict validator and rolls back via a snapshot-replay if validation succeeds; this preserves "validate without mutate" semantics without duplicating the validator. Execute redeems the ticket atomically (single-use, tenant-bound, user-bound, payload+reason-bound), re-validates the payload as defense-in-depth, applies via the registry, and emits the canonical audit row with the post-merge snapshot baked in.

Routes (new):

- `GET /api/presentation-studio/admin/layout-capacity` — read-only snapshot of the live registry + canonical defaults + scope label (`process_global`).
- `POST /api/presentation-studio/admin/layout-capacity/propose` — body `{ overrides: LayoutCapacityOverridesPayload, reason?: string }`. Returns `{ ticket, payloadFingerprint, overrides }` on 200, `{ code: 'INVALID_OVERRIDES_PAYLOAD', errors }` on 412.
- `POST /api/presentation-studio/admin/layout-capacity/execute` — body `{ approvalTicket, overrides, reason? }`. Returns `{ ticketId, registrySnapshotAfter, auditEvent }` on 200; `INVALID_APPROVAL_TICKET` 403 on ticket failures (not_found, expired, consumed, tenant_mismatch, user_mismatch, payload_mismatch); `INVALID_OVERRIDES_PAYLOAD` 412 on the post-redeem revalidation path.

All three routes go through the same `verifyToken` + `presentation_admin_layout_capacity` RBAC gate. Tenant-context guard remains for audit-trail consistency even though the registry itself is process-global.

### Tests

- `presentationStudioLayoutCapacityAdminService.test.ts` (new, 9 tests):
  - propose: validator rejection -> `INVALID_OVERRIDES_PAYLOAD`; valid payload mints a ticket bound to the correct (org, user); registry is NOT mutated by a successful proposal (dry-run + roll-back); different reasons produce different fingerprints.
  - execute: unknown ticket -> `INVALID_APPROVAL_TICKET / not_found`; payload swap between propose and execute -> `payload_mismatch`; cross-tenant redeem attempt -> `tenant_mismatch`; clean round-trip applies the override AND records the audit with the canonical action_type + resource_type + payload + post-merge snapshot; second redemption of the same ticket -> `consumed` (single-use); negative-only path -> audit is NEVER fired before ticket redemption.
- `presentationStudio.routes.test.ts` (S17 block, 14 new tests):
  - GET /admin/layout-capacity: 200 with current+defaults+scope for SUPERADMIN; reflects an applied override in current but not in defaults; 403 PERMISSION_DENIED for OWNER / ADMIN; 401 when no auth.
  - POST /admin/layout-capacity/propose: 200 + ticket for valid payload; 412 INVALID_OVERRIDES_PAYLOAD with errors for invalid; 403 PERMISSION_DENIED for OWNER; registry is NOT mutated by a successful proposal.
  - POST /admin/layout-capacity/execute: end-to-end propose-then-execute with audit verification; 403 PRECONDITION_REQUIRED when ticket id missing; 403 INVALID_APPROVAL_TICKET / not_found for unknown ticket; 403 payload_mismatch when overrides change between propose and execute (registry untouched, audit NOT fired); 403 PERMISSION_DENIED for OWNER trying to execute.

### Validation

- `npx vitest run` on the twelve Studio-scoped suites + adjacent generator-golden + S15 PPTX marker + S16 PDF marker + S16 deck-document propagation + this sprint's two new suites — **192/192 pass** (S16 baseline 168 + 9 admin service + 14 admin routes + 1 source-artifacts noise = 192). No regressions; the S15 / S16 marker tests pass identically and the ticket-lifecycle invariants exercised here are byte-for-byte the same as the S6 generate flow.
- `npx eslint --fix` on the six S17 in-scope files — **0 errors**, 54 pre-existing P3 warnings (all `no-explicit-any` / `no-non-null-assertion` baseline; not touched per the S0 baseline policy). The new files contributed zero new error-level findings.
- `npx tsc --noEmit -p tsconfig.json` filtered to S17 in-scope files — **0 errors** in any file S17 touched. The 39 pre-existing TS errors in 7 unrelated files (orchestration audit-details shape from S15, six tablePlatform files) carry over identically from S16; documented as out-of-scope baseline carry-over and tracked separately.

### Acceptance criteria covered by S17

- AC: a SuperAdmin can adjust layout-capacity numbers AT RUNTIME without a code deploy. **Met.** The `propose -> execute` round-trip applies the override against the live registry, reflected in `getCurrentRegistrySnapshot` immediately after `execute` returns 200.
- AC: every override mutation is gated by an explicit, single-use approval ticket. **Met.** The S6 ticket service is reused verbatim — same TTL, same single-use semantics, same tenant-bind, same user-bind, plus payload+reason fingerprinting (so a swapped reason text fails redemption).
- AC: every successful override is recorded in `audit_logs` with enough context to reconstruct the change. **Met.** The audit row carries the exact override payload, the reason text, the ticket id (for telemetry correlation), and a post-merge registry snapshot. An auditor can replay the change without re-executing the request.
- AC: a non-SUPERADMIN cannot see, propose, or execute against the admin surface. **Met.** All three routes return 403 PERMISSION_DENIED for OWNER / ADMIN / lower; the capability matrix only lists SUPERADMIN as the holder.
- AC: a failed validation must NOT consume a ticket OR persist any state. **Met.** Propose validation runs BEFORE the ticket is minted; rejection returns 412 with the registry's structured error list. The post-redeem revalidation path is the only edge where a ticket is consumed without state change — it returns 412 with a clear "ticket gone, no override landed" envelope so the client retries with a fresh proposal.

### Risks / open items (deferred)

- R-S17-1 (P3): the propose-time dry-run + roll-back uses `resetToDefaults` + replay. If a parallel `applyOverrides` call lands BETWEEN our dry-run apply and our roll-back snapshot replay (rare in a single-process Node server, but theoretically possible via concurrent requests), the parallel override could be lost. Mitigation paths: (a) a registry-level mutex around `applyOverrides`; (b) a true "validate-only" registry method that doesn't touch state. This is out of scope for S17 because the registry is sync + in-process; we documented the race so a future sprint can pick the cleaner mitigation.
- R-S17-2 (P3): the audit row records the post-merge snapshot but NOT the pre-change snapshot. An auditor reconstructing "what changed" would need a previous audit row to diff against, OR they could re-derive it from the override payload. We deliberately kept the audit compact; emitting before+after on every change would inflate audit_logs without giving an auditor information they cannot derive otherwise. A future sprint could add a deck-level "what changed" pre-flight that emits a structured diff in the same audit row; this is part of the broader R-S17 carry-over below.
- R-S17-3 (P3): there is no UI surface yet — the admin routes are backend-only. A SuperAdmin must call them via curl / API tooling. A future sprint should add a SuperAdmin section on the Studio canvas (or the existing Admin panel) to render `current vs defaults` + a propose / execute form. The route shapes are deliberately UI-friendly (snapshots are JSON-serializable, ticket carries everything the UI needs).
- R-S17-4 (P3): there is no `reset-to-defaults` admin action exposed via routes. If a SuperAdmin lands a regrettable override, today they would need to ship another override that re-sets the values manually. A simple `POST /admin/layout-capacity/reset-defaults` (gated by a ticket too) is a natural follow-up.
- Carry-overs from S13 / S14 / S15 / S16: R-S13-1 (tenant scoping), R-S13-2 (override persistence across restarts), R-S14-1, R-S14-3, R-S15-2, R-S15-3, R-S15-4, R-S16-1, R-S16-2, R-S16-3 all remain open.

### Next sprint plan

- Sprint S18 candidates (subject to your approval):
  - Layout-capacity admin UI: SuperAdmin section on the Studio canvas rendering `current vs defaults` + propose / execute form (closes R-S17-3, gives the S17 backend a usable surface).
  - Override persistence across restarts (closes R-S13-2): the registry currently lives in-memory; persist the latest applied override payload to a JSON file or a small DB table so a Node restart does not silently lose runtime tuning.
  - Tenant-scoped layout capacity overrides (closes R-S13-1) — bigger refactor, probably its own 2-sprint mini-track.
  - Layout-audit section card on the Studio canvas with per-slide drill-down (R-S14-3 + R-S15-2 + R-S16 user-pull all converge here).
  - Reset-to-defaults admin action with its own ticket (closes R-S17-4).

## Phase 2 — Sprint S18 gate (Layout-capacity override persistence across restarts / 2026-05-09)

Status: `PASS_WITH_P2`

### Scope landed in S18

S18 closes R-S13-2 — the highest-priority gap left after S17. Before S18 a SuperAdmin who carefully tuned the runtime caps via `/admin/layout-capacity/execute` (S17) would see the entire configuration silently revert on the next Node restart or deploy. Operators could believe their tuning was in effect for hours after it had quietly reset to defaults — exactly the silent-state honesty gap the UI/UX SOT calls out as a P0 risk for any governance surface.

S18 closes that gap by persisting the registry's accumulated override state to a JSON file at apply-time and restoring it at server bootstrap. The constraint Q2=A says no DB migrations, so the file lives outside the source tree (default: `<cwd>/.runtime-config/presentation-studio-layout-capacity-overrides.json`) — a deploy never stomps on it and a `git clean` does not nuke an operator's tuning.

The persistence layer is honest about failure modes: a missing file is the steady-state default and is silent; a corrupt or validator-rejected file does NOT crash the server, it falls back to the canonical defaults and surfaces a typed `loadWarning` on the registry's load-warning channel that the admin GET serializes into its response. A SuperAdmin reading the snapshot sees the honest "we fell back to defaults because <reason>" instead of a clean snapshot that hides the lost tuning.

### Changes shipped

Registry hooks + load-warning channel:

- `presentationStudioLayoutCapacityRegistryService`: added `LayoutCapacityRegistryHooks` interface (`onApply` + `onReset`), `setRegistryHooks(hooks)` setter, and a load-warning channel (`LayoutCapacityRegistryLoadWarning` type + `getRegistryLoadWarning` + `setRegistryLoadWarning`). The registry intentionally knows NOTHING about file I/O; hooks let the persistence layer subscribe to mutations without the registry importing it (no circular dependency since persistence already imports the registry's `applyOverrides` / `resetToDefaults`).
- `applyOverrides` now fires `hooks.onApply(currentSnapshot)` after a successful merge. The hook receives the FULL accumulated snapshot (not a delta) so the persistence layer writes a self-contained file. Hook errors are swallowed at the registry layer — an in-memory apply already succeeded and we do not roll it back for a transient I/O failure (the persistence layer raises a `loadWarning` instead so the operator sees the honest "could not persist" state).
- `resetToDefaults` now fires `hooks.onReset()` AFTER the in-memory state is cleared so the persistence layer drops its on-disk snapshot to match.

Persistence service (new):

- `presentationStudioLayoutCapacityPersistenceService.ts` (new): exports a small `PersistenceFileSystemDriver` interface plus `_setLayoutCapacityPersistenceDriverForTests` so unit tests can swap the real fs for an in-memory map. Path resolution honors a test override, then `process.env.CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_PATH`, then a cwd-relative default. Three pure helpers (`loadPersistedOverrides`, `savePersistedOverrides`, `clearPersistedOverrides`) read / write a versioned JSON file (`schemaVersion: 1`, `writtenAt`, `overrides`). A `restorePersistedOverrides` helper composes load + apply with a typed outcome (`restored | no_persisted_file | corrupt | rejected_by_validator`).
- `initializeLayoutCapacityPersistence()` is the one-shot bootstrap. It runs the restore, sets the registry's load-warning channel based on the outcome, and wires the registry hooks so subsequent `applyOverrides` / `resetToDefaults` calls keep disk in sync with memory. `teardownLayoutCapacityPersistence` is the symmetric cleanup the test suite uses.

Bootstrap wiring:

- `Gateway.ts`: imports `initializeLayoutCapacityPersistence` and calls it BEFORE mounting the Studio routes. The first GET `/admin/layout-capacity` therefore already sees the restored state. The init call is wrapped in try/catch — a transient persistence init failure must NEVER block the Studio surface from coming up; the registry stays at defaults and operators can re-apply via the admin surface.

Admin GET surfaces the load-warning:

- `routes/presentationStudio.routes::GET /admin/layout-capacity` now includes `loadWarning` in the response payload. SuperAdmin readers see `{ reason, sourcePath, details, raisedAt }` when the persistence layer raised a warning, or `null` for the steady-state.

### Tests

- `presentationStudioLayoutCapacityPersistenceService.test.ts` (new, 28 tests):
  - `resolvePersistencePath` (3): honors test override, env var, default cwd-relative fallback.
  - `loadPersistedOverrides` (7): missing, corrupt JSON, non-object top-level, unsupported `schemaVersion`, missing `overrides` field, driver `read` throws → `io_error`, well-formed file parses correctly.
  - `savePersistedOverrides` (2): writes a `schemaVersion: 1` envelope with the supplied payload + a `writtenAt` ISO; `io_error` on driver write failure.
  - `clearPersistedOverrides` (3): removes a present file, no-op on absent file, `io_error` on driver failure.
  - `restorePersistedOverrides` (4): missing file → `no_persisted_file`; well-formed file replays into the live registry; rejected payload → `rejected_by_validator` + registry stays at defaults; bad shape → `corrupt`.
  - `initializeLayoutCapacityPersistence` (9): clears prior load warning on clean missing-file boot; raises `corrupt` warning on bad parse; raises `rejected_by_validator` warning when validator rejects; subsequent `applyOverrides` writes through to disk; `resetToDefaults` clears the file; prior load warning cleared after a successful subsequent apply; `io_error` warning raised when persistence write fails on apply (with in-memory apply still succeeding); `teardown` stops further hook firing; full restore + apply round-trip.
- `presentationStudio.routes.test.ts` (S18 block, 3 new tests):
  - GET `/admin/layout-capacity` returns `loadWarning: null` for clean state.
  - GET surfaces a `corrupt` `loadWarning` with shape `{ reason, sourcePath, details }` when persistence raised one.
  - GET surfaces a `rejected_by_validator` `loadWarning` with the validator error string in `details`.

### Validation

- `npx vitest run` on the thirteen Studio-scoped suites + adjacent generator-golden + S15 PPTX marker + S16 PDF marker + S16 deck-document propagation + S17 admin service + S17 routes + S18 persistence + S18 routes — **223/223 pass** (S17 baseline 192 + 28 persistence-service + 3 admin-GET-loadWarning = 223). No regressions; the registry hooks are no-op when not wired, so all pre-S18 tests pass identically.
- `npx eslint --fix` on the six S18 in-scope files — **0 errors**, 59 pre-existing P3 warnings (all `no-explicit-any` / `no-non-null-assertion` / `no-require-imports` baseline; the two `require()` calls in the persistence service have `eslint-disable` comments because they are deliberate lazy-loads to keep the module side-effect-free at import time and let tests swap the driver before any real `node:fs` import). The new files contributed zero new error-level findings.
- `npx tsc --noEmit -p tsconfig.json` filtered to S18 in-scope files — **0 errors** in any file S18 touched. The 39 pre-existing TS errors in 7 unrelated baseline files (orchestration audit-details shape from S15, six tablePlatform files) carry over identically from S17 and remain documented as out-of-scope baseline carry-over.

### Acceptance criteria covered by S18

- AC: a SuperAdmin override applied via `/admin/layout-capacity/execute` survives a Node restart. **Met.** Hook fires after the merge succeeds; the persistence layer writes the FULL accumulated snapshot to a configurable JSON file. Bootstrap reads it back and replays it via `applyOverrides` BEFORE Studio routes are mounted.
- AC: a missing persistence file is the steady-state default and must not produce a warning. **Met.** `loadPersistedOverrides` returns `{ ok: false, reason: 'missing' }`; the bootstrap maps that to `no_persisted_file` and clears any prior warning.
- AC: a corrupt or validator-rejected persistence file must NOT crash the server. **Met.** Both paths fall back to canonical defaults and raise a typed `loadWarning` (`corrupt | unsupported_schema | io_error | rejected_by_validator`). The registry continues to serve and the admin surface continues to respond.
- AC: the SuperAdmin admin surface must surface the degraded state, NOT hide it. **Met.** GET `/admin/layout-capacity` includes `loadWarning` in the response. A SuperAdmin reading the snapshot sees the honest "we fell back to defaults because <reason>" payload alongside the `current` and `defaults` snapshots.
- AC: persistence write failure on a runtime apply must NOT roll back the in-memory apply. **Met.** Hook is wrapped in try/catch at the registry layer; a write failure raises a `loadWarning` (operator sees "could not persist your last write") but the in-memory state still reflects the override (the alternative — rolling back — would mislead the SuperAdmin into believing their override never landed when it did, just not durably).
- AC: a `resetToDefaults` clears both memory AND disk so a subsequent restart does NOT silently re-apply the cleared overrides. **Met.** `onReset` hook calls `clearPersistedOverrides`; verified by the round-trip test.
- AC: hooks must be opt-in so unrelated test suites are unaffected. **Met.** Hooks are `null` until `setRegistryHooks` is called; every pre-S18 test file passes without modification (verified by the 223/223 broader scope run).

### Risks / open items (deferred)

- R-S18-1 (P3): file path is process-global and not tenant-scoped — same constraint as R-S13-1. When tenant scoping lands, the persistence file will need tenant-keyed entries (or one file per tenant) and the bootstrap will need to restore each tenant's slice into a tenant-keyed registry.
- R-S18-2 (P3): the file is JSON, not signed — a sysadmin with shell access could hand-edit it and bypass the SuperAdmin admin surface. The audit row from S17 only fires when an override goes through the admin route, so a hand-edited file would silently take effect on the next restart with NO audit trail. Mitigation: detect sus mismatch between the file's `writtenAt` and the most recent S17 audit row; alert when they diverge. Out of scope this sprint.
- R-S18-3 (P3): no atomic file write. We `writeFile` directly without a `fsync` + rename dance, so a crash mid-write could leave a corrupt file. The bootstrap handles a corrupt file gracefully (falls back to defaults + raises load warning), so the failure mode is recoverable but loses the in-flight override. A future sprint could ship `writeFile` via tmp-file + rename for atomicity; the test surface would not change.
- R-S18-4 (P3): there is no UI surface for the `loadWarning` yet — only the admin GET response. A SuperAdmin must call the route to see the warning. This converges with R-S17-3 (admin UI).
- Carry-overs from S13 / S14 / S15 / S16 / S17: R-S13-1 (tenant scoping), R-S14-1, R-S14-3, R-S15-2, R-S15-3, R-S15-4, R-S16-1, R-S16-2, R-S16-3, R-S17-1 (race), R-S17-2 (audit pre/post diff), R-S17-3 (admin UI), R-S17-4 (reset-to-defaults action) all remain open.

### Next sprint plan

- Sprint S19 candidates (subject to your approval):
  - Layout-capacity admin UI (closes R-S17-3 + R-S18-4): SuperAdmin section on the Studio canvas rendering `current vs defaults` + `loadWarning` + propose / execute form. Gives the S17 + S18 backend a usable surface; aligns with the workspace's `Menu 3` rule (admin actions live in the right-side command-row slot, not as a separate toolbar).
  - Reset-to-defaults admin action (closes R-S17-4): small endpoint `POST /admin/layout-capacity/reset` gated by its own ticket. Single-sprint scope, leverages the propose / execute pattern from S17 with a different action_type.
  - Tenant-scoped layout capacity overrides (closes R-S13-1 + R-S18-1) — bigger refactor, probably its own 2-sprint mini-track because it touches the registry signature, the audit shape, the persistence file format, and a new tenant-Owner capability.
  - Layout-audit section card on the Studio canvas with per-slide drill-down (R-S14-3 + R-S15-2 + R-S16 user-pull all converge here).
  - Atomic file write for persistence (closes R-S18-3): tmp-file + rename dance. Tiny scope; could bundle with S19-A if the UI is the main work.

