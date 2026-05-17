---
module_id: MODULE_INTERVIEW
function_id: WY_TEMPLATES
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — WY_TEMPLATES

## 1. Metadata

- scope_anchor: `03_wywiad/WY_TEMPLATES`
- primary_module: `03_wywiad`
- primary_function: `WY_TEMPLATES`
- parent_function: `WY_TEMPLATES`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: function contract hardening and implementation backlog definition for `WY_TEMPLATES`.
- Out of scope: runtime code changes, non-`WY_TEMPLATES` contract rewrites, and cross-module task creation.
- Allowed global documents: function dispatch protocol, function execution card template, module behavior/UI/acceptance contracts.
- Forbidden files: all runtime paths (`src/**`, `server/**`, `tests/**`) and non-deliverable function cards.
- Immutable rule: this cycle keeps one anchor only: `03_wywiad/WY_TEMPLATES`.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `WY_SESSIONS` | capture session-to-template entry context and continuity expectations | editing sessions contract/task rows as primary scope |
| `WY_INSIGHTS` | capture template-to-insight provenance and downstream evidence expectations | editing insights contract/task rows as primary scope |

## 4. Source Inputs

- RAW sources:
  - `docs/modules/03_wywiad/RAW_INPUT.md`
- module contracts:
  - `docs/modules/03_wywiad/03_BEHAVIOR.md`
  - `docs/modules/03_wywiad/04_UI_UX.md`
  - `docs/modules/03_wywiad/07_ACCEPTANCE_AND_TESTS.md`
- function contracts:
  - `docs/modules/03_wywiad/functions/WY_TEMPLATES.md`
  - `docs/modules/03_wywiad/functions/WY_SESSIONS.md`
  - `docs/modules/03_wywiad/functions/WY_INSIGHTS.md`
- runtime evidence sources:
  - `src/components/Interview/InterviewHub.tsx`
  - `src/services/api/v8/interview.ts`
- previous decisions:
  - no runtime edits in this cycle (`docs-only`)

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Template tab identity and ownership | Contract identifies template management surface in Interview hub. | Keep template ownership and tab identity unchanged. | No ownership gap in as-is contract. | `KEEP` | Existing doctrine matches module behavior and UI contract. |
| Template list and question preview evidence | Contract mentions list/cards and question loading but lacks task-level evidence mapping. | Add execution tasks that lock evidence for list, preview, and action continuity. | Need deployable task granularity for docs-driven handoff. | `ENHANCE` | Makes function contract auditable and implementation-ready. |
| Inspiration intake and normalization for future delivery | Inspiration ideas exist but are not formalized as one normalized registry contract per priority level. | Normalize one P0/P1/P2 stream under immutable anchor with explicit dependencies and evidence gates. | Need unified task governance for future extensions without changing function ownership. | `NEW` | Enables controlled expansion and avoids duplicate or drifting task definitions. |
| Session/insight dependency boundaries | Dependency impact exists implicitly in module docs. | Make impact-only dependency boundaries explicit in function execution artifacts. | Missing forbidden-use boundaries in current delivery set. | `ENHANCE` | Reduces scope drift risk in follow-up cycles. |
| Automated regression depth for templates flow | Module acceptance highlights InterviewHub-level test gaps. | Add P1/P2 backlog for template flow regression and downstream provenance validation. | No function-scoped test backlog IDs existed for templates. | `NEW` | Required to progress from docs readiness to runtime readiness. |

## 6. UI/UX Component Contract

- approved shell/component family: `InterviewHub` template list/cards + question preview panel.
- Menu 2 surface: module shell `Wywiad`.
- Menu 3 actions: template filters, template actions, AI/context actions, and row actions in right-side command-row or row/modal context.
- AI action placement: Menu 3/right-side or row/modal context only; no duplicate toolbar under canvas.
- runtime states:
  - `loading`: templates and question preview fetches show explicit loading/refresh indicators.
  - `empty`: clear next action to create/import/select template or clear filters.
  - `error`: safe mapped error copy with explicit retry.
  - `degraded`: partial template metadata or missing question payload is labeled honestly.
  - `success`: template select/update/preview actions confirm what changed.
- source/provenance/evidence UI: template-driven insights/exports preserve template and session lineage.
- approval/review/diff behavior: high-impact generated conclusions require explicit review flow; no hidden approval.
- anti-patterns:
  - template-driven outputs without source provenance,
  - hidden cross-function mutation in sessions or insights lanes,
  - duplicated AI controls outside Menu 3 contract.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/WY_TEMPLATES.md` | add execution-card and task-board linkage with scoped task IDs | keep function contract and execution backlog synchronized | `DONE` |
| `03_BEHAVIOR.md` | no update required | module behavior already includes templates lane ownership | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update required | Menu 3 and AI placement doctrine already canonical | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update required | function acceptance row exists and remains valid | `NOT_REQUIRED` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update required in this cycle | docs-only function cycle, no packet rewrite requested | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `WY-TPL-P0-001` | `P0` | `docs` | Normalize inspiration-task baseline for `WY_TEMPLATES`: intake schema, triage policy (`KEEP/ENHANCE/NEW/DEFER`), and registry governance under immutable scope anchor. | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `WY-TPL-P1-001` | `P1` | `runtime/test` | Define execution layer for inspiration stream: priority scoring, dependency handshake with `WY_SESSIONS`/`WY_INSIGHTS`, and evidence checklist enforcement. | `WY-TPL-P0-001` | route/component/API/test | waiting for P0 close |
| `WY-TPL-P2-001` | `P2` | `runtime/test` | Define scale-up package: inspiration playbook, recommendation loop, and cyclical retrospective/roadmap handoff for future backlog growth. | `WY-TPL-P0-001`,`WY-TPL-P1-001` | route/component/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Templates tab is canonical template management surface in Interview hub | `/interview`, `/discovery` and `templates` tab route context | `InterviewHub` template list/cards and question preview panel | template list/question endpoints in interview API client | templates tab render/select regression | `PASS` |
| P0 normalization creates one non-duplicated registry path for inspiration tasks | same route scope as template tab, no extra runtime routes required | command-row and row-context actions remain Menu 3 compliant | no new API contract required for docs normalization stage | docs registry validation checklist for P0 | `PASS` |
| P1/P2 expansion remains dependency-safe and evidence-driven | transitions from templates context to sessions/insights contexts | row/context actions preserve template/session linkage metadata | payload continuity for template/source/session identifiers | cross-function handoff + recommendation-loop regression package | `PASS_WITH_P2` |

## 10. Cross-Module Impact

- impacted modules:
  - `03_wywiad/WY_SESSIONS` (impact-only): template selection context used when starting/continuing sessions.
  - `03_wywiad/WY_INSIGHTS` (impact-only): template/question provenance carried into insight interpretation.
- handoff changes: none in runtime for this cycle; documentation locks expected handoff behavior only.
- ownership impact: `WY_TEMPLATES` remains owner of template registry and question-set presentation semantics.
- security/tenant impact: tenant and role boundaries remain mandatory; deny-by-default when scope is uncertain.
- E2E workflow impact: template workflow now maps explicit impact-only dependencies into sessions/insights lanes.
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
| Should question preview fallback prefer "keep selected template with warning" or reset selection when question payload fails? | user | 2026-05-24 | no |
| Is a dedicated provenance badge required in template-driven insight handoff before promoting `WY-TPL-P2-001` to runtime? | user | 2026-05-24 | no |
| Which minimum template-flow regression set is required to move evidence status from `PASS_WITH_P2` to `PASS`? | user | 2026-05-24 | no |

## 13. Registry Sync Note

- registry sync completed: `2026-05-10` (`task-normalization`)
- synchronized artifacts:
  - `docs/modules/03_wywiad/function-cards/WY_TEMPLATES_EXECUTION_CARD.md`
  - `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/03_wywiad/functions/WY_TEMPLATES.md`
- scope_anchor integrity: `03_wywiad/WY_TEMPLATES`
