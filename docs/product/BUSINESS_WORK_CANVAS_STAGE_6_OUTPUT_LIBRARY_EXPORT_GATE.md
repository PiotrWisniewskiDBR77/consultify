# Business Work Canvas Stage 6 Output Library Export Gate

Status: `DRAFT / STAGE 6 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 6 makes Canvas outputs durable enough to leave the immediate work surface without losing business context.

The goal is not to pretend every enterprise export runtime is finished. The goal is to make current outputs traceable, readable and honest: reports, tables and presentations preserve their source Canvas lineage, and available exports work outside the app.

## 2. Completed Scope

Stage 6 baseline includes:

- output metadata for created reports, tables and presentations,
- source draft and source version lineage on output read-back,
- owner, lifecycle and approved/final status metadata,
- `openInSourceCanvasUrl` for output details and integrations,
- source Canvas lookup from an output draft lineage,
- readable Markdown export for Canvas drafts,
- readable CSV export for tables or section summaries,
- metadata JSON export with content, blocks, sources and provenance,
- recoverable unsupported-format response for PDF, DOCX, XLSX and PPTX,
- Canvas toolbar actions for Markdown, CSV and metadata JSON export,
- targeted route and component tests for exports, lineage and fallback states.

## 3. Output Metadata Contract

Every created Canvas output must expose:

- `ownerId`,
- `lifecycleState`,
- `approvedFinalStatus`,
- source Canvas draft id,
- source Canvas version id when available,
- source conversation id,
- created-from operation,
- created-by user,
- created timestamp,
- `openInSourceCanvasUrl`.

This prevents the output library from duplicating Canvas data without traceability.

## 4. Export Contract

Current supported exports are:

- Markdown: full readable document plus block Markdown projections,
- CSV: first native table block when available, otherwise section summary rows,
- metadata JSON: source metadata, content, native blocks, sources and provenance.

Heavy exports are intentionally not marked as production-ready yet:

- PDF,
- DOCX,
- XLSX,
- PPTX.

Those formats must return a recoverable, user-readable unsupported response until dedicated renderers/converters exist.

## 5. Quality Gate

Stage 6 passes only when:

- exported Markdown, CSV and metadata JSON are readable outside the app,
- created output metadata preserves source draft and source version lineage,
- output responses include an "open in source Canvas" path,
- unsupported heavy exports fail honestly and recoverably,
- existing report, table and presentation creation still works,
- route and component tests cover export and lineage paths,
- changed files have no linter errors.

Stage 6 fails if:

- output metadata loses source Canvas lineage,
- export files omit the key business context,
- a share/export path exposes data without organization-scoped draft ownership checks,
- unsupported formats look successful to the user,
- existing output creation regresses.

## 6. Next Stage

The next implementation stage is Stage 7: Data Analysis And Dashboard Runtime.

Stage 7 should focus on dataset import, profiling and deterministic business-safe analysis jobs before introducing richer dashboard runtimes.
