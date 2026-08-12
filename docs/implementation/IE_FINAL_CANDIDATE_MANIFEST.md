# Initiatives + Execution final candidate manifest

Generated: 2026-08-12 09:00 Europe/Warsaw

Branch: `codex/initiatives-execution-final-candidate`

Baseline and upstream before candidate commit: `856586f579e5a61b09586731ddce3971b843cf5d`

Target environment: Railway `staging` / `demo.consultify.ai` only

Production deployment: **NOT AUTHORIZED / MUST NOT RUN**

## Scope

The candidate contains the final UI/UX correction set and reproducible acceptance evidence for the
four Initiatives functions and five Execution functions. The functional backend/domain foundation
is inherited from the baseline commit. The correction set changes 45 tracked paths before this
manifest: six production surfaces, three shared components, focused tests, the manual acceptance
plan and refreshed ACO browser screenshots.

## Automated evidence on the same pre-commit tree

- TypeScript repository type-check: PASS.
- Initiatives/Execution unit suite: 59/59 files, 145/145 tests PASS.
- Isolated PostgreSQL realDB suite: 38/38 files, 88/88 tests PASS on
  `consultify_ie_final_20260812_0855`, run sequentially.
- Full ACO Playwright golden thread plus WCAG 200% and 390x844 responsive gate: 3/3 PASS in 54.7s
  on `consultify_ie_browser_final_20260812_0858`.
- Focused ESLint for the final Work/Capacity/shared/test delta: PASS.
- `git diff --check`: PASS.

The earlier parallel realDB run is excluded from evidence: concurrent suites executed identical
migrations and cleanup against one database and produced deadlocks/fixture collisions. Only the
fresh sequential 38/38 result is authoritative.

## Source preservation

Final pre-commit source archive:

`/Users/piotrwisniewski/Developer/consultify-ie-backups/20260812-0905-final-commit/changed-files.tar.gz`

SHA-256:

`232fbfaecbca2429b523bf73fa4b67bdc1af97f21390fecf44e8a469ed386f2d`

The archive contains the 45 tracked changed paths and intentionally excludes this newly added
manifest to avoid a self-referential archive checksum. It is recovery evidence for changed files
only, not Git reachability, deployment or acceptance evidence.

## Remaining release gates

1. Create and record one candidate commit SHA.
2. Push only the candidate branch and deploy that exact SHA to Railway staging/demo.
3. Prove `/api/health` reports the candidate SHA and dependencies are healthy.
4. Execute the logged-in, full-size, nine-function manual acceptance from
   `IE_MANUAL_BUSINESS_AND_UX_ACCEPTANCE_PLAN.md` on Piotr's account.
5. Correct every FAIL, repeat all affected gates on a new exact candidate SHA, and update this
   manifest. `NOT VERIFIED` is not acceptance.

## Rollback

- Application rollback target: baseline SHA `856586f579e5a61b09586731ddce3971b843cf5d`.
- Environment scope: Railway staging/demo only.
- Do not roll back PostgreSQL volumes or production services as part of this candidate flow.
- If post-deploy health or manual P0 acceptance fails, stop acceptance, redeploy the baseline SHA to
  staging, verify `/api/health`, and preserve candidate logs/screenshots before further changes.
