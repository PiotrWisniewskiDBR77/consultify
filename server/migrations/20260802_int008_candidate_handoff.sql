-- INT-08 — Interview (submission or insight-finding) accepted output →
-- canonical Candidate (`initiative_candidates`, F2 Skrzynka Kandydatów) with
-- a durable, idempotent receipt + lineage.
--
-- Deliberately NOT a new candidate table/service — reuses the same
-- `createCandidateFromSource` writer added for ASM-08 (see commit
-- e80a01eca3, cherry-picked onto this branch). This table is only the
-- HANDOFF RECEIPT: it records that an interview submission (or an accepted
-- insight finding) was handed off, which candidate row it produced, and
-- gives a hard idempotency key so a retried handoff returns the same
-- candidateId instead of inserting twice.
--
-- Two distinct source_type values, set by the service (not this migration):
--   'interview_submission'      — sourceId = interview_assignments.id
--   'interview_insight_finding' — sourceId = interview_insight_findings.id
-- Deliberately NOT reusing F2's own auto-scan source_type 'interview_insight'
-- (initiativeCandidateService.ts loadDiscoveryArtifacts/scanForCandidates
-- already writes that value automatically for ANY interview_insights row
-- lacking an initiative, independent of any manager-accept gate — reusing it
-- here would collide with that unrelated, non-approval-gated flow).
--
-- Dedupe key: (organization_id, source_type, accepted_snapshot_id).
-- `accepted_snapshot_id` is a composite string the service builds to
-- identify the SPECIFIC immutable version being handed off (assignment +
-- latest submission batch timestamp for the submission path; insight +
-- finding + finding updated_at for the insight path) — a legitimate new
-- submission of the same assignment (return -> resubmit -> re-approve)
-- produces a DIFFERENT accepted_snapshot_id and is allowed to become a new
-- candidate; a retry of the SAME accepted snapshot is not.
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB): only
-- CREATE TABLE/INDEX IF NOT EXISTS.

-- The active fresh-Postgres baseline lacks this legacy answer-contract field,
-- while accepted Interview snapshots and their fixtures use it explicitly.
ALTER TABLE IF EXISTS interview_questions
    ADD COLUMN IF NOT EXISTS is_required INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.interview_candidate_handoffs (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,
    organization_id text NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    -- Best-effort provenance — nullable where the source concept doesn't
    -- cleanly carry it (see service doc-comments).
    interview_session_id text,
    submission_id text,
    insight_id text,
    -- The dedupe-relevant version marker (see header comment).
    accepted_snapshot_id text NOT NULL,
    -- initiative_candidates.id — the canonical Candidate this handoff
    -- created (or found already existing on a retry).
    candidate_id text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- THE idempotency key: one handoff per (org, source_type, accepted snapshot).
CREATE UNIQUE INDEX IF NOT EXISTS idx_int_candidate_handoff_dedupe
    ON public.interview_candidate_handoffs (organization_id, source_type, accepted_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_int_candidate_handoff_source
    ON public.interview_candidate_handoffs (organization_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_int_candidate_handoff_candidate
    ON public.interview_candidate_handoffs (organization_id, candidate_id);
