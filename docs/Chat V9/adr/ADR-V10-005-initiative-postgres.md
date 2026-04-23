# ADR-V10-005: Initiative entity storage on Postgres with row-level-security

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-5 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

The Outcome / ROI Lifecycle block introduces the `Initiative` entity
(master plan §1.1 · block 7) — a finance-grade record tracking
investment, KPI assignment, variance, and deterministic snapshots for
CFO / investor reporting. SOX-style audit requirements apply (§9 of
the Outcome dev plan and §5 of the ROI research).

We must choose a storage substrate. The options fall into three
families: a dedicated service (e.g. separate Postgres instance with
its own schema + service boundary), our existing Postgres footprint
with a new schema, or reuse of the ArtifactStore abstraction from the
Artifact Runtime block.

## Options considered

- **Option A (chosen):** Existing Postgres footprint; dedicated
  `initiative` schema; row-level-security (RLS) per tenant;
  append-only `initiative_event` table for audit.
- **Option B:** Reuse `ArtifactStore` (treat initiatives as an
  artifact type with a specialised schema).
- **Option C:** New dedicated service (microservice boundary) with
  its own Postgres instance.

## Decision

Initiative entities and their events live in the main Postgres cluster
under a dedicated `initiative` schema. Multi-tenancy is enforced by
Postgres RLS policies, not by application-level filtering. An
append-only `initiative_event` table records every state transition
for audit.

## Rationale

- **Finance-grade ≠ artifact semantics.** Artifacts are user-authored
  content with review state machines; initiatives are structured
  finance records with immutable audit logs. Forcing initiatives into
  ArtifactStore either dilutes ArtifactStore (adds finance-specific
  columns, constraints, audit gates) or makes initiatives second-class
  (loses the audit guarantees). Either way is worse than a dedicated
  schema.
- **ACID + RLS required for SOX.** Finance entities need transactional
  semantics (atomic state transitions with audit log insertion) and
  tenant isolation at the engine level. Postgres RLS is battle-tested
  for both.
- **Dedicated service is overkill at MVP.** A microservice boundary
  adds deploy complexity, service-to-service auth, network latency,
  and ops burden for ~zero MVP benefit (no single tenant will exceed
  the QPS ceiling of a shared Postgres for 12+ months). When / if
  scale demands, splitting out is a follow-up ADR with a migration
  path (pg_dump + replica).
- **RLS over app-layer filtering.** Application-level tenant filters
  are error-prone under refactor; an RLS policy fails closed (a
  missing `SET tenant_id = …` produces zero rows, not a tenant
  crossover).

## Consequences

- A new Postgres migration ships in Wave A to create the
  `initiative` schema, the `initiative`, `initiative_kpi`,
  `initiative_event` tables, RLS policies keyed on `tenant_id`, and
  a `get_initiative_snapshot(initiative_id, at_timestamp)` function
  for deterministic point-in-time reconstruction.
- Access to the schema must go through a service layer
  (`src/services/outcome/`); no direct SQL from feature code.
- `tenant_id` is a required foreign key on every initiative-family
  table; RLS policies enforce `tenant_id = current_setting('app.tenant_id')::uuid`.
- The audit log (`initiative_event`) is append-only at the table level
  (REVOKE DELETE / UPDATE) — any backfill or correction goes through
  a compensating event, not a mutation.

## Execution notes

- Postgres RLS policies must be reviewed by the security lead before
  first production rollout (non-blocking for Wave A scaffolding).
- The `get_initiative_snapshot` function is the deterministic
  reconstruction required by Outcome invariant R-OUTCOME-deterministic-snapshot
  (master plan §6.1 invariant 43); the function signature is covered
  by the ROI Lifecycle dev plan's CI gate.
