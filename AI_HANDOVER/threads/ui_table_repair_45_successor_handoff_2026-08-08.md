# UI 45 Tables — successor handoff (2026-08-08)

## Mission

Finish the Consultify UI 45 Tables program without touching production. The implementation phase is largely complete; the remaining work is release-candidate reconciliation, exact-SHA non-production evidence, tracker repair, and explicit disposition of deferred/blocked scope.

This handoff supersedes conversational summaries. Read the canonical files listed below and revalidate current Git state before acting.

## Current repositories and immutable safety boundary

Shared dirty repository — read-only for this program:

`/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify`

Final isolated follow-up worktree:

`/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-ui45-followup`

Do not use the shared dirty checkout as an integration target. It contains extensive concurrent Finance, MyWork, Interview, documentation, shared-component, backend, and unrelated changes.

Hard prohibitions remain in force:

- no production, Railway, demo, or production-data changes;
- no merge to main/master/demo without Piotr's explicit approval;
- no force-push;
- no reset/clean/stash or destructive worktree manipulation;
- no invented endpoints, data, bulk actions, selection, or evidence;
- no use of historical demo screenshots or historical `PASS_2_VISUAL` as proof for the final candidate;
- no edits to protected concurrent ownership in the shared repository.

## Current candidate lineage

Base shared SHA:

`4610ddb7de335071921435d265bb499ac2ac51e2`

Main candidate:

- branch: `codex/ui45-candidate-2026-08-08`
- SHA: `64856e790afd0a66547d993fba13769878669c62`
- pushed to origin;
- exactly 115 committed files;
- protected InterviewHub, StandardModuleBar, HubBarSlots, dbSchema, and Menu3Row test were independently confirmed base-equal;
- normal hooks passed after a mechanical same-line placement of the existing ResizableTable `§27-exempt` marker.

Final follow-up candidate:

- branch: `codex/ui45-dev-render-followup-2026-08-08`
- expected HEAD: `da6e409e2b262dddf1b5d347a5bdde593d86cb7a`
- pushed to origin;
- commits after the main candidate:
  - `16d972a242` — register Assessment five-surface dev-render screen;
  - `859abe0980` — complete local Reports/Initiatives QA mocks;
  - `da6e409e2b` — reconcile Assessment Outputs count/status ownership.

The follow-up branch is the sole recommended release-candidate lineage. Do not reopen the 115-file extraction unless a new defect proves it necessary.

## Independently accepted technical evidence

For `da6e409e2b`:

- scoped QA: 15/15 suites, 180/180 tests passed;
- full TypeScript typecheck: exit 0;
- `git diff --check`: clean;
- local exact-candidate Assessment runtime QA confirmed:
  - five tabs;
  - Processes populated;
  - Outputs: two rows, exactly one `All 2`, no false `Draft 0`, truthful prose preview;
  - Reports populated, truthful preview without the former mock-induced error;
  - Initiatives populated, 63-word preview and working row kebab;
  - Library honestly reports `NOT_IMPLEMENTED`;
- production, Railway, demo, and shared repo remained untouched.

The local harness has unrelated inherited debt in its main overlay (including a missing unrelated screen and a duplicate key). Temporary isolated entry was used to avoid expanding scope. Do not classify unrelated harness debt as a UI45 product regression.

## Important implementation decisions already accepted

- `assessmentFiveSurfacesV1` is the target Library/Processes/Outputs/Reports/Initiatives contract.
- `processes` is canonical; do not restore the legacy `list` surface.
- T22 Outputs remains R10.
- T22 uses truthful `selection: none`; there is no fabricated bulk endpoint.
- Menu 3 atoms may be `ACCEPTED_NA_CONTRACT` where selection/bulk capability does not truthfully exist.
- T30 Goals is not backend-blocked: a real Goal CRUD/rollup/link API exists under `/initiatives-v4/goals`; the Initiatives Goals surface was implemented and technically accepted.
- Do not confuse Reports Details prose P25 with M14 selection/Menu 3.
- R02 remains `PARTIAL/DEFERRED_INTERVIEW` because protected Interview ownership was intentionally excluded.

## Canonical sources to read completely

1. `AI_HANDOVER/threads/ui_table_repair_45_autonomous_supervision.md`
2. `docs/ui-standards/evidence/table-audit-45-2026-08-05/REPAIR_MASTER_PLAN.md`
3. `docs/ui-standards/evidence/table-audit-45-2026-08-05/REPAIR_STATUS.csv`
4. `docs/ui-standards/evidence/table-audit-45-2026-08-05/ATOMIC_DEFECT_BACKLOG.csv`
5. `docs/ui-standards/evidence/table-audit-45-2026-08-05/ATOMIC_PACKAGE_MAP.csv`

## Known tracker corruption and drift

Do not treat the current trackers as an accurate implementation ledger:

- `ATOMIC_PACKAGE_MAP.csv` still reports 322/322 atoms as `OPEN`;
- all historical `accepted_sha` values are empty;
- all 25 package `candidate_sha` values were empty at the last reconciliation;
- `REPAIR_STATUS.csv` contains impossible counters such as R18 `43/2` and R25 `8/1`;
- R13 contains a stale assertion that T30 lacks a real API;
- R26 is superseded by R15;
- some dependency blockers are stale because R01–R04 and later packages were technically accepted;
- historical visual evidence does not prove the final SHA.

Tracker reconciliation must be parser-driven. Every one of the 322 unique atoms must receive exactly one honest disposition:

- `TECH_PASS`;
- `VISUAL_PASS_EXACT_SHA`;
- `VISUAL_PENDING`;
- `ACCEPTED_NA`;
- `BLOCKED_OWNERSHIP`;
- `BLOCKED_PRODUCT`;
- `BLOCKED_ROUTING`;
- `OPEN_CONFIRMED`.

Any passed/accepted status needs the exact candidate SHA and concrete evidence. Any blocker needs a reason, owner/decision, and impact on the release candidate.

## Why the program became slow

The main bottleneck was governance, not implementation:

1. An audit-oriented 322-atom ledger became the execution unit, creating too many micro-packages.
2. Code acceptance, dirty-worktree protection, integration, tracker accounting, and visual acceptance were mixed into one workflow.
3. `ACCEPTED_PARTIAL` became a permanent parking state because the master plan required exact deployed evidence while deployment was prohibited.
4. Trackers were not updated as packages landed, so each cycle reconstructed truth from scratch and revisited completed surfaces.
5. The integration candidate was created too late; an earlier temporary worktree was removed by macOS and had to be reconstructed exactly.
6. Author QA, independent QA, negative controls, lint, typecheck, and diff-check were repeated after very small changes.
7. Manual Claude relay and timed polling introduced latency and context drift.
8. Source-anchor tests missed runtime state ownership; local visual QA later found the real Outputs `All 0` defect.
9. The visual harness itself contained missing registration and incomplete mocks, adding non-product work.

Keep the safety controls, but apply them at phase boundaries rather than to every atom.

## Final execution plan

### Gate 1 — freeze and verify the final candidate

- Work only in the isolated follow-up worktree.
- Confirm branch, HEAD, upstream, clean status, and origin equality.
- Treat `da6e409e2b` as frozen unless a new reproducible P0 defect is found.
- Never edit the shared dirty repository.

### Gate 2 — reconcile the ledgers

- Build a parser-backed 322-atom matrix from current code, tests, accepted package reports, and exact-SHA evidence.
- Repair package counters, candidate SHA fields, stale dependencies, T30 status, and R26 supersession.
- Add or run integrity validation: 322 unique atoms, no missing disposition, coherent package totals, and evidence/SHA for every accepted state.

### Gate 3 — one final non-production code gate

- Run the relevant tableSurface contracts, all UI45 scoped suites, shared StandardTable/Preview/Menu tests, typecheck, scoped lint, diff-check, and normal hooks.
- Do not repeat green gates without a code change.
- If a regression is found, prove candidate causality, patch minimally in the isolated branch, add a regression test, and rerun only affected gates plus one final aggregate gate.

### Gate 4 — exact-SHA local visual/runtime matrix

- Use the final SHA only.
- Cover populated, honest empty, error where supported, preview, truthful kebab, PPM/right-click where capability exists, no secret leakage, and required viewports.
- Store a manifest tying evidence to SHA, surface, state, viewport, and timestamp.
- Never mask a product bug in harness mocks.

### Gate 5 — explicit disposition of residual scope

At minimum resolve or defer honestly:

- R02 Interview protected ownership;
- protected Finance;
- protected MyWork/Calendar;
- R14 routing/history atoms;
- any remaining `OPEN_CONFIRMED` or product decision.

A deferred surface does not have to block the non-production RC if it is isolated, causes no regression, and the tracker does not claim it is repaired.

### Gate 6 — final branch state

- Commit normally with hooks; no `--no-verify`.
- Push only `codex/ui45-dev-render-followup-2026-08-08`.
- Confirm origin SHA and clean worktree.
- Do not create a PR, merge, or deploy without Piotr's explicit approval.

## Definition of final non-production closeout

`FINAL_NON_PRODUCTION_CLOSEOUT: PASS` requires:

1. one final pushed branch and SHA;
2. clean isolated worktree;
3. documented tests/typecheck/lint/diff/hooks;
4. complete exact-SHA local visual matrix with PASS/N/A/BLOCKED outcomes;
5. all 322 atoms classified, not all `OPEN`;
6. coherent REPAIR_STATUS counts and candidate SHA;
7. every residual scope item explicitly deferred or blocked with a decision owner;
8. production/Railway/demo untouched;
9. only PR/merge/deploy or a genuinely irreducible product decision remains for Piotr.

## Successor prompt

Paste the following into a fresh Codex successor task:

```text
Continue and finish the Consultify UI 45 Tables program from the canonical successor handoff:

/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/AI_HANDOVER/threads/ui_table_repair_45_successor_handoff_2026-08-08.md

Read that file and every canonical source it lists completely before acting. Revalidate current Git branch, HEAD, origin, worktree cleanliness, and tracker contents; do not trust conversational history when live state is cheaper to verify.

The sole implementation candidate is the isolated worktree:
/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-ui45-followup

Expected branch/SHA:
codex/ui45-dev-render-followup-2026-08-08
da6e409e2b262dddf1b5d347a5bdde593d86cb7a

The shared iCloud repository is read-only and contains concurrent changes. Production, Railway, demo, production data, PR creation, merge, and deploy are prohibited without a new explicit decision from Piotr.

Your job is release closeout, not another sequence of micro-preflights. Freeze the accepted candidate unless a new reproducible P0 appears; reconcile all 322 atoms and package counters by parser; perform one proportional final code gate; complete exact-SHA local visual/runtime evidence; explicitly disposition Interview/Finance/MyWork/R14 and all remaining blockers; commit and push only the follow-up branch if in-scope changes are necessary.

Do not stop at a plan, ACCEPTED_PARTIAL, READY_FOR_REVIEW, or AWAITING_CODEX_QA. Continue autonomously until `FINAL_NON_PRODUCTION_CLOSEOUT: PASS`, or until exactly one genuinely irreversible/product decision remains. Report only material progress, a new reproducible defect, or that single final decision.
```

## Claude Code autonomous execution

Claude Code v2.1.139 or later supports `/goal`, which keeps starting turns until a separately evaluated completion condition is met. For a Claude handoff, use the full closeout prompt already supplied to Piotr, start it with `/goal`, and pair it with Auto mode in the isolated follow-up worktree. Do not use unrestricted bypass mode in the shared repository.

## Final report schema

```text
FINAL_NON_PRODUCTION_CLOSEOUT: PASS | BLOCKED
Final branch:
Final SHA:
Origin SHA:
Worktree status:
Files changed:
Atom totals by status:
Packages/surfaces completed:
Exact-SHA visual matrix:
Tests:
Typecheck:
Lint/diff/hooks:
Deferred scope:
Real blockers:
Production/Railway/demo status:
Single remaining Piotr decision:
```

Do not end with `AWAITING_CODEX_QA`. Either finish the allowed non-production closeout or identify the single irreducible decision.
