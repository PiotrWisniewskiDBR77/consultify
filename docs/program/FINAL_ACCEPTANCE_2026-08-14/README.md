# Consultify final cleanup and acceptance control

Status: `IN_PROGRESS`  
Canonical branch: `codex/consultify-canonical-cleanup-20260814`  
Current evidence SHA: `b15b8e1ae1acd4af48714da94fbd6125e1dde533`  
Owner: CTO integration

This directory is the execution control for the last consolidation and module
acceptance pass. It does not inherit `READY` or `FINAL` claims from historical
documents. A module is ready only when the evidence below exists for the exact
candidate SHA and the intended environment.

## Literal status vocabulary

- `READY` — every required gate passed on the exact candidate and the intended runtime.
- `PARTIAL` — valuable implementation is integrated, but at least one product gate is open.
- `BLOCKED` — a known defect prevents acceptance.
- `NOT_VERIFIED` — implementation may exist, but the required evidence has not been run.
- `OUT_OF_SCOPE` — explicitly excluded by product authority, not silently omitted.

`INTEGRATED` is never a synonym for `READY`.

## Six-layer cleanup contract

| Layer                              | What must be proven                                                                                                  | Exit condition                                                                      | Current state                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| 1. Git and worktrees               | Every dirty checkout is inventoried and recoverable; one candidate branch is named                                   | backup ref + patch/archive manifest; canonical worktree clean                       | `PASS` preservation; deletion deferred |
| 2. Duplicate implementations       | Competing routes, components, services, migrations and documents have one declared authority                         | winner recorded; unique work integrated or archived; no silent overwrite            | `IN_PROGRESS`                          |
| 3. Reachability and dead code      | Every production feature has route/nav/API/runtime ownership; orphan code is removed, mounted or explicitly retained | route-to-screen-to-API graph and orphan report                                      | `IN_PROGRESS`                          |
| 4. Database and fixtures           | Fresh PostgreSQL can apply the complete strict chain and replay tenant-scoped fixtures                               | 0 failed/skipped/pending/drift; fixture write + replay + readback                   | `PASS` locally on exact SHA            |
| 5. Configuration and release truth | Feature flags, environment contracts, build SHA and deployment target are explicit                                   | no query/localStorage activation dependency; target fingerprint; exact deployed SHA | `NOT_VERIFIED` on demo                 |
| 6. Product acceptance              | Build, tests, browser journeys, accessibility and visual canon pass per module                                       | signed module row with evidence links and no hidden blockers                        | `IN_PROGRESS`                          |

## Current exact-SHA evidence

| Gate                                | Result                  | Evidence                                                                                                                                                                                         |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend type-check                 | `PASS`                  | full root `npm run type-check`                                                                                                                                                                   |
| Backend production build            | `PASS`                  | `npm --prefix server run build`                                                                                                                                                                  |
| Frontend production build           | `PASS`                  | Vite transformed 10,388 modules; completed in 2m16s                                                                                                                                              |
| Migration ordering unit gate        | `PASS`                  | 14/14 tests                                                                                                                                                                                      |
| Fresh PostgreSQL 15.15 strict chain | `PASS`                  | 704/704 `success`; 0 failed, skipped, pending or drift; 11/11 release checks                                                                                                                     |
| Acceptance fixture dry run          | `PASS`                  | 70 statements across Case, Results, Finance, Execution, Ideas and Materials                                                                                                                      |
| Acceptance fixture write/replay     | `PASS`                  | first write 70/70; replay 70/70; Piotr and dedicated OWNER readback                                                                                                                              |
| Finance acceptance flags            | `PASS` in disposable DB | 11/11 enabled for the exact synthetic tenant and `production` environment                                                                                                                        |
| Full lint                           | `BLOCKED`               | 36,124 errors; predominantly formatting/import order, including non-runtime `dev-render`                                                                                                         |
| Full unit suite                     | `IN_PROGRESS`           | stale harnesses repaired for Deliverables, Assessment, rate limiting, permissions and InitiativeController; full `tests/unit --bail=1` recovery continues |
| Demo deploy and browser acceptance  | `NOT_VERIFIED`          | no deployment from this candidate has occurred                                                                                                                                                   |

## Module acceptance register

No row below may become `READY` from documentation coverage or a focused unit
test alone. Browser and visual review are mandatory for user-facing modules.

| Module                    | Integrated state                                       | Current acceptance | Known open gate                                                                                |
| ------------------------- | ------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------- |
| Chat / Teresa             | present                                                | `NOT_VERIFIED`     | exact-SHA demo journey, AI/provider behavior, visual review                                    |
| My Work                   | present                                                | `NOT_VERIFIED`     | full tab matrix, Decisions N-card contract, data/readability review                            |
| Agent Hub                 | latest candidate integrated                            | `PARTIAL`          | business UI/browser acceptance; capability reconciliation; four collaboration modes end-to-end |
| Interview                 | present                                                | `NOT_VERIFIED`     | assignment, response, analysis and handoff journeys                                            |
| Tools                     | consolidated implementation integrated                 | `PARTIAL`          | runtime flag active, real browser flow, product completion handoff gaps                        |
| Assessment / Method Core  | consolidated implementation integrated                 | `PARTIAL`          | Library-to-Session start, Live Artifact surface, runtime flags and browser proof               |
| Initiatives               | present                                                | `NOT_VERIFIED`     | card/table/detail lifecycle and handoff journeys                                               |
| Execution                 | present                                                | `NOT_VERIFIED`     | initiative-card owner contract and full runtime browser proof                                  |
| Results KPI               | VNext present and fixture available                    | `NOT_VERIFIED`     | exact demo route/data/browser lifecycle                                                        |
| Results ROI               | VNext present and fixture available                    | `NOT_VERIFIED`     | approval, actual/variance and PIR browser lifecycle                                            |
| Results OKR               | VNext present and fixture available                    | `NOT_VERIFIED`     | policy/cycle/objective/KR/check-in/review browser lifecycle                                    |
| Finance                   | five canonical workspaces and shared utilities mounted | `PARTIAL`          | 11 remote flags on demo, second-version compare data, all browser flows                        |
| Materials — Documents     | present and fixture available                          | `NOT_VERIFIED`     | lifecycle, approval, export and visual review                                                  |
| Materials — Presentations | present and fixture available                          | `NOT_VERIFIED`     | lifecycle, editing/export and visual review                                                    |
| Materials — Spreadsheets  | present and fixture available                          | `NOT_VERIFIED`     | persistence, formulas, import/export and visual review                                         |
| Audits                    | consolidated implementation integrated                 | `PARTIAL`          | realDB suite, normative source seed, presentation and browser proof                            |
| Meeting                   | present                                                | `NOT_VERIFIED`     | meeting runtime and integration journey                                                        |
| Organization / Admin      | present                                                | `NOT_VERIFIED`     | OWNER/admin/security journeys                                                                  |
| Settings                  | present                                                | `NOT_VERIFIED`     | persistence, permissions and provider configuration                                            |
| Partner Portal            | present                                                | `NOT_VERIFIED`     | partner authentication and lifecycle journeys                                                  |

## Non-negotiable release order

1. Finish static/test/database gates on one clean SHA.
2. Produce route/reachability and orphan reports; resolve production orphans.
3. Freeze the candidate and deploy that exact SHA to demo.
4. Verify demo schema, flags, fixture marker and build SHA by readback.
5. Execute authenticated desktop and mobile browser journeys.
6. Perform visual, responsive and accessibility review against Consultify canon.
7. Fix defects on the canonical branch, then repeat affected gates.
8. Mark modules `READY` one by one; only then remove recoverable old worktrees.

## Cleanup safety rule

Old worktrees and archives are not deleted merely because their commits were
integrated. Deletion requires: clean canonical candidate, verified backup
manifest, no unique patch, successful release gates, and a recorded recovery
path. Until then they are historical evidence, not active development trees.

## Test-harness cleanup ledger

The full unit directory contains 1,664 discovered files. The suite is being
recovered iteratively with `--bail=1` so the first genuine failure is fixed
before later output is trusted.

| Harness                          | Finding                                                                                                    | Current evidence                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Deliverable template service     | expected legacy report-builder writes instead of canonical Studio lifecycles                               | focused 24/24 `PASS`                                                                                        |
| Deliverable template CRUD        | expected legacy document table and did not isolate artifact registry                                       | focused 7/7 `PASS`                                                                                          |
| Assessment initiative generation | dynamic AI import entered a real 30-second provider timeout                                                | focused 20/20 `PASS` with current AI boundary mocked                                                        |
| Rate limiting                    | global clock fault was injected during logger module initialization, outside the intended limiter boundary | focused 36/36 `PASS`                                                                                        |
| Permission service               | assertions omitted the new fail-closed query option                                                        | focused 56/56 `PASS`                                                                                        |
| Initiative controller            | controller boundary aligned with `initiativeTransitionService`; obsolete controller-owned SQL/handoff assertions removed | `PASS`: focused 18/18; transaction behavior remains owned by service tests |

This ledger separates product defects from obsolete tests. Neither category is
silently skipped: product defects are fixed in runtime code; obsolete tests are
rewritten against the current canonical boundary and rerun.
