# W2 — Deterministic backfill: determinism + idempotency proof (FC-02.2)

**Program:** Finance v3, worktree `/Users/piotrwisniewski/consultify-wt/w2-backfill`, branch
`codex/finance-v3-w2-backfill`.
**Starting commit:** `403d430520` ("fix(finance-v3): fan-in interaction defect — coldReopen unwraps
findOrCreateMethod result union").
**Determinism-fix commit:** `a982253bda` ("fix(finance-v3): deterministic seed data in WP-C03
backfill dry-run").
**Date:** 2026-08-10.
**Gate condition under test:** FC-02.2 "deterministic backfill", previously `PARTIAL` — a dry run
had been executed (`WP-C03_backfill_dryrun_report.md`, 949 synthetic rows) but nobody had shown that
two independent runs on the same input produce the same output. That is the literal meaning of
"deterministic" and this report either proves it or reports `EVIDENCE_MISSING` honestly.

**Environment:** own ephemeral Postgres 15 cluster, `PGDATA=/private/tmp/fv3-bf-pgdata`, socket
`/tmp/fv3bfsock`, port `57731`, three databases on the same cluster (`fv3_bf_a`, `fv3_bf_b`,
`fv3_bf_c` — a third database was created for the idempotency baseline and the concurrency test, see
§6/§7; still "one ephemeral cluster", not a second cluster). Cluster torn down at the end of this
session (§9). No connection to any shared, demo, staging or production database was made at any
point — verified by every `DATABASE_URL` used in this report pointing at `127.0.0.1:57731`.

---

## 1. Inventory of the real backfill code

There is no "the backfill" running in the product today — no cron job, no route, no scheduled task
calls this code. The only real, executable backfill logic in the repository is a standalone,
manually-invoked CLI script, confirmed by `grep -rl backfill server/src` returning only unrelated
hits (other, older backfill scripts for unrelated features — role migration, SSO secret encryption,
entity-title decoding — none of them Finance-related) and one comment reference from a test file.

**File:** `server/scripts/finance-v3-backfill-dry-run.ts` (1,919 lines after this session's fix).
Three subcommands, all requiring an explicit `--database-url`/`DATABASE_URL` (main() line ~1868:
`if (!databaseUrl) { ... process.exit(2); }` — refuses to guess a default, same discipline as the
migration runner).

| Command | What it does | Code |
|---|---|---|
| `seed` | Populates ~1,000 synthetic legacy rows across 3 orgs + 1 unregistered "ghost" org, modeled on the real legacy schema (12 tables). Also creates 2 tables (`analysis_financials`, `initiative_financials`) that do not exist on a fresh Postgres migration replay at all — see WP-C03 report §2, re-confirmed unchanged in this session (migrations still skip `067_.../068_...` on strict replay). | `seed()`, line 553 |
| `run [--resume] [--chunk-size N] [--crash-after N] [--run-batch NAME]` | The actual backfill: reads legacy rows in fixed-size chunks ordered by legacy PK (`sortedIds()`, line 534: `ORDER BY id ASC`), classifies each row (WP-A01 manifest, loaded fresh from JSON every run — `loadClassification()`, line 124), and writes canonical `finance_artifacts`/`finance_business_versions`/`finance_artifact_aliases`/`finance_lineage_edges`/`finance_working_revisions`/`finance_compute_snapshots`/`finance_export_manifests` rows, or a quarantine/excluded-log row. One chunk = one Postgres transaction (`runChunked()`, line 421). | `runBackfill()` → `phaseStatements/Analysis/Models/Prediction/Valuation/Exports`, lines 1717–1746 |
| `verify` | Equation check (`input = migrated + quarantined + excluded` per legacy table) + duplicate-alias check + checkpoint/timing summary against the live DB. | `verify()`, line 1757 |

**Who runs it:** nobody in production — it is invoked by hand (`tsx server/scripts/...`) against a
throwaway cluster, exactly as this report does. There is no orchestrator, no job queue entry, no
route. This matches the WP-C03 report's own framing ("this dry run doesn't have [a live orchestrator
process]") and is unchanged by this session.

**Does dry-run == real run minus writes?** No — there is no separate "dry-run mode" flag. `run` is
the one and only execution path and it always writes (it is called "dry run" only in the sense that
it targets a throwaway database, not because it has a read-only mode). This is worth flagging
precisely because the gate's own dry-run report title could be misread as "a `--dry-run` flag was
exercised" — it was not; the whole *database* is the dry-run, not the code path.

**Bookkeeping tables** (`finance_v3_backfill_checkpoints`, `finance_v3_backfill_quarantine_log`,
`finance_v3_backfill_excluded_log`) are created by the script itself (`ensureBookkeeping()`, line
144, `CREATE TABLE IF NOT EXISTS`) — they are **not** shipped product migrations, confirmed by
`grep -rn finance_v3_backfill server/migrations/*.sql` returning nothing.

**Resume mechanism:** the checkpoint table's primary key is `(phase, legacy_table, organization_id,
chunk_index)`. `run` without `--resume` against a database that already has a `status='done'`
checkpoint for the first chunk it reaches **throws and exits 1** rather than silently reprocessing or
silently no-op-ing (line 449, `"Refusing to silently continue a prior run."`) — reproduced live in
§6 below.

---

## 2. A pre-existing bug this session found and fixed before determinism could even be tested

**`seed()` was not itself deterministic.** Two lines used real, non-seeded randomness:

- `server/scripts/finance-v3-backfill-dry-run.ts:630` (pre-fix): `Math.round(Math.random() *
  1_000_000) / 100` for every non-null `financial_statement_values.value` (8 per statement × 3
  statements × 6 packs × 3 orgs = 432 values).
- Two `new Date()` calls for legacy `approved_at` columns (`financial_models`, `valuations`).

This meant two independent `seed` invocations against two fresh databases produced **different**
legacy data (different dollar amounts, different approval timestamps) even before the backfill logic
ran at all — the input to the determinism test was itself non-reproducible. Every downstream
per-chunk checksum (`hashRows()`, which the script itself uses to prove it never mutates legacy
tables mid-chunk) would also have differed across the two seed runs for a reason that had nothing to
do with the backfill's own determinism.

**Fix (commit `a982253bda`):** a fixed-seed `mulberry32` PRNG (`mulberry32(0xf1a3ce5d)`, no OS
entropy, no wall clock — same seed constant, same output sequence on any machine/process) replaces
`Math.random()`; a fixed `SEED_APPROVED_AT = new Date('2026-01-15T00:00:00.000Z')` constant replaces
both `new Date()` calls. The app-generated legacy row **ids** (`pack-1`, `model-7`, ...) were already
deterministic — a plain incrementing counter (`id()`, line 592) — and needed no change.

**Verified:** three independent `seed` invocations (databases A, B, C — §4–§7) produced legacy tables
with **identical row counts and identical md5 digests of every row's business content**, confirmed
before any backfill logic ran (see §4).

---

## 3. Comparator tool, and a bug in the comparator itself caught before trusting any result

Comparing raw table dumps across two runs does **not** work for this schema, for reasons specific to
it (not generic hand-waving):

1. **Every canonical primary key is `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`** —
   `finance_artifacts.artifact_id`, `finance_business_versions.business_version_id`,
   `finance_working_revisions.working_revision_id`, `finance_compute_snapshots.compute_snapshot_id`,
   `finance_lineage_edges.id`, `finance_artifact_aliases.alias_id`,
   `finance_export_manifests.export_manifest_id` (confirmed via `grep gen_random_uuid
   server/migrations/20260809_finance_v3_b0*.sql`) — **never** equal across two independent runs, by
   design. A raw diff would report every single row as "different" even for byte-identical business
   content.
2. Every FK to one of those PKs inherits the same problem
   (`current_business_version_id`, `parent_version_id`, `superseded_by_version_id`, `artifact_id`,
   `business_version_id`, `working_revision_id`, `compute_snapshot_id`, `engine_manifest_id`,
   `source_version_id`/`target_version_id`, `primary_artifact_id`/`primary_business_version_id`).
3. `created_at`/`updated_at`/`approved_at`/`archived_at`/`superseded_at`/`edited_at`/`as_of`/
   `generated_at`/`started_at`/`finished_at`/`duration_ms` are wall-clock (`DEFAULT now()` or
   `Date.now()`) — legitimately different between two runs started at different real-world instants.

**Tool built:** `server/scripts/finance-v3-backfill-determinism-check.ts`. Strategy: resolve every
generated-UUID FK to the **business key** of the row it points to before comparing — the
legacy-derived `natural_key` for artifacts (e.g. `financial_statement_packs:pack-7`, confirmed stable
because it is built from the deterministic legacy id — `naturalKey: \`financial_statement_packs:${pack.id}\`
`, line ~879), `(natural_key, version_no)` for business versions, `(natural_key, revision_seq)` for
working revisions, `engine_name` for engine manifests (the `LEGACY_UNKNOWN` sentinel — its own PK is
also `gen_random_uuid()`-based but there is exactly one row, looked up by name at runtime by
`getLegacyEngineManifestId()`). Every remaining business-meaningful column is compared exactly; a
mismatch reports the precise key and the precise differing field(s), never just "not equal".

**Explicit list of excluded columns and why** (this is the answer to the brief's "wypisz jawnie listę
kolumn wyłączonych, z uzasadnieniem każdej"):

| Column(s) | Table(s) | Why excluded |
|---|---|---|
| Every `*_id` primary key | all canonical tables | `gen_random_uuid()` by definition — no two runs can ever agree on the literal value; the row's *identity* is instead captured by its business key (natural_key / version_no / revision_seq — see above) |
| `current_business_version_id`, `parent_version_id`, `superseded_by_version_id`, `artifact_id`, `business_version_id`, `working_revision_id`, `compute_snapshot_id`, `engine_manifest_id`, `source_version_id`/`target_version_id`, `primary_artifact_id`/`primary_business_version_id` | all canonical tables | FKs to the above — remapped to the referenced row's business key instead of compared raw (an unresolvable FK is rendered as `(unresolved-...)` so a genuinely broken reference is still visible as a mismatch, not silently dropped) |
| `created_at` | legacy tables, `finance_artifacts`, `finance_artifact_aliases`, `finance_lineage_edges`, `finance_compute_snapshots`, `finance_v3_backfill_quarantine_log`, `finance_v3_backfill_excluded_log`, `finance_export_manifests` | `DEFAULT now()` / `DEFAULT CURRENT_TIMESTAMP` — records when *this particular run* touched the row, not a property of the business content |
| `updated_at` | legacy tables, `finance_business_versions` | same as `created_at` — confirmed present on `finance_business_versions` via `\d` (it is easy to miss; the comparator's first draft omitted it and produced a false-positive mismatch — see below) |
| `approved_at`, `archived_at`, `superseded_at`, `submitted_at`, `reopened_at`, `immutable_since` | `finance_business_versions` | set to `NOW()` at the moment the *backfill run itself* writes the row (`createBusinessVersion()`, line 322 `opts.status === 'APPROVED' ? NOW() : null`) — never copied from any legacy timestamp, confirmed by reading the insert |
| `edited_at` | `finance_working_revisions` | `DEFAULT now()` |
| `as_of` | `finance_compute_snapshots`, `finance_export_manifests` | `now()` at write time |
| `generated_at` | `finance_export_manifests` | `now()` at write time |
| `run_batch` | checkpoints/quarantine/excluded logs | an observability label the operator chooses per invocation (`--run-batch NAME`), not part of the backfill's own logic — the WP-C03 report itself documents that resume correctness does not depend on it |
| `started_at`, `finished_at`, `duration_ms` | `finance_v3_backfill_checkpoints` | wall-clock timing, expected to differ between any two runs, including two runs of the *same* input |
| `source_checksum_before`, `source_checksum_after` | `finance_v3_backfill_checkpoints` | `sha256` over the full legacy row **including its own `created_at`/`updated_at`** — so this checksum legitimately differs between two independent `seed` runs even after the §2 fix (the seed rows' business content is identical, but their audit timestamps are not, by design — nothing should compare bit-identical wall-clock stamps across two separate `seed` invocations) |
| `content_semantic_hash`, `file_hash_sha256`, `storage_object_key` | `finance_export_manifests` | **not a legitimate exclusion** — this is finding **F-1**, see §8. Excluded from the pass/fail check only because the *current* implementation makes them non-reproducible by construction (hashed from a random UUID, not from content), not because reproducibility doesn't matter for this column |

**A bug in the comparator itself, caught before trusting any result.** The first version joined key
parts with the empty string (`''`). Artifact key `"org::financial_statement_packs:pack-1"` +
`version_no` `1` renders as `"org::financial_statement_packs:pack-11"` — indistinguishable from a
different, real artifact `"org::financial_statement_packs:pack-11"` (a valid base36 id — the
counter-based `id()` helper produces ids like `pack-1x`, `pack-2v`, well past single digits once
~150+ ids have been allocated across all entity types sharing one counter) with **no** version
suffix. Running the comparator for the first time against two genuinely identical databases (A vs. B,
both freshly seeded + backfilled, §4) produced a wall of "mismatches" in exactly the three tables
whose keys are built by concatenating an artifact key with something else
(`finance_business_versions`, `finance_artifact_aliases`, `finance_export_manifests`) — the volume
and shape of the "mismatches" (hundreds of rows, differing on unrelated-looking fields like
`updated_at`, `alias_id`) did not look like a real backfill bug, it looked like a key-collision
artifact. Two independent things were also wrong at the same time, all caught by the same suspicious
output:

1. The `''`-join key collision above (root cause of the bulk of the false "mismatches").
2. `finance_artifact_aliases`'s primary key column is actually named `alias_id`, not `id` — the
   comparator's exclusion list said `id`, so the real random `alias_id` leaked into the compared
   columns and appeared to differ on every row.
3. `finance_business_versions.updated_at` was not yet in the exclusion list.

All three were fixed in the same pass (the comparator was rewritten cleanly rather than patched, see
file header comment in `finance-v3-backfill-determinism-check.ts` for the in-code record). This is
reported here because "a test that fails when it shouldn't" is exactly as important to catch and
document as "a test that passes when it shouldn't" (the negative control in §5 targets the latter).

---

## 4. Determinism proof: two independent runs, same input, same output

**Setup.** One ephemeral cluster (port `57731`), two databases (`fv3_bf_a`, `fv3_bf_b`). STRICT
migrations (no `--safe`) on both:

```
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:57731/fv3_bf_a \
  npx tsx server/scripts/migrate.postgres.ts   # exit 0, 633 migrations
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:57731/fv3_bf_b \
  npx tsx server/scripts/migrate.postgres.ts   # exit 0, 633 migrations (identical count to A)
```

Independent `seed` on each (post-fix, §2):

```
DATABASE_URL=postgresql://postgres@127.0.0.1:57731/fv3_bf_a tsx server/scripts/finance-v3-backfill-dry-run.ts seed
DATABASE_URL=postgresql://postgres@127.0.0.1:57731/fv3_bf_b tsx server/scripts/finance-v3-backfill-dry-run.ts seed
```

Both printed identical row counts (statements=19 packs/57 statements/432 values/108 versions,
analyses=24, analysis_financials=18, initiative_financials=18, models=24, model_versions=48,
model_events=153, valuations=15, valuation_snapshots=33 — same numbers as the original WP-C03 report
§4). Before running the backfill, `md5(string_agg(row_to_json(x)::text, '|' ORDER BY id))` per legacy
table was compared between A and B directly in SQL — **identical for all 12 legacy tables**
(confirms §2's fix works at the byte level, not just at the row-count level).

Independent `run` on each, same chunk size, no crash:

```
DATABASE_URL=postgresql://postgres@127.0.0.1:57731/fv3_bf_a tsx server/scripts/finance-v3-backfill-dry-run.ts run --chunk-size 20 --run-batch det-run-1
DATABASE_URL=postgresql://postgres@127.0.0.1:57731/fv3_bf_b tsx server/scripts/finance-v3-backfill-dry-run.ts run --chunk-size 20 --run-batch det-run-1
```

Both exit 0, all six phases print.

**Comparison** (`finance-v3-backfill-determinism-check.ts --url-a .../fv3_bf_a --url-b
.../fv3_bf_b`), covering all 22 tables the backfill touches (12 legacy + `finance_artifacts` +
`finance_business_versions` + `finance_artifact_aliases` + `finance_lineage_edges` +
`finance_working_revisions` + `finance_compute_snapshots` + `finance_export_manifests` + the 3
bookkeeping tables):

```
OK   financial_statement_packs: totalA=19 totalB=19 matched=19 onlyInA=0 onlyInB=0 mismatched=0
OK   financial_statements: totalA=57 totalB=57 matched=57 onlyInA=0 onlyInB=0 mismatched=0
OK   financial_statement_values: totalA=432 totalB=432 matched=432 onlyInA=0 onlyInB=0 mismatched=0
OK   financial_statement_versions: totalA=108 totalB=108 matched=108 onlyInA=0 onlyInB=0 mismatched=0
OK   financial_analyses: totalA=24 totalB=24 matched=24 onlyInA=0 onlyInB=0 mismatched=0
OK   analysis_financials: totalA=18 totalB=18 matched=18 onlyInA=0 onlyInB=0 mismatched=0
OK   initiative_financials: totalA=18 totalB=18 matched=18 onlyInA=0 onlyInB=0 mismatched=0
OK   financial_models: totalA=24 totalB=24 matched=24 onlyInA=0 onlyInB=0 mismatched=0
OK   financial_model_versions: totalA=48 totalB=48 matched=48 onlyInA=0 onlyInB=0 mismatched=0
OK   financial_model_events: totalA=153 totalB=153 matched=153 onlyInA=0 onlyInB=0 mismatched=0
OK   valuations: totalA=15 totalB=15 matched=15 onlyInA=0 onlyInB=0 mismatched=0
OK   valuation_snapshots: totalA=33 totalB=33 matched=33 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_artifacts: totalA=105 totalB=105 matched=105 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_business_versions: totalA=165 totalB=165 matched=165 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_artifact_aliases: totalA=765 totalB=765 matched=765 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_lineage_edges: totalA=24 totalB=24 matched=24 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_working_revisions: totalA=48 totalB=48 matched=48 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_compute_snapshots: totalA=48 totalB=48 matched=48 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_export_manifests: totalA=3 totalB=3 matched=3 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_v3_backfill_checkpoints: totalA=36 totalB=36 matched=36 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_v3_backfill_quarantine_log: totalA=171 totalB=171 matched=171 onlyInA=0 onlyInB=0 mismatched=0
OK   finance_v3_backfill_excluded_log: totalA=13 totalB=13 matched=13 onlyInA=0 onlyInB=0 mismatched=0

PASS: DETERMINISM CHECK PASSED - all tables identical (modulo documented variable columns).
```

**Verdict: DETERMINISM PROVEN**, for the operating mode this script actually supports (single
process, single database, no concurrent writer — see §7 for what happens outside that mode). Two
independent runs on two independently-seeded-but-identical fresh databases produce byte-identical
business content in every one of the 22 tables the backfill touches, modulo the explicitly-justified
exclusion list in §3.

---

## 5. Negative control — the comparison can actually detect a difference

Required by the brief, and by this program's own track record of measurements that quietly proved
nothing (see CLAUDE.md's golden rules). Two independent injections into database B, chosen to be
realistic backfill-output corruptions rather than contrived nonsense:

1. `UPDATE finance_business_versions SET freshness_reason = 'INJECTED_TEST_DIFF' WHERE
   business_version_id = <one DRAFT row>` (a `DRAFT`-status row, so the schema's own immutability
   trigger — which correctly rejected the same attempt against a `SUPERSEDED` row, confirming that
   trigger is live and working — did not block it).
2. `INSERT INTO finance_v3_backfill_excluded_log (..., legacy_id='injected-ghost-row', ...)` — one
   extra row with no counterpart in A.

Comparator output:

```
FAIL finance_business_versions: totalA=165 totalB=165 matched=164 onlyInA=0 onlyInB=0 mismatched=1
    MISMATCH key=org-fv3-alpha::financial_statement_packs:pack-1x | 1
      freshness_reason: null != "INJECTED_TEST_DIFF"
...
FAIL finance_v3_backfill_excluded_log: totalA=13 totalB=14 matched=13 onlyInA=0 onlyInB=1 mismatched=0
    only in run1_dbB_INJECTED: financial_statement_packs | injected-ghost-row

FAIL: DETERMINISM CHECK FAILED - see mismatches above.
```

Both injected differences were caught, **and pinpointed exactly** — the precise business key, the
precise field, the precise before/after values — not a generic "databases differ". Both injections
were then reverted (`UPDATE ... SET freshness_reason = NULL`, `DELETE FROM ... WHERE legacy_id =
'injected-ghost-row'`) and the comparator was re-run: **PASS, identical to §4**, confirming the
revert was clean and the tool is not stuck in a false-positive or false-negative state either way.

**Verdict: negative control PASSED.** The comparator used for §4 and §6 is proven capable of
detecting and precisely localizing an injected difference, not just capable of printing "PASS" on
anything handed to it.

---

## 6. Idempotency proof — three states

Distinct property from determinism: does re-running the backfill on a database that **already has**
backfilled data change anything, duplicate anything, or leave the equation broken?

**State 0 (before any backfill on this input).** Verified on a third, freshly-migrated,
freshly-seeded database (`fv3_bf_c` — same cluster, same STRICT migrate, same deterministic `seed`,
independently confirmed to produce the same 12 legacy-table counts as A/B, a third data point for
§4's determinism claim as a side effect):

```
finance_artifacts: 0
finance_business_versions: 0
finance_artifact_aliases: 0
finance_lineage_edges: 0
finance_working_revisions: 0
finance_compute_snapshots: 0
finance_export_manifests: 0
finance_v3_backfill_checkpoints: 0
finance_v3_backfill_quarantine_log: 0
finance_v3_backfill_excluded_log: 0
```

**State 1 (after the first `run`).** Database `fv3_bf_a` after the §4 run (`det-run-1`, no
`--resume`, exit 0). Snapshotted verbatim via `CREATE DATABASE fv3_bf_a_snap1 WITH TEMPLATE
fv3_bf_a` before touching it again, so state 1 is preserved exactly for comparison rather than
inferred.

**State 2 (after a second `run --resume` on the same database).**

```
DATABASE_URL=postgresql://postgres@127.0.0.1:57731/fv3_bf_a tsx server/scripts/finance-v3-backfill-dry-run.ts \
  run --chunk-size 20 --run-batch det-run-2-resume --resume
# exit 0, all six phases print, resume=true
```

**Comparison, state 1 vs. state 2** (same comparator, same exclusion list — the timing columns like
`started_at`/`finished_at`/`duration_ms` are expected to differ even under perfect idempotency, since
this is a genuinely new process invocation; everything else must not):

```
OK   finance_artifacts: totalA=105 totalB=105 matched=105 ...
OK   finance_business_versions: totalA=165 totalB=165 matched=165 ...
OK   finance_artifact_aliases: totalA=765 totalB=765 matched=765 ...
OK   finance_lineage_edges: totalA=24 totalB=24 matched=24 ...
OK   finance_working_revisions: totalA=48 totalB=48 matched=48 ...
OK   finance_compute_snapshots: totalA=48 totalB=48 matched=48 ...
OK   finance_export_manifests: totalA=3 totalB=3 matched=3 ...
OK   finance_v3_backfill_checkpoints: totalA=36 totalB=36 matched=36 ...
OK   finance_v3_backfill_quarantine_log: totalA=171 totalB=171 matched=171 ...
OK   finance_v3_backfill_excluded_log: totalA=13 totalB=13 matched=13 ...

PASS: DETERMINISM CHECK PASSED - all tables identical (modulo documented variable columns).
```

**36/36 checkpoints in both states** — the second run's `--resume` skipped every chunk (all already
`status='done'`), created **zero** new checkpoint rows, **zero** new `finance_artifacts` rows,
**zero** new `finance_business_versions` rows. `verify()` run on state 2 shows the same
"input = migrated + quarantined + excluded" equation holding for all 12 legacy tables, "Duplicate
alias rows (should be 0): 0".

**Refuse-without-`--resume` safety net**, checked separately on the still-single-run database
`fv3_bf_b`:

```
DATABASE_URL=postgresql://postgres@127.0.0.1:57731/fv3_bf_b tsx server/scripts/finance-v3-backfill-dry-run.ts \
  run --chunk-size 20 --run-batch det-run-no-resume-test
# exit 1
# Error: Checkpoint already exists for statements/financial_statement_packs/org-fv3-alpha#0
#   but --resume was not passed. Refusing to silently continue a prior run.
```

**Verdict: IDEMPOTENCY PROVEN**, three states measured, zero duplication, zero drift, and the
explicit safety net (refuse to silently continue without `--resume`) reproduced live, not just
read in the source.

---

## 7. Concurrency — tested, and found genuinely unsafe (this is the most important finding)

The brief asked to test concurrency "if the backfill can be run that way". Nothing in the code
prevents it — there is no `pg_advisory_lock`, no `SELECT ... FOR UPDATE`, no single-instance guard
anywhere in `main()`/`runBackfill()`. So it was tested directly: two `run` processes launched at the
same wall-clock instant against the same freshly-seeded, not-yet-backfilled database (`fv3_bf_c`,
state 0 from §6), neither with `--resume` (both starting from a truly empty checkpoint table, the
realistic "operator accidentally double-launched the job" scenario):

```
( DATABASE_URL=.../fv3_bf_c tsx .../finance-v3-backfill-dry-run.ts run --chunk-size 20 --run-batch concurrent-p1 ) &
( DATABASE_URL=.../fv3_bf_c tsx .../finance-v3-backfill-dry-run.ts run --chunk-size 20 --run-batch concurrent-p2 ) &
wait
```

**Result:** process P1 completed successfully, exit 0, all six phases, 36/36 checkpoints. Process P2
**crashed**, exit 1:

```
error: duplicate key value violates unique constraint "uq_finance_bv_artifact_version"
  at async createBusinessVersion (finance-v3-backfill-dry-run.ts:302)
  ...
detail: 'Key (artifact_id, version_no)=(cb527501-d844-4e0a-9fd5-f5ddc008f2c8, 1) already exists.'
```

**Root cause.** `getOrCreateArtifact()` (line 235) is a classic check-then-act race: `SELECT
artifact_id FROM finance_artifacts WHERE organization_id = $1 AND natural_key = $2` followed by
`INSERT ... RETURNING artifact_id` if nothing was found — two statements, not one atomic
`INSERT ... ON CONFLICT`. Under Postgres's default `READ COMMITTED` isolation, if P2's `SELECT` runs
against a snapshot taken *after* P1 has already committed the same natural key's artifact row (but
before P2 reaches its own `createBusinessVersion` call), P2 correctly reuses P1's `artifact_id` — but
then unconditionally attempts `INSERT INTO finance_business_versions (..., version_no, ...) VALUES
(..., 1, ...)` for that artifact without checking whether version 1 already exists, because
`createBusinessVersion()` (line 281) was written assuming it is the only writer. The database's own
`UNIQUE (artifact_id, version_no)` constraint (`uq_finance_bv_artifact_version`, from the WP-C01
migration) is what actually caught this — not anything in the backfill's own logic.

**Was the resulting database corrupted?** No — checked directly:

```sql
SELECT organization_id, natural_key, count(*) FROM finance_artifacts
GROUP BY organization_id, natural_key HAVING count(*) > 1;
-- 0 rows
```

P2's failing chunk was inside a `BEGIN`/`COMMIT` transaction (`runChunked()`, line 421) that rolled
back atomically on the error, so none of P2's writes for that chunk persisted. `verify()` against the
post-race database shows the same clean equation as every other run in this report (input = migrated
+ quarantined + excluded for all 12 tables, 0 duplicate aliases) — because in this specific
interleaving, only P1's work survived intact.

**Why this is still a real defect, not "handled gracefully".** The fact that this particular race
happened to hit a DB-level `UNIQUE` constraint and fail loudly is a lucky consequence of *this*
constraint existing (`uq_finance_bv_artifact_version`, on `finance_business_versions`) — it is not
evidence that concurrent execution is safe in general. `finance_artifacts.natural_key` has **no**
uniqueness constraint at the database level at all (`grep natural_key server/migrations/*.sql` shows
only the column definition, no `UNIQUE`/`CONSTRAINT` on it) — confirmed by direct inspection of
`20260809_finance_v3_b01_core_artifacts.sql`. Under a different timing (both processes' `SELECT`s in
`getOrCreateArtifact()` running before *either* has committed its `INSERT`), the same race would
silently create **two different `finance_artifacts` rows with the same `(organization_id,
natural_key)`** — nothing in the schema would catch it, and nothing in the application code checks
for it after the fact. This specific silent-duplication outcome was **not reproduced** in this
session's single test run (the timing happened to go the other way) — it is a latent risk inferred
from reading the code and the schema, not an empirically observed failure, and is reported as such.

**Classification.**
- **F-2a (observed, reproduced):** two concurrent `run` invocations against the same database are
  unsafe — no locking mechanism exists, and one process crashes with a hard Postgres error if the
  race is lost. Severity **P1** as an *operational* risk (an accidental double-launch, e.g. two
  people or two cron triggers, wastes a run and requires manual cleanup investigation, even though in
  the reproduced case the failure was fail-closed rather than silently wrong).
- **F-2b (inferred, not reproduced):** `finance_artifacts.natural_key` has no DB-level uniqueness
  constraint, so a different concurrent-timing outcome than the one observed could silently create
  duplicate artifact identities for the same legacy entity, uncaught by any constraint or
  application check. Severity **P2** (latent, not observed; would need either a different race
  window or repeated runs to trigger empirically — flagging honestly as inferred-not-proven per the
  brief's instruction not to round up).

**Recommended fix (not implemented — not local/obvious, needs a design decision the script's owner
should make, per this task's scope rule):**
1. Acquire a single `pg_advisory_lock` (a fixed, well-known key) at the very start of `run`/`seed`,
   released on exit; a second concurrent invocation should either block or refuse immediately with a
   clear message, never interleave.
2. Add `CREATE UNIQUE INDEX ... ON finance_artifacts (organization_id, natural_key) WHERE natural_key
   IS NOT NULL` as defense-in-depth even with the lock in place — the same fix pattern the schema
   already uses successfully for `finance_business_versions` (`uq_finance_bv_artifact_version`,
   which is exactly what turned this session's race into a loud, safe failure instead of a silent
   one).

**Verdict: CONCURRENCY IS NOT SAFE, proven.** This does not block the FC-02.2 claim as literally
worded (see §10 — the script was never designed or documented as safe for concurrent execution, and
its only real caller today is a single human operator running one shell command at a time), but it is
a real defect that must be fixed before this script — or any productionized descendant of it — is
ever wired into an orchestrator, retry policy, or anything else that could plausibly launch it twice.

---

## 8. Other findings

**F-1: `finance_export_manifests` content-hash columns are not reproducible by construction, which
defeats their own stated purpose.** `content_semantic_hash`, `file_hash_sha256`, and
`storage_object_key` are computed at `server/scripts/finance-v3-backfill-dry-run.ts:1707`:

```ts
const hash = sha256({ t: 'export', org, bv: approved.currentBusinessVersionId });
```

`approved.currentBusinessVersionId` is a random `gen_random_uuid()` value — so this "content
semantic hash" is actually a hash of a random UUID, not of any business content. Confirmed
empirically in §4: these three columns differed between run A and run B even though every other
column on the same rows, and every upstream business-content column feeding the export, was
byte-identical. The table this belongs to comes from migration
`20260809_finance_v3_b06_reproducibility_retention_export.sql` — its own name and WP-B01/B06 intent
is specifically about reproducibility. As currently written, regenerating an export for the exact
same, unchanged business version produces a **different** `content_semantic_hash` every time,
because the source of the hash isn't the content. This is separate from FC-02.2 (which is about the
legacy→canonical migration, not about export-content hashing) but is flagged for whoever owns Gate D
/ WP-B06, since the report explicitly says "Gate D domain-content tables don't exist yet" — this is
the concrete gap that statement points at. Severity **P2** (no current caller depends on export-hash
reproducibility; becomes load-bearing once Gate D content exists). Not fixed here — out of this
task's scope (backfill determinism, not export-manifest design) and not a "local, obvious" fix (the
real fix requires deciding what "content" means for an export before this table has real content to
hash).

**Comparator self-bug** — see §3. Reported as a finding about methodology, not about the backfill:
the first version of the comparator produced false-positive "determinism failures" from its own key
collision. It was caught by the mismatch output *not looking like a real defect* (hundreds of rows,
implausible field patterns) before being mistaken for one, fixed, and re-verified against the same
two databases before any of §4–§7's numbers were trusted.

---

## 9. Acceptance thresholds

| Check | Result |
|---|---|
| STRICT migrations, fresh DB A | exit 0, 633 migrations |
| STRICT migrations, fresh DB B | exit 0, 633 migrations |
| STRICT migrations, fresh DB C | exit 0, 633 migrations |
| `finance/canonical` vitest suite | 31/31 files, 421/421 tests, exit 0 (run against DB A post-backfill; no regression vs. the orchestrator's own baseline of 31/31, 421/421) |
| `tsc -p server` | exit 0 |
| Determinism (two independent runs, same input) | **PROVEN** (§4) |
| Idempotency (three states) | **PROVEN** (§6) |
| Negative control (comparator can detect an injected diff) | **PASSED** (§5) |
| Concurrency | **PROVEN UNSAFE** (§7) — real finding, not a pass |

Cluster and all three databases (`fv3_bf_a`, `fv3_bf_b`, `fv3_bf_c`) torn down (`pg_ctl stop -m fast`
+ `rm -rf "$PGDATA" "$PGSOCK"`) at the end of this session. No shared/demo/production database was
touched at any point.

---

## 10. Recommendation for FC-02.2

**Upgrade from `PARTIAL` to `PASS`, with an explicit, written scope boundary — not an unconditional
"deterministic".**

What is now proven, with reproducible evidence and a negative control on the proof method itself:
- Two independent runs of the backfill on identical input produce byte-identical business content in
  every one of the 22 tables it touches (§4).
- Re-running the backfill on already-backfilled data is idempotent: zero duplication, zero drift,
  three states measured (§6).
- The backfill's own "refuse to silently continue without `--resume`" safety net works as documented
  (§6).

What is explicitly **not** covered by this "PASS", and should be written into the gate condition's
scope rather than silently assumed:
- **Single-writer only.** The backfill has never been designed, documented, or (until this session)
  tested for concurrent execution, and this session found it is **not safe** under concurrency (§7,
  F-2a/F-2b). If FC-02.2's intent includes "safe to run from an orchestrator with retries", it is
  **not** met — recommend either narrowing the gate's wording to "deterministic and idempotent under
  single-writer execution" (which matches how this script has always been used and is documented to
  be used) or opening a follow-up defect for the locking fix in §7 before any orchestrator wiring.
- `finance_export_manifests`' content-hash columns are not reproducible (F-1, §8) — out of FC-02.2's
  literal scope (that gate is about the legacy→canonical migration mechanism, not export-content
  hashing) but worth a cross-reference for whoever tracks Gate D / WP-B06.

No `EVIDENCE_MISSING` on the four items this task was asked to prove — determinism, idempotency, and
the negative control on the comparison method are all backed by real command output above;
concurrency was tested (not skipped) and the honest result is "unsafe", which per this task's own
brief counts as the valuable outcome, not a shortfall.

---

## 11. Commands to reproduce

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-bf-pgdata ; PGSOCK=/tmp/fv3bfsock ; PORT=57731
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3bf_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_bf_a;"
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_bf_b;"

for db in fv3_bf_a fv3_bf_b; do
  RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
    DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$db" \
    npx tsx server/scripts/migrate.postgres.ts
  DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$db" \
    npx tsx server/scripts/finance-v3-backfill-dry-run.ts seed
  DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$db" \
    npx tsx server/scripts/finance-v3-backfill-dry-run.ts run --chunk-size 20 --run-batch det-run-1
done

npx tsx server/scripts/finance-v3-backfill-determinism-check.ts \
  --url-a "postgresql://postgres@127.0.0.1:$PORT/fv3_bf_a" \
  --url-b "postgresql://postgres@127.0.0.1:$PORT/fv3_bf_b"

# idempotency: snapshot A, run --resume again, diff snapshot vs A
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_bf_a_snap1 WITH TEMPLATE fv3_bf_a;"
DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/fv3_bf_a" \
  npx tsx server/scripts/finance-v3-backfill-dry-run.ts run --chunk-size 20 --run-batch det-run-2 --resume
npx tsx server/scripts/finance-v3-backfill-determinism-check.ts \
  --url-a "postgresql://postgres@127.0.0.1:$PORT/fv3_bf_a_snap1" \
  --url-b "postgresql://postgres@127.0.0.1:$PORT/fv3_bf_a"

$PGBIN/pg_ctl -D "$PGDATA" stop -m fast
rm -rf "$PGDATA" "$PGSOCK"
```
