# Tabele / Excel / Table Studio Runtime Retest - 2026-05-15

## Verdict

`DONE_PASS_WITH_MANUAL_UI_FOLLOWUP`

Sprint 3 reconciled the prior Tabele artifact-mapping and export drift on staging. The historical Table Studio artifact can now be read through the Table Platform API, its records are returned, CSV export includes real record values, XLSX export returns a workbook, and Block C/D feature surfaces respond as enabled runtime routes.

## Environment

- Staging URL: `https://demo.consultify.ai`
- Runtime SHA: `f1b0312acd89cd1f1c52f3c76739b8e6933fb788`
- Branch: `staging`
- Historical table artifact: `c1f2bdf6-6635-4a41-8fb8-cc68a00d8cbd`

## Fixes Applied

- `fix(tabele): repair table export pagination`
  - Fixed cursor pagination parameter indexing in `ViewQueryEngine` when export queries run without a field projection.
- `fix(tabele): preserve legacy keyed export values`
  - CSV/XLSX export now falls back from `field.id` to `field.name` for legacy/name-keyed record data.
- `fix(tabele): normalize form intake missing ids`
  - Malformed admin form-intake IDs now return controlled `FORM_NOT_FOUND` / `404` instead of surfacing as database errors.

## Validation Evidence

- Targeted Vitest suite: `93/93 PASS`
  - `server/src/services/tablePlatform/__tests__/FormIntakeService.test.ts`
  - `server/src/services/tablePlatform/__tests__/ExportService.test.ts`
  - `server/src/services/tablePlatform/__tests__/ViewQueryEngine.test.ts`
  - `server/src/routes/__tests__/table-platform.routes.test.ts`
- Production build: `PASS`
- Railway deployment: `SUCCESS`
- Runtime health:
  - `/api/health` returned `200` with SHA `f1b0312acd89cd1f1c52f3c76739b8e6933fb788`
  - `/api/table-platform/health` returned `healthy`, migrations `232`, and table platform checks `ok`

## Staging Runtime Probe

- `GET /api/table-platform/tables/c1f2bdf6-6635-4a41-8fb8-cc68a00d8cbd` -> `200`
- `GET /api/table-platform/tables/c1f2bdf6-6635-4a41-8fb8-cc68a00d8cbd/records` -> `200`
  - Returned `Initial item`, `Team`, `New`, `Medium`, and `Generated starter record for Table Studio validation.`
- `GET /api/table-platform/tables/c1f2bdf6-6635-4a41-8fb8-cc68a00d8cbd/export/csv` -> `200`
  - CSV contained:
    - `Name,Owner,Status,Priority,Due Date,Notes`
    - `Initial item,Team,New,Medium,2026-05-09,Generated starter record for Table Studio validation.`
- `GET /api/table-platform/tables/c1f2bdf6-6635-4a41-8fb8-cc68a00d8cbd/export/xlsx` -> `200`
  - Returned `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - Workbook size: `16649` bytes

## Block C/D Preflight

- `GET /api/table-platform/ai-editor/budget` -> `400 workspaceId is required`
  - Interpreted as enabled route validation, not disabled-state failure.
- `GET /api/table-platform/tables/:tableId/qa/latest` -> `204`
- `GET /api/table-platform/tables/:tableId/source-packs` -> `200 {"data":[]}`
- `GET /api/table-platform/tables/:tableId/conversions` -> `200 {"data":[]}`
- `GET /api/table-platform/forms/not-a-form-id/intake` -> `404 FORM_NOT_FOUND`

No probed Block C/D endpoint returned `*_DISABLED`, `not enabled`, or a hard `500`.

## Remaining Risk

The developer-side P1 blockers for Sprint 3 are closed. A full visual AnyGravity UI pass remains useful for Business Owner acceptance, especially for Table Studio screens and advanced conversion/form-intake UX, but it is no longer carrying an open backend/runtime P1.
