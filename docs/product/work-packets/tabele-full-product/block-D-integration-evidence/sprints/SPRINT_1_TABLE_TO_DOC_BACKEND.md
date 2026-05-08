# Sprint 1 — Table → Doc/Deck Backend (Block D)

**Sprint ID:** `D-S1`
**Owner:** Agent A
**Status:** `PLANNED`
**Estimate:** ~1 day
**Epic:** EPIC-T13

## Goal

Ship `TableArtifactConversionService` with `convertToWordy` and `convertToPrezentacje`, V8 snapshot contract, ACL filter, async job, route mounting.

## Pre-sprint risk check

D-T1 (V8 drift), D-S3 (ACL filter), D-T2 (long conversions).

## Deliverables

- `TableArtifactConversionService.ts`.
- Routes: `POST /tables/:id/convert?target=wordy|prezentacje`.
- Tests including ACL + cross-tenant + V8 contract per target.

## Files

### Created
- `consultify/server/src/services/tablePlatform/TableArtifactConversionService.ts`
- `consultify/server/src/routes/table-platform.conversion.routes.ts`
- Tests under `__tests__/`.

### Updated
- `consultify/server/src/services/tablePlatform/index.ts`
- `consultify/server/src/index.ts` (mount route)

## Sprint Exit Gate

- [ ] Both targets tested.
- [ ] Cross-tenant 403 verified.
- [ ] ACL filter verified.
- [ ] Async job tested.
- [ ] Recommendation: `GO` to S2.
