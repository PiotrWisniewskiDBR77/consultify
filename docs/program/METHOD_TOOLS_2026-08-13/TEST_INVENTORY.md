# Test Inventory + Discovery Gate — STREAM 6 (2026-08-13)

Worktree: `/Users/piotrwisniewski/.codex/worktrees/f6-disco`, branch
`codex/final-f6-disco`, base `fb6dfedd42`. DB: docker `cfy-f6-disco`, port
56603.

Machine-readable manifest:
`docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json` (regenerate with
`npm run test:inventory:generate`).

## What this is

Every `*.test.*` / `*.spec.*` file tracked in git (4220 as of this sprint,
via `git ls-files`), classified into exactly one bucket, with a one-line
reason. The discovery gate (`npm run test:discovery-gate`, permanent
regression at `tests/unit/testing/testDiscoveryGate.test.ts`) fails when a
discovered file has no classification, or when a file classified `ACTIVE`
is not actually collected by any wired runner.

## Verified baseline (re-measured this sprint, not re-quoted from memory)

- `rg`-style discovery via `git ls-files` filtered to test-file naming:
  **4220** files (small drift from the ~4215 previously recorded — a few
  files landed from parallel sprint streams in the meantime; expected).
- Default `vitest list --filesOnly --config vitest.config.ts`: **3792**
  files collected (was ~3795 — same drift).
- Gap: **428** files not covered by the default config alone.

## Classification counts

| Bucket | Count | Meaning |
|---|---:|---|
| `ACTIVE` | 3928 | Collected by a wired vitest config, or the one wired `node:test` file. |
| `PLAYWRIGHT` | 283 | Imports `@playwright/test`; runs under `playwright test`, not vitest. |
| `INTENTIONALLY_EXCLUDED` | 7 | Explicitly, deliberately excluded with a documented reason already present in the repo. |
| `LEGACY` | 1 | Not a real automated-test-runner suite; runnable manually only. |
| `BROKEN_ORPHAN` | 1 | Genuinely invisible to every runner; real finding, needs owner triage. |

`ACTIVE` breaks down by runner as: 3792 default `vitest.config.ts` + 122
`vitest.acceptance.config.ts` (wired this sprint) + 12
`vitest.orphans.config.ts` (wired this sprint) + 1 `node --test` (wired this
sprint) + 1 the discovery-gate's own test file = 3928.

`PLAYWRIGHT` classification is **content-based**, not path-based: a file is
only bucketed `PLAYWRIGHT` if it textually imports `@playwright/test`. This
caught a file that path-matches the playwright convention but isn't one —
see Finding 4 below.

## The three pre-existing findings from the prior measured run — verified, then fixed

### 1. `tests/acceptance/**` (122 files) — had a config, zero wiring

`vitest.acceptance.config.ts` existed and correctly targets
`tests/acceptance/**/*.{test,spec}.{ts,tsx,js,mjs}`, but no `package.json`
script and no CI job ever invoked it. **Verified by actually collecting**
(not by reading the config): `npx vitest list --filesOnly --config
vitest.acceptance.config.ts` returns all 122 files cleanly, and running a
real batch (`npx vitest run --config vitest.acceptance.config.ts`,
first ~60 files before intentionally stopping — see "What was NOT
verified") produced no collection/resolution errors of any kind.

**Correction to the prior established fact**: the claim that
`vitest.acceptance.config.ts` "lacks the `resolve.alias` block ... so any
transitive `@/...` import 500s at collection time" did **not** reproduce.
None of the 122 acceptance test files import from `@/` directly, and none
of the ~60 files actually executed hit an import-resolution error. The
config was left unmodified — no alias fix was needed to unblock collection
(the task's mandate was to fix it *if* it blocks collection; it does not,
verified live, not by reading).

**Fix**: wired `npm run test:acceptance` →
`DB_TYPE=postgres NODE_ENV=test vitest run --config vitest.acceptance.config.ts`.

### 2. `tests/simple_import.test.js` — structurally invisible root file

Sits at `tests/` root; every include glob in `vitest.config.ts` is
`tests/<subdir>/**`, so no pattern can ever match a file directly in
`tests/`. Also worth noting for anyone touching this again:
`/tests/*` is in `.gitignore` (line 229) — new files dropped at `tests/`
root need `git add -f` or they silently never enter version control (this
file itself predates that gitignore rule).

**Fix**: wired into a new `vitest.orphans.config.ts` (include:
`tests/simple_import.test.js` + `server/tests/**`), run via
`npm run test:orphans`. Verified passing (1/1).

### 3. `server/tests/**` (12 files) — orphaned runner, real DB dependency

Confirmed structurally excluded: `vitest.config.ts` has a commented-out
include line with the explanation "server/tests excluded - require full DB
schema", and no other config ever pointed at the directory. Even running
`npx vitest run server/tests/unit/storagePaths.test.ts` directly fails with
"No test files found" — an explicit path positional is *intersected* with
`include`, not unioned, so pointing vitest straight at a file outside every
include glob still collects nothing.

**Fix**: same `vitest.orphans.config.ts` / `npm run test:orphans` as above.
Ran against the real local Postgres (`docker cfy-f6-disco`, fully migrated
via `server/scripts/migrate.postgres.ts`, `NODE_ENV=test`, never `--safe`):
**11 of 12 files pass cleanly** (164 tests, 0 failures).

The 12th, `server/tests/virtual-workers-integration.test.ts`, is **not a
vitest suite** — it defines its own ad-hoc `test()` helper, expects a live
HTTP backend on `localhost:3001`, and ends with
`main().catch(() => process.exit(1))`. Under vitest: "No test suite found
in file". Classified `LEGACY`; deliberately excluded from
`vitest.orphans.config.ts` with a comment explaining why. Run it manually
with `tsx server/tests/virtual-workers-integration.test.ts` against a
running backend.

## Finding 4 (new, found while building the classification, not in the prior established-facts list)

### `tests/e2e/security-cookie-auth.spec.ts` — invisible to BOTH runners, and failing when finally run

This file lives in `tests/e2e/` (Playwright's `testDir`) and is named
`*.spec.ts`, so at a glance it looks like a Playwright test. It is not: it
imports `describe`/`it`/`expect`/`vi` from **`vitest`**, not
`@playwright/test`.

- **Invisible to vitest**: `vitest.config.ts` explicitly excludes
  `tests/e2e/**` wholesale (`exclude: [..., 'tests/e2e/**', ...]`).
- **Invisible to Playwright too**: `npx playwright test
  tests/e2e/security-cookie-auth.spec.ts --list` → `Total: 0 tests in 0
  files` (the file contains zero Playwright `test()` calls, so Playwright's
  loader finds nothing to run — no error, no signal, just silence).

Classified `BROKEN_ORPHAN` — this is a genuine, non-deliberate discovery
gap, exactly the class of bug the discovery gate exists to catch.

**When run standalone** (isolated probe config, same resolve/env as the
default config): **7 of 11 tests fail.** The failures cluster in a
"Production Environment Guards" describe block: tests flip
`process.env.NODE_ENV = 'production'` at test-run time and expect
`verifyToken` to then reject E2E-mode/test-bypass auth. But
`server/src/middleware/auth.middleware.ts:27` computes
`const isProductionEnv = process.env.NODE_ENV === 'production'` **once, at
module load** — changing `process.env.NODE_ENV` afterward has no effect on
already-imported middleware. Two possible readings, both worth an owner's
attention and **neither pursued further in this test-discovery sprint**
(out of scope — this stream is about visibility, not behavior changes to
auth middleware):

1. The test is simply wrong/stale (can't validate a load-time constant by
   mutating env vars mid-process) — likely, and the safest read given
   real deployments set `NODE_ENV` once at process start.
2. Or: nothing today would catch a genuine misconfiguration where
   `NODE_ENV` flips after the middleware module is first loaded (e.g. a
   process-reuse / warm-start deployment topology) — worth confirming is
   not this codebase's actual deploy shape.

Not wired into a runner in this sprint; flagged for follow-up rather than
silently fixed, per the sprint's own instruction not to make behavior
changes outside test-infrastructure scope.

### Bonus: `scripts/testing/__tests__/artifact-studio-release-evidence-gate.test.mjs`

Uses Node's built-in `node:test` runner (not vitest — `import test from
'node:test'`), 6 real assertions against
`scripts/testing/artifact-studio-release-evidence-gate.mjs`. Never wired to
any npm script; the release-evidence runbook only documents invoking the
gate script directly, never this test file. Verified runnable and green:
`node --test scripts/testing/__tests__/artifact-studio-release-evidence-gate.test.mjs`
→ 6/6 pass. Wired via `npm run test:node-native`. Classified `ACTIVE`
(has a real runner now).

## `INTENTIONALLY_EXCLUDED` (7 files)

- `tests/unit/backend/services/StageGateService.test.ts` — explicit
  duplicate-file exclude already in `vitest.config.ts` ("use the .js version
  instead").
- `server/src/_backup/ts-js-collisions/**` (6 files) — a **tracked-but-
  gitignored** historical snapshot tree (`.gitignore:217` has `_backup/`,
  but these files were tracked before that rule existed, so `git ls-files`
  still lists them even though new files under that path can't be added
  without `-f`). `vitest.config.ts` already has a dedicated blanket exclude
  (`server/src/_backup/**`, comment: "never run as live tests"). One
  deliberate exclusion covers the whole subtree — not a gap.

## `PLAYWRIGHT` (283 files)

All 283 import `@playwright/test`. 282 of them sit under `tests/e2e/**`
(matching `playwright.config.ts`'s `testDir: './tests/e2e'`, which via
default `testMatch` also covers the `smoke/`, `m06/`, `tools/`,
`documents/`, etc. subdirectories used by the various
`playwright.*.config.ts` project files); the remaining 2 are
`tests/accessibility/*.spec.ts` (explicitly excluded from vitest's include
by name) and 2 more under `tests/visual/` / `tests/visual-regression/`
(explicitly excluded by directory) — both call-outs already documented in
`vitest.config.ts`'s own exclude-list comments.

One file, `tests/e2e/security-cookie-auth.spec.ts`, sits in the same
directory and is named the same way but does **not** import
`@playwright/test` — see Finding 4 above. Content-based classification
(grep the actual import, not the path) is what caught this; a path-only
rule (`tests/e2e/** → PLAYWRIGHT`) would have silently mis-classified it as
"fine, Playwright's got it."

## Negative control — proof the gate can fail

Performed live during this sprint (not simulated after the fact):

1. Created `tests/unit/__gate_negative_control__/throwaway.test.ts` (a
   trivial passing vitest test), `git add -f`'d it (required —
   `/tests/*` is gitignored for new top-level entries, and this subdirectory
   needed the same treatment path as any other net-new test dir).
2. Ran `npx tsx scripts/testing/test-discovery-gate.ts`:
   ```
   Discovered: 4220
   Manifest entries: 4219
   Executed (vitest-collected + node:test): 3928

   UNCLASSIFIED (1) — discovered but no manifest entry:
     tests/unit/__gate_negative_control__/throwaway.test.ts

   Discovery gate: FAIL
   ```
   Exit code 1. The gate named the exact offending file.
3. Second scenario, the other failure mode: created
   `tests/__gate_negative_control_active__.test.ts` (root of `tests/`,
   matches no include glob — same structural bug class as
   `tests/simple_import.test.js` before it was wired), force-added it, and
   manually added a manifest entry wrongly claiming `ACTIVE`:
   ```
   ACTIVE_BUT_NOT_EXECUTED (1) — classified ACTIVE but no configured runner collects it:
     tests/__gate_negative_control_active__.test.ts

   Discovery gate: FAIL
   ```
   Exit code 1.
4. Removed both throwaway files and the tampered manifest entries,
   regenerated the manifest (`npm run test:inventory:generate`), reran the
   gate: clean `PASS`, exit 0.

Permanent, side-effect-free regression coverage for both failure modes
(synthetic in-memory fixtures, no repo mutation) lives in
`tests/unit/testing/testDiscoveryGate.test.ts`, plus a fifth test that runs
the gate against the actual live repo state on every normal test run.

## What was run vs. what was NOT verified

- **Verified by full collection** (cheap, deterministic, no side effects):
  every `ACTIVE` file is confirmed collected by its runner via
  `vitest list --filesOnly`. This is what the discovery gate checks on
  every run — collection, not execution.
- **Verified by partial real execution**: `npm run test:orphans` (all 12
  files, real Postgres) — 11/12 pass, 1 correctly excluded as non-vitest.
  `vitest run --config vitest.acceptance.config.ts` — ran real Postgres +
  real LLM calls; observed ~60 of 122 files execute cleanly (mix of
  pass/fail on business-logic assertions, zero collection/import errors)
  before the run was intentionally killed (see below).
- **NOT fully executed, by design**: the full 122-file
  `tests/acceptance/**` suite was not run to completion in this sprint. One
  file, `tests/acceptance/odbior--ini005--decision-race.e2e.test.ts`, hung
  for 3+ minutes at 0% CPU with no Postgres-side lock or wait event visible
  (`pg_stat_activity` showed nothing blocked) — consistent with a real
  outbound network call (LLM API) with no response in this sandboxed
  environment, rather than a test/DB bug. `test:acceptance` is wired and
  ready to run in an environment with real network egress; it was not
  proven to complete end-to-end here. This is a data point for whoever
  owns CI wiring next, not a claim that the suite is broken.
- **NOT wired to CI** (`.github/workflows/test-suite.yml`): `test:acceptance`,
  `test:orphans`, and `test:node-native` are runnable locally/in any CI with
  DB access, but no workflow job invokes them yet. Explicit scope decision,
  not an oversight — CI wiring needs someone to decide the acceptance
  suite's network/LLM dependency story (mocked vs. real) first.
