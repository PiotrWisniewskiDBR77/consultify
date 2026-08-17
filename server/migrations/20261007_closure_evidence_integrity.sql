-- 20261007_closure_evidence_integrity.sql
-- FLOW-CLOSURE-EVIDENCE-INTEGRITY-002 (corrective port onto canonical).
--
-- Corrects two integrity gaps in the closure-evidence ledger:
--
--   1. RETENTION. Evidence was reachable by ON DELETE CASCADE from the closure
--      request, the initiative and the organization. "Append-only" that a
--      parent delete can erase is not append-only — an accidental initiative
--      cleanup silently destroyed the record of why something was closed.
--   2. HASH SHAPE. `source_hash` accepted any non-empty string.
--
-- It also adds the snapshot column that 20261008 makes mandatory. The column is
-- separated from its constraint on purpose: an upgrade that stops between the
-- two files is merely un-enforced, never wrongly enforced.
--
-- Additive and forward-only: one nullable column, tightened constraints, and
-- foreign keys changed from CASCADE to RESTRICT. No row is rewritten, and this
-- file installs no trigger — immutability goes on last, in 20261008.

-- ---------------------------------------------------------------------------
-- 1. Canonical minimal snapshot, for independent verification.
--
-- Needed by the family whose hash this application COMPUTES. For those sources
-- the ledger previously stored a hash and a reference but no content, so once
-- the source row was edited or deleted nobody could check what the hash had
-- attested to.
--
-- `method_output` is exempt: its `content_hash` is a genuine sha256 produced by
-- `MethodOutputService` over frozen rows, so its own table is the system of
-- record and copying the payload here would duplicate that record rather than
-- protect one. `tool_output` looks like the same case and is NOT — see 20261008.
-- ---------------------------------------------------------------------------
ALTER TABLE initiative_closure_evidence
  ADD COLUMN IF NOT EXISTS source_snapshot_json JSONB;

-- ---------------------------------------------------------------------------
-- 2. A hash is a hash.
-- ---------------------------------------------------------------------------
ALTER TABLE initiative_closure_evidence
  DROP CONSTRAINT IF EXISTS initiative_closure_evidence_source_hash_shape_check;

ALTER TABLE initiative_closure_evidence
  ADD CONSTRAINT initiative_closure_evidence_source_hash_shape_check
  CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$');

-- ---------------------------------------------------------------------------
-- 3. Parents may no longer erase evidence.
--
-- RESTRICT, not CASCADE: deleting an initiative or a closure request that has
-- evidence is now an error the caller must handle deliberately, instead of a
-- silent loss. Removing evidence is a retention decision taken by an operator
-- with privileges the application does not hold — not a side effect of tidying
-- up a parent row, and not something a session can grant itself.
-- ---------------------------------------------------------------------------
ALTER TABLE initiative_closure_evidence
  DROP CONSTRAINT IF EXISTS initiative_closure_evidence_closure_request_id_fkey;
ALTER TABLE initiative_closure_evidence
  ADD CONSTRAINT initiative_closure_evidence_closure_request_id_fkey
  FOREIGN KEY (closure_request_id) REFERENCES initiative_closure_requests(id) ON DELETE RESTRICT;

ALTER TABLE initiative_closure_evidence
  DROP CONSTRAINT IF EXISTS initiative_closure_evidence_initiative_id_fkey;
ALTER TABLE initiative_closure_evidence
  ADD CONSTRAINT initiative_closure_evidence_initiative_id_fkey
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE RESTRICT;

ALTER TABLE initiative_closure_evidence
  DROP CONSTRAINT IF EXISTS initiative_closure_evidence_organization_id_fkey;
ALTER TABLE initiative_closure_evidence
  ADD CONSTRAINT initiative_closure_evidence_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
