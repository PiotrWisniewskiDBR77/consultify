# Business Work Canvas Stage 7 Data Analysis Dashboard Gate

Status: `DRAFT / STAGE 7 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 7 introduces the first controlled data analysis runtime for Work Canvas.

The goal is to approach business-friendly data analysis without exposing arbitrary code execution. Dataset handling is deterministic, server-side and auditable: import text data, profile it, then generate traceable artifact blocks.

## 2. Completed Scope

Stage 7 baseline includes:

- CSV dataset import from the Canvas upload control,
- JSON dataset import through the governed operations endpoint,
- deterministic server-side dataset parsing and profiling,
- row count, column profile, inferred type, missing value count and sample rows,
- dataset size and profile limits,
- `generate_artifact_from_dataset` governed operation,
- preview-only support before approval,
- approved dataset transformations with version snapshots,
- dataset-to-table block generation,
- dataset-to-chart block generation,
- dataset-to-dashboard block generation,
- dataset-to-findings research block generation,
- dashboard block renderer with KPI cards, chart grid, narrative insights, recommended actions and limitations,
- dataset provenance on generated blocks.

## 3. Safety Contract

Stage 7 does not run arbitrary user code.

Current analysis is limited to:

- CSV parsing,
- JSON row extraction,
- deterministic profiling,
- deterministic block generation.

Every dataset-generated artifact must expose data limitations. Heavy analysis runtimes, isolated Python jobs, XLSX parsing and PDF table extraction are future work and must remain behind explicit runtime isolation and audit requirements.

## 4. Lineage Contract

Every dataset-generated block must preserve:

- source type `import`,
- `conversationId`,
- `draftId`,
- dataset id,
- filename,
- creating user,
- created timestamp.

This preserves Canvas context and prevents charts or dashboards from becoming detached from the uploaded dataset.

## 5. Quality Gate

Stage 7 passes only when:

- uploaded CSV/JSON data never breaks chat or Canvas context,
- users can generate table, chart, dashboard and findings artifacts from a dataset,
- analysis output includes visible data limitations,
- preview-only dataset analysis does not mutate the draft,
- approved dataset analysis creates a version snapshot,
- generated dashboard explains business meaning through insights and recommended actions,
- no arbitrary execution is exposed,
- targeted route and component tests pass,
- changed files have no linter errors.

Stage 7 fails if:

- arbitrary code execution is reachable,
- dataset artifacts cannot be traced to uploaded data,
- dashboards render charts without limitations or business context,
- dataset import bypasses the governed operations endpoint,
- prior Canvas block behavior regresses.

## 6. Next Stage

The next implementation stage is Stage 8: Team Workflow Runtime.

Stage 8 should build a workflow ledger around Teresa actions, user approvals, generated artifacts and resumable multi-step work.
