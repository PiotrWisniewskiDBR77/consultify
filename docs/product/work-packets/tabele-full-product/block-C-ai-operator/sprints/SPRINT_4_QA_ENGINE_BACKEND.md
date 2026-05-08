# Sprint 4 — QA Engine Backend (Block C)

**Sprint ID:** `C-S4`
**Owner:** Agent A (CTO)
**Status:** `EXECUTED — GO`
**Estimate:** ~1 day
**Epic:** EPIC-T11
**Executed:** 2026-05-08 (Friday)

## Goal

Ship `TableQaService` with 5-axis scoring, `tp_qa_reports` migration,
recompute scheduling (debounced async), retrieval endpoint, and
"mark not applicable" persistence.

## Pre-sprint risk check

- **C-T6 (recompute throughput):** mitigated. Axis algorithms are pure
  in-memory after a single `Promise.all` of five DB reads. Hard cap on
  `MAX_RECORDS_FOR_FORMULA_SCAN = 1_000` keeps p95 well below the
  EPIC-T11 budget. Production-scale validation deferred to C-S7.
- **C-XB2/3 (Block A/B dependencies):** mitigated. Block A
  `governance_rules` is read via best-effort LEFT JOIN on
  `tp_bases.applied_template_id`; missing column → empty rules
  (methodology axis returns 1.0 when no rules apply). Block B
  `tp_record_sources` and `confidence_score` are wrapped in
  try/catch so QA can run even before Block B's migration is applied.

## Deliverables (status)

- [x] `TableQaService.ts` with `computeReport`, `getLatestReport`,
      `markSuggestionInapplicable`, `scheduleRecompute`.
- [x] Migration: `tp_qa_reports`, `tp_qa_suggestion_dismissals` (separate
      file `20260509_block_c_qa_engine.sql` + rollback).
- [x] Routes: `POST /tables/:id/qa/recompute`, `GET /tables/:id/qa/latest`,
      `POST /tables/:id/qa/suggestions/:sid/inapplicable`.
- [x] Async recompute via in-process debounced timer (5-min window).
      Tests inject a synchronous scheduler. BullMQ queue out of scope —
      see "Out of scope" below.
- [x] Unit tests: 19 new tests (TableQaService.test.ts).

## CTO scope decisions

1. **Axis weights (EPIC-T11):** completeness 0.25, freshness 0.15,
   sourceCoverage 0.25, methodology 0.20, formulaConsistency 0.15.
   Bands: green ≥ 0.85, amber ≥ 0.60, red < 0.60.
2. **Suggestion synthesis is deterministic.** No LLM calls in C-S4 →
   `AiUsageService.consume()` is NOT touched here. Suggestions act as
   payload prefills for the AI Editor flow which the user launches from
   the `TabeleQaPanel` in C-S5; that's where token spend happens.
3. **Durable dismissals via fingerprint.** Suggestions carry a stable
   SHA-1 fingerprint of `(tableId | axis | level | anchor)`. Dismissals
   live in `tp_qa_suggestion_dismissals (table_id, fingerprint)`; future
   recomputes filter visible suggestions by joining on this set so a
   dismissal survives across reports.
4. **In-process scheduler.** A 5-minute debounce on a `Map<tableId,
   Timeout>` is sufficient for C-S4. BullMQ wiring is **deferred** to
   the C-S6 source pack work where we already need the queue. Tests
   inject `__setSchedulerFnForTesting()` for determinism.
5. **Cross-tenant defense at TWO layers:** route layer reads
   `authReq.organizationId`; service layer re-checks
   `tp_bases.organization_id` on every read/write. Mismatch → 403
   `TENANT_VIOLATION`.
6. **Feature flag:** `ENABLE_TABLE_QA_ENGINE` (default `false`). Gate
   sits in routes; service is callable from internal code paths
   (e.g. `RecordsService.scheduleRecompute()` once C-S5 wires it).

## Out of scope (explicit, with rationale)

- BullMQ-backed scheduler. C-S4 ships in-process timer; queue migration
  becomes part of C-S6 source-pack scheduling.
- Frontend `TabeleQaPanel`. Owned by C-S5.
- LLM-generated suggestion text. Suggestions are deterministic.
- `tp_record_provenance.last_user_verified_at` — tracked under Block B
  follow-ups; QA freshness uses `tp_record_sources.last_verified_at`
  which is already shipped.

## Files

### Created

- `consultify/server/src/services/tablePlatform/TableQaService.ts`
- `consultify/server/src/routes/table-platform.qa.routes.ts`
- `consultify/server/src/services/tablePlatform/__tests__/TableQaService.test.ts`
- `consultify/server/migrations/20260509_block_c_qa_engine.sql`
- `consultify/server/migrations/rollback/20260509_block_c_qa_engine.down.sql`
- `docs/product/work-packets/tabele-full-product/block-C-ai-operator/evidence/sprint-4/validation-matrix-run.md`

### Updated

- `consultify/server/src/services/tablePlatform/index.ts`
  (re-exports `TableQaService` + types)
- `consultify/server/src/routes/index.ts`
  (re-exports `tablePlatformQaRoutes`)
- `consultify/server/src/Gateway.ts`
  (mounts QA routes after AI Editor routes)
- `consultify/server/src/config/FeatureFlags.ts`
  (adds `ENABLE_TABLE_QA_ENGINE`)

## Validation

- Block C suite: **94 / 94 tests passing**
  - C-S0/1: AiUsageService 11/11
  - C-S1/2/3: TableAiEditorService 15/15
  - C-S2: cell/record/column/structure 27/27
  - C-S3: view/relational/methodological/source 22/22
  - **C-S4: TableQaService 19/19 (new)**
- Lint: 0 errors on all changed files.
- Cross-tenant: tests #3, #15, #17 cover the 403 path explicitly.
- Persistence: tests #10, #11 verify the INSERT contract (column order
  + RETURNING id).
- Dismissal lifecycle: test #12 dismisses a suggestion and recomputes
  to confirm it disappears from `report.suggestions`.

## Sprint Exit Gate

- [x] Report computes on demand and via debounced scheduler.
- [x] 5 axes implemented per EPIC-T11.
- [x] Cross-tenant verified (3 dedicated tests).
- [x] Recommendation: **GO** to C-S5.
