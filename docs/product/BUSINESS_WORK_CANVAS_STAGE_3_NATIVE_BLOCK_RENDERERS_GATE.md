# Business Work Canvas Stage 3 Native Block Renderers Gate

Status: `DRAFT / STAGE 3 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 3 introduces the first visible native artifact interactivity in Work Canvas.

This stage builds on the Stage 2 typed block contract. Markdown remains the primary document surface and every block still has a readable Markdown projection. Native renderers enhance the document view; they do not replace the Markdown-first contract.

## 2. Completed Scope

Stage 3 baseline includes:

- native table block renderer,
- table filtering,
- table sorting,
- row selection,
- Markdown copy for blocks,
- CSV export for table blocks,
- lightweight chart renderer from block metrics/series,
- lightweight diagram renderer from nodes/edges,
- renderer fallback state for failed or missing projections,
- block provenance/status/projection display,
- selection-to-table action,
- selection-to-chart action,
- selection-to-diagram action,
- component tests for native renderers, selection transforms and degraded renderer behavior.

## 3. Current Renderer Strategy

Stage 3 intentionally starts with dependency-light renderers:

- tables use native React table rendering,
- charts use a safe bar-summary renderer,
- diagrams use a safe node/flow summary renderer.

Vega-Lite and Mermaid runtime integrations remain planned follow-ups once the business behavior, persistence and fallback contract are stable.

## 4. Context Preservation Rules

Every generated block must preserve:

- active `conversationId` when available,
- active `draftId` when available,
- selected Canvas text as source data,
- block `provenance`,
- block `markdownProjection`,
- block `markdownProjectionStatus`.

Generated blocks are added to the current Canvas document state and mark the draft as unsaved. Autosave and draft persistence preserve `blocks` through the Stage 2 contract.

## 5. Quality Gate

Stage 3 passes only when:

- typed table, chart and diagram blocks render without raw JSON,
- table filter/sort/row selection work in the document view,
- copy/export actions preserve business-readable content,
- selected Canvas text can become a table block,
- selected Canvas text can become a chart block,
- selected Canvas text can become a diagram block,
- renderer failure never blanks the Canvas,
- generated blocks include title, projection status and provenance,
- targeted Canvas component and contract tests pass,
- changed files have no linter errors.

Stage 3 fails if:

- a broken renderer blanks the Canvas document,
- users need to edit raw JSON to see a block,
- generated blocks lose chat/draft context,
- Markdown-only documents regress,
- copy/export actions expose technical payloads instead of readable content.

## 6. Next Stage

The next implementation stage is Stage 4: Business Transformations.

Stage 4 should move beyond local UI transforms into governed block-aware operations:

```text
proposal -> preview -> approval -> version snapshot -> audit/read-back
```
