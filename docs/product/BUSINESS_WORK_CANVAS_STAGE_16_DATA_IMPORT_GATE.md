# Business Work Canvas Stage 16 Data Import Gate

Status: `DRAFT / STAGE 16 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 16 makes XLSX a governed dataset source for Work Canvas.

The goal is to let business users upload spreadsheet data directly and convert it into table, chart, dashboard or findings blocks without leaving the Canvas approval and lineage model.

## 2. Completed Scope

- Backend dataset parser now accepts `csv`, `json` and `xlsx`.
- XLSX parsing uses the first worksheet and deterministic row extraction.
- Frontend upload detects `.xlsx` and sends base64 workbook content to the governed operation endpoint.
- Dataset-generated artifacts preserve original filename, draft id and conversation lineage.
- Existing preview/apply approval flow remains unchanged.

## 3. Safety Contract

- No spreadsheet macros or arbitrary workbook code are executed.
- Payload size is limited before profiling.
- Profiling remains limited to first 500 rows and first 50 columns.
- Generated outputs must show limitations.

## 4. Quality Gate

Stage 16 passes only when:

- XLSX can generate a dashboard block through the governed operation path,
- CSV/JSON dataset behavior still passes,
- frontend XLSX upload preserves filename and format,
- targeted route and component tests pass,
- changed files have no linter errors.
