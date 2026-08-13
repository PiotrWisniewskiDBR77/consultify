# WP-C03 — Deterministic legacy→canonical backfill: dry-run report (Gate C)

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`, Gate C / WP-C03 "Deterministic backfill"
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Input:** WP-A01 inventory manifest (`docs/validation/finance-v3/generated/gate-a/WP-A01_inventory_manifest.json`), WP-A03 legacy classification, `ORCHESTRATOR_DECISIONS_LOG.md` (ORCH-DEC-001/002), the 7 WP-C01 additive migrations (`server/migrations/20260809_finance_v3_b0*.sql`).
**Deliverable:** `server/scripts/finance-v3-backfill-dry-run.ts` (this report documents its validation).

---

## 1. Database isolation

Same hard rule as WP-C01 (real prior incident — see `WP-A04_security_closure.md`): never touch the
shared Homebrew instance.

- **Own ephemeral cluster:** `initdb --locale=C` (required — a plain `initdb` without `LC_ALL=C`
  crashes on this machine with `postmaster became multithreaded during startup`, a known local
  locale issue; `LC_ALL=C` was exported for every `initdb`/`pg_ctl`/`tsx` invocation in this session),
  data directory `/private/tmp/finance-v3-c03-pgdata-<random>`, own port `57891` (55000–59999 range,
  verified free with `lsof -iTCP -sTCP:LISTEN` before use), `listen_addresses=127.0.0.1`, own Unix
  socket inside the ephemeral data directory.
- **Verified isolation during the session:** `ps aux` showed two fully separate `postgres`
  processes throughout — PID 911 on `-D /opt/homebrew/var/postgresql@15` (shared instance,
  untouched) and this work package's own PID on `-D /private/tmp/finance-v3-c03-pgdata-... -p 57891`.
- **`NODE_ENV=test`** set only to satisfy the repo's own `assertNoPrivateRailwayDbHostOutsideRailway`
  guard when pointing the migration runner at a loopback host, per the same convention as WP-C01.
- **Teardown:** `pg_ctl stop -m fast` + `rm -rf` of the data directory, executed at the end of this
  work package. `ps aux` confirmed no process left running for this cluster; only PID 911 (shared,
  untouched) remained.
- **Synthetic data only.** `finance-v3-backfill-dry-run.ts seed` generates ~1,000 rows across 3
  synthetic organizations (`org-fv3-alpha/beta/gamma`) modeled on the real legacy schema — no
  production or demo data was read or copied.

## 2. A load-bearing discovery before any backfill logic could be written

Per CLAUDE.md's golden rule ("verify real runtime, not docs/flags"), the brief's own list of legacy
tables to seed (`financial_models, financial_model_events, financial_model_versions,
financial_analyses, analysis_financials, initiative_financials`) was checked against what the
project's own canonical migration runner (`server/scripts/migrate.postgres.ts`) actually produces on
a **fresh** Postgres database, not what the migration files claim to produce.

**Finding: `analysis_financials` and `initiative_financials` do not exist at all after a full,
successful 586-migration replay on a fresh Postgres database.**

- Their producing migrations (`067_economics_initiative_integration.sql`,
  `068_economics_analysis_financials.sql`) are 3-digit, pre-`500` numbered files.
- `migrate.postgres.ts`'s own `isSqliteOnlyMigration()` filter treats every numbered migration with
  version `< 500` (other than `000_z_core_baseline.sql` itself) as "older pre-baseline fragment,
  often SQLite-first" and **skips it entirely** on a Postgres run — confirmed empirically: after a
  full `✅ Postgres migrations complete` run (586/586, 0 errors), `schema_migrations` contains no row
  for `067_...`/`068_...`, and `\d analysis_financials` reports the relation does not exist.
- Directly running `068_economics_analysis_financials.sql` against real Postgres via `psql -f`
  confirms *why* it's excluded: `ERROR: type "datetime" does not exist` — the file uses SQLite's
  `DATETIME` column type, which has no Postgres equivalent, and `migrate.postgres.ts` explicitly does
  not do SQLite→Postgres dialect translation (unlike the separate `migrate.ts` runner).
- `digitization_analyses` (needed as a legacy FK target for `analysis_financials`) is similarly not
  produced by its own original migration (`060_digitization_analyses.sql`, also `<500` and skipped);
  the table that actually exists on a fresh DB comes from a later, dated "ensure" migration
  (`20260628_ensure_digitization_analyses.sql`) with `organization_id TEXT` and **no FK** — a
  different, already-repaired shape than the original file.

**Consequence for this dry run:** `analysis_financials`/`initiative_financials` were recreated in the
seed script with the *same shape*, `TIMESTAMP` instead of `DATETIME`, so WP-A01's `QUARANTINE`
classification for them could be exercised at all. **This is a real, separate finding for
WP-C03 productionization, not a seed-script shortcut:** if the real demo/prod database currently has
data in these two tables, that data was written through a *different* migration mechanism than the
one this program's own additive migrations (WP-C01) were validated against (matches the "CZTERY
mechanizmy migracji" pattern already on record for this repo). Before a real backfill run, WP-C03
must confirm — against the actual target database's `information_schema`, not against
`migrate.postgres.ts`'s fresh-DB behavior — whether these two tables exist there, and if so, in what
shape.

A second, smaller staleness finding surfaced while seeding duplicate-version test data:
**`financial_model_versions` now has `UNIQUE(model_id, version)`** (constraint
`uq_fmver_model_version`, added later by `20260801_fin003_004_case_scenario_baseline.sql`) — the DB
physically rejected a duplicate-version `INSERT` during seed authoring. WP-A01's "no
`UNIQUE(model_id, version)`" finding is therefore **stale for this specific table**; the same gap is
confirmed still present for `valuation_snapshots` (only a `PRIMARY KEY` + FK, no uniqueness
constraint — verified via `pg_constraint`). The backfill's `DUPLICATE_VERSION_NUMBER` quarantine path
is kept for both tables (defensive handling of any pre-constraint historical rows), but only
`valuation_snapshots` reproduces the scenario on this schema version — documented inline in the seed
script and in §5 below.

## 3. What the script does

`server/scripts/finance-v3-backfill-dry-run.ts`, three subcommands:

```
DATABASE_URL=postgresql://... tsx server/scripts/finance-v3-backfill-dry-run.ts seed
DATABASE_URL=postgresql://... tsx server/scripts/finance-v3-backfill-dry-run.ts run [--resume] [--crash-after N] [--chunk-size N] [--run-batch NAME]
DATABASE_URL=postgresql://... tsx server/scripts/finance-v3-backfill-dry-run.ts verify
```

**Order** (per the brief): Statements → Analysis → Models (Baseline) → Prediction
(candidates/events, ORCH-DEC-001) → Valuation → Exports.

**Chunking.** Per `(legacy_table, organization_id)`, ordered by legacy PK, fixed chunk size
(20 in all runs below). One chunk = one Postgres transaction: read source rows, classify+write
canonical/quarantine/excluded, write one `finance_v3_backfill_checkpoints` row with `status='done'`,
`COMMIT`. A chunk is therefore either fully applied or (from the DB's point of view) never started.

**Resume token.** The `finance_v3_backfill_checkpoints` table itself, keyed by
`(phase, legacy_table, organization_id, chunk_index)`. `run --resume` skips any chunk whose
checkpoint already has `status='done'`; `run` without `--resume` on a database with existing
checkpoints refuses to proceed ("Refusing to silently continue a prior run") rather than silently
resuming — an explicit flag is required. Because commit-of-checkpoint and commit-of-canonical-writes
happen in the *same* transaction, there is no "checkpoint says pending but writes already landed"
state to reconcile.

**Checksums.** Before *and* after processing a chunk, the exact same source rows are re-read and
hashed (`sha256` over a deterministic, key-sorted JSON serialization). The two hashes are asserted
equal inside the transaction and stored on the checkpoint row — proving per-chunk that the backfill
never mutates legacy tables, not just a resume-safety property.

**Quarantine.** Table-level classification (`AUTO_MIGRATE`/`MIGRATE_WITH_WARNING`/`QUARANTINE`/
`EXCLUDE_WITH_REASON`) is loaded **at runtime from the real WP-A01 manifest JSON**
(`loadClassification()` reads `WP-A01_inventory_manifest.json` directly — not re-hardcoded/duplicated
in the script), plus row-level rules documented inline in the code:

| Reason code | Table | Trigger |
|---|---|---|
| `APPROVED_WITHOUT_SNAPSHOT` | `financial_models` | `status='approved'` with `approved_snapshot IS NULL` (the exact Gate A finding) |
| `DUPLICATE_VERSION_NUMBER` | `financial_model_versions`, `valuation_snapshots` | >1 row sharing `(parent_id, version)` |
| `EVENT_ONLY_BASELINE_ARCHITECTURE` | `financial_model_events` | non-decisional event types (revenue/cogs/opex/capex/depreciation/interest/tax/wc — WP-A03's "event-only baseline is the current architecture" finding) |
| `AMBIGUOUS_DECISION_EVENT_ZERO_AMOUNT` | `financial_model_events` | decisional event with `amount = 0` |
| `AMBIGUOUS_DECISION_EVENT_DUPLICATE` | `financial_model_events` | decisional events sharing `(model_id, event_type, period_start, amount)` |
| `LEGACY_PARALLEL_STORE_UNRECONCILED` | `analysis_financials`, `initiative_financials` | whole-table QUARANTINE per WP-A01 + ORCH-DEC-002 (adapter-only, outside the canonical DAG's 6 `artifact_type` values) |
| `CROSS_ORG_STATEMENT_PACK_MISMATCH` | `financial_statements` | statement's own `organization_id` disagrees with its parent pack's org (WP-A03's flagged tenant-scoping risk on this table) |
| `ORPHAN_STATEMENT_NO_PACK` | `financial_statements` | `statement_pack_id IS NULL` |
| `PARENT_STATEMENT_QUARANTINED` | `financial_statement_values`, `financial_statement_versions` | cascade — children of a quarantined statement |
| `ORPHANED_ORG_REFERENCE` (→ **excluded**, not quarantined) | `financial_statement_packs`, `analysis_financials`, `initiative_financials` | `organization_id` does not correspond to any row in `organizations` — the only cases in the inventory where the DB schema itself doesn't enforce an FK, so a genuinely orphaned tenant reference is structurally possible |

Quarantined/excluded rows never produce a `finance_business_versions` row. Two different ledgers are
used depending on whether a valid, same-org parent `finance_artifacts` identity exists:
`finance_artifact_aliases` (the real WP-B01/WP-C01 legacy-bridge table, `mapping_confidence='QUARANTINE'`,
`business_version_id=NULL`) when one does (e.g. an approved-without-snapshot model still has a valid
Baseline Model identity), or the script's own `finance_v3_backfill_quarantine_log` /
`finance_v3_backfill_excluded_log` (dry-run infra, not a shipped migration) when no appropriate
canonical `artifact_type` exists to attach to (e.g. `analysis_financials`, which ORCH-DEC-002 places
outside the 6-value DAG entirely) or the parent's own org is inconsistent/orphaned.

**ORCH-DEC-001.** Unambiguous decisional `financial_model_events`
(`debt_drawdown`/`debt_repayment`/`equity_injection`/`dividend`) are grouped per source Baseline
Model and migrated into one new `PREDICTION_SCENARIO` artifact + `APPROVED`
`finance_business_version` (with a real `finance_working_revisions` → `finance_compute_snapshots`
chain against the `LEGACY_UNKNOWN` engine manifest, satisfying the B01 immutability trigger's
"cannot APPROVE without `compute_snapshot_id`" rule), one `finance_artifact_aliases` row per migrated
event tagged `mapping_reason` = `ORCH-DEC-001;source=migrated_legacy_event;event_type=...`, and a
`finance_lineage_edges` row (`MODEL_TO_SCENARIO`, `MANUAL_LINK`) from the source Baseline Model's
current version. Ambiguous events are quarantined, never silently dropped or silently migrated.

**Models/Valuation version chains.** Each legacy row's full version history
(`financial_model_versions`/`valuation_snapshots`, deduplicated by dropping any duplicate-version
group into quarantine) is replayed as a chain of `finance_business_versions`: older versions are
inserted `DRAFT` then immediately flipped to `SUPERSEDED` (via `parent_version_id`/
`superseded_by_version_id`), the latest gets its real target status (`APPROVED` requiring a compute
chain, `ARCHIVED`, `IN_REVIEW`, or `DRAFT`). This directly exercises the Gate A "reopen mutates
Approved in place" fix from WP-C01 (§5 test 4) against real backfilled data, not just synthetic
fixtures.

## 4. Equation results (`input = migrated + quarantined + excluded`)

Final validated run (`run_batch=clean-final`, chunk size 20, no crash):

| Legacy table | Total | Migrated | Quarantined | Excluded | Sum | OK |
|---|--:|--:|--:|--:|--:|:--:|
| `financial_statement_packs` | 19 | 18 | 0 | 1 | 19 | ✅ |
| `financial_statements` | 57 | 51 | 6 | 0 | 57 | ✅ |
| `financial_statement_values` | 432 | 408 | 24 | 0 | 432 | ✅ |
| `financial_statement_versions` | 108 | 102 | 6 | 0 | 108 | ✅ |
| `financial_analyses` | 24 | 24 | 0 | 0 | 24 | ✅ |
| `analysis_financials` | 18 | 0 | 12 | 6 | 18 | ✅ |
| `initiative_financials` | 18 | 0 | 12 | 6 | 18 | ✅ |
| `financial_models` | 24 | 24 | 0 | 0 | 24 | ✅ |
| `financial_model_versions` | 48 | 48 | 0 | 0 | 48 | ✅ |
| `financial_model_events` | 153 | 48 | 105 | 0 | 153 | ✅ |
| `valuations` | 15 | 15 | 0 | 0 | 15 | ✅ |
| `valuation_snapshots` | 33 | 27 | 6 | 0 | 33 | ✅ |

**Equation holds for all 12 source tables, both in a clean uninterrupted run and in the
crash-then-resume run (§6) — identical numbers in both.** Zero duplicate rows in
`finance_artifact_aliases` (checked via `GROUP BY ... HAVING count(*) > 1`, both as a query and
implicitly by the table's own `UNIQUE(legacy_table, legacy_id, legacy_version)` constraint). Zero
chunks where the before/after source checksum differed.

Resulting canonical rows: 105 `finance_artifacts` (18 `STATEMENT_PACK`, 24 `HISTORICAL_ANALYSIS`, 24
`BASELINE_MODEL`, 24 `PREDICTION_SCENARIO`, 15 `VALUATION_CASE`), 165 `finance_business_versions` (48
`APPROVED`, 60 `SUPERSEDED`, 24 `DRAFT`, 21 `IN_REVIEW`, 9 `ARCHIVED`, 3 `INVALIDATED`), 24
`finance_lineage_edges` (`MODEL_TO_SCENARIO`, one per model with ≥1 unambiguous decisional event), 3
`finance_export_manifests` (`READY`, one per org with an approved downstream Valuation — the terminal
Exports phase).

## 5. Two bugs the equation check itself caught (both fixed, both re-verified)

The equation check is not decorative — it caught two real defects in the backfill script during
validation, both against the running ephemeral database, not by inspection:

1. **Missing attribution for the top-level `valuations`/`financial_models` row.** The first version
   of the version-chain logic credited a version-slot's alias to `valuation_snapshots` whenever *any*
   history row existed for that version number, including the "current" slot — so when a legacy
   row's live `version` number happened to coincide with one of its own snapshot rows (true for every
   synthetic `valuations` row, since `version` was seeded as a fixed `2` and snapshots always include
   version 2), the `valuations` table itself never got a single alias, `migrated=0` against
   `total=15` even though the artifacts were created correctly. Fixed by always crediting the
   top-level row's own alias on the current version-slot, in addition to (not instead of) any history
   row's own alias — these are two distinct legacy tables with two distinct row counts, both must be
   independently accounted for.
2. **Chunk-scoped duplicate-event detection missing cross-chunk duplicates.** The original
   `AMBIGUOUS_DECISION_EVENT_DUPLICATE` check grouped events by model *within the current chunk only*.
   Two exact-duplicate `debt_repayment` events for the same synthetic model landed in two different
   chunks (their legacy PKs straddled the chunk-size-20 boundary), so the duplicate was silently
   missed — `financial_model_events` still balanced (105+48=153) but 6 events were migrated as
   "unambiguous" when they should have been quarantined. Fixed by precomputing the
   `(model_id, event_type, period_start, amount) → count` map for the **entire organization** before
   chunking begins (one query, outside the per-chunk transaction), so classification is identical
   regardless of chunk boundaries or whether the run is fresh or resumed. Re-verified: quarantine
   breakdown for `financial_model_events` is now `EVENT_ONLY_BASELINE_ARCHITECTURE=96` +
   `AMBIGUOUS_DECISION_EVENT_DUPLICATE=6` + `AMBIGUOUS_DECISION_EVENT_ZERO_AMOUNT=3` = 105, migrated=48,
   total=153.

Also fixed along the way (not caught by a failing run, but by dry-run design): the cross-org-mismatch
statement's *children* (`financial_statement_values`/`financial_statement_versions`) were originally
silently un-accounted-for once their parent statement was quarantined — fixed by cascading the
quarantine to children with reason `PARENT_STATEMENT_QUARANTINED`, which is what makes rows 2/3 of
the table above balance.

## 6. Resume-after-crash test

Two independent crash/resume cycles were run (interrupting at different points — mid-`Analysis`
phase and again mid-`Analysis`/entering `Models`), both on a freshly seeded database, both producing
results **identical** to the uninterrupted run in §4:

```
run --chunk-size 20 --run-batch final-crash-test --crash-after 18
  → committed 18 chunks, then: "💥 Simulated crash requested: exiting after committing chunk
     analysis/initiative_financials/__ghost__#0"
run --chunk-size 20 --run-batch final-crash-test --resume
  → phases 1–6 all print, all 36 chunks now done
verify
  → equation holds for all 12 tables (identical table to §4), 0 duplicate aliases, 0 checksum
    mismatches, 36/36 chunks done
```

The checkpoint timeline for that run shows a real process boundary, not a no-op:

```
n=18  analysis/initiative_financials/__ghost__      finished 19:13:31.486  (pre-crash)
n=19  models/financial_models/org-fv3-alpha          finished 19:13:31.864  (post-resume — new process)
```

(The ~378 ms gap is process restart overhead — Node startup, pool connect, classification-manifest
reload — not a stall; this is a brand-new `tsx` invocation, verified by the CLI printing
`resume=true` and the run picking up mid-Analysis where the previous process left off.)

**Idempotent double-resume** was also verified: running `run --resume` a *third* time (with yet
another `--run-batch` label, against an already-fully-migrated database) completes instantly with
zero new chunks processed and the equation/duplicate/checksum checks unchanged — checkpoints are
keyed by `(phase, legacy_table, organization_id, chunk_index)`, not by `run_batch` (`run_batch` is
purely an observability label), so a later run always correctly recognizes prior work regardless of
what batch name it's invoked with.

**Refuse-without-`--resume` safety net** was verified separately: `run` (no `--resume` flag) against
an already-migrated database fails fast on the very first chunk with `"Checkpoint already exists for
statements/financial_statement_packs/org-fv3-alpha#0 but --resume was not passed. Refusing to
silently continue a prior run."` rather than silently no-op-ing or silently reprocessing.

## 7. Timing per chunk/phase

From the `clean-final` run (chunk size 20, 3 synthetic orgs + 1 ghost-org bucket, ~1,000 source rows,
~2,500 canonical writes total):

| Phase | Chunks | Total ms | Avg ms/chunk | Max ms/chunk |
|---|--:|--:|--:|--:|
| `statements` | 7 | 110 | 16 | 57 |
| `analysis` | 11 | 20 | 2 | 5 |
| `models` | 3 | 36 | 12 | 13 |
| `prediction` | 9 | 38 | 4 | 7 |
| `valuation` | 3 | 16 | 5 | 6 |
| `exports` | 3 | 2 | 1 | 2 |

No chunk exceeded 60 ms. `statements` is the slowest phase per-chunk (cascading three levels of
children — statements → values → versions — inside one transaction), which is the expected shape for
a real-scale run: at production volume this phase's chunk size would need tuning down from 20 packs
(each pack fans out to ~24 grandchildren here) to keep per-chunk lock/transaction duration bounded,
not left at this dry run's default.

## 8. Known simplifications (explicit, not silent)

1. **Lineage edges are demonstrative, not a full DAG backfill.** Only `MODEL_TO_SCENARIO` (for
   ORCH-DEC-001) and `MODEL_TO_VALUATION` (when `valuations.source_type='financial_model'` resolves
   to a migrated model) are created. `STATEMENT_TO_ANALYSIS`/`STATEMENT_TO_MODEL`/
   `ANALYSIS_TO_MODEL`/`SCENARIO_TO_VALUATION` are in scope for a full WP-B03 lineage backfill but out
   of scope for this dry run's core ask (chunking/resume/checksums/quarantine/ORCH-DEC-001).
2. **Gate D domain-content tables don't exist yet.** This backfill populates the identity/lifecycle
   layer (`finance_artifacts`/`finance_business_versions`/`finance_artifact_aliases`/
   `finance_lineage_edges`) — there is nowhere yet to write the actual statement-line/model-schedule/
   scenario-cell values (that's Gate D). The full source content for every migrated row remains
   recoverable via `finance_artifact_aliases.mapping_reason` and the `(legacy_table, legacy_id)`
   pointer back to the legacy row, which is exactly what that column is designed for per WP-B01 §2.6.
3. **Per-chunk `migrated`/`quarantined`/`excluded` counters stored on `finance_v3_backfill_checkpoints`
   are informational only**, not the equation's source of truth — they don't sum to the chunk's row
   count for the Models/Valuation phases (one legacy row fans out to N version-slot outcomes). The
   authoritative equation is computed by `verify` against ground truth in
   `finance_artifact_aliases`/the quarantine/excluded logs, grouped by `legacy_table` — the correct
   accounting unit, matching how WP-A01/WP-B01 define it.
4. **Statements phase chunks by top-level pack, cascading children in the same transaction** rather
   than chunking `financial_statements`/`financial_statement_values`/`financial_statement_versions`
   as independent streams — each pack's fan-out is small and bounded (~24 grandchildren in this
   synthetic dataset), which keeps chunk transactions short, but a real backfill with large packs
   would need this reconsidered (see §7).

## 9. Summary

- Dry run passed cleanly on an isolated, throwaway Postgres cluster; shared instance never touched;
  cluster torn down (`pg_ctl stop` + `rm -rf`) at the end.
- **`input = migrated + quarantined + excluded` confirmed for all 12 legacy tables**, in both a clean
  run and a crash-interrupted-then-resumed run, with identical results.
- **Resume-after-interruption confirmed working**: crash mid-run → resume → identical final state,
  zero duplicate `finance_artifact_aliases` rows, zero checksum mismatches; double-resume and
  refuse-without-`--resume` safety nets also verified.
- **Checksums confirmed**: before/after source-row hashes identical for all 36 chunks in every run —
  the backfill never mutates legacy tables.
- Two real bugs were found and fixed via this validation process itself (top-level-row attribution
  gap on `valuations`/`financial_models`; cross-chunk duplicate-event detection gap on
  `financial_model_events`) — both are documented in §5 with before/after numbers, not silently
  patched.
- One load-bearing pre-existing-schema finding (§2): `analysis_financials`/`initiative_financials`
  are not producible by the project's own canonical Postgres migration runner on a fresh database
  (SQLite `DATETIME` type, filtered out by `isSqliteOnlyMigration()`) — a real WP-C03
  productionization blocker/question to resolve against the actual target database before any live
  backfill, not a dry-run artifact.
