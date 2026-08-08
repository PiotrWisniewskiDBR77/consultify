# A08 multi-agent work manager — realDB evidence

> Date: 2026-08-07
> Candidate: local `codex/agent-t01-i01`
> Database: isolated PostgreSQL `consultify_agent_a08_proof_20260807`

## Executed flow

`canonical execution run -> router-parallel graph -> research branch + finance branch -> governed specialist runs -> branch evidence readback -> lead synthesis`

```bash
DATABASE_URL=postgresql://localhost/consultify_agent_a08_proof_20260807 \
DB_TYPE=postgres npx tsx server/src/scripts/a08MultiAgentRealDbProof.ts
```

```json
{
  "proof": "A08_REALDB_GREEN",
  "executionRunId": "00000000-0000-4000-8000-000000000808",
  "completedBranches": 2,
  "evidenceReadback": true,
  "synthesis": "completed",
  "tenantIsolation": true,
  "proposalStatus": "pending_review",
  "humanApprovalRequired": true,
  "noAutoApproval": true,
  "runtimeUsageMetered": true,
  "branchBudgetsEnforced": true,
  "contradictionBlockedFirst": true,
  "reviewedContradictionResolved": true,
  "resolutionLineageReadback": true,
  "boundedRetryRealDb": true,
  "safeCancellationRealDb": true
}
```

## Assertions proven

- graph creation and all initial branches commit transactionally;
- two independent branches become ready and execute through their named specialist definitions;
- requested tool scope is passed to server-side specialist policy enforcement;
- each completed branch stores its specialist run identifier as evidence plus output confidence;
- synthesis is allowed only after every branch completes;
- foreign-tenant graph readback returns `null`;
- synthesis creates a proposal in the canonical execution spine;
- the run transitions `planning -> proposals_ready -> waiting_for_review`;
- PostgreSQL readback confirms `requires_human_approval`, `pending_review` and no resolving actor;
- unit coverage separately proves circular-graph rejection, explicit policy-blocked failure, and contradiction-blocked synthesis.
- HTTP contract tests prove same-tenant non-owner concealment, owner execution, organization-owner cancellation and rejection of body-supplied tenant/actor impersonation.
- every branch persists measured input/output/total token units, cost, duration and metering source rather than copying its declared ceiling into usage;
- completion refuses measured usage above the branch token/cost allocation;
- graph-level limits require complete branch allocations, so concurrent branch ceilings cannot sum above the graph ceiling;
- PostgreSQL readback confirms both specialist branches have non-zero deterministic-runtime token usage within their allocations.
- contradictory `go_decision` claims first blocked the graph and prevented unreviewed synthesis;
- the authenticated owner selected the finance branch, supplied a rationale and atomically moved the graph to `completed` only after all contradictions were resolved;
- PostgreSQL preserved claim key, chosen value, source branch, rationale, reviewer and resolution time;
- a transiently failed branch was retried once, reached its two-attempt ceiling and rejected a third attempt;
- cancellation durably cancelled both graph and pending work; a later worker claimed zero tasks.

## Remaining A08 gaps

A08 remains partial at the release/integration layer. Deterministic local specialists have runtime metering and enforced allocations; provider-reported billing usage must replace local metering when a branch invokes an external LLM. Retry, safe cancellation and reviewed contradiction resolution now have PostgreSQL proof. Same-SHA deployed HTTP/worker/browser evidence remains outstanding.
