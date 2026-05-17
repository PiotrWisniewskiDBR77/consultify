# Presentation Weekly Digest

Status: `ACTIVE`
Owner: Delivery + QA
Script: `server/scripts/weekly-presentation-digest.ts`
Service (pure aggregation): `server/src/services/presentationWeeklyDigestService.ts`

## 1) Purpose

The weekly presentation digest aggregates the last-7-day proposal lifecycle,
exports, and governance verdicts per organization across the presentation
runtime surface, then emits a compact stdout summary plus optional JSON and
Markdown reports.

It is intended for:

- A weekly Monday-morning ops digest sent to delivery and QA channels.
- A lightweight CI gate that fails the build when any organization carries
  `BLOCKED_P0` governance verdicts at the end of the window.
- Ad-hoc triage when an organization reports unexpected proposal churn or
  blocked exports.

The digest is read-only. It never mutates DB state.

## 2) CLI Reference

The script has no extra dependencies; it uses only the in-repo
`server/src/utils/DbPromise.js` wrapper and the Node 18+ standard library.

```
npx tsx server/scripts/weekly-presentation-digest.ts \
  --organization-id <id>          # required, repeatable or comma-separated
  [--days 7]                      # rolling window length (1..365), default 7
  [--end <ISO>]                   # window end, default now() at start
  [--report-file <path>]          # write aggregate JSON
  [--markdown-file <path>]        # write per-org markdown joined by ---
  [--dry-run]                     # symmetry with sibling jobs; no-op
  [--quiet]                       # suppress stdout summary; errors still go to stderr
  [--fail-on-blocked]             # exit 1 if any org has BLOCKED_P0 in topBlockedDecks
```

Argument rules:

- Unknown flags are rejected with exit code `2`.
- `--organization-id` may be repeated (`--organization-id a --organization-id b`)
  or comma-separated (`--organization-id a,b`); duplicates are de-duplicated
  in original order.
- `--end` accepts any value parseable by `Date.parse`. Internally normalized
  to ISO-8601.
- `--days` is validated as an integer in `[1, 365]`.

### Examples

Single org with markdown + JSON output:

```bash
npx tsx server/scripts/weekly-presentation-digest.ts \
  --organization-id org_dbr77 \
  --markdown-file out/digest-dbr77-$(date +%F).md \
  --report-file out/digest-dbr77-$(date +%F).json
```

Multi-org gate for CI:

```bash
npx tsx server/scripts/weekly-presentation-digest.ts \
  --organization-id org_dbr77,org_vts \
  --fail-on-blocked
```

Backfill a 30-day window ending at a specific timestamp:

```bash
npx tsx server/scripts/weekly-presentation-digest.ts \
  --organization-id org_dbr77 \
  --days 30 \
  --end 2026-05-07T00:00:00Z \
  --report-file out/digest-dbr77-30d.json
```

## 3) Output Schema

### JSON aggregate (`--report-file`)

```jsonc
{
  "generatedAt": "2026-05-07T07:00:00.000Z",
  "windowDays": 7,
  "windowEnd": "2026-05-07T00:00:00.000Z",
  "organizations": [
    {
      "organizationId": "org_dbr77",
      "windowStart": "2026-04-30T00:00:00.000Z",
      "windowEnd": "2026-05-07T00:00:00.000Z",
      "totals": {
        "decks": 42,
        "proposalsCreated": 117,
        "proposalsApplied": 64,
        "proposalsRejected": 28,
        "proposalsReverted": 5,
        "exportsAttempted": 31,
        "exportsBlocked": 2,
        "exportsSucceeded": 28,
        "governance": {
          "pass": 38,
          "passWithP2": 2,
          "blockedP1": 1,
          "blockedP0": 1,
          "inconclusive": 0
        }
      },
      "topActiveDecks": [
        { "deckId": "deck_a", "title": "Steering Q2", "activityCount": 41 }
      ],
      "topBlockedDecks": [
        { "deckId": "deck_x", "title": "Investor Update", "verdict": "BLOCKED_P0" }
      ],
      "warnings": [
        "governance_coverage_partial"
      ]
    }
  ]
}
```

### Markdown (`--markdown-file`)

The markdown writer emits one section per organization joined by `---` rules.
Each section contains:

- H1: `Presentation Weekly Digest`
- Org / window metadata block
- `## Totals` table with one row per metric (proposals, exports, governance).
- `## Top Active Decks` table (`Deck`, `Title`, `Activity`).
- `## Top Blocked Decks` table (`Deck`, `Title`, `Verdict`).
- `## Warnings` list (or `_None._`).

Markdown is deterministic for the same input — safe to diff in PRs and
attach to runbook updates.

## 4) Cron Suggestion

Run weekly at 06:00 every Monday (UTC). Adapt to your scheduler of choice;
output goes to `out/presentation-digest/` next to the existing retention
artifacts.

```cron
0 6 * * MON cd /opt/consultify && \
  npx tsx server/scripts/weekly-presentation-digest.ts \
    --organization-id org_dbr77,org_vts \
    --report-file out/presentation-digest/digest-$(date +\%F).json \
    --markdown-file out/presentation-digest/digest-$(date +\%F).md \
    --quiet \
  >> logs/weekly-presentation-digest.log 2>&1
```

For CI, prefer `--fail-on-blocked` and skip the file outputs:

```bash
npx tsx server/scripts/weekly-presentation-digest.ts \
  --organization-id $WEEKLY_DIGEST_ORG_IDS \
  --fail-on-blocked \
  --quiet
```

## 5) Failure Modes & Partial Coverage Rules

The script is schema-tolerant by design and never throws to the top level.
Anything unusual is surfaced through `report.warnings`.

| Warning | Cause | Behavior |
| --- | --- | --- |
| `schema_missing:<table>` | Backing table absent (e.g. fresh env, partial migrations). | Empty rows for that source; totals fall to zero; processing continues. |
| `query_failed:<table>` | Non-schema DB error during fetch. | Same as schema_missing; the failure is logged via `logger.error` and stderr. |
| `governance_coverage_partial` | Governance verdicts are derived from runtime telemetry only — quality reports are not fetched (would require N HTTP calls per deck). | Always emitted when at least one deck is processed; cross-check the full Governance Card before release. |
| `telemetry_fallback_to_ops:applied` (or `:rejected`, `:reverted`) | Runtime events table reported zero for a category, but `presentation_ai_operations` had matching `status` rows. | Counts reflect the ops table; investigate why telemetry is missing. |
| `org_processing_failure` | Unexpected exception while fetching for an org. | The org row is preserved in the report with zeroed totals. |

Precedence rule for proposal lifecycle counters (also encoded in the service
JSDoc): telemetry-first; ops are only used when telemetry is empty for a
category. `proposalsCreated` is telemetry-only — there is no equivalent ops
status.

## 6) Related References

- `server/scripts/check-presentation-governance.ts` — full Governance Card
  CI gate (HTTP-based; authoritative for verdicts).
- `server/scripts/retention-presentation-runtime-events.ts` — companion
  retention job; complements this digest by trimming aged telemetry.
- `server/src/services/presentationGovernanceCardService.ts` — verdict shape
  and overall verdict derivation.
- `server/src/services/presentationRuntimeRollupService.ts` — telemetry
  rollup used internally to derive partial governance verdicts.
- `docs/testing/CI_GATE_PRESENTATION_GOVERNANCE.md` — release gate runbook.
- `docs/testing/PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md` — verdict
  semantics.
- `docs/product/PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md`
  — operating model for the runtime telemetry surface.
