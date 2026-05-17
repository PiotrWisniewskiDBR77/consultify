---
module_id: MODULE_CHAT
doc_kind: IMPLEMENTATION_PLAN
version: 1.0
owner: user
status: approved_for_docs
last_updated: 2026-05-10
---

# Implementation Plan — 01_czat / Teresa Chat Engine

## 0. Operating Mode

- Active module: `01_czat`
- Work mode: `RUNTIME_ALIGNMENT` for P0 Canvas startup, then `FEATURE_BUILD` only after P0 gate passes.
- Runtime code in scope: yes, after locked owner decisions and approved docs gate.
- Documentation in scope: `00_META.md` ... `07_ACCEPTANCE_AND_TESTS.md`, `functions/*.md`, `STATUS.md`, `CODEMAP.md`, this file.
- Cross-module impact: described here; global maps update is required only when ownership or handoff direction changes.
- Current module status: `APPROVED_FOR_DOCS_WITH_CANVAS_NO_GO`
- Runtime launch status: `CZ_CHAT_ENGINE = real`; `CZ_CANVAS_WORKSPACE = STARTUP_INCOMPLETE / NO_GO`

## 1. Goal

Finish `01_czat` as a governed Conversational Work OS:

1. Keep the production chat engine stable.
2. Finish the Canvas startup path without false launch claims.
3. Preserve RAW-derived advanced capabilities as ordered backlog, not mixed scope.
4. Make every critical claim traceable to route, component, API and test evidence.

The module is not done until the P0 Canvas startup path is proven:

`conversation -> canvas draft -> review_required -> accept/reject -> owner-lane read-back`

## 2. Non-Goals

- Do not rebuild the whole chat runtime while finishing Canvas startup.
- Do not claim `/wordy`, `/excele`, `/prezentacje` parity while routes remain gated or coming-soon.
- Do not let Canvas own durable tasks, decisions, initiatives, documents, sheets, decks or output packages.
- Do not add hidden writes, hidden memory promotion or background learning.
- Do not start another module as active work unless owner explicitly accepts `01_czat` with Canvas `NO_GO` deferred.

## 3. Source of Truth and Conflict Rule

Priority order for this implementation:

1. Runtime security and tenancy invariants.
2. `docs/modules/01_czat/00_META.md` ... `07_ACCEPTANCE_AND_TESTS.md`.
3. `docs/modules/01_czat/functions/CZ_CHAT_ENGINE.md`.
4. `docs/modules/01_czat/functions/CZ_CANVAS_WORKSPACE.md`.
5. `docs/modules/01_czat/RAW_TARGET_STATE_2_0_PACKET.md`.
6. RAW sources, especially `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`.

Conflict protocol:

- Runtime is current behavior truth.
- RAW is product intent.
- This plan and the packet decide what becomes implementation scope.
- Function contracts define approved function behavior.
- If a claim has no route/component/API/test evidence, it is target/deferred, not done.

## 4. Priority Roadmap

### P0 — Finish Canvas Startup

P0 is required before `CZ_CANVAS_WORKSPACE` can move out of `NO_GO`.

| Item | Required outcome | Contract files to update | Evidence required |
| --- | --- | --- | --- |
| P0.1 Canvas entrypoint decision | Locked decision: entry is selected chat output (`conversation -> selected output -> canvas draft`). | `00_META.md`, `03_BEHAVIOR.md`, `04_UI_UX.md`, `functions/CZ_CANVAS_WORKSPACE.md` | route + component + test |
| P0.2 Honest empty state | Canvas opens to an empty state with next action, not a blank/gated shell. | `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`, `functions/CZ_CANVAS_WORKSPACE.md` | component + test |
| P0.3 Draft candidate identity | Selected chat output creates/loads a candidate with `draft_id`, `artifact_type`, `source_conversation_id`, `status`. | `05_DATA_AND_INTEGRATIONS.md`, `functions/CZ_CANVAS_WORKSPACE.md` | API + component + test |
| P0.4 Source/provenance card | Candidate shows source refs or explicit no-source warning. | `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md` | component + API/policy + test |
| P0.5 Review-required state | Candidate cannot materialize without user decision. | `03_BEHAVIOR.md`, `04_UI_UX.md`, `functions/CZ_CANVAS_WORKSPACE.md` | component + API + test |
| P0.6 Accept/reject | Accept/reject works; reject leaves no durable owner-lane mutation. | `03_BEHAVIOR.md`, `07_ACCEPTANCE_AND_TESTS.md` | API + integration/e2e |
| P0.7 Owner-lane read-back | Approved candidate routes to owner lane and returns visible read-back. | `05_DATA_AND_INTEGRATIONS.md`, `07_ACCEPTANCE_AND_TESTS.md` | route + API + e2e |
| P0.8 Error/degraded taxonomy | UI distinguishes route, rollout, source, ACL, API and read-back blockers. | `04_UI_UX.md`, `06_PERMISSIONS_AND_SECURITY.md`, `07_ACCEPTANCE_AND_TESTS.md` | component + test |
| P0.9 Menu 3 placement | Canvas startup actions live in Menu 3/right command row or state-tied review controls without duplicate toolbar. | `04_UI_UX.md`, `functions/CZ_CANVAS_WORKSPACE.md` | component + UI test |
| P0.10 Audit/read-back strip | User sees actor/action/status/read-back for materialization. | `03_BEHAVIOR.md`, `07_ACCEPTANCE_AND_TESTS.md` | component + API + test |

P0 exit gate:

- `CZ_CANVAS_WORKSPACE` status can change from `startup_incomplete / NO_GO` only when all P0 rows are `PASS`.
- If any P0 item is missing evidence, status remains `NO_GO`.

### P1 — First Useful Expansion After Startup

P1 starts only after P0 passes.

| Item | Required outcome | Notes |
| --- | --- | --- |
| P1.1 Artifact diff/apply/reject/rollback | AI edits are inspectable and reversible. | This is first after-start governance expansion. |
| P1.2 Version snapshots | User can compare and recover versions. | Requires artifact version model. |
| P1.3 Agent run plan | Multi-step work shows steps, sources, tools, risks and approvals before execution. | P0 only for high-impact runs if needed for safety. |
| P1.4 Source health/freshness badges | User sees stale/blocked/low-quality source warnings. | Requires parser/index/source metadata. |
| P1.5 Action Review panel | Artifacts, tasks, decisions, risks and follow-ups are reviewed together. | Must remain proposal-only until owner acceptance. |
| P1.6 Edit artifact from chat | Teresa proposes edits beside artifact. | Uses same review/diff rules. |
| P1.7 Create initiative draft from answer | Larger findings become initiative proposals. | Must route to `05_inicjatywy` owner lane. |
| P1.8 Client-ready redaction | Output can be cleaned before client export. | Required before broad export workflows. |
| P1.9 Meeting/workshop recap | Transcript/voice note becomes summary, decisions, tasks and artifact candidates. | Requires source/provenance retention. |
| P1.10 Consulting playbook selector | Work modes route to business case, PMO review, risk register, client-ready memo. | Keep in compact Work Mode/Menu 3 pattern. |

### P2 — Preserve, Do Not Block Launch

P2 items stay documented but must not block P0/P1 delivery:

- Shared project chat and team collaboration.
- Enterprise connector catalog.
- Knowledge review queue and knowledge lifecycle.
- Cross-conversation intelligence.
- Research space/source-first workspace.
- Semantic history and memory search.
- Voice/multimodal to Canvas.
- Mobile/async continuation.
- Governance/quality dashboards.
- ZIP/source pack ingestion.
- Whiteboard/mindmap/process-flow creation from chat.

## 5. Delivery Sequence

### Sprint 0 — Ready Gate

Do before coding:

- Confirm owner acceptance for this plan.
- Confirm locked P0 Canvas entrypoint (`selected chat output`).
- Freeze P0 file map.
- Confirm no global ownership/handoff direction changes are introduced.
- Confirm required evidence paths for each P0 item.

Exit result:

- `READY_TO_IMPLEMENT_P0`.

### Sprint 1 — Canvas Entry and Empty State

Scope:

- Implement selected Canvas entrypoint.
- Implement honest empty/degraded state.
- Keep internal runtime route honest.

Required docs after runtime:

- `03_BEHAVIOR.md`
- `04_UI_UX.md`
- `07_ACCEPTANCE_AND_TESTS.md`
- `functions/CZ_CANVAS_WORKSPACE.md`
- `CODEMAP.md`
- `STATUS.md`

Exit evidence:

- route evidence,
- component evidence,
- UI state test,
- no hidden write path.

### Sprint 2 — Draft Candidate and Provenance

Scope:

- Create/load one draft candidate from a selected chat output.
- Show artifact identity and source/no-source state.
- No materialization yet.

Exit evidence:

- API evidence for draft/candidate state,
- component evidence for preview/source card,
- test for no-source warning and source refs.

### Sprint 3 — Review, Accept/Reject, No-Write Reject

Scope:

- Add review-required state.
- Add accept/reject.
- Prove reject creates no durable owner-lane mutation.

Exit evidence:

- integration test for reject no-write,
- component test for review-required state,
- audit/proposal status visible.

### Sprint 4 — Owner-Lane Read-Back

Scope:

- Approved candidate routes to selected owner lane.
- Owner-lane read-back is visible before success.
- Error taxonomy covers route, rollout, source, ACL, API and read-back blockers.

Exit evidence:

- e2e test for `conversation -> canvas draft -> review_required -> accept/reject -> owner-lane read-back`,
- owner-lane API read-back evidence,
- updated acceptance matrix.

### Sprint 5 — P0 Closeout

Scope:

- Run gate suite.
- Update module status.
- Capture owner acceptance.

Required final state:

- `CZ_CHAT_ENGINE`: `real`
- `CZ_CANVAS_WORKSPACE`: `real` only if P0 evidence is complete; otherwise remains `NO_GO`.
- Module status: `DONE` only if docs and runtime evidence match.

## 6. Evidence Strategy

Every P0 claim must have:

- Route evidence: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`, or selected route file.
- Component evidence: exact `src/views/**` or `src/components/**` paths.
- API evidence: exact frontend API boundary and backend route/service.
- Test evidence: exact unit/component/integration/e2e file.

Missing evidence policy:

- Missing test: mark `test_gap`.
- Missing runtime: mark `implementation_gap` or `startup_gap`.
- Missing route/API: item cannot be `PASS`.
- Missing owner-lane read-back: Canvas cannot be `DONE`.

## 7. Cross-Module Impact Rules

- `02_moja-praca`: Chat/Canvas may propose task/action candidates only; owner lane creates or accepts durable personal work items.
- `05_inicjatywy`: Chat/Canvas may propose initiative candidates only; initiative lifecycle remains owned by `05_inicjatywy`.
- `06_realizacja`: Chat/Canvas may propose execution actions only; execution records and governance remain owned by `06_realizacja`.
- `09_outputs`: Chat/Canvas may prepare export candidates only after artifact owner approval.

Global map update is mandatory if any implementation changes:

- canonical owner,
- handoff direction,
- artifact family ownership,
- mutation authority,
- cross-module route semantics.

If any of the above changes, update at least:

- `docs/modules/MODULE_INTERACTION_GRAPH.md`
- `docs/modules/ARTIFACT_LINEAGE_MATRIX.md`
- `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md`

## 8. Hard Stops

- `BLOCKED_P1`: Canvas described as working before P0 evidence passes.
- `BLOCKED_P1`: hidden write or hidden memory promotion appears.
- `BLOCKED_P1`: high-impact mutation lacks explicit approval/review.
- `BLOCKED_P1`: owner-lane handoff has no read-back evidence.
- `BLOCKED_P1`: critical claim lacks route/component/API/test evidence.
- `NO_GO`: P0 Canvas entrypoint is undecided.
- `NO_GO`: global handoff ownership changes without updating global maps.

## 9. Validation Commands

Use targeted validation during P0 work:

```bash
npm run docs:contract:rerun-gate
npx vitest run tests/components/AppRoutes.ai-chat-routing.test.tsx
npx vitest run tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx
npx vitest run tests/integration/ai/ai-chat.routes.test.ts
```

Add new targeted tests for each implemented P0 slice. Do not rely on unrelated broad suite passes as evidence for Canvas startup.

## 10. Final Done Gate

Module can be marked `DONE` only when:

- `RAW_TARGET_STATE_2_0_PACKET.md` has `APPROVED` status or explicit owner-approved deferral.
- `CZ_CHAT_ENGINE` and `CZ_CANVAS_WORKSPACE` function contracts match runtime truth.
- `04_UI_UX.md` and `07_ACCEPTANCE_AND_TESTS.md` include current P0 evidence.
- All P0 rows are `PASS`, or any deferral is explicitly owner-approved and not represented as shipped.
- Security/tenant checks pass.
- Handoff conflicts are closed or explicitly deferred.
- Owner acceptance is recorded.

Until then, correct status is:

- `APPROVED_FOR_DOCS / NO_GO_FOR_CANVAS_RUNTIME`, or
- `REVIEW_READY_FOR_OWNER_ACCEPTANCE_WITH_CANVAS_NO_GO`.
