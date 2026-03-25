# V8 Sync auth escalation resolve UI proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Surface: `Admin -> Integrations -> Sync Health`
Operator: authenticated `Admin DBR77`

## What was verified

The live `V8 Active Auth Escalations` panel now exposes a bounded governed resolve action from the same operator surface that already proved auth health reads, conflict dismissal, and connector auth-state mutation.

This packet verified a real staging escalation lifecycle on `jira`:

1. seed a single unresolved auth escalation in `v8_auth_escalations`
2. render that escalation in the `Sync Health` UI with a new `Resolve` CTA
3. resolve it from the browser through the governed V8 mutation route
4. confirm the UI empty state and persisted DB resolution fields

## Before state

Before the browser action, a reversible staging fixture was inserted:

- `escalation_id = stage-proof-auth-escalation-20260325`
- `organization_id = dbr77`
- `connector_id = jira`
- `reason = Stage proof auth escalation`
- `resolved_at = null`

After `Sync Health` loaded:

- the panel rendered `V8 Active Auth Escalations 1`
- the single visible escalation exposed the new `Resolve` button
- the rest of the governed `Sync Health` slice remained live, including `V8 Auth Health` and `V8 Connector Health`

## Live resolve action

UI action:

- clicked `Resolve` on the seeded `jira` auth escalation

Observed network:

- `POST /api/v8/sync/auth/escalations/stage-proof-auth-escalation-20260325/resolve` -> `200`
- follow-up refreshes returned `200`:
  - `GET /api/v8/sync/auth/escalations`
  - `GET /api/v8/sync/auth/health`

Immediate UI result:

- the panel switched to the empty state `No governed auth escalations are open.`
- the `Resolve` CTA disappeared from the section

## Persistence check

After the browser mutation, staging DB verification showed the same row persisted as resolved:

- `escalation_id = stage-proof-auth-escalation-20260325`
- `resolved_at = 2026-03-25T12:55:41.145Z`
- `resolved_by = a87ad39d-e0f4-4cd0-a518-4575cd1d8e9a`

This confirms the operator action wrote durable governed resolution state, not just transient client filtering.

## UI continuity result

`Sync Health` now has live staging proof for a bounded governed auth-escalation mutation workflow:

- unresolved governed auth escalations render in the operator surface
- operators can resolve them directly from that list
- the browser action hits the governed V8 mutation route and returns `200`
- the panel refreshes back to the governed empty state when the queue is cleared

## Notes / residual noise

- Unrelated background noise remained present on staging and was not introduced by this packet:
  - `GET /api/v8/admin/flags` -> `500`
  - legacy `GET /api/sync-hub/health` -> `500`

## Conclusion

The governed `Sync Health` surface now covers another real operator recovery mutation on staging: auth escalations can be resolved directly from the V8-backed UI, extending Sync continuity beyond read truth, conflict dismissal, and connector auth-state recovery.
