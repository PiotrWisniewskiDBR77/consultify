# Case Workspace — Performance Profile Evidence (DoD-I)

> Status: `EVIDENCE — PARTIAL` (see the literal EVIDENCE_MISSING sections below
> before this is read as a passing gate)
> Scope: `docs/product/case-workspace/14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md`
> DoD-I ("performance and reliability"). Bears directly on these rows of
> `docs/product/case-workspace/acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv`:
> `CW-DOD-I2` (1,000/250/500/10,000 fixture — §2, DONE), `CW-DOD-I3` (route
> p95 budgets — §1.3, explicitly NOT evaluated, wrong instrument), `CW-DOD-I4`
> (30-min browser-heap Run — §6, `EVIDENCE_MISSING`), `CW-DOD-I5` (list
> pagination — §7 finding 1, confirms the existing `PARTIAL` under real load),
> `CW-DOD-I6` (dispatch/backlog observability — §5 finding 4, `outboxWorker`
> not wired into `server/src/index.ts` **at the time this original evidence was
> produced — see §9 for the CW-T-E / B4 update: it is wired now, and §9 is the
> current evidence for this row**), `CW-DOD-I8` (failure injection — §5,
> DONE). Does **not** bear on `CW-DOD-I1` (spinner/socket memory — frontend)
> or `CW-DOD-I7` (reconnect/cold-reopen convergence — a live-session/frontend
> concern this backend-only harness has no way to exercise); not claimed here.
> Checkpoint under test: `cbfd32a48a` (as instructed; no `git` commands were
> run by this packet — see "How this was produced" below). **§9 below is a
> LATER packet (CW-T-E / B4) run against a newer checkpoint where the worker
> is wired — read §9's own header for its exact scope before treating §1-§8
> as the current state of `CW-DOD-I6`.**
> Harness: `server/src/services/caseWorkspace/__tests__/performance/**`
> (new in this packet).
> Packet allowlist: `server/src/services/caseWorkspace/__tests__/performance/**`
> and this file only — no service/schema/route code was modified to produce
> this evidence, and none of the findings below have been fixed by this
> packet. Updating `FUNCTIONAL_REQUIREMENT_COVERAGE.csv`'s `CW-DOD-I*` rows
> from this evidence is the coordinator's job, not this packet's (out of
> allowlist).

## 0. Literal top-line status (read this first)

| Owner requirement | Result |
|---|---|
| 1,000 Cases via real API | **DONE** — real `caseCoreService.createCase()` calls, not INSERTs |
| Plan 250 nodes / 500 edges via real API | **DONE** — real `casePlanVersionService.createPlanDraft()` |
| 10,000 events in the outbox | **DONE** (10,001 — see §2) — real `caseHistoryService.appendCaseHistoryEvent()`, one outbox row per event, atomically |
| p95 for list/graph/history/dispatch queries | **DONE**, three fresh runs — see §3 |
| Heap (Node process, this harness) | **DONE**, three fresh runs — see §3.4 |
| Three deterministic fresh runs, compared | **DONE** — see §4 for the actual spread, which is **not tight** (explained, not hidden) |
| Failure injection mid-dispatch | **DONE** — real `pg_terminate_backend()` mid-transaction, see §5 |
| 30-minute active Run, browser DOM/heap growth | **`EVIDENCE_MISSING`** — see §6, literal reason given, not attempted-and-hidden |
| Clean, dedicated runner environment per DoD-I's own freeze clause | **NOT MET** — this run shares one physical machine and one Postgres instance with **six other concurrently active agents** (per this packet's own task briefing). This is disclosed, not hidden; see §1.3. The DoD-I latency **budgets** (2.5s / 100ms / 1s — those are UI-route budgets, not directly what this backend harness measures) are therefore **not evaluated against this data** — see §1.3 for what these numbers can and cannot be used for. |

This document is evidence for a coordinator/Codex to weigh, not itself a PASS
claim on any `CW-DOD-I*` row. Two of the frozen requirement's own preconditions
(a dedicated, undocumented-contention runner; a genuinely idle three-run
comparison) were not available in this session — see §1.3 and §4.

## 1. How this was produced

### 1.1 What is real, what is fixture bootstrap

Every one of the following was created through the **real, already-implemented
service API** — never a direct `INSERT` into the table the requirement is
actually about:

- 1,000 `case_core` rows → `caseCoreService.createCase()`
  (`server/src/services/caseWorkspace/caseCoreService.ts`)
- 1 `case_plan_versions` row with a 250-node/500-edge `semantic_graph` →
  `casePlanVersionService.createPlanDraft()`
  (`server/src/services/caseWorkspace/casePlanVersionService.ts`)
- 9,000 `case_workspace_history_events` rows (→ 9,000 atomic
  `case_workspace_event_outbox` rows, EVENT_TAXONOMY.md §2) →
  `caseHistoryService.appendCaseHistoryEvent()`
  (`server/src/services/caseWorkspace/caseHistoryService.ts`)
- Outbox dispatch/drain, backlog reads, failure injection → the real
  `eventOutboxService.dispatchPendingEvents()` / `getOutboxBacklog()` /
  `subscribeToOutboxDelivery()`
  (`server/src/services/caseWorkspace/eventOutboxService.ts`)

The **only** direct `INSERT`s anywhere in this harness are the tenancy
prerequisite rows every other `*.pg.test.ts` file in this codebase already
seeds the same way — one `organizations` row, one `projects` row, one `users`
row, one `organization_members` row (`lib/fixtures.ts`, copying
`caseCoreService.pg.test.ts`'s own `seedOrgAndProject`/`seedUser`/`seedMember`
pattern verbatim). No `case_core`, `case_plan_versions`,
`case_workspace_history_events`, or `case_workspace_event_outbox` row was ever
written by anything other than the real service call. This satisfies the
owner's explicit instruction ("nie INSERT-em na skroty, chyba ze inaczej sie
nie da — wtedy napisz to jawnie") — nothing here needed the escape hatch.

### 1.2 The harness (own, fresh, disposable databases)

Per the owner's instruction, this harness never touches `case_workspace_test`
(shared with 30+ other `*.pg.test.ts` files and, per this task's own
briefing, up to **six other concurrently running agents**). For every run it:

1. `CREATE DATABASE cwperfprofile_<runId>` on the ambient Postgres instance
   (`server/src/services/caseWorkspace/__tests__/performance/lib/dbLifecycle.ts`);
2. runs `server/scripts/migrate.postgres.ts` against it as a **child
   process** (no `--safe` — a real migration failure fails the run loudly,
   never silently `skipped`);
3. verifies the exact tables this harness needs are present
   (`verifySchemaPresent()`) — never trusts the migration runner's exit code
   alone;
4. spawns `runProfileMain.ts` as **its own separate child process** against
   that one database (`orchestrate.ts` → `runChildProfile()`) — a fresh OS
   process per fresh database, because `databaseConfig`
   (`server/src/config/DatabaseConfig.ts`) and `withPgTransaction()`
   (`server/src/utils/queryHelpers.ts`) both bind to whatever `DATABASE_URL`
   they see at first use, for the lifetime of the process; reusing one
   process across databases would silently keep talking to the first one;
5. runs `NODE_OPTIONS=--expose-gc` so the post-GC heap snapshot is a real
   forced collection, not a no-op;
6. reads back the child's JSON result;
7. `DROP DATABASE ... WITH (FORCE)` — always, in a `finally`, even on failure.

Reproduce with (repo root):

```bash
DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
CW_PERF_ADMIN_DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
CW_PERF_RUN_COUNT=3 \
CW_PERF_CASE_COUNT=1000 CW_PERF_NODE_COUNT=250 CW_PERF_EDGE_COUNT=500 \
CW_PERF_EVENTS_PER_CASE=9 CW_PERF_CASE_CONCURRENCY=15 CW_PERF_EVENT_CONCURRENCY=15 \
CW_PERF_DISPATCH_BATCH_SIZE=200 CW_PERF_QUERY_REPS=25 CW_PERF_FAILURE_INJECTION=1 \
CW_PERF_OUT_DIR=/tmp/cw-perf-out \
npx tsx server/src/services/caseWorkspace/__tests__/performance/orchestrate.ts
```

`CW_PERF_ADMIN_DATABASE_URL` only needs to be a database this Postgres role
can already reach (used solely to issue `CREATE`/`DROP DATABASE`; the role
used in this session (`case_workspace`) has `rolcreatedb=true, rolsuper=true`
on the target instance — verified directly, not assumed).

### 1.3 The environment this ran on — and why "budgets" are not evaluated

Recorded automatically by every run (`lib/envInfo.ts`), from run 1 (all three
runs report the same machine, see §4):

| Field | Value |
|---|---|
| CPU | Apple M4 Max, 16 logical cores |
| RAM | 128 GB (20.9 GB free at start of run 1) |
| OS | macOS (Darwin 25.5.0), arm64 |
| Node | v24.12.0 |
| PostgreSQL | 16.14 (Debian, aarch64), local, port 55432 |
| Database | fresh, empty except this harness's own writes |

This is **well above** DoD-I's stated minimum comparable runner floor (4
vCPU / 16 GB). But DoD-I's freeze clause requires *exclusive, documented* use
of that runner and an explicit network-throttle profile (`CW-NET-1`) for the
**browser-route** p95/heap budgets (2.5 s route-to-interactive, 100 ms local
interaction, 1 s server-backed mutation, 20% browser-heap growth) — none of
which this backend-only harness can produce (there is no browser in this
harness's path; see §6). This session's task briefing states explicitly:
*"ROWNOLEGLE pracuje SZESC innych agentow modyfikujacych kod"* — six other
agents were concurrently running their own builds, test suites and (directly
observed via `pg_stat_activity`) their own fresh-schema Postgres migrations
against the **same physical Postgres server** for large stretches of this
session. Directly observed evidence of contention:

- an isolated, uncontended timing test of the exact same fresh-schema
  migration (`server/scripts/migrate.postgres.ts`, 812 files) run once on its
  own, before this section's three profile runs, took **~50 seconds**; the
  precisely-instrumented figure from the actual profile run 1 (§3,
  `migrationDurationMs` in the orchestrator's own summary JSON, not a manual
  clock reading) was **164.7 seconds** for the identical migration on the
  identical machine — a **3.3× slowdown** between an idle moment and a
  contended one, measured, not estimated;
- `pg_stat_activity` showed this harness's own migration connection blocked
  on `wait_event_type=IO, wait_event=DataFileImmediateSync` (fsync
  contention) for tens of seconds at a time during that contended window.

**Conclusion**: the raw p95/heap numbers below are real, reproducible-shaped
evidence of *this codebase's own query/heap behavior at 1,000/250/500/10,000
scale* (the actual point of the exercise), and the **three-run comparison in
§4** is the honest way to see how much the shared environment moved the
absolute numbers around. They are **not** compared against DoD-I's literal
2.5 s/100 ms/1 s/20% thresholds, because (a) those thresholds are specified
for a *browser route*, which this harness does not drive (§6), and (b) DoD-I
explicitly requires an *undocumented/contended* environment to be reported as
`EVIDENCE_MISSING`, not silently graded against the budget. A rerun on an
otherwise-idle instance of the *same* hardware class would be required before
any PASS/FAIL claim against those specific numbers.

## 2. Fixture actually produced (identical target across all 3 runs)

| Object | Requested | Produced (every run) |
|---|---|---|
| Cases | 1,000 | 1,000 |
| Plan nodes | 250 | 250 |
| Plan edges | 500 | 500 |
| History events | 9,000 (9/case × 1,000 cases) | 9,000 |
| Outbox rows after seed | — | **10,001** (9,000 history events + 1,000 `case.created` + 1 `case.plan.draft_created`, all via `EVENT_TAXONOMY.md` §2's one-outbox-row-per-command-per-aggregate rule) |
| Outbox rows delivered after drain | — | 10,001 (0 pending, 0 failed) — every run |

The plan graph (`lib/graphBuilder.ts`) is a single acyclic forward chain
`n0→n1→…→n249` (249 edges) plus 251 additional strictly-forward "skip" edges
— acyclic and fully reachable by construction, so it needs no separate cycle
check to satisfy `casePlanVersionService`'s own
`computeValidationBlockers()` invariants (`UNREACHABLE_NODE`,
`NO_TERMINAL_PATH`, `DUPLICATE_*`).

## 3. p95 / heap — three fresh runs

All three runs used the identical fixture (§2), the identical harness code,
back to back, on the same machine, each on its own fresh `cwperfprofile_*`
database, dropped immediately after. Raw JSON:
`perf-run-r1_1786394094418_c42746c3.json`, `perf-run-r2_1786394656385_bc72a748.json`,
`perf-run-r3_1786394931228_83d050f2.json` (paths under the `CW_PERF_OUT_DIR`
from §1.2's reproduction command; not committed — see §8).

Migration duration alone (fresh-schema, 812 files, before any of this
harness's own workload starts) — the clearest single number for how much
contention moved during this session: **run 1: 164.7 s, run 2: 20.3 s, run 3:
21.3 s.**

### 3.1 Seed-path latency (real service calls: `createCase` / `createPlanDraft` / `appendHistoryEvent`)

| Metric | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| `createCase` p50 (ms), n=1000 | 293.83 | 183.25 | 91.88 |
| `createCase` p95 (ms) | 558.98 | 683.38 | 150.58 |
| `createCase` p99 (ms) | 4929.93 | 2363.31 | 450.41 |
| `createPlanDraft` (ms), n=1, 250 nodes/500 edges | 216.43 | 40.04 | 27.94 |
| `appendHistoryEvent` p50 (ms), n=9000 | 345.13 | 139.73 | 71.93 |
| `appendHistoryEvent` p95 (ms) | 888.73 | 593.72 | 101.36 |
| `appendHistoryEvent` p99 (ms) | 1325.75 | 1033.49 | 114.90 |

### 3.2 Read-path p95 (real service calls, repeated 25× each against the fully-seeded 1,000-Case / 250-node-500-edge-Plan / 10,001-outbox-row database)

| Query | Run 1 p95 (ms) | Run 2 p95 (ms) | Run 3 p95 (ms) |
|---|---:|---:|---:|
| `listCasesForOrganization` (Case list — **unbounded**, §7 finding 1) | 136.27 | 441.28 | 14.40 |
| `getGraph`/`getPlanVersion` (Plan graph, 250 nodes/500 edges) | 75.62 | 245.49 | 6.29 |
| `listCaseHistoryEventsForCase` (history/timeline, `LIMIT 200`, cursor-capable) | 57.65 | 217.47 | 2.28 |
| `getOutboxBacklog` (pending-count gauge) | 30.68 | 280.54 | 8.27 |

### 3.3 Outbox dispatch (real `dispatchPendingEvents`, `batchSize=200`, draining all 10,001 rows)

| Metric | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| Batches | 52 | 52 | 52 |
| Batch p50 (ms) | 1929.97 | 1112.18 | 100.05 |
| Batch p95 (ms) | 5293.95 | 5050.62 | 204.39 |
| Batch p99 (ms) | 6359.82 | 6174.64 | 264.92 |
| Total wall time to drain (s) | 115.33 | 91.28 | 5.71 |
| Effective throughput (events/s) | 86.71 | 109.56 | 1751.87 |
| Delivered / failed | 10001 / 0 | 10001 / 0 | 10001 / 0 |

### 3.4 Heap (this Node.js harness process, forced GC via `--expose-gc`)

| Metric | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| Baseline heap used (MB) | 15.94 | 15.95 | 16.01 |
| Post-seed heap used (MB) | 65.73 | 74.45 | 31.45 |
| Post-queries heap used (MB) | 56.25 | 64.13 | 26.03 |
| Post-forced-GC heap used (MB) | 16.54 | 16.56 | 16.41 |
| **Growth, baseline → post-GC** | **+5.08%** | **+3.82%** | **+2.50%** |

All three: well inside the DoD-I 20% ceiling for this metric — though again,
this is a *server-harness-process* heap number, not the browser-tab heap
`CW-DOD-I4` is actually about (§6). The consistent, small, single-digit
growth across three independent fresh processes at identical fixture size is
still a meaningful data point: it says the seed/query/dispatch code paths
exercised here do not leak in an obvious, growing-without-bound way at this
scale, in this process.

`growthPctBaselineToPostGc` is `(postGcHeapUsedMB − baselineHeapUsedMB) /
baselineHeapUsedMB`, measured on **this Node.js harness process**, forced
through `global.gc()` (`--expose-gc`), after seeding 1,000 Cases + 1 250/500
Plan + 9,000 events + 25× each read query + a full outbox drain. This is a
*server-process* heap number, not the DoD-I `CW-DOD-I4` **browser-heap**
number — see §6 for why the literal 30-minute browser Run is
`EVIDENCE_MISSING`, not measured here.

## 4. Determinism across the three runs

Two very different kinds of "determinism" have to be kept separate here, and
the raw numbers make the difference obvious rather than requiring a judgment
call:

### 4.1 Correctness / outcome determinism: **perfect, all three runs**

| Field | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| Cases created | 1000 | 1000 | 1000 |
| Plan nodes / edges | 250 / 500 | 250 / 500 | 250 / 500 |
| History events created | 9000 | 9000 | 9000 |
| Outbox rows total | **10001** | **10001** | **10001** |
| Outbox rows delivered / pending / failed | 10001 / 0 / 0 | 10001 / 0 / 0 | 10001 / 0 / 0 |
| Failure-injection: delivered during crash / duplicate event_ids on recovery | 0 / 0 | 0 / 0 | 0 / 0 |
| Harness-reported `errors[]` | `[]` | `[]` | `[]` |

Every count that the code is actually responsible for is bit-identical
across three independent fresh databases. This is the determinism claim the
owner's instruction is actually protecting against ("duza rozbieznosc =
znalezisko") — a divergence HERE (a different outbox row count, a duplicate
event id, a lost event) would be the real finding. There is none.

### 4.2 Absolute latency: **not tight — and the reason is external, not the code under test**

| Metric | Run 1 | Run 2 | Run 3 | Spread (max vs min) |
|---|---:|---:|---:|---:|
| Migration duration (s) | 164.7 | 20.3 | 21.3 | **8.1×** |
| `listCasesForOrganization` p95 (ms) | 136.27 | 441.28 | 14.40 | **30.6×** |
| `getGraph` p95 (ms) | 75.62 | 245.49 | 6.29 | **39.0×** |
| `listCaseHistoryEventsForCase` p95 (ms) | 57.65 | 217.47 | 2.28 | **95.3×** |
| Dispatch batch p95 (ms) | 5293.95 | 5050.62 | 204.39 | **25.9×** |
| Heap growth, baseline→post-GC | +5.08% | +3.82% | +2.50% | 2.0× (all comfortably under budget) |

This is a **large** spread by the raw numbers, and reporting it honestly
(rather than picking the best run, or averaging it away) is the entire point
of running three times. It correlates directly with the independently
observed migration-duration numbers (run 1 ran during the heaviest
cross-agent contention window of this session — see §1.3's `pg_stat_activity`
evidence of `DataFileImmediateSync` waits during exactly this run; run 3 ran
last, after several other agents' own heavy migration/build activity had
quieted). **The finding this comparison actually supports is not "the code is
slow" — it is "this shared six-agent environment is not a valid instrument
for measuring absolute latency against a fixed budget."** Rerunning this same
harness on an exclusively-owned instance of comparable hardware, per DoD-I's
own environment-freeze clause, is required before any of these numbers can be
read as a latency verdict on the code. What the comparison DOES license: ONE
relative fact held in every single run without exception —
`listCasesForOrganization` was the SLOWEST of the four read queries in all
three runs (136.27 ms / 441.28 ms / 14.40 ms — always the highest of its own
run's four). That is not noise; it is the one query with no `LIMIT`/cursor at
all (§7 finding 1) scanning and JSON-parsing its entire 1,000-row result set
on every call, while the other three either read a bounded page
(`listCaseHistoryEventsForCase`, `LIMIT 200`) or a single row
(`getGraph`/`getPlanVersion`) or a `count(*)` (`getOutboxBacklog`). The
relative ordering of THOSE other three, by contrast, is **not** stable
across runs (`getOutboxBacklog` ranks lowest of the four in run 1 but
third-of-four in run 2) — at this row count the gap between them is small
enough that contention noise, not a real cost difference, decides the order;
only `listCasesForOrganization`'s gap is large and consistent enough to
trust (see §7).

## 5. Failure injection — what happens mid-dispatch

**Method** (`lib/runProfile.ts`'s `runFailureInjection()`, run once per
profile, after the main backlog was already fully drained so the probe batch
is isolated): seed 24 fresh probe events on one Case through the real
`appendCaseHistoryEvent()` API (event_type
`CW_PERF_FAILURE_INJECTION_PROBE`); register a real
`subscribeToOutboxDelivery()` consumer; call the real
`dispatchPendingEvents({batchSize: 24})`; when the consumer sees the 13th
event in delivery order (the middle of the batch — chosen so several rows
would already have been processed by earlier consumer calls inside the same
still-open transaction), it looks up the exact backend PID holding that
transaction via `pg_stat_activity` (`state='idle in transaction'`) and issues
a real `SELECT pg_terminate_backend(pid)` against it — a genuine mid-batch
connection kill, not a simulated one — then throws.

**Result (identical shape across all three runs, see raw JSON):**

```json
"crashAttempt": {
  "dispatchRejected": true,
  "rejectionMessage": "Client has encountered a connection error and is not queryable",
  "deliveredAfterCrash": 0,
  "attemptCountAfterCrash": 0,
  "crashAlsoLeakedAsUnlistenedClientErrorEvent": true
},
"recoveryAttempt": { "claimed": 24, "delivered": 24, "failed": 0 },
"finalState": { "totalProbeRows": 24, "deliveredProbeRows": 24, "duplicateEventIds": 0 }
```

**What this proves, in plain terms:**

1. **The outbox's own atomicity claim holds under a real crash.**
   `dispatchPendingEvents()` runs the whole claimed batch inside ONE
   transaction. Killing the connection mid-batch rolled back **everything**
   — including the rows the consumer handler had already "delivered" earlier
   in the same loop iteration, before the poison row — `deliveredAfterCrash`
   is `0`, not some partial number. `attemptCountAfterCrash` is also `0`: the
   very `UPDATE delivery_attempt_count = delivery_attempt_count + 1` the
   `catch` block tries to run for the poison row *itself* fails (the
   connection is already dead), so not even that bookkeeping survives. On
   retry, the same 24 rows are re-claimed from scratch and all 24 deliver
   cleanly, with **zero duplicate `event_id`s** (`event_id PRIMARY KEY` +
   `ON CONFLICT DO NOTHING` on the producer side is what guarantees that —
   see `eventOutboxService.ts`'s own header). This is the correct,
   documented design working as designed.

2. **But the guarantee is DB-row atomicity, not consumer-side-effect
   idempotency across a crash-retry.** Any registered `subscribeToOutboxDelivery`
   handler that already ran a real external side effect (sent an email,
   called a webhook) for one of the rows *before* the poison row in that same
   doomed batch **will run again** when the batch is retried from scratch —
   the DB state says those rows were never delivered (correctly, since the
   transaction rolled back), but the handler already fired once, outside the
   transaction, before the crash. This is not a bug in `eventOutboxService.ts`
   — it is the correct, unavoidable shape of "at-least-once delivery", and
   it means every current/future `subscribeToOutboxDelivery` consumer in
   this codebase needs its OWN idempotency key (most durable-event consumers
   need this regardless of outbox implementation) — worth a line in whatever
   consumer-authoring guide accompanies this outbox going forward.

3. **A real, separate, previously-unreported defect: the connection kill also
   crashes the whole Node process, not just the one dispatch call.**
   `crashAlsoLeakedAsUnlistenedClientErrorEvent: true` on every run.
   `withPgTransaction()` (`server/src/utils/queryHelpers.ts:225-261`) opens
   its own bare `pg.Client` and never attaches an `.on('error', …)` listener
   to it. node-postgres's documented behavior
   (https://node-postgres.com/apis/client#events — "it's important... to
   always add a listener error"): when the underlying connection dies, the
   `Client` both rejects the in-flight query (the path this harness's own
   `try/catch` observes, correctly) **and** re-emits `'error'` on itself; an
   `EventEmitter` `'error'` event with zero listeners is a Node.js
   `uncaughtException` by default. **This harness only survives it because it
   installs a temporary, narrowly-scoped `process.on('uncaughtException', …)`
   guard around exactly this call** (`lib/runProfile.ts`,
   `runFailureInjection()`) — a real server process running
   `dispatchPendingEvents()` (via `outboxWorker.ts`'s interval loop, once it
   is wired into `server/src/index.ts` — see the note below) has no such
   guard today and **would crash the entire process**, not just fail one
   dispatch tick, the moment its Postgres connection drops mid-batch for any
   reason (network blip, DB failover, `pg_terminate_backend` from an
   operator, statement_timeout kill, etc.). This is a genuine finding this
   packet did not go looking for — it fell out of doing the failure
   injection for real instead of only reasoning about it. **Out of this
   packet's allowlist to fix** (`queryHelpers.ts` is shared code, not under
   `__tests__/performance/**`); flagging for the coordinator.

4. **A second, adjacent finding, also fell out of just reading the code while
   building this harness, not from running it:**
   `startCaseWorkspaceOutboxWorker()` (`server/src/services/caseWorkspace/outboxWorker.ts:221`)
   — the only production caller of `dispatchPendingEvents()` outside a test —
   is **not called anywhere in `server/src/index.ts`** (verified:
   `grep -rn "startCaseWorkspaceOutboxWorker" server/src --include="*.ts"`
   outside `__tests__/` returns only the function's own definition and its
   own doc-comment). `outboxWorker.ts`'s own header already says this
   explicitly ("this file therefore does not call itself; the production
   call site to add... is: `server/src/index.ts`"). Combined with finding 3:
   right now, in this checkpoint, nothing in a running server process drains
   `case_workspace_event_outbox` at all, so every one of the throughput
   numbers in §3 describes a capability that exists and is correct, but is
   **not yet reachable by a live deployment** — the backlog would only ever
   shrink via a manually-invoked test or script. This is exactly the kind of
   fact `CW-DOD-I6` ("stuck leases... capability health are observable")
   depends on being wired up to mean anything operationally; it is currently
   `NOT_IMPLEMENTED` for the same reason.

## 6. The 30-minute active-Run / browser-heap requirement — `EVIDENCE_MISSING`

DoD-I / `CW-DOD-I4`: *"A 30-minute active Run has no unbounded DOM/event
growth and no more than 20% browser-heap growth after GC from the post-load
baseline."*

**Literal status: `EVIDENCE_MISSING`.** Reason, stated plainly rather than
approximated:

- This packet's allowlist is `server/src/services/caseWorkspace/__tests__/performance/**`
  and this one doc file — no browser, no frontend build, no E2E harness, no
  `server/src/index.ts` wiring. There is no rendered Case Workspace UI, no
  browser tab, and no DOM in this packet's reach at all — "DOM/event growth"
  and "browser-heap" are properties of a page this harness never opens.
- A genuine 30-minute **browser** Run needs the live frontend + backend stack
  (`docs/product/case-workspace/LIVE_STACK_RUNBOOK.md`) driven by real browser
  automation for 30 continuous minutes, sampling `performance.memory`/DevTools
  heap snapshots — a different kind of harness than this one, out of this
  packet's scope and, at 30 real minutes of exclusive browser automation, a
  materially different time budget than this packet was given.
- This was **not attempted and quietly reported as inconclusive** — it was
  not attempted at all, and that is stated here explicitly rather than
  filled in with an adjacent number that looks similar (the §3.4 server-heap
  number above is a different measurement of a different process and must
  not be read as a substitute).

**What this packet DID instead, as a clearly-labeled, clearly-insufficient
supplement**, is available via `CW_PERF_SOAK_MS` on the same harness (a
bounded server-side soak: repeated real `listCasesForOrganization` calls
against a freshly-seeded 300-Case / 250-node-500-edge-Plan / 1,201-outbox-row
database, sampling this Node process's heap every ~25 s) — see
`lib/runProfile.ts`'s `runSoak()`. One 5-minute run was actually executed
(not merely described):

| Field | Value |
|---|---:|
| Duration requested / actual | 300,000 ms / 300,000.78 ms |
| `listCasesForOrganization` calls completed | **70,753** (≈236/s — this instance ran with comparatively little cross-agent contention, see §1.3) |
| `listCasesForOrganization` p50 / p95 / p99 (ms) | 3.56 / 6.92 / 18.56 |
| Heap used (MB), sampled every ~25 s over the 5 minutes | oscillated 16.08 → 57.84 → 18.56 → 52.54 → 19.96 → 47.74 (min 16.08, max 57.84) |
| RSS (MB) | rose from 188.9 to a plateau around 290-343, no further growth in the back half of the window |

The heap trace shows normal GC sawtooth behavior (repeated rises and falls,
same order of magnitude throughout, 70,753 identical calls producing no
monotonic climb) — **not** the unbounded-growth shape `CW-DOD-I4` is
guarding against. This is genuinely reassuring about this one code path
(`listCasesForOrganization`, called in a tight loop) not leaking on the
Node/backend side. It is **explicitly not** a substitute for `CW-DOD-I4`:
it exercises a different runtime (Node backend, not a browser tab), a
different growth mechanism (one repeated read call, not a live user session
accumulating DOM nodes/event listeners/subscriptions across many distinct
interactions), and a fixed 5, not 30, minutes. It is included only because
running it was cheap once the harness existed, not because it closes the
`CW-DOD-I4` gap.

**What closing this gap for real requires**: the live stack per
`docs/product/case-workspace/LIVE_STACK_RUNBOOK.md`, a browser automation
tool attached to a rendered Case Workspace session, 30 continuous minutes of
scripted interaction against the 1,000-Case / 250-node-500-edge-Plan fixture
this harness already knows how to build (the seeded database from any one of
the three runs above could be kept alive — instead of dropped — and pointed
at by the live stack's `DATABASE_URL` for exactly this purpose), and either
Chrome DevTools Protocol heap sampling or `performance.memory` polling at a
fixed interval, with a forced GC (`--expose-gc` equivalent for a browser
tab is DevTools' own "Collect garbage" button / CDP `HeapProfiler.collectGarbage`)
immediately before the final sample.

## 7. Bottlenecks found, with the exact query

Ranked by how directly they threaten `CW-DOD-I2`/`I5` (1,000-Case scale,
paginated lists) as case/event volume grows past this profile's fixture size:

1. **`caseCoreService.listCasesForOrganization()` has no pagination or limit
   at all** (`server/src/services/caseWorkspace/caseCoreService.ts:942-968`):
   `` `SELECT * FROM case_core WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC` ``
   — no `LIMIT`, no cursor, every call returns the ENTIRE tenant's Case set.
   At exactly the frozen fixture size (1,000 Cases) this already reads back
   every row on every call — see §3 for the actual per-run p95 — and it will
   grow **linearly, unbounded**, past 1,000. This is not a new finding: the
   coordinator's own ledger already carries it as `CW-DOD-I5` = `PARTIAL`
   (`docs/product/case-workspace/acceptance/API_EVENT_SCHEMA_COVERAGE.csv`,
   row `CW-DOD-I5`: *"CURSOR-PAGINATED: 1 of the ~22 list endpoints... Every
   other list returns a plain array"*) — this profile is the first time it
   has been measured under load rather than just flagged by inspection, and
   confirms it is real, not theoretical.

2. **`withPgTransaction()` opens a brand-new `pg.Client` (full connect +
   auth handshake) on every single call**, never a pooled connection
   (`server/src/utils/queryHelpers.ts:225-261`, see that function's own
   docblock — this is deliberate, to guarantee one pinned connection per
   transaction, not an oversight). Every `caseCoreService.createCase()` and
   every `caseHistoryService.appendCaseHistoryEvent()` call goes through it,
   while the four read-path queries in §3.2 all go through
   `queryOne`/`queryAll` (`server/src/utils/queryHelpers.ts`), which use
   `getDatabase()`'s own already-open connection **pool**. In every one of
   the three runs, both write-path calls (§3.1: `createCase`, 1000 calls;
   `appendHistoryEvent`, 9000 calls) show a p95 that is a low multiple of
   their own run's p50 with a materially heavier p99 tail (e.g. run 1:
   `createCase` p50 293.83 ms → p99 4929.93 ms, a 16.8× tail) — consistent
   with per-call connection-setup cost occasionally queuing behind other
   concurrent connection attempts, a cost the pooled read path does not pay.
   At the concurrency this harness used (15) this overhead is the most direct
   explanation available for why seeding throughput, not row-insert cost,
   bounded how fast 1,000 Cases / 9,000 events could be produced. §5's
   finding 3 (the unlistened `'error'` listener) traces to this exact same
   helper function.

3. **`dispatchPendingEvents()` batch latency has a long tail and the outbox
   worker that would call it repeatedly is not wired into the running
   server** — see §5, findings 3-4. The measured drain throughput (§3,
   `eventsPerSecond`) describes a code path that is correct but currently
   unreachable outside a test process.

## 8. What this evidence is, and is not

- **Is**: real p95/heap/throughput numbers from the real service API at the
  frozen fixture scale, on real (if contended) hardware, three times, with a
  real mid-transaction crash injected and its exact recovery behavior proven
  against actual Postgres state (not reasoned about).
- **Is not**: a PASS/FAIL verdict against DoD-I's literal browser-route
  latency budgets (§1.3) or against `CW-DOD-I4`'s browser-heap requirement
  (§6, `EVIDENCE_MISSING`) — both need instruments and scope this packet's
  allowlist does not include.
- **Is not**: a fix for any of the three findings in §5/§7 — flagged for the
  coordinator, not remediated here (out of this packet's allowlist).

Raw per-run JSON (all fields, not just the tables above) is retained at
`CW_PERF_OUT_DIR` from the reproduction command in §1.2 — not committed to
the repository (run artifacts, not source; regenerate with the command
above from the same checkpoint to reproduce byte-for-byte-comparable output
modulo timestamps/ids).

---

## 9. CW-T-E / B4 update — outbox worker dead-letter, recovery, observability, performance

> Packet: CW-T-E, B4 ("WYDAJNOSC, DEAD-LETTER I OBSERVABILITY WORKERA").
> Checkpoint under test: `292bafd4e8` (`HEAD` at the time this section was
> written — genuinely newer than §1-§8's `cbfd32a48a`; between the two,
> `startCaseWorkspaceOutboxWorker()` was wired into `server/src/index.ts` by
> the session coordinator — verified directly: `grep -n
> "startCaseWorkspaceOutboxWorker" server/src/index.ts` returns two real call
> sites, lines 1864-1867, not just the function's own definition).
> Allowlist for this section: `server/src/services/caseWorkspace/outboxWorker.ts`,
> `server/src/services/caseWorkspace/__tests__/integration/outboxWorker.pg.test.ts`,
> `server/src/services/caseWorkspace/__tests__/perf/**` (a DIFFERENT,
> narrower directory than §1-§8's `__tests__/performance/**`), and this file.
> `eventOutboxService.ts` and `server/migrations/**` are out of allowlist —
> called, never edited.

### 9.1 What changed in `outboxWorker.ts`, and why

The pre-existing worker (§5 finding 4's own subject) already had a correct
interval loop and an accurate per-tick metrics snapshot; this packet added
what B4's brief asked for, entirely inside `outboxWorker.ts`'s own
orchestration layer (no change to `eventOutboxService.ts`'s claim/retry/
dead-letter SQL, which was already correct and is out of this packet's
allowlist):

1. **Tick-cadence exponential backoff** (`getOutboxWorkerMetrics().currentBackoffMultiplier`,
   1x→2x→4x→8x, capped, resets to 1x on the next clean tick). Explicitly
   NOT per-row backoff — `case_workspace_event_outbox` has no
   `next_retry_at` column, and adding one would mean editing
   `eventOutboxService.ts`'s schema/SQL, out of allowlist. This is stated
   plainly rather than implied to be more than it is.
2. **Stuck-tick watchdog** (`tickTimeoutMs`, `OutboxWorkerTickResult.timedOut`,
   `getOutboxWorkerMetrics().stuckTicks`): a durable consumer
   (`subscribeToOutboxDelivery`) whose promise never settles — e.g. a
   webhook call with no timeout of its own — used to be able to wedge the
   interval loop forever (`tickInFlight` never clears under the OLD
   `setInterval` design). `runOutboxWorkerTick()` now races the real
   dispatch against a timer; the loop is guaranteed to keep making progress,
   and the real outcome is still applied to cumulative metrics whenever the
   slow call eventually settles (see the function's own header for exactly
   what is and is not cancellable — nothing in Node/Postgres can truly
   cancel an in-flight await).
3. **Queue lag in TIME, not just row count** (`oldestPendingAgeSeconds`,
   sourced from `eventOutboxService.getOutboxBacklog()`'s own
   `oldestPendingAgeSeconds`, which existed already but was not previously
   surfaced through the worker's tick result/metrics).
4. **Rolling tick-duration p50/p95** (`tickDurationMsP50`/`tickDurationMsP95`,
   last 50 ticks) — a delivery-latency proxy.
5. **Reconciliation sweep** (`runOutboxReconciliationSweep()`,
   `getOutboxWorkerMetrics().lastDeadLetterSample`/`lastReconciliationAt`):
   samples the ACTUAL dead-lettered rows (event id, type, attempt count,
   last error), not just the count `deadLetterCount` already gave. The
   interval loop runs it automatically every `reconciliationEveryNTicks`
   (default 12) clean ticks.

### 9.2 Dead-letter / recovery / observability — proved against the real database

`server/src/services/caseWorkspace/__tests__/integration/outboxWorker.pg.test.ts`,
run against `postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test`
(command: see the file's own header) — **9/9 passed**, no unhandled errors,
2.9-4.8s wall clock across repeated runs:

```
DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
npx vitest run \
src/services/caseWorkspace/__tests__/integration/outboxWorker.pg.test.ts \
--environment node
```

| # | Case | What it proves | Real DB mechanism |
|---|---|---|---|
| 1 | Tick metrics | `runOutboxWorkerTick()` return value and `getOutboxWorkerMetrics()` agree with Postgres | real dispatch, real read-back |
| 2 | Failure injection + dead-letter | a permanently-failing consumer drives a row to `DEAD_LETTER_ATTEMPT_THRESHOLD` (10) attempts, then the worker stops claiming it, durably | real retries, real `listDeadLetterEvents`/`countDeadLetterEvents` |
| 3 | Concurrent delivery | two ticks racing the same batch never double-deliver | real `FOR UPDATE SKIP LOCKED` |
| 4 | Restart recovery | a fully-stopped-and-reset worker instance, then a fresh start, recovers what was published while down, with no redelivery of what already went out | real stop/start, real Postgres state read back |
| 5 (new, B4) | **Stuck lease recovery** | a claiming transaction that never commits (simulated crash) does not block OTHER rows (`SKIP LOCKED`), and once its backend is killed with a real `pg_terminate_backend()`, the very next tick recovers its row **immediately — no lease-expiry wait of any kind**, because this design has no lease column to expire in the first place | real `pg_terminate_backend()`, real lock release |
| 6 (new, B4) | **Tick watchdog** | a durable consumer hung past `tickTimeoutMs` does not block `runOutboxWorkerTick()` from returning (`timedOut=true`, `elapsedMs < 2s` even though the handler was still hanging), `stuckTicks` increments, and the late real outcome still lands in cumulative metrics once the handler is released | real timer race against a real DB call |
| 7 (new, B4) | **Adaptive backoff** | `currentBackoffMultiplier` doubles 1→2→4 across two consecutive failing ticks, resets to 1 on the next clean tick | real failing/succeeding dispatch |
| 8 (new, B4) | **Reconciliation sweep** | `runOutboxReconciliationSweep()` returns the actual dead-lettered row (event id, type, `deliveryAttemptCount=10`, `lastDeliveryError` containing the real thrown message) and mirrors it onto `getOutboxWorkerMetrics()` | real dead-letter row read back |
| 9 (new, B4) | **Queue lag in time** | `oldestPendingAgeSeconds` is `null` idle, `>= 1` after a row has aged past 1s, `null` again once drained | real `EXTRACT(EPOCH FROM (now() - min(created_at)))` |

**Negative controls performed on the two genuinely new pieces of worker logic**
(sabotage → confirm red → revert → confirm green again, evidence not merely
described):

- Backoff: hard-coded `backoffMultiplier = 1` unconditionally in
  `applyTickResultToMetrics` → test 7 failed with `AssertionError: expected 1
  to be 2` → reverted → full suite green again (9/9).
- Watchdog: forced `runOutboxWorkerTick()` to always `return bodyPromise`
  regardless of `tickTimeoutMs` → test 6 failed with `Error: Test timed out
  in 15000ms` (the hung handler genuinely blocked it, proving the watchdog
  is what prevents that in the real code) → reverted → full suite green
  again (9/9).

Test 5 (stuck lease recovery) was not sabotaged the same way — it mostly
proves an intrinsic Postgres/`SKIP LOCKED` property this file does not
implement itself (see `runOutboxWorkerTick`'s own doc comment on why there
is no lease column at all); tests 2 and 3 above already establish
`SKIP LOCKED`'s behavior under sabotage-free real crash/concurrency
conditions.

### 9.3 Performance — measured against DoD-I's own cited volumes

DoD-I's literal text (`14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md`
lines 329-354), quoted for the canon-vs-result comparison table below:

> "SPEC-L remains operable with 1,000 Cases, Plan with 250 nodes/500 edges,
> and timeline with 10,000 events using pagination or virtualization."
>
> "On recorded standard test hardware, warm p95 route-to-interactive is
> <= 2.5 s, p95 local interaction response <= 100 ms and p95 server-backed
> mutation feedback <= 1 s under a recorded throttled-network profile."
>
> "A 30-minute active Run has no unbounded DOM/event growth and no more than
> 20% browser-heap growth after GC from the post-load baseline."
>
> "Projection lag, stuck leases, waits, retries and capability health are
> observable."
>
> "Reconnect/cold reopen converges to authoritative server state."
>
> "Failure injection proves recovery without duplicate effects."

`server/src/services/caseWorkspace/__tests__/perf/outboxThroughput.perf.pg.test.ts`
(NEW harness for this packet — a different, narrower file from §1-§8's
`__tests__/performance/**`), run against the same real database, with
`NODE_OPTIONS=--expose-gc` for a real forced-GC heap floor:

```
DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
NODE_OPTIONS=--expose-gc \
npx vitest run \
src/services/caseWorkspace/__tests__/perf/outboxThroughput.perf.pg.test.ts \
--environment node
```

**3/3 passed.** Real evidence lines (unconditionally printed by the suite,
not gated behind a flag), from a run with comparatively little cross-agent
contention at the moment it ran (contention is disclosed, not hidden — see
§1.3's own finding that this shared environment moves absolute numbers by up
to 95x run to run; a SECOND run minutes later, also captured below, shows
exactly that variance on the same fixture):

| Metric (DoD-I canon volume) | DoD-I canon threshold | Run A (low contention) | Run B (same session, minutes later) |
|---|---|---:|---:|
| Outbox drain, 10,000 events / 1,000 Cases, `dispatchPendingEvents` batch=500 | "timeline with 10,000 events ... observable" | seedMs=1598, drainWallClockMs=81219, **123.1 events/s**, tick p50=3313ms p95=7690ms p99=8680ms | seedMs=390, drainWallClockMs=6056, **1651.3 events/s**, tick p50=294ms p95=330ms p99=446ms |
| `getOutboxBacklog()` read at full 10,000-row backlog | "projection lag ... observable" | 205ms | 16ms |
| `publishEvent()` commit latency, n=200, DB-transaction floor of "p95 server-backed mutation feedback <= 1 s" | <= 1000ms (full-stack; this is a lower-bound proxy only, see §1.3-equivalent caveat below) | p50=76ms p95=190ms p99=240ms | p50=9ms p95=11ms p99=12ms |
| Heap, draining 10,000 events through the REAL `outboxWorker.runOutboxWorkerTick()` path, forced GC (`--expose-gc`) | "no more than 20% browser-heap growth after GC" (a browser-tab metric; this is the server-process analogue, see caveat below) | baseline=16.51MB → postDrain(GC)=18.93MB, **+14.71%** | baseline=18.48MB → postDrain(GC)=18.11MB, **-2.03%** |
| `getOutboxWorkerMetrics()` accuracy at 10,000-event volume (worker path) | "capability health are observable" | `totalClaimed=totalDelivered=10000`, `totalFailed=0`, `oldestPendingAgeSeconds=null` post-drain, `tickDurationMsP50=307` `P95=342`, `stuckTicks=0` | `totalClaimed=totalDelivered=10000`, `totalFailed=0`, `oldestPendingAgeSeconds=null` post-drain, `tickDurationMsP50=296` `P95=326`, `stuckTicks=0` |

**Same environment caveat as §1.3, restated for THIS section rather than
assumed carried over**: this ran on a shared worktree with multiple other
concurrently active agent sessions on the same physical Postgres instance
(per this packet's own task briefing), not DoD-I's frozen/exclusive 4 vCPU /
16 GB runner with the `CW-NET-1` network-throttle profile. The 30.6x-95.3x
run-to-run spread §4 already documented for the sibling `__tests__/performance/**`
harness is visibly the same phenomenon here (Run A vs Run B above: an 8-13x
spread on the identical fixture, minutes apart). **These numbers are real,
reproducible-SHAPE server-side evidence at the exact DoD-I-cited volumes for
THIS packet's scope (the outbox event spine, via the actual worker call
path) — they are explicitly NOT a DoD-I browser-route p95/heap PASS/FAIL
verdict**, for the same two reasons §1.3 already gives: the cited latency
budgets are UI-route budgets this harness does not drive, and the
environment is not the frozen/exclusive one DoD-I's freeze clause requires.

**30-minute active Run (`CW-DOD-I4`, browser DOM/event growth + heap):
`EVIDENCE_MISSING`, unchanged from §6.** This packet's allowlist is
`server/src/services/caseWorkspace/{outboxWorker.ts,__tests__/integration/**,__tests__/perf/**}`
plus this doc — no browser, no frontend, no 30-continuous-minute harness is
reachable from here either. Not attempted, not approximated, stated plainly.

### 9.4 A genuine finding from actually running this, not reasoned about: outbox rows can never be deleted, by anyone, and no test/production cleanup exists

Discovered while writing this packet's own tests' teardown, then confirmed
directly against Postgres (`DELETE FROM case_workspace_event_outbox WHERE
organization_id = '…'` → `case_workspace_event_outbox is append-only: DELETE
is not permitted`):

`server/migrations/20260810f_case_workspace_append_only_guards.sql` — landed
by a SIBLING packet, between this section's checkpoint and §1-§8's, out of
this packet's own allowlist — added a real, unconditional `BEFORE DELETE`
trigger on `case_workspace_event_outbox` (correctly enforcing §9's own
audit-survives guarantee: the table is append-only FACTS, with only
`delivered_at`/`delivery_attempt_count`/`last_delivery_error` ever mutable).
This is almost certainly the CORRECT production behavior for an audit
outbox — but it has two consequences worth the coordinator's attention:

1. **Every `*.pg.test.ts` file in this repo that writes to
   `case_workspace_event_outbox` and tries to clean up after itself with a
   `DELETE ... .catch(() => undefined)` — including this packet's own two
   test files, and the pre-existing `outboxWorker.pg.test.ts` tests 1-4 —
   has had that cleanup silently fail (swallowed by the `.catch`) since this
   migration landed.** Test correctness is unaffected here (every org id in
   this packet's tests is a fresh `randomUUID()`, so accumulation cannot
   collide with a later run), but `case_workspace_test` now grows
   PERMANENTLY, unboundedly, on every test run that has ever touched this
   table since the migration landed — this session alone left tens of
   thousands of orphaned rows across dozens of organization ids (directly
   counted: `SELECT organization_id, count(*) FROM
   case_workspace_event_outbox WHERE organization_id LIKE 'cwperf-%' OR
   organization_id LIKE 'cwworker-org-%' GROUP BY organization_id` returned
   100+ distinct orgs, several with 8,000-10,000 rows each, from this
   session's own and other concurrent agents' test runs).
2. **The same trigger applies in production.** Nothing in
   `eventOutboxService.ts` (already correctly delivery-append-only by
   design) or anywhere else in this codebase archives, partitions or purges
   OLD, ALREADY-DELIVERED outbox rows — `delivered_at IS NOT NULL` rows stay
   in the live table forever. At DoD-I's own cited "10,000 events" scale
   this is a rounding error; over a real deployment's lifetime it is an
   unbounded-growth risk to exactly the query this section measured as cheap
   at 10,000 rows (`getOutboxBacklog`'s `count(*)`/`min(created_at)` over a
   PARTIAL index on undelivered rows only stays cheap because it is
   partial — but `dispatchPendingEvents`'s own claim query and any future
   `replayEventsForAggregate` call scan/filter the FULL table). Not fixed
   here — `eventOutboxService.ts` and `server/migrations/**` are both
   outside this packet's allowlist, and a retention/archival policy is a
   product decision, not something to invent unilaterally inside a
   dead-letter/observability packet. Flagged for the coordinator as a
   genuine DoD-I-relevant, previously-undocumented finding.

### 9.5 Literal top-line status for this section

| Requirement (B4 scope) | Result |
|---|---|
| Automatic retry with backoff | **PARTIAL, stated precisely**: per-row retry already existed and is correct (`eventOutboxService.ts`, unchanged); **tick-cadence** backoff (this packet's own addition) is **DONE** and proved (§9.2 case 7); **per-row** backoff is **not implemented** — would require a schema/SQL change outside this packet's allowlist, stated explicitly rather than glossed over |
| Dead-letter after N attempts | **DONE** (pre-existing, `DEAD_LETTER_ATTEMPT_THRESHOLD=10`), now also surfaced with the actual rows via `runOutboxReconciliationSweep()` — **DONE**, new |
| Reconciliation | **DONE**, new (§9.1 point 5, §9.2 case 8) |
| Restart does not lose or duplicate the effect | **DONE** (pre-existing, §9.2 case 4) |
| Stuck lease recovery | **DONE, with a caveat stated precisely**: this design has NO lease column to recover from expiry — proved instead that a crashed claiming transaction releases its locks immediately (§9.2 case 5) and that a hung IN-PROCESS consumer no longer wedges the worker loop (§9.2 case 6, this packet's own new watchdog) |
| Metrics (queue lag, failure count, delivery latency) via `getOutboxWorkerMetrics()` | **DONE** — `oldestPendingAgeSeconds` (queue lag in time, new), `deadLetterCount`/`totalFailed` (failure count, pre-existing + new cumulative), `tickDurationMsP50`/`P95` (delivery-latency proxy, new); all proved live at 10,000-event volume in §9.3 |
| 1,000 Cases / 250 nodes-500 edges / 10,000 events performance, p95, heap | **DONE for the outbox slice of this volume** (§9.3) — §1-§8 already cover the Case/Plan-graph slice; NOT re-measured here (out of this packet's allowlist, and would duplicate §2-§3 rather than add evidence) |
| 30-minute active Run | **`EVIDENCE_MISSING`**, same reason as §6, not attempted |
