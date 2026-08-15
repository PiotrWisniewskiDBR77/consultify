# CONSOLIDATED-GATE-1 — 032ca27f7

Status: **FAIL**

Candidate: `032ca27f71a06256710cb5c7124df73ea11fb8de`

Executed: 2026-08-15

Scope: read-only product verification; no product or test fixes were made.

## Results

| Gate | Result | Evidence |
|---|---:|---|
| Changed-module matrix | PASS | 56/56 files; 158/158 tests |
| Standard discovery | PASS | 4,093 unique files; deterministic 12-shard 1:1 manifest |
| Standard suite | FAIL | 39,419 passed; 404 failed; 487 pending; 19 todo; 40,329 total |
| Result coverage | PASS | missing files 0; unexpected files 0 |
| Root typecheck | FAIL | 3 TypeScript errors |
| Server typecheck | FAIL | 21 TypeScript errors |
| Production build | PASS | Vite production build completed in 1m13s |
| Performance memory leak | PENDING | dedicated performance runtime; intentionally outside this gate |

The standard suite reported 198 non-green files. This is a genuine assertion/type gate failure,
not a discovery or substring-collision failure.

## Failure buckets

The buckets below are path-based triage, not claims that every file has the same root cause.

| Bucket | Non-green files | Immediate handling |
|---|---:|---|
| Legacy JavaScript route/integration harnesses | 64 | Port or classify against current auth/router contracts; do not mass-edit expectations |
| TypeScript integration contracts | 66 | Split current product regressions from environment/stale harness failures |
| Backend unit/security contracts | 16 | Review tenant/auth/guard expectation drift |
| Current server route/service suites | 10 | Treat as candidate product regressions until individually disproved |
| Mounted UI/component contracts | 8 | Re-run by module owner and compare current mounted contract |
| Test tooling/navigation contracts | 4 | Repair only in a separate bounded harness packet |
| Other unit/hooks/contracts | 30 | Assign by owning module after exact failure extraction |

High-signal current surfaces among the non-green files include Results VNext KPI/ROI/OKR,
presentation persistence/templates, interview reassignment IDOR, My Work calendar, DRD matrix,
organization profile persistence, and organization Knowledge Graph UI. The large legacy-route
population must not be interpreted as 64 independent product regressions without per-file triage.

## Typecheck blockers

Root typecheck:

- Two Transformation Case test fixtures lack `collaborationMode`, `currentEditor`, and
  `autonomyPolicyVersion`.
- `NotebookPage` does not satisfy `NotebookConflictPageLike` because the helper constraint
  requires an index signature.

Server typecheck:

- 21 errors are concentrated in `server/src/routes/v8/partner.routes.ts`: nullable partner or
  payout identifiers are passed to string-only operations, and `payout` can be null.

## Commands

```text
npx vitest run <changed-module files> --no-file-parallelism --retry=0 --bail=0 --reporter=default --reporter=json
CLEANUP_TEST_SHARDS=12 CLEANUP_TEST_CONCURRENCY=3 node scripts/testing/cleanup-test-matrix.mjs run-standard-sharded
npm run type-check
npm --prefix server run typecheck
npm run build
```

Machine summary: `docs/program/CONSOLIDATED_GATE_1_032ca27f7.json`.
