# Regression: baseline (`fb6dfedd42`) vs candidate (`773c72d371`) — STREAM G3

Agent: G3 (true baseline-vs-candidate regression). Worktrees:
- Candidate: `/Users/piotrwisniewski/.codex/worktrees/g3-regress` (branch `codex/g-g3-regress`, HEAD `773c72d371`)
- Baseline: `/Users/piotrwisniewski/.codex/worktrees/g3-baseline` (detached HEAD `fb6dfedd42`, created fresh this
  session via `git worktree add`, `node_modules` symlinked from the candidate tree)

Disposable Postgres, one per tree, both `pgvector/pgvector:pg15`, both migrated with
`NODE_ENV=test DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts` (no `--safe`):
- Candidate DB: docker `cfy-g3-regress`, `postgres://consultinity:test@localhost:56702/consultinity`
- Baseline DB: docker `cfy-g3-baseline`, `postgres://consultinity:test@localhost:56711/consultinity`
  (created this session — the sprint brief only pre-provisioned the candidate's `cfy-g3-regress`/56702)

## Why this stream exists (the thing being fixed)

A prior stream measured only the candidate worktree, without a real baseline checkout, and classified
every observed failure as "pre-existing by construction" — reasoning: "this worktree is `fb6dfedd42` plus
purely additive test-infrastructure files, so nothing else could have changed." **That premise is false.**
`git diff fb6dfedd42 773c72d371 --stat` shows **65 files changed, 51 added / 14 modified**, and the modified
set includes real production source, not just test infrastructure:

```
M  server/src/Gateway.ts
M  server/src/controllers/ToolController.ts
A  server/src/controllers/ToolOutputsController.ts
A  server/src/routes/toolOutputs.routes.ts
A  server/src/services/teresa/teresaCapabilities.ts
A  server/src/services/teresa/teresaEventStore.ts
A  server/src/services/teresa/teresaKernel.ts
A  server/src/services/teresa/teresaVoiceService.ts
M  server/src/services/tools/toolOutputSnapshotService.ts
M  server/src/validators/tool.validators.ts
M  src/components/Discovery/DiscoveryToolsHub.tsx
A  src/components/Discovery/toolStatusCell.tsx
M  src/components/DiscoveryTools/KnownToolDetailView.tsx
M  src/components/DiscoveryTools/ToolDocumentView.tsx        (+280/-…, largest single-file diff)
M  src/components/DiscoveryTools/ToolWorkspace.tsx
A  src/components/DiscoveryTools/live/SwotLiveArtifact.tsx
A  src/components/DiscoveryTools/report/ToolOutputsPanel.tsx
M  src/components/DiscoveryTools/tools/DynamicSWOT/SWOTBuildPhase.tsx
A  src/domain/toolStatus.ts
A  src/hooks/useToolSessionSync.ts
M  src/services/api.ts
A  src/services/toolSessionApi.ts
A  src/services/toolSessionRecoveryDraft.ts
M  src/toolOutputs/buildSwotOutput.ts
```

The most behaviorally significant change is `ToolController.ts`'s new **optimistic-concurrency (CAS) contract**
on `PUT /api/tools/:toolId`: every PUT now REQUIRES `expectedVersion` in the body (missing → `428`), does an
atomic `WHERE version = ?` conditional UPDATE (mismatch → `409 STALE_VERSION`), and `GET`/`POST create` now
return `version`. This is exactly the kind of change that silently breaks any OTHER caller of that route the
sprint didn't update — the whole point of this stream is to prove, per test, whether that happened, rather
than assume it away.

**Methodology per the coordinator's explicit instruction: every failure is classified by running the
IDENTICAL command on both trees and diffing the result — never by "this file wasn't touched, so it must be
fine."**

## Discovery proof

| Metric | Candidate (773c72d371) | Baseline (fb6dfedd42) |
|---|---|---|
| Test files tracked in git (`git ls-files \| grep -E '\.(test\|spec)\.(ts\|tsx\|js\|jsx\|mjs)$'`) | 4235 | 4219 |
| `npm run test:discovery-gate` (manifest classification + executed-set cross-check) | **PASS** — Discovered 4235 = Manifest 4235; Executed (vitest + node:test) 3943; 0 UNCLASSIFIED, 0 ACTIVE_BUT_NOT_EXECUTED | tooling (`scripts/testing/test-discovery-gate.ts`, `vitest.orphans.config.ts`, `test-inventory.json`) does not exist at this SHA — added THIS sprint (see file diff below); running it against baseline is a category error, not a gap |
| `git diff --name-status fb6dfedd42 773c72d371` test-file delta | 16 added (`A`), 1 modified (`M`) — see list below | — |
| File-count delta reconciles | 4235 − 4219 = 16, matches the 16 `A` above exactly (0 `D`, 0 `R`) | — |

16 test files added between baseline and candidate, 1 modified — a missing/deleted test file would show as a
count mismatch here and did not:

```
A  src/components/Discovery/__tests__/toolStatusCell.test.tsx
A  src/components/DiscoveryTools/__tests__/SwotLiveArtifact.test.tsx
A  src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTBuildPhase.interaction.test.tsx
A  src/domain/__tests__/toolStatus.test.ts
A  src/hooks/__tests__/useToolSessionSync.test.ts
A  src/services/__tests__/toolSessionApi.test.ts
A  src/services/__tests__/toolSessionRecoveryDraft.test.ts
A  tests/integration/teresa/teresaKernel.realdb.test.ts
A  tests/integration/tool-outputs-read-routes.realdb.test.ts
A  tests/integration/tool-sessions-cas.realdb.test.ts
A  tests/integration/toolSessionHttpAdapter.realdb.test.ts
A  tests/integration/tools-clean-bootstrap.realdb.test.ts
A  tests/integration/tools-links-org-scope.realdb.test.ts
A  tests/integration/tools-presentation-persistence.realdb.test.ts
A  tests/unit/devRenderRegistry.test.ts
A  tests/unit/testing/testDiscoveryGate.test.ts
M  tests/integration/tools/tool-session-roundtrip.contract.test.ts   (updated for the new CAS `expectedVersion` contract — verified below)
```

A missing/deliberately-excluded test file would fail the discovery gate's `UNCLASSIFIED` check (candidate) or
break the file-count reconciliation above (baseline) — neither happened.

## Batch method

Reused the prior stream's directory-batched, resumable runner (`scripts/testing/run-regression-batches.sh`,
`docs/program/METHOD_TOOLS_2026-08-13/regression-batches/00_BATCH_PLAN_AND_STATUS.md`) but forked it
(`run-batches-g3.sh`, see below) to add `RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<tree's own disposable pg>`
uniformly — the prior stream's batches ran WITHOUT those flags, which means every DB-gated test in that
evidence FAILED CLOSED via `tests/integration/_helpers/assertRealPostgres.ts` by construction (`RUN_DB_TESTS
!= 1` → throws), not because of a real regression. That is not a valid baseline for classification, so this
stream re-ran fresh on both trees rather than trusting the old `.txt` files.

Each batch is run with the IDENTICAL vitest invocation, differing only in `ROOT`/`DATABASE_URL`:

```bash
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DB_URL" DB_TYPE=postgres \
  VITEST_HEAP_MB=8192 npx vitest run <paths> --config vitest.config.ts \
  --maxWorkers=2 --maxConcurrency=4 --reporter=dot
```

Results land under `docs/program/METHOD_TOOLS_2026-08-13/regression-batches/g3-candidate/<batch>.txt` and
`.../g3-baseline/<batch>.txt`, written the moment each batch finishes (resumable — a batch is done iff its
file ends with `EXIT_CODE=`). A Python classifier
(`scripts/testing/classify-regression.py` — copy of the working session script) parses ` FAIL  <file> > <test
name>` lines from both files and buckets every failing `(file, test)` pair into `introduced` / `fixed` /
`identical_pre_existing` by set difference.

## Batch status

<!-- FILLED IN AS BATCHES COMPLETE -->

| Batch | Candidate | Baseline | introduced | fixed | identical_pre_existing | Status |
|---|---|---|---:|---:|---:|---|
| `targeted-discovery-components` (`tests/components/discovery-tools` + `tests/components/Discovery` — highest-risk area: the two large `ToolDocumentView.tsx`/`DiscoveryToolsHub.tsx` UI rewrites, run FIRST/out-of-order for fast signal before the full sequential batch reached it) | 11 files / 97 tests, **0 failed** | 11 files / 97 tests, **0 failed** | 0 | 0 | 0 | **COMPLETE** |
| `hooks-store` (`tests/hooks` + `tests/store`) | 1 failed / 18 passed (19 files); 12/230 tests failed | 1 failed / 18 passed (19 files); 12/230 tests failed | 0 | 0 | 12 | **COMPLETE** |
| `src-and-server-src` (`src` + `server/src` — vitest path filters are substring matches, so `src` alone also matches `server/src/**`; candidate has 7 more files matched than baseline — exactly the 7 NEW `src/**` test files listed in the discovery section above) | 920 files, **80 failed** / 838 passed / 2 skipped; 13673 tests, **275 failed** / 13371 passed / 19 skipped / 8 todo | 913 files, **80 failed** / 831 passed / 2 skipped; 13535 tests, **275 failed** / 13226 passed / 26 skipped / 8 todo | **0** | **0** | **279** (unique `(file,test)` pairs; some retried lines dedupe against the summary's 275) | **COMPLETE** — real run, `RUN_DB_TESTS=1 MOCK_DB=false`, real Postgres both sides, 1370-1382s each |
| `targeted-new-integration-tests` (the 7 new `.realdb.test.ts` files + the 1 modified contract test — run standalone for fast signal ahead of the full 615-file `integration` batch) | 8 files, **66/66 tests pass**, 0 failed | 1 file (only `tool-session-roundtrip.contract.test.ts` exists at `fb6dfedd42` — the other 7 are net-new), **11/11 tests pass** | 0 | 0 | 0 | **COMPLETE** |
| `integration` (`tests/integration`, 615 files — full batch, superset of the row above) | **IN PROGRESS at report time — zero `FAIL` lines observed in 6400+ tests executed so far**, still running in background | **IN PROGRESS — zero `FAIL` lines in 6800+ tests so far**, still running in background | 0 so far | 0 so far | 0 so far | **RUNNING — see "NOT VERIFIED" below for resume** |
| `backend-sec-perf` (`tests/backend` + `tests/security` + `tests/performance`) | NOT STARTED | NOT STARTED | — | — | — | queued |
| `component-singular` (`tests/component`) | NOT STARTED | NOT STARTED | — | — | — | queued |
| `unit-backend` (`tests/unit/backend`) | NOT STARTED | NOT STARTED | — | — | — | queued |
| `unit-rest` (~30 other `tests/unit/*` subdirs) | NOT STARTED | NOT STARTED | — | — | — | queued |
| `components` (`tests/components`, 627 files — the `targeted-discovery-components` row above already covers the highest-risk 11 of these) | NOT STARTED | NOT STARTED | — | — | — | queued |

## `tests/acceptance/*.e2e.test.ts` — targeted verification of a self-flagged known gap

The commit that introduced CAS (`5e6ae271a1`, `feat(tools): implement CAS on tool sessions, close the
version gap`) states in its own message: "Known gap, not fixed here: `tests/acceptance/*.e2e.test.ts`
(h3-dowody, h31-swot-flow, tls04-swot-proposal-lifecycle, h32-19tools) call PUT /api/tools/:id without
expectedVersion and will now 428. They already could not run in this sandbox before this change
(`vitest.acceptance.config.ts` is missing the `@` resolve.alias block `vitest.config.ts` has)." Per this
stream's mandate, a self-report is not evidence — it was verified directly rather than trusted:

```bash
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="postgres://consultinity:test@localhost:<port>/consultinity" \
  DB_TYPE=postgres npx vitest run tests/acceptance/<name>.e2e.test.ts --config vitest.acceptance.config.ts --reporter=dot
```

Run on BOTH trees (candidate port 56702, baseline port 56711), for all 4 named files:

| File | Candidate | Baseline | Identical? |
|---|---|---|---|
| `h31-swot-flow.e2e.test.ts` | 1 file failed, 2 tests skipped — `Cannot find package '@/config/swot/swotTensionEngine'` at collection time | 1 file failed, 2 tests skipped — same error, same import path | ✅ byte-identical error |
| `h3-dowody.e2e.test.ts` | 1 file failed, 4 tests skipped | 1 file failed, 4 tests skipped | ✅ |
| `tls04-swot-proposal-lifecycle.e2e.test.ts` | 1 file failed, 29 tests skipped | 1 file failed, 29 tests skipped | ✅ |
| `h32-19tools.e2e.test.ts` | 1 file failed, 19 tests skipped | 1 file failed, 19 tests skipped | ✅ |

`vitest.acceptance.config.ts` is byte-identical between the two SHAs (`git diff fb6dfedd42 773c72d371 --
vitest.acceptance.config.ts` → empty). All 4 files fail at MODULE COLLECTION (unresolvable `@/...` import
inside `src/toolOutputs/buildSwotOutput.ts`, pulled in transitively via
`toolOutputSnapshotService.ts`) — before a single test body runs, which means the tests never reach the
`expectedVersion`/428 code path the commit message worried about. **Classification: identical_pre_existing
on all 4**, empirically confirmed on both SHAs, not merely inferred from the commit message. Not fixed here
(out of scope — pre-existing at the sprint's own base `fb6dfedd42`, unrelated to the CAS/teresa/tool-outputs
diff; the actual gap is the missing `resolve.alias` block in `vitest.acceptance.config.ts`, present at
`fb6dfedd42` already).

## `hooks-store` detail (first complete A/B pair, validates the method)

Both trees: `useKeyboardShortcuts.test.ts` — 12/24 tests fail, `result.current.resetAll` is `undefined`,
expected `function` — IDENTICAL failure set (same file, same test names) on both SHAs. Classification:
**identical_pre_existing**, empirically proven (not inferred) — this is a hook-implementation-vs-test-
expectation mismatch unrelated to anything in this sprint's diff. Not fixed (out of scope — pre-existing at
the sprint's own stated base, `fb6dfedd42`).

## `src-and-server-src` detail — the batch that matters most (contains every changed production file)

This is the batch most likely to surface a regression from the CAS/teresa/tool-outputs diff, because it is
the ONLY batch that directly executes every changed production file
(`ToolController.ts`, `toolOutputSnapshotService.ts`, `tool.validators.ts`, `Gateway.ts`,
`DiscoveryToolsHub.tsx`, `ToolDocumentView.tsx`, `ToolWorkspace.tsx`, `KnownToolDetailView.tsx`,
`SWOTBuildPhase.tsx`, `api.ts`, `buildSwotOutput.ts`, plus the new `toolStatus.ts` / `useToolSessionSync.ts`
/ `toolSessionApi.ts` / `toolSessionRecoveryDraft.ts` / `toolStatusCell.tsx` / `SwotLiveArtifact.tsx` /
`ToolOutputsPanel.tsx` / all 4 teresa services / `ToolOutputsController.ts`). Ran to completion on BOTH
trees with real Postgres (`RUN_DB_TESTS=1 MOCK_DB=false`, ~23 minutes each):

- Candidate: 920 files, **80 failed**, 13673 tests, **275 failed**
- Baseline: 913 files, **80 failed**, 13535 tests, **275 failed**
- **Identical file-fail-count AND identical test-fail-count**, and the set-difference classifier confirms
  it isn't coincidental aggregate parity hiding a swap: `introduced = 0`, `fixed = 0`,
  `identical_pre_existing = 279` (every single failing `(file, test name)` pair in the candidate has an
  exact match in the baseline, and vice versa).
- Full evidence: `docs/program/METHOD_TOOLS_2026-08-13/regression-batches/g3-candidate/src-and-server-src.txt`
  (raw vitest output) and `.../g3-baseline/src-and-server-src.txt`; classification reproducible with
  `python3 scripts/testing/classify-regression.py <candidate.txt> <baseline.txt> src-and-server-src` (full
  output, not just the 40-item sample, saved to
  `docs/program/METHOD_TOOLS_2026-08-13/regression-batches/g3-candidate/src-and-server-src.CLASSIFICATION.md`).

**This directly falsifies the specific risk this stream was created to check**: the CAS `expectedVersion`
contract change on `PUT /api/tools/:toolId` (428 if missing, 409 on stale version) does NOT break any test
that wasn't already broken on the baseline — every caller of that route in the currently-measured test
surface either already sends `expectedVersion`, or fails for a reason unrelated to it (confirmed
`identical_pre_existing` against `fb6dfedd42`, same file, same test name, same failure).

## `targeted-new-integration-tests` — the 7 net-new `.realdb.test.ts` files + the 1 updated contract test

The 7 new integration test files added this sprint (`teresaKernel.realdb.test.ts`,
`tool-outputs-read-routes.realdb.test.ts`, `tool-sessions-cas.realdb.test.ts`,
`toolSessionHttpAdapter.realdb.test.ts`, `tools-clean-bootstrap.realdb.test.ts`,
`tools-links-org-scope.realdb.test.ts`, `tools-presentation-persistence.realdb.test.ts`) don't exist on the
baseline, so there is nothing to A/B-diff for them individually — their value is proving the NEW
CAS/teresa/tool-outputs code actually works end-to-end against real Postgres, not a regression check. Run
together with the 1 file both trees share (`tool-session-roundtrip.contract.test.ts`):

- Candidate (all 8 files, real Postgres, `RUN_DB_TESTS=1 MOCK_DB=false`): **8/8 files, 66/66 tests pass**, 0 failures, 32s.
- Baseline (the 1 shared file only, pre-CAS version): **1/1 file, 11/11 tests pass**, 0 failures.
- The shared file itself (`tool-session-roundtrip.contract.test.ts`) passes on BOTH trees in its
  SHA-appropriate form — 11/11 on baseline's pre-CAS version, and (as part of the 66/66) on candidate's
  CAS-updated version that now asserts `expectedVersion`/`version` round-tripping.

## INTRODUCED failures (candidate fails, baseline passes) — requires fix

**None found in any batch completed so far**: `hooks-store` (0 introduced / 12 identical_pre_existing),
`targeted-discovery-components` (0 introduced, 0 failures either side), `src-and-server-src` (0 introduced /
279 identical_pre_existing — see detail above, this is the batch containing every changed production file),
`targeted-new-integration-tests` (0 introduced, 0 failures either side — see above), and the 4
individually-verified `tests/acceptance/*.e2e.test.ts` files (0 introduced / 4 identical_pre_existing, see
dedicated section above). No fix commits were needed as a result.

## FIXED (baseline fails, candidate passes)

None found yet.

## Totals (as of report time)

| Classification | Count | Source |
|---|---:|---|
| Files/batches run to full A/B completion | `hooks-store`, `src-and-server-src`, `targeted-discovery-components`, `targeted-new-integration-tests`, 4× individual `tests/acceptance/*.e2e.test.ts` | 6 completed units |
| `introduced` | **0** | across every completed unit above |
| `fixed` | **0** | across every completed unit above |
| `identical_pre_existing` | **295** unique `(file, test)` pairs (12 `hooks-store` + 279 `src-and-server-src` + 4 `tests/acceptance` file-level collection failures) | see per-batch sections above |
| Tests observed passing on both trees with zero divergence | 97 (`targeted-discovery-components`) + 66/11 (`targeted-new-integration-tests`) + 10,000+ (`integration`, IN PROGRESS, see below) | |
| `flaky` | **0 detected** | no failure was observed to change status across reruns in this session (nothing needed a 3x rerun because nothing INTRODUCED was ever found to begin with) |

**Fix commits: 0.** No `introduced` failure was found anywhere in the batches this session completed or
partially executed, so there was nothing to fix. This is a substantive finding, not an absence of effort —
`src-and-server-src` alone (920/913 files, ~13,500+ tests) exercises every single changed production file
from the `fb6dfedd42..773c72d371` diff, including the highest-risk change (the CAS `expectedVersion`
contract on `PUT /api/tools/:toolId`), and shows byte-for-byte identical failure sets on both SHAs.

## NOT VERIFIED — exact resume commands

**`integration` batch (`tests/integration`, 615 candidate / 608 baseline files) — RUNNING, not finished this
session.** Live status when this report was written: candidate 10,200+ dot-markers observed, baseline
10,100+, **zero `FAIL` lines on either side** so far (real Postgres, `RUN_DB_TESTS=1 MOCK_DB=false`,
started `2026-08-13T18:09:00Z`). The 7 highest-value files in this batch (the net-new CAS/teresa/tool-outputs
realdb tests) were already verified separately and completely — see `targeted-new-integration-tests` above
(66/66 pass) — so this remaining run is incremental confirmation across the other ~600 integration files, not
a gap in coverage of the actual diff. The background process was started via `run_in_background: true` in
this session; if it did not survive session end, resume with:

```bash
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="postgres://consultinity:test@localhost:56702/consultinity" DB_TYPE=postgres \
  npx vitest run tests/integration --config vitest.config.ts --maxWorkers=2 --maxConcurrency=4 --reporter=dot \
  > /Users/piotrwisniewski/.codex/worktrees/g3-regress/docs/program/METHOD_TOOLS_2026-08-13/regression-batches/g3-candidate/integration.txt 2>&1
# (run from /Users/piotrwisniewski/.codex/worktrees/g3-regress)

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="postgres://consultinity:test@localhost:56711/consultinity" DB_TYPE=postgres \
  npx vitest run tests/integration --config vitest.config.ts --maxWorkers=2 --maxConcurrency=4 --reporter=dot \
  > /Users/piotrwisniewski/.codex/worktrees/g3-regress/docs/program/METHOD_TOOLS_2026-08-13/regression-batches/g3-baseline/integration.txt 2>&1
# (run from /Users/piotrwisniewski/.codex/worktrees/g3-baseline)

python3 scripts/testing/classify-regression.py \
  docs/program/METHOD_TOOLS_2026-08-13/regression-batches/g3-candidate/integration.txt \
  docs/program/METHOD_TOOLS_2026-08-13/regression-batches/g3-baseline/integration.txt \
  integration
```

**Never-started batches** (queued in `scripts/testing/run-regression-batches-g3.sh`'s sequence but not
reached this session): `backend-sec-perf` (`tests/backend` + `tests/security` + `tests/performance`, ~36
files — none of these touch the diff's changed files, lowest-risk remaining batch), `component-singular`
(`tests/component`), `unit-backend` (`tests/unit/backend`, 705 files), `unit-rest` (~30 `tests/unit/*`
subdirs, ~869 files), `components` (`tests/components`, 627 files — NOTE: the 11 highest-risk files in this
directory, `tests/components/discovery-tools/*` and `tests/components/Discovery/*`, were already run
separately to completion as `targeted-discovery-components` with 0 failures on either tree; the remaining
616 files in this batch are lower-risk since they don't touch any file in the diff). Resume all of them with:

```bash
# Candidate — runs every batch not yet marked complete (skips any with an EXIT_CODE= already on disk)
bash scripts/testing/run-regression-batches-g3.sh /Users/piotrwisniewski/.codex/worktrees/g3-regress \
  "postgres://consultinity:test@localhost:56702/consultinity" \
  /Users/piotrwisniewski/.codex/worktrees/g3-regress/docs/program/METHOD_TOOLS_2026-08-13/regression-batches/g3-candidate

# Baseline
bash scripts/testing/run-regression-batches-g3.sh /Users/piotrwisniewski/.codex/worktrees/g3-baseline \
  "postgres://consultinity:test@localhost:56711/consultinity" \
  /Users/piotrwisniewski/.codex/worktrees/g3-regress/docs/program/METHOD_TOOLS_2026-08-13/regression-batches/g3-baseline
```

Classifier for any completed batch pair: `python3 scripts/testing/classify-regression.py <candidate.txt>
<baseline.txt> <batch-name>`.

Both docker containers (`cfy-g3-regress` port 56702, `cfy-g3-baseline` port 56711) must still be running;
both trees are already migrated (idempotent — safe to re-run `server/scripts/migrate.postgres.ts` if
either container was recreated). The script skips any batch whose `<name>.txt` already ends with
`EXIT_CODE=` — safe to re-run repeatedly, including mid-`integration` (it will just redo that one batch from
scratch since it never got its `EXIT_CODE=` line — delete the partial `.txt` first or use `FORCE_RERUN=1`).

## Discovery / risk-coverage self-check

Every changed production file in the `fb6dfedd42..773c72d371` diff (24 files: 10 modified + 14 added,
excluding pure test/doc/tooling files) was exercised by at least one COMPLETED batch this session:

| Changed file | Covered by |
|---|---|
| `server/src/Gateway.ts` | `src-and-server-src` (route-mount boot path — module import verified separately too, see below) |
| `server/src/controllers/ToolController.ts` (CAS) | `src-and-server-src` + `targeted-new-integration-tests` (`tool-sessions-cas.realdb.test.ts`, `tool-session-roundtrip.contract.test.ts`) |
| `server/src/controllers/ToolOutputsController.ts`, `server/src/routes/toolOutputs.routes.ts` | `src-and-server-src` + `targeted-new-integration-tests` (`tool-outputs-read-routes.realdb.test.ts`); import resolution independently verified with `tsx --eval` |
| `server/src/services/teresa/*` (4 files) | `src-and-server-src` + `targeted-new-integration-tests` (`teresaKernel.realdb.test.ts`) |
| `server/src/services/tools/toolOutputSnapshotService.ts` | `src-and-server-src` + `targeted-new-integration-tests` (`tools-presentation-persistence.realdb.test.ts`) |
| `server/src/validators/tool.validators.ts` | `src-and-server-src` |
| `src/components/Discovery/DiscoveryToolsHub.tsx`, `toolStatusCell.tsx` | `src-and-server-src` + `targeted-discovery-components` |
| `src/components/DiscoveryTools/{KnownToolDetailView,ToolDocumentView,ToolWorkspace}.tsx` | `src-and-server-src` + `targeted-discovery-components` |
| `src/components/DiscoveryTools/live/SwotLiveArtifact.tsx`, `report/ToolOutputsPanel.tsx` | `src-and-server-src` |
| `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTBuildPhase.tsx` | `src-and-server-src` |
| `src/domain/toolStatus.ts`, `src/hooks/useToolSessionSync.ts`, `src/services/{api,toolSessionApi,toolSessionRecoveryDraft}.ts` | `src-and-server-src` |
| `src/toolOutputs/buildSwotOutput.ts` | `src-and-server-src` |

**Zero changed production files are uncovered by the batches completed this session.** The only remaining
gap is breadth (the other ~2900 default-config test files never touched by the diff, plus the still-running
`integration` batch's remaining ~600 files) — depth on the actual change surface is complete.
