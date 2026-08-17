-- 20261008_closure_evidence_snapshot_and_immutability.sql
-- FLOW-CLOSURE-EVIDENCE-INTEGRITY-002 (corrective port onto canonical).
--
-- The last file in the chain, and the only one that installs the append-only
-- guard. Two earlier mistakes are corrected here by construction rather than
-- patched, so neither can recur:
--
-- MISTAKE 1 — A CONSTRAINT WITH A CLOCK IN IT.
--   The snapshot requirement first shipped with an exemption for rows whose
--   `source_captured_at` predated a fixed date. That date lay in the FUTURE, so
--   every row the running system wrote satisfied the exemption and the
--   constraint enforced nothing. Verified against a live database: a brand-new
--   `meeting_note` with no snapshot inserted successfully.
--
--   The exemption now names the rows it grandfathers explicitly, at migration
--   time, and nothing written afterwards can claim it.
--
-- MISTAKE 2 — A GUC IS NOT AN AUTHORIZATION.
--   Because the backfill had to write to a table an earlier migration had
--   already made append-only, the guard was taught to open for a session that
--   had set `closure_evidence.migration_operation`, and deletion for one that
--   had set `closure_evidence.retention_operation`. A GUC is not a privilege:
--   ANY session holding UPDATE/DELETE rights — including the application's own
--   pool — could set either value for itself and walk straight through. Those
--   doors are gone. There is no setting, in any session, that makes this table
--   writable after the fact.
--
--   Ordering is what makes that affordable: the backfill below runs while the
--   ledger is still mutable, and the guard goes on immediately afterwards.
--
--   Removing evidence is consequently NOT an application operation at all. A
--   genuine legal-retention or erasure obligation needs a privileged database
--   role and an operator workflow, decided separately; it is deliberately not
--   reachable from anything that serves a request.

-- ---------------------------------------------------------------------------
-- 1. The explicit exemption marker.
-- ---------------------------------------------------------------------------
ALTER TABLE initiative_closure_evidence
  ADD COLUMN IF NOT EXISTS snapshot_exempt BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN initiative_closure_evidence.snapshot_exempt IS
  'True ONLY for computed-hash rows that predate this migration and therefore never had a snapshot captured. Set once, here, while the ledger is still mutable; forced to false on every insert thereafter and unreachable by any later UPDATE.';

-- ---------------------------------------------------------------------------
-- 2. One-time backfill: stamp exactly the rows that exist right now.
--
-- Runs BEFORE the guard exists, which is the only reason it can run at all —
-- and the reason no escape hatch is needed for it. On a fresh install it
-- touches nothing; on an upgrade it stamps the historical rows and nothing else
-- will ever be stamped again.
-- ---------------------------------------------------------------------------
UPDATE initiative_closure_evidence
   SET snapshot_exempt = true
 WHERE evidence_type IN ('meeting_note', 'meeting_follow_up', 'notebook_page', 'tool_output')
   AND source_snapshot_json IS NULL
   AND snapshot_exempt = false;

-- ---------------------------------------------------------------------------
-- 3. New rows can never be exempt.
--
-- A BEFORE INSERT trigger rather than a CHECK, because the goal is not to reject
-- an insert that asks for the exemption but to make the request meaningless:
-- whatever the caller supplies, the stored value is false.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION initiative_closure_evidence_force_no_exemption()
RETURNS TRIGGER AS $$
BEGIN
  NEW.snapshot_exempt := false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_initiative_closure_evidence_no_exemption
  ON initiative_closure_evidence;

CREATE TRIGGER trg_initiative_closure_evidence_no_exemption
  BEFORE INSERT ON initiative_closure_evidence
  FOR EACH ROW EXECUTE FUNCTION initiative_closure_evidence_force_no_exemption();

-- ---------------------------------------------------------------------------
-- 4. The snapshot rule, with no clock in it.
--
-- `tool_output` is in this list even though it was originally classified as a
-- source carrying its own cryptographic identity. It is not: its declared digest
-- is FNV-1a over 64 bits — a change detector — so the ledger computes its own
-- sha256 and stores the snapshot, exactly as it does for meetings and notebook
-- pages. `method_output` stays out; its `content_hash` is a real sha256.
-- ---------------------------------------------------------------------------
ALTER TABLE initiative_closure_evidence
  DROP CONSTRAINT IF EXISTS initiative_closure_evidence_snapshot_check;

ALTER TABLE initiative_closure_evidence
  ADD CONSTRAINT initiative_closure_evidence_snapshot_check
  CHECK (
    evidence_type NOT IN ('meeting_note', 'meeting_follow_up', 'notebook_page', 'tool_output')
    OR snapshot_exempt
    OR source_snapshot_json IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 5. Immutability, installed last and with no exceptions.
--
-- UPDATE and DELETE are both refused unconditionally. No session variable, no
-- role check inside the function, no "authorized operation" branch: a guard that
-- consults a setting the caller controls is decoration.
--
-- What this deliberately leaves reachable is DDL — TRUNCATE, DROP, disabling the
-- trigger — all of which require ownership of the table. That is the point: the
-- boundary is a database privilege the application role does not hold, rather
-- than a value the application can assign itself.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION initiative_closure_evidence_append_only_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'initiative_closure_evidence is append-only: evidence rows cannot be modified'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'initiative_closure_evidence is append-only: evidence rows cannot be deleted'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_initiative_closure_evidence_append_only
  ON initiative_closure_evidence;

CREATE TRIGGER trg_initiative_closure_evidence_append_only
  BEFORE UPDATE OR DELETE ON initiative_closure_evidence
  FOR EACH ROW EXECUTE FUNCTION initiative_closure_evidence_append_only_guard();
