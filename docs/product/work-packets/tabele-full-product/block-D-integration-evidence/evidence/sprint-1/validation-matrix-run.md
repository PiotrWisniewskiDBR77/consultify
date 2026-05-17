# D-S1 — Validation Matrix Run

**Date:** 2026-05-08
**Verdict:** `GO` — D-S2 may proceed.
**Feature flag posture:** `ENABLE_TABLE_ARTIFACT_CONVERSION = false` (default off; matches Block C posture).

## Layered validation

| Layer | Check | Result | Evidence |
|---|---|---|---|
| L1 | TypeScript strict compile (`server/tsconfig.json`) | PASS | `npx tsc --noEmit -p server/tsconfig.json` — zero errors on the new files. |
| L1 | ESLint on new + modified files | PASS (warnings only) | `npx eslint --fix` left 19 conventional warnings (test-file `non-null-assertion` + a couple of `any` casts in test mocks). Same posture accepted in C-S6. |
| L2 | Backend unit tests for `TableArtifactConversionService` | PASS — 19/19 | `npx vitest run server/src/services/tablePlatform/__tests__/TableArtifactConversionService.test.ts` |
| L2 | Block C regression (`SourcePackBuilderService`, `AiUsageService`, `TableQaService`) | PASS — 51/51 | Same vitest run shows zero regressions in Block C tests. |
| L3 | Frontend component tests | N/A — no UI shipped in D-S1 (per sprint plan) | Lane UI lands in D-S3. |
| L4 | Migration replay on staging | DEFERRED to D-S5 dogfood | Migration is additive (new table only) and idempotent. |
| L5 | Cross-tenant ACL | PASS | Tests `TENANT_VIOLATION`, `WORKSPACE_VIOLATION`, `SOURCE_PACK_NOT_FOUND` (collapses cross-tenant pack reads), `getConversion` collapses cross-tenant rows to `null`. |
| L6 | DBR77 hex scan | N/A | No new UI in D-S1. |
| L7 | Audit lifecycle (`queued → running → succeeded|failed`) | PASS | Tested for happy path, materializer throw, materializer no-runId, source-pack reuse, live-snapshot fallback. |
| L8 | Source-pack adapter (CTO Q16) | PASS | Tests verify snapshot inheritance preserves `captureSource = 'source_pack_create'` AND that fresh snapshots tag `'table_conversion'`. Mismatch refusal (`SOURCE_PACK_TABLE_MISMATCH`) covered. |

## Test inventory

19 tests in `TableArtifactConversionService.test.ts`:

1. `convertTable` rejects missing `tableId` / `organizationId` / `workspaceId` / `initiatedBy`.
2. `convertTable` rejects unknown targets (`INVALID_TARGET`).
3. `convertTable` returns 404 when the table does not exist.
4. `convertTable` refuses cross-tenant tableIds (`TENANT_VIOLATION`).
5. `convertTable` refuses workspace mismatches (`WORKSPACE_VIOLATION`).
6. `convertTable` rejects an empty table (`NO_RECORDS`).
7. `convertTable` captures a fresh live snapshot when no source pack is supplied (with `title` propagation, `captureSource='table_conversion'`).
8. `convertTable` reuses a source pack snapshot and bumps `used_count` on success.
9. `convertTable` refuses a source pack that belongs to another table.
10. `convertTable` returns 404 when the source pack is missing or in another tenant.
11. `convertTable` marks the conversion `failed` when the materializer throws.
12. `convertTable` marks the conversion `failed` when the materializer returns no run id.
13. `convertTable` validates `outline` + `title` length (3 sub-cases).
14. `convertTable` swallows `markPackUsed` errors without failing a successful conversion (logs a warn).
15. `getConversion` rejects empty `conversionId` / `organizationId`.
16. `getConversion` returns `null` on miss and on cross-tenant rows.
17. `getConversion` returns the row when org matches.
18. `listConversions` rejects empty `organizationId`.
19. `listConversions` returns rows from the mock router.

## Files shipped

### Created

- `server/migrations/20260512_block_d_table_conversions.sql`
- `server/migrations/rollback/20260512_block_d_table_conversions.down.sql`
- `server/src/services/tablePlatform/TableArtifactConversionService.ts`
- `server/src/routes/table-platform.conversion.routes.ts`
- `server/src/services/tablePlatform/__tests__/TableArtifactConversionService.test.ts`

### Modified

- `server/src/config/FeatureFlags.ts` — `ENABLE_TABLE_ARTIFACT_CONVERSION` (default `false`).
- `server/src/routes/index.ts` — re-export `tablePlatformConversionRoutes`.
- `server/src/Gateway.ts` — mount `tablePlatformConversionRoutes` on `/api/table-platform`.
- `server/src/services/tablePlatform/index.ts` — re-export `TableArtifactConversionService` + types.

## Sprint Exit Gate

- [x] Both targets (`document` / `presentation`) tested via parameterized cases.
- [x] Cross-tenant 403 verified (`TENANT_VIOLATION`, `WORKSPACE_VIOLATION`).
- [x] ACL filter verified (cross-tenant source pack collapses to 404; getConversion collapses cross-tenant to null).
- [x] Async-job lifecycle tested via injectable `ArtifactMaterializer` (stub default; live wiring deferred to D-S3).
- [x] Recommendation: `GO` to D-S2.
