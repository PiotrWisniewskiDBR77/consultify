---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_TABLE
function_name: Ideas — Table / Tabele
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Table

## 1. Function Identity

- Function ID: `MW_IDEAS_TABLE`
- Module: `02_moja-praca`
- Parent function: `MW_IDEAS`
- Function family: `Idea`
- UI labels/aliases: `Tabela`, `Table`, `Ideas Tables`, `AI Structured Thinking Table Engine`, `table`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/ideas/:ideaId"` (+ workspace/deep-link hints `tool=table`, `tpTable`, `tpView`)
- Feature state: `real`
- Contract scope: documentation-only hardening for the Idea Table format; this is not a separate module and does not modify runtime code.

## 2. User Job and Business Outcome

- User chooses Table when the idea material has enough repeated records, criteria, statuses, owners, risks, hypotheses or action candidates that comparison and prioritization matter more than spatial exploration.
- Primary job: turn unstructured ideas, notes, workshop material, interview findings, mind maps, whiteboard outcomes or process-flow outputs into a structured consulting artifact: register, matrix, decision table, risk register, hypothesis table, prioritization table or action list.
- Business outcome: the user can move from `chaos -> structure -> scoring -> decision -> initiative/task/artifact` with visible provenance, validation state and owner handoff boundaries.
- Use case boundary:
  - choose Table for row/field comparison, filtering, sorting, grouping, scoring, status review, ownership assignment, evidence completeness checks and downstream conversion;
  - choose Mind Map for relationship discovery and non-linear structure;
  - choose Process Flow for step/lane/sequence modeling;
  - choose Whiteboard for free-form facilitation and group synthesis.
- Non-goals:
  - not a mini-Excel, spreadsheet clone or generic database module;
  - not the canonical lifecycle owner for initiatives, tasks, execution statuses, documents, presentations or cross-module artifacts;
  - not an approval bypass for AI-generated values, merges, owner assignments or downstream mutations.

## 3. Trigger and Entry Points

- Entry points:
  - `MW_IDEAS` workspace tool switcher -> `table`;
  - deep links carrying `tpTable` and `tpView` hints;
  - cross-tool transform from mind map, whiteboard or process flow selections into tabular structure;
  - explicit conversion/reopen links from related table artifacts.
- Preconditions:
  - user has access to `02_moja-praca` and the selected idea workspace;
  - table records and source context are tenant-scoped;
  - any AI-enriched values remain draft/proposed until accepted by the user or owner flow.
- Blocking conditions:
  - ACL/tenant denial;
  - missing idea workspace context;
  - table/platform data unavailable or degraded;
  - high-impact conversion without explicit user approval and owner-module review path.

## 4. UI Component Footprint

- Top-level route/shell components:
  - `src/views/MyWorkView.tsx`;
  - `src/components/MyWork/MyWorkHub.tsx`;
  - `src/components/MyWork/IdeaMapWorkspace.tsx`.
- Tool-specific runtime:
  - `src/components/MyWork/IdeaTableTool.tsx`.
- Shared workspace controls:
  - `src/components/MyWork/IdeaWorkspaceToolbar.tsx`;
  - workspace table context bridge through `onTableContextChange`;
  - cross-tool transform boundary in `src/components/MyWork/transforms/crossToolTransform.ts`.
- Table platform/UI dependencies:
  - `src/components/MyWork/table/ViewRouter.tsx`;
  - `src/components/MyWork/table/TableToolbar.tsx`;
  - `src/components/MyWork/table/useTablePlatformIntegration.ts`;
  - table hooks/types under `src/components/MyWork/table/`.
- Component ownership notes:
  - `IdeaTableTool` is the local Idea Table orchestration surface;
  - table platform components are reusable table infrastructure;
  - AI and governance controls must appear in the active workspace Menu 3 / command-row right-side slot, not as a duplicated canvas toolbar.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields:
  - idea workspace id and idea metadata;
  - selected table id (`tpTable`) and view id (`tpView`);
  - rows, fields/columns, saved views, filters, sort/group configuration, selection/focus state;
  - source pack pointers from chat, notes, interview, uploaded files, mind map, whiteboard or process flow;
  - user intent: register, risk table, decision table, hypothesis table, prioritization matrix, action list or artifact output.
- Minimum table record model:
  - row id, row type, title/name, description, status, owner, priority, source refs, confidence, validation state, linked artifacts, created/updated metadata;
  - optional consulting fields: problem, hypothesis, evidence, counter-evidence, impact, effort, risk, expected value, dependencies, next step, due date, decision/recommendation.
- Column/field model:
  - text, long text, number, score, single/multi-select, status, owner/user, date, checkbox, source/evidence ref, linked object/artifact, formula/derived value, AI generated value, confidence, priority;
  - every column has id, label, type, required flag, allowed values or validation rule, visibility, provenance requirement and editability mode.
- View model:
  - grid/table view is mandatory;
  - saved views can define visible columns, filters, sorting, grouping, density and focus area;
  - `tpView` deep link must select a valid saved view or fall back honestly to default view.
- Dependencies:
  - `src/services/api.ts` for My Work idea conversion APIs;
  - `server/src/routes/my-work.routes.ts` for idea workspace, AI table actions, export and conversion boundaries;
  - `server/src/routes/table-platform.routes.ts` for table platform artifact/deep-link boundary;
  - table hooks and table platform integration under `src/components/MyWork/table/`.
- Data freshness assumptions:
  - idea graph state, table rows, saved views and presence/AI metadata can refresh independently;
  - UI must show degraded or stale context honestly when only part of the table runtime is current.

## 6. Outputs and Side Effects

- Produced objects/artifacts:
  - table artifact inside the Idea workspace;
  - structured rows, columns, views, filters, grouping, score fields and validation state;
  - source-aware candidates for tasks, initiatives, decisions, documents, presentations, roadmap items, risk registers or action plans.
- Side effects visible to user:
  - table edits and view changes;
  - AI value proposals, fill/enrichment proposals, duplicate/merge proposals and their approval state;
  - CSV/export initiation;
  - conversion/handoff initiation.
- Downstream handoff:
  - `table -> task/action`: explicit candidate creation with source row(s), owner, due date, acceptance criteria;
  - `table -> initiative`: explicit initiative proposal with problem, expected value, KPI, risk, dependencies and source rows;
  - `table -> workflow/process`: explicit conversion to process-flow/action plan context;
  - `table -> artifact`: explicit handoff to document/presentation/output lanes with selected rows and evidence refs.
- Table success cannot be represented as downstream mutation success until the owner module confirms write/read-back.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects inside this function:
  - Idea Table artifact, local rows/fields/views and table context are owned by `02_moja-praca` / `MW_IDEAS_TABLE`.
- Foreign owner boundaries:
  - conversation canon remains owned by `01_czat`;
  - initiative lifecycle remains owned by `05_inicjatywy`;
  - execution task/status lifecycle remains owned by `06_realizacja`;
  - document, table-studio, presentation and output artifacts remain owned by their target modules/lane contracts when promoted.
- Handoff contract:
  - `MW_IDEAS_TABLE -> MW_IDEAS_MINDMAP|MW_IDEAS_PROCESS_FLOW|MW_IDEAS_WHITEBOARD`: preserve selected rows, source refs, field semantics and transform intent;
  - `MW_IDEAS_TABLE -> 05_inicjatywy`: send initiative candidate payload, not canonical initiative mutation;
  - `MW_IDEAS_TABLE -> 06_realizacja`: send task/action candidates, not execution status mutation;
  - `MW_IDEAS_TABLE -> artifact lanes`: send selected rows and evidence bundle for owner review.
- Forbidden ownership:
  - no silent creation of canonical initiatives/tasks;
  - no silent status or owner assignment in downstream modules;
  - no hidden AI acceptance, duplicate merge or field overwrite without review.

## 8. Runtime States and UX Behavior

- Loading:
  - table tool loads workspace runtime, selected table and selected view;
  - UI must distinguish loading table data from saving/applying AI proposals.
- Empty:
  - blank table guidance asks for table purpose and first structure;
  - suggested starts: idea register, risk register, decision table, hypothesis table, prioritization matrix, action list.
- Error:
  - safe error copy with retry/reopen path;
  - no raw backend traces or internal tenant/service details in canvas.
- Degraded:
  - stale rows, missing view, partial source pack, unavailable AI enrichment or permission-limited source refs must be visible;
  - core manual editing can continue only if data integrity is not at risk.
- Success:
  - table is editable, source-aware and ready for scoring, filtering, grouping or explicit conversion;
  - selected rows can be transformed or handed off with visible evidence bundle.
- Sort/filter/group behavior:
  - sort must preserve row identity and provenance;
  - filters must clearly show active conditions and empty-filter result state;
  - grouping must be explicit by a selected field, not hidden inferred clustering;
  - saved view state must not obscure which rows are outside current filters.
- Status behavior:
  - row status examples: `draft`, `proposed`, `needs_evidence`, `review_ready`, `approved`, `converted`, `rejected`, `archived`;
  - AI value status examples: `fact`, `inferred`, `assumption`, `recommendation`;
  - high-impact rows cannot move from `proposed` to `approved/converted` without explicit review.
- Next action guidance per state:
  - loading -> wait or reopen idea list;
  - empty -> choose table type or import from source pack;
  - error -> retry or return to Ideas;
  - degraded -> resolve missing source/permission/view context;
  - success -> score, validate, filter/group, approve proposals or convert selected rows.

## 9. AI, Source, Evidence, Approval

- AI action placement:
  - contextual AI actions for Table belong in Menu 3 / active workspace command row right-side slot;
  - allowed actions: generate table from prompt/source pack, classify rows, enrich missing fields, score rows, detect duplicates, propose merge, summarize table, create handoff candidates, explain evidence gaps;
  - the same AI action must not be duplicated inside the table canvas/workspace as a second toolbar.
- Source/provenance visibility:
  - every important row and every important field value must either reference source/evidence or be marked as assumption;
  - provenance levels: `user-authored`, `AI-suggested`, `imported/source-backed`, `derived/calculated`, `owner-approved`;
  - field-level provenance is required for AI-enriched values, scores, recommendations, owner suggestions and high-impact statuses.
- Validation and data integrity:
  - required fields must be visible and block conversion if absent;
  - score formulas/weights must be inspectable;
  - linked records/artifacts must not point across tenant boundaries;
  - duplicate merge must preserve source refs from all merged records and show diff before approval;
  - AI overwrite of user-authored values requires diff/review.
- Approval/diff/review:
  - AI generated tables and values start as proposal/draft;
  - high-impact conversions to initiative/task/workflow require explicit user confirmation plus owner-module review/read-back;
  - merge, bulk edit, owner assignment, status conversion and downstream creation require visible approval path.
- Audit evidence:
  - table creation, schema change, AI fill, scoring, duplicate merge, export and conversion events must be traceable where runtime supports activity logging.

## 10. Security, Roles, and Tenancy

- Allowed roles: tenant users with access to My Work and the selected idea workspace.
- Denied/restricted roles: ACL denied users, users without source-object access, users blocked by pilot/feature policy.
- Tenant/ACL scope:
  - row, field, source, attachment and linked artifact data remains tenant-scoped;
  - table views must not leak hidden rows or restricted source refs through counts, AI summaries, exports or handoff payloads.
- Sensitive data masking/redaction:
  - inherited from source object ACL and global policy;
  - AI enrichment must not expose raw restricted evidence in visible generated fields.
- Security failure behavior:
  - deny by default;
  - show honest restricted/degraded state;
  - no hidden fallback to broader source scope.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Table opens as an Idea format inside `02_moja-praca`, not as a separate module.
  - Table honors idea workspace context and deep-linked `tpTable` / `tpView`.
  - User can model rows, columns/field types, saved views, sort/filter/group state and statuses.
  - Critical rows/fields expose source/provenance or explicit assumption state.
  - AI table actions are proposals with visible placement in Menu 3/right command row and no duplicated canvas toolbar.
  - Validation prevents unsafe conversion when required fields, owner, status or evidence are missing.
  - Table handoff to tasks, initiatives, workflow/process or artifacts is explicit and carries source rows/evidence.
  - Downstream owner mutation is not claimed until owner module read-back confirms it.

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Table is an Idea format inside `02_moja-praca`, not a separate module | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx` | `src/services/api.ts` (`/my-work/my-ideas/*` boundary) | `tests/navigation/routeMapping.test.ts`, `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx` | pass |
| Table mode opens from idea workspace and honors `tpTable` / `tpView` | `src/routes/AppRoutes.tsx` + My Work route scope | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaTableTool.tsx`, `src/components/MyWork/table/ViewRouter.tsx` | `server/src/routes/table-platform.routes.ts`, `server/src/routes/my-work.routes.ts` | `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx` | pass |
| Table supports columns, field types, views, sort/filter/group and status modeling | `src/routes/routeConfig.ts` (`MY_WORK`) | `src/components/MyWork/IdeaTableTool.tsx`, `src/components/MyWork/table/TableToolbar.tsx`, `src/components/MyWork/table/useTablePlatformIntegration.ts` | `server/src/routes/table-platform.routes.ts`, `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/ai-table-action`, `/ai-fill`, `/export-csv`) | `tests/unit/table/useTableSchema.test.ts`, `tests/unit/table/useTableRows.test.ts`, `tests/unit/table/useTableViews.test.ts`, `tests/unit/table/tableTypes.test.ts` | pass |
| Source/provenance and AI honesty are visible before approval/handoff | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaTableTool.tsx`, table proposal/assistant components under `src/components/MyWork/table/` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/ai-suggestions`, `/my-ideas/:id/ai-table-action`, `/my-ideas/:id/ai-fill`, `/my-ideas/:id/activity`) | `tests/components/MyWork/IdeaTableTool.honesty.test.tsx`, `tests/unit/table/AITableProposal.test.tsx`, `tests/unit/table/AITableAssistant.test.tsx` | pass |
| Cross-tool transform preserves table context and provenance intent | `src/routes/AppRoutes.tsx` + workspace routing through My Work lane | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/transforms/crossToolTransform.ts`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map`, `/my-ideas/:id/map/sync`, `/my-ideas/:id/activity`) | `tests/unit/mywork/crossToolTransform.test.ts`, `tests/unit/table/conversion.test.ts` | pass |
| Handoff to downstream task/initiative/workflow/artifact remains explicit and source-aware | `src/routes/AppRoutes.tsx` + module transition flow | `src/components/MyWork/IdeaTableTool.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx` | `src/services/api.ts` (`convertIdea`, outcome conversion), `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/outcomes/:outcomeId/convert`) | `tests/integration/routes/my-work.test.js`, `server/scripts/smoke-v5-ideas-workspace-e2e.ts` | partial (`owner_read_back_gap`) |
| Runtime states are honest for loading/empty/error/degraded/success | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaTableTool.tsx`, `src/components/MyWork/table/` hooks/components | `server/src/routes/my-work.routes.ts`, `server/src/routes/table-platform.routes.ts` | `tests/components/MyWork/IdeaTableTool.honesty.test.tsx`, `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx` | partial (`state_coverage_mixed`) |

- Known `doc_gap`: canonical table template catalog for Idea Table modes (idea register, risk register, decision table, hypothesis table, prioritization matrix, action list) is not yet extracted into a separate reusable sub-spec.
- Known `code_gap`: no single end-to-end test proves the complete chain `table proposal -> user approval -> convert -> owner-module read-back`.
- Known `code_gap`: Menu 3-only AI placement for all table AI actions still requires runtime/UI audit beyond this documentation update.

## 12. Open Risks and Change Log

- Risks/assumptions:
  - table complexity can grow into a separate product surface, but within `02_moja-praca` it remains an Idea format unless explicitly promoted by a future governance decision;
  - runtime support for every target table mode and governance rule is not proven by one end-to-end suite;
  - table-to-downstream owner read-back is partially evidenced but not fully automated.
- Open decisions:
  - exact canonical template catalog and default columns per table mode;
  - exact Menu 3 right-slot action set for Table AI controls;
  - minimum evidence package required before converting a table row into an initiative/task/workflow.
- Change log:
  - 2026-05-10: expanded from skeletal subfunction contract into full Idea Table contract with use-case boundary, data model, validation/provenance, Menu 3 AI placement, handoff and evidence matrix.
