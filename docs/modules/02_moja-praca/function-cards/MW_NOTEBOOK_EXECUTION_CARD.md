---
module_id: MODULE_MY_WORK
function_id: MW_NOTEBOOK
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_NOTEBOOK

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_NOTEBOOK`
- primary_module: `02_moja-praca`
- primary_function: `MW_NOTEBOOK`
- parent_function: `MW_NOTEBOOK`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: Notebook function contract, Notebook task rows, Notebook-specific evidence and handoff rules.
- Out of scope: other My Work functions, module-level mixed backlog work, runtime code.
- Allowed global documents: function dispatch protocol, function execution card template, RAW packet and RAW notebook/chat sources.
- Forbidden files: `src/**`, `server/**`, `tests/**`, any non-Notebook function docs.
- Immutable rule: Notebook is a working function inside `02_moja-praca`, not a separate module.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `01_czat` | source input provenance for chat-to-note and citation posture | treating chat as owner of Notebook objects |
| `MW_IDEAS` | explicit handoff target for idea candidates | mutating Ideas canon directly from Notebook |
| `05_inicjatywy` | candidate handoff impact definition | direct initiative lifecycle mutation |
| `06_realizacja` | candidate task handoff impact definition | direct task status/owner mutation |

## 4. Source Inputs

- RAW sources:
  - `docs/UI_UX/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md`
  - `docs/RAW/idea-notebook/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md`
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
  - `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
- module contracts:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md`
  - `docs/modules/02_moja-praca/04_UI_UX.md`
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`
- function contracts:
  - `docs/modules/02_moja-praca/functions/MW_NOTEBOOK.md`
- runtime evidence sources:
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/NotebookContent.tsx`

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Notebook identity in module | Notebook exists as My Work tab/function. | Notebook explicitly remains function of `02_moja-praca`. | Existing contract was too generic about module boundary. | `KEEP` | Prevent scope drift into fake standalone module. |
| Notebook boundary vs downstream ownership | Links and references are described, but boundary is broad. | Notebook owns working note object only; downstream objects stay canonical in owner modules. | Need stricter ownership language and anti-pattern lock. | `ENHANCE` | Protect tenancy and ownership governance. |
| Notebook IA depth and naming | Single-level Notebook naming is dominant. | Entry action `Notatki` opens folder table, then user enters selected folder with note cards. | Add one navigation level and explicit naming contract (`Folder`). | `ENHANCE` | Improves information architecture and scalability of note collections. |
| Source/provenance/assumption posture | Source mentions exist, but assumption behavior is not explicit. | Critical entries require source or explicit assumption marker before high-impact handoff. | Add mandatory evidence posture. | `ENHANCE` | Trust and hallucination control from RAW requirements. |
| UX states with next action | State list exists. | Loading/empty/error/degraded/success each define user-safe next action. | Add concrete next-action grammar per state. | `ENHANCE` | Avoid dead-end and silent degraded UX. |
| AI posture | Approval exists in general language. | `AI proposal != approved truth` is a hard invariant across notebook actions. | Add explicit no-hidden-approval rule. | `ENHANCE` | Prevent accidental canonical writes from AI suggestions. |
| Handoff posture | Cross-module references exist. | Notebook can create explicit candidates only (`idea/task/initiative`); owner modules review and mutate. | Tighten handoff semantics and success criteria. | `NEW` | Align with dependency scope and owner read-back doctrine. |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` + `NotebookContent` + `WorkspacePanelStrip`.
- Menu 2 surface: `Notatnik` tab in My Work.
- Menu 3 actions: contextual AI/organization actions in right-side command slot only; no duplicated canvas toolbar.
- AI action placement: Menu 3 right-side slot (`WorkspacePanelStrip` mapping), not separate canvas toolbar.
- runtime states:
  - `loading`: editor/context surfaces loading; next action = wait or move to stable tab.
  - `empty`: starter prompt for quick capture; next action = create note.
  - `error`: safe fallback and retry; next action = retry or reopen notebook.
  - `degraded`: panel/data source unavailable but core note editing stays active; next action = continue safe edit or resolve missing source.
  - `success`: note persisted with provenance posture visible; next action = keep editing or explicit handoff.
- source/provenance/evidence UI: note and extracted candidates show source type, confidence, and assumption marker when evidence missing.
- approval/review/diff behavior: candidate creation and high-impact conversion require explicit user approval and downstream owner review.
- anti-patterns:
  - treating AI suggestion as approved truth,
  - hidden write to downstream canonical objects,
  - implicit source promotion without user intent.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/MW_NOTEBOOK.md` | tighten boundary, provenance, state and handoff invariants | scope and trust hardening | `DONE` |
| `03_BEHAVIOR.md` | no update required in this cycle | existing module behavior remains coherent | `NOT_REQUIRED` |
| `04_UI_UX.md` | add notebook hierarchy contract (`Notatki` -> folder table -> folder workspace) | align IA and naming with owner decision | `DONE` |
| `07_ACCEPTANCE_AND_TESTS.md` | add notebook hierarchy acceptance and gap row | align acceptance with new P1 IA change | `DONE` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update required in this cycle | impact captured in this function card | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-NB-P0-001` | `P0` | `docs` | Normalize Notebook scope boundary and ownership contract (`note` vs downstream canonical objects). | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `MW-NB-P0-002` | `P0` | `docs/runtime` | Enforce quick-capture zero-friction rule (`capture first`, no mandatory pre-categorization). | `MW-NB-P0-001` | component/API/test | P0 governance baseline active |
| `MW-NB-P0-003` | `P0` | `docs/runtime` | Enforce source/provenance/assumption posture for critical entries and candidates. | `MW-NB-P0-001` | component/API/test | provenance gate active |
| `MW-NB-P0-004` | `P0` | `docs/runtime` | Enforce explicit candidate-only handoff gate (`notebook -> ideas/task/initiative`). | `MW-NB-P0-001` | API/test | no hidden downstream mutation |
| `MW-NB-P0-005` | `P0` | `docs/test` | Lock state machine (`loading/empty/error/degraded/success`) with mandatory next actions. | `MW-NB-P0-001` | route/component/test | state grammar complete |
| `MW-NB-P0-006` | `P0` | `test` | Require owner read-back confirmation before reporting downstream success. | `MW-NB-P0-002`,`MW-NB-P0-004` | API/test | read-back guarantee active |
| `MW-NB-P1-001` | `P1` | `docs/runtime` | Add review queue behavior for notes requiring decisions and evidence completion. | `MW-NB-P0-*` | component/API/test | waiting for P0 close |
| `MW-NB-P1-002` | `P1` | `docs` | Standardize candidate payload schema across Notebook handoff targets. | `MW-NB-P0-*` | API/test | waiting for P0 close |
| `MW-NB-P1-003` | `P1` | `docs/runtime` | Add chat-to-note provenance bridge contract for `01_czat` source inputs. | `MW-NB-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-NB-P1-004` | `P1` | `docs/runtime` | Add source scope controller (`conversation/private/project/team`) and retention posture. | `MW-NB-P0-*` | route/API/test | waiting for P0 close |
| `MW-NB-P1-005` | `P1` | `docs/runtime` | Add note type and confidence classification posture for candidate quality. | `MW-NB-P0-*` | component/API/test | waiting for P0 close |
| `MW-NB-P1-006` | `P1` | `docs/runtime` | Add duplicate/similarity hinting before high-impact conversion. | `MW-NB-P0-*` | component/test | waiting for P0 close |
| `MW-NB-P1-007` | `P1` | `docs/runtime` | Add extra hierarchy level: `Notatki` opens folder table, then selected folder opens note-card workspace. | `MW-NB-P0-*` | route/component/test | waiting for P0 close |
| `MW-NB-P2-001` | `P2` | `runtime/test` | Voice capture and transcript pipeline with source retention posture. | `MW-NB-P0-*`,`MW-NB-P1-*` | component/API/test | waiting for P0 close |
| `MW-NB-P2-002` | `P2` | `runtime/test` | Semantic search for notes with citation-first response posture. | `MW-NB-P0-*`,`MW-NB-P1-*` | route/API/test | waiting for P0 close |
| `MW-NB-P2-003` | `P2` | `runtime` | Controlled note-to-artifact converters (doc/table/presentation) as draft outputs. | `MW-NB-P1-001` | component/API/test | waiting for P0 close |
| `MW-NB-P2-004` | `P2` | `runtime/test` | Memory candidate workflow with approval and sensitivity policy. | `MW-NB-P1-002`,`MW-NB-P1-004` | API/test | waiting for P0 close |
| `MW-NB-P2-005` | `P2` | `runtime/test` | Weekly intelligence digest from notebook notes with evidence links. | `MW-NB-P1-001`,`MW-NB-P1-005` | route/component/test | waiting for P0 close |
| `MW-NB-P2-006` | `P2` | `runtime/test` | Note graph view for relationship context and safe cross-object exploration. | `MW-NB-P1-*` | route/component/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Notebook is a My Work function, not separate module | `/my-work/notebook` route mapping references | `MyWorkHub` tab orchestration + `NotebookContent` | shared my-work API boundary | function-level acceptance rows | `PASS` |
| Critical notebook outputs require source/provenance/assumption posture | My Work notebook route context | `NotebookContent` + panel strip context signals | linked source references in my-work services | current tests partial, dedicated test pending | `PASS_WITH_P2` |
| AI proposal is never approved truth by default | route-level notebook context | Notebook action controls + review flows | suggestion/extraction API contracts | coverage partial, explicit end-to-end pending | `PASS_WITH_P2` |
| Folder hierarchy is explicit (`Notatki` -> folder table -> note cards) | notebook route entry and nested view state | folder list/table + folder workspace components | notebook/folder list payload and folder open actions | dedicated flow test pending | `PASS_WITH_P2` |
| Handoff is candidate-only to Ideas/Initiatives/Execution | route to owner modules from My Work | explicit handoff controls in notebook context | downstream candidate APIs and owner-module read-back | owner read-back E2E missing | `MISSING` |

## 10. Cross-Module Impact

- impacted modules:
  - `01_czat`: chat-origin snippets can feed notebook capture with explicit provenance.
  - `MW_IDEAS`: notebook can emit idea candidates only.
  - `05_inicjatywy`: notebook can emit initiative candidates only.
  - `06_realizacja`: notebook can emit task/action candidates only.
- handoff changes: none in runtime; this cycle documents explicit candidate-only semantics.
- ownership impact: no ownership transfer; canonical mutation stays in owner modules.
- security/tenant impact: deny-by-default and scope/privacy posture preserved; no hidden memory promotion.
- E2E workflow impact: formal chain locked as `capture -> enrich proposal -> user approval -> explicit handoff -> owner read-back`.
- global contract updates needed: none for docs-only cycle.

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
| Which exact minimal candidate payload fields are mandatory for Notebook -> `05_inicjatywy` handoff in v1? | user | 2026-05-24 | no |
| Which state copy variants are required for degraded mode in Notebook side panels? | user | 2026-05-24 | no |
| Should UI keep legacy word `Notebook` as helper label after introducing `Folder` naming in `Notatki`? | user | 2026-05-24 | no |

## 13. Registry Sync Note

- registry sync completed: `2026-05-10`
- synchronized artifacts:
  - `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/02_moja-praca/function-cards/MW_NOTEBOOK_EXECUTION_CARD.md`
  - `docs/modules/02_moja-praca/functions/MW_NOTEBOOK.md`
  - `docs/modules/02_moja-praca/04_UI_UX.md`
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`
- scope_anchor integrity: `02_moja-praca/MW_NOTEBOOK`
