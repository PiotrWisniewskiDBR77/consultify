# A01/A02 — canonical Agent run and execution ledger evidence

Date: 2026-08-08
Scope: local candidate only; not release acceptance

## Delivered increment

- Every newly created Transformation Case registers its existing `v8_execution_runs.run_id` as the canonical Agent run in the same transaction.
- Existing cases are backfilled through `v8_agent_run_identities`; external identifiers can be attached without creating another execution truth through `v8_agent_run_aliases`.
- `GET /api/v8/transformation-cases/:id/runtime` projects the expected canonical run state from the detailed transformation lifecycle and exposes one merged transition/audit timeline.
- `POST /api/v8/transformation-cases/:id/runtime/reconcile` is privileged, reason-required, optimistic and audited. It refuses terminal-state rewrites.
- Transformation Cases UI exposes the canonical Run ID, lineage registration, persisted/projected state and a truthful state-drift warning.

## Real PostgreSQL evidence

Proof script: `server/src/scripts/a01A02CanonicalRunRealDbProof.ts`
Database: `consultify_agent_a02_restart_20260808` (fresh database)

Observed result:

```json
{
  "proof": "A01_A02_REALDB_GREEN",
  "oneCanonicalRunId": "00000000-0000-4000-8000-000000000102",
  "identityBackfill": true,
  "executionDriftDetected": true,
  "applyingReconciled": true,
  "finalOutputProjectedCompleted": true,
  "completedReconciled": true,
  "transitionAndReconciliationAudit": 2,
  "tenantIsolation": true,
  "restartReplay": true,
  "aliasCountAfterRestart": 1,
  "restartAliasTypesVerified": 3,
  "duplicateTransitionsAfterRestart": 0,
  "automaticWave8Projection": true,
  "automaticScheduleProjection": true,
  "automaticAgentPlanProjection": true,
  "automaticWorkGraphProjection": true
}
```

## Automated checks

- `agentCanonicalRunService.test.ts`: 3/3 PASS.
- `TransformationCasesPanel.test.tsx`: 2/2 PASS, including visible drift disclosure and canonical identity.
- Full TypeScript check and broader Transformation Case regression are recorded only after a successful exit; an initial default-memory check exhausted Node's 4 GB heap and is not counted as PASS.

## Automatic projection and restart increment

Wave8 launch, durable schedule registration, schedule success/failure and pause/resume/cancel carry the canonical Run ID, register durable aliases and automatically re-project authoritative state without treating child completion as transformation completion. Agent Planner now projects create, execution lease, approval, schedule, wait-resume/checkpoint, step replacement, finalization and cancellation. Work Graph projects create, running claim, synthesis, contradiction resolution and cancellation; its canonical Run ID is propagated into child Wave8 runs. Alias registration fails closed on tenant, missing canonical identity or owner conflict.

A fresh PostgreSQL proof spawned an independent restart worker process and replayed the binding:

- automatic Wave8 projection: true;
- automatic schedule projection: true;
- one durable alias per replayed external identifier after restart;
- all three replayed alias types verified: `wave8_run`, `agent_plan`, `work_graph`;
- zero duplicate transition/reconciliation records;
- tenant isolation: true.

Focused canonical/planner/work-graph suites: `42/42` PASS. Full repository TypeScript check: PASS.

## Canonical workspace URL and navigation increment

The Agent workspace now persists one canonical navigation context in the URL: `tab=agent`, `agentView`, `transformationCaseId` and `canonicalRunId`. Selecting a different Transformation Case rewrites the Case identifier, removes a stale Run identifier and preserves unrelated query parameters. Once the server returns the canonical runtime identity, the workspace records that exact Run identifier. The contextual Case-to-Operations handoff preserves the Case and pre-fills Operations with the canonical Run ID without automatically invoking the diagnostics API. Browser history/remount restores the selected Case. Invalid or unauthorized Operations deep links fail closed without rendering Operations or calling its API. Polish and English accessible labels explicitly identify the value as the canonical Run ID.

Browserless focused checks (the `16/16` count below is superseded for the A01 UI aggregate by the later `21/21` Agent Hub increment; it remains valid evidence for this narrower URL/navigation slice):

- `AgentHubNavigation.test.tsx`, `AgentAccessibility.test.tsx` and `TransformationCasesPanel.test.tsx`: `16/16` PASS;
- deep-link/remount, Case selection, unrelated-query preservation, stale-ID removal, Case-to-Operations handoff, browser-history restoration and unauthorized zero-side-effect behavior covered;
- `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check -- --pretty false`: PASS, exit `0`.

## Agent Hub IA, vocabulary and state increment

The existing Teresa, My Work, approvals, outputs and history surfaces now read as one Agent Hub rather than unrelated destinations. User-facing identity is consistently expressed as canonical **Case** and canonical **Run**. The hub preserves the canonical Case/Run URL context across view changes and browser history, while role-gated destinations remain unavailable without authority.

The bounded local state contract covers loading, empty, error, unauthorized and blocked states with an explicit recovery action. In particular, unauthorized recovery returns the user to an allowed hub destination without rendering protected content or triggering its protected API side effects. Polish and English labels and accessible navigation/state semantics are included in the focused coverage.

Browserless focused checks for the combined A01 increment:

- Agent Hub IA/navigation, accessibility, Operations, governed Templates and Transformation Case focused suites: `30/30` PASS (`21/21` is superseded as the earlier bounded aggregate);
- canonical Case/Run vocabulary, URL preservation, history restoration, role gating and unauthorized recovery covered;
- exhaustive local child-state contract covers loading, empty, error, unauthorized, blocked, recovery and success. Operations and governed Templates now persist error/403 truth instead of falling through to a false empty state, expose bounded retry or local recovery, publish busy/live state, reflow on mobile and use semantic surface/text tokens;
- full repository TypeScript check: PASS.

This evidence supersedes earlier claims that Teresa/My Work/approvals/outputs/history IA and vocabulary were wholly missing. It does not establish full A01 acceptance.

## Acceptance boundary

This closes the bounded local durable-projection and Agent Hub IA/state increments, not full A01/A02 acceptance. Remaining A01 gates include:

- a product decision and proof for the canonical Teresa entry destination;
- practical rendered review of responsive reflow/overflow/touch targets and light/dark contrast;
- practical browser focus order/visibility/return and VoiceOver/NVDA announcements for busy, error, forbidden, recovery and disabled states;
- same-SHA deployed browser evidence for the Agent Hub, role gates and recovery paths;

Remaining A02 gates include:

- same-SHA deployed HTTP/browser/realDB restart evidence, including UI readback of planner and work-graph lineage.
