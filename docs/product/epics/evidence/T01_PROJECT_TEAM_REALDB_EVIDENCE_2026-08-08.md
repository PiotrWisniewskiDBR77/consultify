# T01 Teresa-led Project Team — RealDB evidence

Date: 2026-08-08
Scope: local canonical shared worktree; no commit, push or deployment claim

## Normative outcome

Teresa acts as the Transformation Case project lead: after intake and plan she may propose a versioned team of verified humans and registered specialist agents. Missing sponsor, owner, participant, RACI authority or agent budget remains `UNKNOWN` and becomes an explicit clarification question. A human with exact A05 reviewer authority approves the composition, RACI, autonomy and budget limits before A06 activation.

The operational Project Team card belongs to the Transformation Case. Technical run diagnostics remain in Admin/Operator surfaces.

## Native PostgreSQL proof

Script: `server/src/scripts/t01ProjectTeamRealDbProof.ts`

Marker: `T01_PROJECT_TEAM_REALDB_GREEN`

Exact asserted facts:

- `clarificationExact=true`;
- `noFabricatedMembership=true`;
- `inventedAgentDenied=true`;
- `A05Approved=true`;
- concurrent proposal requests `2 => 1` blueprint version and one receipt replay;
- concurrent approval requests `2 => 1` approval receipt;
- same idempotency key with a different payload is rejected;
- activation before approval is rejected with zero A06 activation;
- concurrent activation requests `2 => 1` activation receipt and exactly `17` A06 policies;
- foreign-tenant Case access is fail-closed;
- durable lineage reads `case-team / run-team / project-team`;
- final counts: `blueprints=2`, `receipts=4`, `activations=1`, `policies=17`.

Focused UI/service/governance regression: `8/8` PASS.
Full repository TypeScript check: PASS.
Diff check: clean.

## Status boundary

`PARTIAL`: local code, DOM contracts and native PostgreSQL behavior are GREEN. Acceptance still requires the same canonical SHA deployed and verified through authenticated multi-role browser flows, including visual/interaction review of clarification, approval and activation states. No production activation, external notification or team invitation is claimed.
