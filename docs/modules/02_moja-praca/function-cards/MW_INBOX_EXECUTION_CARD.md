---
module_id: MODULE_MY_WORK
function_id: MW_INBOX
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_INBOX

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_INBOX`
- primary_module: `02_moja-praca`
- primary_function: `MW_INBOX`
- parent_function: `MW_INBOX`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: Inbox function contract, Inbox task rows, Inbox-specific triage and handoff boundaries.
- Out of scope: runtime code, other primary functions in My Work, dependency module edits.
- Allowed global documents: function dispatch protocol, function card template, module behavior/UI/acceptance contracts.
- Forbidden files: `src/**`, `server/**`, `tests/**`, non-`MW_INBOX` function cards.
- Immutable rule: Inbox remains a function inside `02_moja-praca`, never a standalone module.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `01_czat` | provenance source for conversation-origin inbox items and context links | promoting chat runtime to owner of inbox triage state |
| `MW_TASKS` | owner-module handoff target for task items opened from inbox | mutating task canonical status from inbox without owner flow |
| `MW_DECISIONS` | owner-module handoff target for decision items opened from inbox | mutating decision canonical status from inbox without owner flow |
| `external PM connectors (ClickUp Tier B)` | define canonical Inbox ingestion payload and sync status semantics | treating connector events as canonical owner writes bypassing triage |

## 4. Source Inputs

- RAW sources:
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
- module contracts:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md`
  - `docs/modules/02_moja-praca/04_UI_UX.md`
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`
- function contracts:
  - `docs/modules/02_moja-praca/functions/MW_INBOX.md`
  - `docs/modules/02_moja-praca/functions/MW_TASKS.md`
  - `docs/modules/02_moja-praca/functions/MW_DECISIONS.md`
- runtime evidence sources:
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/InboxContent.tsx`
  - `src/components/MyWork/NotificationDetailView.tsx`
- previous decisions:
  - dependency scope stays impact-only for this docs cycle

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Dependency handoff readiness (`01_czat`/`MW_TASKS`/`MW_DECISIONS`) | Handoff/read-back exists as principle but dependency semantics are not fully normalized at task-board level. | Inbox package defines strict dependency-safe handoff semantics and read-back gates for task/decision triage from inbox context. | Need explicit scope lock for allowed dependencies only. | `ENHANCE` | Keeps dispatch integrity and removes forbidden-scope coupling. |
| Canonical `InboxItem` payload for external signals | Input semantics are generic. | Canonical payload includes source family, dedupe key, confidence, actionable/FYI, and owner-target intent (incl. ClickUp events). | Payload mapping for external PM events is incomplete. | `NEW` | Needed for predictable ingestion and triage quality. |
| Read-back contract | Read-back exists as principle but not fully normalized in this package. | Inbox cannot show canonical success before owner-module read-back confirmation. | Must promote read-back to hard P0 gate. | `ENHANCE` | Prevent false-success messaging. |
| Per-item sync status model | Degraded/error states are broad. | InboxItem exposes sync states (`synced/syncing/stale/conflict/error/dead_letter/not_linked`). | Missing object-level sync semantics for external PM interoperability. | `NEW` | Align Inbox behavior with sync doctrine. |
| External E2E chain | Partial evidence exists for internal handoff paths. | Baseline E2E path: `external event -> Inbox -> triage -> Tasks/Decisions -> owner read-back`. | End-to-end evidence is not standardized for this path. | `NEW` | Critical for trustworthy communication-to-action loop. |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` + `InboxContent` + `NotificationDetailView`.
- Menu 2 surface: `Skrzynka` tab in My Work.
- Menu 3 actions: right-side command slot for contextual AI/filter actions only.
- AI action placement: Menu 3 right slot only; no duplicated AI strip in inbox canvas.
- runtime states:
  - `loading`: list/counters loading; next action = wait or switch tab.
  - `empty`: no-items helper shown; next action = refresh, clear filters, or open owner context.
  - `error`: safe retry copy; next action = retry or reopen inbox.
  - `degraded`: partial counters/filters/source context flagged; next action = continue safe triage or open owner detail for verification.
  - `success`: status update/open-detail acknowledged; next action = continue triage or execute owner action.
- source/provenance/evidence UI: each inbox item displays source module/object identity and evidence posture.
- approval/review/diff behavior: high-impact transitions must route through owner module review/read-back.
- anti-patterns:
  - hidden mutation in owner modules directly from inbox row controls,
  - claiming owner-module success without read-back,
  - duplicated AI controls in content and Menu 3.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/MW_INBOX.md` | tighten ownership, provenance and handoff/read-back invariants | scope lock and dependency-safe routing | `DONE` |
| `03_BEHAVIOR.md` | no update required in this cycle | existing function runtime breakdown already contains `MW_INBOX` | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update required in this cycle | global My Work AI/state doctrine already covers inbox contract | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update required in this cycle | function-level acceptance row for inbox already exists | `NOT_REQUIRED` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update required in this cycle | this cycle is function-scope docs hardening only | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-INBOX-P0-001` | `P0` | `docs` | Define dependency-safe Inbox handoff doctrine for `01_czat`, `MW_TASKS`, and `MW_DECISIONS` (scope lock, provenance, owner boundary). | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `MW-INBOX-P0-002` | `P0` | `docs/runtime` | Define canonical `InboxItem` payload for external sources (including ClickUp): source family, external id, dedupe key, confidence, actionable posture, owner-target intent. | `MW-INBOX-P0-001` | component/API/test | canonical payload complete |
| `MW-INBOX-P0-003` | `P0` | `docs/runtime` | Lock read-back contract: Inbox cannot show canonical success before owner-module confirmation. | `MW-INBOX-P0-002` | route/component/API/test | read-back guarantee active |
| `MW-INBOX-P0-004` | `P0` | `docs/runtime` | Add per-item sync statuses for InboxItem (`synced/syncing/stale/conflict/error/dead_letter/not_linked`). | `MW-INBOX-P0-002` | component/API/test | sync state contract complete |
| `MW-INBOX-P0-005` | `P0` | `test` | Define baseline E2E chain: `external event -> Inbox -> triage -> Tasks/Decisions -> owner read-back`. | `MW-INBOX-P0-003`,`MW-INBOX-P0-004` | route/component/API/test | e2e contract complete |
| `MW-INBOX-P1-001` | `P1` | `docs/runtime` | Define ClickUp Tier B MVP mapping: list/folder, status, assignee, due-date sync semantics and limitations. | `MW-INBOX-P0-*` | API/test | waiting for P0 close |
| `MW-INBOX-P1-002` | `P1` | `docs/runtime` | Define deduplication and classification contract for InboxItem (`actionable` vs `FYI`) with deterministic rules. | `MW-INBOX-P0-*` | component/API/test | waiting for P0 close |
| `MW-INBOX-P1-003` | `P1` | `runtime/test` | Define conflict resolution UI + single-item replay flow for Inbox sync conflicts. | `MW-INBOX-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-INBOX-P1-004` | `P1` | `docs/runtime` | Define dependency handoff matrix from Inbox to `MW_TASKS` and `MW_DECISIONS` with explicit owner read-back and audit trail semantics. | `MW-INBOX-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-INBOX-P1-005` | `P1` | `docs/runtime` | Define Menu 3 `Sync Health` contract for connector depth, directionality, and limitations visibility. | `MW-INBOX-P0-004` | component/test | waiting for P0 close |
| `MW-INBOX-P2-001` | `P2` | `runtime/test` | Add bulk triage assistant with mandatory review/diff before apply. | `MW-INBOX-P1-002`,`MW-INBOX-P1-003` | component/API/test | waiting for P0 close |
| `MW-INBOX-P2-002` | `P2` | `runtime/test` | Add SLA/aging + escalation policy contract for InboxItem. | `MW-INBOX-P1-002`,`MW-INBOX-P1-005` | component/API/test | waiting for P0 close |
| `MW-INBOX-P2-003` | `P2` | `runtime/test` | Add cross-provider parity dashboard contract (`Jira`, `Asana/Monday`, `ClickUp`, `Linear`) with honest tier labeling. | `MW-INBOX-P1-001`,`MW-INBOX-P1-005` | route/component/API/test | waiting for P0 close |
| `MW-INBOX-P2-004` | `P2` | `runtime/test` | Add extended automation rules (auto-routing only for high-confidence with guardrails and explicit review boundaries). | `MW-INBOX-P1-002`,`MW-INBOX-P1-003` | component/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| External work is ingested as governed InboxItem with canonical payload | `/my-work/inbox` plus external ingress routes | `InboxContent` ingestion cards and metadata chips | canonical payload schema for external event mapping (incl. ClickUp) | payload contract and mapping tests | `PASS_WITH_P2` |
| Inbox success is blocked until owner read-back | inbox to owner detail route transitions | confirmation state in inbox row/detail view | owner response/read-back contract fields | e2e read-back chain tests | `PASS_WITH_P2` |
| InboxItem exposes explicit per-item sync status model | inbox route contexts and item state filters | sync-state badges and conflict views | sync status enum in API contract | sync state and conflict tests | `PASS_WITH_P2` |
| Inbox supports safe external-to-owner triage chain | route transitions across Inbox, Tasks, Decisions | triage actions and owner-open controls | handoff payload + audit trail fields | full external event chain e2e | `MISSING` |

## 10. Cross-Module Impact

- impacted modules:
  - `01_czat`: chat-origin context may enter inbox rows as source-linked items; no ownership transfer.
  - `MW_TASKS`: inbox routes task items to task owner flows and receives read-back signals.
  - `MW_DECISIONS`: inbox routes decision items to decision owner flows and receives read-back signals.
- handoff changes: no runtime changes in this cycle; task registry normalized for cross-module handoff and sync doctrine.
- ownership impact: inbox remains orchestration surface, owner modules remain canonical mutation points.
- security/tenant impact: deny-by-default and ACL boundaries preserved across handoff transitions.
- E2E workflow impact: chain locked as `external event -> inbox triage -> owner detail -> owner review/mutation -> read-back -> inbox confirmation`.
- global contract updates needed: none in this cycle; no forbidden-scope contract updates are planned from this card.

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
| Which minimal read-back payload fields are mandatory before Inbox can mark external handoff as successful? | user | 2026-05-24 | no |
| Which ClickUp custom fields are in-scope for Tier B mapping in v1 beyond status/assignee/due-date? | user | 2026-05-24 | no |
| Should conflict replay be user-triggered only, or also operator-triggered from support tooling? | user | 2026-05-24 | no |

## 13. Registry Sync Note

- registry sync completed: `2026-05-10` (normalized from unified P0/P1/P2 package)
- synchronized artifacts:
  - `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/02_moja-praca/function-cards/MW_INBOX_EXECUTION_CARD.md`
  - `docs/modules/02_moja-praca/functions/MW_INBOX.md`
- scope_anchor integrity: `02_moja-praca/MW_INBOX`
