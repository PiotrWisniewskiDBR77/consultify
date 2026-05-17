# Presentation Governance Alerts

> Sprint 8 — outbound webhook dispatcher for SuperAdmin **Governance Watchlist**
> deck transitions INTO `BLOCKED_P0` / `BLOCKED_P1`.

## Purpose

The Governance Watchlist (`GET /api/presentations/governance/watchlist`) ranks
presentation decks by severity. This service adds a thin **outbound channel**
so per-org subscribers (Slack incoming webhook, generic webhook, or — stub
only — email) get notified the moment a deck *crosses into* a blocked
verdict.

The dispatcher is decoupled from the watchlist GET. As of Sprint 9, the
**Presentation Governance Alert Worker** (`server/scripts/run-presentation-alert-worker.ts`,
documented in `PRESENTATION_GOVERNANCE_ALERT_WORKER.md`) drives the
auto-fire loop: it diffs consecutive watchlist snapshots and calls
`dispatchAlertsForTransition(transition)` for every deck that escalates
INTO `BLOCKED_P0` / `BLOCKED_P1`. Sprint 8 set up the surface
(subscriptions table, dispatch audit, payload contract, ops endpoints,
dry-run mode); Sprint 9 closed the loop with the worker plus per-row
HMAC signing (see `## HMAC signing` below).

## Data model overview

| Table | Purpose |
| --- | --- |
| `presentation_governance_alert_subscriptions` | Per-org webhook/email/slack targets, severity threshold, soft-delete via `active = FALSE`. |
| `presentation_governance_alert_dispatches` | One row per attempted dispatch. Stores **redacted** target + payload for replay/debug. Status enum: `queued`, `sent`, `failed`, `suppressed`, `dry_run`. |

Both tables ship in migration **`762_presentation_governance_alerts.sql`** and
are created with `IF NOT EXISTS`, so the migration is idempotent.

The route layer is **schema-tolerant**: if either table is missing, the
endpoints return `{ success: true, data: { …, warnings: ['schema_missing_alert_tables'] } }`
rather than 500. Same applies inside `listActiveSubscriptions` /
`recordDispatch` — they swallow the missing-table error and log once.

## API quick-reference

All endpoints require the existing `presentation_edit` capability and are
scoped by `getOrgId(req)`. No new RBAC capability was introduced — admin /
PM / SuperAdmin already have it.

| Method | Path | Description |
| --- | --- | --- |
| `GET`    | `/api/presentations/governance/alert-subscriptions`        | List active subscriptions for the caller's org. `target` is always returned **redacted** (`maskTarget`). |
| `POST`   | `/api/presentations/governance/alert-subscriptions`        | Create a subscription. Body: `{ channel: 'webhook' \| 'email' \| 'slack', target: string, minSeverity?: 'BLOCKED_P0' \| 'BLOCKED_P1' }`. Returns the redacted record. |
| `DELETE` | `/api/presentations/governance/alert-subscriptions/:id`    | Soft-delete (`active = FALSE`). 404 if the id is not active in the caller's org. |
| `POST`   | `/api/presentations/governance/alerts/test`                | Fire a synthetic transition through `dispatchAlertsForTransition` for ops verification. Optional body `{ deckId, deckTitle, fromVerdict, toVerdict }`. Returns the dispatch summary counters. |
| `GET`    | `/api/presentations/governance/alerts/recent?limit=50`     | Most recent dispatches for the org (clamp 1..200, default 50). Response only ever exposes `target_redacted` — the raw target is never returned. |

The watchlist GET (`/governance/watchlist`) **stays read-only**. It does not
auto-fire dispatches; that is by design so the read path stays cheap and
side-effect free.

## Payload schema (`consultify.governance.alert.v1`)

```json
{
  "schema": "consultify.governance.alert.v1",
  "type": "deck_blocked",
  "organizationId": "org_acme",
  "deckId": "deck_123",
  "deckTitle": "Q3 Strategy Deck",
  "fromVerdict": "PASS_WITH_P2",
  "toVerdict": "BLOCKED_P0",
  "generatedAt": "2026-05-07T07:00:00.000Z",
  "severityRank": 4
}
```

- `severityRank` mirrors the FE diff service: `BLOCKED_P0 = 4`,
  `BLOCKED_P1 = 3`. Replicated server-side rather than imported so the
  backend stays decoupled from the client bundle.
- `fromVerdict` is `null` when the deck is brand-new in the watchlist
  (no previous snapshot for that deck).
- No PII beyond the org / deck identifiers and the deck title.
- Optional `links: { auditLogUrl, deckUrl }` — populated by the caller of
  `buildAlertPayload` when a future worker has the request host in scope.

The HTTP send is a single `POST` with `content-type: application/json`,
`AbortSignal.timeout(5000)` for both webhook and slack channels. Any non-2xx
response is recorded as `status='failed'` with `error_category='non_2xx_status'`.

## Dry-run mode (`PRESENTATION_GOVERNANCE_ALERTS_DRY_RUN`)

When `process.env.PRESENTATION_GOVERNANCE_ALERTS_DRY_RUN === 'true'`, **or**
when the runtime has no `fetch` global (older Node), the dispatcher records
each attempt as `status='dry_run'` instead of issuing the HTTP call. This is
the default during local development and CI.

The `email` channel is always treated as a stub in this sprint (no SMTP is
attempted, ever) — its dispatch row is recorded with
`error_category='email_channel_stub_only'`.

## Audit & redaction

- The raw `target` column lives in the subscriptions table only (write-only
  from the API surface — never echoed back).
- Every dispatch row stores `target_redacted = maskTarget(target)`:
  - URL → `scheme://host` + first 8 path chars + `***`.
  - Email → first 2 chars of local-part + `***@domain`.
  - Bare strings → character-level `*` redaction.
- Payload JSON is stored verbatim for replay; it intentionally contains no
  secrets.

## HMAC signing

Sprint 9 adds optional **HMAC-SHA256** signing on every outbound webhook
POST so subscribers can verify message origin. Signing is opt-in per
subscription via the `signing_secret` column added by migration
`763_presentation_governance_alert_signing.sql`.

### Header contract

When a subscription has a non-empty `signing_secret`, the dispatcher
attaches **four** headers in addition to `content-type: application/json`:

| Header | Value |
| --- | --- |
| `x-consultify-signature` | hex digest (lowercase, 64 chars) |
| `x-consultify-signature-algorithm` | constant `HMAC-SHA256` |
| `x-consultify-timestamp` | ISO-8601 UTC, set at sign time |
| `x-consultify-event-id` | dispatch row id (also persisted in `presentation_governance_alert_dispatches.id`) |

When the secret is `NULL` / empty, the dispatcher behaves exactly like
Sprint 8 — only `content-type` is sent and the dispatch audit row stores
`signature_present = FALSE, signature_algorithm = NULL`.

### Canonical string

The receiver MUST reproduce this exact byte-stable string before hashing:

```
${x-consultify-timestamp}\n${x-consultify-event-id}\n${raw-request-body}
```

(literal `\n` between segments, NO JSON re-encoding — use the bytes of
the request body verbatim).

### Node verifier

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

function verifyConsultifyAlert(req, sharedSecret) {
  const ts  = req.headers['x-consultify-timestamp'];
  const eid = req.headers['x-consultify-event-id'];
  const sig = req.headers['x-consultify-signature'];
  if (!ts || !eid || !sig) return false;
  const canonical = `${ts}\n${eid}\n${req.rawBody}`;
  const expected = createHmac('sha256', sharedSecret).update(canonical, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

### Python verifier

```python
import hmac, hashlib

def verify_consultify_alert(headers, raw_body: bytes, shared_secret: str) -> bool:
    ts  = headers.get('x-consultify-timestamp')
    eid = headers.get('x-consultify-event-id')
    sig = headers.get('x-consultify-signature')
    if not (ts and eid and sig):
        return False
    canonical = f"{ts}\n{eid}\n".encode('utf-8') + raw_body
    expected = hmac.new(shared_secret.encode('utf-8'), canonical, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)
```

### Secret rotation guidance

- Generate via `generateSigningSecret()` (32 random bytes hex, 64 chars).
- Rotate by `UPDATE presentation_governance_alert_subscriptions
  SET signing_secret = ?, signing_secret_rotated_at = NOW() WHERE id = ?`.
  The new value takes effect on the next dispatch — there is no in-flight
  ambiguity because each POST is signed at send time.
- For zero-downtime rotation, accept BOTH the previous and the new
  secret on the receiver side for one cool-down window (e.g. 24h), then
  drop the old one.
- The raw `signing_secret` is **never** echoed back through any API
  surface. The audit row records only `signature_present` (boolean) and
  `signature_algorithm`.

## Periodic worker

The Sprint 9 worker (`server/scripts/run-presentation-alert-worker.ts`)
auto-fires `dispatchAlertsForTransition` by diffing consecutive Watchlist
snapshots per organization. State lives in
`presentation_governance_alert_worker_state` (created by migration 763)
and includes a 5-strike auto-pause heuristic.

See `docs/operations/PRESENTATION_GOVERNANCE_ALERT_WORKER.md` for the
full runbook (CLI flags, cron / systemd examples, pause recovery).

## Future work

- **Retries with backoff** — `status='queued'` is reserved for a future
  retry queue; the current orchestrator only writes terminal statuses.
- **Per-deck cool-down** — suppress repeated dispatches for the same deck
  within a configurable window.
- **Real SMTP for email channel** — currently stubbed.
- **Replay protection on the receiver** — recommend rejecting POSTs whose
  `x-consultify-timestamp` is older than 5 minutes once your clock skew
  budget is set.

## Related docs

- `docs/operations/PRESENTATION_GOVERNANCE_ALERT_WORKER.md` — Sprint 9
  periodic dispatcher worker (auto-fire via watchlist snapshot diff,
  pause heuristic, cron runbook, HMAC verification snippets).
- `docs/operations/DRIVE_SYNC_RESILIENCE.md` — pattern for schema-tolerant
  outbound integrations.
- Governance card runbook (SuperAdmin Governance Watchlist) — consumer of
  the same severity/verdict model.
- Migrations:
  - `server/migrations/762_presentation_governance_alerts.sql` (Sprint 8 surface).
  - `server/migrations/763_presentation_governance_alert_signing.sql` (Sprint 9 HMAC + worker state).
- Service: `server/src/services/presentationGovernanceAlertService.ts`.
- Worker:  `server/src/services/presentationGovernanceAlertWorkerService.ts`.
