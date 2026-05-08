# Sprint 4 — QA Engine Backend (Block C)

**Sprint ID:** `C-S4`
**Owner:** Agent A
**Status:** `PLANNED`
**Estimate:** ~1 day
**Epic:** EPIC-T11

## Goal

Ship `TableQaService` with 5-axis scoring, `tp_qa_reports` migration, recompute scheduling (debounced async), retrieval endpoint, and "mark not applicable" persistence.

## Pre-sprint risk check

C-T6 (recompute throughput), C-XB2/3 (Block A/B dependencies).

## Deliverables

- `TableQaService.ts` with `computeReport`, `getLatestReport`, `markSuggestionInapplicable`.
- Migration: `tp_qa_reports` table.
- Routes: `POST /tables/:id/qa/recompute`, `GET /tables/:id/qa/latest`, `POST /tables/:id/qa/suggestions/:sid/inapplicable`.
- Async recompute job hooked into record write events (debounced 5 min).
- Unit + integration tests.

## Files

### Created
- `consultify/server/src/services/tablePlatform/TableQaService.ts`
- `consultify/server/src/routes/table-platform.qa.routes.ts`
- Tests under `__tests__/`.
- Migration extension to `2026_05_block_c_ai_operator.sql` adding `tp_qa_reports`.

### Updated
- `consultify/server/src/services/tablePlatform/index.ts`
- `consultify/server/src/index.ts`

## Sprint Exit Gate

- [ ] Report computes on demand and via debounced async path.
- [ ] 5 axes implemented per `EPIC-T11`.
- [ ] Cross-tenant verified.
- [ ] Recommendation: `GO` to S5.
