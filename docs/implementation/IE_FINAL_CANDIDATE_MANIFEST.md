# Initiatives + Execution final candidate manifest

Generated: 2026-08-12 09:00 Europe/Warsaw

Branch: `codex/initiatives-execution-final-candidate`

Baseline and upstream before candidate commit: `856586f579e5a61b09586731ddce3971b843cf5d`

Target environment: Railway demo environment serving `demo.consultify.ai` only

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
2. Push only the candidate branch and deploy that exact SHA to the Railway demo environment.
3. Prove `/api/health` reports the candidate SHA and dependencies are healthy.
4. Execute the logged-in, full-size, nine-function manual acceptance from
   `IE_MANUAL_BUSINESS_AND_UX_ACCEPTANCE_PLAN.md` on Piotr's account.
5. Correct every FAIL, repeat all affected gates on a new exact candidate SHA, and update this
   manifest. `NOT VERIFIED` is not acceptance.

## Candidate correction checkpoint — 2026-08-12 10:35 Europe/Warsaw

The first logged-in demo pass on candidate `bbe5e8d2eca0eb5e25cda052670a270cc482ed0b`
found two visual defects in the canonical registers. They are corrected in the production/test tree
described by this checkpoint:

- Initiative and Execution rows no longer expose the signed-in owner's raw principal UUID as the
  primary owner label. The exact principal ID remains in the canonical record while the register
  renders the actor display name; stable named business roles are humanized.
- the Portfolio membership title column now uses a valid pixel width instead of a percentage string
  that the canonical table parser interpreted as 28 pixels. The preview also presents a concise
  scenario-version label while retaining the exact scenario reference in accessible detail.

Fresh automated evidence on the exact production/test tree, before its single candidate commit:

- repository-wide TypeScript type-check: PASS (exit 0);
- Initiatives/Execution unit suite: 59/59 files and 146/146 tests PASS, including the new raw-owner
  regression;
- isolated PostgreSQL realDB suite: 38/38 files and 88/88 tests PASS on
  `consultify_ie_final_20260812_1025`, executed sequentially;
- full ACO browser golden thread, WCAG 200% text resize and 390x844 responsive gate: 3/3 PASS on
  `consultify_ie_browser_final_20260812_1030` in 5.8 minutes;
- focused ESLint and `git diff --check`: PASS;
- temporary manual-acceptance scripts containing demo credentials were removed before candidate
  creation and are not part of the Git tree.

This checkpoint does not by itself close manual demo acceptance. The corrected exact SHA must be
deployed to demo, verified through `/api/health.gitSha`, and all nine logged-in functions must be
rechecked at full size. Production and the separate staging service remain out of scope.

## Rollback

- Application rollback target: baseline SHA `856586f579e5a61b09586731ddce3971b843cf5d`.
- Environment scope: Railway demo environment only.
- Do not roll back PostgreSQL volumes or production services as part of this candidate flow.
- If post-deploy health or manual P0 acceptance fails, stop acceptance, redeploy the baseline SHA to
  demo, verify `/api/health`, and preserve candidate logs/screenshots before further changes.
