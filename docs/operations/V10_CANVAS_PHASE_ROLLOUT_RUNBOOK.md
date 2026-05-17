# V10 Canvas Phase Rollout Runbook

Status: `PHASED_ROLLOUT_READY`
Owner: Product Owner + Tech Owner + QA + Security/Governance
Scope: V10 Expanded Canvas, Work Canvas, KIMI lanes, ResearchCanvas, proposal-first conversions and V8 artifact save.

## Purpose

Use this runbook to move V10 Expanded Canvas from technical hardening into internal dogfood, controlled pilot and production rollout without weakening proposal-first governance, project scoping or artifact provenance.

## Release Principle

Every phase ends with a `Go`, `Conditional Go` or `No-Go` decision. A phase cannot advance with an open P0 unless Product Owner, Tech Owner and Governance explicitly sign a documented waiver.

## Phase 0 - Code Freeze And Baseline

Decision target: `BASELINE_GO` or `BASELINE_CONDITIONAL_GO`.

Frozen scope:

- Frontend shell: `src/components/AIChat/WorkCanvas/WorkCanvasShell.tsx`
- Frontend API contract: `src/services/api/workCanvas.ts`
- Research dock integration: `src/components/AIChat/ResearchSessionsDock.tsx`
- Backend routes: `server/src/routes/work-canvas.routes.ts`
- Backend service: `server/src/services/workCanvasService.ts`
- Capabilities: `server/src/services/effectiveAccessService.ts`
- Startup schema guard: `server/src/database/DatabaseInitializer.ts`
- SQL schema: `server/migrations/760_work_canvas_runtime.sql`
- Migration v2 schema: `server/migrations-v2/037_work_canvas_runtime.sql`
- Route/component tests: `tests/integration/routes/work-canvas.routes.test.ts`, `tests/components/AIChat/WorkCanvasShell.test.tsx`

Known waivers before pilot:

- Full repo `npm run type-check` can hang without diagnostic output. The accepted conditional validation is focused tests plus ReadLints on changed files until the type-check runner is repaired.
- Current API route tests are contract tests with mocks, not a full live DB/V8 materialization stack.
- Artifact history UI, real Highlight/Improve actions and native KIMI export integration remain P2 backlog unless explicitly promoted.

Approval checklist:

- Product Owner confirms pilot scope and target user group.
- Tech Owner confirms no open P0 in proposal approval, V8 save, stale guard, project scoping or capabilities.
- QA confirms manual smoke pack and focused automated tests are available.
- Governance confirms role/capability matrix is enforced backend-side, not only hidden in UI.

## Phase 1 - Technical Hardening Gate

Decision target: `HARDENING_GO` or `HARDENING_CONDITIONAL_GO`.

Required automated validation:

```bash
npm run test:v10:canvas:gate
npm run type-check:timeout
```

If type-check hangs, record:

- command,
- elapsed time before timeout,
- last output,
- fallback validation used.

`npm run type-check:timeout` exits with code `124` when the TypeScript check does not complete inside the configured timeout. Use `TYPECHECK_TIMEOUT_MS=<ms>` to override the default.

Required functional proof:

- Conversion chips create proposals before durable mutation.
- Reject proposal does not call domain mutation paths.
- Approve proposal returns structured read-back and audit/provenance data.
- Save-as-artifact goes through V8 artifact runtime and does not create ghost artifacts on failure.
- Draft reads and writes respect organization and project scope.
- ResearchSession selection persists on the canvas draft.
- Deep links reload existing drafts through `draftId` and `conversationId`.
- KIMI lanes do not show a duplicate outer chat while the lane has its own generation chat.
- P2 placeholder actions are visibly disabled/deferred or queued as proposal actions.

## Phase 2 - Internal Dogfood

Decision target: `DOGFOOD_GO`.

Enablement rule:

- Enable only for internal owners and trusted project users.
- Use non-confidential test client/project data.
- Keep external sharing disabled unless Governance explicitly approves the test.

Dogfood paths:

- Discovery note to artifact.
- Idea proposal reject and approve.
- Initiative proposal with owner/status/KPI assumptions.
- Checklist to task with scoped assignment rules.
- Decision memo with assumptions, options, confidence and source limits.
- Research mission to ResearchSession link and final artifact.
- KIMI document/sheet/deck route posture and export honesty.

Evidence required:

- Screenshot or textual proof of active chat/canvas state.
- Proposal preview before mutation.
- Rejection no-mutation proof.
- Approval read-back proof.
- Artifact id/version/provenance proof.
- Role denial proof for one unauthorized action.
- Refresh/deep-link proof for at least one saved draft.

Use `testy_antygravity/templates/v10-canvas-dogfood-report-template.md` for the superseding dogfood report. The dogfood report must not mark `DOGFOOD_GO` without real account, role, project and read-back/audit evidence.

## Phase 3 - Controlled Pilot

Decision target: `PILOT_GO`.

Pilot constraints:

- Limit to selected consulting projects.
- Enable only roles with seeded `canvas.*` and `artifact.*` capabilities.
- Do not enable broad external sharing by default.
- Collect pilot evidence in `testy_antygravity/reports/`.

Metrics to monitor:

- API error rate for `/api/work-canvas`.
- V8 save failures and failed materialization read-back.
- Stale proposal rate.
- Unauthorized mutation attempts and denial quality.
- ResearchSession completion rate.
- KIMI lane usage and export/download failure rate.
- Raw-internals sightings in user-facing UI.

Pilot success criteria:

- No open P0 for the pilot window.
- No tenant/project leakage.
- No hidden business mutation.
- No rejected proposal side effects.
- Save-as-artifact has readable read-back and no ghost artifact on failure.
- Deep links and refresh keep active drafts stable.

## Phase 4 - Production Rollout

Decision target: `PRODUCTION_GO`.

Release prerequisites:

- Phase 0-3 reports are linked from `testy_antygravity/REPORT_INDEX.md`.
- Product Owner, Tech Owner, QA and Governance sign final Go.
- Release notes document scope, known limitations and rollback path.
- Regression pack is included in recurring release gates.

Production rollout:

- Enable Work Canvas route for target roles and projects.
- Keep capability gates as the production control plane.
- Keep P2 items visibly deferred until implemented.
- Watch logs and audit trails immediately after rollout.

## Rollback

Rollback is functional and non-destructive:

1. Hide or disable `/ai/work-canvas` entry points.
2. Remove or withhold `canvas.*` and `artifact.*` capabilities from affected roles.
3. Keep `work_canvas_*` tables intact to preserve draft/proposal/audit evidence.
4. Keep already-created domain objects and artifacts readable.
5. Record rollback decision and evidence in `testy_antygravity/reports/`.

## Stop Conditions

Stop rollout immediately on:

- hidden durable mutation,
- tenant/project data leakage,
- unauthorized approval or export,
- rejected proposal side effect,
- V8 ghost artifact after failure,
- raw stack trace or internal ACL object in core business flow,
- persistent inability to save/reload active drafts.
