# Presentation Runtime + Confidentiality Rollout Runbook

This runbook covers safe deployment of two cross-cutting changes for the Presentation Artifact Engine:

- Runtime telemetry (`presentation_runtime_events`) used for proposal/edit/export-blocker flow.
- Confidentiality-aware export and share controls.

It applies to environments `dev`, `staging`, `preprod`, `prod` and follows the stage-gate workflow defined in `PRESENTATION_STAGE_GATE_WORKFLOW.md`.

## 1) Pre-flight (Required)

- Confirm role mapping is current. Reference: `PRESENTATION_RBAC_MATRIX.md`.
- Confirm the canonical deck record has either a `confidentiality` column or a `meta.confidentiality` field in `deck_json`. Otherwise the policy treats the deck as `internal` (default).
- Confirm latest migrations are queued in `server/migrations/`:
  - `760_presentation_legacy_normalization.sql`
  - `761_presentation_runtime_events.sql`

## 2) Migration Plan

Run migrations in this order:

```
server/migrations/760_presentation_legacy_normalization.sql
server/migrations/761_presentation_runtime_events.sql
```

Verification after migration:

```sql
-- presentation_runtime_events must exist with index on (organization_id, created_at)
SELECT 1 FROM presentation_runtime_events LIMIT 0;

-- presentation_migration_reports must exist for legacy normalization
SELECT 1 FROM presentation_migration_reports LIMIT 0;
```

If verification fails:

- Stop the rollout.
- Do not proceed to backend deployment.
- Engineering lead must rerun the migration and re-verify.

## 3) Backend Deployment

Order:

1. Deploy backend with:
   - `server/src/services/presentationConfidentialityPolicyService.ts`
   - `server/src/services/presentationRuntimeTelemetryService.ts`
   - `server/src/services/presentationTemplateCompatibilityService.ts`
   - Updated `server/src/routes/presentations.routes.ts`
2. Confirm health checks pass.
3. Confirm the new endpoint is reachable:

```
GET /api/presentations/decks/:deckId/runtime-events
```

Authenticated request must return `200` with `data: []` when no events exist, or telemetry rows when present.

If the runtime events table is missing the response is graceful:

```
{ "success": true, "data": [], "degraded": true, "reason": "telemetry_schema_missing" }
```

This is acceptable only on first deploy before migration. In all other cases this is a P1 incident.

## 4) Functional Verification (Mandatory)

Run these scripted or manual checks per environment.

### 4.1 Confidentiality Policy

- Confidential deck export attempt by `USER` role:
  - Expected: HTTP 403 with code `CONFIDENTIALITY_POLICY_BLOCKED`.
  - Telemetry: NOT required for blocked-by-policy (we record `export_blocked` for quality gates only).
- Internal deck share by `PROJECT_MANAGER`:
  - Expected: HTTP 403 with code `CONFIDENTIALITY_SHARE_REQUIRES_ADMIN`.
- Public deck share by `PROJECT_MANAGER`:
  - Expected: HTTP 200 with `data.shareToken`.

### 4.2 Telemetry

After running an agent-edit propose/apply/reject flow on a non-confidential deck:

```
GET /api/presentations/decks/:deckId/runtime-events
```

Expected events with `eventType` values:

- `agent_edit_proposal_created`
- `agent_edit_applied`
- `agent_edit_rejected`

After triggering a quality-gate-blocked export:

- `export_blocked`

### 4.3 Audit Log

For each agent-edit endpoint a corresponding audit event must appear:

- `propose` (actorType `AI_AGENT`, resourceType `presentation_deck_agent_edit`)
- `approve` (actorType `USER`, resourceType `presentation_deck_agent_edit`)
- `reject` (actorType `USER`, resourceType `presentation_deck_agent_edit`)

If audit events are missing: P1 incident. Roll back to previous backend.

## 5) Frontend Deployment

Frontend changes for this rollout:

- `DeckBuilderTopBar.tsx` confidentiality badge and agent activity pulse.
- Existing quality gate and export blocker handling already in place.

Verification after frontend deploy:

- Open any deck. The confidentiality badge appears in Menu 3 / right side.
- After running an agent edit, the violet pulse appears on the badge for 60 seconds.
- Export from the toolbar surfaces the existing `QUALITY_GATE_BLOCKED` UX (no regression).

## 5.4) Operational Surfaces (Sprint 4 + 5)

The following operational surfaces are part of the runtime + confidentiality stack and require their own retention / sign-off:

- **Telemetry retention** — `server/scripts/retention-presentation-runtime-events.ts` (default 90 days). Documentation: `docs/testing/RETENTION_JOB_PRESENTATION_TELEMETRY.md`.
- **CI governance gate** — `server/scripts/check-presentation-governance.ts` blocks promotion on `BLOCKED_P0` / `BLOCKED_P1`. Documentation: `docs/testing/CI_GATE_PRESENTATION_GOVERNANCE.md`.
- **Audit log endpoint** — `GET /api/presentations/decks/:deckId/audit-log` merges deck-level + agent-edit audit events filtered by `metadata.deckId`. UI: `Audit` button in Deck Builder Menu 3.
- **Governance card endpoint** — `GET /api/presentations/decks/:deckId/governance-card` aggregates Quality + Confidentiality + Telemetry. UI: `Governance` button in Deck Builder Menu 3 with a verdict-colored dot prefetched on deck load.
- **Structured slide diff** — AgentPanel proposal card now renders slide-by-slide added/removed/modified instead of raw JSON. Backend `buildDeckDiffSummary` extended with `slides[]`; legacy summary fields preserved.
- **Demo seed** — `server/scripts/seed-presentation-artifact-demo.ts` produces 5 deterministic demo decks with mixed confidentiality + telemetry. Documentation: `docs/testing/PRESENTATION_DEMO_SEED.md`.
- **Governance JSON export** — Deck Builder governance modal and SuperAdmin Telemetry view both expose `Export JSON` to snapshot the current `PresentationGovernanceCard` for compliance archives. Filename pattern: `governance-<deckId>-<ISO_TS>.json`.
- **Audit log filters + CSV** — `DeckAuditLogModal` exposes actor type / action / date range filters (client-side over fetched events) and a `Export CSV` button that exports the currently filtered list as UTF-8 (BOM-prefixed, CRLF) CSV.
- **AgentPanel slide diff detail** — Each `SlideDiffRow` is keyboard-activatable; clicking opens a `SlideDiffDetailModal` with a 2-column Before/After layout (title + layout + bullets) for the chosen slide.
- **Drive sync resilience** — `server/scripts/drive-sync-snapshot.ts` (one-shot or `--watch`) and `server/scripts/drive-sync-restore.ts` (`--missing-only`, `--diff-only`, `--force`) protect against Google Drive Sync reverts. Cursor rule: `.cursor/rules/drive-sync-resilience.mdc`. Documentation: `docs/operations/DRIVE_SYNC_RESILIENCE.md`.

## 6) Rollback

If P0/P1 incident is detected:

- Disable share and export endpoints by removing the `presentation_share` and `presentation_export` capabilities for the affected role until fix.
- Revert backend deployment to the previous tag.
- Keep migrations in place. They are non-destructive and additive.
- Audit log entries already written remain valid history.
- File a postmortem within 24h.

## 7) Stage-gate Sign-off

For each environment, record:

- CI test run URL.
- Migration verification log.
- 4.1 / 4.2 / 4.3 results.
- Owner signing off (engineering, QA, security, product).

Without all four sign-offs the change cannot be promoted to the next environment.
