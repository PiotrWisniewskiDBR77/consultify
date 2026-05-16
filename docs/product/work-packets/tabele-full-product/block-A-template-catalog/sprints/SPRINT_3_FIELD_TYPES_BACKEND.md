# Sprint 3 — Specialized Field Types Backend (Block A)

**Sprint ID:** `A-S3`
**Owner:** Agent A
**Status:** `BACKEND COMPLETE`
**Estimate:** ~1 day
**Epic:** EPIC-T7

## Goal

Add 5 specialized field types to `ALLOWED_FIELD_TYPES` with options validators
and runtime value checks. Mark `ai_generated_summary` and `ai_classification`
as AI-derived (NOT auto-generated) so manual writes remain allowed and are
audited as `manual_override = true` (per A-S0-F5).

## Pre-sprint risk check

- **A-XB1** — `source_reference` validator must accept null source_id when
  Block B not deployed → handled: validator accepts `null/undefined`,
  UUID string, `{source_id: UUID}` object, or `{external_url}` (only when
  `allow_external = true`).
- **C-XB1** — orchestration stubbed only. → `aiAuto` field is accepted in
  options shape; recompute orchestration is the responsibility of Block C
  `TableAiEditorService`.

## CTO Decision (deviation from initial sprint plan)

The initial sprint card said
`AUTO_FIELD_TYPES += ai_generated_summary, ai_classification`. This was
**rejected** in S0 finding A-S0-F5: AUTO_FIELD_TYPES rejects ALL manual
writes from clients, which would prevent reviewers from correcting an
AI-generated summary or reclassifying a record. The chosen contract is:

* `AUTO_FIELD_TYPES` (existing) — clients cannot write at all
  (`createdTime`, `autoNumber`, …).
* `AI_REGEN_FIELD_TYPES` (NEW, this sprint) — clients CAN write; manual
  writes are audited so reviewers see what the AI generated and what a
  human overrode. Block C uses this set to know which fields to recompute
  when source data changes.

## Deliverables

- [x] `consultify/server/src/services/tablePlatform/SpecializedFieldTypes.ts`
  - `SPECIALIZED_FIELD_TYPES = ['risk_score', 'priority',
    'ai_generated_summary', 'ai_classification', 'source_reference']`
  - `AI_REGEN_FIELD_TYPES = new Set(['ai_generated_summary',
    'ai_classification'])`
  - Defaults preset table (per EPIC-T7 §Default options).
  - `validateSpecializedField(type, options)` per-type guards.
  - `checkSpecializedFieldValue(type, value, options)` runtime cell
    validator (returns `{ok, message?}`).
  - Helpers: `isSpecializedFieldType`, `riskScoreMatrixSize`,
    `priorityValuesFor`, `defaultOptionsFor` (deep clone).
- [x] `SchemaValidationService.ts` extended (additive only):
  - `ALLOWED_FIELD_TYPES` extended via `[...base, ...SPECIALIZED_FIELD_TYPES]`
    (29 → 34).
  - `validateFieldOptions` dispatches to `validateSpecializedField` AFTER
    the existing per-type branches.
  - `validateRecord` switch adds 5 new case labels routed through
    `checkSpecializedFieldValue`.
- [x] Unit test `SpecializedFieldTypes.test.ts` (62 tests) covering surface,
  helpers, options validators (happy + error branches), runtime value
  checks for all 5 types.
- [x] Integration test `SchemaValidationService.specialized-fields.test.ts`
  (10 tests) covering ALLOWED_FIELD_TYPES count guard, dispatch into
  per-type validators, regression against existing `singleSelect` branch.
- [x] `index.ts` re-exports public surface.

## Files

### Created

- `consultify/server/src/services/tablePlatform/SpecializedFieldTypes.ts`
- `consultify/server/src/services/tablePlatform/__tests__/SpecializedFieldTypes.test.ts`
- `consultify/server/src/services/tablePlatform/__tests__/SchemaValidationService.specialized-fields.test.ts`

### Updated

- `consultify/server/src/services/tablePlatform/SchemaValidationService.ts`
  (additive only — no behaviour change for existing types).
- `consultify/server/src/services/tablePlatform/index.ts` (re-exports).

## Test results

```
SpecializedFieldTypes.test.ts                          62/62 PASS
SchemaValidationService.specialized-fields.test.ts     10/10 PASS
TOTAL A-S3 NEW                                         72/72 PASS
tsc --noEmit                                           clean
```

Pre-existing baseline failures (RecordsService.test 3, smoke.test 2,
MetadataService changeFieldType 5+, ModuleSyncService 5, migrationRunner 5,
InterfaceService updateLayout 2) reproduce on HEAD without this patch and
are tracked in the baseline-quality block backlog. **0 new regressions.**

## Sprint Entry Gate

- [x] S2 closed `GO`.
- [x] Anygravity P0 trial #1 prep card landed (run pending — backend gate
  does not depend on its outcome).

## Sprint Exit Gate

- [x] Backend typecheck clean.
- [x] Unit tests green (72/72).
- [x] Existing tests don't regress.
- [x] `risk_score`, `priority`, `ai_generated_summary`, `ai_classification`,
  `source_reference` accepted by `validateFieldType` and routed through
  `validateFieldOptions` to per-type validators.
- [x] Recommendation: `GO` to S4 (frontend cells can now build against the
  backend contract).

## Realized risks

- **R1: AUTO_FIELD_TYPES vs AI_REGEN_FIELD_TYPES contract.** The original
  sprint card had us add the two AI types to `AUTO_FIELD_TYPES`, which
  would have hard-blocked manual override. Caught by A-S0-F5 audit;
  resolved by introducing the separate `AI_REGEN_FIELD_TYPES` set and
  documenting it inline in `SchemaValidationService`.
- **R2: source_reference shape ambiguity.** Block B is not yet wired into
  the validator path, so the value contract must be permissive enough for
  A-S5 frontend to build the cell shell without breaking later when Block B
  ships. Resolved by accepting THREE shapes: a bare UUID string (Block B
  source_id), `{source_id: UUID}`, or `{external_url}` (only when
  `allow_external = true`). Block B integration in S4 will narrow this.
- **R3: ALLOWED_FIELD_TYPES drift.** Added a count guard test
  (`ALLOWED_FIELD_TYPES.length === 34`) so an accidental delete is caught
  before it reaches review.

## Daily evidence

- 2026-05-08 — Implementation, tests, lint clean. 72/72 new tests green;
  baseline regression unchanged. Tsc clean.
- 2026-05-08 — Commit attribution note: A-S3 files landed in commit
  `e2943118a` ("docs(document-studio): closeout 6.6 — Epic E4 Source
  Pack Connectors + chat-first creation"). The drive-sync overlay merged
  the A-S3 staged changes into the in-flight document-studio commit
  during the same `git commit` invocation. Functional content is
  identical to the planned A-S3 patch (`SpecializedFieldTypes.ts`,
  `SchemaValidationService.ts` extension, both test files, sprint card,
  `index.ts` re-exports). Audit trail is preserved via this card and the
  file-level diff in `e2943118a`; future B-S3-style isolation commits
  should occur outside the drive-sync window.

## Follow-up (S4+)

- Templates seeder upgrade: replace fallback `singleSelect/rating/url`
  fields with native `priority/risk_score/source_reference` types in the
  12 approved templates (A-S2 leaves `governance_rules.fallback_field_upgrades`
  pointing at the future types — a one-shot migration is enough).
- Block C orchestration: hook `AI_REGEN_FIELD_TYPES` into
  `TableAiEditorService` so `aiAuto = true` triggers recompute on source
  changes.
- Frontend cells (S5): `RiskScoreCell`, `PriorityCell`, `AiSummaryCell`,
  `AiClassificationCell`, `SourceReferenceCell`.
