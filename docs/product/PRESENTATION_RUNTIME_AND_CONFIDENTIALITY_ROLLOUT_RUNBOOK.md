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
- **Pre-flight agent snapshot hook** — `.cursor/hooks/agent-snapshot-pre-flight.sh` (registered via `.cursor/hooks.json` on `beforeSubmitPrompt`) auto-runs the snapshot before each agent task. Rule: `.cursor/rules/agent-snapshot-protocol.mdc`. Documentation: `docs/operations/AGENT_SNAPSHOT_PROTOCOL.md`.
- **Governance Watchlist** — `GET /api/presentations/governance/watchlist?onlyBlocked=true&limit=50` lists decks currently flagged BLOCKED_P0/P1 across the org with severity scoring. UI: `Governance Watchlist` tab in SuperAdmin SystemModule. Service: `presentationGovernanceWatchlistService.ts` with 6 unit tests.
- **Audit log shareable links** — `DeckAuditLogModal` exposes `Copy share link` button that writes current filters to URL query params (`audit_log=true&audit_actors=...&audit_action=...&audit_from=...&audit_to=...`). Modal pre-fills filters from URL on mount; DeckBuilder auto-opens modal if `audit_log=true`.
- **Agent proposal history** — `GET /api/presentations/decks/:deckId/agent-history?limit=50&offset=0` lists past AI operations from `presentation_ai_operations`. UI: `Chat` / `History` tab strip in `AgentPanel` with status pills, diff strip, expandable detail row reusing existing `SlideDiffRow` + `SlideDiffDetailModal`. Schema-tolerant.
- **Watchlist auto-refresh + new-blocker alerts** — `PresentationGovernanceWatchlistView` polls every 30s while the tab is visible and the previous load was successful. `diffWatchlistForNewBlockers` (pure helper, 7 unit tests) emits transition alerts only on rank escalations into `BLOCKED_P0`/`BLOCKED_P1`. Permission revocation auto-pauses the loop; tab hidden / backend issue surface honest pause reasons.
- **Watchlist CSV export** — `Export CSV` button on the watchlist toolbar downloads the current entries (filtered by `Only blocked` toggle) as a UTF-8/BOM CSV with columns `deckId, title, overallVerdict, p0, p1, p2, gateCount, exportsBlocked, lastActivityAt, confidentialityLevel, updatedAt, severityScore`. Filename: `governance-watchlist-<blocked|all>-<YYYY-MM-DD>.csv`.
- **Agent history revert** — `POST /api/presentations/decks/:deckId/agent-history/:operationId/revert` snapshots the deck back to `original_deck_json`. Eligibility enforced via `evaluateRevertEligibility` (8 unit tests). Non-destructive: original op row is left intact, an inverse `agent_revert` operation row + audit event + `agent_edit_reverted` runtime event are emitted. UI: inline confirm box (no global modal) inside History detail — visible only for `applied`/`accepted` ops; conflict reasons (`newer_operation_exists`, `no_snapshot`, etc.) mapped to friendly banners.
- **Drive sync npm shortcuts** — `npm run drive:snapshot`, `drive:snapshot:watch`, `drive:restore`, `drive:restore:missing`, `drive:restore:diff` give zero-config entry points for developers. Documented in `docs/operations/DRIVE_SYNC_RESILIENCE.md`.
- **Governance alert webhooks (Sprint 9)** — `presentation_governance_alert_subscriptions` + `presentation_governance_alert_dispatches` (migration `762`). Five admin-gated endpoints under `/api/presentations/governance/alert-subscriptions` + `/alerts/test` + `/alerts/recent` for managing per-org webhook/Slack/email subscriptions. `dispatchAlertsForTransition` produces deterministic `consultify.governance.alert.v1` payloads with severity rank; honors `PRESENTATION_GOVERNANCE_ALERTS_DRY_RUN`, masks targets, never throws. Email channel is stub-only (records `dry_run` with `error_category='email_channel_stub_only'`). 10 unit tests. Documentation: `docs/operations/PRESENTATION_GOVERNANCE_ALERTS.md`.
- **Bulk revert (Sprint 9)** — `POST /api/presentations/decks/:deckId/agent-history/bulk-revert` reverts N consecutive newest applied operations to the snapshot taken before the oldest selected proposal. Strict consecutive-tail invariant (rejects skip-revert with 409 + `missingIds`). Audit event `bulk_revert` + runtime event `agent_edit_bulk_reverted`. UI: per-row checkboxes (only for `applied`/`accepted`) + sticky bulk action bar + inline confirm box in `AgentPanel` History tab. 10 unit tests across `planBulkRevert` + `evaluateBulkRevertEligibility`.
- **Audit log saved views (Sprint 9)** — Per-user named filter presets persisted in `localStorage` (`consultify.auditLog.savedViews.v1`), capped at 20, name 1..40 chars unique case-insensitively. Service `presentationAuditLogSavedViews.ts` with `listSavedViews / saveSavedView / deleteSavedView / exportSavedViews / importSavedViews / findMatchingSavedView`. UI dropdown in `DeckAuditLogModal` with `Save current as…`, `Manage`, `Export views`, `Import views`. Active-view chip with `(modified)` indicator. Honest fallback when storage unavailable. 10 unit tests with Map-backed polyfill.
- **Telemetry weekly digest (Sprint 9)** — `npx tsx server/scripts/weekly-presentation-digest.ts --organization-id <id> [--days 7] [--report-file <path>] [--markdown-file <path>] [--fail-on-blocked]`. Aggregates proposals/applied/rejected/reverted, exports (attempted/blocked/succeeded), governance verdicts, top active decks, top blocked decks. Schema-tolerant per-table; warnings: `schema_missing:*`, `query_failed:*`, `governance_coverage_partial`, `telemetry_fallback_to_ops:*`, `org_processing_failure`. Cron suggestion `0 6 * * MON`. 8 unit tests. Documentation: `docs/operations/PRESENTATION_WEEKLY_DIGEST.md`.
- **Periodic alert worker (Sprint 10)** — `npx tsx server/scripts/run-presentation-alert-worker.ts [--organization-id <id>] [--once] [--interval-ms 60000] [--dry-run] [--max-cycles N] [--report-file <path>] [--reset-state]`. Diffs successive watchlist snapshots and auto-fires `dispatchAlertsForTransition` when verdicts escalate INTO `BLOCKED_P0`/`BLOCKED_P1`. State persisted in `presentation_governance_alert_worker_state` (migration `763`); 5 consecutive failures auto-pause an org with `paused_reason='too_many_failures'`. Worker mirrors the FE rank model and suppresses bootstrap alerts. 10 unit tests. Documentation: `docs/operations/PRESENTATION_GOVERNANCE_ALERT_WORKER.md`.
- **HMAC signing for outbound webhooks (Sprint 10)** — `subscriptions.signing_secret` (migration `763`) + `dispatches.signature_algorithm`/`signature_present`. Headers on webhook/Slack POSTs: `x-consultify-signature` (HMAC-SHA256 hex), `x-consultify-signature-algorithm`, `x-consultify-timestamp`, `x-consultify-event-id`. Canonical string: `${ts}\n${eventId}\n${bodyJson}`. `verifyWebhookSignature` is timing-safe and never throws on length mismatch. Backward-compatible: missing column → unsigned dispatch (legacy SELECT fallback). Subscriber Node + Python verifier examples in `PRESENTATION_GOVERNANCE_ALERTS.md`.
- **Watchlist server-side presets (Sprint 10)** — `presentation_watchlist_presets` (migration `764`, partial unique index ensures one default per org). Three RBAC-gated endpoints: `GET/POST /governance/watchlist-presets`, `DELETE /governance/watchlist-presets/:id`. Pure validation service with `normalizePresetName`, `normalizePresetFilters`, `validatePresetCreateInput`. UI: toolbar dropdown in `PresentationGovernanceWatchlistView` with `Save current as preset…` / `Manage presets` / per-row delete + active preset chip with `(modified)` indicator. Default preset auto-applies on first mount. NAME_TAKEN errors surface inline. 13 unit tests.
- **Operations Health scoreboard (Sprint 10)** — `GET /api/presentations/operations/health?windowDays=N` (clamp 1..30, default 7). Pure service `buildOperationsHealthReport` aggregates 5 SLOs (`generation_success_rate`, `export_success_rate`, `p95_generation_latency_ms`, `agent_edit_success_rate`, `export_blocked_rate`) with status pills (`pass`/`at_risk`/`breach`/`inconclusive`), 4 job snapshots (retention/digest/CI/worker) with staleness flags, and 7-day alert dispatch volume. Schema-tolerant: missing tables → empty arrays + warnings, never 500. SuperAdmin tab `Operations Health` (icon `Activity`); auto-refresh 60s while visible + ok. Read-only — no client-side SLO recompute. 8 unit tests.
- **Subscriber onboarding wizard (Sprint 11)** — `POST /governance/alert-subscriptions/:id/rotate-secret` (one-time secret reveal, 64-hex via `generateSigningSecret`, audit log records rotate event without secret). `POST /governance/alert-subscriptions/:id/test-delivery` (synthetic transition, signed POST 5s timeout, returns typed `{ status, signed, httpStatus, signaturePreview, payloadPreview, durationMs }`; refuses unsigned fires; never writes to dispatch audit table). UI: SuperAdmin tab `Alert Subscriptions` (icon `BellRing`) with 4-step wizard (channel → target → severity → review), inline rotate confirmation + 60s auto-hide reveal, Test delivery panel with status-coded result. 14 unit tests.
- **Operations Health drill-down (Sprint 11)** — `GET /api/presentations/operations/health/slo/:sloId/drilldown?windowDays=30&bucketDays=1`. Pure aggregation `buildSloDrilldownReport` returns trend points (UTC midnight buckets), top 5 problematic decks per SLO, and 8 most-recent event samples with allow-listed excerpt phrases (no raw payload JSON). Frontend `OperationsHealthDrilldownPanel.tsx` is a right-side drawer with dependency-free SVG sparkline (`<polyline>` + hollow circles for inconclusive buckets), trend table, top decks list, samples list. Auto-refresh of parent scoreboard does NOT close the drill-down panel. SLO cards become `<button aria-pressed>` for keyboard navigation. 11 unit tests.
- **Watchlist preset transfer (Sprint 11)** — pure-frontend `presentationWatchlistPresetTransfer.ts` with `buildExportBundle` / `bundleToJson` / `parseImportJson` / `planImport`. Schema: `consultify.watchlist.preset.bundle.v1`; hard-cap 50 presets per bundle. UI extends Sprint 10 presets dropdown with `Export presets` (BOM-free JSON download) and `Import presets` (file picker → validate → preview `Will create N · Skip M duplicates · Reject K invalid` → explicit confirm). NEVER auto-imports. 17 unit tests with full round-trip + invalid-input coverage.
- **E2E governance loop smoke (Sprint 11)** — `tests/e2e/presentations-governance-loop.spec.ts` + `tests/e2e/fixtures/governance-loop-harness.html`. Self-contained static harness loaded via `file://` URL (no Vite/backend boot required). Drives 4-step scenario: deck `BLOCKED_P0` watchlist entry → worker dry-run dispatch counter → ops-health rollup `sent` → audit log `governance_alert_dispatched` row. 4 Playwright tests pass green in ~7-8s; deterministic, decoupled from app build.
- **Alert worker DB integration test (Sprint 12)** — `tests/integration/presentations/alert-worker.integration.test.ts` + `_helpers/alert-worker-pg-harness.ts`. Mirrors `confidentiality-controls.test.ts` style: `pgReachable()` precondition emits one stderr skip line + 5 tests still report green when no Postgres is configured. On CI with Postgres + migrations 762/763 applied, exercises full diff/dispatch/persist cycle: bootstrap suppression, second-cycle dispatch on new BLOCKED_P0, `signature_present` & algorithm when `signing_secret` set, `failures_in_a_row` increment on transient error, auto-pause with `paused_reason='too_many_failures'` after 5 consecutive failures. Worker script exports `__testHooks.watchlistOverrides` + `runSingleCycleForTest(orgId, opts)` for testability without changing CLI surface. Outbound webhooks stubbed via per-test `globalThis.fetch`.
- **Webhook playground (Sprint 12)** — `POST /governance/alerts/playground/dispatch` builds a synthetic signed payload (one-time secret reveal) and `POST /governance/alerts/playground/inbox` verifies it via `verifyInboxRequest`. Both routes are admin-gated and **decoupled from real subscriptions / dispatch audit table**. UI: `AlertPlaygroundTester` collapsible section at the bottom of `PresentationGovernanceAlertSubscriptionsView` with 2-step flow (generate → verify), Tamper toggle, Algorithm override dropdown, color-coded result banners (`verified`/`unsigned`/`missing_headers`/`parse_error`/`invalid_signature`/`mismatched_event`). Secret cleared from React state after 60s; never localStorage. 15 unit tests including HMAC-SHA1 rejection and event-id mismatch.
- **Operations Health PDF export (Sprint 12)** — `GET /operations/health/export?windowDays=N&format=html|pdf`. Pure HTML rendering via `renderOperationsHealthHtml` (inline CSS, `@page A4 portrait; margin: 12mm`, 3-column SLO grid, jobs table, alerts panel, conditional warnings, optional rotated diagonal watermark, footer with "Consultify Presentation Studio" + ©year + page tokens, "⌘P / Ctrl+P" banner). HTML-fallback approach chosen: existing PDF infra is `pdfkit` (deck-card layout engine, not HTML-to-PDF); `format=pdf` accepted as forward-compat with `X-Operations-Health-Format-Fallback: html` diagnostic header. Filename slugifies non-ASCII org names. Schema-tolerant via `loadOperationsHealthReport` shared helper. UI: `Export PDF` button in toolbar (`FileText` icon) right of auto-refresh, disabled when `status !== 'ok'`. 8 unit tests.
- **Cross-tab linkable URLs (Sprint 12)** — `presentationGovernanceDeepLinks.ts` pure service: `parseDashboardDeepLink`/`buildDashboardDeepLink`/`applyDashboardDeepLinkToLocation`/`readDashboardDeepLinkFromLocation`/`diffDeepLinkChanged`. URL params: `tab` (4-value enum), `deckId` (alphanumeric+`_-`, max 80), `slo` (5-value enum), `presetId`, `windowDays` (clamp 1..90). Stable key order. SSR-safe boundaries (no `window` → no-op). `SystemModule` reads URL on first mount, registers `popstate` listener (cleanup on unmount), writes via `replaceState` on tab change. Each presentation view (`Watchlist`/`OpsHealth`/`Telemetry`) accepts `deepLink?` prop with one-shot `useRef` guards. Watchlist `deckId` highlights row + smooth scroll + 5s auto-clear; `presetId` calls `applyPreset(...)`. OpsHealth `slo` auto-opens drill-down panel; `windowDays` seeds selector. Telemetry `deckId` prefills + triggers lookup. Backwards-compatible: legacy URLs without query params resolve to all-null state, default behavior preserved. 16 unit tests.
- **Real PDF rendering via Playwright (Sprint 13)** — `playwrightPdfRenderer.ts` lazy-imports `playwright` and lazy-launches a single shared chromium `Browser` (`headless: true, args: ['--no-sandbox']`). Never blocks server start. `isPlaywrightPdfRendererAvailable()` typed probe with 60s failure cache + concurrent probe de-dupe. `renderHtmlToPdf()` opens fresh `BrowserContext` + `Page` per call, `setContent(html, { waitUntil: 'networkidle' })`, then `page.pdf()` (A4 / printBackground / 12mm margins / scale 1.0). Hard `Promise.race` against `navigationTimeoutMs` default 10s. Fatal browser errors drop shared browser → next call relaunches. Missing chromium binary detected as `chromium_binary_missing` (recommend `npx playwright install chromium`). `presentationOperationsHealthPdfService.renderOperationsHealthPdf` probes availability and falls back to HTML on every failure mode. `/operations/health/export?format=pdf` now sends real `application/pdf` when chromium present, with `X-Operations-Health-Format: pdf` header; falls back to HTML with `X-Operations-Health-Format-Fallback: html` + `X-Operations-Health-Fallback-Reason` otherwise. Outer try/catch emits `pdf_renderer_crashed` fallback if renderer ever throws. 6 unit tests (skip-aware on chromium-less hosts, all 6 ran on dev box producing real `%PDF-`-prefixed buffers).
- **Subscriber-facing read-only dashboard (Sprint 13)** — Migration `765` adds `presentation_governance_subscriber_tokens` (UUID PK, sha256 token_hash UNIQUE, 8-char prefix, expires_at clamp 1..90 days, revoked_at column for Sprint 14+). `issueSubscriberDashboardToken(input)` admin helper: 64-hex random + sha256 hash persisted, raw token returned ONCE, schema-tolerant. `buildSubscriberDashboardSnapshot(input)` computes 7d/30d aggregates, `consecutiveFailures` from end of array, masks target (scheme + first 12 host chars + `****` + last 4) and deck IDs (first 4 chars + `****`). Health classification: `consecutiveFailures >= 10` → `unhealthy`, `>= 5` → `degraded`, `daysSinceRotation > 90` → `degraded` overdue, soft warning at >60 days. Two endpoints: `POST /governance/alert-subscriptions/:id/dashboard-tokens` (admin issuance, audit logs only prefix) + `GET /governance/subscriber/dashboard` (Bearer-only auth, generic 401s, registered ABOVE `verifyToken` middleware). Subscription-scoped strictly — never leaks across orgs. Signing-secret never echoed back; only `signature.algorithm` + `secretLastRotatedAt` + `daysSinceRotation`. 21 unit tests.
- **Watchlist saved searches (Sprint 13)** — Migration `766` adds `presentation_watchlist_saved_searches` (UUID PK, JSONB filters, partial unique index on default per org). Pure validation core (`normalizeSavedSearchName`/`QueryText`/`Filters`, `validateSavedSearchCreateInput`, `matchesSavedSearch`) reused by both server route and client filter pipeline. Three RBAC-gated endpoints: `GET /governance/watchlist/saved-searches`, `POST` (with status mapping invalid→400, name_conflict→409, storage_error→503), `DELETE /:id` (not_found→404). Plus fire-and-forget `POST /:id/mark-used` bookkeeping. `buildHighlightSegments(haystack, needle)` — literal `indexOf` (regex metachars safe), locale-aware case-insensitivity, `MAX_MATCHES = 50` cap, original casing preserved. UI: debounced (250ms) text input, Saved Searches dropdown with default auto-apply on first mount, "Save current as…" form, manage/delete with confirm, active-search chip with `(modified)` indicator, `<mark>`-based title highlighting in rendered table, honest "apply migration 766" banner when storage tier unavailable. 28 unit tests.
- **Operations Health anomaly detection (Sprint 13)** — Pure z-score detector `detectAnomaly`/`detectAnomaliesForReport` is direction-aware: success-rate SLOs flag drops only, latency / `export_blocked_rate` flag spikes only — improvements never anomalies. Defensive: <6 valid samples → `insufficient_data`, stdev <1e-4 → `insufficient_data`, null/NaN/Infinity current → `invalid_input`, NaN/Infinity baselines silently dropped, never throws. Tunable constants: `MIN_BASELINE_SAMPLES=6`, `MIN_BASELINE_STDEV=1e-4`, `MINOR_Z_THRESHOLD=2.5`, `MAJOR_Z_THRESHOLD=3.5`. Route layer builds 24×1h baseline buckets (same algebra as Sprint 11 drill-down), calls detector, emits one `presentation_runtime_events` row per detected `(orgId, sloId)` — throttled to 60min via `loadRecentAnomalySloIds` (defaults to "allow write" on schema-missing). Both `/operations/health` and `/operations/health/export` (HTML and PDF code paths) merge anomalies into JSON response AND inject "Anomalies" HTML section after SLO grid. UI: orange chip coexists with PASS/AT_RISK/BREACH pill — `bg-orange-500 text-white` for major, `bg-orange-100 text-orange-800` for minor, full reason in `aria-label`/`title`. Click anywhere on card opens existing Sprint 11/12 drill-down. 15 unit tests.

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
