-- MAT-010 — dedicated operation-claims table (consolidated final form).
--
-- ── WHY THIS IS ONE CLEAN FILE, NOT TWO ────────────────────────────────────
-- Two earlier iterations of this idea existed only on this local,
-- never-pushed/merged/deployed branch:
--   * `20260802c_mat010_claim_lease_fencing.sql` (REMOVED) added
--     `record_kind`/`claim_token`/`lease_expires_at` columns directly onto
--     `artifact_lineage_pending_events`, making a claim a row in the SAME
--     table the reconciler scans, distinguished only by a column value.
--     Rejected on review: a claim living in the outbox table is one missed
--     WHERE clause away from the reconciler treating an in-flight claim as
--     a completed business event.
--   * `20260802d_mat010_operation_claims_table.sql` (REMOVED) reverted the
--     three columns off `artifact_lineage_pending_events` and created this
--     table instead — the correct end state, reached via an add-then-drop
--     sequence across two files.
-- Since neither file was ever applied to any deployed/shared database
-- (confirmed: this branch has zero pushes, merges, or deploys across its
-- entire history), replaying that add-then-drop sequence has no value and
-- is actively confusing to a reader of the migration history. This ONE file
-- is the safe, final, consolidated form: a fresh schema creates this table
-- directly and `artifact_lineage_pending_events` is NEVER touched by MAT-010
-- claim work at all, at any point.
--
-- ── WHAT THIS TABLE IS ─────────────────────────────────────────────────────
-- The operation-claim mechanism (see `operationClaimService.ts`) is
-- structurally separate from the lineage outbox
-- (`artifact_lineage_pending_events`/`artifact_lineage_events`, unchanged by
-- this file). A claim answers "has this operation_key already run its
-- business mutation, and if not, may I be the one to run it?" — an entirely
-- different question from "does a lineage event need to be durably
-- recorded" — and the two now live in different tables, not different
-- column values in one table.
--
-- Columns:
--   organization_id + operation_key — tenant-scoped identity.
--     `operation_key` reuses the SAME `deriveRequestBoundIdempotencyKey(...)`
--     value already used for the lineage event's own idempotency key,
--     one derivation, not two competing schemes. `UNIQUE(organization_id,
--     operation_key)` is the fresh-acquire single-winner mechanism.
--   owner_token — opaque, reissued on every fresh acquire AND every reclaim.
--   fencing_token — a Kleppmann-style monotonically increasing `BIGINT`,
--     starts at 1, incremented by exactly 1 on reclaim, never on fresh
--     acquire, and NEVER on a lease renewal/heartbeat (renewal only extends
--     `lease_expires_at`, see `renewOperationClaimLease` — bumping fencing
--     on renewal would be indistinguishable from a reclaim to a caller
--     holding the pre-renewal token). A finalize or renewal call must
--     present BOTH `owner_token` and `fencing_token`; a stale pair
--     (superseded by reclaim) can never match the row again.
--   lease_expires_at — bounded expiry, evaluated by POSTGRES's own `NOW()`
--     at every write and compare — never the application process's clock.
--   state — 'active' vs 'completed' (TERMINAL — every reclaim/finalize/
--     renew predicate requires `state = 'active'`; nothing ever transitions
--     `'completed'` back).
--   completed_result_id — the canonical business result's OWN owner-table id
--     (e.g. a `document_version_snapshots.version_id`) — deliberately NOT a
--     lineage event id, so "exactly one canonical result per operation_key"
--     stays recoverable even in the rare case the lineage layer's own
--     durability genuinely fails.
--
-- ── FRESH-DB GUARD ─────────────────────────────────────────────────────────
-- This table has no foreign keys and no dependency on any other MAT-010
-- migration, so it is order-independent relative to
-- `20260802_mat010_artifact_lineage.sql` / `20260802_mat010_lineage_pending_events.sql`.
-- Every statement is `IF NOT EXISTS` / `DROP-then-ADD` for the constraint,
-- so re-running this file is a safe no-op — verified via an actual
-- `migrate.postgres.ts --safe` run against a DROP'd + re-CREATE'd empty
-- database, and via a literal second raw execution of this file's SQL
-- against an already-migrated database, not by assumption.

CREATE TABLE IF NOT EXISTS artifact_lineage_operation_claims (
  claim_id             TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL,
  operation_key        TEXT NOT NULL,
  owner_token          TEXT NOT NULL,
  fencing_token        BIGINT NOT NULL,
  lease_expires_at     TIMESTAMP NOT NULL,
  state                TEXT NOT NULL DEFAULT 'active',
  completed_result_id  TEXT,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The single-row-per-operation guarantee: a fresh acquire is
-- `INSERT ... ON CONFLICT (organization_id, operation_key) DO NOTHING`
-- against this index, giving exactly one winner across any number of
-- concurrent first-acquire attempts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_lineage_claims_operation
  ON artifact_lineage_operation_claims(organization_id, operation_key);

-- The reclaim scan: which active claims are past their lease. Partial so it
-- never grows with completed (terminal) rows.
CREATE INDEX IF NOT EXISTS idx_artifact_lineage_claims_active_lease
  ON artifact_lineage_operation_claims(organization_id, lease_expires_at)
  WHERE state = 'active';

ALTER TABLE artifact_lineage_operation_claims
  DROP CONSTRAINT IF EXISTS artifact_lineage_claims_state_check;
ALTER TABLE artifact_lineage_operation_claims
  ADD CONSTRAINT artifact_lineage_claims_state_check
  CHECK (state IN ('active', 'completed'));
