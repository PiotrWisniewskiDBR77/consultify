# T2 Charter - Sync / connectors / interoperability

Date: 2026-03-26
Lane: `Sync / connectors / interoperability`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `done`

## Why now

`Results / KPI / ROI` is now accepted as the previous active `T2` lane. `Sync / connectors / interoperability`
is the next highest-value parked candidate because it already has a governed V8 namespace, route tests,
an active operator-facing hub, and a clear split-brain across `v8`, `sync-hub`, and settings entry truth.

## Goal

Promote one bounded sync parity slice that reduces mixed truth across:

- sync lane entry and route authority
- sync route/auth consistency
- bounded V8-first sync runtime continuity

## In scope

1. sync lane route/auth consistency
2. split-brain map for sync URLs, frontend surfaces, and runtime contracts
3. one bounded sync packet at a time
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. full OAuth/provider connect completion
2. broad provider mutation redesign
3. cross-surface consolidation of all `/api/settings/integrations` workflows
4. websocket/live collaboration work

## Initial bounded packet

Packet 1:

- canonicalize the legacy settings entry `/settings/integrations`
- route admins to `/admin?tab=integrations`
- route non-admin users to `/settings/connected-apps`

Why this first:

- smallest user-visible split-brain cut
- fixes a live deep-link/fallback bug without broadening scope
- makes the next sync runtime packet easier to reason about

Recorded in:

- `evidence/136-v81-sync-entry-canonicalization.md`

## Packet 2

Completed:

- add V8 parity for sync hub observability/read surfaces
- move `UnifiedSyncHub` catalog, health summary, errors, and audit-log reads onto governed V8-first seams
- keep fallback bounded to compatibility statuses only while leaving provider lifecycle writes on legacy paths

Recorded in:

- `evidence/137-v81-sync-hub-observability-v8-parity.md`

## Packet 3

Completed:

- add V8 parity for the active sync error-resolution control mutation
- move `UnifiedSyncHub` error resolution onto a governed V8-first mutation seam
- keep fallback bounded to compatibility statuses only while broader provider lifecycle writes remain on legacy paths

Recorded in:

- `evidence/138-v81-sync-error-resolution-v8-parity.md`

## Packet 4

Completed:

- add V8 parity for the active sync pause/resume lifecycle controls
- move `UnifiedSyncHub` pause and resume actions onto governed V8-first mutation seams
- keep fallback bounded to compatibility statuses only while broader provider connect/disconnect/reauth breadth remains on legacy paths

Recorded in:

- `evidence/139-v81-sync-pause-resume-v8-parity.md`

## Packet 5

Completed:

- add V8 parity for the active sync `run now` lifecycle control
- move `UnifiedSyncHub` manual sync execution onto a governed V8-first mutation seam
- preserve bounded guardrails for paused/disconnected and rate-limited runs while broader provider lifecycle breadth remains on legacy paths

Recorded in:

- `evidence/140-v81-sync-run-now-v8-parity.md`

## Packet 6

Completed:

- add V8 parity for the active sync reauth lifecycle control
- move `UnifiedSyncHub` token-recovery reauthorization onto a governed V8-first mutation seam
- preserve the bounded pending -> connected continuity while broader provider onboarding breadth remains on legacy paths

Recorded in:

- `evidence/141-v81-sync-reauth-v8-parity.md`

## Packet 7

Completed:

- add V8 parity for the active sync disconnect lifecycle control
- move `UnifiedSyncHub` disconnect onto a governed V8-first mutation seam
- keep fallback bounded to compatibility statuses only while broader provider onboarding breadth remains on legacy paths

Recorded in:

- `evidence/143-v81-sync-disconnect-v8-parity.md`

## Next bounded candidate

1. identify the next V8-first client/runtime packet inside the active sync lane
2. prefer the remaining bounded operator lifecycle mutations inside `UnifiedSyncHub` over OAuth/provider onboarding breadth
3. keep scope bounded to `disconnect` or the next equivalent lifecycle continuity seam, not provider-specific redesign

## Acceptance

Accepted for bounded `T2` completion in:

- `evidence/142-v81-sync-connectors-interoperability-t2-acceptance.md`

Remaining provider onboarding and broader mutation parity are explicitly treated as broader backlog,
not blockers for this bounded active lane.
