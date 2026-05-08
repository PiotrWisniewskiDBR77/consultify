# Sprint 3 — Specialized Field Types Backend (Block A)

**Sprint ID:** `A-S3`
**Owner:** Agent A
**Status:** `PLANNED`
**Estimate:** ~1 day
**Epic:** EPIC-T7

## Goal

Add 5 specialized field types to `ALLOWED_FIELD_TYPES` with validators and default options. Mark `ai_generated_summary` and `ai_classification` as auto-derived. Stub orchestration for AI recompute (full implementation in Block C).

## Pre-sprint risk check

A-XB1 — `source_reference` validator must accept null source_id when Block B not deployed. C-XB1 — orchestration stubbed only.

## Deliverables

- `consultify/server/src/services/tablePlatform/SpecializedFieldTypes.ts` with constants, validators, defaults.
- `SchemaValidationService.ts` extended:
  - `ALLOWED_FIELD_TYPES` += 5 new entries
  - `validateFieldOptions` routes new types to `validateSpecializedField`
  - `AUTO_FIELD_TYPES` += `ai_generated_summary`, `ai_classification`
- Unit test `SpecializedFieldTypes.test.ts` covering each type's happy path + invalid input.
- Existing `SchemaValidationService.test.ts` regression: no new failures.

## Files

### Created
- `consultify/server/src/services/tablePlatform/SpecializedFieldTypes.ts`
- `consultify/server/src/services/tablePlatform/__tests__/SpecializedFieldTypes.test.ts`

### Updated
- `consultify/server/src/services/tablePlatform/SchemaValidationService.ts` (additive only)
- `consultify/server/src/services/tablePlatform/index.ts` (export)

## Sprint Entry Gate

- [ ] S2 closed `GO`.
- [ ] Anygravity P0 trial #1 PASS or accepted constraints.

## Sprint Exit Gate

- [ ] Backend typecheck clean.
- [ ] Unit tests green.
- [ ] Existing tests don't regress.
- [ ] `risk_score`, `priority`, `ai_generated_summary`, `ai_classification`, `source_reference` accepted by `createField` API.
- [ ] Recommendation: `GO` to S4.

## Realized risks

(filled at exit)

## Daily evidence

(filled per day)
