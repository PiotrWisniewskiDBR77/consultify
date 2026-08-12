# IE-001 evidence log

This log records candidate evidence. `PASS` here does not by itself change a task to `ACCEPTED` and
does not imply runtime, browser, deployment or release acceptance.

## 2026-08-12 — exact demo candidate `178471b` automated checkpoint

- branch: `codex/initiatives-execution-final-candidate`;
- tested and deployed candidate: `178471b0523421d619b549df1f286f08544aca0d`;
- Railway demo deployment: `aed3a7f1-6799-4e6e-a0c6-0bd2836d0cc8`, terminal `SUCCESS`;
- `https://demo.consultify.ai/ping`: `pong`;
- `https://demo.consultify.ai/api/health`: application `ok`, PostgreSQL connected, Redis connected,
  exact `gitSha=178471b0523421d619b549df1f286f08544aca0d`;
- demo migration pre-deploy: 460 runtime files reconciled, 83 approved historical checksum variants
  accepted without rewriting history, 211 legacy NULL rows left explicitly unverifiable, database
  ready before traffic;
- local rollback backup before migration:
  `/Users/piotrwisniewski/Developer/consultify-ie-backups/20260812-demo-pre-migration/demo-before-checksum-ledger.dump`,
  SHA-256 `54feafc98f842a1546228af37ce060ebebfac5292c552551ff5e8b77d1a856fa`;
- Initiatives/Execution unit suite: 59/59 files, 146/146 tests PASS;
- isolated PostgreSQL realDB suite: 39/39 files, 89/89 tests PASS, including the governed NordWerk
  three-Initiative portfolio/plan/capacity case and authorization boundary matrix;
- complete ACO browser golden thread: 2/2 PASS through Initiatives, Portfolio, Plan, Capacity,
  Schedule/Handoff, Execution, Reports, Results, Closure and Archive;
- WCAG/browser geometry gate: 1/1 PASS across 12 canonical surfaces at 200% text and 390x844;
- repository-wide TypeScript: PASS with 8 GB heap;
- `git diff --check`: PASS;
- the first two full realDB attempts each reported one transient HTTP `socket hang up` while another
  stale full-repository Vitest runner was consuming the same machine. Both affected tests passed in
  isolation; after terminating only that stale runner, the complete sequential realDB suite passed
  39/39 and 89/89 without retry;
- logged-in manual demo interaction remains `NOT VERIFIED`: this Codex task has the open authenticated
  browser only as ambient state and exposes no callable Browser/Computer Use control channel. No
  keyboard, context-menu, Settings persistence, Open/Back or expert visual score is claimed from the
  automated harness.

## 2026-08-09 — foundation and Source Validation candidate

- isolated worktree: `/Users/piotrwisniewski/Developer/consultify-initiatives-execution-20260809`;
- branch: `codex/initiatives-execution-20260809`;
- baseline: `635fd2d48d5a396c45bcb43b7f363535403ecf93`;
- source worktree was not modified by this implementation;
- unit command: `npx vitest run tests/unit/initiatives-execution --reporter=dot`;
- unit result: `14 files / 50 tests PASS`;
- realDB command: `DATABASE_URL=<isolated consultify-ie-e2e PostgreSQL> IE_TEST_DATABASE_URL=<the same isolated PostgreSQL> npx vitest run --config tests/integration/initiatives-execution/vitest.realdb.config.ts --reporter=dot`;
- realDB result: `13 files / 46 tests PASS`;
- browser command: `NODE_ENV=test DATABASE_URL=<isolated consultify-ie-e2e PostgreSQL> npx playwright test --config playwright.initiatives-execution.config.ts --workers=1`;
- browser result: `1 test PASS` against the isolated PostgreSQL runtime;
- browser proof covers Source Proposal table -> preview -> confirmed Register -> exact canonical
  Initiative Card -> persisted Initiative/lineage verification after browser reload;
- visual artifact:
  `docs/implementation/evidence/aco-browser-registered-initiative-card.png`;
- realDB harness is explicitly sequential because its files rebuild the same isolated schema;
- focused ESLint on all new runtime/domain/UI files: `PASS`;
- `git diff --check`: `PASS`;
- full frontend TypeScript remains globally red on pre-existing missing spreadsheet/shared modules;
- full server TypeScript remains globally red on pre-existing errors outside the IE allowlist;
- focused TypeScript output contains no IE runtime, Source Proposal, canonical Card or My Work
  projection error after the current 42-unit / 44-realDB / 1-browser runs.

Candidate behavior evidenced:

1. Register reads locked source truth and atomically persists one Initiative, lineage, audit, outbox,
   idempotency receipt and source read-back.
2. Register replay returns the original durable result; changed content under the same request ID is
   rejected without a second effect.
3. `MERGE`, `EXTEND`, `RETURN`, `DEFER` and `DISMISS` persist governed Decision records and update the
   existing source proposal in the same transaction.
4. `MERGE` and `EXTEND` require an existing, tenant-visible Initiative and never create a competing
   Initiative.
5. UI keeps command IDs stable across retry, distinguishes conflict/permission/failure/read-back,
   requires impact confirmation for Register and mandatory human fields for other dispositions.
6. Legacy `CandidatesPanel` Accept write is no longer mounted in InitiativesHub; the endpoint is not
   deleted pending explicit legacy-consumer disposition.
7. The exact 26-card selection, ordering and optional omission are written through the material
   command path, survive realDB read-back and replay idempotently; required omission still requires
   a waiver Decision.
8. Card `completion`, `quality` and `freshness` are independent explicit inputs. Editing non-empty
   text no longer manufactures `COMPLETE`, `SUFFICIENT` or a fresh review result.
9. Registration acceptance and projection read-back are separate states. A delayed read-back keeps
   the accepted canonical Initiative ID and reuses the same idempotency identifiers.
10. A pending Definition Decision is projected in My Work from the canonical Decision aggregate;
    approve/return uses that same ID and version, then removes it only after read-back.
11. One Definition finding can atomically create a canonical Finance evidence Task and technical
    option Decision. The Initiative stores their exact IDs, both have lineage relations, and the
    same IDs are projected to the named actors in My Work.
12. Definition readiness now requires eight reviewed, current, sufficiently evidenced business
    cards: Summary/Scope, Strategic Fit, Success Criteria, Outcomes/Benefits, Options including
    do-nothing, People/Team, Roles/RACI and Stakeholders.
13. The named Finance assignee and technical authority can resolve their own canonical work from My
    Work; completion requires evidence, a Decision requires a listed option plus rationale, and
    unauthorized actors cannot mutate either object.
14. Source refresh is version-bound. A newer source snapshot creates new immutable versions of every
    existing card and marks them `STALE` / `CHANGES_REQUESTED`; it does not manufacture a green gate.
15. One consolidated realDB ACO vertical proves registration/replay, 26-card selection, eight-card
    Definition evidence and independent review, remediation Task and Decision resolution, stale
    source detection, refresh and republish, Definition Decision, independent approval and final
    `DEFINED` reload with durable receipts, audit and outbox records.
16. The first browser slice proves the mounted React runtime and real PostgreSQL path, not merely a
    component mock. Its refreshed screenshot records the canonical workspace hierarchy: next action,
    separate 12-state lifecycle rail, grouped 26-card navigation, selected-card canvas and context
    rail with the exact readiness finding.
17. Card navigation supports the exact `cardKey` + `findingId` context, Enter/open moves focus to the
    selected canvas, and Back clears only card context while preserving the surrounding URL state.
18. Analysis Gate has a separate ten-card fail-closed readiness contract. Each applicable card must
    carry accepted human truth plus challenge and counter-evidence; the material path proves only
    `DEFINED -> ANALYZING -> READY_FOR_DECISION`, frozen card versions and independent authority.
19. A versioned Portfolio Scenario persists DRAFT/PUBLISHED/SUPERSEDED snapshots, memberships,
    visible score decomposition, rank/override rationale, coverage/overlap findings and honest rough
    demand states. Publishing a scenario does not mutate Initiative lifecycle.
20. Portfolio Decision is a separate material command per Initiative. It freezes the published
    scenario, Initiative and card versions, requires independent authority and only APPROVED or
    CONDITIONALLY_APPROVED can move `READY_FOR_DECISION -> APPROVED_BACKLOG`; there is no batch,
    schedule-date or capacity-commitment write in this slice.
21. Portfolio and Plan now expose tenant-scoped persistent scenario registers; the table-first UI no
    longer needs session/local-storage identity shadows.
22. Plan Scenario versions tentative windows, dependencies, constraints, assumptions and diff against
    one exact published Portfolio version. Draft moves and publish never update Initiative dates,
    Tasks or lifecycle; stale Portfolio and dependency cycles fail closed.
23. Capacity Scenario binds to the exact published Plan window, timezone and ordered periods. Demand
    and supply preserve `KNOWN`, `ESTIMATED`, `UNKNOWN` and `UNCONFIRMED`; unknown numeric values must
    remain null. Assignment proposal, assignee acceptance and Resource Manager commitment are
    distinct records, and no capacity command writes operational allocation or Initiative lifecycle.
24. Schedule Decision freezes Initiative/card/Portfolio/Plan/Capacity/commitment versions and fails
    closed on unknown critical supply, unresolved dependencies, missing Execution Manager and
    unaccepted critical assignments. Approval atomically creates `SCHEDULED` plus an immutable
    Handoff Package; it does not create an Execution Case.
25. Handoff Acceptance consumes that exact package. Return creates no case and keeps
    `SCHEDULED/HANDOFF_PENDING`; accept creates one canonical Execution Case, one constant
    Initiative-to-case relation and `IN_EXECUTION`. A concurrent-accept realDB test proves one winner,
    one conflict and one replayable case ID; pilot/waves remain children of that case.

Evidence still required before acceptance:

- production-equivalent authentication and negative browser-role coverage (the current browser
  harness supplies a named test actor header and is not production-auth acceptance);
- complete Menu 2 migration and full table filter/sort/scroll return-context browser proof;
- material-change impact preview and governed reapproval;
- browser proof of the complete Definition remediation/refresh/approval sequence (the complete chain
  is currently proven at HTTP + realDB level, while the browser proof ends at the registered Card);
- keyboard, focus-return, responsive and screen-reader acceptance;
- exact candidate commit/SHA (no commit authorized yet).

## 2026-08-10 — current integrated candidate snapshot

This is an implementation-candidate snapshot. It does not supersede the final ACO pass rule and does
not change any `READY_FOR_REVIEW` item to `ACCEPTED`.

### Implemented bounded verticals

- configurable `BASELINE_SMALL`, `STANDARD` and `COMPLEX` governance profiles, project override,
  role binding, quorum, separation, delegation and SLA snapshots;
- persisted signer-owned Gate Signoffs and quorum receipts for Definition, Analysis, Portfolio,
  Schedule, Handoff and Closure; expired delegation returns `403` and creates no evidence row;
- global Plan `windowUnit`, `timezone` and ordered periods as exact Capacity time-basis source;
- canonical Execution Milestones, Task links, Decision blockers, forecast variance and blast radius;
- versioned Report Definition with mandatory project/general-backlog scope and immutable publish;
- Report Run exact published-definition binding, frozen hash, refresh-as-new-draft and follow-up Task;
- Results KPI observations and Finance reconciliations as authoritative versioned references;
- Effectiveness Review -> immutable snapshot -> governed Closure -> `CLOSED` -> archive;
- central archive write guard and project-scoped authorization for canonical Initiative/Execution
  aggregates, lists and material writes. Legacy scope is `UNKNOWN` and read-only, never tenant-wide.

### Current commands and exact results

- unit command:
  `npx vitest run tests/unit/initiatives-execution --no-file-parallelism --maxWorkers=1 --reporter=default`;
- unit result: `59/59 files, 144/144 tests PASS`;
- focused realDB command covers Authorization Boundary, Report Definition, Results/Finance and
  Management Intervention;
- focused realDB result: `4 files / 9 tests PASS`;
- authorization matrix alone: `1 file / 4 tests PASS`, covering Viewer, unrelated project, foreign
  tenant, Admin without business binding, capability loss after list and expired delegation, with
  identical aggregate hash and zero audit/outbox/receipt mutation;
- integrated sequential isolated realDB on the dedicated PostgreSQL acceptance database:
  `38/38 files, 88/88 tests PASS`;
- governance profile regressions cover `BASELINE_SMALL`, `STANDARD` and `COMPLEX`, including exact
  signoff/quorum policy snapshots, separation, delegation and Admin fail-closed behavior;
- lint across every changed or untracked TypeScript/TSX path: `PASS` with zero errors;
- `git diff --check`: `PASS` after documentation update;
- global TypeScript remains exit `2` on exactly six unrelated errors outside this allowlist;
- no commit/SHA exists because staging/commit/push/deploy were not authorized.

### Browser and visual evidence

- current full browser composition: `3/3 PASS`, covering Source/Card, ACO steps `1–59` and the
  WCAG/responsive matrix;
- `25` ACO journey PNGs exist from registration through read-only archive;
- the current Playwright artifact contains `12` responsive PNGs at `390x844` and `12` matching
  200% text-resize PNGs across all nine functions plus Source, Card and My Work;
- steps `40–42` use `aco-browser-management-intervention-steps-40-42.png`;
- step `43` uses `aco-browser-plan-intervention-step-43.png`;
- steps `44–47` include Report Definition, Report Run, follow-up and refresh screenshots;
- steps `48–59` include Delivery, Results/Finance, Effectiveness, Closure and Archive screenshots;
- WCAG 200% text resize and narrow responsive verification pass.

### Acceptance disposition at the 2026-08-10 checkpoint

This checkpoint was `READY_FOR_REVIEW`, not yet accepted. It is superseded by the final 2026-08-11
acceptance record below.

## 2026-08-11 — nine-function full-shell correction and acceptance rerun

- full-shell local runtime was verified on port `3000` against the isolated IE runtime/database;
- canonical Initiatives Menu2 deep links now preserve `list`, `portfolio`, `plan` and `capacity`;
- canonical Execution Menu2 deep links now preserve `list`, `work`, `resources`, `control` and
  `reports`;
- Work and Resources load their cross-case canonical registers by default. Choosing an Execution
  Case is an optional filter/workbench context, not a prerequisite for seeing the table;
- Plan, Work and Control user-facing dates are localized while exact raw timestamps remain in the
  filtering and command contracts;
- unit rerun: `59/59 files, 144/144 tests PASS`;
- full browser command rerun on its own governance-enabled runtime: `3/3 PASS` in `1.1m`;
- full realDB rerun used both `DATABASE_URL` and `IE_TEST_DATABASE_URL` pointing at the same
  isolated database: `38/38 files, 88/88 tests PASS`, with zero skipped tests;
- a diagnostic run with only `DATABASE_URL` produced `13 passed / 25 skipped` files and is not
  accepted as evidence. The canonical realDB command above was corrected to prevent that false
  green result;
- global TypeScript again exits `2` only on the same six unrelated AIChat/DocumentStudio/
  Presentations errors; no Initiatives/Execution error is present;
- full-shell TRIADA runtime audit is recorded in
  `docs/implementation/evidence/nine-function-triada-runtime-audit-2026-08-11.json`: eight
  populated registers pass table, column chooser, preview, kebab and `Shift+F10` parity; the ninth
  (`Realizacje`) passes its correct post-archive empty state and is covered in populated state by
  `aco-browser-execution-registry-step-34.png` plus focused component tests;
- `git diff --check`: `PASS`.

## 2026-08-11 — Product Owner acceptance and candidate boundary

- Product Owner accepted the complete Initiatives + Execution candidate after the documented
  unit, realDB, browser, UI/UX, responsive, accessibility and authorization evidence passed;
- IE-010 through IE-091 were accepted for the historical isolated candidate. IE-099 for the
  reconstructed deployed candidate remained `READY_FOR_REVIEW` until logged-in manual demo
  acceptance is recorded;
- six global TypeScript errors in unrelated AIChat, Document Studio and Presentations paths are
  explicitly excluded from the Initiatives/Execution acceptance gate; no error points to the
  accepted module scope, and the unrelated errors remain unresolved;
- isolated implementation commit:
  `dfcffd8d1046b392f1a72bf8716d9afe1ed00f95`;
- acceptance authorizes the isolated commits only. Integration, push, deployment and production
  release remain unauthorized and were not performed.

Implementation candidate SHA: `dfcffd8d1046b392f1a72bf8716d9afe1ed00f95`

Exact-SHA verification after the implementation commit:

- unit: `59/59 files, 144/144 tests PASS`;
- first concurrent realDB diagnostic: `37/38 files, 87/88 tests PASS`; the golden-thread test
  ended with `socket hang up` while the full unit suite was consuming the same workstation;
- accepted isolated sequential realDB rerun, with both `DATABASE_URL` and
  `IE_TEST_DATABASE_URL` bound to the same disposable PostgreSQL database:
  `38/38 files, 88/88 tests PASS`;
- Playwright: `3/3 PASS` in `1.4m`, including ACO 1–59 and WCAG 200% text resize;
- global TypeScript with 8 GB heap: exit `2` on exactly the six explicitly excluded unrelated
  AIChat, Document Studio and Presentations errors; zero Initiatives/Execution errors;
- pre-commit canon gates: table/list canon, artifact crimson ratchet, TRIADA crimson neutrality,
  density and focus controls passed. The gate initially rejected two raw Workbench tables and five
  crimson active-state tokens; both classes were corrected before the candidate commit.

The SHA of the acceptance-record commit is the Git commit containing this section and is reported
in the final handoff. A commit cannot truthfully contain its own cryptographic SHA.

## 2026-08-11 — reconstructed release-candidate and demo deployment checkpoint

- the original worktree Git pointer was broken and its local commit was unavailable from the
  remote; the source tree was preserved at
  `/Users/piotrwisniewski/Developer/consultify-ie-recovery-20260811-125704` with SHA-256 inventory;
- a new repository was reconstructed from remote base
  `9d17cac11484a82f729a51044e30453e39fbcb02` on branch
  `codex/initiatives-execution-final-candidate`;
- unit: `59/59 files, 144/144 tests PASS`;
- disposable local PostgreSQL realDB: `38/38 files, 88/88 tests PASS`;
- Playwright full composition: `3/3 PASS`, including ACO 1–59 and WCAG 200%;
- focused Initiatives/Execution lint: `PASS` with zero errors;
- repository-wide TypeScript: `PASS`;
- production build: `PASS`;
- browser assertion text was aligned to user-facing labels and allocation-row identity; product
  commands and lifecycle contracts were not weakened;
- reconstructed code candidate `cd5f5f858390d82694926e130ea77faa97f855ad` was pushed and deployed
  to Railway demo as `d4bc7cd4-46cd-435c-bdc0-3440995d26fa`; deployment status is `SUCCESS`,
  `/ping` returns `200 pong`, and runtime variables `APP_BUILD_SHA` and `GIT_SHA` match the candidate;
- logged-in manual demo acceptance remains `NOT VERIFIED`. Therefore IE-099 is
  `READY_FOR_REVIEW`, not `ACCEPTED`.

## 2026-08-11 — final release-record deployment and rollback evidence

- final branch: `codex/initiatives-execution-final-candidate`; the SHA of the release-record commit
  is the Git commit containing this section and is reported with the active Railway deployment in
  the final handoff because a commit cannot truthfully contain its own cryptographic SHA;
- the active Railway demo deployment has status `SUCCESS` and image digest
  `sha256:a1f02d173251e62fb5705ec04da6b6ab3a053e04a535a06f4d046ea1354c8791`;
- runtime variables `APP_BUILD_BRANCH`, `APP_BUILD_SHA` and `GIT_SHA` point to that branch and
  release-record SHA; `https://demo.consultify.ai/ping` returns `200 pong`;
- startup readback confirms the PostgreSQL pool, schema and all 458 migrations are ready before
  traffic is served;
- previous healthy code-candidate deployment `d4bc7cd4-46cd-435c-bdc0-3440995d26fa` is retained in
  Railway deployment history with the same built image digest. It is the immediate runtime-image
  rollback target if the final documentation-only release record must be reverted;
- rollback is forward-only: stop new writes or cohort expansion, redeploy the last proven image,
  retain canonical data/audit/outbox/receipts, reconcile affected IDs, and use a compensating
  migration if schema correction is required. Destructive down-migration and database deletion are
  prohibited;
- rollback has not been executed against demo because doing so would deliberately interrupt the
  healthy accepted candidate. The availability of the prior image and procedure is verified;
  measured RPO/RTO and a live rollback drill remain `NOT VERIFIED` and require release-owner
  authorization.

## 2026-08-12 — corrected final candidate and logged-in demo acceptance

- code candidate `bda1293c1e1e8bf02719c4e76ce300f3841f9cf8` passed repository type-check,
  59/59 Initiatives/Execution unit files with 146/146 tests, 38/38 isolated realDB files with
  88/88 tests, the full ACO/WCAG Playwright suite 3/3, focused ESLint and `git diff --check`;
- Railway demo deployment `d67e049f-3eb4-4592-b089-28133c77aab1` reached `SUCCESS`; `/ping`
  returned `pong`, `/api/health` returned `ok`, PostgreSQL/Redis `connected`, and exact
  `gitSha=bda1293c1e1e8bf02719c4e76ce300f3841f9cf8`;
- the first deployment exposed a stale manually pinned build identity. `APP_BUILD_SHA` and
  `GIT_SHA` were corrected to the exact candidate before any manual PASS was claimed;
- logged-in full-size acceptance on Piotr's owner account covered all nine functions: canonical
  tables, Menu 2/3, Settings2, Preview, kebab/PPM/Shift+F10 parity, explicit Open/Workbench,
  Preview closure, Back and named-column persistence across reload;
- clean 1440x900 screenshots for all nine functions are stored as
  `evidence/ie-demo-final-*-1440x900.png`; there was no page overflow, loading failure, browser
  exception or raw owner UUID;
- `Realizacje` proved both the honest Active empty state and the archived record through All plus
  Closing. The shared demo database was not used for destructive lifecycle repetition; the isolated
  ACO 1–59 realDB/browser proof remains authoritative for writes and negative authority;
- IE-099 has no remaining engineering or runtime acceptance blocker and is `READY_FOR_OWNER_REVIEW`.
  Production release, measured RPO/RTO and a live rollback drill remain separate and unauthorized.
