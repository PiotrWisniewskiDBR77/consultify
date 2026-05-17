# Presentation Artifact Demo Seed

This document describes the deterministic demo dataset used for manual UI tests, benchmarks, and demo walkthroughs of the **Presentation Artifact Engine**.

The seed script lives at `server/scripts/seed-presentation-artifact-demo.ts`.

## Purpose

- Provide a stable, repeatable dataset of five presentation decks covering the full confidentiality matrix (`public`, `internal`, `confidential`).
- Populate `presentation_runtime_events` with realistic agent-edit and export-blocked telemetry so the SuperAdmin Telemetry view, governance card, and audit log surfaces all have data to render.
- Make demos and benchmark runs reproducible without depending on real customer data.

## CLI

```
npx tsx server/scripts/seed-presentation-artifact-demo.ts \
  --organization-id <id> \
  [--user-id <id>] \
  [--reset] \
  [--dry-run] \
  [--report-file out/seed-<date>.json]
```

| Flag                  | Required | Default            | Description                                                              |
|-----------------------|----------|--------------------|--------------------------------------------------------------------------|
| `--organization-id`   | yes      | —                  | Tenant scope for all inserts. Missing value exits with code `2`.         |
| `--user-id`           | no       | `demo-seed-user`   | Recorded as the actor for inserted ops/events.                            |
| `--reset`             | no       | `false`            | Deletes existing `demo-deck-*` rows scoped by org before inserting.      |
| `--dry-run`           | no       | `false`            | Plans the seed but performs no writes.                                   |
| `--report-file`       | no       | —                  | Write a structured JSON report to this path (parent dirs auto-created).  |

Examples:

```bash
# Apply seed for a tenant
npx tsx server/scripts/seed-presentation-artifact-demo.ts --organization-id org-acme

# Reset and re-seed
npx tsx server/scripts/seed-presentation-artifact-demo.ts --organization-id org-acme --reset

# Dry-run with report file
npx tsx server/scripts/seed-presentation-artifact-demo.ts \
  --organization-id org-acme \
  --dry-run \
  --report-file exports/audit/seed/seed-2026-05-07.json
```

## The five seed decks

| ID                          | Title                                          | Confidentiality | Slides |
|-----------------------------|------------------------------------------------|-----------------|--------|
| `demo-deck-strategy-readout`| Strategy Readout — Q2 Growth                   | public          | 8      |
| `demo-deck-board-update`    | Board Update — May Cycle                       | internal        | 12     |
| `demo-deck-ks-followup`     | KS Follow-up — Transformation Steering         | internal        | 10     |
| `demo-deck-internal-status` | Internal Status — Platform Reliability         | confidential    | 6      |
| `demo-deck-customer-pitch`  | Customer Pitch — Tier 1 Account                | confidential    | 14     |

Each deck contains at least one decision slide (`kind: 'decision'`) and one risks slide (`kind: 'risks'`) to satisfy the quality gate hard requirements documented in `PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md`.

## Runtime event mix

Across the five decks the script inserts a mix of:

- `agent_edit_proposal_created`
- `agent_edit_applied` (with matching `presentation_ai_operations` rows in `applied` status)
- `agent_edit_rejected`
- `export_blocked` — only on confidential decks, simulating quality-gate-blocked exports.

Events are timestamped within the last 14 days so the default 7-day telemetry rollup window picks up most of them.

See `docs/product/PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md` and `docs/testing/RETENTION_JOB_PRESENTATION_TELEMETRY.md` for the broader rollout and retention context.

## Cleanup

To remove the seeded dataset:

```
npx tsx server/scripts/seed-presentation-artifact-demo.ts \
  --organization-id <id> \
  --reset \
  --dry-run
```

Then drop `--dry-run` to apply. The reset deletes only rows where the deck id starts with `demo-deck-`, scoped by `--organization-id`. Children are deleted before parents in the order: runtime events → AI operations → deck versions → decks.

## Failure modes

| Symptom                                     | Cause                                       | Behaviour                                             |
|---------------------------------------------|---------------------------------------------|-------------------------------------------------------|
| Exit `2`                                    | Missing `--organization-id` / unknown flag  | Argument error printed to stderr.                     |
| Warning `schema_missing_runtime_events`     | `presentation_runtime_events` table absent  | Decks still inserted; events skipped.                 |
| Warning `schema_missing_ai_operations`      | `presentation_ai_operations` absent         | Decks/events still inserted; ops skipped.             |
| Exit `1`                                    | Unhandled DB / runtime error                | Stderr shows error; partial work may persist.          |
| Refusal to insert non-`demo-deck-*` id      | Internal safety guard                       | Throws; no writes performed for that deck.            |

## JSON report shape

```
{
  "startedAt": "<iso>",
  "completedAt": "<iso>",
  "organizationId": "<id>",
  "userId": "<id>",
  "dryRun": false,
  "reset": false,
  "decks": [
    { "id": "demo-deck-strategy-readout", "title": "...", "confidentiality": "public", "slideCount": 8, "events": 3, "operations": 1 }
  ],
  "totals": { "decks": 5, "events": 12, "operations": 3 },
  "warnings": []
}
```

## Archival

Archive seed reports under `exports/audit/seed/<YYYY-MM-DD>-<env>.json` whenever the seed is run against a shared environment. This is the source of truth for "what is on demo right now".

## Related documents

- `docs/product/PRESENTATION_ARTIFACT_ENGINE_REFERENCE.md`
- `docs/product/PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md`
- `docs/testing/RETENTION_JOB_PRESENTATION_TELEMETRY.md`
- `docs/testing/CI_GATE_PRESENTATION_GOVERNANCE.md`
- `docs/testing/PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md`
