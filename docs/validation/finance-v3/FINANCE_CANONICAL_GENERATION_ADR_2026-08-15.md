# Finance identity owner ADR (FIN-001)

Status: accepted for canonical integration.

The only canonical Finance identity is `finance_artifacts.artifact_id`, with
business lifecycle/version identity in `finance_business_versions.business_version_id`.
Legacy tables remain read-only migration sources. `finance_artifact_aliases` is the
only bridge; a legacy id is never passed directly to a canonical workspace.

`server/scripts/finance-v3-id-inventory.ts` is the release inventory. It starts a
PostgreSQL `READ ONLY` transaction, emits versioned JSON, classifies every active
legacy row as `MAPPED`, `UNRESOLVED`, `QUARANTINED`, or `DANGLING_ALIAS`, and exits
non-zero for unresolved/dangling identities. It never backfills. Writes require the
existing explicit `finance-v3-backfill-dry-run.ts run` operator path after review of
the inventory and quarantine reasons.

Results owns ROI Case, Forecast and append-only Actual. Finance owns canonical
statement/model/analysis/prediction/valuation values. Divergence is represented only
by `rvn_roi_finance_reconciliations`; Finance must not update any ROI Actual store.
The current 5% default materiality remains `PROVISIONAL_PENDING_OWNER_DECISION` and
therefore cannot be represented as final policy in a GO decision.
