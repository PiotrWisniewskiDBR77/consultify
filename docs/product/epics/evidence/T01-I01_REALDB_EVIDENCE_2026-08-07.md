# T01-I01 RealDB Evidence — 2026-08-07

> Historical checkpoint: capability counts and open-adapter statements in this
> file describe the I01 baseline. They are superseded by the full T01 v24 proof,
> final DOD audit and delivery matrix. Browser/same-SHA acceptance remains open.

## Scope

Disposable PostgreSQL 16 database, isolated from demo and staging. Candidate branch:
`codex/agent-t01-i01`, based on canonical `origin/demo` SHA
`3b0c337ee472d07122033d5339cdf3bdb2f254ee`.

## Migration proof

`20260807_agent_t01_transformation_case.sql` applied with `ON_ERROR_STOP=1`.
Created Transformation Case, plan, plan-step and audit tables plus indexes and
the deferred active-plan relationship. Re-applicable columns reported `already
exists, skipping`, proving the guarded ALTER path.

## Transaction and readback proof

One service call atomically persisted:

- Transformation Cases: 1;
- plans: 1;
- plan steps: 15;
- Context Snapshots: 1;
- Execution Runs: 1;
- initial audit events: 4.

Readback identity:

- Case: `26604997-8f31-490f-9719-ca43a8ffc280`;
- Context Snapshot: `5a35bc76-b188-4bba-a9ea-247955c12538`;
- Execution Run: `314c93a1-3ee9-4195-a444-87fbad91e78c`;
- active plan: `5e87ef5f-29b5-499d-97c8-3dd961d233d7`;
- active-plan step count: 15.

## Defect discovered and resolved

The first realDB run persisted the transaction but the test process used the
automatic mock database for readback because `NODE_ENV=test` lacked
`RUN_DB_TESTS=1`. The run correctly failed instead of claiming success. The
read path was then standardized on the shared query helpers and the proof was
repeated with `RUN_DB_TESTS=1 MOCK_DB=false`.

## Idempotency proof

Repeating the request with `Idempotency-Key: t01-realdb-0001` returned the same
Case, Snapshot, Run and plan. It created no duplicate business rows and appended
an explicit `transformation_case.idempotent_replay` audit event. Audit count
advanced from 4 to 5; active plan retained exactly 15 steps.

## Revision, concurrency and cancellation proof

A second isolated PostgreSQL run exercised the full review lifecycle:

- initial Case and plan were version 1;
- revision produced Case version 2 and plan version 2;
- revised desired outcomes survived readback;
- the new plan contained another complete set of 15 steps (30 historical steps total);
- a stale revision still expecting version 1 failed with
  `TRANSFORMATION_CASE_VERSION_CONFLICT`;
- controlled cancellation advanced the Case to version 3;
- Case and active plan read back as `cancelled`;
- the bound Execution Run read back as `cancelled` with plan version 2;
- audit count was 6 after create, binding, plan events, revision and cancellation.

Targeted lint completed without errors after formatting. Contract tests: 4/4
passed, including create/revision/cancellation schema boundaries.

## Teresa and Agent Hub UI contract proof

The main Teresa send path now recognises only explicit transformation-plan
commands in Polish or English. It persists the user command, calls the durable
Transformation Case API and returns the Case version, phase count and a My Work
deep-link. Ordinary discussion about transformation remains on the normal chat
path. Detector and backend tests pass together (11/11).

Agent Hub now exposes a third `Transformations` mode. A deep-link containing
`transformationCaseId` selects that mode, resolves the Case even when it is not
in the first list response and opens the standard table-preview surface. The
preview renders mandate, version, autonomy, missing inputs, all plan steps and
their capability truth. `Run` is disabled while downstream adapters are not
`REAL`, with a visible explanation. The deep-link/capability test passed and
asserted fourteen `NOT_CONNECTED` stages plus the disabled Run action.

## Current acceptance boundary

This proves the durable I01 identity/plan/runtime binding, review operations and
the Teresa-to-Agent-Hub UI contract. Current visual proof is component-level;
browser screenshots on a running build remain required for final acceptance.
Historical I01 boundary: all downstream adapters were open at this checkpoint.
This is superseded for local implementation status; production acceptance is
still governed by the current delivery matrix.
