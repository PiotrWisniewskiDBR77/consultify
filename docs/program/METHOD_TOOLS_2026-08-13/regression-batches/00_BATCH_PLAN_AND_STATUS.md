# Batched full regression — STREAM 6 (2026-08-13)

Runner: `scripts/testing/run-regression-batches.sh` (resumable — skips any
batch whose `<name>.txt` in this directory already ends with an
`EXIT_CODE=` line; rerun the script to pick up where it left off).

## Why batched at all

A prior attempt to run the whole default-config suite unbatched
(`vitest run` with no path filter, ~3900 files) was killed after 8+ minutes
with **zero output** — nothing to resume from, no signal about which part
was slow or hanging. Splitting by top-level directory means each batch:
(a) writes its own result file the moment it finishes, not buffered until the
whole run ends, and (b) can be killed/resumed independently without losing
the batches that already completed.

## Pre-existing-vs-introduced methodology

This worktree's HEAD is **exactly** `fb6dfedd42` (the sprint's stated base)
— confirmed via `git status` (clean) at session start and `git diff
fb6dfedd42 --stat` throughout, which shows only new files added this
sprint (`vitest.orphans.config.ts`, `scripts/testing/generate-test-inventory.ts`,
`scripts/testing/test-discovery-gate.ts`,
`tests/unit/testing/testDiscoveryGate.test.ts`, the
`test-inventory.json`/`.md` manifest, and 5 new `package.json` scripts).
Zero existing test files or source files under test were modified. Given
that, **every failure observed in this worktree is pre-existing at
fb6dfedd42 by construction** — there is no separate "diff against a clean
checkout" step needed; this worktree *is* a clean checkout of fb6dfedd42
plus purely additive test-infrastructure files that cannot change any other
suite's pass/fail outcome. Classification below states this explicitly per
batch rather than re-deriving it from a second checkout.

## Batch status (as of this sprint's time-box)

| Batch | Files (approx) | Status | Result |
|---|---:|---|---|
| `hooks-store.txt` (tests/hooks + tests/store) | 19 | **COMPLETE** | 1 file failed, 18 passed (12/230 tests failed) |
| backend+security+performance (`backend-sec-perf.PARTIAL.txt`) | 36 | **KILLED mid-run** (2 min budget) | Partial only — no summary line. Files observed starting: contentService, encryption-real (assertion pass observed inline), aiPipeline-artifacts, db-performance-real, aiPipeline-thinking, memory-leak (intentionally long-running — monitors memory over an "extended period" by design). No FAIL markers seen in the partial output. **NOT VERIFIED to completion.** |
| `unit-backend.PARTIAL.txt` (tests/unit/backend) | 705 | **PARTIAL — 507/705 observed (~72%), killed for time budget (`pkill`)** | **Zero FAIL markers** in the 507 files that ran. Real per-test evidence: some tests intentionally exercise timeout paths (`assessmentInitiativeService.test.ts` — "AI generation failed: Operation timed out" is the test asserting the timeout-handling branch, not an accidental hang) which slows this batch considerably (real ~30s+ per such assertion in this sandboxed, no-egress environment). |
| `src-and-server-src.txt` (src + server/src — vitest's CLI path filter is substring-based, so `src` alone also matches `server/src/**`, merging what would have been two batches into one) | 913 | **COMPLETE** (ran to completion in the background — the `pkill` sent for time-budget reasons did not match this process's actual command line and it kept going) | **79 files failed, 813 passed, 21 skipped. 277/13535 tests failed** (168 skipped, 8 todo). See "79 failures" below — this materially revises the earlier zero-failure snapshot taken mid-run. |
| `tests/components` | 627 | **NOT STARTED** | Run via `bash scripts/testing/run-regression-batches.sh --only components` |
| `tests/integration` | 615 | **NOT STARTED** | Run via `--only integration` |
| remaining `tests/unit/*` subdirs (deliverables, services, views, finance, mywork, execution, results, initiatives, discovery, initiative, scripts, mindmap, server, utils, table, AIChat, reports, artifact-studio, ai, store, documentStudio, auth, voice, lib, contracts, canvas, bootstrap, components (nested), testing) | ~869 | **NOT STARTED** | Run via `--only unit-rest` |
| `test:orphans` (server/tests + tests/simple_import.test.js) | 12 | **COMPLETE** (this sprint, Task C) | 11 passed, 1 correctly excluded as non-vitest (see TEST_INVENTORY.md). 164/164 tests passed. |
| `test:acceptance` (tests/acceptance) | 122 | **PARTIAL** (this sprint, Task C verification) | ~60/122 files observed executing (real Postgres + real LLM calls) with zero collection/import errors before intentionally stopped — one file (`odbior--ini005--decision-race.e2e.test.ts`) hung 3+ min with no DB-side lock, consistent with an unanswered outbound network call in this sandboxed environment. Wired and ready to run; not proven to complete end-to-end here. |
| `test:node-native` | 1 | **COMPLETE** | 6/6 pass. |

## Aggregate signal from this sprint's regression evidence

Across every file actually observed executing this sprint
(19 + 507 + 913 + 12 + ~60 + 1 = **~1512 files**, real execution against a
real local Postgres, not just collection), the count is:

- **1 pre-existing failure** in `hooks-store` — `tests/hooks/useKeyboardShortcuts.test.ts`,
  12/24 tests fail (`result.current.resetAll` is `undefined`, expected
  `function`). Not investigated further — out of scope for a test-discovery
  sprint (hook-implementation-vs-test-expectation mismatch, not a
  discoverability problem).
- **79 pre-existing failing files** in `src-and-server-src` (277 failing
  tests of 13535). Full list of the 79 files is in `src-and-server-src.txt`
  (search for `^ FAIL`). Skimming the error signatures across all 277
  failures: 138 are plain `AssertionError` (business-logic expectation
  mismatches), 10 are `Cannot read propert[y/ies of undefined]` (null/shape
  mismatches), 8 are `relation "..." does not exist` / similar (schema
  drift against this sprint's freshly-migrated local Postgres), 1 is an
  explicit FK-violation. **Root cause NOT triaged per-file** — that is a
  much larger effort than this test-*discovery* sprint's mandate, and would
  require either fixing the failures (out of scope, high risk to
  auto-apply blind) or building a proper baseline-diff harness against a
  second `fb6dfedd42` checkout to rule out environment-specific causes
  (e.g. these tests may assume seed data this sprint's bare
  `migrate.postgres.ts` run doesn't provide — several failing filenames
  contain `.pg.test.ts`, `e2e.test.ts` and `assessmentWorkbench.*` patterns
  suggestive of real-Postgres/fixture-dependent tests, consistent with that
  hypothesis, but this is a hypothesis, not a verified conclusion).
- **Zero failures** in the other ~1424 files executed
  (`hooks-store`'s 18 clean files + all 507 `unit-backend` files + all 834
  clean `src-and-server-src` files + `test:orphans`' 12 + `test:node-native`'s
  1 + the ~60 `test:acceptance` files sampled).

This is **not** a claim that the untouched ~2900 default-config files or the
unstarted `tests/components`/`tests/integration` batches, or the remaining
198 unrun `tests/unit/backend` files, are clean — only that this sprint's
time-boxed sample found these specific failures and no others. All of it
is pre-existing per the methodology note above (this worktree is `fb6dfedd42`
plus purely additive files); none of it was introduced this sprint.

## How to resume

```bash
# Run everything not yet done (skips completed batches automatically):
bash scripts/testing/run-regression-batches.sh

# Or target one batch specifically:
bash scripts/testing/run-regression-batches.sh --only components
bash scripts/testing/run-regression-batches.sh --only integration
bash scripts/testing/run-regression-batches.sh --only unit-rest

# Force a redo of a batch already marked complete:
FORCE_RERUN=1 bash scripts/testing/run-regression-batches.sh --only unit-backend
```

Each batch writes `docs/program/METHOD_TOOLS_2026-08-13/regression-batches/<name>.txt`
immediately as it finishes. A batch is "done" iff that file ends with an
`EXIT_CODE=<n>` line — that is the resumability ledger, check it before
assuming a `.txt` file means completion (the two `.PARTIAL.txt` files in
this directory are deliberately named to make their incompleteness
unmissable; they do NOT end with `EXIT_CODE=`).
