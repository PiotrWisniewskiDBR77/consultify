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

### 17.15 Stage 24: Reviewer Lifecycle Execution Gate

Goal: make workflow review metadata operationally meaningful before durable output generation.

#### Scope

- Enforce reviewer lifecycle before `run-next` durable output generation.
- If a workflow has a reviewer or is `in_review`, require lifecycle `approved` before output creation.
- Keep the existing explicit `approved: true` execution approval requirement.
- Return a recoverable `CANVAS_WORKFLOW_REVIEW_REQUIRED` conflict when review approval is missing.
- Surface a user-friendly Canvas message that tells the user to mark the workflow approved.

#### Quality Gate 24

Stage 24 passes only when:

- reviewed workflows cannot generate durable outputs until lifecycle is `approved`,
- workflows without reviewer/review lifecycle retain existing approval behavior,
- frontend shows clear recoverable feedback,
- targeted backend/frontend tests pass,
- changed files have no linter errors.

Stage 24 fails if:

- review metadata remains cosmetic,
- review gate replaces the explicit execution approval instead of layering on top,
- rejected review attempts mutate workflow outputs.

### 17.16 Stage 25: Conflict-Safe Workflow Actions

Goal: ensure workflow mutations never apply against a stale Canvas draft.

#### Scope

- Require/propagate `baseUpdatedAt` for workflow mutations:
  - create workflow,
  - resume workflow,
  - run next workflow step,
  - update review metadata,
  - add workflow comment.
- Reuse the existing `CANVAS_DRAFT_CONFLICT` recoverable response.
- Preserve local UI state and show the existing friendly conflict message.
- Keep stale workflow attempts from mutating provenance, versions or outputs.

#### Quality Gate 25

Stage 25 passes only when:

- frontend sends `baseUpdatedAt` for workflow mutations,
- backend rejects stale workflow actions before persistence,
- conflict feedback is recoverable and user-readable,
- targeted backend/frontend tests pass,
- changed files have no linter errors.

Stage 25 fails if:

- workflow actions can overwrite newer Canvas state,
- stale `run-next` can create a version or output,
- conflict errors surface as raw backend JSON.

### 17.17 Stage 26: Review-Aware Workflow Controls

Goal: make the Canvas workflow ledger prevent review-gated actions before the user hits the backend.

#### Scope

- Detect workflows that are assigned to a reviewer or are in lifecycle `in_review`.
- Disable `Run next` while review lifecycle is not `approved`.
- Show an inline review gate message in the workflow ledger.
- Keep `Mark approved` as the explicit UI action that unlocks workflow execution.
- Preserve backend review enforcement from Stage 24 as the source of truth.

#### Quality Gate 26

Stage 26 passes only when:

- review-gated workflows visibly explain why `Run next` is disabled,
- `Run next` is disabled until lifecycle is `approved`,
- backend enforcement remains in place,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 26 fails if:

- the UI suggests a review-gated workflow can run,
- the frontend replaces backend enforcement,
- approved workflows remain blocked.

### 17.18 Stage 27: Approval-Aware Workflow Execution UI

Goal: make workflow approval checkpoints explicit at the moment durable output generation is triggered.

#### Scope

- Detect pending workflow approvals in the Canvas workflow ledger.
- Show which workflow step is awaiting explicit approval.
- Rename the execution CTA from `Run next` to `Approve and run` while an approval is pending.
- Keep the existing backend `approved: true` contract for workflow execution.
- Preserve the Stage 26 review gate so reviewer lifecycle approval still blocks execution first.

#### Quality Gate 27

Stage 27 passes only when:

- pending approval checkpoints are visible in the ledger,
- the CTA clearly communicates approval plus execution,
- review-gated workflows still disable the CTA,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 27 fails if:

- a pending approval looks like a normal workflow run,
- the CTA hides that output generation also approves a checkpoint,
- review lifecycle and approval checkpoint states conflict in the UI.

### 17.19 Stage 28: Status-Aware Workflow Completion Controls

Goal: prevent completed or failed workflow runs from appearing executable in the Canvas workflow ledger.

#### Scope

- Detect terminal workflow statuses (`completed`, `failed`) in the ledger.
- Disable the execution CTA for terminal workflow runs.
- Replace the execution CTA label with the terminal status.
- Show inline copy that points users to the output ledger after completion.
- Preserve `Resume` as the explicit path for continuing or reopening workflow context.

#### Quality Gate 28

Stage 28 passes only when:

- completed workflow runs no longer show an active execution CTA,
- the ledger explains where the generated output is available,
- pending approvals and review gates still behave as before,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 28 fails if:

- completed workflow runs still invite another `Run next`,
- terminal and approval states produce contradictory labels,
- resume behavior is removed or hidden.

### 17.20 Stage 29: Terminal Workflow Server Guard

Goal: make the backend enforce the same terminal workflow execution rule that the Stage 28 UI communicates.

#### Scope

- Reject `run-next` for workflow runs with status `completed` or `failed`.
- Return recoverable `409 CANVAS_WORKFLOW_TERMINAL_STATE` with workflow id, status and output count.
- Keep output creation, version snapshotting and workflow event writes from running for terminal workflows.
- Surface a friendly frontend message if an older client or direct API call hits the guard.
- Add an integration regression test.

#### Quality Gate 29

Stage 29 passes only when:

- terminal workflows cannot create additional output resources through `run-next`,
- the response uses a stable recoverable error code,
- frontend error copy is understandable,
- targeted backend tests pass,
- changed files have no linter errors.

Stage 29 fails if:

- a completed workflow can generate a second output via direct API call,
- terminal-state rejection happens after snapshot/output side effects,
- terminal workflow errors appear as raw backend JSON in the UI.

### 17.21 Stage 30: Workflow Execution In-Flight Guard

Goal: prevent accidental duplicate workflow execution requests from rapid repeated clicks in the Canvas ledger.

#### Scope

- Track `run-next` request state per workflow run in the frontend.
- Disable the execution CTA immediately while a `run-next` request is in flight.
- Show a temporary `Running...` label during execution.
- Keep Stage 29 backend terminal-state guard as the authoritative duplicate-output protection.
- Add a component regression test for in-flight disabling.

#### Quality Gate 30

Stage 30 passes only when:

- rapid repeated clicks cannot send duplicate `run-next` requests from the same visible control,
- users see a clear in-flight state,
- completed workflows still end in terminal-state UI,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 30 fails if:

- a user can double-click `Approve and run` and submit two frontend requests,
- in-flight UI hides errors or successful output creation,
- terminal-state labels regress after request completion.

### 17.22 Stage 31: Workflow Mutation In-Flight Guards

Goal: extend in-flight protection from workflow execution to the remaining workflow mutation controls.

#### Scope

- Track `start workflow` request state in the frontend.
- Track `resume workflow` request state per workflow run.
- Track workflow review metadata update state per workflow run.
- Track workflow comment creation state per workflow run.
- Disable each corresponding control while its request is in flight.
- Show temporary labels: `Starting...`, `Resuming...`, `Updating...`, `Adding...`.
- Add a component regression test for duplicate workflow creation prevention.

#### Quality Gate 31

Stage 31 passes only when:

- repeated clicks cannot create duplicate workflow start requests from the same visible control,
- resume/review/comment controls expose immediate in-flight feedback,
- in-flight states clear on success or failure,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 31 fails if:

- `Start workflow` can be submitted twice from rapid clicks,
- review or comment mutation buttons remain active during request execution,
- loading labels get stuck after request completion.

### 17.23 Stage 32: Consistent Workflow Mutation Error Copy

Goal: make all workflow mutation controls surface the same recoverable Canvas error language.

#### Scope

- Route workflow start errors through `canvasActionErrorMessage`.
- Route workflow resume errors through `canvasActionErrorMessage`.
- Route workflow review metadata update errors through `canvasActionErrorMessage`.
- Route workflow comment errors through `canvasActionErrorMessage`.
- Preserve specific messages for conflict, review gate and terminal workflow state.
- Add component coverage for stale workflow creation conflict copy.

#### Quality Gate 32

Stage 32 passes only when:

- workflow mutations do not surface raw backend conflict messages,
- stale workflow creation shows the same friendly Canvas conflict copy as other Canvas actions,
- in-flight states still clear after errors,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 32 fails if:

- workflow start/resume/review/comment errors bypass shared Canvas error mapping,
- conflict payloads appear as raw API strings,
- buttons remain stuck after a recoverable error.

### 17.24 Stage 33: Workflow Comment Input Guard

Goal: prevent empty workflow comments from appearing as executable actions in the ledger.

#### Scope

- Trim the workflow comment input before determining action availability.
- Disable `Add comment` when the comment is empty or whitespace-only.
- Keep `Add comment` disabled while comment creation is in flight.
- Re-enable `Add comment` as soon as meaningful text exists.
- Preserve backend validation as the source of truth.

#### Quality Gate 33

Stage 33 passes only when:

- empty workflow comments cannot be submitted from the visible control,
- whitespace-only comments keep the action disabled,
- valid comments enable the action,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 33 fails if:

- `Add comment` is active for an empty input,
- comment in-flight state regresses,
- valid comments become impossible to submit.

### 17.25 Stage 34: Reviewer Preservation On Lifecycle Updates

Goal: prevent lifecycle-only workflow review updates from accidentally clearing an existing reviewer assignment.

#### Scope

- Preserve the persisted reviewer id when the reviewer input has not been locally edited.
- Continue allowing an intentionally cleared reviewer input to submit `null`.
- Apply the preservation rule to `Send to review` and `Mark approved`.
- Add a component regression test for approving a workflow with an existing reviewer.

#### Quality Gate 34

Stage 34 passes only when:

- `Mark approved` preserves an existing reviewer assignment by default,
- lifecycle updates do not clear reviewer metadata unless the user edits the reviewer field,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 34 fails if:

- approving a reviewed workflow removes its reviewer,
- reviewer input edits are ignored,
- lifecycle update payloads become ambiguous.

### 17.26 Stage 35: Workflow Input In-Flight Locks

Goal: prevent reviewer and comment field edits while their corresponding workflow mutation is already being saved.

#### Scope

- Disable reviewer input during workflow review metadata updates.
- Disable comment input during workflow comment creation.
- Preserve existing in-flight button labels and disabled states.
- Add component coverage for reviewer input locking during `Mark approved`.

#### Quality Gate 35

Stage 35 passes only when:

- reviewer input is locked during review metadata update,
- comment input is locked during comment creation,
- input locks clear after request completion,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 35 fails if:

- users can edit reviewer/comment fields while the matching request is in flight,
- input locks remain stuck after success or failure,
- Stage 34 reviewer preservation regresses.

### 17.27 Stage 36: Lifecycle-Aware Review Controls

Goal: prevent redundant workflow review lifecycle submissions from the Canvas ledger.

#### Scope

- Disable `Send to review` when workflow lifecycle is already `in_review`.
- Disable `Mark approved` when workflow lifecycle is already `approved`.
- Keep the opposite lifecycle action available when valid.
- Preserve in-flight disabled behavior from Stage 31 and input locks from Stage 35.
- Add component coverage for current lifecycle button disabling.

#### Quality Gate 36

Stage 36 passes only when:

- `Send to review` is disabled for workflows already in review,
- `Mark approved` is disabled for already approved workflows,
- valid lifecycle transitions remain available,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 36 fails if:

- users can submit a lifecycle update that repeats the current lifecycle,
- valid lifecycle transitions become unavailable,
- in-flight states conflict with lifecycle-aware disabled states.

### 17.28 Stage 37: Full Canvas Rollout E2E Gate

Goal: freeze an end-to-end rollout gate for Canvas context continuity before adding the next product capability.

#### Scope

- Treat Stage 37 as a product readiness gate, not a net-new workflow feature.
- Verify that an active Canvas draft can be projected into Teresa context with draft anchors, selection, Markdown projection, block summaries, workflow summaries, recent timeline events and output summaries.
- Verify that native JSON block payloads, raw workflow comments and raw event metadata are not copied into the AI context packet.
- Keep the rollout gate aligned with the Markdown-first, JSON-when-native, always Markdown projection contract.
- Add source-of-truth documentation for the rollout contract.

#### Quality Gate 37

Stage 37 passes only when:

- Canvas context packet includes active draft, selection, memory anchors, block summaries, workflow run summaries, event summaries and output summaries,
- Teresa receives safe Markdown projections and summaries rather than raw native block JSON,
- reviewer comments and workflow event metadata are excluded from the projected context,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 37 fails if:

- the chat can lose active Canvas draft identity during context packet construction,
- native block JSON or sensitive review/comment metadata leaks into Teresa context,
- workflow outputs are not visible as summarized context for follow-up AI work.

### 17.29 Stage 38: Canvas Capability Honesty Labels

Goal: prevent Canvas from overstating unfinished capabilities by labeling exposed work modes and workflow templates honestly.

#### Scope

- Add capability labels using the source-of-truth vocabulary: `real`, `partial`, `scaffold`, `missing`, `out_of_scope`.
- Label visible Canvas starter templates with their current capability status.
- Label the active Canvas document capability inside diagnostics.
- Label workflow templates with their current capability status and a short reason.
- Keep labels product-facing and non-technical: users should understand what is ready and what is still partial.

#### Quality Gate 38

Stage 38 passes only when:

- every visible Canvas starter template has a capability label,
- the active Canvas diagnostics show capability status and explanation,
- workflow template selection shows capability status and explanation,
- partial lanes do not read as fully production-ready,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 38 fails if:

- Canvas UI presents partial lanes as complete,
- capability labels are hidden from the places where users choose work modes,
- documentation claims capability honesty without a tested UI surface.

### 17.30 Stage 39: ResearchCanvas + ResearchSession Integration

Goal: make the Research starter in Canvas create and preserve a real `ResearchSession` linkage instead of remaining a disconnected research brief.

#### Scope

- Use the existing `/api/research/sessions` runtime as the source of truth for research missions.
- When a user starts the Research Canvas template from a conversation, plan a `ResearchSession`.
- Persist the resulting `researchSessionId` on the Work Canvas draft.
- Keep `researchSessionId` in frontend Canvas state, draft adapter mapping and AI context anchors.
- Show the linked `ResearchSession` in Canvas diagnostics.
- Add regression coverage for frontend linking and backend `research_session_id` persistence.

#### Quality Gate 39

Stage 39 passes only when:

- selecting the Research starter with a conversation creates a planned `ResearchSession`,
- the Canvas draft save payload includes `researchSessionId`,
- the backend persists and returns `researchSessionId`,
- Teresa's Canvas context packet can carry the `researchSessionId` anchor,
- diagnostics shows the linked ResearchSession,
- targeted frontend/backend tests pass,
- changed files have no linter errors.

Stage 39 fails if:

- Research Canvas remains detached from `ResearchSession`,
- `researchSessionId` is lost during draft mapping, save or context packet construction,
- Canvas creates a separate research mechanism instead of using the existing research runtime.

### 17.31 Stage 40: Artifact Runtime Unification Metadata

Goal: align Work Canvas durable outputs with the Wave 5 artifact runtime contract without forcing a risky double-write migration.

#### Scope

- Add a Wave 5 artifact runtime hint to every Work Canvas durable output metadata object.
- Map Canvas output types to Wave 5 artifact types:
  - `presentation` -> `slide_deck`,
  - `table` -> `spreadsheet`,
  - `report` -> `report`.
- Include a `sourceRefsTemplate` that can seed a future Wave 5 artifact write.
- Carry Canvas lineage through `draftId`, `canvasVersionId`, `outputResourceType`, `outputResourceId`, `conversationId`, `projectId` and `researchSessionId`.
- Keep the change additive so existing Canvas output flows, presentation decks and output drafts continue to work.

#### Quality Gate 40

Stage 40 passes only when:

- manual Canvas output creation includes artifact runtime correlation metadata,
- workflow-generated outputs include the same artifact runtime correlation metadata,
- source Canvas lineage remains available,
- no Wave 5 rows are created implicitly without a dedicated migration/commit gate,
- targeted backend tests pass,
- changed files have no linter errors.

Stage 40 fails if:

- Canvas outputs remain impossible to correlate with Wave 5 artifact semantics,
- metadata breaks existing output consumers,
- the implementation silently creates duplicate artifact records without explicit governance.

### 17.32 Stage 41: Chat-To-Canvas Command Routing

Goal: let users open the correct Canvas work mode directly from chat commands while preserving the same conversation runtime.

#### Scope

- Detect explicit Canvas routing intents in chat, including slash commands and natural-language requests.
- Route commands such as `/canvas research`, `wrzuć to do Canvas`, `zrób research canvas`, and `review in Canvas`.
- Open the right-side Canvas panel instead of navigating to a separate app or starting a new chat.
- Select the matching Canvas starter when possible:
  - research,
  - decision,
  - plan,
  - thoughts,
  - document.
- Persist the user command in the same conversation with command metadata.
- Avoid sending the command to Teresa streaming when the command is a local UI routing action.

#### Quality Gate 41

Stage 41 passes only when:

- explicit Canvas commands open the right work panel,
- the selected Canvas starter matches the command intent,
- the command remains attached to the current conversation,
- Teresa stream is not started for local Canvas routing commands,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 41 fails if:

- Canvas commands create a separate chat/runtime,
- commands are accidentally sent to Teresa as normal prompts,
- the wrong starter opens for research/decision/plan commands.

### 17.33 Stage 42: DocumentCanvas Selection Edit Loop

Goal: make DocumentCanvas feel more like a real AI work editor by adding a governed selection edit loop before introducing a full TipTap/ProseMirror editor.

#### Scope

- Keep Markdown as the canonical document source.
- Preserve the existing Document and Markdown views.
- Let users select text in the Canvas and draft a replacement in a focused edit panel.
- Preview the edit through the existing governed `replace_selection` operation.
- Require the same approval preview before mutating the saved draft.
- Reuse version/diff/read-back behavior from existing Canvas operations.
- Keep this as a minimal editor upgrade, not a rich-text editor migration.

#### Quality Gate 42

Stage 42 passes only when:

- selected Canvas text exposes a clear edit panel,
- empty replacement text cannot be previewed,
- preview uses `replace_selection` with the selected text and replacement Markdown,
- apply updates the Canvas draft only after explicit user approval,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 42 fails if:

- selection edits mutate the draft without preview/approval,
- the editor bypasses the Markdown-first contract,
- the UI implies full TipTap/ProseMirror capabilities before that runtime exists.

### 17.34 Stage 43: Visible Diff Preview For Canvas Edits

Goal: make governed Canvas edits reviewable before approval by showing concrete added/removed Markdown line samples in the preview.

#### Scope

- Extend Canvas diff summaries with short added/removed line samples.
- Return the same sample fields from backend operation previews and apply responses.
- Show the line samples inside the existing operation preview panel.
- Keep the preview compact and business-readable.
- Preserve the existing approval flow and version snapshots.
- Avoid introducing a new diff runtime or parallel document format.

#### Quality Gate 43

Stage 43 passes only when:

- operation previews still show the diff summary,
- previews also show representative removed and added Markdown lines when available,
- backend operation responses include the same diff sample fields,
- apply still requires explicit approval,
- targeted frontend and backend tests pass,
- changed files have no linter errors.

Stage 43 fails if:

- users must approve edits without seeing concrete changed content,
- diff samples expose raw native block JSON or internals,
- the preview becomes a separate mutation path outside governed Canvas operations.

### 17.35 Stage 44: DocumentCanvas Writing Shortcuts

Goal: add a first, safe set of writing shortcuts to DocumentCanvas selection editing while keeping all mutations proposal-first.

#### Scope

- Add deterministic writing shortcuts inside the selected-text edit panel.
- Include shortcuts for:
  - using the selection as the replacement base,
  - turning selected lines into an action checklist,
  - turning selected lines into a bullet summary.
- Populate the replacement Markdown draft only.
- Keep preview/apply as the only mutation path.
- Do not claim AI rewriting or rich-text editing capabilities.
- Preserve the Markdown-first editing contract.

#### Quality Gate 44

Stage 44 passes only when:

- selected text exposes writing shortcut buttons,
- shortcuts populate replacement Markdown without calling the backend,
- preview still uses `replace_selection`,
- no shortcut mutates the draft before explicit approval,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 44 fails if:

- writing shortcuts bypass preview/apply,
- shortcuts are presented as AI rewrites without AI execution,
- shortcut output creates a non-Markdown document format.

### 17.36 Stage 45: Revise Selection Edit Before Apply

Goal: complete the first selection edit loop by letting users return from preview to the replacement draft without losing their proposed edit.

#### Scope

- Add a `Revise edit` action to selection edit previews.
- Show the action only for `replace_selection` previews.
- Dismiss the preview without applying or rejecting the underlying draft.
- Preserve the replacement Markdown draft so the user can adjust it.
- Let the user run preview again after revision.
- Keep `Apply` and `Reject` as explicit choices.

#### Quality Gate 45

Stage 45 passes only when:

- selection edit preview exposes `Revise edit`,
- revising closes the preview and keeps the replacement Markdown,
- revising does not mutate the draft,
- the user can preview again after revising,
- targeted frontend tests pass,
- changed files have no linter errors.

Stage 45 fails if:

- revising applies or rejects the edit implicitly,
- replacement draft text is lost when returning from preview,
- non-selection operations show a misleading revise action.

### 17.37 Final Rollout Cutline Sign-Off

Goal: close the current Business Work Canvas rollout honestly as a Markdown-first DocumentCanvas product surface.

#### Scope

- Treat `CANVAS_SOURCE_OF_TRUTH.md` section 17 as the final rollout cutline.
- Treat `BUSINESS_WORK_CANVAS_TESTING_STEP_1_2.md` as the user-flow and Playwright gate contract.
- Confirm Stages 37-45 are marked `PASSED`.
- Reconcile old "largest gaps" wording into addressed-for-cutline vs post-cutline backlog.
- Normalize client mapping for server lifecycle/kind vocabulary:
  - server `proposed` lifecycle maps to UI `in_review`,
  - server draft kinds `markdown`, `checklist`, `sheet`, `deck` remain visible instead of falling back silently.
- Keep full rich editor, full Research evidence runtime, Wave 5 promotion and collaboration outside this cutline.

#### Quality Gate 46

Final rollout sign-off passes only when:

- docs state exactly what "100%" means for this rollout,
- partial/out-of-scope features remain explicitly named,
- client state hydration does not hide server lifecycle/kind truth,
- Step 1/2 testing docs and Playwright gate are linked from the source of truth,
- targeted unit/component/e2e validation passes,
- changed files have no linter errors.

Final rollout sign-off fails if:

- docs imply the future Canvas vision is fully shipped,
- server `proposed` or `deck/sheet/markdown/checklist` values are silently hidden by frontend mapping,
- there is no executable Playwright gate for the current editor flow.

### 17.38 Stage 47: Canvas GA Production Scope And Backlog

Goal: define what "100% production Canvas" means beyond the completed Markdown-first cutline.

#### Scope

- Add a named `Canvas GA / Production 100%` milestone.
- Keep `CURRENT CUTLINE COMPLETE` separate from `GA`.
- Turn the post-cutline backlog into executable stages.
- Add a readiness audit that tracks scope, risks, gates and residual gaps.
- Link Canvas GA to the source of truth, interactivity blueprint and release readiness docs.

#### Quality Gate 47

Stage 47 passes only when:

- GA criteria are written down as a production contract,
- every post-cutline workstream has a stage and quality gate,
- future features are not described as already shipped,
- source of truth links to the GA readiness audit,
- changed files have no linter errors.

Stage 47 fails if:

- "100%" is used without saying whether it means cutline or GA,
- backlog items remain vague wishes instead of executable stages,
- docs imply full Research, Wave 5 promotion or rich collaboration is already shipped.

### 17.39 Stage 48: One Canonical Canvas Shell

Goal: prevent two separate Canvas products from drifting.

#### Scope

- Declare the chat-integrated `WorkCanvasDocumentPanel` as the canonical product shell.
- Treat `/ai/work-canvas` as a legacy/admin route until it is wrapped around the canonical shell.
- Remove confusing duplicate component names from `WorkCanvasRuntime`.
- Add a migration note for route-level role expectations.
- Keep existing legacy route behavior available during migration.

#### Quality Gate 48

Stage 48 passes only when:

- canonical shell ownership is documented,
- duplicate `WorkCanvasDocumentPanel` naming is removed from legacy runtime,
- `/ai/work-canvas` cannot be mistaken for the same implementation as chat Canvas,
- tests or type checks confirm imports still resolve.

Stage 48 fails if:

- both shells present themselves as independent product truths,
- future developers can import the legacy preview panel by the canonical component name,
- route-level role semantics remain undocumented.

### 17.40 Stage 49: Canvas Governance And RBAC Hardening

Goal: make proposal governance enforceable on the server, not only visible in the UI.

#### Scope

- Enforce `requiredCapability` before proposal approval.
- Return a recoverable denial with the required capability.
- Add integration tests for allowed and denied approval.
- Keep proposal creation and rejection behavior unchanged.

#### Quality Gate 49

Stage 49 passes only when:

- approve cannot succeed without the proposal capability,
- denied approvals do not mutate proposal state,
- allowed approvals still create read-back and audit metadata,
- targeted route tests pass.

Stage 49 fails if:

- `requiredCapability` stays cosmetic,
- missing capability returns a raw/internal error,
- denial still writes target ids or read-back.

### 17.41 Stage 50: Durable Artifact Promotion Contract

Goal: move `save-as-artifact` from soft metadata toward a clear production promotion workflow.

#### Scope

- Return explicit artifact promotion read-back from Canvas.
- Include artifact runtime, artifact id, version, run id, source draft and promotion status.
- Record promotion metadata in Canvas provenance.
- Keep Wave 5 double-write behind a later migration gate unless the artifact runtime API is fully wired.

#### Quality Gate 50

Stage 50 passes only when:

- users and tests can distinguish draft-only save from promoted artifact state,
- `artifactId`, `artifactRunId` and `artifactVersion` are durable Canvas fields,
- read-back names `wave5` as intended runtime bridge,
- failures remain recoverable and honest.

Stage 50 fails if:

- UI claims a full Wave 5 write when only Canvas metadata exists,
- artifact read-back omits source lineage,
- save-as-artifact hides failed promotion state.

### 17.42 Stage 51: Research Canvas GA

Goal: make Research Canvas trustworthy as a governed research workspace.

#### Scope

- Show evidence/source lists, confidence and gaps from research blocks.
- Use degraded states when evidence is unavailable.
- Connect ResearchSession lifecycle to final report handoff.
- Promote final research report through the artifact promotion contract.
- Add Playwright/integration tests for ResearchSession -> Canvas -> final artifact.

#### Quality Gate 51

Stage 51 passes only when:

- no research claim renders without visible evidence state,
- missing evidence is presented as missing/degraded rather than fake source material,
- final report handoff has source lineage and artifact read-back,
- ResearchSession id survives draft reload and context packet creation.

Stage 51 fails if:

- Canvas invents sources,
- ResearchSession and Canvas create parallel research truths,
- final report is not traceable to the research draft.

### 17.43 Stage 52: Interactive Block Runtime Tier 1

Goal: ship the first competitive typed block runtime for business artifacts.

#### Scope

- Stabilize typed block schema v2.
- Support interactive tables with filter, sort, selection and export.
- Support chart rendering with stable config and graceful fallback.
- Support Mermaid/diagram source, render and export fallback.
- Keep Markdown projection for every native block.

#### Quality Gate 52

Stage 52 passes only when:

- table/chart/diagram blocks work without exposing raw JSON,
- each block has copy/export or explicit disabled-state messaging,
- projection failures show readable fallback,
- component and Playwright coverage exercise the block interactions.

Stage 52 fails if:

- native blocks lose Markdown projection,
- failed renderers break the whole Canvas,
- users see raw block internals.

### 17.44 Stage 53: Production Testing, Observability And Release Gates

Goal: lift Canvas from smoke coverage to production readiness.

#### Scope

- Add Canvas GA readiness audit.
- Add role matrix coverage for admin/member/no-permission behavior.
- Add persistence/refresh tests for draft and artifact promotion state.
- Add telemetry contract for save failures, conflicts, approval denials and artifact promotion failures.
- Link Canvas GA gates into the release readiness checklist.

#### Quality Gate 53

Stage 53 passes only when:

- Canvas has a named readiness audit,
- critical user flows have unit/integration/Playwright coverage,
- release checklist references Canvas GA gates,
- observability events are documented and ready to instrument.

Stage 53 fails if:

- Canvas ships only on smoke tests,
- RBAC and artifact promotion are not part of release gates,
- production failures cannot be diagnosed.

### 17.45 Stage 54: Rich Editor And Collaboration Decision Gate

Goal: enter rich editing only after the runtime and governance foundations are production safe.

#### Scope

- Evaluate TipTap/ProseMirror against the Markdown-first contract.
- Define migration path from textarea Markdown to structured editor state.
- Define inline comments/suggestions model.
- Decide whether realtime collaboration is required for GA or a post-GA package.

#### Quality Gate 54

Stage 54 passes only when:

- editor runtime choice preserves Markdown projection,
- collaboration does not bypass proposal-first governance,
- migration risk and fallback plan are documented,
- the decision is explicit: GA dependency or post-GA roadmap.

Stage 54 fails if:

- rich editor introduces a second source of truth,
- comments/suggestions mutate business outputs without approval,
- collaboration is started before storage/governance are ready.

#### Stage 54 decision evidence

- Rich editor decision gate is formally captured in `BUSINESS_WORK_CANVAS_STAGE_54_RICH_EDITOR_DECISION.md`.
- Current product decision: keep Markdown-first canonical runtime for GA, keep rich editor execution post-GA behind feature flags and rollback path.
