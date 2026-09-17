# RB-2 export P1 — W195

- **Verdict:** READY FOR CTO REVIEW
- **Owner:** [B] Codex-2
- **Base:** `1b662df8cd2cac255f008d40a6dd13d3718d879d`
- **Branch:** `codex/b-rb2-export-p1-w195-20260917`
- **Marker:** `[ODMROZENIE 11_MATERIALS DEC-589] [B]`

## Delivered behavior

- PDF, DOCX and PPTX responses use one RFC 6266/RFC 5987 attachment helper. The ASCII fallback never contains non-latin1/control characters; `filename*` preserves the UTF-8 title.
- The helper is wired into all three authenticated exports and all three public-share exports. A title containing `—` now returns 200 instead of `ERR_INVALID_CHAR`/500.
- Report ownership is checked with the caller's organization before the quality gate. A cross-organization export returns `403 REPORT_EXPORT_FORBIDDEN`; the quality service and export audit are not called.
- DEC-543 is applied to Report Builder: quality findings are advisory response headers (`X-Report-Quality-*`) and do not produce `409 REPORT_NOT_READY_FOR_EXPORT`.
- Canonical `completed` audit is written only after attachment headers are valid, preventing the previous `completed` + `failed` pair for one header failure.
- Legacy Report Builder PPTX v1 and assessment-deck services load `pptxgenjs` through `createRequire(import.meta.url)` in Node ESM.

## Files

- `server/src/utils/contentDisposition.ts`
- `server/src/routes/report-builder.routes.ts`
- `server/src/routes/report-builder-public.routes.ts`
- `server/src/services/report/PptxExportService.ts`
- `server/src/services/assessmentDeckService.ts`
- `tests/integration/routes/report-builder.export-trace.routes.test.ts`
- `tests/unit/services/pptx-esm-loading.test.ts`

## Gates

- Exact-lock install: `npm ci --ignore-scripts`; `@types/node@22.19.3`.
- Frontend TypeScript, same dependency tree: line `152`, candidate `152`, RC `2`/`2`; logs are byte-identical (`bf9c9c72…`), diff RC `0`, zero lines.
- Server TypeScript in lock-ci: RC `0`, zero errors.
- Vitest: `5` files, `26` tests, all PASS. Coverage includes private/public PDF/DOCX/PPTX headers, quality advisory, cross-org 403/no writes, approval/fail-closed regressions and a real legacy PPTX ZIP generation in ESM.
- Mutation: replacing the DOCX helper with the former raw Unicode header makes the behavior test RED (`1` failed, RC `1`); restored suite is GREEN.
- ESLint on changed production files: RC `0`, zero errors (existing warnings remain); Prettier and `git diff --check`: PASS.

Evidence is in `dowody/`. No push to integration/staging and no deployment were performed.
