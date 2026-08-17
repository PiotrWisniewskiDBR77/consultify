-- 20260923_closure_evidence_meeting_notebook_sources.sql
-- FLOW-MEETING-NOTEBOOK-INITIATIVE-EVIDENCE-001
--
-- Lets an approved Meeting note, a closed Meeting follow-up and a mature
-- Notebook page be attached to an Initiative closure request as evidence,
-- through the SAME canonical table and the SAME single writer that already
-- serves task/milestone/decision. No parallel evidence store is introduced.
--
-- Additive and forward-only. Nothing is rewritten: every column added here is
-- nullable, both existing unique indexes are left untouched, and the three
-- legacy evidence types keep behaving exactly as before.
--
-- WHY `meeting_record` IS NOT ADDED AS A FOURTH TYPE
-- --------------------------------------------------
-- The brief allows it only "if the meeting record itself has durable,
-- versioned content qualifying as evidence". It does not. `meetings` has no
-- version table, no content hash and no approval state for its body; its
-- `decisions_json` is appended verbatim in place by a route with no approval
-- gate (`meetingService.ts:369`), which this repo's own legacy-cutover
-- registry records as an ungoverned writer. Pinning an exact version of
-- something with no version identity would be a fiction, so the type is
-- deliberately left out.

-- ---------------------------------------------------------------------------
-- 1. Widen the evidence-type domain.
-- ---------------------------------------------------------------------------
ALTER TABLE initiative_closure_evidence
  DROP CONSTRAINT IF EXISTS initiative_closure_evidence_evidence_type_check;

ALTER TABLE initiative_closure_evidence
  ADD CONSTRAINT initiative_closure_evidence_evidence_type_check
  CHECK (evidence_type IN (
    'task', 'milestone', 'decision',
    'meeting_note', 'meeting_follow_up', 'notebook_page'
  ));

-- ---------------------------------------------------------------------------
-- 2. Exact source identity, pinned at attach time.
--
-- The three legacy types point at rows whose terminal state IS their identity:
-- a task is 'done', a decision is 'approved', and neither is expected to keep
-- changing. The three new sources are documents that remain editable after the
-- state that makes them eligible, so "this note proves the initiative closed"
-- is only meaningful if it names the exact content it was attached to.
--
-- `source_version_id` holds a real immutable version row where one exists
-- (`notebook_page_versions`); `source_hash` always holds a canonical sha256 of
-- the content that was attached. Both are nullable so the existing rows and the
-- three legacy types are untouched.
-- ---------------------------------------------------------------------------
ALTER TABLE initiative_closure_evidence
  ADD COLUMN IF NOT EXISTS source_version_id TEXT;

ALTER TABLE initiative_closure_evidence
  ADD COLUMN IF NOT EXISTS source_hash TEXT;

ALTER TABLE initiative_closure_evidence
  ADD COLUMN IF NOT EXISTS source_captured_at TIMESTAMPTZ;

-- Document-backed evidence MUST carry its pinned hash. Legacy types must not be
-- forced to grow one retroactively, so the requirement is scoped by type — this
-- is a forward rule, not a history rewrite.
ALTER TABLE initiative_closure_evidence
  DROP CONSTRAINT IF EXISTS initiative_closure_evidence_source_identity_check;

ALTER TABLE initiative_closure_evidence
  ADD CONSTRAINT initiative_closure_evidence_source_identity_check
  CHECK (
    evidence_type NOT IN ('meeting_note', 'meeting_follow_up', 'notebook_page')
    OR (source_hash IS NOT NULL AND source_captured_at IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 3. Append-only guard.
--
-- Evidence is an assertion about the past; it may not be edited or quietly
-- removed. The DELETE branch is conditional on purpose:
--
--   * a DIRECT delete (the closure request still exists) is refused;
--   * a delete arriving as an ON DELETE CASCADE from a parent that is itself
--     being removed is allowed through.
--
-- Without that distinction an unconditional guard would make every parent row
-- permanently undeletable and would surface as a confusing "append-only" error
-- on an unrelated `DELETE FROM initiatives`. The behaviour was verified
-- empirically against this schema, not assumed: PostgreSQL removes the parent
-- row before running the RI cascade, so inside this BEFORE DELETE trigger the
-- parent is already invisible.
--
-- Source deletion is a separate matter and needs no rule here: this table holds
-- NO foreign key to meetings, meeting_notes, meeting_follow_ups or
-- notebook_pages — `evidence_ref_id` is a plain text reference — so deleting a
-- source cannot reach the evidence at all.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- IMMUTABILITY IS NOT INSTALLED HERE — see 20261008.
--
-- An earlier arrangement of these migrations created the append-only guard at
-- this point and then, three files later, needed to stamp the pre-existing rows
-- with a snapshot exemption. That UPDATE was refused by the very guard installed
-- here, which was then "solved" by teaching the guard to open for a session that
-- set a GUC — an escape hatch any application session holding UPDATE rights
-- could set for itself, i.e. no authorization at all.
--
-- The ordering is the fix. Nothing mutates evidence until the ledger is
-- populated and marked, and the guard that goes on last has no door in it.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_closure_evidence_source_identity
  ON initiative_closure_evidence (evidence_type, evidence_ref_id, source_hash)
  WHERE source_hash IS NOT NULL;
