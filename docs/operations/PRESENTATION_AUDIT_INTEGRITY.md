# Presentation Audit Integrity

> Epic K3 closure — read-only verifier that confirms every applied agent edit
> and every successful export has a matching audit record within a tight
> latency budget. Missing records fire a P1 alert.

## Purpose

The presentation surface emits two compliance-relevant streams:

- Applied agent edits (`presentation_ai_operations.status = 'applied'`).
- Successful artifact exports (`presentation_export_records.status = 'completed'`).

Each MUST be reflected in the unified `audit_events` log so an auditor can
reconstruct the deck timeline from a single table. Anything that escapes
the audit log silently is a forensic blind spot.

This service is the **forensic backstop**: a scheduled, read-only verifier
that scans the three sources, cross-references them, and flags drift. It
NEVER writes audit events itself — re-emitting fake audits would defeat
the entire purpose of the check.

## Sources scanned

| Source | Table | Purpose |
| --- | --- | --- |
| Applied agent edits | `presentation_ai_operations` | Every accepted AI proposal that mutated a deck. |
| Successful exports | `presentation_export_records` | Every completed PDF / PPTX / HTML / PNG export. |
| Audit log | `audit_events` (resource types `presentation_deck`, `presentation_deck_agent_edit`, `presentation_deck_export`) | The unified log we expect to reflect both. |

For each source the scanner:

1. Reads rows within the configured `windowDays` (default 7, max 90, min 1).
2. Limits row counts (`5_000` for edits + exports, `20_000` for audit
   events) to bound memory.
3. Applies the **schema-tolerant** guard: a missing table downgrades the
   source to an empty array and emits a `schema_missing:<table>`
   warning instead of failing the whole run.

## Issue types and severities

| Type | Severity | Trigger |
| --- | --- | --- |
| `missing_audit_for_agent_edit` | **P1** | Applied agent edit has no audit row with matching `relatedId`. |
| `missing_audit_for_export` | **P1** | Successful export has no audit row with matching `relatedId`. |
| `orphan_audit_event` | **P1** | Audit row references a `deckId` or `relatedId` not present in the scanned operations / exports. |
| `late_audit_record` | **P2** | Audit row exists but arrived more than `AUDIT_LATENCY_BUDGET_MS` (5 minutes) after the action. |
| `duplicate_audit_event` | **P2** | Two audit rows with the same `(action, relatedId, deckId)` arrive within 5 minutes of each other. |

The 5-minute tolerance is intentionally tight; it is a single constant
(`AUDIT_LATENCY_BUDGET_MS = 5 * 60 * 1000`) at the top of
`server/src/services/presentationAuditIntegrityService.ts`. Adjusting it
should be a deliberate compliance decision documented in this file.

The issues array is hard-capped at `ISSUE_CAP = 1000`; overflow flips
`truncated: true` on the report so the SuperAdmin sees that the run hit
the cap before it ran out of memory.

## Verdict mapping

| Verdict | Condition | Operational meaning |
| --- | --- | --- |
| `PASS` | No issues. | Audit log fully reflects the action streams. |
| `PASS_WITH_P2` | Only late / duplicate audit rows. | Coverage is complete but timing or de-duplication is degrading; investigate trends. |
| `BLOCKED_P1` | At least one missing or orphan audit. | Audit coverage GAP — open an incident before it grows. |

## API reference

```
GET /api/presentations/operations/audit-integrity?windowDays=7
Capability: presentation_edit (admin / PM / SuperAdmin)
```

Response (success):

```json
{
  "success": true,
  "data": {
    "organizationId": "org_acme",
    "windowDays": 7,
    "generatedAt": "2026-05-07T07:00:00.000Z",
    "totals": {
      "agentEditsScanned": 1234,
      "exportsScanned": 567,
      "auditEventsScanned": 8901,
      "issuesFound": 3,
      "p1": 1,
      "p2": 2
    },
    "issues": [
      {
        "type": "missing_audit_for_agent_edit",
        "severity": "P1",
        "deckId": "deck_42",
        "referenceId": "op_8a1c…",
        "occurredAt": "2026-05-06T14:21:33.512Z",
        "reason": "no audit_event with relatedId=op_8a1c… and action in {agent_edit_applied, agent_edit_proposal_applied, approve}"
      }
    ],
    "truncated": false,
    "verdict": "BLOCKED_P1",
    "warnings": []
  }
}
```

Status mapping:

| HTTP | Meaning |
| --- | --- |
| `200` | Report produced (verdict in body). |
| `403` | Caller lacks `presentation_edit`. |
| `503` | `storage_error` — catastrophic DB failure (NOT a missing table; that downgrades to a warning). |

## CLI reference

```bash
npx tsx server/scripts/check-audit-integrity.ts \
  --organization-id org_123 \
  --window-days 7 \
  --report-file ./audit-integrity-report.json
```

Or via the npm shortcut:

```bash
npm run audit:integrity -- --organization-id org_123 --window-days 7
```

Flags:

| Flag | Required | Default | Notes |
| --- | --- | --- | --- |
| `--organization-id` | yes | — | Required. |
| `--window-days` | no | `7` | Integer in `[1..90]`. |
| `--report-file` | no | — | Writes the full JSON report to disk. |
| `--quiet` | no | `false` | Suppress stdout summary. |
| `--alert` | no | `false` | OPT-IN: dispatch a P1 governance alert when verdict is `BLOCKED_P1`. Manual runs without `--alert` NEVER fire. |

Stdout summary:

```
Audit Integrity Check — org_123 (window: 7d)
Scanned: 1234 edits, 567 exports, 8901 audit events
Issues:  3 P1, 12 P2
Verdict: BLOCKED_P1
```

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | `PASS` or `PASS_WITH_P2`. |
| `1` | `BLOCKED_P1` — audit coverage gap. |
| `2` | Argument or runtime error. |

### Cron suggestion

Daily at 06:00 UTC:

```cron
0 6 * * * cd /opt/consultify && \
  npm run audit:integrity -- \
    --organization-id $ORG_ID \
    --window-days 7 \
    --report-file /var/log/consultify/audit-integrity-$(date -I).json \
    --alert \
    --quiet
```

The `--alert` flag is opt-in by design — only the cron-driven invocation
is allowed to fire P1 alerts so manual operator runs (debugging,
backfills) never trigger pages.

## P1 alert flow integration

When `--alert` is set AND `verdict === 'BLOCKED_P1'`, the CLI calls
`dispatchAlertsForTransition` (Sprint 8 / Sprint 9) with a synthetic
transition:

```ts
{
  deckId: 'audit-integrity-check',
  deckTitle: 'Audit Integrity Check',
  fromVerdict: 'PASS',
  toVerdict: 'BLOCKED_P1',
  organizationId,
  generatedAt: report.generatedAt,
}
```

Every active subscription with `min_severity = 'BLOCKED_P1'` (or lower —
`BLOCKED_P0`) receives the standard `consultify.governance.alert.v1`
payload. The `presentation_governance_alert_dispatches` audit row records
the synthetic deck id verbatim so on-call can recognize it as an audit
integrity event rather than a per-deck escalation.

This reuses the Sprint 9 HMAC signing path automatically — no extra
configuration required.

## How to remediate each issue type

### `missing_audit_for_agent_edit` (P1)

The applied agent edit (`presentation_ai_operations.id = <referenceId>`)
has no corresponding `audit_events` row.

Fix:

1. Confirm the route still calls `req.emitAuditEvent({ resourceType: 'presentation_deck_agent_edit', resourceId: operationId, … })` on accept.
2. Check `audit_events` table directly for `resource_id = <referenceId>`
   in case the scanner missed it due to action-name drift.
3. If genuinely missing, file a backfill ticket — the verifier MUST NOT
   re-emit the audit row itself.

### `missing_audit_for_export` (P1)

The successful export (`presentation_export_records.id = <referenceId>`)
has no audit row.

Fix:

1. Verify the export route emits an audit row with action in
   `{export_completed, pdf_exported, pptx_exported, html_exported, png_exported}`
   and `resourceType = 'presentation_deck_export'`.
2. Add the emit if it is genuinely absent (this is the most likely
   coverage gap as of Sprint 13).

### `orphan_audit_event` (P1)

An audit row references a deck or operation that no longer (or never)
existed in the scanned tables.

Fix:

- Most often a stale soft-deleted deck. Confirm the deck-cleanup workflow
  archives instead of hard-deletes.
- If the action was emitted with a wrong `resource_id`, file a producer
  bug — do NOT delete the audit row (audit log is append-only).

### `late_audit_record` (P2)

The audit row exists but arrived > 5 minutes after the action.

Fix:

- Investigate `AuditEventsService.log` latency / queue lag.
- Inspect `req.emitAuditEvent` middleware for batching that exceeds the
  budget.

### `duplicate_audit_event` (P2)

Two audit rows for the same `(action, relatedId, deckId)` triple within
5 minutes.

Fix:

- Check for double-emit on retry paths.
- Confirm the route does not call both `req.emitAuditEvent` AND
  `auditEventsService.log` for the same action.

## Future work

- **Per-deck integrity history**: persist daily reports keyed by
  `(organizationId, deckId)` so we can trend coverage over time.
- **Automated re-write of missing audit rows from operation logs**: a
  guarded backfill job that synthesizes audit rows from
  `presentation_ai_operations` / `presentation_export_records` where
  metadata is sufficient, with mandatory operator approval.
- **Watchlist-card surface**: surface the verdict directly on the
  Operations Health scoreboard (`/operations/health`).

## Implementation files

| File | Purpose |
| --- | --- |
| `server/src/services/presentationAuditIntegrityService.ts` | Pure verifier + schema-tolerant DB wrapper. |
| `server/src/services/__tests__/presentationAuditIntegrityService.test.ts` | 17 unit tests covering all five issue types. |
| `server/scripts/check-audit-integrity.ts` | CLI runner with optional `--alert` opt-in. |
| `server/src/routes/presentations.routes.ts` | `GET /operations/audit-integrity` endpoint. |
| `package.json` | `npm run audit:integrity` shortcut. |
