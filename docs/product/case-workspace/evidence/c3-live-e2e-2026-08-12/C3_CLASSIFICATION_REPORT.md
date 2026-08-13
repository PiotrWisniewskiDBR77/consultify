# C3 — Live E2E three-way classification (2026-08-12)

Packet C3. Worker, not coordinator. Production code is read-only for this
packet — no fixes were made here, only measurement and classification.

## 0. Backend identity + health (verified before any test ran)

```
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/health
200

$ curl -s http://127.0.0.1:3001/api/health
{"status":"ok","timestamp":"2026-08-12T07:17:06.513Z","database":"connected",
 "version":"1.0.0","environment":"development","dbResponseTime":4,"redis":"connected"}

$ lsof -i :3001 -sTCP:LISTEN -P
COMMAND   PID            USER   FD   TYPE   ... NAME
node    82837 piotrwisniewski   25u  IPv4   ... TCP *:3001 (LISTEN)

$ ps -p 82837 -o pid,lstart,etime,command
  PID STARTED                      ELAPSED COMMAND
82837 Wed Aug 12 09:14:44 2026       02:26 /usr/local/bin/node --require
  .../consultify-case-workspace-v1-20260809/server/node_modules/tsx/dist/preflight.cjs
  --import file://.../server/node_modules/tsx/dist/loader.mjs src/index.ts

$ git rev-parse HEAD
ebe4046df95d92bb7559387f287aef8722060e04
```

PID 82837 is confirmed: listening on :3001, started 09:14:44 (before this
packet's work began), running `src/index.ts` directly out of **this**
worktree via `tsx` (no watch — a stale edit would not be picked up, which is
exactly the trap the previous session hit). HEAD at the time of all runs
below was `ebe4046df9`. Re-checked at the end of the run (see §4) — same
PID, still healthy, so nothing restarted it mid-investigation.

Disposable Postgres: `case-workspace-test-pg`, up 33h, `127.0.0.1:55432`,
matches the mandated `DATABASE_URL`.

## 1. Method

For each of the three suspect failures, ran the owning file **three
consecutive times** (the runbook's own warning: "a cold first run lies,
repeat before you diagnose; but 'repeat until pass' is not a gate — a
failure that appears then vanishes without explanation is flaky, not a
pass"). All runs used exactly the mandated invocation:

```
cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 \
  MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
  DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
  npx vitest run <file> --environment node
```

A fourth, verbose run (`--reporter=verbose`) was added afterward to capture
per-scenario names and any output for the evidence record, and — because it
ran back-to-back with the heavy `fullChainObservability` suite — it also
surfaced a **separate, not-in-scope** flake, reported honestly in §5 rather
than folded into the three findings.

Raw log excerpts are inline below; full raw output is in `raw-verbose.log`
in this directory.

## 2. Finding 1 — fullChainObservability.pg.test.ts ("socket hang up")

**Classification: ARTIFACT_OF_STALE_PROCESS / STALE ENVIRONMENT — with one
structural correction to the original hypothesis.**

Runs: 4/4 passed (1 test each).

```
Pass 1: Test Files 1 passed (1) / Tests 1 passed (1) / Duration 22.93s
Pass 2: Test Files 1 passed (1) / Tests 1 passed (1) / Duration 17.94s
Pass 3: Test Files 1 passed (1) / Tests 1 passed (1) / Duration 21.81s
Pass 4 (verbose): Test Files 1 passed (1) / Tests 1 passed (1) / Duration 88.46s
  (this run was slow because it executed back-to-back with other load on
  the shared Postgres container — see the SLOW QUERY warning in the log and
  §5)
```

No "socket hang up" appeared in any of the 4 runs, at any point (including
the 88s slow run under real contention, which is the condition most likely
to reproduce a transient network error if one existed).

**Structural correction worth recording**: this file does **not** talk to
the backend at `127.0.0.1:3001` at all. It is built on
`goldenCaseHarness.ts`'s `createGoldenCaseApp()`, which does
`const app = express()` and mounts the router **in-process**, driven by
`supertest(app)` — a fundamentally different layer from
`liveStack.e2e*.pg.test.ts`, which uses `fetch()` against the real running
server (see the harness's own doc-comment taxonomy: layer 1 mock, layer 2
in-process-with-real-DB ["contract"], layer 3 real-process-real-HTTP
["e2e"]). `fullChainObservability` is layer 2, not layer 3.

That means: whatever produced "socket hang up" before, it structurally
**cannot** have been "the stale backend process on :3001 was serving old
code" the way it plausibly explains findings 2 and 3 below — this test
never opens a socket to that process. "Socket hang up" here would have to
come from something else in the chain: the disposable Postgres pool (10
max connections; the verbose run logged a **1006ms SLOW QUERY** against
`organization_members` under concurrent load from other agents sharing the
same container — consistent with connection contention that could, under
worse timing, produce a dropped/reset connection), or a leftover/zombie
vitest worker process from the "180 red on cold first run" state the
previous session described holding resources.

I cannot produce a positive repro of the original error to confirm the
exact mechanism — it did not reproduce in 4/4 attempts, including one under
real concurrent load. Given (a) it is 100% clean now across repeated
attempts including a stressed one, (b) the file has no code path that would
plausibly be sensitive to "the OTHER server process's code being stale"
since it doesn't call that process, and (c) the symptom (a raw socket-level
error, not an assertion failure or a 4xx/5xx with a body) is the signature
of infrastructure/timeout trouble rather than application logic — I
classify this as an artifact of the previous session's stale/contended
**environment** (most likely Postgres pool/connection pressure from the
"180 red" cold-start episode), not a product defect and not a bug in this
test's own logic. This is the one place where I am flagging real residual
uncertainty rather than a clean-cut answer — see §6.

## 3. Finding 2 — liveStack.e2e.part2.pg.test.ts, "5. TRANSFORMATION" (was: expected 404, got 200 — i.e. inverted, meaning it 404'd)

**Classification: ARTIFACT_OF_STALE_PROCESS.**

This scenario (`describe('5. TRANSFORMATION profile')`) genuinely does
depend on the live backend process: it drives Case creation, plan
propose/publish, Case activation, and a `POST
/case-workspace/run-bindings` call, all through `api()` →
`fetch('http://127.0.0.1:3001/api/v8...')` — real HTTP to the real process.

Runs: 3 solo passes + 1 verbose pass (run alongside 9 other scenarios in
the same file), scenario 5 itself green in all 4:

```
Pass 1 (solo, whole file): Tests 10 passed (10)  — Duration 17.54s
Pass 2 (solo, whole file): Tests 10 passed (10)  — Duration 25.77s
Pass 3 (solo, whole file): Tests 10 passed (10)  — Duration 12.90s
Pass 4 (verbose):
  ✓ 5. TRANSFORMATION profile > behaves like STANDARD: zero Runs until
    plan published + explicit start   4522ms
```

Corroborating context: HEAD (`ebe4046df9`) sits directly on top of
`8c763a5a98 "wip(case-workspace): waves A and B — Run/NodeRun runtime,
gateways, adapters, PL classifier, outbox worker wired"`, which is exactly
the kind of change (Run/NodeRun runtime + run-binding wiring) that a
run-binding-dependent scenario like this one would 404 against if the
serving process predated it. I cannot prove what SHA the previous session's
backend was actually running (I was not present for that session), so this
is corroborating plausibility, not proof — the proof is the 4/4 clean runs
against the verified-fresh process at the verified-current HEAD.

## 4. Finding 3 — liveStack.e2e.part2.pg.test.ts, "6. Approval REJECT" (was: expected 400, got 201 — i.e. create-proposal step failing)

**Classification: ARTIFACT_OF_STALE_PROCESS.**

Runs: same 3 solo passes + 1 verbose pass as above, scenario 6/REJECT green
in all 4:

```
Pass 1-3 (solo, whole file): 10/10 each time, including all three
  describe('6. Approval decision matrix') sub-tests (REJECT,
  REQUEST_CHANGES, DEFER).
Pass 4 (verbose):
  ✓ 6. Approval decision matrix > REJECT terminates the proposal and names
    the deciding human   2776ms
  ✓ 6. Approval decision matrix > REQUEST_CHANGES sends the proposal back,
    distinct from REJECT   1625ms
  ✓ 6. Approval decision matrix > DEFER is a non-status-changing audited
    fact, distinct from both   2071ms
```

The proposal create step (`POST /cases/:id/proposals`, asserted `toBe(201)`
inside `createSubmittedProposal`) never returned 400 in any of the 4 runs.
Note the test file itself carries a large, specific comment (lines
246-257) documenting a **real, previously-reproducible** bug class in this
exact area: `proposalVersion` is a per-Case monotonic counter
(`COALESCE(MAX(proposal_version),0)+1 ... WHERE case_id = ?`), not a
constant and not the OCC `version` — the comment says a hardcoded 1 "only
matched the FIRST proposal by coincidence" and produced a reproducible 409
for every proposal after it. That is a documented HARNESS-side lesson
already fixed in the current test code (it reads `proposalVersion` off the
create response, per line 279/294). It is a plausible contributor to why
an EARLIER version of this suite could have failed here, but it is not
live in the code I ran — I'm noting it for completeness, not presenting it
as this packet's finding, since the current file already implements the
correct approach and passed clean 4/4.

## 5. Flaky, but NOT one of the three assigned findings — reported honestly

`liveStack.e2e.part2.pg.test.ts`, `describe('10. Failure, retry, recovery
on an action proposal')`, timed out in the **verbose** run (pass 4 of the
session, run immediately after the 88s `fullChainObservability` pass):

```
× 10. Failure, retry, recovery on an action proposal > EXECUTING -> FAILED
  -> retry -> APPROVED, with the failure reason classified (never raw
  text) in the event   10016ms
  → Test timed out in 10000ms.
```

This scenario issues 6 sequential HTTP round trips (create, submit,
approve, transition-to-executing, transition-to-failed, retry) plus DB
readbacks, against `server/vitest.config.ts`'s global `testTimeout: 10000`
(10s) — a tight budget for 6 sequential network+DB round trips even
uncontended. It failed here immediately after a run that logged a 1006ms
single-query slowdown from concurrent load (other agents sharing the same
Postgres container per this packet's own instructions), and it had passed
cleanly in all 3 of my earlier solo runs of the same file. I did not
re-isolate and re-run scenario 10 alone to confirm the mechanism, because
it is explicitly out of this packet's three-item scope — flagging it here
as observed, not diagnosing it further. Recommend whoever owns this file
next either raises this scenario's timeout or re-runs it in isolation under
load to confirm the classification.

## 6. What I could NOT determine

- The **exact mechanism** behind `fullChainObservability`'s original
  "socket hang up" — I have strong structural evidence it cannot be
  literally "the :3001 backend was stale" (the test never talks to that
  process), and circumstantial evidence pointing at Postgres
  connection/pool contention from the previous session's degraded state,
  but I have no positive repro to nail it down. If it recurs, capture the
  Postgres pool's active-connection count and the full stack trace of the
  hang-up (not just the summary line) at the moment it happens.
- Whether the previous session's backend was in fact running an SHA prior
  to `8c763a5a98` — plausible from the commit's content and timing, not
  independently confirmed (I was not present for that session and the
  process was already killed and replaced before this packet started).
- Root cause of the scenario-10 timeout in §5 — flagged as observed, not
  investigated further, since it falls outside this packet's three-item
  scope.

## 7. Summary table

| # | Test | Symptom (prior session) | Runs this session | Classification |
|---|------|--------------------------|--------------------|-----------------|
| 1 | fullChainObservability.pg.test.ts | socket hang up | 4/4 pass | ARTIFACT_OF_STALE_PROCESS / stale environment (see §2 nuance — not literally the :3001 process, since this test doesn't call it) |
| 2 | liveStack.e2e.part2 — "5. TRANSFORMATION" | unexpected 404 | 4/4 pass | ARTIFACT_OF_STALE_PROCESS |
| 3 | liveStack.e2e.part2 — "6. Approval REJECT" | unexpected 400 | 4/4 pass | ARTIFACT_OF_STALE_PROCESS |

No REAL_PRODUCT_DEFECT found. No HARNESS_BUG found in the current state of
the three files in scope (one now-fixed harness-side lesson, already
implemented, is documented in §4 for completeness). One out-of-scope flake
(§5) observed and reported, not diagnosed.
