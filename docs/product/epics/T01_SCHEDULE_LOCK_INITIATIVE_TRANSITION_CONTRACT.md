# T01 Schedule Lock and canonical Initiative transition contract

## Boundary

T01 must never write `initiatives.status` directly. `executeInitiativeTransition` in `server/src/services/initiative/initiativeTransitionService.ts` remains the sole lifecycle owner. The Agent may prepare a decision packet and invoke the owner only after an authorized human decision; it cannot impersonate that actor or infer approval from a Mobilization proposal.

## Required decisions and prerequisites

1. `APPROVED → SCHEDULED`
   - latest Initiative decision for PMO domain `SCHEDULE_MILESTONES` is approved, has a decision maker and is within its deadline;
   - Initiative has `planned_start_date` and `planned_end_date` derived from the approved Mobilization payload;
   - at least one canonical `initiative_milestones` row exists;
   - owning engine creates `initiative_schedule_baselines`, advances `baseline_version` and writes status/history atomically on its pinned client;
   - caller is a real human with an effective role authorized for the `SCHEDULE` gate.
2. `SCHEDULED → EXECUTING`
   - latest `GOVERNANCE_DECISION_MAKING` decision is current and approved;
   - caller is a real human authorized for `START` (the T01 adapter does not use the system-actor carve-out);
   - owner is called with `expectedCurrentStatus='SCHEDULED'`.
3. `EXECUTING → DONE`
   - completion proposal/closure is separately approved by an authorized human;
   - no pending tasks and no blocking decisions remain;
   - use `initiativeClosureService` where a closure request exists; it delegates Unit 2 to `executeInitiativeTransition` and reconciles restart/idempotency;
   - otherwise call the owner engine only through a bounded adapter with `expectedCurrentStatus='EXECUTING'`.

Every transition must read back Initiative status plus exactly one `initiative_status_history` and one `initiative_history` record carrying the engine correlation/decision reference. The Agent receipt stores those owner references; it does not create competing lifecycle history.

## Proposed implementation seam

- Add `server/src/services/v8/transformationInitiativeTransitionAdapterService.ts` as a thin A06 adapter facade. It accepts Case/organization/Initiative, exact expected/current target status, human actor identity/role, approved governed proposal version and decision reference. It verifies Case→Initiative lineage and project membership, calls the owner, then performs tenant-scoped readback.
- Extend `server/src/services/v8/transformationCaseService.ts` with a dedicated Schedule Lock proposal/review/result boundary. The proposal pins Mobilization dates, milestone IDs and their digest. Common A05 must approve it before creating/deciding the owning `SCHEDULE_MILESTONES` decision.
- Reuse the owning Decisions service/controller domain to create and decide the Schedule Lock row. Do not insert a synthetic approved decision directly. Decision writes and transition reads must share the Initiative transition advisory-lock contract before claiming race closure.
- Route the three transition calls through `server/src/services/v8/agentAdapterOrchestratorService.ts` with stable keys: `schedule:<case>:<initiative>:<proposalVersion>`, `start:<case>:<initiative>:<proposalVersion>`, `complete:<case>:<initiative>:<closureRequest>`.
- Replace the four raw status updates in `server/src/scripts/t01InterviewRealDbProof.ts` only after the adapter exists; assertions must read owner history/baseline/decision references.

No change to `initiativeTransitionService.ts` is required unless the Decisions owner cannot acquire the same advisory lock. If lock parity is missing, that is a prerequisite hardening change and must be reviewed with the Initiative owner rather than hidden in T01.

## Focused tests

- New `server/src/services/v8/__tests__/transformationInitiativeTransitionAdapter.test.ts`: tenant/project/actor authority, expected-status drift, A05 denial, A06 replay and payload conflict, owner rejection, readback drift.
- Extend `server/src/services/v8/__tests__/transformationCaseService.test.ts`: Schedule Lock proposal pins exact dates/milestones/digest; rejection produces zero Decision/Initiative side effects.
- Reuse Initiative suites covering `executeInitiativeTransition`, H16 start execution, gate currency/races and `initiativeClosureService`; no snapshot/mocked status-only acceptance.

## Native PostgreSQL acceptance

On an isolated fresh database:

- two concurrent Schedule Lock approvals create one current `SCHEDULE_MILESTONES` decision, one baseline, one transition, one row in each owner history table and one A06 receipt;
- replay after process restart creates zero duplicates;
- superseding/pending/expired decision, foreign tenant, non-member actor, stale expected status, missing dates or milestone produce zero Initiative/baseline/history writes;
- current GO permits exactly one `SCHEDULED → EXECUTING`; NO-GO/pending blocks it;
- incomplete work blocks `DONE`; approved closure after all work completes produces exactly one owner transition/history and restart-safe closure reconciliation;
- final readback is `APPROVED → SCHEDULED → EXECUTING → DONE` with no direct `UPDATE initiatives SET status` in T01 executable code.
