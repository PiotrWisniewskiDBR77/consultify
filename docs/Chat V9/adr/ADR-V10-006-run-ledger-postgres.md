# ADR-V10-006: Run Ledger backed by Postgres event log; no Temporal at MVP

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-6 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

The Agent Runtime block introduces the durable Run Ledger: every
agent run (`RunV1`) has a persisted event log capturing proposals,
approvals, tool calls, severities, user interrupts, and final
outcome. The ledger is the primary forensic record for safety review
and the basis for the severity-ladder audit (master plan §6.1 · §17
of the Agent Runtime dev plan).

Two concerns drive the storage choice:

1. **Durability.** Every state transition must survive process crash,
   pod restart, and partial failure.
2. **Replayability.** Support / compliance review must replay a run
   from its event log deterministically.

Candidate substrates: Temporal (workflow engine with durable state
built in), a bespoke event store (Kafka + consumer projection), or
Postgres append-only table.

## Options considered

- **Option A (chosen):** Postgres with a `run_event` append-only table
  and a `run` snapshot table updated by a transactional projection.
- **Option B:** Temporal. Every run is a Temporal workflow;
  workflow state = ledger.
- **Option C:** Kafka (or equivalent log-based event store) + a
  custom consumer projecting into Postgres for query.

## Decision

Run Ledger is backed by Postgres. Event log lives in `run_event`
(append-only), snapshot projection lives in `run` (updated in the
same transaction as event insert). No Temporal, no Kafka at MVP.
Scale is re-evaluated at the Wave C gate.

## Rationale

- **Scale fits.** Wave A + B targets ~1k agent runs per minute at
  peak, with median run duration ~8s and ~15 events per run. That's
  ~15k events/minute = ~250 events/second — comfortably inside a
  single Postgres instance's write ceiling. The "Postgres won't keep
  up" scenario is a Wave C conversation, not MVP.
- **Temporal cost is real.** Adopting Temporal adds a new service
  (workflow engine), a new deploy story, a new ops runbook, a new
  SDK with its own DSL (workflows as idempotent functions with
  deterministic replay), and a new failure mode (Temporal cluster
  partition). For a product whose MVP can run on a single Postgres,
  this is expensive insurance we don't need yet.
- **Bespoke event store is the worst of both.** We'd pay the ops
  cost of a new system without getting Temporal's workflow DSL
  benefits.
- **Asymmetric reversal.** Starting on Postgres and migrating to
  Temporal later is mechanical (export events, ingest into
  workflows). Starting on Temporal and rolling it back would require
  rewriting every `@workflow` to a plain function.

## Consequences

- A Postgres migration lands in Wave A creating `run`, `run_event`
  (append-only), `run_proposal`, `run_approval`. Indexes on
  `(tenant_id, created_at DESC)` for the support-UI timeline view.
- The projection from `run_event` → `run` snapshot is in-line
  transactional: every event insert updates the snapshot in the
  same transaction (no consumer lag; no eventual consistency
  surprise).
- A nightly integrity job replays each active run's event log and
  compares the result to the snapshot (defends against projection
  bugs).
- The severity-ladder audit (invariant 36, master plan §6.1) reads
  the event log, not the snapshot, so projection drift cannot hide
  a severity issue.
- When Wave C load testing shows Postgres approaching write
  saturation, a follow-up ADR evaluates Temporal migration. Migration
  path is: pause ledger writes → export events → ingest as
  workflows → resume on Temporal. Done once per region.

## Execution notes

- Append-only enforcement: `REVOKE UPDATE, DELETE ON run_event FROM app_user`.
  Corrections land as compensating events, never as mutations.
- The `run_event` table shares the tenant RLS pattern established by
  [ADR-V10-005](./ADR-V10-005-initiative-postgres.md).
- Deletion for GDPR right-to-be-forgotten is modeled as a
  `tombstone` event type that blanks PII fields in the snapshot
  projection without breaking the event chain integrity hash.
