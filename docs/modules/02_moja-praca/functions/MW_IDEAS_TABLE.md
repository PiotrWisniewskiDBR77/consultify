---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_TABLE
function_name: Ideas — Table / Tabele
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Table

## 1. Function Identity

- Function ID: `MW_IDEAS_TABLE`
- Module: `02_moja-praca`
- Parent function: `MW_IDEAS`
- UI labels/aliases: `Tabela`, `Table`, `table`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/ideas/:ideaId"` (+ deep link params `tpTable`, `tpView`)
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: structure idea content in tabular form for analysis and execution prep.
- Business outcome: cleaner operationalization, better filtering/comparison, easier conversion.
- Non-goals: table mode does not replace canonical ownership of external module entities.

## 3. Trigger and Entry Points

- Entry points: workspace tool switcher -> `table`; deep links with table/view hints.
- Preconditions: active idea workspace.
- Blocking conditions: none beyond ACL/tenant rules.

## 4. UI Component Footprint

- Top-level container/view components: `IdeaMapWorkspace`.
- Tool-specific runtime: `IdeaTableTool`.
- Supporting components: `IdeaWorkspaceToolbar`, table context bridge (`onTableContextChange`), workspace overlays.
- Component ownership notes: table platform components are tool-specific under shared idea workspace shell.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: idea graph/runtime, selected table id/view id, selection and focus state.
- Upstream modules/services: workspace graph runtime and table context sync.
- APIs/models: shared API + table runtime data dependencies.
- Data freshness assumptions: table context and graph state can update separately.

## 6. Outputs and Side Effects

- Produced objects/artifacts: table structures/rows tied to idea workspace context.
- Downstream handoff: explicit convert action into task set or other artifacts.
- Side effects visible to user: table edits, view changes, conversion initiation.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: idea workspace/table domain in this module context.
- Handoff contract (`from -> to`): explicit convert/export with source trace.
- Forbidden ownership: no hidden mutation of canonical objects in foreign modules.

## 8. Runtime States and UX Behavior

- Loading: table tool loads with workspace runtime and preferred view context.
- Empty: blank table guidance for first structure setup.
- Error: boundary-based failure state with retry.
- Degraded: partial table metadata/context may degrade while core view remains.
- Success: table edits persist and remain linked to idea context.
- Next action guidance per state: add columns/rows, score, convert selected data.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3 and workspace panels only.
- Source/provenance visibility: conversions and links carry source idea/table context.
- Approval/diff/review requirements: cross-module high-impact writes defer to owner governance.
- Audit trail/evidence: table-driven conversion and selection events are visible.

## 10. Security, Roles, and Tenancy

- Allowed roles: tenant users with idea workspace access.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: table data scoped per tenant/workspace.
- Sensitive data masking/redaction: follows global and object-level policies.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - table tool opens in idea workspace and honors deep-linked table/view context.
  - table context can be propagated back to workspace shell.
  - conversion remains explicit and source-aware.
- Code/runtime evidence:
  - `src/components/MyWork/IdeaMapWorkspace.tsx`
  - `src/components/MyWork/IdeaTableTool.tsx`
  - `src/components/MyWork/IdeaWorkspaceToolbar.tsx`
- Known `doc_gap`: full table capability matrix (forms/views/automations) needs dedicated sub-spec.
- Known `code_gap`: no single end-to-end contract test for idea-table conversion chain.

## 12. Open Risks and Change Log

- Risks/assumptions: table complexity may outgrow current function-level documentation granularity.
- Open decisions: canonical subset of table features mandatory in Ideas scope.
- Change log: initial subfunction contract created.
