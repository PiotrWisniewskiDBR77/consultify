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

## Current correction and deployment checkpoint — 2026-08-12 19:17 Europe/Warsaw

The current correction candidate is `e320ab345670950d015fd6915743760717ecb4c7` on
`codex/initiatives-execution-final-candidate`. Local HEAD and pushed branch HEAD are equal and the
worktree is clean. The candidate was deployed only to Railway `demo` as deployment
`84180969-478c-4dad-98e6-75e22cb86dd6`; `/api/health.gitSha` returns the exact candidate SHA and
PostgreSQL/Redis are connected.

Evidence on this exact production/test tree:

- Initiatives/Execution unit: 59 files / 147 tests PASS;
- isolated PostgreSQL realDB: 78 suites / 89 tests PASS;
- ACO browser golden thread plus WCAG 200% and 390x844: 3/3 PASS;
- repository TypeScript, scoped ESLint and diff-check: PASS.

The browser rerun required only acceptance-locator alignment after the canonical UI started showing
business labels instead of technical identifiers; trace/readback proved the underlying command and
state transitions were correct. The refreshed screenshots are stored under
`docs/implementation/evidence/aco-browser-*.png`.

The logged-in manual nine-function walkthrough on Piotr's account remains `NOT VERIFIED` for this
current SHA. The earlier walkthrough below is historical evidence for an earlier candidate and must
not be promoted to current acceptance. The external receipt and rollback database copy are in
`/Users/piotrwisniewski/Developer/consultify-ie-backups/20260812-final-e320ab345/`.

## Historical demo acceptance checkpoint — 2026-08-12 11:35 Europe/Warsaw

The corrected code candidate `bda1293c1e1e8bf02719c4e76ce300f3841f9cf8` was pushed to
`origin/codex/initiatives-execution-final-candidate` and deployed only to Railway environment
`demo`. Deployment `bf4c00a2-fe68-4244-bb9a-eb0b9a4e222d` succeeded, but the runtime exposed a
stale manually pinned build identity. The demo variables `APP_BUILD_SHA` and `GIT_SHA` were corrected
to the candidate, causing replacement deployment `d67e049f-3eb4-4592-b089-28133c77aab1`.
Authoritative read-back then proved:

- `/ping` -> `200 pong`;
- `/api/health.status` -> `ok`;
- `/api/health.gitSha` -> `bda1293c1e1e8bf02719c4e76ce300f3841f9cf8`;
- PostgreSQL and Redis -> `connected`;
- 458 application migrations up to date and 445 Table Platform migrations already applied.

A logged-in full-size walkthrough was executed on Piotr's owner account at 1440x900 against this
exact runtime. All nine functions rendered their canonical table, Menu 2/3 and Settings2 chooser;
all populated registers exposed Preview, capability-driven kebab, right-click and Shift+F10 parity.
`Realizacje` correctly rendered a first-use empty state under `Active`; switching to `All` plus
`Closing` exposed the archived ACO Initiative and its exact Execution Case. Explicit `Open` paths
were proved for all nine workspaces, including Initiative Card, Execution Case, Intervention and
Report Run. Preview closed on Workbench entry. There was no document-level horizontal overflow,
load-error copy, page exception or raw owner UUID. Named optional-column visibility persisted after
reload under the screen-specific `persistKey` and was restored after the check.

Clean screenshots from the exact deployment are committed as
`docs/implementation/evidence/ie-demo-final-*-1440x900.png`. The local isolated PostgreSQL and full
ACO/WCAG evidence recorded below remains the destructive and lifecycle acceptance source; demo was
used only for non-destructive logged-in UI acceptance.

Accepted residuals, not release blockers for these two modules:

- the owner account's global locale is English while several domain labels remain Polish, so shared
  chrome such as `Open` can coexist with Polish domain copy; this is application-wide localization
  debt, not a missing command or false result;
- demo contains both golden-lineage and earlier manually created Initiative rows. They remain
  separately identifiable canonical records; no destructive cleanup was authorized;
- migration logs report historical rows without recorded checksums and approved historical checksum
  variants, but all migrations are up to date and history was not rewritten.

The documentation/evidence commit that contains this checkpoint must be redeployed once more so one
final SHA identifies code and the complete evidence packet. Production and the separate staging
environment remain untouched and unauthorized.

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
