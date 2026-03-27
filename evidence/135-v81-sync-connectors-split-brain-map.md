# V8.1 Sync / Connectors / Interoperability Split-Brain Map

Date: 2026-03-26
Lane: `Sync / connectors / interoperability`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `active`

## Current live surface

The live sync lane is centered on:

- `/admin?tab=integrations`
- `/settings/connected-apps`
- legacy entry `/settings/integrations`
- `src/components/Admin/UnifiedSyncHub.tsx`

with `UnifiedSyncHub` serving as the active admin/operator sync shell.

## Split-brain findings

1. `/settings/integrations` exists as a visible route contract, but `SettingsView` does not have a matching section and falls back to `profile`
2. the admin/operator sync hub lives under `/admin?tab=integrations`, while user-level connected apps live under `/settings/connected-apps`
3. the sync lane mixes governed `/api/v8/sync/*` reads and bounded mutations with direct legacy `/api/sync-hub/*` reads and lifecycle actions
4. user settings integrations also keep a separate `/api/settings/integrations*` surface in parallel
5. route entry truth is therefore ambiguous before deeper runtime parity work even starts

## Smallest clean starting packet

Chosen packet:

- canonicalize `/settings/integrations` as a compatibility alias
- send admins to `/admin?tab=integrations`
- send non-admin users to `/settings/connected-apps`

Why this packet:

- smallest bounded authority cut
- fixes a live wrong-surface fallback
- keeps the next runtime packet focused on hub reads instead of entry ambiguity

## Follow-up candidates

- bounded V8-first observability/read alignment inside `UnifiedSyncHub`
- explicit handling for remaining `sync-hub` versus `/api/settings/integrations` read overlap
- decision on later provider connect/OAuth mutation breadth
