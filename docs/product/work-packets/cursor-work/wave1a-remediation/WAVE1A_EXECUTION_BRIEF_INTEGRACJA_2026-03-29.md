# Wave 1A Execution Brief - Integracja

Date: 2026-03-29
Packet: `Integracja provider onboarding and lifecycle parity`
Scope owner: Wave 1A

## Goal

Upgrade `Integracja` from a bounded honesty entry surface into a believable provider lifecycle lane:

- connect
- complete setup
- recover
- operate

## Scope

In scope:

- user-facing onboarding and post-connect lifecycle truth
- entry-surface and governed-hub lifecycle alignment
- provider lifecycle states, recovery paths, and operator visibility

Out of scope:

- adding broad new provider families
- full jobs/monitoring platform rewrite
- broad communication product behavior

## Code/test surface map

Core code surfaces:

- `src/components/settings/IntegrationSettings.tsx`
- `src/components/Admin/UnifiedSyncHub.tsx`

Core test surfaces:

- `tests/components/settings/IntegrationSettings.sync-readback.test.tsx`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Runtime/evidence anchors:

- `docs/product/work-packets/evidence/533-v81-integration-must-have-module-closeout-pass.md`
- `docs/product/EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md` row `Sync / connectors / interoperability`

## What we deliver

- one explicit provider lifecycle contract from `disconnected` through `connected`, `pending`, `reauth`, `error`, and operational state
- no contradiction between entry surface and governed hub for lifecycle truth
- stronger operator-facing post-connect continuity instead of only entry-surface honesty
- a bounded set of lifecycle actions that feel complete enough for a real connected lane

## What we consciously do not touch

- full provider catalog expansion
- broader provider-specific mutation families outside the active lifecycle path
- non-Wave 1 communication and channel behaviors

## Acceptance proof plan

1. prove lifecycle state truth at the component level on both `IntegrationSettings` and `UnifiedSyncHub`
2. prove entry-to-governed handoff continuity on the same provider state family
3. prove one real connect-complete-recover-operate scenario instead of only status readback
4. verify no stale or contradictory provider state remains between the two main surfaces

## Risks

- high risk of silent scope growth into a full sync-platform rewrite
- high risk of solving labels but not real lifecycle completion
- dependency on existing governed sync runtime depth
