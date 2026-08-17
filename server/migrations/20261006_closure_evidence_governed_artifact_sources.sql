-- 20260924_closure_evidence_governed_artifact_sources.sql
-- FLOW-MEETING-NOTEBOOK-INITIATIVE-EVIDENCE-001, second wave.
--
-- Closes the remaining qualifying evidence sources: a frozen consulting-tool
-- output and a frozen method output.
--
-- `initiative_lifecycle_gate_decisions` was evaluated and WITHDRAWN — see the
-- reasoning block in `closureEvidenceSourceReader.ts`. In short: a CLOSURE-domain
-- decision as evidence for a closure request is circular, the table is a declared
-- owner table of three other in-flight packages, and it is immutable and UNIQUE
-- per initiative, so a fixture for it can never be corrected in place.
--
-- These two differ from the meeting/notebook family in one important way:
-- they already CARRY their own content identity, produced by the system that
-- froze them (`content_hash`, plus a monotonic version and, for one of them, a
-- supersede chain). The application therefore adopts the
-- declared hash verbatim instead of computing a second, competing one for the
-- same artefact.
--
-- Additive and forward-only: the CHECK is widened, no column is added, no row
-- is rewritten, and both existing unique indexes plus the append-only guard
-- introduced in 20260923 apply unchanged to the new types.

ALTER TABLE initiative_closure_evidence
  DROP CONSTRAINT IF EXISTS initiative_closure_evidence_evidence_type_check;

ALTER TABLE initiative_closure_evidence
  ADD CONSTRAINT initiative_closure_evidence_evidence_type_check
  CHECK (evidence_type IN (
    -- row-backed: the referenced row's terminal state is its identity
    'task', 'milestone', 'decision',
    -- hash-computed: editable after becoming eligible, so the app pins a hash
    'meeting_note', 'meeting_follow_up', 'notebook_page',
    -- hash-bearing: the source declares its own frozen content identity
    'tool_output', 'method_output'
  ));

-- Pinned identity is mandatory for every source-backed type, old and new.
ALTER TABLE initiative_closure_evidence
  DROP CONSTRAINT IF EXISTS initiative_closure_evidence_source_identity_check;

ALTER TABLE initiative_closure_evidence
  ADD CONSTRAINT initiative_closure_evidence_source_identity_check
  CHECK (
    evidence_type NOT IN (
      'meeting_note', 'meeting_follow_up', 'notebook_page',
      'tool_output', 'method_output'
    )
    OR (source_hash IS NOT NULL AND source_captured_at IS NOT NULL)
  );
