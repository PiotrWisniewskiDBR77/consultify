---
module_id: MODULE_MY_WORK
function_id: MW_MANAGER
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_MANAGER

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_MANAGER`
- primary_module: `02_moja-praca`
- primary_function: `MW_MANAGER`
- parent_function: `MW_MANAGER`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: manager function contract hardening, manager backlog rows (`MW-MGR-*`), dependency impact mapping for Tasks/Decisions/Calendar and `06_realizacja`, evidence and done-gate definition.
- Out of scope: runtime implementation, updates to dependency module contracts, edits outside `deliverables_exact`.
- Allowed global documents: function dispatch protocol, function execution-card template, module behavior/UI/acceptance docs, `MW_MANAGER` function contract.
- Forbidden files: `src/**`, `server/**`, `tests/**`, non-manager function cards and non-listed module files.
- Immutable rule: this run is locked to `02_moja-praca/MW_MANAGER`.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `MW_TASKS` | define manager-to-tasks navigation and provenance expectations for execution follow-up | mutating task lifecycle or ownership from manager scope |
| `MW_DECISIONS` | define manager-to-decisions steering handoff and review/read-back expectation | mutating decision lifecycle from manager scope |
| `MW_CALENDAR` | define manager scheduling/context handoff semantics for time-based steering | mutating calendar canonical objects from manager scope |
| `06_realizacja` | define impact boundary for execution governance and owner read-back | treating manager dashboard as canonical PMO/runtime owner |
| `PM connectors (ClickUp)` | define provider-depth visibility, sync health posture, and conflict/replay impact in manager orchestration | promoting connector runtime ownership to manager scope or implementing connector code in this cycle |

## 4. Source Inputs

- RAW sources:
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
- module contracts:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md`
  - `docs/modules/02_moja-praca/04_UI_UX.md`
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`
- function contracts:
  - `docs/modules/02_moja-praca/functions/MW_MANAGER.md`
  - `docs/modules/02_moja-praca/functions/MW_TASKS.md`
  - `docs/modules/02_moja-praca/functions/MW_DECISIONS.md`
  - `docs/modules/02_moja-praca/functions/MW_CALENDAR.md`
- runtime evidence sources:
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/Executive/ExecutiveDashboard.tsx`
  - `src/routes/AppRoutes.tsx`
- previous decisions:
  - manager view is role-restricted and acts as executive steering surface, not canonical mutation owner.

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Scope and ownership boundary | Manager is documented as role-restricted executive view. | Explicitly lock manager as steering/orchestration function with no hidden cross-module writes. | Add stronger ownership language and handoff posture. | `ENHANCE` | Prevent scope drift into PMO/runtime ownership. |
| Dependency semantics | Dependencies are listed broadly. | Explicit impact-only dependencies for `MW_TASKS`, `MW_DECISIONS`, `MW_CALENDAR`, `06_realizacja`. | Add dependency matrix and acceptance traces. | `NEW` | Keep dependency usage auditable and bounded. |
| Role-gate contract | Access restriction exists in docs. | Define authorized/unauthorized/degraded behavior and acceptance checks for manager route. | Add explicit gate matrix in function contract/backlog. | `ENHANCE` | Tighten tenancy/ACL safety and evidence. |
| Executive navigation and handoff | `onNavigate` handoff is noted. | Formalize candidate-only routing from dashboard to source modules with owner read-back expectation. | Clarify success semantics after handoff. | `ENHANCE` | Avoid claiming completion before owner-module confirmation. |
| Menu 3 AI placement | Module standard exists globally. | Lock manager contextual AI actions to Menu 3 right-side slot only. | Add function-level anti-duplication requirement. | `NEW` | Maintain UI governance consistency. |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` + `ExecutiveDashboard`.
- Menu 2 surface: `Menedzer` / `Manager` tab in `02_moja-praca`.
- Menu 3 actions: manager contextual AI/explain/compare actions in right-side command row slot.
- AI action placement: Menu 3 only; no duplicate manager AI toolbar in dashboard content area.
- runtime states:
  - `loading`: executive aggregate data loading state is explicit.
  - `empty`: no-management-data state shows next action guidance.
  - `error`: recoverable manager state with retry path and no raw internals.
  - `degraded`: partial metrics or restricted source domains are visibly flagged.
  - `success`: manager can navigate to source tabs without implying downstream mutation success.
- source/provenance/evidence UI: executive cards expose source domains and confidence/evidence posture.
- approval/review/diff behavior: high-impact actions remain proposal-based and complete in owner modules.
- anti-patterns:
  - hidden direct write from manager dashboard to source module canonical objects,
  - success claim before owner read-back,
  - duplicate contextual AI action set in both Menu 3 and dashboard canvas.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/MW_MANAGER.md` | tighten ownership/dependency/handoff/acceptance wording | align manager contract with immutable scope and dependency impact boundaries | `DONE` |
| `03_BEHAVIOR.md` | no update in this cycle | module behavior already captures manager role-restricted function presence | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update in this cycle | module-level Menu 3 and manager footprint already present | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update in this cycle | manager row exists; backlog tracks further coverage as P1/P2 | `NOT_REQUIRED` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update in this cycle | mixed-scope packet intentionally untouched | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-MGR-P0-001` | `P0` | `docs/runtime` | Define Manager Action Center 2.0 as one prioritized intervention queue across tasks/decisions/calendar/execution signals. | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `MW-MGR-P0-002` | `P0` | `docs/runtime` | Define ClickUp sync health panel contract (depth tier, auth, directionality, limitations, last sync run). | `MW-MGR-P0-001` | component/API/test | dependency impact complete |
| `MW-MGR-P0-003` | `P0` | `docs/runtime` | Define per-object sync status and conflict queue model (`synced/stale/conflict/error/dead_letter`) with replay controls. | `MW-MGR-P0-001`,`MW-MGR-P0-002` | route/component/API/test | handoff/governance complete |
| `MW-MGR-P0-004` | `P0` | `docs/runtime` | Define governed external ingestion path (`external event -> InboxItem -> triage -> Task/Decision`) without bypassing review. | `MW-MGR-P0-001` | route/API/test | security/tenant complete |
| `MW-MGR-P0-005` | `P0` | `docs/runtime` | Define handoff read-back ledger contract with trace ID and explicit owner confirmation chain. | `MW-MGR-P0-001`,`MW-MGR-P0-003` | route/component/API/test | evidence/governance complete |
| `MW-MGR-P0-006` | `P0` | `docs/test` | Define e2e acceptance chain (`manager recommendation -> handoff -> owner read-back -> manager refresh`). | `MW-MGR-P0-001`,`MW-MGR-P0-005` | route/component/test | acceptance contract complete |
| `MW-MGR-P1-001` | `P1` | `docs/runtime` | Add provider honesty cards in manager context (tier, bidirectional support, biggest limitations). | `MW-MGR-P0-*` | component/API/test | waiting for P0 close |
| `MW-MGR-P1-002` | `P1` | `docs/runtime` | Add cross-channel communication log contract (ClickUp/Slack/Teams thread linkage and status callbacks). | `MW-MGR-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-MGR-P1-003` | `P1` | `docs/runtime` | Add bounded intervention pack templates (`reassign/smooth/replan/escalate`) with expected outcome and verification step. | `MW-MGR-P0-*` | component/test | waiting for P0 close |
| `MW-MGR-P1-004` | `P1` | `docs/runtime` | Add manager KPI data-quality strip and degraded-state communication contract. | `MW-MGR-P0-*` | component/API/test | waiting for P0 close |
| `MW-MGR-P1-005` | `P1` | `test` | Add integration test matrix for manager-to-tasks/decisions/calendar context retention and safe return path. | `MW-MGR-P0-*` | route/component/test | waiting for P0 close |
| `MW-MGR-P2-001` | `P2` | `runtime/test` | Add predictive risk and capacity assistant as advisory-only layer with explicit proposal posture. | `MW-MGR-P0-*`,`MW-MGR-P1-*` | route/component/API/test | waiting for P0 close |
| `MW-MGR-P2-002` | `P2` | `runtime/test` | Add automated operator report pack for recurring PM sync incidents and recovery recommendations. | `MW-MGR-P0-*`,`MW-MGR-P1-*` | component/API/test | waiting for P0 close |
| `MW-MGR-P2-003` | `P2` | `runtime/test` | Add advanced conflict-classification UX (`authority/model/permission/deleted target`) in manager sync review. | `MW-MGR-P0-*`,`MW-MGR-P1-*` | component/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Manager route and role gate are explicit | `/my-work/manager` | `MyWorkHub`, manager access state | shared my-work boundary | manager row in acceptance matrix | `PASS` |
| Manager Action Center 2.0 is contractually defined | manager route + action-center state route scope | manager dashboard action queue and intervention cards | manager action payload contract across dependencies | acceptance chain `MW-MGR-P0-006` | `PASS_WITH_P2` |
| ClickUp sync health and provider honesty are visible | manager connector-state route context | provider cards and sync health panel components | connector health and sync metadata endpoints | provider parity and health tests (`MW-MGR-P1-001`) | `MISSING` |
| Per-object sync conflict posture is auditable | manager conflict drill-down routes | sync status chips + conflict queue UI | sync status and replay APIs | conflict flow tests (`MW-MGR-P0-003`) | `MISSING` |
| External ingestion follows governed path | external signal ingestion route chain | intake triage and promotion controls | ingestion + triage APIs (`external -> InboxItem`) | ingestion guardrail tests (`MW-MGR-P0-004`) | `MISSING` |
| Handoff read-back ledger confirms ownership boundary | manager handoff + return routes | read-back ledger/timeline in manager surface | owner confirmation payload with trace ID | e2e read-back tests (`MW-MGR-P0-006`) | `MISSING` |

## 10. Cross-Module Impact

- impacted modules:
  - `MW_TASKS` for execution follow-up handoff,
  - `MW_DECISIONS` for decision governance steering handoff,
  - `MW_CALENDAR` for schedule/time-context handoff,
  - `06_realizacja` for execution governance impact and owner read-back boundary,
  - external PM providers (`ClickUp` Tier B depth), plus collaboration callbacks (`Slack`/`Teams`) as impact-only context.
- handoff changes: no runtime changes in this cycle; docs-only contract hardening.
- ownership impact: manager remains executive steering surface only.
- security/tenant impact: deny-by-default posture preserved for unauthorized manager access.
- E2E workflow impact: formalized path `manager insight -> explicit navigate/handoff -> owner module review/read-back`.
- global contract updates needed: none.

## 11. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `ACCEPTED_FOR_DOCS_ON_2026-05-10`
- rerun gate: `NOT_RUN (docs-only function cycle)`

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Which exact privileged roles are mandatory for manager route (`manager`, `admin`, other aliases) in the canonical role matrix? | user | 2026-05-24 | no |
| Which minimal source provenance fields must each executive card display before handoff is allowed? | user | 2026-05-24 | no |
| Should manager dashboard default landing CTA prefer `MW_TASKS` or be context-sensitive by role/lens? | user | 2026-05-24 | no |

## 13. Registry Sync Note

- registry sync completed: `2026-05-10` (normalized P0/P1/P2 manager communication backlog)
- synchronized artifacts:
  - `docs/modules/02_moja-praca/function-cards/MW_MANAGER_EXECUTION_CARD.md`
  - `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/02_moja-praca/functions/MW_MANAGER.md`
- scope_anchor integrity: `02_moja-praca/MW_MANAGER`
