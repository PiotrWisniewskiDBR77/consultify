# Lane A — shared gate evidence

Branch: `codex/closure-claude-a-method-evidence`
Baseline: `64f507859c717494ffa5e83fae550173c9382230` / tag `closure-execution-baseline-v2-20260816`
Lease SHA-256: `a2f9be9983e3a03e5e64f1a51dca193199a5bec963a246c3b4fe94b378af1308`

These results are shared by every task in the lane. Task-specific denominators
live in each task's `TASK_EVIDENCE.json`.

## G0 — identity and lease

At baseline: `node scripts/cleanup/verify-closure-lane.mjs a closure-execution-baseline-v2-20260816`
→ `lane A lease PASS: 0 changed paths`. `git diff --check` clean before every commit.

**Known verifier artifact, documented rather than worked around.** The verifier
grants its `allowedNewRoots` exemption only to files that are *currently
untracked*:

```js
const isNew = !isTracked(file);
return !(isNew && allowedNewRoots[lane].some((rootPattern) => rootPattern.test(file)));
```

So a legitimately-placed new file starts being reported as a violation the
moment it is committed. Every lane-A new file lives under a path matching the
lane's own allowed pattern (`server/src/services/<domain>*/__tests__/`,
`server/src/routes/<domain>*/__tests__/`), and a classifier that separates the
artifact from a real breach is described in the handoff. This is reported, not
silenced: an integrator change request asks for `tracked AND matches
allowedNewRoots AND added after baseline` to be treated as equally exempt.

## G1 — discovery and static

| Command | Result |
| --- | --- |
| `npm run test:inventory:generate` | exit 0 |
| `npm run test:discovery-gate` | PASS — 4997 discovered, 4997 manifest entries, 4698 executed-classified |
| `npm run type-check` | exit 0, **0 TypeScript errors** (re-run after every commit) |
| `npm run build:backend` | exit 0 (re-run after every commit) |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run build` | exit 0 |

Pre-existing Vite warnings (stale browserslist, CSS deprecation, mixed
static/dynamic imports, large chunks) are recorded as existing build debt, not
promoted to failures and not hidden.

`test:inventory:generate` rewrites `docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json`,
which is outside this lane's lease. The regenerated file differed only in its
`generatedAt` timestamp — classification was byte-identical — so it was
restored rather than committed.

## G3 — fresh and upgrade PostgreSQL (authoritative)

Run on a clean `pgvector/pgvector:pg16` container (`consultify-closure-a-final`,
127.0.0.1:34920) with the strict application migration runner. `--safe` was
never used; `tests/acceptance/schema.mjs` was never accepted as migration proof.

```bash
CI=true DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts            # RUN1_EXIT=0
CI=true DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts            # RUN2_EXIT=0, applied zero
CI=true DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts --dry-run  # RUN3_EXIT=0, zero pending
```

Readback:

| Check | Result |
| --- | --- |
| `select status,count(*) from schema_migrations group by status` | `success = 706` — single row, zero failed, zero pending |
| baseline comparison | 703 at baseline + the 3 lane-A migrations = 706 |
| `information_schema.tables` (public) | 1558 (1557 + the dedup report table) |
| `uq_assessment_initiative_batches_one_active_per_assessment` | created |
| `uq_initiatives_audit_source_once` | created |
| `uq_audit_initiative_proposals_registered_initiative_id` | created |
| `uq_initiative_candidates_interview_insight_once` | created |
| `assessment_initiative_batch_dedup_reports` | one row: `rows_before=0 groups=0 superseded=0` — the idempotency guard is present and correct on a clean database |

`CI=true` is required to unlock a local database host
(`server/src/config/databaseTargetResolver.ts:111-118`). `NODE_ENV=test` was
deliberately **not** used as the database switch, because it substitutes a mock
database elsewhere in this repo and would have invalidated the evidence.

## G2 — measurement traps found and neutralised

Three measurement defects were found before they could produce false green, and
they apply to any future run of this lane:

1. **Positional paths are intersected with `include`, not additive.** Root
   `vitest.config.ts` collects only specific globs, so a test file outside them
   matches zero tests and the run reports success. All new lane-A tests were
   therefore placed under `server/src/services/<domain>*/__tests__/` or
   `server/src/routes/<domain>*/__tests__/`, which satisfy both the vitest
   include globs and the lane's allowed-new-root pattern. `tests/<domain>*/`
   satisfies the lease but is **not collected** — it must not be used.
2. **Silent retries.** Root `vitest.config.ts` sets `retry: CI ? 3 : 1` and
   `playwright.config.ts` sets `retries: CI ? 2 : 0`. Because `CI=true` is
   required for database access, every run in this lane passes `--retry=0`
   explicitly.
3. **`timeout` does not exist on macOS**, so wrapping a command in it exits 127
   and can read as a clean result.

Leased Vitest manifest: 195 entries, all present on disk. `vitest list`
collects 186. The nine differences are each accounted for and none is a silent
loss:

| Excluded | Count | Reason |
| --- | ---: | --- |
| `kernelTestDb.ts`, `testFixtures.ts` ×2 | 3 | helper/fixture modules, not test files |
| `tests/acceptance/*.e2e.test.ts` | 5 | run under the separate `vitest.acceptance.config.ts` (`npm run test:acceptance`) |
| `RapidLeanObservationForm.test.tsx.skip` | 1 | deliberately disabled by file extension |

## G4 — signed-in browser

Not satisfied at the time of writing. The standard harness fails during
`tests/e2e/smoke/global-setup.ts` bootstrap with `503 SERVER_STARTING`,
`database: initializing` — the backend does not report its database ready inside
the setup window. Root-cause work is recorded per task; this is stated as an
open gate rather than substituted with a mocked or intercepted run, which the
gate catalog explicitly forbids.
