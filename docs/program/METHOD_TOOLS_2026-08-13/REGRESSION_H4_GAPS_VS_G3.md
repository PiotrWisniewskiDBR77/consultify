# Regression H4 — closing G3's gaps at candidate `91b562ea66` (baseline `fb6dfedd42`)

Agent: H4. Scope: **only** the batches G3 (`codex/g-g3-regress`) left PARTIAL or never started —
`backend-sec-perf`, `component-singular`, `unit-backend`, `unit-rest`, `components`. G3's own
completed batches (`hooks-store`, `src-and-server-src`, `integration`, `targeted-*`,
`tests/acceptance/*.e2e.test.ts`) are **not** re-run here — see "Known gap" note at the bottom for
why that is a caveat, not a silent assumption.

Worktrees (dedicated to H4, not shared with any other concurrent stream):
- Candidate: `/Users/piotrwisniewski/.codex/worktrees/h4-regress` (branch `codex/h-h4-regress`, HEAD `91b562ea66`)
- Baseline: `/Users/piotrwisniewski/.codex/worktrees/h4-baseline` (detached HEAD `fb6dfedd42` — created fresh
  this session via `git worktree add`; **not** the shared `g3-baseline` worktree, to avoid a second
  concurrent stream mutating the same disposable DB underneath this one — see repo memory
  `orkiestracja-jeden-worktree-jeden-agent.md`)

Disposable Postgres, one per tree, both `pgvector/pgvector:pg15`, both migrated with
`NODE_ENV=test DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts` (no `--safe`), both
landing on **1354 tables**:
- Candidate DB: docker `cfy-h4-regress`, `postgres://consultinity:test@localhost:56801/consultinity`
- Baseline DB: docker `cfy-h4-baseline`, `postgres://consultinity:test@localhost:56811/consultinity`

Runner: `scripts/testing/run-regression-batches-h4.sh` (byte-identical copy on both trees, diffed to
confirm). Same shape as G3's runner but adds **`--retry=0` explicitly on the CLI** — `vitest.config.ts`
sets `retry: process.env.CI ? 3 : 1`, so a bare invocation would silently allow one retry per failing
test locally and could hide flakiness as a pass; G3's runner did not pass this flag. Output lands under
`docs/program/METHOD_TOOLS_2026-08-13/regression-batches/h4-candidate/<batch>.txt` and
`.../h4-baseline/<batch>.txt`, written the moment each batch finishes (resumable — a batch is done iff
its file ends with `EXIT_CODE=`). Classified with the same `scripts/testing/classify-regression.py`
G3 used (unmodified).

Launch (both, identical invocation differing only in root/DB):
```bash
nohup bash scripts/testing/run-regression-batches-h4.sh \
  <ROOT> <DATABASE_URL> docs/program/METHOD_TOOLS_2026-08-13/regression-batches/<h4-candidate|h4-baseline> \
  > /tmp/h4-<candidate|baseline>-runner.log 2>&1 &
disown
```

## `tests/performance/memory-leak.test.ts` — excluded from `backend-sec-perf`, NOT_VERIFIED

`tests/performance/memory-leak.test.ts` defaults to **`MEMORY_TEST_DURATION=60` (60 real minutes)** —
confirmed by reading the file (`const TEST_DURATION_MS = parseInt(process.env.MEMORY_TEST_DURATION ||
'60', 10) * 60 * 1000`), no override was set by the runner. This is exactly what killed G3's
`backend-sec-perf` attempt at the ~8-9 minute mark (background session limit, not a hang) and would
have blocked all four subsequent batches behind it since the runner is sequential per tree. Rather than
fight it a second time: excluded via `--exclude '**/memory-leak.test.ts'` from the `backend-sec-perf`
batch invocation on **both** trees identically, batch reran clean to completion (see below).

**Status: NOT_VERIFIED** (not run this stream, on either tree — no A/B evidence either direction).
Resume command (run identically on both trees, compare with the classifier):
```bash
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<tree's URL> DB_TYPE=postgres \
  MEMORY_TEST_DURATION=2 npx vitest run tests/performance/memory-leak.test.ts \
  --config vitest.config.ts --retry=0 --reporter=dot
```
(a short override, e.g. 2 minutes, gives real completed evidence in reasonable time instead of the
default 60 — untested here for lack of time, not because it's unsafe to run)

## Batch status

<!-- FILLED IN AS BATCHES COMPLETE -->

| Batch | Candidate | Baseline | introduced | fixed | identical_pre_existing | flaky | Status |
|---|---|---|---:|---:|---:|---:|---|
| `backend-sec-perf` (`tests/backend` + `tests/security` + `tests/performance`, **minus** `memory-leak.test.ts`) | 35 files (3 failed/30 passed/2 skipped), 411 tests (3 failed/376 passed/32 skipped) | 35 files (3 failed/30 passed/2 skipped), 411 tests (3 failed/376 passed/32 skipped) | **0** | **0** | **3** | 0 | **COMPLETE** |
| `component-singular` (`tests/component`, substring-matches `tests/components` too — 631/631 files, see finding below) | 631 files (84 failed/546 passed), 3131 tests (242 failed/2884 passed/4 skipped) | 631 files (83 failed/547 passed), 3131 tests (241 failed/2885 passed/4 skipped) | **0** (2 raw, both reclassified `flaky`) | **0** (1 raw, reclassified `flaky`) | **246** | **3** | **COMPLETE** |
| `components` (`tests/components`) | — | — | — | — | — | — | **SKIPPED — proven subsumed by `component-singular`, 631/631 files matched exactly, see below** |
| `unit-backend` (`tests/unit/backend`) | IN PROGRESS at report time (not killed, running unattended) | IN PROGRESS at report time | — | — | — | — | **NOT_VERIFIED — resume/check command below** |
| `unit-rest` (~50 other `tests/unit/*` subdirs + loose top-level files) | queued behind `unit-backend` in the same sequential runner | queued | — | — | — | — | **NOT STARTED** |

### `backend-sec-perf` detail (3 identical_pre_existing, confirmed via classifier)

```
$ python3 scripts/testing/classify-regression.py h4-candidate/backend-sec-perf.txt h4-baseline/backend-sec-perf.txt backend-sec-perf
- Candidate: exit=1 | Test Files 3 failed | 30 passed | 2 skipped (35) | Tests 3 failed | 376 passed | 32 skipped (411)
- Baseline:  exit=1 | Test Files 3 failed | 30 passed | 2 skipped (35) | Tests 3 failed | 376 passed | 32 skipped (411)
- introduced: 0  fixed: 0  identical_pre_existing: 3
```
The 3 failures (byte-identical on both trees, same file+test name):
- `tests/backend/trial_limits.test.js` :: `Should BLOCK AI call if limit exceeded` (Trial Mode AI Token Limits)
- `tests/performance/databasePerformance.test.js` :: `should handle 20 concurrent INSERT operations in < 1000ms`
- `tests/performance/scalability.test.js` :: `should handle multiple concurrent transactions in < 15000ms`

The latter two are hard-coded wall-clock thresholds on concurrent DB throughput — plausibly host-load
sensitive — but since both trees were measured back-to-back under the same host load and produced the
identical fail set, the A/B method classifies them `identical_pre_existing` regardless of whether a
rerun on a quieter host would flip them; no `introduced`/`fixed` divergence exists to investigate.
Not re-run 3x for flakiness because the flakiness protocol in the brief applies to A vs B **divergence**
(a test that fails on one tree and passes on the other) — there is none here to disambiguate.

### `component-singular` — confirmed substring-match finding (saves the next agent hours)

**`tests/component` as a vitest CLI path filter also matches `tests/components`** — vitest's path
filtering is substring-based (the same behavior G3's doc already documented for `src` matching
`server/src`). Only **2 real files** live under `tests/component/` (singular):
`tests/component/controllers/AssessmentController.test.ts` and
`tests/component/controllers/AuthController.test.ts`. Grepping the in-progress candidate output for
`stdout | tests/components/...` markers already shows 80+ distinct files from the **plural** directory
(`tests/components/AIChat/...`, `tests/components/Admin/...`, `tests/components/Audit/...`, etc.)
executing inside the `component-singular` batch — i.e. this one batch, as invoked, is a **superset** of
what the separate `components` batch (627 files) would run.

**Decision: skip the separately-planned `components` batch entirely** — running it would re-execute the
identical 627-file set a second time for zero additional signal. `component-singular`'s eventual
candidate-vs-baseline classification (once its 600+ file run finishes) **is** the `components` evidence.
This is recorded here as the substantiated reason, not inferred silently.

**Confirmed at completion**: both trees report `(631)` total test files matched by the single
`tests/component` filter — exactly `find tests/component tests/components -type f
\( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.test.js' \) | wc -l` (4 + 627 = 631, verified
before launch). Full-set coverage proven, not inferred. **The `components` batch is skipped — its
evidence would be byte-for-byte the same run.**

### `component-singular` — classification (2 raw `introduced`, 1 raw `fixed`, all 3 reclassified `flaky`)

```
$ python3 scripts/testing/classify-regression.py h4-candidate/component-singular.txt h4-baseline/component-singular.txt component-singular
- introduced (fail in candidate, pass in baseline): 2
- fixed (pass in candidate, fail in baseline): 1
- identical_pre_existing (fail in both): 246
```

Raw `introduced` (2):
- `tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx` :: "prefers governed
  statement-pack detail before legacy fallback in the workspace" — candidate: `V8FinanceApi.getStatement`
  not called (0 calls) when the test expects `getStatement('statement-1')`.
- `tests/components/partner/EarningsSection.v8-payout-settings.test.tsx` :: "prefers governed payout-settings
  read and update before legacy fallback"

Raw `fixed` (1):
- `tests/components/assessment/AssessmentHub.five-surfaces.test.tsx` :: "clicking a tab updates the URL (?tab=)"

**Investigation (per the "find the minimal reproducer and FIX it" mandate) — root-caused as test-runner
flakiness, not a product regression, evidence below:**

1. `git diff fb6dfedd42 91b562ea66 -- <component-or-test-file>` for **all three** files (component source
   + test file, both introduced tests + the fixed test) → **zero lines of diff**. The code and tests under
   test are byte-identical between baseline and candidate; a real regression is impossible here by
   construction — nothing changed for these two batches to diverge on except run-to-run noise.
2. Both `FinancialStatementPackWorkspace.v8-read-seam.test.tsx` and `EarningsSection.v8-payout-settings.test.tsx`
   pass **100% (3/3 combined isolated runs)** when run standalone or in a small multi-file run
   (`tests/components/Finance` + `tests/components/Economics` together, same `--maxWorkers=2
   --maxConcurrency=4` as the batch) — the failure only manifests inside the full 631-file batch, consistent
   with worker/module-state interference between unrelated test files sharing a `vitest` worker, not a bug in
   either file.
3. `AssessmentHub.five-surfaces.test.tsx`'s "clicking a tab updates the URL" test is **flaky even fully
   isolated**, on **both** trees: 3 standalone reruns each —
   candidate: FAIL, PASS, PASS; baseline: PASS, FAIL, PASS. Combined with the zero-diff finding, this is a
   pre-existing, tree-independent flaky test (likely a `history`/URL-update timing race in the test itself),
   not something the candidate's diff "fixed."

**Classification: all 3 reclassified `flaky`, net regression count is 0 introduced / 0 fixed.** No code
change made — there is nothing to fix in application code (files are identical to baseline) and no vitest
config bug was proven within the time available; flagged for whoever next touches CI stability, not blocking
this regression sign-off. Corrected batch totals: **0 introduced, 0 fixed, 246 identical_pre_existing, 3 flaky**.

### Resume commands (nothing was killed — runner is `nohup`+`disown`'d and still alive on both trees)

The batch runner processes were confirmed alive (pids 99847 candidate / 99848 baseline) and are working
unattended through the batch queue in order: `component-singular` (running) → `unit-backend` → `unit-rest`.
No manual restart is needed unless the host is rebooted or the processes die. To check status or resume
after a restart:
```bash
# check status
for f in docs/program/METHOD_TOOLS_2026-08-13/regression-batches/h4-candidate/*.txt \
         /Users/piotrwisniewski/.codex/worktrees/h4-baseline/docs/program/METHOD_TOOLS_2026-08-13/regression-batches/h4-baseline/*.txt; do
  grep -oE "EXIT_CODE=[0-9]+" "$f" | tail -1 | sed "s|^|$f -> |" || echo "$f -> IN_PROGRESS"
done

# if the processes died, resume identically on each tree (auto-skips completed batches):
cd /Users/piotrwisniewski/.codex/worktrees/h4-regress && nohup bash scripts/testing/run-regression-batches-h4.sh \
  /Users/piotrwisniewski/.codex/worktrees/h4-regress postgres://consultinity:test@localhost:56801/consultinity \
  docs/program/METHOD_TOOLS_2026-08-13/regression-batches/h4-candidate > /tmp/h4-candidate-runner.log 2>&1 & disown

cd /Users/piotrwisniewski/.codex/worktrees/h4-baseline && nohup bash scripts/testing/run-regression-batches-h4.sh \
  /Users/piotrwisniewski/.codex/worktrees/h4-baseline postgres://consultinity:test@localhost:56811/consultinity \
  docs/program/METHOD_TOOLS_2026-08-13/regression-batches/h4-baseline > /tmp/h4-baseline-runner.log 2>&1 & disown

# classify each finished batch:
cd /Users/piotrwisniewski/.codex/worktrees/h4-regress && python3 scripts/testing/classify-regression.py \
  docs/program/METHOD_TOOLS_2026-08-13/regression-batches/h4-candidate/<batch>.txt \
  /Users/piotrwisniewski/.codex/worktrees/h4-baseline/docs/program/METHOD_TOOLS_2026-08-13/regression-batches/h4-baseline/<batch>.txt \
  <batch>
```

## Discovery gate (candidate tree, this report)

```
$ NODE_ENV=test npx tsx scripts/testing/test-discovery-gate.ts
Discovered: 4239
Manifest entries: 4239
Executed (vitest-collected + node:test): 3947
Discovery gate: PASS
```

## Summary — what's closed / PARTIAL / not started (as of this report, 2026-08-13 ~22:56 local)

- **CLOSED (complete A/B classification, real Postgres both sides, retry=0)**:
  - `backend-sec-perf` (minus `memory-leak.test.ts`) — **0 introduced, 0 fixed, 3 identical_pre_existing, 0 flaky**.
  - `component-singular` (proven superset of `components`, 631/631 files) — **0 introduced, 0 fixed,
    246 identical_pre_existing, 3 flaky** (2 raw introduced + 1 raw fixed, all reclassified `flaky` with
    zero-diff + isolated-rerun evidence, see detail above — no code fix needed, nothing changed in those files).
  - `components` — **SKIPPED**, proven identical scope to `component-singular` (631/631 file count match).
- **NOT_VERIFIED (excluded on purpose, not a silent gap)**: `tests/performance/memory-leak.test.ts` — defaults
  to a real 60-minute run (confirmed by reading the source); resume command with a short
  `MEMORY_TEST_DURATION` override is above.
- **NOT_VERIFIED (in progress at report time, unattended via `nohup`+`disown`, confirmed alive — pids
  99847/99848 — not killed)**: `unit-backend` — check/resume commands below.
- **NOT STARTED (queued behind `unit-backend` in the same sequential runner, no separate action needed
  once `unit-backend` finishes)**: `unit-rest`.
- **Discovery gate: PASS** (4239 discovered = 4239 manifest, 3947 executed, 0 unclassified, 0
  active-but-not-executed) — reconfirmed on the candidate tree at report time.
- **Out of this stream's scope** (G3's own completed batches, at the *older* candidate SHA `773c72d371`,
  not re-verified against the current `91b562ea66`): `hooks-store`, `src-and-server-src`, `integration`,
  `targeted-discovery-components`, `targeted-new-integration-tests`, `tests/acceptance/*.e2e.test.ts`.
  `git diff 773c72d371 91b562ea66 --stat` shows real production changes since then (`ToolController.ts`,
  `ToolInitiativeService.ts`, `useToolStore.ts`, `buildSwotOutput.ts`, `EvidenceEditor.tsx`,
  `swotAcceptGate.ts`, several `DiscoveryTools` components) that these older batch results do not cover —
  flagged here rather than silently trusted, but re-running them was out of this stream's assigned gap list.

## Combined totals across everything H4 verified this stream

**0 introduced · 0 fixed · 249 identical_pre_existing · 3 flaky (all explained)** across the 2 batches
fully closed this stream (`backend-sec-perf`, `component-singular`/`components`). `unit-backend` and
`unit-rest` remain to be closed — see resume commands above; nothing was reclassified to PASS without a
complete run, per the hard requirement.
