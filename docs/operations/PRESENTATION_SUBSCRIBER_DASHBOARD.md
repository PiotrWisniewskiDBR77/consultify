# Presentation Governance — Subscriber Dashboard (Sprint 13)

A read-only HTTP surface that lets external HMAC alert subscribers ("clients
of clients") inspect their **own** delivery stats, last-N verifications, and
rotation health. Authentication is delegated to a one-time Bearer token an
admin issues out-of-band; no platform JWT is required.

---

## Purpose & Threat Model

External subscribers receive `presentation_governance_alert_*` webhook
deliveries from Consultify. Until Sprint 13 they had no first-party way to
answer questions like:

* "Did your last dispatch reach me? What HTTP status did you record?"
* "How many failures have we accumulated in the last 7 days?"
* "Is my signing secret about to expire?"

The Subscriber Dashboard exposes exactly that data, **strictly scoped to one
subscription_id**. It is read-only by construction:

* The endpoint never returns the raw `signing_secret`. Only
  `signature.algorithm` (a constant `HMAC-SHA256`) and rotation timestamps
  are echoed back. Subscribers must rotate via the admin UI flow.
* The endpoint never returns other subscriptions or other organizations'
  data. The token table carries `subscription_id` + `organization_id` and
  the dashboard query filters by both.
* Webhook target URLs and deck IDs are masked (`maskTarget`, `maskDeckId`)
  so a leaked screenshot or log line is non-sensitive.
* Token storage at rest is sha256-hashed only — the raw 64-hex token is
  returned exactly once at issuance and never reconstructible.
* Failure modes return `401 unauthorized` with a deliberately generic
  `reason` so the response cannot be used to enumerate which tokens are
  valid, expired, revoked, or unknown.

---

## Token Issuance Flow (Admin → Subscriber)

```
[Admin operator]                [Consultify API]              [External subscriber]
       |                                |                                |
       |  POST /api/presentations/      |                                |
       |  governance/alert-subscriptions|                                |
       |  /{id}/dashboard-tokens        |                                |
       |  Body: { ttlDays: 30 }         |                                |
       |------------------------------->|                                |
       |                                |                                |
       |  200 OK                        |                                |
       |  { oneTimeToken: "<64 hex>",   |                                |
       |    prefix: "1a2b3c4d",         |                                |
       |    expiresAt: "..." }          |                                |
       |<-------------------------------|                                |
       |                                                                 |
       |    Hand `oneTimeToken` to subscriber via secure channel         |
       |    (1Password, encrypted email, signed PDF, etc.)               |
       |---------------------------------------------------------------->|
       |                                                                 |
       |                                |                                |
       |                                |  GET /api/presentations/       |
       |                                |  governance/subscriber/        |
       |                                |  dashboard                     |
       |                                |  Authorization: Bearer <token> |
       |                                |<-------------------------------|
       |                                |                                |
       |                                |  200 OK                        |
       |                                |  { success: true,              |
       |                                |    data: <SubscriberDashboardSnapshot> } |
       |                                |------------------------------->|
```

Issuance constraints:

| Field      | Rule                                                       |
|------------|------------------------------------------------------------|
| `ttlDays`  | Optional. Clamped to `1..90`. Defaults to `30`.            |
| Storage    | sha256 hex of the raw token in `token_hash`. UNIQUE.       |
| `prefix`   | First 8 chars of the raw token. For admin display only.    |
| Audit      | `subscriber_dashboard_token_issued` event records `prefix` and `expiresAt`; **never** the raw token. |

The admin endpoint is gated by `presentation_edit` and inherits the standard
JWT + capability stack. The subscriber endpoint is registered **before**
`router.use(verifyToken)` and accepts only the Bearer token.

---

## Token Validation

`GET /api/presentations/governance/subscriber/dashboard`

```
Authorization: Bearer <64-hex-token>
```

Validation pipeline (every step returns `401 { status, reason }` on failure;
the reason is intentionally low-entropy and stays generic):

1. Extract Bearer payload via `^Bearer\s+([0-9a-fA-F]+)\s*$`.
2. Reject if length ≠ 64 hex chars (`reason: invalid_token_format`).
3. `tokenHash = sha256(rawToken)` and look up by hash.
4. Reject if not found (`reason: token_not_found`).
5. Reject if `revoked_at IS NOT NULL` (`reason: token_revoked`).
6. Reject if `expires_at <= now()` (`reason: token_expired`).
7. Load the parent subscription row by `(subscription_id, organization_id)`.
8. Update `last_used_at = now()` (best-effort; never blocks the read).
9. Build the snapshot via `buildSubscriberDashboardSnapshot`.

When migration 765 has not been applied yet, the endpoint returns
`503 { code: 'SCHEMA_NOT_READY' }` with a hint pointing at the migration
file — never `500`.

---

## Dashboard Payload Schema

The snapshot shape is defined in TypeScript at:

* `consultify/server/src/services/presentationSubscriberDashboardService.ts`
  — see `SubscriberDashboardSnapshot`.

Key fields:

```ts
{
  subscription: { id, channel, target /* MASKED */, minSeverity, active, secretRotatedAt },
  signature:    { algorithm: 'HMAC-SHA256', secretLastRotatedAt, daysSinceRotation, rotationDueWithinDays },
  delivery:     { last7Days, last30Days, lastDispatchAt, lastFailureAt, consecutiveFailures },
  recentDispatches: [{ id, dispatchedAt, status, httpStatus, toVerdict, deckIdMasked, signaturePresent, signatureAlgorithm }],
  health:       { overall: 'healthy' | 'degraded' | 'unhealthy', reasons: string[] },
  warnings:     string[],
}
```

The payload is JSON-serializable: no `Map`, `Set`, or `Date` instances. All
timestamps are ISO-8601 strings.

---

## Health Classification Rules

Most-severe rule wins; `health.overall` is one of `healthy | degraded | unhealthy`.

| Rule                                                | Resulting `overall`   |
|-----------------------------------------------------|-----------------------|
| `consecutiveFailures >= 10`                         | `unhealthy`           |
| `consecutiveFailures >= 5`                          | `degraded`            |
| `daysSinceRotation > 90`                            | `degraded` (overdue)  |
| Otherwise                                           | `healthy`             |

Warnings (informational; do **not** change `overall`):

| Condition                                                      | Warning text                                            |
|----------------------------------------------------------------|---------------------------------------------------------|
| `daysSinceRotation > 60`                                       | `Signing secret should be rotated within 30 days`       |
| Active subscription with zero dispatches in the last 7 days    | `No recent dispatches`                                  |

---

## Subscriber Expectations

* **Rotate the signing secret every 90 days.** The dashboard surfaces a soft
  warning at 60 days and degrades health at 90.
* **Verify the HMAC server-side** before trusting any payload. The
  `x-consultify-signature` header is HMAC-SHA256 over
  `${timestamp}\n${eventId}\n${bodyJson}` — see
  `presentationGovernanceAlertService.buildCanonicalSigningString`.
* **Do not store the raw token in `localStorage` or any browser-accessible
  store.** Treat it like a long-lived API key: keep it in your secret
  manager, inject via `Authorization: Bearer …` header from a server-side
  process, and rotate on personnel changes.
* **Do not log the token.** The Consultify side audits only the 8-char
  prefix; subscribers should follow the same convention.
* **Treat the dashboard as a diagnostic, not a control plane.** It cannot
  pause subscriptions, replay dispatches, or rotate secrets — those are
  admin-side actions.

---

## Token Revocation (Sprint 14 — Implemented)

The `revoked_at` and `revoked_reason` columns from migration 765 are now
driven end-to-end. The dashboard read path already returns
`401 { reason: 'token_revoked' }` when `revoked_at IS NOT NULL`; Sprint
14 ships the admin-side **list** + **revoke** surface that flips those
columns.

### Endpoints

| Method | Path                                                                                                      | Auth                       |
|--------|-----------------------------------------------------------------------------------------------------------|----------------------------|
| GET    | `/api/presentations/governance/alert-subscriptions/:id/dashboard-tokens?includeRevoked=true&limit=N`      | JWT + `presentation_edit`  |
| POST   | `/api/presentations/governance/alert-subscriptions/:id/dashboard-tokens/:tokenId/revoke`                  | JWT + `presentation_edit`  |

The `GET` response shape:

```json
{
  "success": true,
  "data": {
    "subscriptionId": "<sub-id>",
    "tokens": [
      {
        "id": "<token-id>",
        "subscriptionId": "<sub-id>",
        "organizationId": "<org-id>",
        "tokenPrefix": "1a2b3c4d",
        "issuedBy": "<user-id>",
        "issuedAt": "...",
        "expiresAt": "...",
        "lastUsedAt": "...",
        "revokedAt": null,
        "revokedReason": null,
        "scope": { "read": true },
        "status": "active"
      }
    ]
  }
}
```

`status` is derived server-side: `revoked` (if `revoked_at IS NOT NULL`),
`expired` (if `expires_at < now()`), otherwise `active`. The
`token_hash` column is **never** projected into the response.

The `POST …/revoke` body:

```json
{ "reason": "Subscriber rotated personnel; old token must be killed", "confirm": true }
```

Status mapping:

| Service status     | HTTP | Note                                                 |
|--------------------|------|------------------------------------------------------|
| `invalid_reason`   | 400  | `reason` < 5 chars after trim or > 500 chars.        |
| `confirm: false`   | 400  | The body must include `confirm: true` explicitly.    |
| `not_found`        | 404  | Token does not belong to `(subscription, org)`.      |
| `already_revoked`  | 409  | Idempotent — body still includes the row summary.    |
| `storage_error`    | 503  | Migration 765 missing or DB unavailable.             |
| `ok`               | 200  | `data.token` is the revoked summary (status=`revoked`). |

Revocation also writes a `subscriber_dashboard_token_revoked` audit
event with the 8-char prefix and a 200-char-truncated reason. **Never**
the raw token (the hash never leaves the DB anyway).

### Operator procedure

1. Open **SuperAdmin → Governance Alert Subscriptions**.
2. Find the subscription row and click **Tokens** in the row's action
   group. The "Dashboard tokens" panel expands below the row.
3. Toggle **Show revoked** if you want to inspect already-revoked rows.
4. Click **Revoke** on the target token row (`active` status only).
5. Enter an operator-facing reason (≥ 5 chars, ≤ 500 chars) — this is
   persisted to `revoked_reason` and surfaced in the audit log.
6. Tick **Confirm revocation**.
7. Click **Revoke token**. The panel reloads automatically; the row
   re-renders with a `revoked` status pill.

After revocation:

1. The next subscriber call returns `401 { reason: 'token_revoked' }`
   immediately.
2. The token row stays in the table for the audit trail. A future
   sweep job may purge rows older than 90 days post-revocation.
3. **Revocation is irreversible.** If the same subscriber needs
   continued access, issue a fresh token via the existing rotate /
   issuance flow on the same subscription row.
4. `already_revoked` is treated as idempotent on both the server
   (HTTP 409 with the row body) and the UI (success banner reads
   "Token was already revoked.").

---

## Cron-Safe Usage Examples

### curl

```bash
curl -fsS \
  -H "Authorization: Bearer ${CONSULTIFY_SUBSCRIBER_TOKEN}" \
  https://api.consultify.example.com/api/presentations/governance/subscriber/dashboard \
  | jq '.data.health, .data.delivery.last7Days'
```

### Node (no extra dependencies)

```js
const res = await fetch(
  'https://api.consultify.example.com/api/presentations/governance/subscriber/dashboard',
  {
    headers: { authorization: `Bearer ${process.env.CONSULTIFY_SUBSCRIBER_TOKEN}` },
  }
);
if (!res.ok) {
  process.exitCode = 1;
  console.error('subscriber dashboard fetch failed', res.status);
} else {
  const { data } = await res.json();
  console.log('overall:', data.health.overall);
  console.log('last 7d:', data.delivery.last7Days);
}
```

### Python (stdlib only)

```python
import json
import os
import urllib.request

req = urllib.request.Request(
    "https://api.consultify.example.com/api/presentations/governance/subscriber/dashboard",
    headers={"Authorization": f"Bearer {os.environ['CONSULTIFY_SUBSCRIBER_TOKEN']}"},
)
with urllib.request.urlopen(req, timeout=10) as resp:
    payload = json.loads(resp.read().decode("utf-8"))

print("overall:", payload["data"]["health"]["overall"])
print("last 7d:", payload["data"]["delivery"]["last7Days"])
```

Cron tip: schedule no faster than once every 5 minutes. The endpoint is
read-only and lightly cached at the DB layer; aggressive polling provides no
benefit and adds noise to `last_used_at`.
