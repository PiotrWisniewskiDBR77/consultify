# Sprint 1 — Table → Doc/Deck Backend (Block D)

**Sprint ID:** `D-S1`
**Owner:** Agent A
**Status:** `EXECUTED — GO`
**Estimate:** ~1 day
**Epic:** EPIC-T13
**Closed:** 2026-05-08

## Goal

Ship `TableArtifactConversionService` with a single `convertTable(target='document'|'presentation')` entry point, V8 snapshot adapter (CTO Q16), ACL filter, lifecycle audit row, route mounting.

## Pre-sprint risk check

D-T1 (V8 drift) — closed in D-S0 by Q16.
D-S3 (ACL filter) — covered by `SOURCE_PACK_TABLE_MISMATCH` + cross-tenant guards.
D-T2 (long conversions) — addressed by the injectable `ArtifactMaterializer` (stub today; D-S3 swaps for live wiring with timeout).

## CTO decisions applied

- **Q11**: reuse Document Studio v1 / DeckBuilder runtimes — service does NOT generate PDF/PPTX bytes.
- **Q15**: conversion entry point lives in MELS `share` panel — not implemented in D-S1 (UI is D-S3).
- **Q16**: thin adapter inside `TableArtifactConversionService` — done. Snapshot label discriminator (`source_pack_create` | `table_conversion`) lets us trace origin without growing the V8 registry.

## Deliverables shipped

- `server/migrations/20260512_block_d_table_conversions.sql` (+ rollback).
- `server/src/services/tablePlatform/TableArtifactConversionService.ts`.
- `server/src/routes/table-platform.conversion.routes.ts`.
- Feature flag `ENABLE_TABLE_ARTIFACT_CONVERSION` (default `false`).
- 19 unit tests covering ACL, lifecycle, snapshot adapter, validation.

## Files

### Created
- `consultify/server/migrations/20260512_block_d_table_conversions.sql`
- `consultify/server/migrations/rollback/20260512_block_d_table_conversions.down.sql`
- `consultify/server/src/services/tablePlatform/TableArtifactConversionService.ts`
- `consultify/server/src/routes/table-platform.conversion.routes.ts`
- `consultify/server/src/services/tablePlatform/__tests__/TableArtifactConversionService.test.ts`

### Modified
- `consultify/server/src/services/tablePlatform/index.ts`
- `consultify/server/src/Gateway.ts`
- `consultify/server/src/routes/index.ts`
- `consultify/server/src/config/FeatureFlags.ts`

## Sprint Exit Gate

- [x] Both targets (`document` / `presentation`) tested.
- [x] Cross-tenant 403 verified.
- [x] ACL filter verified (cross-tenant source-pack collapses + table-mismatch refusal).
- [x] Lifecycle / audit row tested via injectable materializer.
- [x] Recommendation: `GO` to D-S2.

## Outcome

`GO` to D-S2. See `evidence/sprint-1/validation-matrix-run.md`.
