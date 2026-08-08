# T01-I02 Ideas Adapter — RealDB Evidence — 2026-08-07

> Historical checkpoint: the adapter-status caveat at the end records the I02
> capture point. Interview and DRD are subsequently covered by I03/I04 and the
> full T01 v24 proof; use the final DOD audit and matrix for current status.

## Acceptance claim

This increment proves a governed transition from an approved Transformation
Plan to real My Ideas artifacts. It does not claim Interview, DRD or later
adapters are connected.

## Environment

- disposable PostgreSQL 16 container;
- isolated database `consultify_t01`;
- no demo or staging writes;
- migration executed with `ON_ERROR_STOP=1`;
- container removed after evidence capture.

## Proven sequence

1. A Transformation Case and pending-review plan were created atomically.
2. Attempting to propose Ideas before plan approval failed closed with
   `TRANSFORMATION_PLAN_APPROVAL_REQUIRED`.
3. Human plan approval advanced the Case and Execution Run into planning.
4. Agent generated one pending-review proposal containing five explicit
   hypotheses; no `my_ideas` rows existed at proposal time.
5. Review with a stale Case version failed with
   `TRANSFORMATION_CASE_VERSION_CONFLICT`.
6. Human approval materialized the five candidates and five lineage links in
   one transaction.

## Authoritative readback

PostgreSQL readback after apply:

- Case status: `active`;
- lifecycle stage: `initial_ideas`;
- Case version: 4;
- proposal status: `applied`;
- proposal candidates: 5;
- `my_ideas`: 5;
- `transformation_case_artifact_links` for `my_idea`: 5;
- Ideas with `source_type = transformation_agent`, proposal source and Case
  lineage in the source pack: 5;
- Execution Run state: `planning`;
- audit events: 7, ending with
  `transformation_ideas.approved_and_applied`.

Repeating a stale approval attempt after apply returned
`TRANSFORMATION_CASE_VERSION_CONFLICT`; direct readback remained five Ideas and
five links.

## Governance invariants

- proposal creation is non-mutating for the My Ideas business table;
- plan approval and Ideas approval are separate human decisions;
- predictable Idea IDs are carried from proposal to apply;
- all materialized artifacts point back to Case, plan/version, proposal and
  lineage ID;
- a transaction failure rolls back both Idea creation and lineage links;
- downstream Ideas remain hypotheses requiring Interview/DRD evidence.

## Open proof

Browser-level screenshots of approval and materialization remain required for
final visual acceptance. The former Interview/DRD `NOT_CONNECTED` statement is
superseded by later I03/I04 and full-flow evidence.
