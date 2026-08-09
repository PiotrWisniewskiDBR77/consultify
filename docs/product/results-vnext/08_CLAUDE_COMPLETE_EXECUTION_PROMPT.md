# Prompt dla Claude — Complete Results Next Execution

Poniższy blok jest gotowy do przekazania Claude’owi w całości.

---

# CLAUDE EXECUTION CONTRACT — COMPLETE CONSULTIFY RESULTS NEXT

You are the sole accountable execution owner for the complete Consultify Results Next implementation.

This is one persistent end-to-end execution task. You must implement the entire approved Results Next program: shared platform and registry foundations, KPI Management, ROI & Benefits Realization, OKR Management, individual and organizational projections, Teresa, MyWork, Decisions, governance, security, legacy archive boundaries, cross-domain integration, UX/CX compliance, hardening, tests and the complete candidate evidence package.

“One task” means one uninterrupted terminal objective and one integrated candidate. Internally you must still use bounded epics, isolated worktrees, explicit file ownership, small reviewable commits and controlled integration.

Do not return a partial implementation handoff. Checkpoints are allowed, but they are not a handoff and must never claim that Results Next is complete.

Codex remains Architecture Owner, Release Owner and independent Acceptance Owner. Your final result is only a candidate for independent review. You cannot self-accept, ship, deploy or declare GO.

## 1. Objective

Deliver the complete implementation of:

- KPI as a governed measurement, deviation-response and effectiveness-verification system;
- ROI as an Initiative-bound economic contract with baseline, deterministic scenarios, immutable approval, Forecast, Actual, Benefits Realization and PIR;
- OKR as an independent Program/Cycle/Set/Objectives/KRs/check-in/support/review/reflection system;
- exactly three top-level parent registries: KPI Scorecards, ROI Cases and materialized OKR Sets;
- personal, team, business-unit and organization projections from the same aggregate truth;
- Teresa from the first accepted product slice;
- same-object MyWork and exact-version Decision integration;
- clean-start vNext schemas with labelled read-only legacy archives;
- domain-specific visibility, maker-checker, audit, events, evidence and realDB proof;
- complete functional and graphical/CX parity with Consultify standards.

Success means every mandatory epic and acceptance criterion has been implemented and evidenced on one clean integrated candidate SHA, and every candidate-verifiable requirement of RN-G0–RN-G7 passes. Deployment to the terminal acceptance environment and final product acceptance remain Codex/Founder-controlled actions unless separately authorized.

## 2. Read before mutation

Read every selected instruction file completely before writing code.

### Primary Results Next package

1. `docs/product/results-vnext/00_README.md`
2. `docs/product/results-vnext/01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md`
3. `docs/product/results-vnext/02_KPI_IMPLEMENTATION_PLAN.md`
4. `docs/product/results-vnext/03_ROI_IMPLEMENTATION_PLAN.md`
5. `docs/product/results-vnext/04_OKR_IMPLEMENTATION_PLAN.md`
6. `docs/product/results-vnext/05_CONSORTIUM_CRITICAL_REVIEW.md`
7. `docs/product/results-vnext/06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md`
8. `docs/product/results-vnext/07_EPIC_AND_TRACEABILITY_LEDGER.md`

### Original product specifications

9. `/Users/piotrwisniewski/Downloads/01_CONSULTIFY_KPI_MANAGEMENT_SYSTEM.md`
10. `/Users/piotrwisniewski/Downloads/02_CONSULTIFY_ROI_BENEFITS_REALIZATION_SYSTEM.md`
11. `/Users/piotrwisniewski/Downloads/03_CONSULTIFY_OKR_MANAGEMENT_SYSTEM.md`

### Repository and execution governance

12. `CLAUDE.md` and every applicable `AGENTS.md`
13. `docs/SOURCE_OF_TRUTH.md`, if present
14. `docs/program/CLAUDE_DELEGATION_OPERATING_RULE_2026-08-07.md`
15. current database, security, MyWork, Decisions, Initiative, Finance, Teresa, event/outbox, evidence and operations contracts referenced by the package

### Mandatory UI/CX authority

16. `docs/ui-standards/CANON.md`
17. `docs/ui-standards/TRIADA_KANON.md`
18. `docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md`
19. `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`
20. `docs/ui-standards/UI_UX_IMPLEMENTATION_STANDARD.md`
21. applicable foundation token, typography, motion, accessibility, empty/loading/error and standard component contracts referenced by those documents
22. current implementations under `src/components/standard/` and their shared mechanical/orchestration dependencies

Do not skim the Results Next package or original three domain specifications. Maintain a persistent execution ledger so you do not rely on memory after context compaction.

## 3. Authority order

1. Explicit Founder decisions RN-D01–RN-D15.
2. Results Next Master Implementation Plan.
3. The applicable domain plan for KPI, ROI or OKR semantics.
4. Consortium Critical Review resolutions.
5. Acceptance Handbook and Epic/Traceability Ledger.
6. Current UI/CX canon and shared component contracts.
7. Current security/database/operations contracts.
8. Existing runtime code, schema and tests as evidence of current state.
9. Historical plans and legacy code.

Current code proves what exists. It does not override the approved target product.

Do not reopen RN-D01–RN-D15. If authoritative sources still conflict, stop only the affected irreversible decision, record the exact conflict as `EVIDENCE_MISSING`, continue all unaffected work and escalate with a recommendation. Never invent a third model.

## 4. Non-negotiable product decisions

- Three independent domains under one Results shell.
- No generic `ResultsItem`, shared lifecycle, shared status or shared domain table.
- Top-level objects are Scorecard, ROI Case and materialized OKR Set.
- New central KPI aggregate.
- Scorecard is a live collection of KPI references; published reviews are immutable snapshots.
- ROI Case requires Initiative from creation and is unique per active Initiative.
- Results ROI and Finance remain separate for this delivery, joined only by a pinned, versioned interoperability seam; no silent sync.
- Original Approved, Current Forecast and Actual are independent truths.
- OKR Set is Cycle + organizational scope + accountable owner.
- OKR has no structural dependency or inherited score from KPI, ROI, Initiative, project or task.
- Visibility defaults and policy semantics are domain-specific.
- Maker-checker is domain- and materiality-specific; self-approval is denied where required.
- Domain state remains in the domain; MyWork and Decisions store references/obligations, not duplicate state.
- Clean start: no automatic legacy migration, backfill, heuristic dedupe or dual-write.
- Legacy remains an explicitly labelled, excluded, read-only archive.
- KPI, ROI and OKR may proceed in parallel only after shared contracts/foundation freeze.
- Teresa participates through typed, authorized, auditable proposals from the first accepted slice.
- Every module serves both individual work and organization management using the same aggregate IDs and versions.

## 5. Repository and dirty-worktree safety

Assume the current shared/root worktree is dirty and contains user-owned work.

Before any mutation record:

- absolute cwd;
- branch and HEAD;
- fetched `origin/demo` SHA;
- `git status --short`;
- active worktrees and branches;
- relevant running processes;
- overlapping files and current checksums;
- existing untracked Results Next documents and changes.

The shared dirty worktree is read-only for implementation. Do not “clean it up”. Create isolated worktrees from a verified baseline and use bounded branches. Follow repository branch conventions; default prefix is `codex/` unless an existing approved program convention requires otherwise.

Forbidden:

- `git reset --hard`;
- destructive checkout of user files;
- `git clean`;
- stash/stash pop;
- `git add -A`;
- broad workspace commits;
- force push;
- deleting unknown or user-owned files;
- overwriting another workstream’s changes;
- push, merge, deploy, Railway/demo/production mutation without explicit Codex authorization.

Every worktree/package must record owner, branch, baseline SHA, epic, file allowlist, shared dependencies, integration order, tests and completion SHA.

If ownership collides, stop only those mutations, preserve evidence and resolve through one integration owner.

## 6. Mandatory execution topology

You are accountable for the whole task. Implement it as the DAG below.

### E0 — RN-G0 Contract freeze and baseline

- verify decisions and supersession;
- inventory existing routes, schemas, consumers, flags and legacy writes;
- freeze aggregate, lifecycle, status, visibility, event, API, deep-link and shared-reference contracts;
- create threat model, maker-checker matrix, worktree ownership map and integration DAG;
- create an Open Decision & Evidence Register covering every `EVIDENCE_NEEDED`; resolve every item affecting security, accountability, scoring, lifecycle, financial semantics or lineage before dependent implementation;
- record one named Integration Owner, integration worktree, integration branch, baseline SHA, allowed integration operations and exclusive authority to cherry-pick/rebase/resolve cross-workstream conflicts;
- instantiate every mandatory row from `07_EPIC_AND_TRACEABILITY_LEDGER.md` in a live execution ledger.

No deep implementation before RN-G0 PASS.

### E1 — RN-G1 Platform foundation

- additive tenant-scoped vNext schemas;
- repositories and typed aggregate commands/queries;
- optimistic concurrency and idempotency;
- versioned policies and server-side RBAC+ABAC;
- append-only audit/events and transactional outbox;
- evidence/provenance;
- typed MyWork and Decision references;
- read-only legacy adapters;
- no runtime lazy DDL;
- clean install, realistic-copy migration and recovery path.

### E2 — RN-G2 Registry and projections

- canonical Results shell using the approved Standard* facades and shared mechanics/orchestration only;
- KPI/ROI/OKR typed registry adapters;
- Menu 1/2/3, table/grid, settings, filters/counts, selection/bulk, kebab, context menu, preview and full-tool routes;
- loading/empty/filtered-empty/no-access/error/retry/degraded states with persistent headers;
- My/team/BU/organization projections from the same aggregate IDs;
- non-leaking count/search/export/notification/AI context;
- cold deep-link and return-state behavior.

### E3 — RN-G3 Teresa, MyWork and Decisions

- typed proposal catalog with sources, evidence digest, fact/inference/recommendation, expected version, consequence preview, permission preflight, required approver, expiry and idempotency;
- accept/reject disposition and resulting audit;
- personal and organizational Teresa modes;
- same-object MyWork execution and obligation dedupe;
- exact-version Decision request/resolution;
- no silent write and no autonomous governance action.

### E4 — Complete KPI domain

Implement every KPI epic and acceptance row, including:

- KPI identity and versioned contract;
- lifecycle/performance/data-quality/attention separation;
- Scorecards and immutable review snapshots;
- governed measurements and corrections;
- all target geometries;
- deviation/RCA/plan/actions/remeasure/effectiveness/close/reopen;
- personal and organizational views;
- Initiative impact references;
- Teresa, MyWork, Decisions, history, audit and legacy archive.

### E5 — Complete ROI domain

Implement every ROI epic and acceptance row, including:

- Initiative-bound Case;
- baseline/BAU, assumptions, costs, benefits, scenarios and cash flows;
- deterministic versioned calculation engine and known-answer fixtures;
- Build Case, Decision, Realize Value and Learn;
- maker-checker and immutable Original Approved;
- Current Forecast, Actual, evidence, variance and Benefits Realization;
- post-Initiative continuation and PIR;
- individual and organizational views;
- typed KPI evidence and pinned Finance seam;
- Teresa, MyWork, Decisions, audit and legacy archive.

### E6 — Complete OKR domain

Implement every OKR epic and acceptance row, including:

- Program, policy versions, population rules and Cycle;
- materialized Set;
- Objectives and KRs;
- progress/confidence/status/attention separation;
- cadence and check-ins;
- alignment without score inheritance;
- visibility and restricted-metadata safety;
- submit/review/approve/activate/material revision;
- support, Decision and manager attention;
- score, reflection, close and carry-forward;
- My/team/BU/company projections;
- Teresa, MyWork, audit and legacy archive.

### RN-G4 checkpoint — Complete domain gold flows

After E4–E6 implement their first complete gold flows, record RN-G4 independently for KPI, ROI and OKR. A PASS in one domain does not compensate for another.

### RN-G5 checkpoint — Operational depth

Before cross-domain integration, prove KPI Scorecard review/effectiveness, ROI Forecast/Actual/Variance/PIR and OKR recurring scheduler/support/scoring/reflection/carry-forward, including restart and obligation idempotency.

### E7 — RN-G6 Cross-domain integration

- version-pinned KPI evidence for ROI without ownership transfer;
- neutral OKR source bindings without structural linkage;
- Initiative projections and reverse navigation;
- Results–Finance pinned references without automatic sync;
- MyWork, Decisions, Reporting and event integrations;
- explicit Finance pin/divergence/reconciliation test with no silent sync;
- explicit neutral OKR source-binding test with no structural inheritance or score mutation;
- notification and Reporting readback with authorization filtering, retry/idempotency, pinned source version and cold reopen;
- failure isolation, replay, rebuild and version pinning;
- no shared scoring/status/lifecycle.

### E8 — RN-G7 Hardening and final candidate

- full Acceptance Handbook;
- functional/security/data/AI/reliability tests;
- realDB, multi-user, tenant and cold-restart proof;
- PL/EN, dark/light, 1280/1440/1600/1920, zoom and tablet review;
- keyboard/a11y/WCAG/reduced motion;
- performance/SLO/observability;
- backup/restore, rollback/flag-off and runbook;
- exact-SHA screenshot, DOM/computed-style, console/network and evidence manifest;
- no unresolved P0/P1.

After RN-G0, E1 Platform Foundation executes toward RN-G1.

Before RN-G1, E2–E6 may perform only contract-backed, non-mutating preparation: test design, typed interface consumers, UI states behind fixtures explicitly excluded from acceptance, and bounded pure domain logic independent of persistence/auth/events.

Dependent schema, commands, authorization, event, MyWork/Decision and integrated domain implementation may proceed in parallel only after RN-G1 passes. Shared auth, event, reference, Teresa and table frameworks have one named owner. Domain workstreams may not create competing implementations.

## 7. File ownership

Create and maintain:

| Epic | Worktree | Branch | Allowed paths | Shared/forbidden paths | Owner | Integration order | Test owner |
|---|---|---|---|---|---|---|---|

Rules:

- Platform owns shared schema conventions, authorization, event envelope, outbox, evidence and typed references.
- Registry owns the Results shell, routes and standard surface integration.
- KPI, ROI and OKR own only their domain aggregates, services, endpoints, projections, tools and tests.
- Teresa owns proposal runtime and domain adapters, not domain truth.
- QA/Evidence adds tests and evidence harnesses but cannot silently modify product behavior.
- Any edit outside allowlist requires ownership update before mutation.

## 8. Implementation prohibitions

Do not:

- build fake tools using `id: 'new'`;
- treat API error as empty data or missing as zero;
- use legacy records in vNext counts, default views, analytics, status or Teresa context;
- dual-write or silently fall back to legacy;
- introduce a generic Results aggregate/status/lifecycle;
- duplicate KPI truth inside Scorecards;
- create ROI without Initiative or overwrite Approved with Forecast/Actual;
- structurally attach OKR to KPI/ROI/Initiative/task/project;
- update KR from task completion, blindly average confidence or inherit score through alignment;
- use shadow authorization as security proof or authorize only in UI;
- leak restricted data through ID, metadata, count, search, export, relation, notification or AI;
- let Teresa invent evidence, approve, verify, publish policy, change visibility or silently mutate;
- create bespoke Results tables, menus, previews, status chips or visual tokens;
- use mock/synthetic results as terminal evidence;
- hide skipped/flaky tests behind a green summary;
- combine unrelated cleanup with Results Next implementation.

## 9. Testing and evidence

Use `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md` literally.

At minimum perform:

- formatting/diff checks, current typecheck, build and lint;
- empty and realistic-copy migrations;
- schema/constraints/index/FK inspection;
- domain state and property/boundary tests;
- known-answer ROI tests;
- API contract, typed error, retry/idempotency and concurrency tests;
- security role/tenant/visibility/maker-checker negatives;
- outbox atomicity/replay, consumer dedupe and projection rebuild;
- MyWork/Decision/Teresa/integration tests;
- complete KPI, ROI, OKR and cross-domain E2E;
- realDB write/read/restart/cold reopen;
- full TRIADA/table/preview/full-tool checklist;
- dark/light, PL/EN, required viewports/zoom;
- keyboard-only and accessibility tests;
- visual review with exact-SHA captures, DOM/computed styles, console and network evidence;
- performance, monitoring and recovery rehearsal.

Do not claim a result that was not reproduced on the final integrated candidate SHA.

## 10. Evidence package

Maintain an append-only evidence index containing:

- baseline, every worktree/package commit and integrated candidate SHA;
- allowlists and actual changed-file reconciliation;
- RN-G0–RN-G7 matrix;
- complete Epic/Feature/AC ledger;
- migration/schema checksums;
- exact commands, full outcomes, exit codes, skipped/flaky/failures;
- API requests/responses and realDB IDs/versions;
- event/outbox/audit/MyWork/Decision IDs;
- user A/user B/restricted outsider/foreign tenant evidence;
- Teresa source/proposal/disposition/audit;
- cold reopen, projection rebuild and recovery;
- screenshots with SHA/route/theme/viewport/zoom/locale/time/org/user/data provenance;
- DOM/a11y/computed style and console/network evidence;
- known limitations with literal status;
- rollback/forward-repair posture.

Mocks and package-level worktree evidence must be labelled. Final acceptance evidence must be recaptured on one integrated candidate.

## 11. Working behavior and persistence

- Continue until the entire program is implemented and evidenced.
- Solve ordinary technical questions from the approved contracts and repository.
- Preserve `UNKNOWN`, `PARTIAL`, `BLOCKED` and `EVIDENCE_MISSING` literally.
- If one package blocks, continue all unaffected work.
- Repair defects found by your own tests and rerun affected integration/regression suites.
- Use small commits per bounded package and one controlled integration owner.
- Re-read the relevant contract before each epic and update the persistent ledger.
- After three failed attempts using the same approach, preserve failure evidence, change approach or escalate the precise architectural decision.

Do not stop after discovery, planning, schema, a single domain, a UI shell, a vertical slice, mocked fixtures, a build, green unit tests, generated screenshots or internal self-review.

Interim updates contain gate, SHA, tests, blockers and next epic. They are checkpoints only.

Ask for input only for a genuinely unresolved Founder-level, security, financial, reputational, cost or irreversible decision. State the exact evidence, recommendation, safe boundary and unaffected work you will continue.

## 12. Commit and integration policy

- Commit each bounded package separately.
- Never stage outside its allowlist.
- Integrate only commits whose scope and tests reconcile.
- Shared-contract commits land before dependent workstreams.
- Resolve conflicts semantically against RN-D01–RN-D15 and current contracts.
- After every integration wave rerun affected contract/security/integration tests.
- Produce one clean integrated candidate branch/SHA from the verified baseline.
- Do not push, deploy or mutate demo/production.

## 13. Completion boundary

You may prepare a final candidate handoff only when:

- every candidate-verifiable requirement of RN-G0–RN-G7 passes on the integrated SHA;
- every mandatory Master/KPI/ROI/OKR/cross-domain acceptance row passes;
- every epic and feature is mapped to code, tests and evidence;
- all integrated tests and realDB flows pass on one candidate SHA;
- full visual/CX/accessibility evidence exists for that same SHA;
- there is no unresolved P0/P1;
- no mandatory item remains `PARTIAL`, `BLOCKED` or `EVIDENCE_MISSING`;
- the complete candidate branch/SHA and immutable evidence index are ready;
- no unauthorized push/deploy occurred.

The handoff status is `IMPLEMENTED_EVIDENCED_CANDIDATE`. It does not require or permit you to self-authorize deployment. Codex will independently reproduce evidence, authorize any push/deploy to the named terminal acceptance environment, verify deployed client/server/migration SHA parity and decide `ACCEPTED_ACCEPTANCE_ENV`/terminal acceptance with the Founder.

The final report must contain:

1. integrated branch, baseline SHA and candidate SHA;
2. commits and changed files by epic;
3. RN-G0–RN-G7 matrix;
4. complete domain and cross-domain acceptance matrices;
5. test matrix with exact commands/results;
6. realDB/security/Teresa/visual evidence index;
7. known limitations;
8. rollback/forward-repair posture;
9. confirmation of no unauthorized actions;
10. explicit statement that Codex independent acceptance remains pending.

If a genuinely external blocker remains after all safe work and alternatives are exhausted, do not claim completion. Preserve worktrees, branches and evidence; report the first blocked gate/AC, exact failed evidence, completed-but-nonfinal scope and smallest required external action. Complete all unaffected work first.

Do not phrase the candidate as accepted, shipped, production-ready or GO.

Only after every completion condition above is true, place the following as the final line of the final response:

READY_FOR_CODEX_REVIEW

---
