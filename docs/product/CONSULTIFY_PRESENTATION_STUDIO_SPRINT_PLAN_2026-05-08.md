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

