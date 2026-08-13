# DRD scoring — `calculation_version` backfill plan (COORD-11)

> Status: **PREPARED, NOT RUN.** No migration in this document has been
> executed. No SQL in this document has touched demo/staging/prod. Agent A13
> ran zero migrations and zero DB queries against a live database — everything
> below is grep-verified against the migration files in the repo, not against
> a live schema.
>
> Companion: `DRD_SCORING_V1_VS_V2.md` (numeric before/after), `docs/product/DRD_CANON.md`
> §6 (formulas), `DRD_MODEL_TRACEABILITY.md` (why this doesn't touch `DRDReportTemplate.tsx`).

## 1. Where DRD scoring results are persisted today (grepped, not guessed)

Two independent persistence paths exist. COORD-11's code changes
(`src/services/drdStructure.ts`, `src/services/report/drdReportModel.ts`)
belong to path A. Path B is a separate, newer kernel that COORD-11 did **not**
touch — flagged here so the coordinator has the full map, not because this
round writes to it.

### Path A — legacy assessment tables (live today, Postgres `public` schema)

Source: `server/migrations/20260719_baseline_gap.sql` (the authoritative,
already-applied Postgres definition — the earlier `293_assessment_workflow.sql`
/ `248_assessment_enhancements.sql` SQLite-flavored versions are superseded by
this one on the real demo/prod databases). Confirmed by grep, not assumed.

| Table | Column | Type | Holds |
| --- | --- | --- | --- |
| `assessments` | `id` | text | Session identity |
| `assessments` | `answers_json` | text | Raw answers (per-question) |
| `assessments` | `score_summary` | text | Free-form JSON — legacy engine's summary output |
| `assessments` | `overall_score` | real | Single legacy overall number |
| `assessments` | `maturity_level` | text | Legacy-derived label |
| `assessments` | `completion_percent` | text | Legacy completeness (all-areas-touched %, not `coverage` per canon §6.3) |
| `assessments` | `confidence_avg` | real | Legacy confidence average |
| `assessment_reports` | `id` | text | Report identity |
| `assessment_reports` | `axis_data` | text | **The area/axis scores themselves** — JSON of `{actual, target}` per axis, read/written by `server/src/routes/assessment-reports.routes.ts` (`areaScoresFromAxisData` mirrors this shape client-side in `src/services/report/drdReportClient.ts`) |
| `assessment_reports` | `generation_params` | text | Free-form JSON — **already exists, already nullable, already unindexed** |
| `assessment_reports` | `executive_summary`, `detailed_analysis`, `recommendations` | text | Narrative/derived content |

`server/src/routes/assessment-reports.routes.ts` is the live HTTP surface for
this path (P0's territory this round — **not edited, not even considered for
edits**, per the coordinator's isolation instructions).

### Path B — method-core kernel (new, additive, `20260813_method_core_kernel.sql` / `20260813_method_outputs.sql`)

| Table | Column | Type | Holds |
| --- | --- | --- | --- |
| `method_sessions` | — | — | The kernel's `MethodSession` (`src/method-core/contracts/session.ts`) |
| `method_outputs` | `aggregation_json` | **JSONB** | The full `AggregationResult` (`src/method-core/contracts/methodPack.ts`) produced by `drdAdapter.aggregate()` (`src/method-core/methods/drd/drdAdapter.ts`) |
| `method_report_snapshots` | — | — | The kernel's `ReportSnapshot` (`src/method-core/outputs/types.ts`) |

This path is browser-local only today (`drdSessionRuntime.ts`'s own doc:
"does NOT talk HTTP to `server/src/method-core/*Service`... explicitly NOT
done in this slice"). `drdAdapter.aggregate()` already excludes
null/unknown/N/A unit levels from its mean (a partial fix, done independently
of COORD-11) but does **not** normalize across `Lmax` — DEFECT 1 from
COORD-11's brief still applies to this path, un-fixed. **This document does
not propose changing `AggregationResult`/`drdAdapter.ts`** — see
`DRD_SCORING_V1_VS_V2.md` §"Known gap not fixed this round" for why, and note
that `PrioritisationResult.calculationVersion?: string` (added for SIRI,
COORD-08) is the precedent to follow if/when this path is versioned too:
because `aggregation_json` is JSONB, adding an optional field to
`AggregationResult` would flow into the DB with **zero migration** — it's a
free future step, just not taken in this round.

## 2. Proposed additive columns (NOT RUN)

Both are pure additive `ADD COLUMN IF NOT EXISTS`, nullable, no backfill of
existing rows, no rewrite, no lock beyond a metadata change on Postgres
(`ADD COLUMN ... DEFAULT NULL` is O(1) on PG 11+, no table rewrite):

```sql
-- NOT RUN. Draft only.
ALTER TABLE assessment_reports
  ADD COLUMN IF NOT EXISTS calculation_version TEXT;
  -- 'legacy_v1' | 'drd_scoring_v2', NULL for every historical row (see §3).

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS calculation_version TEXT;
```

Why a dedicated column instead of stuffing it into the existing
`generation_params` JSON blob on `assessment_reports`: `calculation_version`
is a filter/audit dimension ("show me every report generated under v1 before
we flip the default"), and a dedicated column is queryable/indexable without
a JSON path expression; `generation_params` stays for engine-internal
parameters that aren't meant to be queried. Either would be additive and
non-breaking — this is a preference, not a requirement, flagged for the
coordinator to confirm before anyone runs it.

## 3. Why existing approved rows are NEVER recalculated

Three independent guards, all already true today without any new code:

1. **NULL means "written before COORD-11 existed"**, not "legacy_v1 by
   inference-and-recompute". A `NULL calculation_version` row is read as-is;
   nothing in this plan re-derives or overwrites its `axis_data`/
   `score_summary`. A read-path label (`NULL → "legacy_v1 (pre-versioning)"`)
   is a presentation concern for a later ticket, not a write.
2. **`buildDrdReportModel()` (this round's code) never mutates its input.**
   It is a pure function: `areaScores in → DrdReportModel out`. There is no
   `recalculate`/`backfill`/`migrate` export from `drdReportModel.ts` — see
   `src/services/__tests__/drdReportModel.calculationVersion.test.ts`, test
   "there is no recalculate/backfill entry point exported", which asserts
   this by enumerating the module's actual exports.
3. **The flag defaults OFF** (`src/utils/drdScoringV2Flag.ts`). Flipping it
   changes what a *new* `buildDrdReportModel()` call computes; it cannot
   reach into a row already sitting in `assessment_reports.axis_data` and
   change it. A stored report is a snapshot in text; nothing re-reads and
   rewrites it on a flag flip.

## 4. If/when this plan is executed (future ticket, not this round)

1. Run the two `ADD COLUMN IF NOT EXISTS` statements above on
   demo/staging, then prod — additive, zero downtime expected, verify with
   `\d assessment_reports` / `\d assessments` before and after (row counts
   identical, no lock wait > default `lock_timeout`).
2. New writes only: the route handler(s) in
   `server/src/routes/assessment-reports.routes.ts` start writing
   `calculation_version: 'legacy_v1'` (hardcoded, matching the flag default)
   on every new report/assessment save. This is an HTTP-path change — P0's
   territory, out of scope for A13, and must not happen silently alongside a
   flag flip.
3. Existing rows stay `NULL` forever, or get a **one-time, explicitly
   reviewed** UPDATE that stamps `calculation_version = 'legacy_v1'` on every
   row where it is currently `NULL` (a label, not a recompute — the
   `axis_data`/`score_summary` values are untouched by this UPDATE). This
   step needs its own sign-off; it is not bundled into the additive-column
   migration.
4. `drd_scoring_v2` is never backfilled onto historical rows by this plan,
   under any circumstance — a v2 number for a historical assessment can only
   be produced by re-opening that assessment and running a **new**,
   separately-approved report generation, which the existing
   `revision_of_output_id`/`lineage` conventions (Path B) or a new
   `assessment_reports` row + `version` bump (Path A) already model. No new
   mechanism is needed for this — it already exists for the "a correction is
   a new freeze" rule (`OutputLineage` doc in `src/method-core/outputs/types.ts`).

## 5. Comparison procedure (before/after), for whoever runs step 4 above

1. Pick N historical `assessment_reports` rows with `completion_percent` at
   varying levels (some near 100%, some partial — partial rows are where v1
   vs v2 diverge most, since that's where DEFECT 2 bites).
2. For each, load `axis_data`, run it once through
   `calculateOverallScoreV2`/`calculateAxisScoreV2` (read-only, does not
   write anything back).
3. Record `{reportId, v1.actual, v2.scoreNorm, v2.coveragePercent, delta,
   reason}` — the exact shape used in `DRD_SCORING_V1_VS_V2.md`'s table.
4. Never write the v2 numbers back onto the row. This step produces a
   **report for humans to review**, not a migration.

## NOT VERIFIED

- Whether `assessment_reports`/`assessments` on the actual demo/staging/prod
  databases match `20260719_baseline_gap.sql` exactly (grepped from the
  migration file, not queried against a live DB — A13 ran zero DB queries,
  per the coordinator's ban on touching demo/staging/prod).
- Row counts / how many historical `assessment_reports` rows exist to
  eventually backfill a label onto (§4.3) — not queried.
- Whether `server/src/routes/assessment-reports.routes.ts` is the *only*
  writer of `axis_data`, or whether `server/src/services/demo/demoSeedService.ts`
  (also found via grep) writes it too outside that route — both were found by
  grep for `buildDrdReportModel`/`areaScoresFromAxisData`, but demoSeedService.ts
  itself was not read in this round.
