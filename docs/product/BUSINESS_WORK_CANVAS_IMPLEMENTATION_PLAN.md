# Business Work Canvas Implementation Plan

Status: `DRAFT / IMPLEMENTATION PLAN`
Owner: Product + Engineering
Created: 2026-05-03
Parent doctrine: `docs/product/BUSINESS_WORK_CANVAS_CANON.md`
Related blueprint: `docs/product/CANVAS_INTERACTIVITY_RESEARCH_AND_IMPLEMENTATION_BLUEPRINT.md`

## 1. Purpose

This document turns the Business Work Canvas doctrine into a staged implementation plan.

The plan must deliver a Claude-quality work surface while preserving the strongest Consultify advantage: business context, governed conversion and downstream execution.

The implementation rule:

```text
do not replace the Canvas runtime in one rewrite; extend it in gated layers
```

Every phase must end with a quality gate. No phase should ship if it breaks conversation continuity, draft persistence, artifact lineage, version history or existing workspace actions.

## 2. Implementation Principles

### 2.1 Context Must Never Be Lost

The user must be able to move between chat, Canvas, draft versions, artifact blocks and downstream objects without losing:

- active `conversationId`,
- active Canvas `draftId`,
- selected document context,
- selected block context,
- document title,
- Markdown projection,
- native JSON source when present,
- version history,
- source provenance,
- downstream links to Idea, Note, Decision, Initiative, Task, Report or Presentation.

### 2.2 Additive Before Replacive

The existing Canvas already supports:

- split chat/work panel,
- Markdown document state,
- save/autosave,
- version snapshots,
- share,
- restore,
- selected context,
- workspace/output actions.

The implementation should extend this foundation with blocks, renderers and business conversions. Full editor replacement, sandbox execution and team workflow should come later and only after the data contract is stable.

### 2.3 Feature Flags For Risky Runtime

The following should be feature-gated:

- native artifact blocks before full migration,
- Vega-Lite charts,
- Mermaid diagrams,
- TipTap/ProseMirror editor,
- dashboard composition,
- file analysis,
- external share/public publish,
- any execution/sandbox runtime,
- collaboration/workflow runtime.

### 2.4 Markdown Projection Is The Safety Net

Every new native artifact must provide a Markdown projection. If the native renderer fails, Canvas must still show a readable business fallback.

No stage passes a quality gate if raw JSON leaks into the business UI.

## 3. Target Architecture In Layers

```text
Layer 1: Shell
UnifiedChatPanel + WorkCanvasDocumentPanel + shared context

Layer 2: Document
Markdown source/projection + title + lifecycle + versions

Layer 3: Artifact Blocks
table/chart/diagram/decision/research/dashboard blocks

Layer 4: Renderers
Markdown, native table, Vega-Lite, Mermaid, dashboard composition

Layer 5: AI Operations
replace/update/append + insert/update/convert block operations

Layer 6: Business Conversions
Idea, Note, Decision, Initiative, Task, Report, Presentation, KPI candidate

Layer 7: Workflow Runtime
research/data analysis/refresh/collaboration/audit ledger
```

## 4. Stage 0: Baseline Audit And Context Lock

Goal: freeze the current Canvas behavior as a safety baseline before adding new capabilities.

### Tasks

- Inventory current Canvas files:
  - `src/components/AIChat/UnifiedChatPanel.tsx`
  - `src/components/AIChat/WorkCanvasDocumentPanel.tsx`
  - `src/components/AIChat/CanvasMarkdownRenderer.tsx`
  - `src/types/canvasWorkspace.ts`
  - `src/services/api.ts`
  - `server/src/routes/work-canvas.routes.ts`
- Document the current data flow:
  - chat message -> stream context,
  - active Canvas document,
  - draft save/autosave,
  - version snapshot,
  - share,
  - restore,
  - workspace/output actions.
- Add or update baseline tests that prove the current behavior still works.
- Create a context preservation checklist used by all later phases.
- Identify existing non-Canvas build errors separately so they do not hide Canvas regressions.

### Quality Gate 0

Pass conditions:

- Opening Canvas does not create a second chat.
- Sending a chat message while Canvas is open includes active Canvas context.
- Autosave and manual save still persist `draftId`, title and Markdown content.
- Version history and restore work for a basic document.
- Existing actions still work: save as note, send to idea, create initiative, create report/table/presentation.
- Targeted Canvas component/API tests pass.
- Known non-Canvas build issues are documented separately.

Fail conditions:

- Any context mismatch between active conversation and active Canvas draft.
- Any regression in existing save/share/version/restore behavior.
- Any UI path where a user sees raw internal payloads.

## 5. Stage 1: Premium Work Surface

Goal: make the existing Canvas feel like a stable, premium, Claude-like artifact surface before adding complex block types.

### Tasks

- Refine right-panel shell:
  - compact topbar,
  - editable title,
  - coherent dark mode,
  - stable split resizing,
  - no noisy context chrome,
  - document area aligned with chat input.
- Finalize topbar groups:
  - create/new,
  - output actions,
  - workspace actions,
  - file actions,
  - view/actions,
  - diagnostics/version menu.
- Improve document empty state with DBR77-friendly prompts.
- Improve diagnostics menu:
  - lifecycle,
  - format,
  - projection status,
  - versions,
  - show changes,
  - retry/reset.
- Add visual states:
  - unsaved,
  - saving,
  - failed,
  - stale projection,
  - action running.
- Add focused component tests for layout and topbar actions.

### Quality Gate 1

Pass conditions:

- Canvas visually reads as one application with chat in light and dark mode.
- User can rename a draft, save it and see the name persist after refresh.
- Save state is visible but not noisy.
- Selection context works without persistent selected-context UI.
- Resize edge works and does not break chat input.
- All existing Canvas actions remain accessible.

Fail conditions:

- Canvas feels like a modal/sidebar rather than a work surface.
- Chat input or Canvas document area becomes misaligned again.
- Action buttons are present but not wired to honest availability states.

## 6. Stage 2: Artifact Block Contract

Goal: add the typed block model that enables tables, charts, diagrams, dashboards and research packs without replacing Markdown documents.

### Tasks

- Extend shared Canvas types:
  - `CanvasArtifactBlock`,
  - block kind,
  - block status,
  - block capabilities,
  - block provenance,
  - block projection status.
- Extend document state/envelope with optional `blocks`.
- Extend backend draft persistence with a nullable block JSON field or envelope-compatible structure.
- Add block-aware serialization/deserialization.
- Add Markdown projectors for:
  - table block,
  - chart block,
  - diagram block,
  - decision block,
  - research block.
- Add block-level version snapshots.
- Add validators for block schema versions.
- Keep backward compatibility for existing Markdown-only drafts.

### Quality Gate 2

Pass conditions:

- Existing Markdown-only drafts load unchanged.
- A draft can contain `contentMd` and `blocks`.
- Every block has a readable Markdown projection.
- Failed/stale projection states display honest degraded UI.
- Version snapshots include enough data to restore blocks and Markdown projection.
- No raw JSON appears in document view.

Fail conditions:

- Existing drafts require migration before opening.
- Block data can be saved without projection status.
- Restoring an older version loses blocks or content.

## 7. Stage 3: Native Tables, Charts And Diagrams

Goal: deliver the first visible interactivity comparable to Claude/Gemini/Manus, but focused on business use.

### Tasks

- Implement native table renderer:
  - sort,
  - filter,
  - copy,
  - CSV export,
  - row selection,
  - summary/provenance display.
- Implement chart renderer:
  - Vega-Lite JSON spec,
  - `vega-embed`,
  - chart fallback to Markdown summary,
  - safe error state.
- Implement Mermaid diagram renderer:
  - safe rendering,
  - fallback to source and explanation,
  - export/copy where practical.
- Add Canvas actions:
  - create table from selection,
  - create chart from table/selection,
  - create diagram from selection,
  - summarize table,
  - explain chart,
  - convert rows to action candidates.
- Add tests for table/chart/diagram blocks and projections.

### Quality Gate 3

Pass conditions:

- User can turn selected content into a table.
- User can turn a table into a chart.
- User can turn process text into a diagram.
- All generated blocks include title, source context, projection and provenance.
- Renderer failure never breaks the document.
- Export/copy actions preserve business-readable content.

Fail conditions:

- Renderers require raw technical knowledge from the user.
- Chart/table/diagram blocks become disconnected from chat context or draft version.
- A broken renderer blanks the Canvas.

## 8. Stage 4: Business Transformations

Goal: make Canvas choose the right business form based on user intent.

### Tasks

- Add block-aware AI operation endpoint:
  - insert block,
  - update block,
  - delete block,
  - convert block,
  - generate block from selection,
  - regenerate projection.
- Add operation preview model:
  - proposed change,
  - affected blocks,
  - Markdown diff,
  - approval requirement,
  - validation result.
- Add transformations:
  - note -> decision memo,
  - conversation -> report,
  - report -> presentation outline,
  - table -> chart,
  - table rows -> initiative/task candidates,
  - research notes -> source table,
  - risks -> risk matrix.
- Add UI for proposal/apply/reject.
- Add audit records for approved operations.

### Quality Gate 4

Pass conditions:

- User can request a transformation using business language.
- Teresa proposes a form when intent is ambiguous.
- User sees what will change before durable mutation.
- Accepted transformations create version snapshots and audit records.
- Rejected transformations leave draft unchanged.
- Chat context after transformation includes updated Canvas state.

Fail conditions:

- AI silently changes durable artifact data without approval.
- Transformations overwrite newer autosaved content.
- User cannot understand what changed.

## 9. Stage 5: Research And Decision Workspace

Goal: build the Consultify advantage: evidence-based business decisions and research outputs.

### Tasks

- Add research block type:
  - research question,
  - hypotheses,
  - sources,
  - facts,
  - contradictions,
  - confidence,
  - gaps,
  - implications,
  - recommendations.
- Add decision block type:
  - decision question,
  - options,
  - criteria,
  - scoring,
  - assumptions,
  - risks,
  - recommendation,
  - approval status.
- Add UI renderers for:
  - source table,
  - evidence map,
  - decision matrix,
  - recommendation card,
  - risk/impact matrix.
- Add conversions:
  - research -> report,
  - research -> deck outline,
  - research -> decision memo,
  - decision -> initiative,
  - decision -> task/KPI follow-up.
- Add tests for confidence/source/limitations display.

### Quality Gate 5

Pass conditions:

- Research output shows sources, confidence and limitations.
- Decision output shows options, criteria, risks and recommendation.
- Any recommendation can be traced back to source material or explicit assumptions.
- Conversion to decision/initiative requires user approval.
- The resulting target object has lineage back to Canvas and conversation.

Fail conditions:

- Research produces unsupported claims without visible uncertainty.
- Decision outputs hide assumptions or trade-offs.
- Downstream objects lose source lineage.

## 10. Stage 6: Output Library And Export Maturity

Goal: make Canvas outputs durable and usable outside Canvas.

### Tasks

- Mature output creation:
  - report,
  - presentation,
  - table,
  - dashboard,
  - decision memo.
- Add export paths:
  - Markdown,
  - PDF,
  - DOCX,
  - CSV,
  - XLSX,
  - PPTX.
- Add shareable Canvas/output links with permissions.
- Add output metadata:
  - owner,
  - lifecycle,
  - source draft,
  - created from,
  - version,
  - approved/final status.
- Add "open in source Canvas" from output detail.
- Add tests for exports and permission states.

### Quality Gate 6

Pass conditions:

- Each exported output is readable outside the app.
- Output metadata preserves source and version.
- Shared links respect organization permissions.
- Export failures are recoverable and user-readable.
- Existing report/table/presentation actions still work.

Fail conditions:

- Exported documents lose key context, assumptions or sources.
- Share links expose data beyond intended permission scope.
- Output library duplicates Canvas data without lineage.

## 11. Stage 7: Data Analysis And Dashboard Runtime

Goal: approach ChatGPT Data Analysis and Manus Data Viz for business users without unsafe arbitrary execution.

### Tasks

- Add dataset upload/import flow:
  - CSV,
  - XLSX,
  - JSON,
  - selected PDF tables where feasible.
- Add dataset profiling:
  - columns,
  - types,
  - missing values,
  - row count,
  - sample preview.
- Add data-to-artifact actions:
  - create table,
  - create chart,
  - create KPI dashboard,
  - create findings report.
- Add controlled analysis jobs:
  - first deterministic/server-side transformations,
  - later isolated Python job adapter if needed.
- Add analysis log:
  - question,
  - dataset,
  - steps,
  - outputs,
  - limitations.
- Add dashboard renderer:
  - KPI cards,
  - chart grid,
  - table section,
  - narrative insight,
  - recommended actions.

### Quality Gate 7

Pass conditions:

- Uploaded dataset never breaks chat or Canvas context.
- User can generate table/chart/dashboard/report from dataset.
- Analysis output includes data limitations.
- Analysis can be rerun without losing prior version.
- Any code execution, if introduced, is isolated, timed out and audited.

Fail conditions:

- Arbitrary execution is exposed without isolation.
- Dataset artifacts cannot be traced to uploaded file/version.
- Dashboard produces charts without explaining business meaning.

## 12. Stage 8: Team Workflow Runtime

Goal: move toward Manus-like operating workspace while staying business-governed.

### Tasks

- Add workflow run object:
  - id,
  - draftId,
  - conversationId,
  - steps,
  - approvals,
  - outputs,
  - status.
- Add step ledger renderer:
  - Teresa action,
  - user approval,
  - generated artifact,
  - failed/retried step,
  - downstream conversion.
- Add reusable workflows:
  - market research to report,
  - meeting note to initiatives,
  - KPI review to dashboard,
  - client proposal to deck,
  - decision memo to execution plan.
- Add collaboration preparation:
  - comments,
  - ownership,
  - reviewer,
  - lifecycle.
- Add recurring refresh for selected dashboards/reports only after permissions and lineage are stable.

### Quality Gate 8

Pass conditions:

- Workflow ledger explains how output was produced.
- User can resume a workflow without losing context.
- Approval checkpoints are visible and enforced.
- Generated outputs link back to workflow steps.
- Collaboration metadata does not conflict with single-user Canvas behavior.

Fail conditions:

- Agent/workflow actions happen silently.
- Resuming a workflow attaches to the wrong conversation or draft.
- Workflow refresh overwrites manually edited artifacts without review.

## 13. Context Preservation Strategy

### 13.1 Context Objects

Every implementation phase must preserve these context anchors:

| Context           | Required anchor                    |
| ----------------- | ---------------------------------- |
| Conversation      | `conversationId`                   |
| Canvas draft      | `draftId`                          |
| Document version  | `versionId`                        |
| Artifact block    | `blockId`                          |
| Selection         | offsets and selected text snapshot |
| Source file       | file id and content hash/version   |
| Downstream object | target id and target type          |
| Workflow          | `workflowRunId` and step id        |

### 13.2 Context Packet For Teresa

When chat sends a request while Canvas is open, the context packet should include:

- active draft id,
- active draft title,
- current document kind,
- current Markdown projection,
- selected text if present,
- selected block summary if present,
- source/provenance references,
- linked downstream objects,
- pending operation if present.

Do not send raw block JSON unless the requested operation requires it. Prefer Markdown projection plus block summaries.

### 13.3 Migration Rules

- Existing Markdown-only drafts remain valid.
- New block fields are optional until Stage 2 is complete.
- Any migration must be idempotent.
- Migration must not rewrite user-authored Markdown unless explicitly required.
- Projection rebuild failures must mark `stale` or `failed`, not delete content.
- Version restore must restore both Markdown and block state.

### 13.4 Autosave And Race Conditions

Autosave must protect against:

- overwriting newer user edits with stale operation responses,
- restoring old versions while autosave is pending,
- applying AI operation to outdated content,
- replacing selection after selection changed,
- block update after block was deleted.

Required safeguards:

- operation base version,
- latest content ref,
- abort/cancel pending save on restore,
- server-side updatedAt/version check,
- conflict message with retry/rebase path.

### 13.5 Testing Context Preservation

Every phase must include at least one regression test for:

- open Canvas -> send chat -> context includes active draft,
- edit Canvas -> autosave -> refresh/load -> content survives,
- apply operation -> version snapshot -> restore,
- create downstream object -> lineage exists,
- renderer failure -> Markdown fallback remains visible.

## 14. Phase Execution Discipline

Each implementation phase should follow this loop:

```text
1. audit current behavior
2. implement smallest contract change
3. add runtime UI
4. add backend persistence/API
5. add tests
6. run quality gate
7. document known gaps
8. only then proceed
```

No phase should start with UI only. Every visible Canvas feature must have:

- data contract,
- persistence,
- projection,
- version behavior,
- user-facing fallback,
- test coverage.

## 15. Recommended First Engineering Package

Start with Stage 0, Stage 1 and Stage 2 as the first implementation tranche.

Reason:

- Stage 0 protects current behavior.
- Stage 1 locks the Claude-like work surface.
- Stage 2 creates the contract that all future table/chart/decision/research/dashboard work depends on.

Do not start with TipTap, data analysis or workflow runtime. Those are high-value but should wait until block persistence and projection are stable.

## 16. Master Quality Gate Before Broad Rollout

Business Work Canvas can be considered ready for broader DBR77 usage only when:

- a user can open chat + Canvas and never lose conversation context,
- a user can draft a document and trust autosave/version restore,
- a user can create table/chart/diagram blocks with Markdown fallback,
- a user can convert Canvas output to at least Note, Idea, Initiative, Report and Presentation,
- every durable output has lineage,
- no raw JSON leaks into business UI,
- dark mode and layout are coherent,
- failed operations are recoverable,
- tests cover context, persistence, projection, versioning and conversion.

## 17. Final Five-Stage Completion Plan

Status: `MANDATORY COMPLETION TRACK`

The audit after Stage 9 showed that the Canvas core runtime is real and broadly implemented, but the full product promise is not complete until the remaining production gaps are closed without shortcuts.

This final track converts the five highest-priority gaps into five implementation stages. Each stage must preserve the original Canvas invariant:

```text
Markdown-first, JSON-when-native, always Markdown projection, no lost context.
```

### 17.1 Stage 10: Conflict-Safe Persistence And Operation Hardening

Goal: make Canvas trustworthy under real editing conditions: autosave, manual save, version restore and governed operations must not overwrite newer user work.

#### Scope

- Add explicit draft revision metadata to frontend and backend:
  - `baseUpdatedAt`,
  - optional `baseVersionId`,
  - latest known draft `updatedAt`,
  - operation base draft timestamp.
- Extend draft save/update API so callers can send a base revision.
- Extend governed operation API so transformations are applied only against the draft revision the user previewed.
- Extend version restore API so restore can detect that the user has unsaved or newer content.
- Add server-side conflict detection:
  - stale `updatedAt`,
  - stale operation base,
  - stale restore request,
  - missing base revision for guarded mutation paths.
- Add user-readable conflict responses:
  - HTTP `409`,
  - `code: CANVAS_DRAFT_CONFLICT`,
  - current server draft revision,
  - client base revision,
  - recoverable message.
- Add frontend conflict handling:
  - stop marking the draft as saved when the server rejects a stale write,
  - show "Canvas changed elsewhere. Reload latest or retry from current draft.",
  - keep local content visible,
  - avoid silent data loss.
- Add tests for:
  - autosave conflict,
  - manual save conflict,
  - operation conflict,
  - restore conflict,
  - successful non-conflicting save/operation.

#### Quality Gate 10

Stage 10 passes only when:

- stale saves never overwrite newer draft content,
- stale block operations never apply to a newer draft,
- stale restore requests return a recoverable conflict,
- frontend keeps the user's local edits visible after a conflict,
- targeted route/component tests pass,
- changed files have no linter errors.

Stage 10 fails if:

- any mutation path can write without ownership and revision checks,
- autosave can mark stale content as saved,
- restore can overwrite newer content without warning,
- conflict errors are technical or unreadable to a business user.

### 17.2 Stage 11: Unified Approval Preview Runtime

Goal: replace hidden `approved: true` shortcuts with a consistent business approval experience for every durable Canvas transformation.

#### Scope

- Create a shared approval proposal model for Canvas operations:
  - operation id,
  - target draft id,
  - base revision,
  - affected blocks,
  - proposed change,
  - Markdown diff summary,
  - validation result,
  - approval requirement,
  - created timestamp.
- Store pending proposals in draft provenance or a dedicated proposal table, depending on migration risk.
- Update transformation UI so selection and dataset actions first request `previewOnly`.
- Add preview panel in Canvas:
  - proposed business change,
  - affected block list,
  - added/removed line summary,
  - lineage/source details,
  - Apply,
  - Reject,
  - Refresh preview if base revision changed.
- Apply must send the same operation with:
  - `approved: true`,
  - original base revision,
  - proposal id when available.
- Reject must leave the draft unchanged and record a rejected proposal event.
- Add tests for:
  - selection-to-table preview,
  - dataset-to-dashboard preview,
  - apply accepted proposal,
  - reject proposal,
  - stale proposal conflict.

#### Quality Gate 11

Stage 11 passes only when:

- no UI path silently performs durable block transformation,
- every durable transformation shows a preview before applying,
- rejected proposals leave draft content and blocks unchanged,
- accepted proposals create version snapshots and lineage,
- stale proposals are blocked by Stage 10 revision checks,
- targeted tests pass.

Stage 11 fails if:

- any visible transformation button directly applies durable state without approval,
- the user cannot understand what will change,
- proposal state gets detached from draft/conversation context.

### 17.3 Stage 12: Production Block Renderers

Goal: bring tables, charts and diagrams closer to competitor-grade interactivity while preserving safe Markdown fallback.

#### Scope

- Keep the current table renderer and harden it:
  - stable sorting,
  - empty state,
  - visible provenance,
  - selected row actions prepared for future conversions.
- Add a chart renderer adapter:
  - prefer Vega-Lite compatible specs when present,
  - support deterministic fallback bar chart for simple metrics,
  - show chart insight, source and limitations,
  - catch render failures and show Markdown projection.
- Add a diagram renderer adapter:
  - prefer Mermaid source when present,
  - support current node/edge fallback,
  - sanitize/guard unsafe diagram text,
  - show source/fallback when rendering fails.
- Add renderer capability metadata:
  - native renderer used,
  - fallback renderer used,
  - export/copy availability.
- Add tests for:
  - chart native spec path,
  - chart fallback path,
  - diagram native source path,
  - diagram fallback path,
  - renderer failure does not blank Canvas.

#### Quality Gate 12

Stage 12 passes only when:

- table/chart/diagram blocks render without exposing raw JSON,
- chart and diagram blocks can use richer native specs,
- every renderer has a Markdown fallback,
- renderer failure is isolated to the block,
- targeted component tests pass.

Stage 12 fails if:

- malformed chart/diagram data can crash the Canvas,
- users must understand raw technical payloads to use renderers,
- Markdown projection is missing or hidden on failure.

### 17.4 Stage 13: Export Maturity

Goal: turn Canvas outputs into business-ready files beyond Markdown/CSV/metadata JSON.

#### Scope

- Add export adapter boundary:
  - format,
  - input draft envelope,
  - output filename,
  - MIME type,
  - recoverable error contract,
  - lineage metadata.
- Implement pragmatic production exports in this order:
  - PDF from Markdown projection,
  - DOCX from Markdown projection,
  - XLSX from table/dataset blocks,
  - PPTX from presentation/report outline blocks.
- Preserve unsupported response only for formats that still lack an adapter.
- Include provenance in generated files where possible:
  - source draft id,
  - source version id,
  - created from,
  - generated timestamp.
- Add frontend export states:
  - generating,
  - downloaded,
  - unsupported,
  - failed recoverably.
- Add tests for:
  - each supported export format,
  - unsupported fallback for missing adapters,
  - file headers/MIME types,
  - lineage metadata remains available.

#### Quality Gate 13

Stage 13 passes only when:

- PDF/DOCX/XLSX/PPTX have honest adapter-backed behavior or remain explicitly blocked,
- supported exports are readable outside the app,
- export failures are recoverable and user-readable,
- lineage is preserved in metadata/read-back,
- route/component tests pass.

Stage 13 fails if:

- a heavy export appears successful but returns placeholder content,
- exported files lose business context,
- export code bypasses ownership checks.

### 17.5 Stage 14: Workflow Runtime, Rollout Gate And Final Validation

Goal: convert the workflow ledger into a usable governed runtime and close the rollout gate for DBR77 usage.

#### Scope

- Expand workflow templates into executable, still approval-gated steps:
  - market research to report,
  - meeting note to initiatives,
  - KPI review to dashboard,
  - client proposal to deck,
  - decision memo to execution plan.
- Add workflow step execution endpoint:
  - run next step,
  - require approval when needed,
  - attach generated block/output,
  - preserve workflow/draft/conversation anchors.
- Add real output linkage from workflow steps:
  - output type,
  - output id,
  - title,
  - URL,
  - source version.
- Add collaboration metadata without enabling unsafe collaboration:
  - owner,
  - reviewer,
  - lifecycle,
  - comments placeholder only if backed by storage.
- Add final rollout test suite:
  - chat opens Canvas,
  - edit autosaves,
  - generate block through approval,
  - export output,
  - restore version,
  - send chat with Canvas context,
  - run/resume workflow,
  - verify lineage.
- Add a final quality gate document that marks:
  - production-ready features,
  - MVP features,
  - explicitly blocked features,
  - known residual risks.

#### Quality Gate 14

Stage 14 passes only when:

- workflow templates can create real governed outputs,
- approval checkpoints are enforced,
- generated outputs link back to workflow steps and Canvas source,
- collaboration metadata does not break single-user behavior,
- final e2e/manual rollout gate passes,
- documentation clearly separates production-ready from MVP/blocked capabilities.

Stage 14 fails if:

- workflow steps execute silently,
- workflow output lineage is missing,
- final rollout test reveals context loss,
- documentation overstates unfinished functionality.

### 17.6 Stage 15: Renderer Runtime Completion

Goal: remove the renderer MVP label for chart and diagram blocks by using real client-side runtimes where safe, while preserving deterministic fallbacks.

#### Scope

- Add real Vega-Lite rendering for chart blocks that provide a compatible spec:
  - dynamic `vega-embed` import,
  - isolated render container,
  - SVG renderer mode,
  - no raw spec display in business UI,
  - fallback metric bars remain visible.
- Keep chart fallback behavior for metric-only blocks.
- Add Mermaid diagram runtime actions:
  - copy Mermaid source,
  - export rendered SVG when available,
  - export Mermaid/source fallback when SVG is not available,
  - keep node/edge fallback visible.
- Add tests for:
  - Vega runtime container,
  - chart fallback remains available,
  - Mermaid source actions,
  - SVG/source export actions,
  - renderer failures remaining block-local.

#### Quality Gate 15

Stage 15 passes only when:

- chart blocks with specs render through the Vega runtime,
- chart blocks without specs still render fallback bars,
- diagram blocks support copy/export actions,
- Mermaid failures do not blank Canvas,
- targeted component tests pass,
- changed renderer files have no linter errors.

Stage 15 fails if:

- raw chart or diagram JSON becomes visible to business users,
- renderer runtime failure crashes the Canvas,
- dependency loading blocks Markdown fallback rendering.

### 17.7 Stage 16: Data Import Maturity

Goal: make XLSX a first-class governed dataset source for Canvas data-to-artifact work.

#### Scope

- Extend dataset format support from CSV/JSON to XLSX.
- Parse XLSX files deterministically using the first worksheet.
- Keep dataset profiling limits:
  - max payload size,
  - first 500 profiled rows,
  - first 50 columns,
  - visible limitations.
- Extend frontend upload handling:
  - detect `.xlsx`,
  - send base64 workbook content,
  - preserve original filename,
  - keep the same preview/apply approval flow.
- Add tests for:
  - backend XLSX dataset parsing,
  - dashboard generation from XLSX,
  - frontend XLSX upload payload,
  - existing CSV/JSON behavior.

#### Quality Gate 16

Stage 16 passes only when:

- XLSX upload can generate table/chart/dashboard/findings through governed operations,
- generated artifacts preserve source filename and draft lineage,
- output includes data limitations,
- CSV/JSON behavior does not regress,
- targeted tests pass.

Stage 16 fails if:

- XLSX import bypasses approval preview,
- workbook parsing executes arbitrary code or macros,
- dataset artifacts lose source filename/provenance.

### 17.8 Stage 17: Workflow Collaboration Metadata

Goal: make governed workflows reviewable by people without pretending to ship full realtime collaboration.

#### Scope

- Add workflow collaboration metadata:
  - owner id,
  - reviewer id,
  - lifecycle state,
  - persisted comments.
- Store collaboration metadata on the workflow run inside Canvas provenance.
- Add backend endpoints:
  - update workflow owner/reviewer/lifecycle,
  - add workflow comment.
- Add Canvas diagnostics UI:
  - display owner/reviewer/lifecycle,
  - send workflow to review,
  - mark workflow approved,
  - add review comment.
- Preserve single-user behavior and existing workflow create/resume/run-next paths.

#### Quality Gate 17

Stage 17 passes only when:

- workflow collaboration metadata persists through draft provenance,
- comments are backed by storage, not placeholder UI,
- review lifecycle changes do not execute workflow steps silently,
- targeted backend/frontend tests pass,
- changed files have no linter errors.

Stage 17 fails if:

- reviewer/comment UI is not backed by persisted state,
- lifecycle changes mutate outputs silently,
- workflow context anchors are lost.

### 17.9 Stage 18: Controlled Data Analysis Transformations

Goal: move data analysis beyond import/profile while preserving the no-arbitrary-code safety contract.

#### Scope

- Extend dataset artifact generation with optional deterministic analysis modes:
  - profile summary,
  - numeric aggregation,
  - filtered table.
- Keep all analysis inside the existing governed `generate_artifact_from_dataset` operation.
- Preserve preview/approval before durable Canvas changes.
- Store analysis kind in block provenance and explain limitations in block data.
- Add dataset action UI for advanced analysis.

#### Quality Gate 18

Stage 18 passes only when:

- advanced analysis actions use preview/approval,
- backend analysis is deterministic and does not execute user code,
- generated blocks preserve dataset provenance and Markdown projection,
- targeted backend/frontend tests pass,
- changed files have no linter errors.

Stage 18 fails if:

- analysis runs outside governed Canvas operations,
- transform behavior depends on arbitrary scripts or formulas,
- generated artifacts lose source dataset lineage.

### 17.10 Stage 19: Multi-Template Workflow Plans

Goal: move workflow runtime beyond a single generic ledger and make template choice meaningful.

#### Scope

- Expand governed workflow templates into distinct step plans:
  - market research to report,
  - meeting note to initiatives,
  - KPI review to dashboard,
  - client proposal to deck,
  - decision memo to execution plan.
- Keep every template anchored to `draftId`, `conversationId` and `workflowRunId`.
- Keep approval checkpoints before durable outputs.
- Map templates to durable output types without silent execution.
- Add Canvas diagnostics UI for choosing workflow template before starting a run.

#### Quality Gate 19

Stage 19 passes only when:

- each workflow template creates a distinct step plan,
- UI allows choosing the template,
- run-next still requires approval and preserves output lineage,
- targeted backend/frontend tests pass,
- changed files have no linter errors.

Stage 19 fails if:

- template choice is only cosmetic,
- workflow steps lose Canvas context anchors,
- durable outputs can be generated without approval.

### 17.11 Stage 20: Workflow Execution Timeline

Goal: make governed workflow runs auditable as business operations, not only lists of steps.

#### Scope

- Add persisted workflow events to each workflow run.
- Record events for:
  - workflow created,
  - approval required,
  - workflow resumed,
  - workflow approved,
  - output created,
  - review metadata updated,
  - comment added.
- Store event actor, event type, summary, timestamp and optional metadata.
- Render a compact timeline in Canvas diagnostics.
- Keep timeline read-only in UI and anchored to the workflow run provenance.

#### Quality Gate 20

Stage 20 passes only when:

- workflow events persist through draft provenance,
- timeline is visible in Canvas diagnostics,
- approval/output events are recorded during `run-next`,
- collaboration/comment events are recorded,
- targeted backend/frontend tests pass,
- changed files have no linter errors.

Stage 20 fails if:

- timeline is UI-only and not persisted,
- events lose actor or timestamp,
- timeline events mutate workflow outputs.

### 17.12 Stage 21: Workflow Timeline Context Integration

Goal: make Teresa aware of the latest governed workflow activity without exposing raw native block JSON or heavy provenance payloads.

#### Scope

- Extend `canvas-context/v1` with safe workflow event summaries.
- Include recent workflow event type, actor, summary and timestamp.
- Keep raw workflow event metadata out of the AI context packet.
- Inject workflow timeline summaries into Teresa's Canvas system instruction.
- Add workflow event types to Wave context facts.

#### Quality Gate 21

Stage 21 passes only when:

- timeline summaries are included in the Canvas context packet,
- Teresa's instruction includes recent workflow timeline summaries,
- memory facts include workflow event types,
- raw native block JSON remains excluded,
- targeted frontend/backend tests pass,
- changed files have no linter errors.

Stage 21 fails if:

- workflow event context includes raw block JSON or raw provenance metadata,
- AI context loses `workflowRunId` anchors,
- timeline context bypasses the existing Canvas context packet.

### 17.13 Stage 22: Workflow Output Ledger UX

Goal: make generated workflow deliverables visible and usable from the Canvas workflow ledger and AI context.

#### Scope

- Render workflow outputs directly in Canvas diagnostics.
- Show output type, title and open link.
- Add workflow output summaries to `canvas-context/v1`.
- Include workflow output summaries in Teresa's Canvas instruction and Wave context facts.
- Keep output summaries anchored to `workflowRunId` and `stepId`.

#### Quality Gate 22

Stage 22 passes only when:

- workflow outputs are visible in Canvas diagnostics,
- output links remain tied to the originating workflow run,
- Teresa receives safe workflow output summaries,
- raw output/native block JSON remains excluded,
- targeted frontend/context tests pass,
- changed files have no linter errors.

Stage 22 fails if:

- output visibility exists only in AI context but not UI,
- output summaries lose workflow/run lineage,
- output summaries include raw native payloads.

### 17.14 Stage 23: Safe Workflow Context Projection

Goal: ensure Canvas workflow context sent to Teresa is a purpose-built projection, not raw workflow provenance.

#### Scope

- Replace full workflow run objects in `canvas-context/v1` with sanitized workflow run summaries.
- Keep only:
  - run id,
  - draft/conversation anchors,
  - template/title/status,
  - lifecycle state,
  - step summaries,
  - approval statuses,
  - output count,
  - updated timestamp.
- Keep detailed timeline and output context in dedicated safe summary arrays.
- Exclude workflow comments, raw events and raw event metadata from the `workflowRuns` projection.

#### Quality Gate 23

Stage 23 passes only when:

- `workflowRuns` in AI context is sanitized,
- comments and event metadata are not copied into workflow run summaries,
- workflow event and output summaries still preserve anchors,
- targeted context tests pass,
- changed files have no linter errors.

Stage 23 fails if:

- raw workflow comments enter the AI context packet,
- event metadata is copied through `workflowRuns`,
- Teresa loses workflow run anchors.
