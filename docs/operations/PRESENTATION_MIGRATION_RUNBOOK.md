# Presentation Pipeline Migration Runbook

> **Status:** authoritative for Consultify presentation pipeline migrations (Sprint 1 → Sprint 14, Epic I3).
> **Owners:** Backend lead · Ops/SRE · Product (when user-visible).
> **Companion artifacts:**
> - Service: `server/src/services/presentationMigrationDryRunService.ts`
> - CLI: `server/scripts/presentation-migration-dry-run.ts` (`npm run migrate:dry-run`, `npm run migrate:rollback-check`)
> - Sign-off template: `docs/operations/PRESENTATION_MIGRATION_SIGN_OFF_TEMPLATE.md`
> - Existing rollout doc: `docs/product/PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md`

---

## 1. Purpose

The Presentation Artifact Engine touches lifecycle-critical surfaces: deck integrity, governance verdicts, audit ledger, outbound webhook signing, subscriber dashboards, template lifecycle. A bad migration there has multi-tenant blast radius and is observable to customers.

This runbook formalizes the contract every presentation migration must honor:

1. **Pre-flight is mandatory.** Every migration ships with a dry-run report + DB snapshot.
2. **Rollback path is declared up-front.** No migration is "reversible" without a documented rollback strategy.
3. **Sign-off is auditable.** Every prod application is recorded in `presentation_migration_reports` and a sign-off ledger entry under `docs/operations/sign-off/`.
4. **Dry-run is read-only.** The CLI and service never connect to the DB and never mutate state — they consume the catalog + caller estimates and emit a deterministic report.

If you cannot satisfy these four points, the migration is BLOCKED.

---

## 2. Migration Catalog

The canonical source of truth is `PRESENTATION_MIGRATION_CATALOG` in `server/src/services/presentationMigrationDryRunService.ts`. The table below mirrors it for operator quick-reference. **Future presentation migrations require a corresponding catalog entry — there is no implicit registration.**

| ID | Category | Risk | Reversible | Rollback Strategy | Affected Tables | Description |
|----|----------|------|------------|-------------------|-----------------|-------------|
| `760_presentation_legacy_normalization` | `data_normalize` | **P0** | yes | `restore_snapshot` | `presentation_decks`, `presentation_migration_reports` | Normalizes legacy `deck_json`/`unified_json` into the canonical schema. Data-touching; full rollback only via pre-migration snapshot. |
| `761_presentation_runtime_events` | `schema_alter` | P2 | yes | `drop_columns` | `presentation_runtime_events` | Telemetry table + indexes used by runtime/governance/ops-health surfaces. |
| `762_presentation_governance_alerts` | `schema_alter` | **P1** | yes | `drop_columns` | `presentation_governance_alert_subscriptions`, `presentation_governance_alert_dispatches` | Outbound governance alert subscriptions + dispatch ledger. Customer-visible (webhook/Slack delivery). |
| `763_presentation_governance_alert_signing` | `schema_alter` | **P1** | yes | `drop_columns` | alerts subscriptions/dispatches + `presentation_governance_alert_worker_state` | HMAC signing-secret + signature columns + alert worker state. Security-relevant. |
| `764_presentation_watchlist_presets` | `schema_alter` | P2 | yes | `drop_columns` | `presentation_watchlist_presets` | Server-side persistence of governance watchlist filter presets. |
| `765_presentation_governance_subscriber_tokens` | `schema_alter` | **P1** | yes | `drop_columns` | `presentation_governance_subscriber_tokens` | Subscriber-facing read-only dashboard tokens (sha256 hash, 8-char prefix, expiry). Security-relevant. |
| `766_presentation_watchlist_saved_searches` | `schema_alter` | P2 | yes | `drop_columns` | `presentation_watchlist_saved_searches` | Named saved-search persistence for the governance watchlist. |
| `767_presentation_template_governance` | `schema_alter` | **P0** | yes | `drop_columns` | `presentation_templates`, `presentation_template_audit` | Template registry lifecycle gate (draft/approved/deprecated) + lineage chain. Audit data preserved in `presentation_template_audit`. |

Risk tiers:

- **P0** — lifecycle/data integrity. Backend lead + ops sign-off mandatory.
- **P1** — security or customer-visible delivery surfaces. Backend lead + ops sign-off mandatory.
- **P2** — additive feature surfaces. Backend lead sign-off; ops review optional.

---

## 3. Pre-flight (per migration)

Run for **every** environment, not only prod.

1. **Snapshot the database.** Use the env-appropriate tool (`pg_dump`, managed snapshot, etc.). Record the snapshot timestamp and storage URI in the sign-off doc.
2. **Run the dry-run** against staging-equivalent inputs:

   ```bash
   npm run migrate:dry-run -- \
     --migrations 760,767 \
     --organization-id org_123 \
     --estimated-deck-count 1500 \
     --report-file ./migration-dry-run.json
   ```

3. **Review the dry-run report** with the engineer applying the migration and the ops lead. Resolve every entry in the `Blockers` list before continuing.
4. **Validate the rollback strategy.** For `restore_snapshot`, confirm a fresh snapshot was taken in step 1 *and* that the snapshot is restorable on this environment.
5. **Run the rollback check** to materialize the per-migration rollback checklist:

   ```bash
   npm run migrate:rollback-check -- --migrations 760,767
   ```

6. **Commit the dry-run JSON** to the deploy PR (`docs/operations/sign-off/<date>-<migration_id>.dry-run.json`).

---

## 4. Apply procedure (per environment)

Promote in the canonical order: `dev → staging → preprod → prod`. Each environment must satisfy section 3 before promotion.

### 4.1 Dev

```bash
npm run db:migrate          # picks up new SQL files in server/migrations/
```

Smoke: hit the endpoints in section 4 of `PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md`. No formal sign-off required — but the dry-run report still must be committed.

### 4.2 Staging

1. Apply against a freshly-restored staging snapshot first (do **not** apply to live staging until the snapshot run is green).
2. `npm run db:migrate:staging`.
3. Run the manual smoke ids referenced from the manual backlog (`MT-PRES-XXX` series). Record run ids.
4. Sign-off: backend lead.

### 4.3 Preprod

1. Comms freeze in `#consultify-deploy`.
2. Apply with `npm run db:migrate:strict` (no `--safe` fallback).
3. Run the Sprint 11 E2E governance loop smoke (`tests/e2e/presentations-governance-loop.spec.ts`). Must be green.
4. Sign-off: backend lead + ops.

### 4.4 Prod

1. Schedule during the published low-traffic window.
2. Page on-call ops.
3. Take fresh DB snapshot (do **not** reuse the staging snapshot).
4. Apply with `npm run db:migrate:strict`.
5. Run the Sprint 14 K3 audit integrity check (`npm run audit:integrity`).
6. Sign-off: backend lead + ops + product (when user-visible).

---

## 5. Post-flight verification

For each migration, run the catalog `postCheck` queries on the target environment. Record the result row counts in the sign-off doc.

| Category | Verification |
|----------|--------------|
| `schema_alter` | Columns/indexes present (`information_schema.columns`, `pg_indexes`); constraints active. |
| `data_normalize` | Per-row report (`presentation_migration_reports`) matches expected `total/normalized/skipped/failed` counts. `lineage_root_id` populated where required. |
| `index_create` | `EXPLAIN` shows new index used by representative query. |
| `data_backfill` | Pre/post counts match (delta = expected backfill). Spot-check 5 affected rows for correctness. |

Post-flight observability:

- No new `BLOCKED_P0` decks introduced (governance watchlist).
- No spike in `export_blocked` runtime events.
- No spike in audit integrity gaps (`npm run audit:integrity`).
- Operations Health scoreboard stays `pass`/`at_risk` (no `breach`).

---

## 6. Rollback procedures

Pick the strategy that matches the catalog entry. **Never invent a strategy on the fly.** If the situation does not match the documented strategy, escalate to ops lead.

### 6.1 `drop_columns`

Used when the migration only added columns/tables. Data loss is bounded to the new columns.

```sql
BEGIN;
-- Example for migration 762 (governance alerts):
DROP TABLE IF EXISTS presentation_governance_alert_dispatches;
DROP TABLE IF EXISTS presentation_governance_alert_subscriptions;
COMMIT;
```

For column-level rollback (e.g. migration 763 signing columns):

```sql
ALTER TABLE presentation_governance_alert_subscriptions DROP COLUMN IF EXISTS signing_secret;
ALTER TABLE presentation_governance_alert_dispatches DROP COLUMN IF EXISTS signature_present;
ALTER TABLE presentation_governance_alert_dispatches DROP COLUMN IF EXISTS signature_algorithm;
```

After dropping, redeploy the previous backend tag so service code does not reference removed columns. Schema-tolerant code paths must also revert.

### 6.2 `restore_snapshot`

Used for `data_normalize` migrations (currently only `760`). Last-resort path; assumes a snapshot was taken in step 3.1.

1. Stop ingest (toggle the maintenance flag, refuse `POST /api/presentations/decks`).
2. Restore the snapshot to the target DB (managed-snapshot console or `pg_restore`).
3. Re-deploy the previous backend tag.
4. Reopen ingest only after `npm run audit:integrity` is clean.

### 6.3 `manual_review`

No automated rollback. Convene backend lead + ops + product within 30 minutes; produce a written rollback plan; record it in the sign-off doc before executing.

### 6.4 `not_applicable`

The migration cannot be rolled back automatically (e.g. an irreversible data conversion). The forward path is to ship a corrective migration. Document the corrective ticket in the sign-off doc; do not attempt manual SQL surgery.

---

## 7. Sign-off requirements

Each migration applied to **staging or higher** requires a sign-off doc filled from `PRESENTATION_MIGRATION_SIGN_OFF_TEMPLATE.md`. Required reviewers:

| Risk | Backend lead | Ops/SRE | Product |
|------|--------------|---------|---------|
| P0 | required | required | required if user-visible |
| P1 | required | required | required if user-visible |
| P2 | required | optional | optional |

Sign-off docs live in `docs/operations/sign-off/<YYYY-MM-DD>-<migration_id>.md` and are committed alongside the deploy PR.

---

## 8. Communication

- **Internal:** post the dry-run report summary + planned apply window in `#consultify-deploy`. Update the same thread with the post-flight result and (if triggered) rollback status.
- **External:** if the migration could cause customer-visible degradation (queue pause, webhook delivery delay, dashboard read-only window), update the public status page **before** the apply window opens.

---

## 9. Audit trail

- All migrations are recorded in `presentation_migration_reports` (table introduced by migration 760). The CLI does not write to it directly; the actual apply path (`server/scripts/normalize-legacy-presentation-decks.ts`, `db:migrate*` scripts) is responsible.
- The dry-run report JSON must be committed to the deploy PR for every migration applied to staging or higher.
- The sign-off doc must be merged before the prod apply window opens.

If the audit trail is incomplete (missing dry-run report or missing sign-off), the apply is **BLOCKED** even if the dry-run recommendation is `PROCEED`.

---

## 10. Future work

- Automated post-migration smoke that runs the relevant subset of `MT-PRES-*` tests on staging immediately after apply.
- Automatic snapshot rotation tied to the dry-run CLI (so the pre-flight snapshot is taken by the same command that produces the report).
- Migration test environment that replays migrations against a sanitized prod snapshot on every PR touching `server/migrations/76*.sql`.
- Catalog drift check: a CI step that fails when a new `server/migrations/76*.sql` exists without a matching `PRESENTATION_MIGRATION_CATALOG` entry.
