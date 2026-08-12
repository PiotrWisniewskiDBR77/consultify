# EPIC IE-001 — Initiative to Effectiveness, one governed golden thread

Status: `ACCEPTED AUTOMATED CANDIDATE — logged-in manual gate pending on current SHA`
Owner: Product + Engineering
Implementation branch: `codex/initiatives-execution-final-candidate`
Baseline: `635fd2d48d5a396c45bcb43b7f363535403ecf93`

## 1. Outcome

Deliver one coherent Initiatives + Execution runtime in which a source-backed Initiative can pass through all twelve lifecycle states, be selected and scheduled against other work, enter exactly one active Execution Case, produce canonical Tasks and Decisions, consume governed resources, respond to exceptions, report delivery, hand outcomes to Results and close without duplicate truth.

This Epic is complete only when [FINAL_ACCEPTANCE_CASE_ACO.md](FINAL_ACCEPTANCE_CASE_ACO.md) passes against real persisted data on one exact build SHA.

Automated implementation disposition (2026-08-11): `ACCEPTED`. The canonical backend, complete ACO
1–59 browser journey and nine-function automated runtime audit are evidenced. The original isolated
commit is unavailable from the remote, so the candidate was reconstructed on
`codex/initiatives-execution-final-candidate`. The code candidate
`cd5f5f858390d82694926e130ea77faa97f855ad` passed the strict Railway build and was deployed to
`https://demo.consultify.ai` as deployment `d4bc7cd4-46cd-435c-bdc0-3440995d26fa`. A later corrected
candidate completed a historical logged-in nine-function walkthrough on Piotr's owner account.
That walkthrough does not transfer to the later correction SHA. The current exact candidate,
deployment, automated evidence and remaining terminal gate are recorded in
`IE_FINAL_CANDIDATE_MANIFEST.md` and in the external immutable receipt. Production release remains
a separate, unauthorized gate.

## 2. Scope

### Included

- Initiative lifecycle and independent gate/readiness/disposition/health/effectiveness/save dimensions;
- closed 26-card registry with per-Initiative include/omit/order configuration;
- configurable organization -> project -> Initiative governance policy;
- Inicjatywy, Portfel, Plan and Obciążenie;
- one active Execution Case per Initiative;
- Realizacje, Praca, Zasoby, Sterowanie and Raporty;
- canonical Task, Decision, My Work, Finance/Results references and read-back;
- concurrency, idempotency, audit and durable event delivery;
- desktop plus the accepted responsive subset;
- migration/compatibility and rollback.

### Excluded

- arbitrary new business-card types outside the canonical 26;
- user-authored lifecycle states;
- BPMN-grade workflow designer;
- autonomous AI approval, quorum participation or irreversible writes;
- parallel active Execution Cases for one Initiative;
- production release before separate release authorization.

## 3. Epic invariants

1. `initiativeId` and lineage remain stable from registration through archive.
2. At most one active Execution Case exists for an Initiative.
3. A Task or Decision has one ID and one lifecycle across Initiative, My Work and Execution.
4. Portfolio/Plan/Capacity interactions create proposals or decisions, never hidden Initiative mutations.
5. Every gate records the effective governance-policy version and exact evidence snapshot.
6. Missing/stale/conflicting data never becomes zero, green, complete or approved.
7. Material commands require capability, expected version, idempotency key, audit and read-back.
8. AI output remains a provenance-labelled proposal until accepted by an authorized human.
9. Finance owns financial truth; Results owns KPI/benefit observations.
10. Runtime success is not inferred from source code, mocks, screenshots, seeds or helper tests.

## 4. Epic Definition of Ready

- isolated worktree and safety baseline exist;
- owner canon snapshot and checksums are recorded;
- file/hunk ownership ledger excludes foreign dirty work;
- schema/API/event contracts for the active slice are approved;
- test tenant, users, roles and realDB fixture plan exist;
- feature flag and rollback behavior are named;
- no unresolved `BLOCKED` item is silently defaulted.

## 5. Epic Definition of Done

The Epic is `DONE` only when all conditions below are evidenced.

### Product and process

- all twelve lifecycle states and every required gate are reachable only through allowed transitions;
- the complete ACO acceptance case passes from source registration to archive;
- Portfolio, Plan and Capacity decisions read back into the same Initiative Card;
- Execution acceptance creates exactly one active Execution Case;
- delivery and effectiveness remain distinct;
- `REJECTED`, `STOPPED` and `CANCELLED` retain distinct semantics;
- Lite, Standard and Complex policy resolution is proven, including project override and audited downgrade.

### Initiative Card

- exactly 26 canonical business-card capabilities exist in one versioned registry;
- add/omit/reorder uses only catalog cards and preserves omitted-card data/history;
- lifecycle profile, requiredness, findings, next action and exact gate are coherent;
- each delivered card proves owner/source/version/freshness/capability/save/conflict/reload/a11y;
- no `InitiativeFullView` consumer remains without an accepted migration disposition.

### Data and integrations

- one canonical identity for Initiative, Task, Decision, Execution Case and Report Run;
- tenant/project/item authorization is server-enforced;
- Finance/Results values are referenced with source ID/version/as-of, not copied as unexplained numbers;
- My Work is a projection and commands update the canonical object;
- material command + audit + outbox are transactionally safe;
- duplicate retries produce one durable effect;
- read-model lag is visible and eventually reconciles.

### UI/UX and accessibility

- canonical table -> preview -> exact card/Workbench navigation preserves return context;
- loading, first-use empty, filtered empty, partial, stale, unknown, conflict, permission and retry states pass;
- no dashboard wall, giant empty state or false precision;
- keyboard navigation, focus return, accessible names, contrast and supported responsive behavior pass;
- AI proposal, system truth and human-approved truth are visually distinct.

### Verification

- unit, schema, contract, integration, component and E2E suites pass on exact SHA;
- realDB reload and cross-surface read-back are recorded;
- negative-role and cross-tenant tests pass;
- timeout, retry, stale version, partial dependency and rollback tests pass;
- screenshots, request/response evidence, persisted rows, audit and outbox evidence are linked;
- no Severity 0/1 defect or unowned Severity 2 defect remains;
- product owner accepts the final evidence packet.

## 6. Non-completion conditions

Any of the following keeps the Epic open:

- only Menu 2 shells or screenshots exist;
- hardcoded fallback/demo data is presented as runtime truth;
- a gate can be passed without server authority or evidence snapshot;
- any retry creates duplicate Initiative, Execution Case, Task, Decision or Report Run;
- My Work or Execution maintains a shadow copy;
- exact utilization/health/on-time is shown with unknown inputs;
- the case passes only in mocks or SQLite when production persistence is PostgreSQL;
- migrations, rollback, audit, accessibility or negative permissions are unproven.

## 7. Evidence packet

The final packet contains:

- exact branch, commit and deployed SHA;
- migration list and rollback rehearsal;
- environment, tenant and actor matrix;
- fixture IDs and starting database snapshot;
- test run IDs/logs and screenshots;
- before/after canonical records;
- audit/outbox/projection evidence for every material command;
- defect register and residual literal gaps;
- owner acceptance record.

## 8. Accepted implementation inventory and release boundary

Implemented and realDB-covered candidates include: twelve-state lifecycle; immutable 26-card truth;
Definition and Analysis gates; AI evidence human acceptance; material change/reapproval; versioned
Portfolio, Plan and Capacity scenarios; Plan global `windowUnit/timezone/periods`; capacity options;
Schedule and frozen Handoff Package; one Execution Case; canonical Task/Decision/My Work; Execution
Milestones and blast radius; operational allocations; Intervention apply/verification; versioned
Report Definitions and persisted Report Runs; Delivery and Results acceptance; authoritative
Results observations and Finance reconciliation references; Effectiveness snapshot/review; governed
Closure; archive and archive write guard.

Governance is configurable through `BASELINE_SMALL`, `STANDARD` and `COMPLEX` profiles with persisted
role bindings, separation/quorum/delegation/SLA snapshots and signer-owned Gate Signoffs. Project
authorization now fails closed for legacy `UNKNOWN` scope and proves Viewer, unrelated-project,
foreign-tenant, Admin-without-business-binding, expired-delegation and capability-loss cases without
aggregate/audit/outbox/receipt mutation.

The historical isolated candidate was accepted on 2026-08-11. During reconstruction the previously
reported global TypeScript failures were corrected and repository-wide type-check and production
build now pass. This does not turn historical evidence into proof of the reconstructed release:
manual logged-in demo acceptance was completed by the corrected candidate; see the final manifest.

Current verification evidence: full browser composition `3/3 PASS` covering Source/Card, ACO 1–59
and the nine-function WCAG/responsive matrix; unit `59/59 files, 144/144 tests`; isolated sequential
realDB `38/38 files, 88/88 tests`; lint with zero errors across every changed/untracked TypeScript
and TSX path; `git diff --check`; authorization negative matrix; WCAG 200% text resize and `390x844`
narrow responsive checks; repository-wide type-check and production build. Manual demo acceptance
was explicitly `NOT VERIFIED` at that historical checkpoint and is now superseded by the final manifest.
