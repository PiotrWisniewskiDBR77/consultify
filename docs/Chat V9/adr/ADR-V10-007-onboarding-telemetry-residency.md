# ADR-V10-007: Onboarding telemetry residency equals artifact residency per tenant

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-7 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

The Onboarding block emits telemetry during persona capture, the
5-minute activation funnel, and the trust-first disclosure flow
(master plan §1.1 · block 8). Onboarding telemetry includes:

- Persona category (role, seniority, primary outcome),
- Interaction timings (time-to-first-answer, funnel step dropouts),
- User IDs (for per-user activation-SLA debugging),
- Connector choices (which connectors the user considered / picked).

This telemetry is PII-classified. Our existing per-tenant artifact
storage honours regional residency (EU tenants → EU Postgres + EU
blob store; US tenants → US). The open question is whether onboarding
telemetry follows the same residency rule or streams to a single
global analytics bucket for easier cross-tenant aggregation.

## Options considered

- **Option A (chosen):** Onboarding telemetry is written to the same
  region as the tenant's artifact storage. No global telemetry bucket.
  Cross-tenant aggregation happens on regionally-partitioned BigQuery
  (or equivalent) extracts with PII removed at extract time.
- **Option B:** Global analytics bucket. All tenants emit onboarding
  telemetry to a single US-based store; regional residency is
  enforced only for artifacts.
- **Option C:** Hybrid. Non-PII events go global; PII events stay
  regional. Requires classifying every event upfront.

## Decision

Onboarding telemetry residency matches artifact residency per tenant.
The telemetry pipeline selects the destination based on the tenant's
region (resolved at auth time via `tenant.region`), same as the
artifact writer. No global bucket.

## Rationale

- **GDPR / SOC2 / ISO compliance.** Onboarding telemetry contains
  enough PII (persona + interaction + user IDs) that splitting
  residency between artifacts (regional) and telemetry (global)
  creates a compliance hole: a GDPR data subject request has to
  purge from two backends, and an EU tenant's telemetry crosses the
  Atlantic in flight and at rest. The "global analytics bucket"
  shortcut saves engineering cost but buys audit risk we cannot
  defend in front of a compliance review.
- **Operational simplicity of uniformity.** One residency rule
  ("follow the tenant region for everything tenant-scoped") is
  easier to enforce, audit, and debug than a per-data-type rule.
  Every new data surface (next block, next feature) inherits the
  rule for free.
- **Aggregation is solvable.** Cross-tenant analytics can run
  off regional BigQuery extracts that strip PII at extract time;
  we lose real-time cross-tenant dashboards but gain compliance
  posture. Trade-off accepted.
- **Option C rejected:** per-event classification creates a new
  SSoT (the classification list) that can drift silently. The
  "oh this new event slipped through as non-PII" failure mode is
  exactly what killed trust in similar hybrid models at other
  vendors.

## Consequences

- The telemetry client selects its destination from `tenant.region`
  at auth time; a tenant crossing regions (rare, usually a
  migration) requires a data migration + audit trail.
- A tenant with no region set defaults to its primary artifact
  region. Missing region is a hard error (no fallback to global).
- Cross-tenant analytics (used by product + sales) runs against a
  PII-stripped, regionally-aggregated BigQuery dataset. The stripping
  pass is SOX-defensible: its manifest of removed fields is
  version-controlled and reviewed.
- The onboarding dev plan's telemetry instrumentation (master plan
  §7 stub: `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN`) codes against
  a `TelemetryClient` interface that resolves region at construction
  time — no per-call region selection.

## Execution notes

- Implementation lands in Wave A alongside the first onboarding
  telemetry event. The region-routing code is shared across all
  blocks that emit tenant-scoped telemetry, not scoped to onboarding.
- Monitoring: the telemetry pipeline's DLQ (dead-letter queue) must
  alert on any event whose target region is missing. Silent drop =
  compliance hole.
