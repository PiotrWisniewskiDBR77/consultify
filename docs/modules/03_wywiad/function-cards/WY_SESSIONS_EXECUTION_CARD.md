---
module_id: MODULE_INTERVIEW
function_id: WY_SESSIONS
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — WY_SESSIONS

## 1. Metadata

- scope_anchor: `03_wywiad/WY_SESSIONS`
- primary_module: `03_wywiad`
- primary_function: `WY_SESSIONS`
- parent_function: `WY_SESSIONS`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: function contract hardening and implementation backlog definition for `WY_SESSIONS`.
- Out of scope: runtime code changes, non-`WY_SESSIONS` function contract rewrites, cross-module task creation.
- Allowed global documents: function dispatch protocol, function execution card template, module behavior/UI/acceptance contracts.
- Forbidden files: all runtime paths (`src/**`, `server/**`, `tests/**`) and non-deliverable function cards.
- Immutable rule: this cycle keeps one anchor only: `03_wywiad/WY_SESSIONS`.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `WY_TEMPLATES` | capture template-to-session entry and provenance dependency points | editing templates contract/task rows as primary scope |
| `WY_INSIGHTS` | capture session-to-insights handoff and traceability requirements | editing insights contract/task rows as primary scope |
| `WY_PENDING_REVIEW` | capture session outcomes entering review queue | editing review contract/task rows as primary scope |

## 4. Source Inputs

- RAW sources:
  - `docs/modules/03_wywiad/RAW_INPUT.md`
- module contracts:
  - `docs/modules/03_wywiad/03_BEHAVIOR.md`
  - `docs/modules/03_wywiad/04_UI_UX.md`
  - `docs/modules/03_wywiad/07_ACCEPTANCE_AND_TESTS.md`
- function contracts:
  - `docs/modules/03_wywiad/functions/WY_SESSIONS.md`
  - `docs/modules/03_wywiad/functions/WY_TEMPLATES.md`
  - `docs/modules/03_wywiad/functions/WY_INSIGHTS.md`
  - `docs/modules/03_wywiad/functions/WY_PENDING_REVIEW.md`
- runtime evidence sources:
  - `src/components/Interview/InterviewHub.tsx`
  - `src/services/api/v8/interview.ts`
- previous decisions:
  - no runtime edits in this cycle (`docs-only`)

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Session tab identity and lifecycle ownership | Contract already identifies sessions as create/run/complete lane in Interview hub. | Keep ownership boundary unchanged. | No ownership gap. | `KEEP` | Existing contract aligns with module behavior lane split. |
| `sessionId` deep-link and open behavior | Deep-link requirement exists but acceptance mapping is generic. | Add task-level evidence and done-gate mapping for deep-link fidelity. | Need explicit execution tasks linked to evidence. | `ENHANCE` | Improves deployability and auditability of docs scope. |
| Handoffs to templates/insights/review lanes | Handoffs are present but dependency-only boundary is implicit. | Make impact-only dependencies explicit in card + task IDs. | Missing explicit forbidden-use boundaries. | `ENHANCE` | Prevents scope drift during execution. |
| Automated regression for sessions lifecycle | Acceptance matrix marks module-level InterviewHub test gaps. | Add P1/P2 backlog rows for session lifecycle and cross-lane handoff regression package. | Function-scoped test backlog not yet anchored by IDs. | `NEW` | Needed to move from docs readiness to implementation readiness. |

## 6. UI/UX Component Contract

- approved shell/component family: `InterviewHub` sessions table + dynamic document panels.
- Menu 2 surface: module shell `Wywiad`.
- Menu 3 actions: filters, create/open actions, AI/context actions, row actions in right-side command-row or row/modal context.
- AI action placement: Menu 3/right-side or row/modal context only; no duplicate toolbar under canvas.
- runtime states:
  - `loading`: sessions list and detail panel show loading/refresh indicators.
  - `empty`: explicit next action to create session or clear filters.
  - `error`: safe mapped error with retry.
  - `degraded`: partial session/template/insight linkage marked as degraded.
  - `success`: create/open/status transition confirms changed session context.
- source/provenance/evidence UI: every session-derived insight/export path must retain session and template/source lineage.
- approval/review/diff behavior: high-impact outputs require explicit review; no hidden finalization.
- anti-patterns:
  - session-level decisions without provenance,
  - silent lifecycle state mutation,
  - AI controls duplicated outside Menu 3 contract.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/WY_SESSIONS.md` | add execution-card and task-board linkage with scoped task IDs | keep contract and registry synchronized | `DONE` |
| `03_BEHAVIOR.md` | no update required | lane ownership already covers sessions and dependencies | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update required | Menu 3 and provenance doctrine already defined at module level | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update required | function acceptance row exists; backlog IDs now live in card and board | `NOT_REQUIRED` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update required in this cycle | docs-only function cycle, no packet rewrite requested | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `WY-SES-P0-001` | `P0` | `docs` | Normalize sessions registry baseline for future inspiration rollout: scope lock, explicit dependency-handshake fields, and evidence mapping contract. | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `WY-SES-P1-001` | `P1` | `runtime/test` | Define implementation package for project/task-management inspirations in sessions flow (WIP discipline, evidence bundles, and SLA-aware transitions). | `WY-SES-P0-001` | route/component/API/test | waiting for P0 close |
| `WY-SES-P2-001` | `P2` | `runtime/test` | Define scaling package for inspiration governance (scoring, cross-module traceability, and review retrospectives) across sessions dependency handoffs. | `WY-SES-P0-001`,`WY-SES-P1-001` | route/component/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Sessions tab is canonical lifecycle surface in Interview hub | `/interview`, `/discovery` and `sessions` tab route context | `InterviewHub` sessions table and dynamic panel surface | session loading/mutation boundary in interview API client | sessions tab render/open/status regression | `PASS` |
| Registry baseline supports future inspiration rollout without scope drift | sessions scope anchor and task IDs remain single-function and immutable | source card + board keep one-task-one-scope mapping | dependency-impact contracts retained for templates/insights/review | docs regression review for status/ID policy | `PASS` |
| Inspiration scaling package preserves dependency-safe handoff expectations | route transitions from sessions to templates/insights/review stay explicit | row actions and next-action controls keep provenance expectations | API payload fields preserve session/template/source identifiers | cross-lane handoff regression tests | `PASS_WITH_P2` |

## 10. Cross-Module Impact

- impacted modules:
  - `03_wywiad/WY_TEMPLATES` (impact-only): session creation and continuation context for template usage.
  - `03_wywiad/WY_INSIGHTS` (impact-only): session evidence feeding insight generation and traceability.
  - `03_wywiad/WY_PENDING_REVIEW` (impact-only): session outcomes entering review queue.
- handoff changes: none in runtime for this cycle; documentation locks expected handoff behavior only.
- ownership impact: `WY_SESSIONS` remains owner of session lifecycle semantics.
- security/tenant impact: tenant and role boundaries remain mandatory, deny-by-default when scope uncertain.
- E2E workflow impact: session lifecycle path now maps explicit impact-only handoffs to dependency lanes.
- global contract updates needed: none.

## 11. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `APPROVED_FOR_IMPLEMENTATION`
- rerun gate: `NOT_RUN (docs-only function cycle)`

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Should `sessionId` access denial always redirect to `sessions` base view, or to last valid interview tab for the same project? | user | 2026-05-24 | no |
| Is a dedicated session-to-review audit event required before moving `WY-SES-P2-001` from design to runtime? | user | 2026-05-24 | no |
| Which minimum regression set is required to move sessions evidence from `PASS_WITH_P2` to `PASS`? | user | 2026-05-24 | no |

## 13. Registry Sync Note

- registry sync completed: `2026-05-10`
- registry sync note: normalized P0/P1/P2 rows for inspiration-ready backlog under immutable scope anchor.
- synchronized artifacts:
  - `docs/modules/03_wywiad/function-cards/WY_SESSIONS_EXECUTION_CARD.md`
  - `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/03_wywiad/functions/WY_SESSIONS.md`
- scope_anchor integrity: `03_wywiad/WY_SESSIONS`
