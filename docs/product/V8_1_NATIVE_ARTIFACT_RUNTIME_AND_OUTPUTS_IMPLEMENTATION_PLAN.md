# V8.1 Native Artifact Runtime And Outputs Implementation Plan

> Status: Canonical v8.1  
> Owner: Product + Engineering  
> Scope: implementation-grade engineering plan for contextual artifact generation, canonical outputs library, and personal work views over the same artifact system

---

## 1. Why this document exists

`V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md` defines the product truth.

This document translates that truth into:

- architecture,
- services,
- data model,
- routes,
- UI surfaces,
- rollout phases,
- and engineering boundaries.

---

## 2. Executive implementation verdict

`consultify` already has strong building blocks for reports and presentations, but not yet one closed artifact runtime across chat, library, review and multi-format persistence.

Current strength:

- report CRUD, review, exports and versions already exist
- presentation generation, builder and media library already exist
- AI artifact doctrine and output-family doctrine already exist in docs

Current gap:

- no single artifact registry across `doc + slides + sheet`
- no one canonical outputs home
- no chat-to-artifact runtime that lands in one shared library by default
- no personal `My Work` view over the same registry

Implementation rule:

`reuse existing report/presentation foundations; add a shared artifact substrate above them; bring sheets in as the third runtime`

---

## 3. Existing repo anchors

This plan must build on existing code, not start from zero.

### 3.1 Frontend anchors

- `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`
- `src/components/ReportsAndPresentations/useRapData.ts`
- `src/components/ReportsAndPresentations/types.ts`
- `src/components/Presentations/DeckBuilder/DeckBuilder.tsx`
- `src/components/Presentations/DeckBuilder/MediaLibraryBrowser.tsx`
- `src/components/ReportBuilder/*`
- `src/routes/AppRoutes.tsx`

Important current truth:

- the app already exposes a unified `Reports & Presentations` hub
- `RapTab` already models `templates | reports | presentations`
- the deck builder already has a media library browser
- report editing already has review semantics

### 3.2 Backend anchors

- `server/src/routes/report-builder.routes.ts`
- `server/src/routes/presentations.routes.ts`
- `server/src/services/report/pptx/PptxPipelineService.ts`
- `server/src/services/presentationGeneratorService.ts`
- `server/src/services/tablePlatform/ExportService.ts`
- `server/src/routes/my-work.routes.ts`
- `server/src/services/v8/reportsPresModelService.ts`

Important current truth:

- report builder already supports templates, versions, comments, share, and exports
- presentation generation already exists as a real pipeline
- `PptxPipelineService` already contains validation-first generation semantics
- table export already provides a practical seed for `sheet` export behavior

---

## 4. Canonical target architecture

The target runtime should have three layers.

### 4.1 Layer A — Artifact Substrate

Cross-format foundation for:

- artifact identity,
- lifecycle,
- source refs,
- version trace,
- exports,
- review state,
- library placement.

### 4.2 Layer B — Format Runtimes

Format-specific generators and editors:

- `Document runtime`
- `Presentation runtime`
- `Sheet runtime`

### 4.3 Layer C — Surface Integrations

User-facing surfaces that consume the same substrate:

- chat entry,
- outputs library,
- my work outputs,
- object-linked views,
- artifact workspace/editor.

Canonical rule:

`surface logic must not own artifact truth`

Artifact truth must live below the UI.

---

## 5. Proposed object model

The platform should converge on one shared object family.

### 5.1 `Artifact`

Core durable object.

Recommended fields:

- `id`
- `artifactType` = `document | presentation | sheet`
- `title`
- `ownerUserId`
- `organizationId`
- `status`
- `reviewState`
- `qualityState`
- `canonicalHome`
- `createdAt`
- `updatedAt`
- `archivedAt`

### 5.2 `ArtifactRun`

Tracks one generation or regeneration attempt.

Recommended fields:

- `id`
- `artifactId`
- `triggerType` = `chat | module_action | template | refresh`
- `sourceContextType`
- `sourceContextId`
- `requestedByUserId`
- `planJson`
- `runStatus`
- `startedAt`
- `completedAt`
- `failureReason`

### 5.3 `ArtifactVersion`

Durable version lineage.

Recommended fields:

- `id`
- `artifactId`
- `versionNumber`
- `createdFromRunId`
- `createdByUserId`
- `changeSummary`
- `storagePointer`
- `isCurrent`
- `createdAt`

### 5.4 `ArtifactSourceRef`

Grounding and source lineage.

Recommended fields:

- `id`
- `artifactId`
- `sourceType`
- `sourceId`
- `sourceTitleSnapshot`
- `sourceVersionSnapshot`
- `groundingJson`

### 5.5 `ArtifactExport`

Tracks rendered outputs.

Recommended fields:

- `id`
- `artifactId`
- `artifactVersionId`
- `format` = `docx | pptx | xlsx | pdf | html`
- `exportStatus`
- `filePathOrBlobRef`
- `exportedByUserId`
- `createdAt`

### 5.6 `ArtifactReview`

Review and approval envelope.

Recommended fields:

- `id`
- `artifactId`
- `artifactVersionId`
- `reviewState`
- `reviewedByUserId`
- `reviewNote`
- `createdAt`

### 5.7 `ArtifactAccess`

Visibility and access envelope.

Recommended fields:

- `artifactId`
- `visibilityScope` = `private | project | organization | review_shared | demo`
- `projectId`
- `accessPolicyRef`
- `sharedWithUserIds`
- `sharedWithRoleKeys`
- `createdAt`

### 5.8 `ArtifactOriginLink`

Bridge to existing format-native runtimes and legacy module truth.

Recommended fields:

- `artifactId`
- `originRuntime` = `report | presentation | sheet | native_artifact`
- `originRecordId`
- `isPrimaryOrigin`
- `createdAt`

---

## 6. Storage strategy

### 6.1 Canonical storage rule

Every artifact should have:

- metadata in the database,
- durable file or structured content storage,
- export records,
- source lineage,
- and a stable library location.

### 6.2 Practical storage split

Recommended split:

- DB for metadata and state
- object/file storage for exported binaries and heavy assets
- structured JSON or normalized content for editable internal states

### 6.3 Legacy shortcut preservation

The legacy documents shortcut should remain accessible.

Implementation rule:

- keep the shortcut / route alias,
- remap it to the new Outputs Library semantics,
- do not let it remain a separate storage universe.

### 6.4 Canonical registry migration strategy

`v8.1` must avoid creating a second registry beside existing report and presentation truth.

Canonical implementation decision:

- `Artifact` becomes the canonical cross-format registry for library discovery, personal queues and artifact identity,
- existing report and presentation tables remain the format-native storage and editor runtimes in Wave 1,
- a one-time idempotent backfill registers existing reports and presentations into the shared artifact registry,
- all new v8.1-created artifacts must create a shared `Artifact` record first and then attach an `ArtifactOriginLink`,
- library and `My Work` reads should resolve from the shared artifact registry, not by unioning ad hoc module tables,
- old module routes may continue to operate, but when they surface a durable output they must resolve to the shared artifact identity.

Operational rule:

`no artifact may appear in Outputs Library without a canonical Artifact id`

---

## 7. Frontend architecture

### 7.1 Outputs Library

Recommended new or evolved surface:

- existing `Reports & Presentations` hub becomes the kernel
- extend it into a broader `Outputs Library`
- keep old entry alias for user familiarity

Minimum tabs/views:

- `All`
- `Mine`
- `Needs review`
- `Documents`
- `Presentations`
- `Sheets`
- `Templates`

Important implementation note:

Current `RapTab` in `src/components/ReportsAndPresentations/types.ts` only supports:

- `templates`
- `reports`
- `presentations`

This must evolve into a broader artifact taxonomy without breaking current report/deck behavior.

### 7.2 Chat entry rail

Add a reusable chat action family:

- `create_artifact`
- `refresh_artifact`
- `convert_to_artifact`
- `open_artifact`

The UI should show:

- proposed type,
- proposed title,
- source context,
- destination library,
- template recommendation.

### 7.3 My Work outputs view

Add a personal surface under `My Work` that queries the same artifact registry.

Suggested slices:

- `my drafts`
- `waiting for my review`
- `recent outputs`
- `outputs linked to my work`

### 7.4 Object-linked outputs panels

Major modules should display linked artifacts:

- initiatives,
- finance analyses,
- notebooks,
- interviews,
- report/deck source objects.

---

## 8. Backend architecture

### 8.1 New shared services

Recommended shared services:

- `artifactRuntimeService`
- `artifactLibraryService`
- `artifactRunService`
- `artifactValidationService`
- `artifactVersioningService`
- `artifactLinkingService`

### 8.2 Format adapters

Recommended adapter services:

- `documentArtifactAdapter`
- `presentationArtifactAdapter`
- `sheetArtifactAdapter`

Each adapter should expose the same contract:

- `plan()`
- `generateDraft()`
- `validateDraft()`
- `exportVersion()`
- `refreshFromSources()`

### 8.3 Reuse boundaries

Reuse existing foundations instead of rewriting:

- report generation/review/version logic from `report-builder.routes.ts`
- presentation generation and builder logic from `presentations.routes.ts` and `presentationGeneratorService.ts`
- PPTX validation/generation patterns from `PptxPipelineService.ts`
- XLSX export foundations from `tablePlatform/ExportService.ts`

Canonical rule:

`v8.1 composes existing generators; it does not replace them on day one`

### 8.4 Governance integration with v8 execution spine

`ArtifactRun` and `ArtifactReview` must integrate with the existing governed execution model rather than compete with it.

Canonical implementation decision:

- chat-triggered durable generation uses the existing `v8` execution/proposal spine whenever the action is governed,
- `ArtifactRun` stores references to `executionRunId` and `contextSnapshotId`,
- accepting an artifact plan may create or advance a governed execution run,
- `ArtifactReview` is a post-generation version acceptance envelope,
- `ArtifactReview` may not replace execution approval for create/refresh actions that already require governed approval.

Practical meaning:

- execution spine answers `may the platform perform this durable creation or material refresh?`
- artifact review answers `is this produced version accepted for use, publish or export?`

---

## 9. API contract plan

### 9.1 Shared artifact APIs

Recommended new endpoints:

- `GET /api/artifacts`
- `POST /api/artifacts`
- `GET /api/artifacts/:id`
- `PATCH /api/artifacts/:id/metadata`
- `GET /api/artifacts/:id/versions`
- `POST /api/artifacts/:id/runs`
- `GET /api/artifacts/:id/source-refs`
- `GET /api/artifacts/:id/exports`
- `POST /api/artifacts/:id/export`
- `POST /api/artifacts/:id/review`
- `GET /api/artifacts/:id/access`
- `PATCH /api/artifacts/:id/access`

### 9.2 Chat-triggered APIs

Recommended orchestrator endpoints:

- `POST /api/artifact-runs/from-chat`
- `POST /api/artifact-runs/:runId/accept-plan`
- `POST /api/artifact-runs/:runId/retry`

### 9.3 My Work APIs

Recommended personal feed endpoints:

- `GET /api/my-work/outputs`
- `GET /api/my-work/outputs/review`

### 9.4 Compatibility rule

Existing endpoints stay operational:

- `/api/report-builder/*`
- `/api/presentations/*`

The new shared artifact APIs should initially orchestrate or aggregate them.

### 9.5 Access-control rule

Artifact APIs must enforce visibility based on shared artifact metadata, not only on the underlying module record.

Minimum filters:

- owner visibility
- project membership visibility
- organization visibility
- explicit review-share visibility
- demo-mode restrictions where applicable

---

## 10. Format-specific plans

### 10.1 Document runtime

Initial strategy:

- use current report/docx foundations as the first mature document path
- add broader artifact wrapping for non-report documents later

Wave 1 should support:

- report-derived documents,
- brief/memo-like structured artifacts,
- export records,
- version lineage.

### 10.2 Presentation runtime

Initial strategy:

- preserve current deck generator and builder
- elevate decks into shared artifact registry

Wave 1 should support:

- contextual creation from chat and sources,
- library placement,
- version and export visibility,
- review state,
- source refs.

### 10.3 Sheet runtime

Initial strategy:

- start from governed workbook export and generation,
- not from fully collaborative spreadsheet parity.

Wave 1 should support:

- analytical workbook generation,
- linked-source exports,
- structured workbooks as durable artifacts,
- export and reopen from library.

Important honesty rule:

`sheet runtime may start weaker than reports/presentations, but it must still join the same artifact substrate`

---

## 11. Validation architecture

Validation must become a first-class stage.

### 11.1 Shared validation

Check:

- artifact has source refs,
- artifact has title and owner,
- artifact has valid lifecycle transition,
- artifact version can be traced back to run.

### 11.2 Presentation validation

Reuse and deepen current pipeline gates:

- layout validity,
- element render warnings,
- slide structure sanity,
- export readiness.

### 11.3 Document validation

Check:

- document structure,
- section completeness,
- source traceability,
- export success.

### 11.4 Sheet validation

Check:

- workbook integrity,
- worksheet presence,
- formula/reference sanity where applicable,
- export validity.

---

## 12. Route and navigation plan

### 12.1 Preserve user familiarity

Keep the old shortcut/path users already know.

### 12.2 Canonical route target

Recommended target:

- route alias from legacy documents path
- canonical surface name in UI: `Outputs` or `Outputs Library`

### 12.3 Relationship to current presentations hub

Current `/presentations` routes remain valid in Wave 1.

Recommended evolution:

- `/presentations` continues as a focused route family
- broader outputs hub becomes the umbrella home
- cross-links connect both directions

---

## 13. Rollout phases

### Phase 1 — Shared artifact substrate

Deliver:

- artifact metadata model,
- artifact APIs,
- outputs library shell,
- route alias for legacy shortcut,
- report/presentation registration in shared library.

### Phase 2 — Chat-to-artifact orchestration

Deliver:

- chat actions,
- planning acceptance step,
- artifact run tracking,
- first contextual creation flows.

### Phase 3 — My Work integration

Deliver:

- personal outputs view,
- review queue,
- recent drafts,
- linked-work slices.

### Phase 4 — Sheet runtime

Deliver:

- first governed sheet generation flow,
- library listing,
- version and export support,
- source-linked workbook behavior.

### Phase 5 — Hardening

Deliver:

- deeper validations,
- better refresh-from-source,
- quality gates,
- optional share/publish deepening,
- operational observability.

---

## 14. Suggested engineering ownership

### Frontend

- outputs library shell and navigation
- chat action UX
- my work outputs slice
- object-linked outputs panels
- artifact workspace entry

### Backend

- artifact substrate services
- orchestration APIs
- versioning and export metadata
- format adapters
- validation services

### AI/runtime

- planner prompts and policies
- artifact run logic
- source grounding rules
- validation heuristics

---

## 15. Key engineering risks

- creating a second artifact registry beside existing report/deck tables
- breaking current reports/presentations UX while trying to unify too early
- treating sheet runtime as simple export-only forever
- losing source traceability between chat run and saved artifact
- overbuilding a new module before the substrate exists

Canonical mitigation:

`substrate first, surfaces second, parity depth third`

---

## 16. Non-goals for implementation

Do not do in Wave 1:

- full realtime co-editing across all artifact types
- heavy workflow engine for approvals
- full external cloud doc sync parity
- complete rewrite of report or deck builders
- giant new module split before proving the shared substrate

---

## 17. Delivery checklist

This package is engineering-complete when:

- one shared artifact model exists
- reports and presentations register into that model
- legacy shortcut opens the canonical outputs home
- chat can create a persistent artifact through a governed run
- my work reads from the same artifact registry
- sheet artifacts exist at least in first governed form
- exports, versions and source refs are visible and durable

---

## 18. Related canonical docs

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_IMPLEMENTATION_START_PACKET.md`
- `docs/product/AI_ARTIFACT_RUNTIME_ARCHITECTURE_V8.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_V8_MASTER_SUMMARY.md`
- `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- `docs/product/TOOLS_CATALOG_V3.md`
