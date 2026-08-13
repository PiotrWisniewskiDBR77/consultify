# Initiatives + Execution — manual business and UI/UX acceptance plan

Status: `AUTOMATED PASS — logged-in manual demo acceptance NOT VERIFIED`

Candidate branch: `codex/initiatives-execution-final-candidate`. The exact immutable candidate is
the clean branch HEAD that must equal both `origin/codex/initiatives-execution-final-candidate` and
Railway demo `/api/health.gitSha` at acceptance time. The signed external deployment receipt stored
next to the pre-migration rollback backup records that SHA and deployment ID without creating a
self-referential documentation commit. PostgreSQL and Redis must both be connected. The logged-in,
human-scale walkthrough of all nine functions remains a separate open gate and must not be inferred
from Playwright evidence.

Local diagnostic runtime: `http://127.0.0.1:3000` (not acceptance evidence)

Demo acceptance runtime: `https://demo.consultify.ai` — DBR77 organization, project
`DBR77 Demo — All Modules`, owner `piotr.wisniewski@dbr77.com`.

This plan is an independent acceptance layer. Automated unit, realDB and Playwright results are
inputs, not substitutes for a business user completing the two journeys below in the full shell.

## 1. Verdict rules

- Each of the nine functions is graded independently: `PASS`, `FAIL`, `NOT VERIFIED` or
  `BLOCKED_FIXTURE`.
- One P0 failure makes its function and parent module fail.
- Missing evidence is `NOT VERIFIED`, never PASS.
- Each screen must score at least 90/100 for visual and interaction quality; the score cannot
  override a P0 failure.
- Required evidence is produced on the same SHA and dataset: screenshot, actor, URL/query, selected
  ID/version, before/after state, command/read-back, retry and unauthorized attempt.

## 2. Common P0 interaction gate — repeat for all nine functions

1. The hierarchy is Topbar -> frozen Menu 2 -> exactly one Menu 3 -> one primary table.
2. Menu 3 presets use the same query as their counts and visible rows.
3. `StandardTable` provides sticky/sortable headers, filters, resizing and `Settings2`.
4. Column visibility/order/width, sort and filters survive reload and re-entry.
5. Single click opens preview without losing URL, filters, selection or scroll.
6. Preview order is Header -> Meta -> Details -> AI proposal -> Relations -> Actions; optional empty
   blocks are hidden and AI is visually distinct from accepted truth.
7. Double-click, Enter and `Open` open the same exact workspace. `Back` restores table context and
   focus.
8. Kebab, right-click and `Shift+F10` expose the same capability-derived actions and disabled
   reasons; destructive actions are last and confirmed.
9. Arrow keys move the active row, Space changes checkbox selection, Esc closes the nearest layer
   and returns focus.
10. `Unknown`, `Not evaluated`, `Partial`, `Stale` and `EVIDENCE_MISSING` are literal and never
    converted to zero, green or success.
11. Loading, first-use empty, filtered empty, partial/stale, permission, write failure, read-back
    pending and version conflict preserve usable context and offer the correct recovery.
12. Verify 1440x900, 1280x720, 1024 drawer fallback, 390x844, light/dark, 125% and 200% text.

## 2A. Cross-application P0 gate

These checks are performed across the two modules, not separately inside one screen.

1. **Stable identity and return context.** Open one Initiative in Inicjatywy, follow its exact
   relations through Portfolio, Plan, Capacity and accepted Handoff to Execution. The same
   `initiativeId` remains visible throughout. Back restores the originating register, lens,
   filters, columns, selection, scroll and keyboard focus. No second Card or shadow record appears.
2. **My Work is a projection.** The same Task and Decision have identical ID, version and status in
   Initiative Card, Execution Praca and My Work. A command from either surface updates canonical
   truth. Projection lag is shown as pending with correlation ID, never as a locally forged success.
3. **Authorization and isolation.** Repeat one representative read and write as authorized actor,
   Viewer, unrelated-project user, foreign-tenant user, Admin without business binding and an actor
   with expired delegation. Denial must conceal data where required and leave aggregate hash,
   audit, outbox and receipt counts unchanged.
4. **Concurrency and retry.** Two clients write the same expected version: one succeeds and one
   receives 409 with current version and reconciliation data. Replaying the same request ID creates
   one durable effect and returns the same canonical ID.
5. **Degraded dependencies.** Fail or delay one source while loading a composite workspace. The
   registry and successful sources remain usable; the failed source is named with as-of and scoped
   retry. Capability-source failure closes writes. Draft, selection and context survive recovery.
6. **Archive guard.** After Archive, ordinary Card, Task and Allocation writes, a second Archive and
   a forged restore are rejected. Initiative version/lifecycle, work read-back, Archive Manifest,
   audit, outbox and receipts remain unchanged.
7. **Formatting and language.** Business copy is understandable in Polish; dates and numbers are
   localized. Raw UUID, enum or ISO timestamp may appear in a technical lineage block, but never as
   the primary row title, action label or user-facing status.
8. **Observability and rollback.** Every failed material command exposes a request/correlation ID.
   Health and logs distinguish application, database, Redis and migration failures. Rollback is
   forward-only and preserves immutable history, audit, outbox and receipts.

## 3. Business case A — Initiatives: NordWerk Q4 change portfolio

### Starting dataset and actors

- ACO — Automated Changeover Optimization: Assessment `ASM-F-ACO-001 v3`, baseline 95 minutes,
  target hypothesis 60 minutes, envelope PLN 1.2m.
- QMS 4.0 — mandatory compliance initiative with a regulatory deadline.
- Energy Reduction Programme — high financial value and shared Data Analyst demand.
- Scarce roles: Controls Engineer 0.8–1.2 FTE, Maintenance Lead 0.4–0.7, Data Analyst 0.2–0.4;
  part of supply remains `UNKNOWN`.
- Actors: Initiative Owner, Portfolio Owner, Planner, Resource Owner, Sponsor/independent authority,
  Viewer, unrelated-project user and foreign-tenant user.

If the three competing initiatives, authorities or evidence versions are absent, the journey is
`BLOCKED_FIXTURE`. Do not replace them with invented frontend data.

### A1. Inicjatywy — registered Initiative register and exact Card

1. Show all Registered Initiatives, then use Needs evidence/decision/archived presets.
2. Verify lifecycle, next gate, readiness, owner/next actor, next action, outcome+confidence,
   planned window, health and updated/as-of remain separate dimensions.
3. Open ACO preview and verify exact Assessment lineage, 95-minute problem, 60-minute hypothesis,
   owner, readiness and restricted Finance/Results relations.
4. Open the exact Card; inspect source, problem/outcome, scope/exclusions, do-nothing option,
   evidence/counter-evidence, Finance/KPI references, RAID, dependencies, RACI, gates and history.
5. Submit Definition with stale/missing evidence: it must fail with exact findings.
6. Refresh evidence, resolve accountable Task/Decision, freeze and submit. A different authority
   approves; lifecycle changes only after authoritative read-back.
7. Reject one AI proposal and accept a corrected one; only accepted human content becomes truth.
8. Retry the same material command; prove one effect and one stable ID.

Negative gates: Viewer write, self-approval, stale source, legacy unknown state, archive mutation and
foreign-tenant read all fail closed without data mutation or disclosure.

### A2. Portfel — active scenario membership list

1. Primary rows are Initiative memberships, not a second permanent Scenario table.
2. Create baseline and constrained scenarios with ACO/QMS/Energy include dispositions.
3. Compare score decomposition, value/cost/risk ranges, readiness, confidence, coverage, overlap and
   rough demand.
4. Override ACO rank; actor, rationale and affected positions are mandatory.
5. Publish immutable scenario and request one Decision per Initiative. No batch lifecycle write.
6. Independent authority conditionally approves ACO and defers Energy; read-back moves only eligible
   work to `APPROVED_BACKLOG`.

Negative gates: stale Initiative snapshot, partial comparability, concurrent edit, publish retry and
AI publish attempt all fail safely.

### A3. Plan — proposed windows and dependencies

1. Clone an exact published Portfolio Scenario version into a Plan draft.
2. Sequence QMS before its deadline and ACO after its prerequisite; use earliest/target/latest ranges,
   not false exact commitment dates.
3. Move ACO and inspect draft diff; Initiative remains `APPROVED_BACKLOG`.
4. Open timeline/dependency Workbench; verify unscheduled, now/next/later and conflicts.
5. Send the same Plan ID/version and time basis to Capacity and return with table context preserved.
6. Compare move/split/reduce/defer options, publish after review, then request Schedule Decision.
7. Only approved Schedule Decision creates `SCHEDULED` and an immutable Handoff Package.

Negative gates: cycle, missing dependency, stale Portfolio, unknown time basis, Viewer drag and retry
must not mutate Initiative dates, Tasks or lifecycle.

### A4. Obciążenie — capacity constraints and options

1. Primary rows are period/role constraints with demand and supply low/base/high ranges, unit,
   confidence, knowledge state, affected initiatives, freshness and owner.
2. Inspect Controls Engineer demand and prove unknown non-project load stays null/unknown.
3. Compare RESEQUENCE, SCOPE_SPLIT and ADD_CAPACITY with time/cost/risk/value effects.
4. Simulation remains read-only. Resource Owner and named assignee perform separate confirmation.
5. Conditions return to the exact Plan Scenario and Schedule readiness by read-back.

Negative gates: mismatched time basis, stale supply, unknown critical supply, self-confirmation and
retry must fail without shadow assignment or lifecycle mutation.

### Initiatives reconciliation

One Initiative ID and lineage; one published Portfolio version; exact Plan->Capacity lineage; no
lifecycle mutation from draft tools; `SCHEDULED` only after Schedule Decision.

## 4. Business case B — Execution: NordWerk Line 4 delivery

### Starting dataset and actors

- ACO in `SCHEDULED / HANDOFF_PENDING`, pilot + wave 1 + wave 2, deadline 15 December.
- Execution Manager, Resource Manager, Task Owner, Sponsor/Decision authority and Report Reviewer
  are different actors; Viewer is read-only.
- Critical dependency is Controls Engineer availability; execution introduces a capacity conflict
  and stale milestone.

### B1. Realizacje — plain Execution Case register

1. Reject the first Handoff with blockers; verify no Execution Case exists.
2. Resolve blocker and accept with exact package/version. Retry creates exactly one stable Case.
3. Pilot and waves are children, not parallel Cases.
4. Table/preview show accepted baseline, current/forecast, gaps, next milestone, manager and next
   action without synthetic progress.
5. Refresh/relogin/deep-link retains the same Case and table context.

Negative gates: Viewer accept, changed payload under same idempotency key, missing baseline and
read-back timeout.

### B2. Praca — canonical Task and Decision register

1. Load cross-case register without requiring Case selection; exercise Tasks, Decisions, Blocked,
   Overdue and Missing evidence presets.
2. Open type-aware Task and Decision previews/workspaces.
3. Create Task with DoD/evidence and Decision with options including do-nothing.
4. Verify identical IDs/versions in Praca, Case and My Work.
5. Completion without evidence fails; after evidence it updates parent and milestone.
6. Conditional Decision creates exactly one follow-up Task and re-evaluates blockers.

Negative gates: mixed unsafe bulk, self-decision, duplicate follow-up, stale version and delayed
projection.

### B3. Zasoby — operational allocation

1. Load cross-case allocation table and inspect Controls Engineer demand, time basis, evidence,
   skills, acceptance and affected work.
2. Purely simulate move/split/outsource/defer/do-nothing and compare before/after blast radius.
3. Save proposal; named assignee accepts; Resource Manager confirms or conditions it.
4. Verify the same allocation in Zasoby, Praca and Case after reload.

Negative gates: unknown availability cannot yield utilization, time-basis mismatch, missing resource
authority, rejected proposal and retry.

### B4. Sterowanie — intervention effectiveness loop

1. Ingest capacity-conflict and stale-milestone signals; deduplicate them into one Intervention Case.
2. Separate hypothesis, evidence/counter-evidence, unknowns and blast radius.
3. Compare resequence, add capacity and mandatory do-nothing; independent authority decides.
4. Apply only an exact canonical command receipt and verify target read-back.
5. Record `PARTIAL`/`INEFFECTIVE`; Case remains escalated with follow-up and verify-by date.

Negative gates: AI approval, duplicated intervention, missing counter-evidence, stale receipt,
material change without reapproval and retry.

### B5. Raporty — persisted Definition and Run

1. Use explicit Runs and Definitions lenses; default to Runs and preserve lens state.
2. Create/version/validate and independently publish a project-scoped Definition.
3. Create a persisted Run bound to exact Definition and source versions.
4. Missing mandatory source blocks validation/publish with `PARTIAL`/stale details.
5. Freeze deterministic hash, approve, publish and record distribution.
6. Source drill creates and links one canonical follow-up Task.
7. Refresh creates a new draft with immutable parent; old published Run does not change.

Negative gates: unauthorized export, stale/denied source, generation retry, failed generation and AI
publication.

### Execution reconciliation

One Handoff -> one Execution Case -> native Task/Decision IDs -> one governed Allocation -> one
Intervention Case -> immutable Report Run and refresh lineage.

## 5. Visual/UI/UX score — 100 points per screen

- Hierarchy and five-second business scanability: 20.
- Table geometry, density, typography and semantic color: 20.
- Preview/Workbench composition and proposal-vs-truth distinction: 15.
- Discoverability, feedback, permission and error recovery: 15.
- State completeness, copy and localized data formatting: 15.
- Keyboard, focus, accessibility, responsive and theme quality: 15.

Market comparison is secondary: context preservation comparable to Linear, configurable dense data
like Airtable, explicit filters like Jira and approachable hierarchy like Asana. Consultify's repo
canon remains authoritative.

## 6. Initial full-shell manual ledger — 2026-08-11

### Repeatable manual dataset

The populated Initiatives register is created through canonical production commands, not by
inserting business aggregates directly:

```bash
NODE_ENV=test \
DATABASE_URL='postgresql://consultify_ie:consultify_ie_test@127.0.0.1:32768/consultify_ie_acceptance' \
npx tsx tests/e2e/initiatives-execution/seed-manual-acceptance.ts
```

The seed provides:

- `manual-energy-draft-initiative` — `REGISTERED_DRAFT`;
- `manual-aco-ready-initiative` — `READY_FOR_DECISION`, created by the complete governed golden
  thread;
- the existing completed ACO golden record remains the archived/read-only reference.

Only governance-policy and role-binding bootstrap uses SQL. All proposals, initiatives, cards,
reviews, Decisions and lifecycle transitions use the canonical HTTP/domain contracts. Two
consecutive executions returned the same stable IDs without duplicate business objects.

| Area                   | State   | Evidence / finding                                                                                                                                                                                                                   |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initiatives shell      | PASS    | Menu 2 changes both URL and mounted function. The stale Portfel surface race was removed; direct navigation and tab navigation agree.                                                                                                |
| Inicjatywy             | PARTIAL | Canonical API seed now provides REGISTERED_DRAFT, READY_FOR_DECISION and ARCHIVED records. Presets, Settings2, preview and kebab work. Full material-write journey and current-SHA PPM persistence remain not verified.              |
| Portfel                | PARTIAL | Populated membership list, preview, settings and honest UNKNOWN are visible. Workbench now has an explicit Close action. Full compare/publish/Decision journey remains not verified manually.                                        |
| Plan                   | PARTIAL | Populated Initiative-window table, preview, Settings2 and explicit Workbench are visible. Workbench now has an explicit Close action. Full draft/publish/Schedule journey remains not verified manually.                             |
| Obciążenie             | PARTIAL | Populated period/constraint register and literal UNKNOWN are visible. Workbench now has an explicit Close action. Full option/commitment journey remains not verified manually.                                                      |
| Execution shell        | PASS    | Frozen five-function Menu 2 works. Menu 3 uses a visible controlled horizontal scrollbar at constrained width instead of silently clipping presets.                                                                                  |
| Realizacje             | PARTIAL | Active empty state is honest; All/Closing exposes the archived ACO Case in the canonical Initiative-style table. A current active handoff/case journey is still not present in the manual dataset.                                   |
| Praca                  | PARTIAL | Populated Task/Decision register and preview work. Raw status translation fallback and missing Initiative relation were fixed. Full write/read-back journey remains not verified manually.                                           |
| Zasoby                 | PARTIAL | Confirmed allocation is enriched with the Task title and exact versioned availability/calendar/remaining-estimate/cost evidence; false EVIDENCE_MISSING was removed. Transition journey remains not verified manually.               |
| Sterowanie             | PARTIAL | Intervention Cases are the primary register and Signals are secondary after explicit Open. Populated evidence/options and honest UNKNOWN are visible; raw technical identifiers and full apply/verify journey remain to be reviewed. |
| Raporty                | PARTIAL | Populated Runs, Settings2, preview and Shift+F10 menu work; all Menu 3 presets remain reachable at 1280. Full Definition->Run->refresh journey remains not verified manually.                                                        |
| Full-shell integration | FAIL    | Console reports local token decode error plus 404s for users, personal tasks and notifications. These do not always block the module table, but invalidate production-like shell acceptance.                                         |

Cross-cutting fixes in this pass:

- Canonical API seed added for repeatable populated manual acceptance; governance SQL is bootstrap only,
  never business-truth seeding.
- `btn-*` compatibility styles moved into the actually imported stylesheet, so Workbench actions no
  longer render as unstyled text.
- Full Initiatives + Execution unit suite: 59 files / 144 tests PASS. Focused Workbench close tests:
  3 files / 8 tests PASS.
- Current 200%/390 automated rerun: 1/1 PASS across the twelve fixture surfaces; no document-level
  horizontal overflow or clipped active controls was detected. The first attempt timed out under
  concurrent compiler load; the bounded 300-second rerun completed in 3.8 minutes.

## 7. Demo acceptance checkpoint — 2026-08-11

Deployment `13741b2e-7f60-4279-977d-e370dc9cfb5e` is `SUCCESS`; `/api/health` returns HTTP 200 and
database connected. Static-bundle inspection confirms the deployed candidate contains the frozen
four-function Initiatives shell, five-function Execution shell and the canonical projection tables.
The health payload still exposes the previous environment `gitSha`; this is a release-metadata defect
and must not be used as candidate identity evidence.

The DBR77 dataset now contains a full, previously accepted ACO lineage copied from the isolated
acceptance database. The import is scoped to the DBR77 organization and demo project, rewrites the
Initiative Owner to Piotr's canonical user ID, performs no delete/truncate, and is idempotent through
the existing aggregate keys. This is a demo-fixture import, not a production command acceptance test;
the production-command journey remains proven separately by the isolated golden browser/realDB run.

Read-model reconciliation on the demo database:

- 5 Initiatives;
- 1 Portfolio Scenario, 1 Plan Scenario and 1 Capacity Scenario;
- 1 Execution Case, 3 Tasks, 1 Milestone and 1 Decision;
- 1 Operational Allocation;
- 2 Management Signals and 1 Intervention Case;
- 1 Report Definition and 2 Report Runs;
- 196 receipts, 196 audit events and 196 outbox events imported with the acceptance lineage;
- 0 references to the source tenant or source project remain in aggregate payloads.

Current engineering gates: Initiatives/Execution unit suite 59 files / 144 tests PASS; focused lint
PASS; global type-check PASS; production build PASS. Final human-interface acceptance on the logged-in
demo account is `NOT VERIFIED`: both supported browser-control surfaces are temporarily blocked by an
admin-enforced browser security policy. This must be retried; it may not be replaced by a fixture or
API-only PASS.

- The previously recorded six global TypeScript errors were corrected during candidate
  reconstruction. Repository-wide type-check and production build now pass. This is engineering
  evidence only; it does not replace the still-missing logged-in demo walkthrough.

The prior automated `ACCEPTED` record remains historical evidence. This independent manual gate is
reopened and cannot become PASS until every FAIL is corrected and all NOT VERIFIED steps have fresh
runtime evidence.

## 8. Current execution checkpoint — 2026-08-12

### 8.0 Closure update — 2026-08-12 11:35 Europe/Warsaw

The prior `NOT VERIFIED` entries below are retained as chronological evidence of earlier blocked
attempts; they are superseded by this closure update. The corrected candidate
`bda1293c1e1e8bf02719c4e76ce300f3841f9cf8` was deployed to Railway demo and its exact identity was
proved by `/api/health.gitSha` after correcting stale pinned build-identity variables.

The logged-in owner-account pass covered all four Initiatives functions and all five Execution
functions at 1440x900. For every function the run proved the canonical table, Settings2 chooser,
single-click Preview and capability-derived row action contract. Populated rows proved kebab,
right-click and Shift+F10 parity; `Realizacje` additionally proved the honest `Active` empty state and
the archived record through `All` + `Closing`. Explicit Open paths entered the exact Card/Workbench
and closed Preview. A named optional column persisted its visibility through reload and was restored.
There was no page overflow, loading error, browser exception or raw owner UUID. Clean screenshots are
`evidence/ie-demo-final-*-1440x900.png`.

Disposition by function: Inicjatywy PASS; Portfel PASS; Plan PASS; Obciążenie PASS; Realizacje PASS;
Praca PASS; Zasoby PASS; Sterowanie PASS; Raporty PASS. The complete destructive lifecycle and
negative-authority proof remains the isolated PostgreSQL ACO 1–59 journey; shared demo data was not
mutated to repeat that proof.

Accepted residuals: mixed global English chrome and Polish domain copy under the owner's English
locale; separately identifiable earlier manual and golden-lineage Initiative rows on demo; historical
migration checksum warnings with all migrations up to date. These do not falsify the module behavior
or evidence and are tracked as application-wide localization/demo-data/operations debt.

- Exact demo runtime `/api/health.gitSha`:
  `856586f579e5a61b09586731ddce3971b843cf5d`.
- Demo `/ping` and `/api/health`: HTTP 200; PostgreSQL and Redis connected.
- Initiatives/Execution plus shared table-contract suite: 60 files / 153 tests PASS.
- Isolated local PostgreSQL realDB suite: 38 files / 88 tests PASS. Both
  `IE_TEST_DATABASE_URL` and `DATABASE_URL` were explicitly bound to the same disposable local DB;
  demo was not used as a destructive test database.
- Full browser golden thread and WCAG 200% suite: 3/3 PASS on the local candidate runtime. The
  golden thread covers the complete ACO lineage through Archive; the WCAG test covers all canonical
  surfaces at 200% text resize.
- Repository-wide `npm run type-check -- --pretty false`: PASS.
- Focused ESLint for all changed production/test files: PASS.
- `git diff --check`: PASS.
- Production and staging were restored to prior compatible artifacts after a migration-checksum
  incident; manual acceptance remains strictly scoped to `https://demo.consultify.ai`.
- Logged-in manual functional and visual walkthrough remains `NOT VERIFIED`. The current agent
  session exposes the open demo URL but no callable browser/Computer Use control channel, so it may
  not claim interaction, DOM, keyboard, persistence or screenshot evidence. Resume from Section 2
  as soon as browser control is enabled; do not replace this gate with API-only evidence.
- Defects found and corrected locally during this execution: disabled row actions once again expose
  their real business-lock reason; column visibility persistence and kebab/PPM/Shift+F10 parity are
  now executable shared-table tests; the browser journey now explicitly closes Workbench, verifies
  Preview, and reopens the exact Intervention/Report/Task before its next command instead of relying
  on stale selection. Portfolio, Plan and Capacity now close Preview when their Workbench opens.
  Sterowanie separates signal collection from the Intervention composer: `Dodaj sygnał` returns to
  the register/Preview, while `Przygotuj interwencję` is the explicit Workbench transition. Focused
  component regressions and the complete 3/3 browser rerun prove that competing surfaces no longer
  remain open in these flows.
- The fresh local screenshots are **not visual acceptance**. They identify issues that must be
  checked and, when reproduced on the exact demo candidate, corrected before PASS: mixed Polish and
  English action/status copy; raw UUID/enum/ISO values used too prominently; JSON editors visible as
  primary authoring in Plan/Report/Allocation tools; and dense, weakly grouped action rows in several
  Workbenches. Advanced JSON deliberately opened by a browser test is not itself a defect, but the
  default collapsed state and a guided business form must be confirmed manually.

Fresh repeatability checkpoint, 2026-08-12 07:40 Europe/Warsaw:

- Initiatives/Execution unit suite: 59/59 files and 145/145 tests PASS;
- shared `StandardTable` contract: 1/1 file and 8/8 tests PASS; combined: 60 files / 153 tests;
- isolated PostgreSQL realDB suite: 38/38 files and 88/88 tests PASS;
- browser golden thread plus WCAG 200%: 3/3 PASS in 1.3 minutes;
- focused Reports regression after progressive-disclosure correction: 5/5 PASS;
- repository-wide type-check, focused lint and `git diff --check`: PASS.

Final automated checkpoint after the guided Report Definition correction, 2026-08-12 08:07
Europe/Warsaw:

- repository-wide type-check: PASS;
- Initiatives/Execution plus shared table contract: 60/60 files and 153/153 tests PASS;
- isolated PostgreSQL realDB: 38/38 files and 88/88 tests PASS;
- full browser ACO golden thread plus WCAG 200%: 3/3 PASS in 56.2 seconds;
- `git diff --check`: PASS.

Fresh acceptance rerun after the final Capacity, Control and Reports copy/formatting corrections,
2026-08-12 08:27 Europe/Warsaw:

- repository-wide type-check: PASS;
- Initiatives/Execution plus shared `StandardTable` contract: 60/60 files and 153/153 tests PASS;
- isolated PostgreSQL realDB suite: 38/38 files and 88/88 tests PASS, with both
  `IE_TEST_DATABASE_URL` and `DATABASE_URL` bound to the same disposable local database;
- full browser ACO golden thread plus WCAG 200%: 3/3 PASS in 55.9 seconds;
- logged-in demo walkthrough: `NOT VERIFIED` because this Codex session still has no callable
  browser-control channel. The open demo tab is ambient state only and is not interaction evidence.

The automated rerun proves repeatability of the local correction set. It does not change the demo
runtime SHA and it does not satisfy the manual visual, keyboard, context-menu, persisted-column or
Open/Back acceptance gates.

This checkpoint proves the functional candidate, not the logged-in demo UX. The current demo still
runs SHA `856586f579e5a61b09586731ddce3971b843cf5d`; the local corrections have no final candidate
commit and were not deployed. No screenshot or fixture is treated as proof of the demo candidate.

The current 39-file correction set is preserved outside the worktree at
`/Users/piotrwisniewski/Developer/consultify-ie-backups/20260812-0800-ui-acceptance/changed-files.tar.gz`.
Its sibling `.sha256` file records the verified checksum. The archive contains exactly the same 39
paths as `git diff --name-only`. It is source-loss protection only, not Git-history, candidate-SHA
or merge evidence.

The current Codex task still has no callable Browser/Computer Use channel. The logged-in demo tab is
visible only as ambient state and cannot be clicked, inspected or captured by the agent. Therefore
the demo walkthrough, keyboard paths, persisted table settings and exact logged-in screenshots remain
`NOT VERIFIED`. This is an environment limitation, not a functional PASS or FAIL.

### Local candidate visual pre-audit — FAIL

The fresh populated screenshots are sufficient to reject the current candidate visually even before
the logged-in demo walkthrough. This does not replace demo acceptance; it prevents a false PASS:

- `Sterowanie`: duplicate permanent forms were removed and signal collection, intervention authoring,
  apply and verify are now progressively disclosed. The fresh screenshot is materially clearer, but
  raw aggregate IDs, enum values and several technical field labels remain too prominent. Result:
  `FAIL_COPY_AND_FORMATTING`.
- `Obciążenie`: the duplicate register was removed, the commitment editor is collapsed behind an
  explicit action and `UNKNOWN` remains literal. The Workbench is now scanable, but period dates,
  source references and proposed-assignment identity still read like technical lineage rather than
  business copy. Result: `FAIL_COPY_AND_FORMATTING`.
- `Raporty`: the exact JSON contract is hidden behind an explicit advanced toggle and ordinary creation
  uses a guided period/audience/scope form. Report Definition now also starts with purpose, audience,
  cadence, owner, approver and scope; its source/formula/access JSON is hidden behind a separate
  advanced toggle. A published Run hides lifecycle authoring behind `Odśwież jako nowy szkic`. The
  golden evidence deliberately opens advanced mode, so it does not prove the default visual state.
  Remaining raw source lineage and hashes still require logged-in manual review. Result:
  `NOT_VERIFIED_MANUAL_VISUAL`.
- Cross-screen: raw UUIDs, technical enum names and ISO timestamps remain too prominent; action rows are
  insufficiently grouped; copy is not consistently localized. Result: `FAIL_COPY_AND_FORMATTING`.

These defects are P0 for visual acceptance. Automated functional PASS remains valid, but the candidate
must not be committed, deployed or manually accepted until the guided Workbench composition is fixed
and fresh screenshots plus the logged-in demo walkthrough pass.

### Final local automation checkpoint — 2026-08-12 08:58 Europe/Warsaw

After the additional business-copy pass in `Obciążenie` and `Praca`, including localized canonical
Task/Decision controls and Milestone blast-radius readback:

- repository-wide type-check: PASS;
- Initiatives/Execution unit suite: 59/59 files and 145/145 tests PASS;
- isolated PostgreSQL realDB suite: 38/38 files and 88/88 tests PASS on a fresh disposable database,
  executed sequentially to prevent migration/fixture deadlocks;
- full ACO browser golden thread plus WCAG 200% and narrow responsive gate: 3/3 PASS in 54.7 seconds;
- the first parallel realDB attempt is explicitly rejected as evidence because concurrent suites ran
  the same migrations and cleanup against one database, producing deadlocks and fixture collisions;
- logged-in demo walkthrough remains `NOT VERIFIED`: browser control is not callable in this task yet.

The earlier visual FAIL observations are historical findings that drove the correction set, not a
current acceptance verdict. Fresh automated screenshots show material improvement, but final visual
PASS still requires the full-size logged-in demo walkthrough for all nine functions, including
Settings2 persistence, preview, kebab/PPM parity, keyboard focus restoration and Open/Back context.

## 9. Canonical sources

- `docs/modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md`
- `docs/modules/initiatives-execution-canon/02_FUNCTIONAL_CONTRACTS.md`
- `docs/modules/initiatives-execution-canon/03_UI_UX_AND_INTERACTION_SPEC.md`
- `docs/modules/initiatives-execution-canon/04_SURFACE_DESCRIPTORS.md`
- `docs/modules/initiatives-execution-canon/08_ACCEPTANCE_SCENARIOS.md`
- `docs/ui-standards/TRIADA_KANON.md`
- `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`
- `docs/ui-standards/UI_UX_IMPLEMENTATION_STANDARD.md`
- `docs/implementation/FINAL_ACCEPTANCE_CASE_ACO.md`
