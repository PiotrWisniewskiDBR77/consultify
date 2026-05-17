# Business Work Canvas Stage 2 Artifact Block Contract Gate

Status: `DRAFT / STAGE 2 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 2 adds the typed artifact block contract beneath the existing Work Canvas surface.

This stage does not introduce visible native table, chart or diagram editors. It creates the durable data model, Markdown projection rules and persistence path needed for Stage 3 interactive business artifacts.

## 2. Completed Scope

Stage 2 baseline includes:

- `CanvasArtifactBlock` shared frontend contract,
- block kind, status, capabilities and provenance metadata,
- block-level `markdownProjectionStatus`,
- optional `blocks` on Canvas document state and version summaries,
- frontend block normalization and Markdown projection helpers,
- backend block normalization and Markdown projection helpers,
- `blocks_json` persistence for Canvas drafts,
- `blocks_json` persistence for Canvas version snapshots,
- restore-version flow that restores both `contentMd` and `blocks`,
- autosave/PUT payload preservation for existing blocks,
- compatibility for existing Markdown-only drafts without migration.

## 3. Block Contract

Every block must have:

- stable `id`,
- `kind`: `table`, `chart`, `diagram`, `decision` or `research`,
- `schemaVersion`: `canvas-block/v1`,
- `title`,
- lifecycle `status`,
- explicit `capabilities`,
- native `data`,
- `provenance`,
- readable `markdownProjection`,
- honest `markdownProjectionStatus`.

Raw JSON is not a user-facing document view. Every block must have a readable Markdown projection, including degraded projections for missing or failed states.

## 4. Context Preservation Rules

Stage 2 must preserve:

- active `conversationId`,
- active `draftId`,
- current `contentMd`,
- optional `blocks`,
- block provenance,
- Markdown projection status,
- version snapshot and restore lineage.

Adding typed blocks must not force migration of existing Markdown-only drafts and must not replace the Markdown-first contract.

## 5. Quality Gate

Stage 2 passes only when:

- existing Markdown-only drafts map to Canvas state unchanged,
- drafts can carry `contentMd` and optional `blocks`,
- block projections are readable Markdown,
- failed or missing projections degrade honestly,
- draft saves and updates preserve `blocks`,
- version snapshots include `blocks`,
- version restore restores `blocks`,
- no raw JSON leaks into Markdown projections,
- targeted Canvas unit and route tests pass,
- changed files have no linter errors.

Stage 2 fails if:

- existing drafts require migration before opening,
- a block can be saved without projection status,
- restore loses block data,
- Canvas document view depends on raw JSON,
- autosave drops `blocks`.

## 6. Next Stage

The next implementation stage is Stage 3: Native Tables, Charts And Diagrams.

Stage 3 may now build visible native renderers on top of this Stage 2 contract:

```text
contentMd + optional typed blocks + always-readable Markdown projection
```
