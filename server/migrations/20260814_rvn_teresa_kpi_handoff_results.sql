-- KPI-E006 — real migration for `teresa_handoff_results`.
--
-- Design: docs/product/results-vnext/KPI_E006_TERESA_DESIGN.md §C. This is
-- the one table the 3 new KPI handoff handlers in teresaCopilotService.ts
-- actually write to via `recordTeresaKpiHandoffResult` (§B).
--
-- DEVIATION FROM DESIGN (documented, not a design change): the design's own
-- text says "verify exact existing column set/types against
-- ensureTeresaTables() before writing". Doing that verification surfaced a
-- fact the design didn't anticipate: `teresa_handoff_results` (together with
-- `teresa_proposals`/`teresa_audit_log`, which the design explicitly leaves
-- untouched) is ALREADY present in a real, already-applied migration —
-- `server/migrations/20260719_baseline_gap.sql` (a schema-drift catch-up
-- snapshot) — with `CREATE TABLE IF NOT EXISTS "public"."teresa_handoff_results"`
-- (id/proposal_id/organization_id/target_module/result_ref/created_at, all
-- TEXT except created_at) plus PK (`teresa_handoff_results_pkey`) and FK
-- (`teresa_handoff_results_proposal_id_fkey` -> teresa_proposals(id), added
-- `NOT VALID` then `VALIDATE CONSTRAINT` later in the same file) added by
-- separate statements further down that same file. So this table is NOT
-- migration-less today. This migration is written anyway, per the task
-- brief, as a self-contained no-op safety net for KPI-E006 specifically —
-- matching `ensureTeresaTables()` (server/src/services/v8/teresaCopilotService.ts)
-- and `20260719_baseline_gap.sql` column-for-column, so `IF NOT EXISTS` /
-- `DO $$ ... EXCEPTION WHEN duplicate_object/duplicate_table THEN NULL END $$`
-- guards make it inert on every environment (fresh DB with only this
-- migration, fresh DB with the full chain, or a demo DB where the table was
-- self-provisioned at runtime by `ensureTeresaTables()`).
--
-- Column types intentionally follow the EXISTING runtime shape (TEXT
-- `created_at`, nullable `result_ref`), not the design draft's proposed
-- `TIMESTAMPTZ`/`NOT NULL` — this migration must match what's already there,
-- not introduce a second, incompatible shape for the same table name.

CREATE TABLE IF NOT EXISTS teresa_handoff_results (
  id               TEXT PRIMARY KEY,
  proposal_id          TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  target_module         TEXT NOT NULL,
  result_ref           TEXT,
  created_at           TEXT NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teresa_handoff_results_proposal_id_fkey'
  ) THEN
    -- Guarded rather than a bare inline REFERENCES: `teresa_proposals` is
    -- self-provisioned by `ensureTeresaTables()` at runtime (see design §C,
    -- "left untouched") and is ALSO already created earlier in
    -- `20260719_baseline_gap.sql` — but a fresh DB that runs ONLY this
    -- migration in isolation (e.g. a future targeted migration-subset tool)
    -- would otherwise fail with "relation teresa_proposals does not exist".
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'teresa_proposals'
    ) THEN
      ALTER TABLE teresa_handoff_results
        ADD CONSTRAINT teresa_handoff_results_proposal_id_fkey
        FOREIGN KEY (proposal_id) REFERENCES teresa_proposals(id);
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_teresa_handoff_results_proposal
  ON teresa_handoff_results(proposal_id);
CREATE INDEX IF NOT EXISTS idx_teresa_handoff_results_org_module
  ON teresa_handoff_results(organization_id, target_module);
