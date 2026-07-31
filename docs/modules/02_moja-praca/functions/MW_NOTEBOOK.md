---
module_id: MODULE_MY_WORK
function_id: MW_NOTEBOOK
function_name: Notes / Notatki
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Notes / Notatki

## 1. Function Identity

- Function ID: `MW_NOTEBOOK`
- Module: `02_moja-praca`
- UI labels/aliases: `Notatki` / `Notes`; hierarchy: `Notatnik` -> `Strona` -> `Bloki`; `Folder` is a deprecated legacy alias.
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/notebook"`
- Feature state: `real`
- Scope anchor posture: `MW_NOTEBOOK` is a function in My Work, never a standalone module.

## 2. User Job and Business Outcome

- User job: open `Notatki`, manage the notebook library, then capture, develop, verify and hand off knowledge from pages inside a selected notebook.
- Business outcome: preserve operational thinking without losing provenance, and convert only approved notes into actionable handoff.
- Non-goals:
  - Notebook is not canonical owner of initiatives/tasks/execution objects.
  - Notebook is not a hidden automation channel for downstream mutation.

## 3. Trigger and Entry Points

- Entry points: `Notatki` tab/button, folder list table view, deep-link path, context-open events.
- Preconditions: My Work access.
- Blocking conditions: ACL/tenant denial, restricted source scope, or missing permissions for linked context.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- Function runtime components: `NotebookContent`.
- Panel/tool controls: `WorkspacePanelStrip` (`tools/context/ai_suggestions` mapping).
- Component ownership notes:
  - `Notatki` opens folder registry table as level 1,
  - opening folder enters note-card workspace as level 2,
  - panel strip is shared Menu 3 command surface,
  - Notebook must not duplicate identical contextual AI actions in canvas and Menu 3.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields:
  - note id and note content,
  - source type (`manual`, `chat`, `file`, `link`, `voice` where available),
  - provenance metadata (`source_reference`, `confidence`, `assumption_flag`),
  - linked context ids (`idea`, `task`, `initiative`, project/client markers).
- Upstream modules/services:
  - `01_czat` as optional source input/provenance feed only,
  - My Work context and panel metadata.
- APIs/models: shared API client, notebook data shape, and cross-module candidate payload contracts.
- Data freshness assumptions:
  - note/editor state can refresh asynchronously,
  - linked context suggestions are proposal-level until explicitly approved.

## 6. Outputs and Side Effects

- Produced objects/artifacts:
  - folder records and folder-local note card updates,
  - proposal objects (idea/task/initiative candidates),
  - explicit source references for converted outputs.
- Downstream handoff:
  - `notebook -> MW_IDEAS` (idea candidate),
  - `notebook -> 05_inicjatywy` (initiative candidate),
  - `notebook -> 06_realizacja` (task/action candidate).
- Side effects visible to user:
  - folder table navigation (`open/create/select folder`),
  - note card create/edit/save and panel updates,
  - explicit handoff cards/status with owner-review pending posture.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: notebook notes and notebook-local metadata only.
- Handoff contract (`from -> to`):
  - Notebook emits explicit candidate payloads with source/provenance,
  - owner modules (`MW_IDEAS`, `05_inicjatywy`, `06_realizacja`) approve and mutate their canonical objects.
- Forbidden ownership:
  - no direct canonical write to initiatives/tasks/execution status from Notebook,
  - no hidden promotion of note content to shared memory without explicit policy and approval.

## 8. Runtime States and UX Behavior

- Loading:
  - folder table or folder workspace/context panels are loading.
  - next action: wait for load or switch to stable My Work tab.
- Empty:
  - no folders in table or no notes inside selected folder.
  - next action: create first folder, then create first note card.
- Error:
  - notebook operation failed; no raw internals shown.
  - next action: retry save/load or reopen notebook.
- Degraded:
  - partial context unavailable (source panel, linked objects, enrichment suggestions), but note editing remains available.
  - next action: continue manual edit or resolve missing source before handoff.
- Success:
  - folder/note update persisted and proposal metadata refreshed.
  - next action: continue editing in folder, mark assumptions, or explicitly hand off candidate.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3 right-side command slot (`WorkspacePanelStrip`) only.
- Source/provenance visibility:
  - each critical entry/candidate must show source/provenance posture,
  - if source is weak/missing, Notebook marks explicit `assumption` posture.
- AI posture:
  - AI enrichment and conversion are proposals,
  - `proposal != approved truth` until explicit user/owner acceptance.
- Approval/diff/review requirements:
  - high-impact conversion requires explicit approval before downstream handoff,
  - downstream owner module must confirm read-back before success is claimed.
- Audit trail/evidence:
  - notebook actions, source references, and handoff intent remain observable.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with My Work scope.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: tenant-scoped notebook records.
- Sensitive data masking/redaction: inherited from global/owner-module policy.
- Privacy/memory guard:
  - private/restricted notes are deny-by-default for broader context usage,
  - memory promotion remains explicit and policy-governed.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - `Notatki` action opens folder list in table layout.
  - selecting folder opens folder workspace with many note cards.
  - folder navigation preserves clear parent-child hierarchy (`Notatki` -> `Folder` -> `Karty notatek`).
  - Notebook state grammar (`loading/empty/error/degraded/success`) maps to explicit next actions.
  - Notebook high-impact conversions are explicit candidate handoff only.
  - Notebook communicates provenance/assumption posture for critical outputs.
  - Owner-module read-back is required before downstream success claim.
- Known `doc_gap`: detailed candidate payload checklist for each downstream owner module.
- Known `code_gap`: dedicated notebook E2E for proposal -> approval -> owner read-back is missing.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions:
  - weak provenance labels can allow assumption-as-fact drift,
  - missing read-back proof can overstate downstream completion,
  - panel complexity can hide next action if degraded state copy is weak.
- Open decisions:
  - minimum mandatory payload for each candidate handoff type,
  - final wording of degraded-state guidance in side panels.
- Change log:
  - introduced one extra IA level: `Notatki` table of folders before folder note-card workspace,
  - updated canonical naming from Notebook-first to Folder-first (`Notatki` as entry action),
  - hardened function boundary (`note` vs downstream canon),
  - locked AI posture (`proposal != approved truth`),
  - added explicit state/next-action and candidate-only handoff contract.
