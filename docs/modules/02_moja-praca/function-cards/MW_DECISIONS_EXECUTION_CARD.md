---
module_id: MODULE_MY_WORK
function_id: MW_DECISIONS
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_DECISIONS

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_DECISIONS`
- primary_module: `02_moja-praca`
- primary_function: `MW_DECISIONS`
- parent_function: `MW_DECISIONS`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: decisions function contract, decision-specific backlog (`MW-DEC-*`), decision lifecycle/approval/provenance/handoff rules.
- Out of scope: runtime implementation, edits to non-`MW_DECISIONS` function contracts, dependency module contracts.
- Allowed global documents: dispatch protocol, execution-card template, module behavior/UI/acceptance canon, decision function contract.
- Forbidden files: `src/**`, `server/**`, `tests/**`, non-`MW_DECISIONS` function cards.
- Immutable rule: this cycle is locked to `02_moja-praca/MW_DECISIONS`.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `MW_TASKS` | define candidate handoff contract when decision outcome requires execution task | changing task lifecycle ownership from decisions surface |
| `MW_INBOX` | define intake-to-decision signal path and provenance boundary | treating inbox as decision canonical owner |
| `05_inicjatywy` | define candidate conversion path for strategic outcomes | mutating initiative lifecycle directly from decisions |
| `06_realizacja` | define candidate conversion path for execution outcomes | mutating execution lifecycle directly from decisions |

## 4. Source Inputs

- RAW sources:
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
- module contracts:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md`
  - `docs/modules/02_moja-praca/04_UI_UX.md`
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`
- function contracts:
  - `docs/modules/02_moja-praca/functions/MW_DECISIONS.md`
- runtime evidence sources:
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/DecisionsPanelContent.tsx`
  - `src/components/MyWork/DecisionsKanbanBoard.tsx`
  - `src/components/MyWork/DecisionsTimelineView.tsx`
  - `src/components/MyWork/DecisionDetailView.tsx`
- previous decisions:
  - decisions surface is orchestration/review layer, not canonical owner of downstream lifecycle mutations.

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Decisions ownership boundary | Canonical boundary exists but is broad. | Decisions own decision object review/lifecycle only; downstream lifecycle mutation stays in owner modules. | Needs explicit candidate-only handoff and read-back language. | `ENHANCE` | Prevent ownership drift and hidden writes. |
| Decision lifecycle grammar | Status and priority are present. | Full state taxonomy with explicit transitions and degraded/restricted posture. | Missing explicit transition and policy clauses in contract. | `ENHANCE` | Improve predictability and auditability. |
| Approval behavior | High-impact approval noted at high level. | Explicit `proposal -> approval -> execute -> read-back` chain with trigger categories. | Trigger list and gate sequence not fully explicit. | `NEW` | Governance hardening and safer mutation flow. |
| Provenance and evidence | Source visibility exists. | Mandatory source/evidence posture before high-impact downstream conversion. | Evidence quality threshold not fully specified. | `ENHANCE` | Reduce low-confidence decision propagation. |
| Cross-module dependency posture | Dependencies implied through handoffs. | Explicit impact-only dependency map (`MW_TASKS`, `MW_INBOX`, `05_inicjatywy`, `06_realizacja`). | Missing formal dependency contract table. | `NEW` | Scope safety and no-scope-drift enforcement. |
| Menu 3 AI placement | Module standard references Menu 3. | Decision-context AI actions live in Menu 3 right-side slot only. | Need explicit anti-duplication guard in function contract. | `ENHANCE` | Keep UI governance consistent and auditable. |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` decision surfaces (`DecisionsPanelContent`, `DecisionsKanbanBoard`, `DecisionsTimelineContainer`, `DecisionDetailView`).
- Menu 2 surface: `Decyzje` tab in `02_moja-praca`.
- Menu 3 actions: contextual decision AI/review actions in right-side command-row slot only.
- AI action placement: no duplicate decision AI toolbar in content/canvas when Menu 3 already provides those actions.
- runtime states:
  - `loading`: decision list/detail loading with preserved context.
  - `empty`: no decisions state with clear create/import-next-step guidance.
  - `error`: recoverable state with retry/open-source fallback.
  - `degraded`: partial metadata, stale source, ACL-restricted context, or unresolved dependency links.
  - `success`: decision review/update completed with visible next action and owner handoff posture.
- source/provenance/evidence UI: decision row/detail shows origin, linked objects, confidence/evidence posture, and unresolved assumptions.
- approval/review/diff behavior: high-impact actions require explicit review/approval and owner read-back before reporting canonical success.
- anti-patterns:
  - hidden downstream writes from decisions panel,
  - decision success toast before owner read-back,
  - duplicate AI actions in both Menu 3 and content area.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/MW_DECISIONS.md` | strengthen ownership boundary, lifecycle/approval chain, provenance and impact-only handoff language | close contract ambiguity before runtime planning | `DONE` |
| `03_BEHAVIOR.md` | no update in this cycle | module behavior canon already supports decision boundary | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update in this cycle | global Menu 3 and decision surface invariants already documented | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update in this cycle | function-level evidence mapping is sufficient for docs-only cycle | `NOT_REQUIRED` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update in this cycle | mixed module packet; decision scope handled in function card | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-DEC-P0-001` | `P0` | `docs` | Ustandaryzowac Decision Communication Contract (`MW_DECISIONS` + `MW_INBOX` + `MW_TASKS`) z twardym read-back. | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `MW-DEC-P0-002` | `P0` | `docs/runtime` | Dodac ClickUp minimal contract dla decyzji (`status/assignee/due/priority` + provenance + limitations). | `MW-DEC-P0-001` | route/component/API/test | contract/evidence complete |
| `MW-DEC-P0-003` | `P0` | `docs/runtime` | Uruchomic `external -> Inbox` ingestion dla eventow decision-related z ClickUp. | `MW-DEC-P0-002` | route/component/API/test | contract/evidence complete |
| `MW-DEC-P0-004` | `P0` | `docs/runtime` | Wdrozyc Decision Read-Back Tracker i blokade `success bez read-back`. | `MW-DEC-P0-001`,`MW-DEC-P0-003` | route/component/API/test | governance/security complete |
| `MW-DEC-P0-005` | `P0` | `test` | Dodac E2E golden path dla pelnego lancucha decyzji-komunikacji. | `MW-DEC-P0-001`,`MW-DEC-P0-003`,`MW-DEC-P0-004` | route/component/API/test | evidence complete |
| `MW-DEC-P0-006` | `P0` | `docs` | Utworzyc ROW-y dla `05_inicjatywy` i `06_realizacja` oraz spiac dependency tasks z `MW-DEC-*` (impact-only plan). | `MW-DEC-P0-001`,`MW-DEC-P0-004` | route/component/API/test | impact complete |
| `MW-DEC-P1-001` | `P1` | `docs/runtime` | Dodac multi-step/delegated approval chains dla decyzji. | `MW-DEC-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-DEC-P1-002` | `P1` | `runtime/test` | Dodac operator console dla connectorow (`conflict/retry/replay/health`). | `MW-DEC-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-DEC-P1-003` | `P1` | `docs` | Dodac decision policy matrix: kto, kiedy i jakim kanalem dostaje komunikat. | `MW-DEC-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-DEC-P1-004` | `P1` | `docs/runtime` | Rozszerzyc mapowanie ClickUp custom fields + komentarze/review callback. | `MW-DEC-P0-002`,`MW-DEC-P0-003` | route/component/API/test | waiting for P0 close |
| `MW-DEC-P2-001` | `P2` | `runtime` | Dodac decision confidence scoring + contradiction detection. | `MW-DEC-P0-*`,`MW-DEC-P1-*` | component/API/test | waiting for P0 close |
| `MW-DEC-P2-002` | `P2` | `runtime` | Dodac automatyczne rekomendacje kanalu komunikacji (`Inbox` vs `ClickUp` vs `Slack/Teams`) z guardrailami. | `MW-DEC-P0-*`,`MW-DEC-P1-*` | route/component/API/test | waiting for P0 close |
| `MW-DEC-P2-003` | `P2` | `runtime/test` | Dodac dashboard jakosci komunikacji decyzji (latencja read-back, konflikty, SLA breaches). | `MW-DEC-P0-*`,`MW-DEC-P1-*` | route/component/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Decision communication contract is unified across `MW_DECISIONS`, `MW_INBOX`, `MW_TASKS` | `/my-work/decisions`, `/my-work/inbox`, `/my-work/tasks` | `MyWorkHub` + decision/inbox/tasks surfaces | shared my-work APIs and handoff contracts | sync checks in `MW-DEC-P0-005` | `PASS_WITH_P2` |
| ClickUp minimal decision contract is explicit and auditable | decision-to-inbox and decision-to-owner routing | decision handoff controls + inbox triage context | connector payload contract (`status`, `assignee`, `due`, `priority`, provenance, limits) | connector integration assertions pending | `MISSING` |
| External decision events enter via governed `Inbox` ingestion | inbox route and triage routes | inbox ingestion + decision linkage components | `external -> InboxItem -> triage -> decision/task` API chain | end-to-end ingestion suite pending | `MISSING` |
| Read-back tracker blocks success until owner confirmation | decision detail and owner-handoff return routes | read-back state indicators in decision/inbox/task views | owner read-back fields and status transitions | golden path in `MW-DEC-P0-005` | `PASS_WITH_P2` |
| Cross-module dependencies stay impact-only and traceable (`05`, `06`) | owner-module navigation paths from decisions | handoff dialogs expose target module and intent | candidate payload schema and dependency references | dependency linkage checks pending | `PASS_WITH_P2` |

## 10. Cross-Module Impact

- impacted modules:
  - `MW_TASKS` for executable task candidates from accepted decisions,
  - `MW_INBOX` for intake/provenance alignment of decision inputs,
  - `05_inicjatywy` for strategic decision outcomes,
  - `06_realizacja` for execution-ready decision outcomes.
- handoff changes: no runtime mutation in this cycle; docs-only hardening of candidate-only handoff and owner read-back chain.
- ownership impact: decisions remain owner of decision object review/lifecycle; downstream modules remain canonical owners for their entities.
- security/tenant impact: deny-by-default on uncertain ACL/tenant context; no hidden writes and no silent approval.
- E2E workflow impact: contract chain formalized as `decision context -> proposal -> approval -> explicit handoff -> owner review/read-back`.
- global contract updates needed: none for this docs-only cycle.

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
| Which minimum approval trigger set is mandatory for v1 decision actions (bulk close, ownership transfer, downstream conversion)? | user | 2026-05-24 | no |
| Should decision lifecycle include explicit SLA fields (`due_at`, `escalate_at`) as mandatory for high-impact items? | user | 2026-05-24 | no |
| Which owner-module read-back fields are required to mark handoff as complete in Decisions UI? | user | 2026-05-24 | no |

## 13. Registry Sync Note

- registry sync completed: `2026-05-10`
- synchronized artifacts:
  - `docs/modules/02_moja-praca/function-cards/MW_DECISIONS_EXECUTION_CARD.md`
  - `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/02_moja-praca/functions/MW_DECISIONS.md`
- scope_anchor integrity: `02_moja-praca/MW_DECISIONS`
