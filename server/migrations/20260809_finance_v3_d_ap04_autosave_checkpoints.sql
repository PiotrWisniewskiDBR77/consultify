-- Finance v3 — Gate D (AP-04): undo/autosave/conflict-resolution checkpoint columns.
--
-- Source: docs/validation/finance-v3/generated/gate-d/AP-04_undo_autosave_conflicts_ADR.md,
-- docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md section 8
-- (WorkspaceState.unsavedOperationStack), docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md
-- section 3 point 4 ("Undo/redo i draft recovery: session-level stack, atomowe cofniecie
-- bulk/paste, autosave, Sync/Saved/Conflict oraz crash/refresh recovery").
--
-- Additive only, one ALTER TABLE. `finance_working_revisions` (WP-B01, migration
-- 20260809_finance_v3_b01_core_artifacts.sql) already has `crash_recovery_checkpoint BOOLEAN`
-- (default false) and `content_semantic_hash TEXT` — this migration does NOT re-derive or
-- duplicate that mechanism (CLAUDE.md hard rule: "finance_working_revisions juz istnieje z
-- realnym schematem ... Twoja praca uzywa go, nie tworzy rownoleglego mechanizmu").
--
-- What was missing for AP-04's checkpoint to actually round-trip client state: a place to
-- store the SERIALIZED unsaved OperationStack itself (AP-00's WorkspaceState.unsavedOperationStack,
-- server/src/types/finance/WorkspaceState.ts) and a discriminator for WHY a given checkpoint row
-- was written (periodic autosave vs an explicit user save vs a crash-recovery restore
-- acknowledgement) — `crash_recovery_checkpoint` alone answers "is this a checkpoint, not an
-- explicit commit" but not "what produced it", which crashRecoveryService.ts needs to find the
-- most recent EXPLICIT_SAVE row to diff against.

BEGIN;

ALTER TABLE finance_working_revisions
  ADD COLUMN IF NOT EXISTS checkpoint_payload JSONB;

ALTER TABLE finance_working_revisions
  ADD COLUMN IF NOT EXISTS checkpoint_source TEXT
    CHECK (checkpoint_source IN ('AUTOSAVE', 'EXPLICIT_SAVE', 'CRASH_RECOVERY_RESTORE'));

COMMENT ON COLUMN finance_working_revisions.checkpoint_payload IS
  'AP-04: JSON-serialized { unsavedOperationStack: FinanceUnsavedOperationStackEntry[] } captured at '
  'checkpoint time (server/src/types/finance/WorkspaceState.ts). NULL for pre-AP-04 rows (T1 create, '
  'T12 reopen) which never went through checkpointOperationStack().';

COMMENT ON COLUMN finance_working_revisions.checkpoint_source IS
  'AP-04: AUTOSAVE (periodic debounced write) | EXPLICIT_SAVE (user-initiated save, or the '
  'acknowledge-and-discard step after a crash-recovery prompt) | CRASH_RECOVERY_RESTORE (the '
  'client accepted a recovery prompt and re-checkpointed the restored stack). NULL for pre-AP-04 rows.';

-- Fast "does this artifact have a dangling autosave checkpoint newer than its last explicit
-- save" lookup (crashRecoveryService.detectRecoverableCheckpoint) without a full table scan.
CREATE INDEX IF NOT EXISTS idx_finance_wr_artifact_checkpoint_source
  ON finance_working_revisions (artifact_id, organization_id, revision_seq DESC)
  WHERE checkpoint_source IS NOT NULL;

COMMIT;
