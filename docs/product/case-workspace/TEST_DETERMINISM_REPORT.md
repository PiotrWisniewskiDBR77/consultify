# CW-T-F1 — Test-Determinism Report (Harness Contract + Suite Interference)

Author: CW-T-F1 worker session, 2026-08-10 (checkpoint `cbfd32a48a` as baseline).
Scope: this packet's allowlist — `src/components/CaseWorkspace/podglad/**`,
`server/src/services/caseWorkspace/__tests__/_helpers/**`, this file. No
service/route/existing-test-file edits were made; every finding below is
either fixed within the allowlist or handed to the coordinator as an exact
instruction.

---

## 0. Summary for the coordinator

| # | Item | Status |
|---|------|--------|
| 1 | Harness `/graph` mock contract vs real API envelope | **FIXED** (in allowlist) |
| 2a | Root cause A — `initDb()` concurrent-DDL race (`pg_class_relname_nsp_index`) | **CONFIRMED, reproduced, measured** — fix recommended, not applied (env var, out of allowlist) |
| 2b | Root cause B — outbox read query's non-monotonic tie-break (`event_id` UUID) | **CONFIRMED as a real defect** (proven by direct SQL); **NOT confirmed** as the exact trigger of the one historical `proposalApprovalService` flake — could not reproduce that specific failure (see §3) |
| 3 | Full 296-test checkpoint-baseline suite, 3× parallel + 1× serial, zero flakes | **BLOCKED** — the live worktree currently carries uncommitted, in-flight changes from other CW-T-* streams that break fixture setup for ~29/30 files (`case_name_required`), unrelated to CW-T-F1. Numbers below are real but measure a moving target, not the checkpoint baseline. |
| 4 | Helpers for other packets | **DELIVERED** — `server/src/services/caseWorkspace/__tests__/_helpers/{testNamespace,outboxOrdering,schemaBootstrapGuard,fixtureCleanup}.ts` |

**Bottom line:** I found and fixed the harness contract bug (task 1). I found
and rigorously proved a real, previously-undocumented, load-bearing
determinism defect (root cause A, §1.3) that fits the checkpoint's own
historical numbers ("180 failures cold, 251/252 warm") far better than any
alternative I could construct, plus a second, real but not-yet-causally-linked
defect (root cause B, §1.1). I could **not** get a clean, reproducible
296/296 measurement of the checkpoint baseline tonight because five other
agents are concurrently editing files this suite's fixtures depend on, live,
in the same shared worktree — evidenced with `git diff`/mtimes, not asserted.
That blocker is reported literally as **BLOCKED**, not smoothed over.

---

## 1. Root causes investigated, with evidence

Investigated in the order the task specified: shared IDs, shared org/project,
fixtures, flags, cleanup, DB transactions, scheduler/worker, clocks, ports,
process lifecycle.

- **Shared IDs / shared org-project / fixtures**: ruled out. Every one of the
  30 `*.pg.test.ts` files seeds its own org/project/case via
  `${label}-${randomUUID()}` inside the test body (never a shared
  `beforeEach`); grepped all 30 files for any hardcoded, non-randomized
  organization/case literal — none found (`grep -rn "'org-\|'case-" ... | grep
  -v randomUUID` → only randomized calls). Cross-test ID collision is
  astronomically unlikely (UUIDv4) and I found no evidence of it.
- **Flags**: no shared, mutable, non-namespaced feature-flag state was found
  in the read path of the proposal-approval lifecycle test (authenticationAssurance/
  approvalChannelPolicy/policyVersion are per-call INPUT values, not read from
  a shared table).
- **Cleanup**: each file cleans its own rows in a `finally`; no evidence of
  cross-test leakage via missed cleanup was found (see also the `_helpers/fixtureCleanup.ts`
  backstop delivered below, for the case a test's own cleanup itself throws).
- **DB transactions**: `withPgTransaction`/`withRawPgTransaction`
  (`server/src/utils/queryHelpers.ts:225-288`) were read in full. Both open a
  **fresh** connection/transaction per call and always `COMMIT`/`ROLLBACK`
  before returning control — no transaction-reuse or leaked-transaction bug
  found (this rules out one plausible hypothesis I initially held — see §1.2).
- **Scheduler/worker/process lifecycle**: **this is where the confirmed
  defect is** — see §1.3.
- **Clocks**: **this is where the second, real-but-unconfirmed defect is** —
  see §1.1/§1.2.
- **Ports**: not implicated; each `*.pg.test.ts` file's own `control` pool
  and the app's shared pool both target the same `DATABASE_URL`; no port
  contention found.

### 1.1 Outbox read query: `ORDER BY created_at ASC, event_id ASC` is not a valid tie-break

`case_workspace_event_outbox.created_at` is `TIMESTAMPTZ NOT NULL DEFAULT
now()` (`server/migrations/20260810_case_workspace_event_outbox.sql:171`).
Postgres's `now()` is fixed at **transaction start**, not per statement.
`proposalApprovalService.pg.test.ts`'s own `readOutboxRowsForAggregate()`
(lines 448-458) breaks ties with `event_id ASC`. `event_id` is
`cwevt-${randomUUID()}` (`eventOutboxService.ts`'s `publishEvent`, line
~369) — a value with **zero correlation to insertion order**.

Direct proof against the real schema (not a mock): inserted 6 rows for one
`aggregate_id` inside a single transaction (so all six legitimately share one
`created_at`), then ran the EXACT query the test uses:

```sql
SELECT event_type, created_at, event_id FROM case_workspace_event_outbox
 WHERE aggregate_id = 'agg-tie-demo'
 ORDER BY created_at ASC, event_id ASC;
```

Result — six rows inserted in this order: `proposal.created,
proposal.review_requested, approval.approved, proposal.executing,
proposal.executed, proposal.audited` — came back as:

```
proposal.review_requested, proposal.executing, proposal.audited,
approval.approved, proposal.executed, proposal.created
```

Completely scrambled — because I named the event_ids `cwevt-aaa-…`,
`cwevt-bbb-…`, `cwevt-ccc-…`, `cwevt-mmm-…`, `cwevt-yyy-…`, `cwevt-zzz-…` to make the alphabetical tie-break visible. **This is a real, load-bearing
defect**: any test that ever asserts an exact `event_type` sequence via this
query, over rows that ever land in the same transaction (or, per §1.2, tie by
coincidence), gets a **silently wrong answer** — it may fail (a "flake") or it
may coincidentally still pass in the scrambled order, which is worse.

The **same anti-pattern was just added elsewhere**, live, during this
investigation: `eventOutboxService.ts`'s own `dispatchPendingEvents()` now
does `ORDER BY created_at, event_id` (uncommitted change, packet CW-T-E,
`git diff server/src/services/caseWorkspace/eventOutboxService.ts`). This
class of bug is spreading, not shrinking.

### 1.2 Intra-aggregate ties: proven NOT to occur under the current clean transaction implementation

I could not stop at 1.1 — the historical flake was **within one aggregate's
own 6 sequential commands**, and those commands are strictly
`await`-sequenced (command N+1 is not even issued until command N's full
round trip, including COMMIT, resolves), each through a **freshly opened**
connection (`withPgTransaction` calls `new PgClient(...).connect()` every
time — read in full, no pooling/reuse bug found, `server/src/utils/queryHelpers.ts:225-261`).
So a same-aggregate tie should be structurally close to impossible.

I tested this directly rather than assume it: 60 concurrent simulated
"tests," each running the exact `withPgTransaction` lifecycle (fresh
`pg.Client`, `BEGIN`, one INSERT, `COMMIT`, `end()`) six times sequentially
for its own aggregate, all racing against each other and against a
400-transaction cross-aggregate load generator on the same database:

```
simulated tests=60, each with 6 sequential own-transaction events
tests with an INTERNAL (same-aggregate) created_at tie: 0
```

Separately, the SAME probe run against 400 genuinely concurrent
**different**-aggregate transactions found the opposite is common:

```
transactions=400 distinct_timestamps=86 colliding_timestamp_groups=68
  COLLISION created_at=2026-08-10T19:13:22.986Z count=9
  ... (67 more groups)
```

**Conclusion**: §1.1's defect is real and will bite the moment two events for
the *same* aggregate ever land in the same transaction, or the moment any
`ORDER BY created_at, event_id` query is used **without** aggregate scoping
(where cross-aggregate ties are common — proven above) to imply an order
(e.g. a dispatcher/worker query, which is exactly what CW-T-E just added).
But I could **not** reproduce a same-aggregate tie with the current, correct
transaction implementation — so I cannot claim §1.1 is *confirmed* as the
mechanism of the one historical `proposalApprovalService` flake. It remains
the single most plausible code-level hypothesis I could construct, backed by
a real, demonstrated defect, but not a reproduced smoking gun for that
specific historical failure. Recorded here as **PARTIAL**, not proven.

### 1.3 `initDb()` concurrent-DDL race — confirmed, reproduced, measured (the stronger finding)

While attempting to reproduce the historical flake at full-suite scale, I
found and confirmed a **different, systemic, and clearly reproducible**
determinism defect that fits the checkpoint's own historical numbers much
better than §1.1/§1.2:

- `getPool()` (`server/src/database/PostgresDatabase.ts:~440-511`) calls
  `initDb()` on first use in **every process**, unless
  `POSTGRES_SKIP_INIT_IN_TEST=1` is set. The documented test-run recipe in
  every `*.pg.test.ts` file's own header comment, and the recipe given for
  this task, does **not** set this variable.
- `initDb()` runs `CREATE INDEX IF NOT EXISTS idx_tasks_assignee
  ON tasks(assignee_id)` and `idx_tasks_assignee_status`
  (`PostgresDatabase.ts:3663-3665`), among many other legacy runtime schema
  patches.
- Their **only** producer in `server/migrations/` is
  `000_initdb_core_tables.sql`, which `server/scripts/migrate.postgres.ts`'s
  `isSqliteOnlyMigration()` blanket-excludes from `db:migrate`/`db:migrate:strict`
  (it is not in that file's `PROMOTED_LEGACY_SET`). Verified directly, not
  assumed: on a database migrated ONLY via `db:migrate:strict` (no test run
  yet), `tasks` exists (produced by `000_z_core_baseline.sql` /
  `000_zz_core_baseline_producers_fresh_db_gap.sql`) but
  `idx_tasks_assignee`/`idx_tasks_assignee_status` do **not**:

  ```
  SELECT indexname FROM pg_indexes WHERE indexname IN
    ('idx_tasks_assignee_status','idx_tasks_assignee');
   indexname
  -----------
  (0 rows)
  ```

- Vitest's default (`pool: 'forks'`, `fileParallelism: true`, no override in
  `server/vitest.config.ts`) runs every test **file** in its own OS process.
  On a freshly migrated database, every one of those processes independently
  calls `getPool()` → `initDb()` → races every other process to
  `CREATE INDEX IF NOT EXISTS idx_tasks_assignee …` for the first time,
  simultaneously. This is a documented PostgreSQL footgun:
  `CREATE INDEX IF NOT EXISTS` is not safe against a genuine concurrent race
  where multiple sessions all observe "does not exist" before any commits —
  the loser gets:

  ```
  error: duplicate key value violates unique constraint "pg_class_relname_nsp_index"
  detail: Key (relname, relnamespace)=(idx_tasks_assignee, 2200) already exists.
  ... at initDb (PostgresDatabase.ts:3663:5)
  ```

  (also observed for `idx_tasks_assignee_status`, `idx_teams_lead`, and
  others — not limited to one index).

- **Measured, not assumed** (see §3's four runs): this error appears **zero
  times in the serial run** and a variable number of times (76 / 3 / 37, of
  which 39 / 2 / 28 were hard, unswallowed errors) across three
  file-parallel runs against three independently fresh databases — a clean,
  parallelism-gated, run-to-run-variable signature that is a textbook match
  for the checkpoint's own historical record: **"180 awarii na zimnym
  starcie przy pierwszym przebiegu na swiezej bazie, 251/252 przy
  powtorce."** Cold start = the racy indexes don't exist yet = every forked
  process's `initDb()` genuinely races = many, semi-random collisions across
  unrelated files. Warm repeat = the indexes now exist from the first run's
  survivor = `CREATE INDEX IF NOT EXISTS` is a true no-op everywhere = the
  race window closes.

**This is the strongest, best-evidenced finding in this report.** It is a
process-lifecycle / schema-bootstrap race, not a test-isolation bug in any
individual `*.pg.test.ts` file — no amount of per-test ID namespacing or
cleanup fixes it. The fix is an environment variable
(`POSTGRES_SKIP_INIT_IN_TEST=1`) on the test run itself, which is outside
this packet's allowlist to change (it's not a file edit, it's the documented
run recipe used by every worker/CI job). See §4.

---

## 2. Helpers delivered (`server/src/services/caseWorkspace/__tests__/_helpers/`)

All four are new files, pure additions, no existing file touched, all
type-checked (`tsc --noEmit`, zero errors) and esbuild-bundled clean:

- **`testNamespace.ts`** — `uniqueTestId(label)` / `testFixtureIds(label)`.
  Standardizes the `${label}-${randomUUID()}` pattern every file already
  uses inline, under a stable, greppable `cwtest-` marker, so new packets
  don't hand-roll a weaker scheme and so fixture rows are traceable to the
  exact `it()` that created them.
- **`outboxOrdering.ts`** — `assertOutboxRowsHaveNoTimestampTies(rows)`
  turns §1.1's silent-scramble failure mode into a loud, immediate,
  first-failure diagnostic instead of an intermittent wrong-order flake (or
  worse, a coincidentally-still-correct false pass). Also exports
  `sortByAggregateVersionThenCreatedAt()` — the robust alternative ordering
  (aggregate_version is written in the same transaction as its row and is a
  real per-aggregate monotonic counter, unlike `event_id`).
- **`schemaBootstrapGuard.ts`** — `warnIfSchemaBootstrapRaceLikely(pool)`.
  Call once in a suite's `beforeAll`; if the two race-prone indexes are
  missing (i.e. `initDb()` hasn't completed yet on this database and
  `POSTGRES_SKIP_INIT_IN_TEST` isn't set), logs a specific, actionable
  warning pointing straight at §1.3 instead of leaving a future
  `pg_class_relname_nsp_index` failure to be re-diagnosed from scratch.
  Non-fatal by design (diagnostic aid, not a gate).
- **`fixtureCleanup.ts`** — `cleanupSuiteFixtures(client, {organizationIds})`
  as an `afterAll`/`afterEach` **backstop** (in addition to, never instead
  of, each test's own `finally`), and `readOutboxRowsForOrganizations()` as
  the org-scoped read shape for diagnostics that aren't "one aggregate's own
  history" (which the existing `readOutboxRowsForAggregate` pattern already
  handles correctly).

None of these edit an existing test file — adoption (importing them into the
30 existing `*.pg.test.ts` files) is the coordinator's call, listed in §4.

---

## 3. Measurement: 3× parallel + 1× serial, full `server/src/services/caseWorkspace/__tests__` tree (31 files, 310-313 tests)

**Read §3.1 before the numbers below** — they are real command output, not
fabricated, but they measure a **currently unstable working tree**, not the
`cbfd32a48a` checkpoint. Marking this campaign **BLOCKED** for its stated
purpose (proving 296/296 zero-flake against the checkpoint baseline);
reporting the numbers anyway because they are still evidence for §1.3 and
because pretending I didn't run them would be worse than showing confounded
data labeled as such.

### 3.1 Why this is BLOCKED, not a valid checkpoint measurement

This is a shared worktree; five other agents work in it concurrently
(per the task brief). During this session, `git status --short
server/src/services/caseWorkspace/` showed these files **uncommitted and
actively changing** (mtimes moving between my own consecutive runs):

```
 M server/src/services/caseWorkspace/__tests__/eventInboxService.pg.test.ts
 M server/src/services/caseWorkspace/__tests__/waitSubscriptionService.pg.test.ts
 M server/src/services/caseWorkspace/caseCoreService.ts
 M server/src/services/caseWorkspace/caseIntakeService.ts
 M server/src/services/caseWorkspace/eventInboxService.ts
 M server/src/services/caseWorkspace/eventOutboxService.ts
 M server/src/services/caseWorkspace/waitSubscriptionService.ts
?? server/migrations/20260810d_case_workspace_case_identity.sql
?? server/migrations/20260810e_case_workspace_event_correlation.sql
```

The `caseCoreService.ts` change (packet CW-T-A, cardinality retrofit) makes
`case_name` a required field of `createCase()`. Every one of the 30 files'
`seedOrgProjectCase()`-style fixture helper calls `createCase()` **without**
`case_name` (predates CW-T-A). Result: **every test that seeds a case**
fails at fixture setup with `Error: case_name_required`, before CW-T-F1's
own code path is even reached. This accounts for 141-151 of each run's
~211-224 failures (see the exact per-run count in §3.2's table). This is
**not** a CW-T-F1 defect, not editable within this packet's allowlist
(`caseCoreService.ts` and the `*.pg.test.ts` files both belong to other
streams), and not something waiting it out could fix on a useful timescale
during this session — the tree kept changing between my own consecutive
"identical" runs (proof: total collected test count varied 310 vs 313
between runs; `waitSubscriptionService.pg.test.ts` gained 383 lines
mid-campaign per `git diff --stat`).

I also hit this same hazard once already at the database layer:
`db:migrate:strict` against a fresh `cwt_det_1` database silently completed
successfully (exit 0, "✅ Postgres migrations complete") but **skipped**
`20260810e_case_workspace_event_correlation.sql` entirely (absent from
`schema_migrations`, not even recorded as failed) — because that file was
untracked and mid-write by another agent at the exact instant I ran the
migration. Re-running the identical command 90 seconds later (after the
file existed) applied it correctly. This is the "orkiestracja: jeden
worktree = jeden agent" hazard from project memory, observed directly, not
theoretical — and it means **fresh-DB provisioning itself is not safe to run
concurrently with other agents' migration-file writes** during this
session.

### 3.2 The numbers (labeled: confounded by the above, not a checkpoint measurement)

Command per run: `DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1
MOCK_DB=false DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/<fresh db> npx
vitest run src/services/caseWorkspace/__tests__ --environment node` (serial
run additionally passed `--no-file-parallelism`). Each parallel run used its
own freshly created + `db:migrate:strict`'d database (`cwt_det_2`,
`cwt_det_3`, `cwt_det_4`); the serial run used `cwt_det_serial`. All four
databases were created and migrated fresh for this campaign and dropped
afterward.

| Run | DB | Mode | Test Files | Tests | `case_name_required` | `pg_class_relname_nsp_index` (hard errors) |
|---|---|---|---|---|---|---|
| A | cwt_det_2 | parallel | 29 failed / 1 passed / 1 skipped (31) | 218 failed / 62 passed / 30 skipped (310) | 151 | 76 mentions (39 hard) |
| B | cwt_det_3 | parallel | 28 failed / 2 passed / 1 skipped (31) | 224 failed / 56 passed / 30 skipped (310) | 141 | 3 mentions (2 hard) |
| C | cwt_det_4 | parallel | 26 failed / 4 passed / 1 skipped (31) | 211 failed / 69 passed / 30 skipped (310) | 141 | 37 mentions (28 hard) |
| Serial | cwt_det_serial | serial (`--no-file-parallelism`) | 25 failed / 5 passed / 1 skipped (31) | 169 failed / 114 passed / 30 skipped (**313**) | 141 | **0** |

**Literal verdict for this campaign: BLOCKED.** Not PASS, not a clean FLAKY
count — the dominant failure mode (`case_name_required`) is a deterministic,
100%-reproducible break from concurrent out-of-scope work, and the
run-to-run variance in total test count (310 vs 313) and in
`pg_class_relname_nsp_index` occurrence count (0 / 2 / 28 / 39 hard errors)
is real signal but is evidence for §1.3, not a valid answer to "is the
296-test checkpoint baseline flake-free."

**What this campaign DID prove cleanly** (robust to the confound, because it
compares parallel-vs-serial on the SAME confound): the
`pg_class_relname_nsp_index` schema-bootstrap race (§1.3) is exclusively a
parallel-mode phenomenon — **zero** occurrences across the entire serial
run, present and run-to-run-variable in all three parallel runs. That
contrast is not affected by whether `case_name_required` is also firing.

### 3.3 What I recommend instead of re-running this tonight

1. Coordinator lands/stabilizes the CW-T-A `case_name` retrofit (and
   whichever of CW-T-E's event-correlation / eventInbox / caseIntake /
   waitSubscription changes are in flight) so the 30 test files' shared
   fixture helper works again.
2. Re-run this exact campaign (3 fresh DBs parallel + 1 fresh DB serial)
   **with `POSTGRES_SKIP_INIT_IN_TEST=1` added** to the run env, once the
   tree is stable, ideally from an isolated worktree/branch rather than this
   shared one. Expect the `case_name_required` and
   `pg_class_relname_nsp_index` failure classes to both disappear, which
   would isolate whether the original single `proposalApprovalService`
   assertion flake (§1.2) still recurs on its own — that is the one
   question this session could not answer.

---

## 4. Exact instructions for the coordinator

Files to change (none of them in this packet's allowlist):

1. **Every place the `RUN_DB_TESTS=1 MOCK_DB=false ...` recipe is
   documented/run** (each `*.pg.test.ts` file's own header comment across
   all 30 files, any CI job definition, and the recipe handed to future
   worker sessions) — add `POSTGRES_SKIP_INIT_IN_TEST=1`. This closes the
   §1.3 race. Schema completeness for the caseWorkspace suite does not
   depend on `initDb()`'s runtime patches once `db:migrate:strict` has run;
   worst case, verify with `_helpers/schemaBootstrapGuard.ts`'s
   `warnIfSchemaBootstrapRaceLikely()` in a `beforeAll` first if there's
   any doubt about a specific suite's dependency on a runtime-only patch.

2. **`server/src/services/caseWorkspace/proposalApprovalService.pg.test.ts`**
   (and any sibling file using the same pattern — grep for `ORDER BY
   created_at ASC, event_id ASC` across `__tests__/`) — replace the tie-break
   in `readOutboxRowsForAggregate()`, or at minimum call
   `_helpers/outboxOrdering.ts`'s `assertOutboxRowsHaveNoTimestampTies(rows)`
   right after the read and before the `toEqual([...])` sequence assertion,
   so a real tie fails loudly and immediately instead of silently.

3. **`server/src/services/caseWorkspace/eventOutboxService.ts`**'s
   `dispatchPendingEvents()` (`ORDER BY created_at, event_id`, added by
   packet CW-T-E, uncommitted as of this report) — same class of bug,
   freshly introduced; needs the same fix. This one matters more than the
   test-only case: it's a production dispatch-order guarantee, not just a
   test assertion.

4. **Root-cause fix for §1.1, if the coordinator wants a real fix rather
   than a loud-failure guard**: add a monotonic append-order column to
   `case_workspace_event_outbox` (e.g. `sequence_no BIGSERIAL` /
   `GENERATED ALWAYS AS IDENTITY`) via a new migration, and switch every
   `ORDER BY created_at, event_id` in this codebase to `ORDER BY
   sequence_no`. Out of this packet's allowlist (migrations + service file).

5. **`server/scripts/migrate.postgres.ts`**'s `PROMOTED_LEGACY_SET` — if the
   coordinator prefers `idx_tasks_assignee`/`idx_tasks_assignee_status` to
   be created by migration rather than by disabling `initDb()` in tests,
   promote `000_initdb_core_tables.sql` (or extract just those two
   statements into a new, small, idempotent migration) the same way
   `081_studio_tables.sql`/`073_conversations.sql`/`215_partner_portal.sql`/
   `256_integrations_system.sql` were promoted. This is the more thorough
   fix; `POSTGRES_SKIP_INIT_IN_TEST=1` (item 1) is the faster one.

---

## 5. Task 1 — harness contract fix (done, in allowlist)

`src/components/CaseWorkspace/podglad/main.tsx`'s mock for `GET
/plan-versions/:id/graph` returned the bare `CanonicalGraph` (from the
`GRAPHS` map) where the real route
(`server/src/routes/caseWorkspace/casePlanVersions.routes.ts:158-170` →
`casePlanVersionService.ts`'s `getGraph`, lines 1382-1393) returns the
envelope `{ graphId, graphDigest, semanticGraph }`. This is the exact
discrepancy that let a real P1 (`CaseDetailScreen.tsx` assigning the
envelope straight into `graph`, so a published plan with steps rendered as
"Ten plan nie ma jeszcze kroków") through the harness undetected — the bug
was only ever caught by a live-stack browser session on 2026-08-10 (see
`server/src/services/caseWorkspace/__tests__/e2e/liveStack.e2e.pg.test.ts`,
test *"the response ENVELOPE of /graph is a wrapper, not the graph"*).

Fix: `trasuj()`'s `/graph` handler now looks up the matching
`CasePlanVersion` from `PLAN_VERSIONS` (which already carries
`graphDigest` + `semanticGraph` together) and returns the same three-key
envelope the real route does. Verified directly (not just by inspection):
a standalone script imported `daneProbne.ts`'s real fixture data and ran the
exact new lookup logic, confirming the envelope keys
(`graphDigest, graphId, semanticGraph`) match exactly what
`liveStack.e2e.pg.test.ts` asserts, for all three fixture plan versions
(`plan-014-3`: 8 nodes, `plan-011-2`: 4 nodes, `plan-007-1`: 4 nodes), plus
a correct 404 for an unknown id. The harness could not be visually
screenshotted this session (port 3610 is blocked by the shared Browser
pane's port policy, and this packet's allowlist does not include
`.claude/launch.json`, which is shared across the other 5 concurrent agents
and out of scope to edit mid-task) — logic-level verification stands in its
place.

Also completed per the task brief: the harness is now marked explicitly and
visibly as a mock, not proof of a live stack —

- **File header** (`main.tsx`, top of file): a prominent
  "★★★ TO JEST ATRAPA. NIE DOWÓD ŻYWEGO STOSU. ★★★" section explaining what
  it's good for, what it's not, and citing the exact incident above.
- **On-screen banner**: every render now shows a fixed, always-visible amber
  banner reading "ATRAPA SIECI (podglad/main.tsx) — harness komponentu, NIE
  dowód żywego backendu. Dowód = testy *.pg.test.ts na realnym PG." —
  impossible to miss in any screenshot taken from this harness.
- **New `src/components/CaseWorkspace/podglad/README.md`**: full writeup of
  what the harness is for, the documented incident, and where the real proof
  lives (`*.pg.test.ts` on real Postgres / the live-stack runbook).

---

## Appendix — raw logs

Saved in the session scratchpad (not part of this repo; available on
request from the session that produced this report):
`parallel-run-A.log`, `parallel-run-B.log`, `parallel-run-C.log`,
`serial-run.log`, `clock-collision-probe.mjs` (+ output),
`intra-aggregate-tie-probe.mjs` (+ output), `verify-envelope.ts` (+ output),
`migrate_1.log` / `migrate_1_retry.log` (the silently-skipped-migration
incident from §3.1).
