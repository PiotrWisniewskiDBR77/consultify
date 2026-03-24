# Consultify Table Platform
## Risk Register and Decision Log

This document captures the main risks, assumptions, dependencies, and open decisions for the future Airtable-like table platform.

It should be reviewed before any execution plan is approved.

## 1. Decision log

### D-01
Decision:
The future table platform must be metadata-first.

Why it matters:
Without canonical schema objects, chat-to-schema and backend-evaluated views remain structurally weak.

Current status:
Not yet formally approved.

### D-02
Decision:
The current workspace graph must become a projection layer, not the permanent source of truth for table semantics.

Why it matters:
The current graph model is useful for tool orchestration, but not sufficient for a durable data platform.

Current status:
Strategically recommended, not yet ratified.

### D-03
Decision:
Chat-driven schema mutation must always use `proposal -> approval -> execution`.

Why it matters:
Direct mutation by AI creates trust, validation, and rollback risks.

Current status:
Strong recommendation.

### D-04
Decision:
The table platform stream must remain isolated from unrelated module delivery.

Why it matters:
The rebuild must not block completion work in active modules.

Current status:
Critical business constraint.

## 2. Assumptions

- current table UI contains reusable experience patterns
- current backend routes can serve as transition adapters
- the product can tolerate pilot-only rollout for the new platform
- MVP does not require full Airtable parity
- relation semantics can be introduced incrementally

## 3. Primary risks

### R-01: dual source of truth
Description:
Graph and records platform both try to act as canonical data stores.

Impact:
Very high.

Mitigation:
Define canonical ownership before implementation starts.

### R-02: scope explosion
Description:
The team tries to deliver Airtable parity, interfaces, automations, and advanced formulas in the same wave.

Impact:
Very high.

Mitigation:
Freeze first-wave scope and document non-goals.

### R-03: client-side query logic remains
Description:
The new backend exists, but key filtering and sorting still happen in frontend memory.

Impact:
High.

Mitigation:
Treat backend query engine as a hard MVP requirement.

### R-04: AI mutation reliability
Description:
Chat proposals are under-validated or too free-form.

Impact:
High.

Mitigation:
Use a structured proposal schema and validation layer.

### R-05: impact on other modules
Description:
Shared UI, shared backend routes, or workspace contracts are broadly refactored and slow down parallel delivery.

Impact:
Very high.

Mitigation:
Use isolated adapters, feature flags, and a ring-fenced delivery stream.

## 4. Delivery dependencies

The program depends on:

- agreement on source of truth
- agreement on MVP field types
- agreement on rollout model
- backend capacity for new services
- frontend capacity for adapter re-binding
- AI engineering capacity for proposal orchestration

## 5. Externalized risks that must be consciously accepted

These risks may remain temporarily acceptable if explicitly tracked:

- old graph-backed table experience remains in the product during transition
- relation semantics in v1 are narrower than Airtable
- formulas are intentionally incomplete in v1
- full enterprise governance is deferred

## 6. Blocking questions

The following questions must be answered before the rebuild plan is finalized:

- Does every workspace get one base or many bases?
- Does the current graph remain writable after the new platform exists?
- Which field types are launch-critical?
- Are attachments required in MVP pilot?
- Will pilot users see the new platform inside `My Work` or through a separate capability entry point?

**→ Recommended resolutions:** See [PRE_FLIGHT_SIGN_OFF.md](PRE_FLIGHT_SIGN_OFF.md). All five questions have been answered with implementation-ready decisions.

## 7. Success preconditions

The rebuild should not start unless all of the following are accepted:

- canonical schema will live on the backend
- table records will stop depending on graph nodes as their final model
- the first wave is intentionally partial
- current product delivery streams are protected by isolation rules

## 8. Review recommendation

This risk register should be reviewed together with:

- [CONSULTIFY_AIRTABLE_90_DAY_PLAN.md](CONSULTIFY_AIRTABLE_90_DAY_PLAN.md)
- [CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md](CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md)
- [CONSULTIFY_TABLE_PLATFORM_MIGRATION_AND_ISOLATION.md](CONSULTIFY_TABLE_PLATFORM_MIGRATION_AND_ISOLATION.md)
