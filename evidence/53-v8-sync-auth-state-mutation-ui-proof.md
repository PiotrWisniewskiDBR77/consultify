# V8 Sync auth-state mutation UI proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Surface: `Admin -> Integrations -> Sync Health`
Operator: authenticated `Admin DBR77`

## What was verified

The live `V8 Connector Health` cards now expose a bounded governed auth-state mutation path from the same operator surface that already proved per-connector health reads.

This packet verified a full reversible sequence on the `jira` connector:

1. bootstrap from `unknown` auth state via `Mark healthy`
2. degrade that same connector via `Mark reauth needed`
3. restore the connector back to `healthy`

## Before state

After the staging deploy and a clean reload:

- `Sync Health` opened successfully from `Admin -> Integrations`
- `V8 Connector Health` rendered 5 governed connector cards
- `jira` showed:
  - `authState = unknown`
  - `syncStatus = unknown`
  - `openConflicts = 0`
  - `last governed sync = Never`
  - new bootstrap CTA `Mark healthy`

This bootstrap CTA was important because some staging connectors have no prior governed auth-state row yet.

## Live mutation sequence

### 1. Bootstrap to healthy

UI action:

- clicked `Mark healthy` on the `jira` connector card

Observed network:

- `POST /api/v8/sync/connectors/jira/auth-state` -> `200`
- follow-up refreshes all returned `200`:
  - `GET /api/v8/sync/auth/health`
  - `GET /api/v8/sync/auth/escalations`
  - `GET /api/v8/sync/connectors/jira/health`
  - `GET /api/v8/sync/connectors/asana/health`
  - `GET /api/v8/sync/connectors/slack/health`
  - `GET /api/v8/sync/connectors/teams/health`
  - `GET /api/v8/sync/connectors/gmail/health`

State after clean reload:

- `jira` showed `authState = healthy`
- the CTA changed to `Mark reauth needed`

### 2. Degrade to reauth-needed

UI action:

- clicked `Mark reauth needed` on the same `jira` card

Observed network:

- `POST /api/v8/sync/connectors/jira/auth-state` -> `200`
- follow-up refreshes again returned `200` for auth health, auth escalations, and all connector-health reads

State after clean reload:

- `jira` no longer showed `Mark reauth needed`
- the card returned to the recovery CTA `Mark healthy`, confirming the degraded state was applied

### 3. Restore to healthy

UI action:

- clicked `Mark healthy` on the same `jira` card again

Observed network:

- `POST /api/v8/sync/connectors/jira/auth-state` -> `200`
- follow-up refreshes again returned `200`, including `GET /api/v8/sync/connectors/jira/health`

Final state after clean reload:

- `jira` again showed `authState = healthy`
- the card again exposed `Mark reauth needed`

This left staging in the benign `healthy` end state.

## UI continuity result

The governed mutation path is now visible and usable from the live operator surface:

- unavailable/unknown connector cards can be bootstrapped with `Mark healthy`
- healthy cards can be degraded with `Mark reauth needed`
- degraded cards can be restored back with `Mark healthy`
- all three live mutations hit the governed V8 route and returned `200`

## Notes / residual noise

- During the first two browser-driven mutation clicks, the page briefly hit a route error boundary with a transient `[object DOMException]` in the browser console.
- A clean reload after each mutation showed the expected persisted state and a stable page, so this did not block the governed mutation proof.
- Unrelated background noise remained present on staging and was not introduced by this packet:
  - `GET /api/v8/admin/flags` -> `500`
  - legacy `GET /api/sync-hub/health` -> `500`

## Conclusion

`Sync Health` now has live staging proof for a bounded governed auth-state mutation workflow, extending the existing V8 Sync operator continuity from read truth and conflict dismissal into reversible connector auth-state recovery.
