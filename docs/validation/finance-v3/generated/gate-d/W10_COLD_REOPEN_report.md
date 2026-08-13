# W10 — Cold reopen proof (FC-05.8 · FC-07.9 · FC-12.4)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, sections
FC-05 ("idempotent compute i **cold reopen**"), FC-07 ("15/15 compute→review→approve→reopen") and FC-12
("… → export → **cold reopen**").
**Date:** 2026-08-10
**Worktree:** `/Users/piotrwisniewski/consultify-wt/w10-coldreopen`, branch `codex/finance-v3-w10-coldreopen`,
based on `1271a0f721`.
**Frozen baseline respected:** `codex/finance-v3-closeout-fanin` @ `19b4b06934` was neither merged, rebased on,
nor pushed to. No live database was touched.

**Status: all three scenarios PASS, on a proven-cold boundary, with a working negative control.**
**One real defect found and NOT fixed** (W10-D01, semantic hash never populated on the compute→approve path) —
documented with a live reproduction below, per the "no production code" scope of this work package.

**Commits (not pushed):**

| SHA | Subject |
| --- | --- |
| `bf43e39288` | `test(finance-v3): canonical cold-reopen reader, loadable on both sides of the boundary` |
| `5f09b0f690` | `test(finance-v3): prove cold reopen for Baseline, Valuation and the whole chain (FC-05.8 / FC-07.9 / FC-12.4)` |
| *(this file)* | `docs(gate-d): W10 cold reopen evidence report` |

Files added (nothing else changed — **zero production code touched**):

- `server/src/services/finance/canonical/__tests__/coldReopenReader.ts`
- `server/src/services/finance/canonical/__tests__/coldReopen.pg.test.ts`
- `docs/validation/finance-v3/generated/gate-d/W10_COLD_REOPEN_report.md`

---

## 1. What was required, and what "cold" had to mean

FC-05.8 / FC-07.9 / FC-12.4 all reduce to one property: an **approved** artifact, after **process and
connection continuity are broken**, must read back with identical values, the same frozen snapshot and the same
freshness, **without being recomputed**.

A read-after-write in the same session does not test that. It can be served by a warm pooled connection, a warm
module-level cache, or a transaction snapshot the writer left behind. So the boundary here is physical:

| Layer of continuity | How it is broken | How that is **verified** |
| --- | --- | --- |
| Pooled DB connections | `db.close()` on `PostgresDatabase` | An **independent** `pg.Client` (not from the pool) polls `pg_stat_activity`: **6 backend PIDs alive before close → 0 after**, asserted |
| Node process | cold read runs via `npx tsx coldReopenReader.ts` in a child process | child reports its own `process.pid` and its own `pg_backend_pid()`, asserted disjoint from the writer's PID set |
| ES module registry / heap | implied by the new process | the child re-imports `PostgresDatabase`, `lineageService` etc. from scratch |
| In-memory caches in services | none exist to clear | see §3 |

## 2. How coldness was proven (not declared)

The proof is in `coldReopen.pg.test.ts` → `capturePoolBackendPids()` + `proveConnectionsAreGone()` + `coldRead()`.

1. **Capture.** Six `withPinnedPostgresTransaction` calls are issued **concurrently** (a serial loop would keep
   reusing one backend and make the later assertion near-vacuous), each returning `pg_backend_pid()`. Result: six
   distinct backend PIDs belonging to the writing session's pool.
2. **Independent witness.** A raw `pg.Client` with `application_name = 'w10-cold-witness'` connects on its own
   connection. It is deliberately not from the pool whose death it must observe.
3. **Two-sided observation.** The witness queries `pg_stat_activity WHERE pid = ANY($1)` **before** the close —
   asserted non-empty, `expect(proof.beforeClose.length).toBeGreaterThan(1)` — and then again **after**
   `db.close()`, polling until empty, asserted `expect(proof.afterClose).toEqual([])`. Because the same query
   demonstrably *can* see live pool backends, the empty result afterwards is a real observation, not a query that
   never matches anything. Measured drain time: **1–6 ms**.
4. **New process.** Only then is the reader executed as a separate OS process. It reports `pid` and its own
   `backendPids`; the test asserts `child.backendPids.every(p => !writerPids.includes(p))`.

Sample (final clean run, `fc05_8`): writer backends `[80540…80549]` → after close `[]` → child OS pid distinct,
child backend pid `80579`, witness pid separate again.

**Both sides run the same code.** `coldReopenReader.ts` is imported in-process for the hot reference read and
executed as a script for the cold read, so a divergence cannot be an artefact of two different readers.

## 3. In-memory caches — checked, none found

The task required confirming that any caches in `artifactVersionService`, `lineageService` and the resolvers are
zeroed or absent. Grepping those modules for `new Map(`/`new Set(`/`cache`/`memo` at module scope returns:

- `lineageService.ts:65` — `EDGE_TYPES_REQUIRING_ASSUMPTION_HASH`, a frozen `ReadonlySet` of edge-type
  **constants**. Not data, cannot go stale.
- `baselineComputeService.ts:265–294` — six `Map`s (`lineIdByCode`, `periodByCode`, `revenueHistory…`,
  `openingCells`, `schedulesByType`, `assumptions`), all declared **inside `loadContext()`**, i.e. function-local
  and re-built per call.
- `artifactVersionService.ts`, `lineageFreshnessService.ts`, `valuationAdvisorService.ts`,
  `valuationComputeService.ts` — no module-scope mutable state at all.

So there is nothing to invalidate: these services hold no cross-call state. The cold read nevertheless gets a
brand-new module registry anyway, because it runs in a different process.

## 4. Scenario results

All three compare a **sha256 over a canonical, key-sorted, raw-text serialisation**. Numerics are compared as the
exact Postgres `::text` form (this repo sets no `pg.types.setTypeParser`, so `numeric` arrives as a string; a JS
`Number` round trip would hide a real precision defect). Timestamps are rendered `AT TIME ZONE 'UTC'` with
microsecond precision so a session-TimeZone difference between processes cannot masquerade as a change.
`created_at`/`updated_at`/`approved_at`/`frozen_at` are **inside** the compared payload on purpose — a reopen that
silently rewrote a row would move them.

### FC-05.8 — Baseline Model — PASS

Approved `BASELINE_MODEL`, real 12-month `runBaselineCompute` (circularity solver, mandatory cash sweep) plus the
FY2027/FY2028 continuation. **384 output rows.**

| Compared | Result |
| --- | --- |
| Every `finance_baseline_outputs` value, keyed by `line_code` × period label (not uuids) | identical |
| Assumptions, debt schedule payload, solver diagnostics | identical |
| Frozen `finance_compute_snapshots` row (`compute_snapshot_id`, `working_revision_id`, `as_of`) | identical |
| `content_semantic_hash` ("suma semantyczna") | identical — **but see W10-D01: it is NULL** |
| `freshness` | `CURRENT`, identical |
| Working revisions + full `artifact_lifecycle_events` trail | identical |
| Compute-activity witness (`job_count=4`, `run_count=4`, `snapshot_count=5`, newest job/finish timestamps) | **unchanged by the reopen → no recompute** |

Digest (final run): `d0edca401f1c7ca35db4b4e797d89da4e29dabff5fd95c6fcdff7e480d56c0d5`, hot == cold.

**On "no recompute".** A value comparison alone cannot prove it — a deterministic recompute would produce the same
numbers. So the reader also fingerprints the compute-side write surface (`compute_jobs` count and newest
`created_at`/`finished_at`, `compute_job_runs` count, snapshot count, freshness-event count) and asserts that
witness digest is unchanged across the cold boundary too.

### FC-07.9 — Valuation — PASS

Approved `VALUATION_CASE` (HIGH_RISK tier, three distinct users through submit → review → approve), real
`runDcfFcffValuation`, 5×5 sensitivity grid, EV→Equity bridge, Advisor findings written pre-approval via
`createComputeSnapshot()` (the IF-19 fix path) and frozen by approval.

| Compared | Cold value |
| --- | --- |
| Enterprise Value (persisted, raw text) | `238070438.17832354` — bit-identical to the computed `238070438.17832354` |
| Equity Value | `208570438.17832354` |
| `wacc_computed_pct` | `8.925849999999999` |
| Sensitivity cells | **25/25**, compared **ordered by (row_index, col_index)** — a transposed or shuffled grid would fail, not just a changed multiset |
| Terminal row(s), WACC inputs, comps | identical |
| Method basket + weights | `DCF_FCFF`, `weight_pct = 100`, `is_in_recommendation_basket = true` |
| Bridge + all components (sign, sequence, as-of) | identical |
| Advisor outputs | 2 rows, **`is_frozen = true`, `is_stale = false`** on both sides — asserted on the COLD payload specifically |

Digest (final run): `7eaac6794805aacf7525f0dc3c7eb86ed1c1ef9c3eb5943f2d5c133cc9e754a3`, hot == cold.

### FC-12.4 — whole chain — PASS

All five stages approved, then the entire chain reopened cold in one child process.

Row counts carried across the boundary unchanged:

| Stage | Rows |
| --- | --- |
| Statement lines | 160 |
| Analysis KPI values | 18 |
| Baseline outputs | 384 |
| Prediction — own rows | **0 (correct, see note)** |
| Prediction — effective rows | 384 |
| Valuation sensitivity cells | 25 |

**Note on the Prediction stage.** `finance_prediction_outputs` is empty by design for
`scenario_mode = 'STANDARD_BASE'`: `20260809_finance_v3_d07_prediction_02_integrity.sql:153` raises
*"scenario_mode=STANDARD_BASE may never own its own output rows"*, and the Models/Results UI reads
`finance_prediction_outputs_effective`, which resolves Base through the `MODEL_TO_SCENARIO` lineage edge. The
first version of this suite compared only the base table — i.e. compared an empty set and proved nothing about
that stage. It now compares the **effective view** as well (384 passthrough rows).

**Lineage navigable backwards after the cold reopen** — through the shipping `lineageService.getAncestors()`
traversal, not a hand-rolled CTE, because the requirement is that the *shipping* traversal survives:

```
STATEMENT_PACK      -[STATEMENT_TO_ANALYSIS]-> HISTORICAL_ANALYSIS
STATEMENT_PACK      -[STATEMENT_TO_MODEL]----> BASELINE_MODEL
HISTORICAL_ANALYSIS -[ANALYSIS_TO_MODEL]-----> BASELINE_MODEL
BASELINE_MODEL      -[MODEL_TO_VALUATION]----> VALUATION_CASE
```

**Nothing spuriously stale.** All five versions read back `status = APPROVED`, `freshness = CURRENT`,
`freshness_reason = NULL`, `stale_since = NULL`. The assertion is written as *"no version may be non-CURRENT
without BOTH a `freshness_reason` and a `stale_since`"*, so it stays meaningful if a future run legitimately does
mark something stale.

Digest (final run): `6dd118129a1b133e472114ba1425f37e7b4bd863dd7562cd9063f10deb2de63c`, hot == cold.

## 5. Negative control — the comparison CAN fail

Without this the three PASSes above would be unfalsifiable.

One `finance_baseline_outputs.value_decimal` (a REVENUE cell) was changed by `+0.01` **after approval**, the cold
reopen was repeated, and then the exact original text was restored.

| Step | Digest |
| --- | --- |
| Before corruption | `d0edca401f1c7ca35db4b4e797d89da4e29dabff5fd95c6fcdff7e480d56c0d5` |
| While corrupted | `469747ace0044051350c18065fd9188b7d290d2b1345d063a9b0130dd49bc867` — **detected** |
| After restore | `d0edca401f1c7ca35db4b4e797d89da4e29dabff5fd95c6fcdff7e480d56c0d5` — **match returns** |

Reported first difference (the comparator localises it, it does not just say "hashes differ"):

```
at offset 18110
  expected: ..."value_decimal":"11943750",    "value_kind":"FORECAST"...
  actual:   ..."value_decimal":"11943750.01", "value_kind":"FORECAST"...
```

**Why the control bypasses a trigger, and why that is correct.** The schema's own
`trg_finance_baseline_outputs_parent_immutability` correctly **refuses** any write once the parent business
version is APPROVED (verified live — an early draft of the fixture tried to insert continuation rows after
approval and was rejected by exactly this trigger, which is why the fixture now writes them before approval). The
control therefore applies its corruption under `SET LOCAL session_replication_role = replica`. That is the whole
point: it must simulate corruption that slipped **past** the guard — restore/replication/backup paths, a direct
DBA statement, a future service that runs with triggers disabled — otherwise the control would merely re-test the
trigger instead of testing the cold-reopen comparator. `SET LOCAL` reverts at COMMIT, so the pooled connection is
handed back clean.

## 6. Measured cold-reopen times — SLO baseline

Three separate runs; "cold read" is measured **inside the child** from just before its first import to the end of
the read (so it includes creating a fresh pool and re-importing the service modules — the honest cold cost);
"wall" additionally includes `npx tsx` process startup, which is tooling overhead, not product latency.

| Scenario | hot read | **cold read (in-child)** | child process total | wall incl. `npx tsx` spawn | pool drain |
| --- | --- | --- | --- | --- | --- |
| FC-05.8 Baseline (384 rows) | 7–27 ms | **173 / 247 / 350 / 682 ms** | 176–686 ms | 564–1707 ms | 1–6 ms |
| FC-07.9 Valuation | 13–30 ms | **191 / 229 / 302 / 701 ms** | 192–702 ms | 561–1549 ms | 2–6 ms |
| FC-12.4 whole chain | 36–170 ms | **209 / 235 / 410 / 1150 ms** | 214–1163 ms | 623–2484 ms | 1–4 ms |

Values listed best→worst across runs; the high end is the first, cold-filesystem run.

**Proposed SLO anchors** (local ephemeral Postgres, single reader, this data volume):

| Metric | Observed p50-ish | Suggested starting SLO |
| --- | --- | --- |
| Cold reopen, single artifact | ~200–350 ms | p95 ≤ 1.0 s |
| Cold reopen, whole 5-stage chain | ~250–410 ms | p95 ≤ 1.5 s |
| Pool drain after close | ≤ 6 ms | p95 ≤ 100 ms |
| Hot re-read (same session) | 7–36 ms | reference floor |

Caveat, stated plainly: these are **local loopback** numbers on a 384-row Baseline. They are a floor for
comparison, not a production SLO. A managed database with network latency, larger models and concurrent load will
be materially slower; the useful part is the shape (cold ≈ 10–20× hot, dominated by module import + pool
creation, not by the queries).

## 7. Defect found — NOT fixed (out of scope for this work package)

### W10-D01 — `content_semantic_hash` and `compute_run_id` are never populated on the compute→approve path

**Severity: P1 for FC-05.8/FC-08.** FC-05.8 names the semantic sum as one of the things that must survive a cold
reopen. It does survive — trivially, because it is `NULL` on both sides. The integrity mechanism the schema was
built around is therefore inert on the happy path.

**Reproduction** (exact commands in §8; the assertion below is a plain query on the fixture this suite builds):

```
type                | status   | freshness | sem_hash_null | run_id_null | snap_null
--------------------+----------+-----------+---------------+-------------+----------
STATEMENT_PACK      | APPROVED | CURRENT   | t             | t           | f
HISTORICAL_ANALYSIS | APPROVED | CURRENT   | t             | t           | f
BASELINE_MODEL      | APPROVED | CURRENT   | t             | t           | f
PREDICTION_SCENARIO | APPROVED | CURRENT   | t             | t           | f
VALUATION_CASE      | APPROVED | CURRENT   | t             | t           | f
```

…and the frozen snapshots inherit it:

```
type                | content_semantic_hash | compute_run_id
--------------------+-----------------------+----------------
STATEMENT_PACK      |  (null)               | (null)
HISTORICAL_ANALYSIS |  (null)               | (null)
BASELINE_MODEL      |  (null)               | (null)
PREDICTION_SCENARIO |  (null)               | (null)
VALUATION_CASE      |  (null)               | (null)
```

**Root cause.** The only two code paths that ever write a non-null `content_semantic_hash` onto a working revision
are `server/src/services/finance/collaboration/autosaveService.ts:154` (a UI autosave/explicit-save checkpoint)
and `server/src/services/finance/canonical/financeImportService.ts:1056`. Neither
`artifactVersionService.createArtifact()` (which mints `revision_seq = 1`) nor **any** compute engine
(`runBaselineCompute`, `runPredictionCompute`, `runDcfFcffValuation`, `computeAnalysisKpis`) writes it. So the
canonical create → compute → submit → review → approve sequence — the exact FC-05/FC-07 happy path, and the one
`goldco_full_dag.ts` itself uses — reaches `APPROVED` with the hash null, and `approveVersion()` step (b) copies
that null straight into `finance_compute_snapshots`. The same holds for `compute_run_id`: real `compute_jobs`
rows exist (`job_count = 4`), but the working revision and hence the frozen snapshot never point at them.

**Three concrete consequences, all verified rather than inferred:**

1. **Compute pinning is unreachable.** `collaboration/computePinning.ts:74-79` returns
   `{ ok: false, code: 'NO_CONTENT_HASH' }` when the current working revision has no hash. On the compute→approve
   path it always does, so `enqueueComputeForCurrentRevision()` can never pin.
2. **`uq_finance_compute_snapshots_revision_run` is inert.** The index is
   `UNIQUE (working_revision_id, compute_run_id)` (`20260809_finance_v3_b06_…sql:45`); with `compute_run_id` NULL
   Postgres treats the rows as distinct. Probed live inside a transaction that was rolled back: a second snapshot
   for the same `working_revision_id` was **accepted**. Duplicate snapshots are prevented today only by the
   `SELECT … LIMIT 1` guards inside `createComputeSnapshot()`/`approveVersion()`, not by the database.
3. **The audit link "which engine run produced these numbers" is broken** for every approved artifact created via
   the compute path.

**Not fixed here.** The allowlist for W10 is test files + this report; W10 proves properties of the existing
system. Recommended owner: whoever owns WP-B02/WP-B04 sequencing. Minimal fix shape: have each compute engine (or
`approveVersion()` step (b)) derive and stamp `content_semantic_hash` + `compute_run_id` onto the current working
revision before the snapshot is frozen.

### W10-O01 (observation, not a defect) — `finance_prediction_outputs` is empty for `STANDARD_BASE`

Documented in §4 above. Correct by design and trigger-enforced; recorded because it is an easy way to write a
cold-reopen test that silently compares nothing.

## 8. Reproduce

Own ephemeral PostgreSQL **15** cluster only — never `5432`, never demo/staging/prod, never the shared Homebrew
instance.

```bash
export PATH=/opt/homebrew/opt/postgresql@15/bin:$PATH
export LC_ALL=C
PGDATA=/private/tmp/w10-coldreopen-pgdata
PORT=57311                      # confirmed free with lsof before use, 55000-59999 range

rm -rf "$PGDATA"
initdb -D "$PGDATA" --locale=C --encoding=UTF8 -U postgres
LC_ALL=C pg_ctl -D "$PGDATA" \
  -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$PGDATA" \
  -l /private/tmp/w10-pg.log start
createdb -h 127.0.0.1 -p $PORT -U postgres w10_coldreopen

cd <worktree>
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/w10_coldreopen \
  npx tsx server/scripts/migrate.postgres.ts        # 1463 tables, 0 errors

cd server
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/w10_coldreopen \
  W10_EVIDENCE_PATH=/private/tmp/w10-evidence.json \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/coldReopen.pg.test.ts \
    --no-file-parallelism --reporter=verbose

# teardown
pg_ctl -D "$PGDATA" -m fast stop && rm -rf "$PGDATA"
```

`W10_EVIDENCE_PATH` is optional; when set, the suite writes the machine-readable evidence (digests, PID sets,
drain times, per-scenario timings, the negative-control diff) used to build §4–§6.

**Gate behaviour.** The suite is `describe.skipIf`-gated on `RUN_DB_TESTS=1` **and** `MOCK_DB=false` **and** an
explicit `postgres…` `DATABASE_URL`. Without all three it reports SKIPPED — never a false green. The child reader
enforces the same three conditions independently and throws rather than run against an ambiguous target.

## 9. Isolation and hygiene

- One freshly generated organization id per run (`org-w10-coldreopen-<uuid>`); all rows are org-scoped.
- **No global seed, taxonomy or feature flag is created or mutated**, so this file cannot contaminate another
  test file sharing the database, in either direction. (The known cross-file contamination another agent is
  fixing does not apply here.)
- `afterAll` deletes what the schema permits: `compute_job_outputs`, `compute_job_runs`, `compute_jobs`.
- `finance_artifacts` / `finance_business_versions` / `finance_working_revisions` / lifecycle / lineage /
  exception / snapshot rows are **append-only by design** (BEFORE DELETE triggers reject deletion) and are
  deliberately not deleted — same documented convention as `canonicalServices.pg.test.ts`.
- The negative control restores the exact original `numeric` text and re-verifies the digest, so it leaves no
  drift even if a later test in the same database reads the same rows.
- Temporary child-reader payload files are written to `$TMPDIR` and removed by the parent after reading.
- Verified repeatable: **three passing runs** — twice against the same database (proving the suite does not
  depend on a pristine database) and once against a freshly created + freshly migrated database (proving it does
  not depend on accumulated global state).

## 10. Scope honesty

- Everything above was measured on a **local ephemeral cluster**. No demo/staging/prod database was contacted.
- The valuation figures (EV `238,070,438.18`, WACC `8.9258%`) come from the real engines over GoldCo oracle data;
  they are reproducible fixture outputs, not a business valuation.
- The suite proves **persistence and reopen fidelity**. It does not re-prove the correctness of the compute
  engines — that is WP-D02/D04/D06/D08/D10's job and is unchanged here.
- FC-05.8 / FC-07.9 / FC-12.4 are the only three conditions this work package claims. FC-05, FC-07 and FC-12 as
  wholes remain open on their other points.
- One production defect (W10-D01) was found and left unfixed by design; until it is fixed, the "semantic sum"
  half of FC-05.8 is satisfied only vacuously.
