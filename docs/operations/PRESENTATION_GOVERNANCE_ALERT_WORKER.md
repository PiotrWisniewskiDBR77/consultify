# Presentation Governance Alert Worker

> Sprint 9 — periodic dispatcher that closes the loop on the
> Sprint 8 Governance Alerts surface. Diffs consecutive Watchlist
> snapshots and auto-fires `dispatchAlertsForTransition` whenever a deck
> escalates INTO `BLOCKED_P0` / `BLOCKED_P1`.

## Purpose

The Sprint 8 alert pipeline (subscriptions table + `dispatchAlertsForTransition`)
is **on-demand only**: someone has to call the dispatcher (e.g. via the
`/governance/alerts/test` endpoint). This worker fills the gap by polling
the Governance Watchlist on a configurable cadence and auto-firing alerts
for new blockers — without coupling the watchlist GET to outbound side
effects.

The pure-cycle core lives in
`server/src/services/presentationGovernanceAlertWorkerService.ts`
(unit-testable, no DB / fetch). The DB / loop scaffolding lives in
`server/scripts/run-presentation-alert-worker.ts`.

## Per-cycle algorithm

For each target organization (skipping any with `paused = TRUE`):

1. Load up to 200 most-recently-updated decks (`presentation_decks`
   scoped to the org).
2. Build a per-deck Governance Card best-effort (`buildPresentationGovernanceCard`),
   tolerating quality-gate failures and missing telemetry (mirrors the
   `/governance/watchlist` route).
3. Build watchlist entries via `buildPresentationGovernanceWatchlist`.
4. Read the persisted snapshot from
   `presentation_governance_alert_worker_state.last_snapshot_json`.
5. Run `runAlertWorkerCycle` → `{ transitions, nextSnapshotJson }`.
6. For each transition (unless `--dry-run`): call
   `dispatchAlertsForTransition(transition)`. Aggregate dispatch counters.
7. UPSERT `presentation_governance_alert_worker_state` with the next
   snapshot, run timestamp, and a compact JSON summary
   (`{ transitions, dispatched: { sent, failed, suppressed, dryRun }, durationMs }`).
8. On exception → bump `failures_in_a_row`. Reaching
   **5 consecutive failures** auto-pauses the org by setting
   `paused = TRUE, paused_reason = 'too_many_failures', paused_at = NOW`.
   On success → reset to 0.

The worker NEVER throws out of a cycle: every error is logged and
persisted via the failure counter.

## CLI reference

`npx tsx server/scripts/run-presentation-alert-worker.ts [flags]`

| Flag | Default | Description |
| --- | --- | --- |
| `--organization-id <id>` | `null` (all active orgs) | Repeatable / comma-separated. When omitted, the worker derives orgs from `SELECT DISTINCT organization_id FROM presentation_governance_alert_subscriptions WHERE active = TRUE`. |
| `--once` | off | Run a single cycle and exit. Cron-friendly. |
| `--interval-ms <ms>` | `60000` | Sleep between cycles (min `5000`). Ignored with `--once`. |
| `--dry-run` | off | Compute transitions but skip outbound dispatch. State is still persisted with `dryRun: true` in the summary. |
| `--max-cycles <N>` | unlimited | Stop after N cycles (handy for tests / canary runs). |
| `--report-file <path>` | none | Append one JSON line per cycle to the given path (auto-creates parent dirs). |
| `--quiet` | off | Suppress per-cycle stdout summaries. |
| `--reset-state` | off | For the targeted orgs: clear `last_snapshot_json`, reset `failures_in_a_row` to 0, unpause. Then exit 0. |

Exit codes: `0` on success, `1` on unhandled runtime error, `2` on bad args.

### Examples

```bash
# Single cycle for one org (cron / CI gate):
npx tsx server/scripts/run-presentation-alert-worker.ts \
  --organization-id org_acme --once

# Dry-run across all active orgs (validate without firing webhooks):
npx tsx server/scripts/run-presentation-alert-worker.ts --once --dry-run

# Loop with 90s cadence, 100-cycle bound, JSON report:
npx tsx server/scripts/run-presentation-alert-worker.ts \
  --interval-ms 90000 --max-cycles 100 \
  --report-file out/alert-worker-$(date +%F).jsonl

# Recover from auto-pause after fixing the upstream issue:
npx tsx server/scripts/run-presentation-alert-worker.ts \
  --organization-id org_acme --reset-state
```

## State table — `presentation_governance_alert_worker_state`

Created by migration `763_presentation_governance_alert_signing.sql`.

| Column | Type | Description |
| --- | --- | --- |
| `id` | TEXT PRIMARY KEY | Auto-generated. |
| `organization_id` | TEXT UNIQUE NOT NULL | One row per org. |
| `last_snapshot_json` | TEXT | Compact JSON of the last seen `WatchlistEntry[]`. `NULL` until the first cycle persists a baseline. |
| `last_run_at` | TIMESTAMP | Updated every successful or failed cycle. |
| `last_run_summary` | TEXT | `{transitions, dispatched: {sent, failed, suppressed, dryRun, attempted}, durationMs, dryRun, error}`. |
| `failures_in_a_row` | INTEGER NOT NULL DEFAULT 0 | Consecutive cycle exceptions; reset to 0 on success. |
| `paused` | BOOLEAN NOT NULL DEFAULT FALSE | When `TRUE`, the worker SKIPS this org until cleared. |
| `paused_reason` | TEXT | E.g. `too_many_failures`. |
| `paused_at` | TIMESTAMP | When the pause flag flipped. |

The first-cycle bootstrap NEVER alerts: when `last_snapshot_json` is
`NULL`, the worker only persists the current snapshot so the next cycle
has a real baseline. This avoids alert spam on first deploy.

## Pause heuristic

5 consecutive cycle failures for the same org → `paused = TRUE,
paused_reason = 'too_many_failures', paused_at = NOW()`. Subsequent
cycles for that org are no-ops with `skipped = true`. Clear with
`--reset-state` (or by manually `UPDATE`-ing the row).

The 5-strike threshold is intentional: a transient DB hiccup or a single
slow watchlist build will not pause an org, but a persistently broken
configuration will.

## Cron / systemd example

Single-cycle run every 5 minutes via cron:

```
*/5 * * * * cd /opt/consultify && \
  /usr/bin/npx tsx server/scripts/run-presentation-alert-worker.ts \
    --once --quiet \
    --report-file /var/log/consultify/alert-worker.jsonl \
  >> /var/log/consultify/alert-worker.stdout 2>&1
```

Or as a systemd timer with the long-running daemon mode:

```ini
# /etc/systemd/system/consultify-alert-worker.service
[Service]
Type=simple
ExecStart=/usr/bin/npx tsx server/scripts/run-presentation-alert-worker.ts --interval-ms 60000 --quiet
WorkingDirectory=/opt/consultify
Restart=on-failure
RestartSec=30
```

## HMAC verification guide for subscribers

Every outbound POST that has a `signing_secret` configured (via
`presentation_governance_alert_subscriptions.signing_secret`) ships with
four headers:

| Header | Value |
| --- | --- |
| `x-consultify-signature` | hex-encoded HMAC-SHA256 |
| `x-consultify-signature-algorithm` | `HMAC-SHA256` (constant) |
| `x-consultify-timestamp` | ISO-8601 UTC at sign time |
| `x-consultify-event-id` | server-side dispatch row id |

The canonical string the receiver MUST reproduce verbatim is:

```
${timestamp}\n${event-id}\n${raw-request-body}
```

(literal `\n` between segments, no JSON re-encoding).

### Node.js verification snippet

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

function verifyConsultifyAlert(req, sharedSecret) {
  const ts  = req.headers['x-consultify-timestamp'];
  const eid = req.headers['x-consultify-event-id'];
  const sig = req.headers['x-consultify-signature'];
  if (!ts || !eid || !sig) return false;

  const canonical = `${ts}\n${eid}\n${req.rawBody}`;
  const expected = createHmac('sha256', sharedSecret)
    .update(canonical, 'utf8')
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

### Quick curl check (dry-run with a known secret)

```bash
SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update the subscription to use $SECRET, then re-fire:
curl -X POST https://demo.consultify.ai/api/presentations/governance/alerts/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Inspect dispatch audit:
curl -s https://demo.consultify.ai/api/presentations/governance/alerts/recent?limit=1 \
  -H "Authorization: Bearer $TOKEN" | jq '.data.dispatches[0] | {status, signature_present, signature_algorithm}'
```

## Related docs

- `docs/operations/PRESENTATION_GOVERNANCE_ALERTS.md` — subscriptions
  surface, dispatcher, payload schema, dry-run mode, and HMAC signing
  details.
- `docs/operations/PRESENTATION_WEEKLY_DIGEST.md` — weekly retrospective
  (complementary, not real-time).
- Migration: `server/migrations/763_presentation_governance_alert_signing.sql`.
- Service: `server/src/services/presentationGovernanceAlertWorkerService.ts`.
- CLI:     `server/scripts/run-presentation-alert-worker.ts`.
