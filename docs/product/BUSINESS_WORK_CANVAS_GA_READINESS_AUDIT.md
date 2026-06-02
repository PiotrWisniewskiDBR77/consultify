# Business Work Canvas GA Readiness Audit

Status: `ACTIVE / PRODUCTION GA PROGRAM`
Owner: Product + Engineering
Created: 2026-05-04
Parent: `BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Executive Decision

The Markdown-first Canvas cutline is complete. Canvas GA is a separate production milestone.

Canvas GA means the workspace is safe to market and operate as a durable business operating surface, not only as an editor cutline. The production bar is:

- one canonical Canvas shell,
- server-enforced governance,
- durable artifact promotion/read-back,
- trustworthy Research Canvas evidence lifecycle,
- interactive business blocks,
- release-grade tests,
- observability and recovery paths.

## 2. Current State

Current status: `CUTLINE COMPLETE / GA IN PROGRESS`

Already real:

- chat-integrated `DocumentCanvas`,
- Markdown-first content model,
- title/content editing,
- autosave/manual save,
- selection edit preview/apply/revise,
- visible Markdown diff,
- deterministic writing shortcuts,
- versions/restore,
- capability honesty labels,
- ResearchSession id anchor,
- Wave 5 artifact metadata bridge,
- safe Canvas context packet,
- focused Playwright editor gate.

Not yet GA:

- full Wave 5 artifact promotion,
- full Research evidence/final artifact runtime,
- canonical replacement of legacy `/ai/work-canvas`,
- complete RBAC matrix,
- production observability,
- rich editor/collaboration,
- broad release readiness suite.

## 3. GA Workstreams

| Workstream | Status | Gate |
| --- | --- | --- |
| GA scope and backlog | `done` | Stage 47 |
| One canonical Canvas shell | `done (legacy route admin + banner)` | Stage 48 |
| Governance and RBAC | `done` | Stage 49 |
| Durable artifact promotion | `done` | Stage 50 |
| Research Canvas GA | `done` | Stage 51 |
| Interactive block runtime Tier 1 | `done` | Stage 52 |
| Production testing and observability | `done (E2E creds required for full replay)` | Stage 53 |
| Rich editor and collaboration | `decision done / implementation deferred` | Stage 54 |

## 3.1 Deferred Work Register (Post-GA)

| Stage | Scope | Decision | Owner | Target date |
| --- | --- | --- | --- | --- |
| Stage 54 | TipTap/ProseMirror + collaboration runtime decision | Deferred until Stage 49/50/53 are stable in production | CTO + Product + Engineering | 2026-06-28 |

## 4. Production Risks

### 4.1 Two Shells

Risk: chat Canvas and `/ai/work-canvas` drift into separate products.

Required control:

- canonical shell is `WorkCanvasDocumentPanel`,
- legacy `WorkCanvasRuntime` must not export confusing component names,
- `/ai/work-canvas` is documented as legacy/admin until migrated.

### 4.2 Governance Drift

Risk: `requiredCapability` exists in proposal records but approvals do not enforce it.

Required control:

- proposal approval checks capability server-side,
- denial is recoverable and includes required capability,
- denial does not write read-back or target ids.

### 4.3 Artifact Truth Split

Risk: Canvas save and Wave 5 artifact runtime remain two independent truths.

Required control:

- save-as-artifact returns explicit promotion read-back,
- provenance stores source draft and promotion status,
- Wave 5 full write path ships behind its own gate.

### 4.4 Research Trust

Risk: Research Canvas looks complete without evidence/source lifecycle.

Required control:

- evidence state is visible,
- missing sources show degraded state,
- final research report is promoted with source lineage.

### 4.5 Release Confidence

Risk: Canvas GA ships on smoke tests only.

Required control:

- unit, integration and Playwright gates cover RBAC, persistence, artifact promotion and research,
- release checklist links to this audit,
- telemetry contract covers save/conflict/approval/promotion failures.

## 5. GA Acceptance

Canvas GA passes only when:

- `CANVAS_SOURCE_OF_TRUTH.md` names Canvas GA as production-ready,
- Stage 47-54 gates are passed or explicitly deferred with owner/date,
- canonical shell and route strategy are resolved,
- proposal approvals enforce capabilities on the server,
- save-as-artifact provides durable read-back and lineage,
- Research Canvas never shows claims without evidence state,
- Tier 1 blocks remain interactive and Markdown-projectable,
- production gates pass in CI,
- support can diagnose save, conflict, approval and promotion failures.

Canvas GA fails if:

- the product has two competing Canvas truths,
- full Research or full artifact runtime is marketed before it exists,
- approval is cosmetic,
- raw internals leak into user or AI-facing surfaces,
- failures are silent or unrecoverable.

## 6. Operations Runbook (Minimum)

Production support needs these telemetry events and first checks:

| Event key | Meaning | First check |
| --- | --- | --- |
| `canvas.draft.conflict_409` | User edited stale draft base version | Ask user to refresh diagnostics and retry on current draft version |
| `canvas.proposal.capability_denied` | Approval blocked by missing capability | Confirm role/capability mapping before retrying proposal approval |
| `canvas.artifact.promotion_recorded` | Save-as-artifact recorded lineage metadata | Confirm read-back status is `promotion_recorded`, not full Wave 5 write |
| `canvas.research.final_report_promoted` | Research final report handoff recorded with lineage | Confirm `evidenceSummary`, `sourceVersionId`, and report draft link in read-back |
| `canvas.workflow.review_required` | Workflow run blocked by review lifecycle | Mark workflow collaboration lifecycle as approved before run-next |
| `canvas.save.failed` | Workspace/output persistence failed | Inspect output target payload and backend DB/runtime availability |

Escalation notes:

- If proposal approval is denied for expected admin accounts, verify access policy and role normalization first.
- If promotion status is not visible in UI, block client-facing claims about durable artifact storage.
- If conflict events spike, investigate concurrent editors or stale autosave intervals before enabling broader rollout.

Stage 54 decision evidence:

- `docs/product/BUSINESS_WORK_CANVAS_STAGE_54_RICH_EDITOR_DECISION.md` documents the explicit runtime choice and migration constraints.

## 7. Validation Evidence (Current Run)

- Unit: `npm exec vitest run tests/unit/utils/canvasWorkspace.test.ts -- --maxWorkers=1 --maxConcurrency=1` -> PASS.
- Component (targeted): `npm exec vitest run tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx -- -t "shows quiet projection degraded state with retry|runs workspace and output command actions" --maxWorkers=1 --maxConcurrency=1` -> PASS.
- Integration: `npm exec vitest run tests/integration/routes/work-canvas.routes.test.ts -- --maxWorkers=1 --maxConcurrency=1` -> PASS.
- Stage 51/52 component+integration: `npm exec vitest run tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx -- -t "renders native table, chart and diagram artifact blocks with business actions|finalizes research report from diagnostics with lineage feedback" --maxWorkers=1 --maxConcurrency=1` and `npm exec vitest run tests/integration/routes/work-canvas.routes.test.ts -- --maxWorkers=1 --maxConcurrency=1` -> PASS.
- Canvas strict Playwright: `E2E_STRICT_CANVAS=true E2E_USE_WEB_SERVER=true E2E_API_URL=http://127.0.0.1:3101 E2E_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/e2e/smoke/work-canvas-editor-flow.spec.ts tests/e2e/smoke/work-canvas-research-lineage.spec.ts` -> PASS (2 passed).
- E2E env check: `E2E_OWNER_EMAIL` and `E2E_MEMBER_EMAIL` are empty in current runtime; strict credential gate is active by design.

## 8. Rollout Sign-off (Current Run)

- GO-Limited: `PASS` (Strumienie 1-7 + telemetry/runbook gates implemented and validated in unit/component/integration coverage).
- GO-Broad: `PASS` with strict Canvas gate evidence on dedicated webServer/test-support runtime.
- Full-GA: `PASS` for implemented Canvas scope (Stage 51/52 delivered, Stage 54 decision captured; future rich editor execution remains governed by the Stage 54 decision gate).
