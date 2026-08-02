-- ASM-08 — Candidate Pack Handoff: accepted/current immutable Assessment
-- Output → canonical Candidate (`initiative_candidates`, F2 Skrzynka
-- Kandydatów) with a durable, idempotent receipt.
--
-- Deliberately NOT a new candidate table/service — `initiative_candidates`
-- (server/migrations/20260627_initiative_candidates.sql) stays the single
-- canonical writer target. This table is only the HANDOFF RECEIPT: it
-- records that assessment X's accepted output Y was handed off, which
-- candidate row it produced, and gives a hard idempotency key so a retried
-- handoff call returns the same candidateId instead of inserting twice.
--
-- Distinct source_type on the candidate row itself
-- ('assessment_accepted_output', set by the service, not by this migration)
-- deliberately does NOT reuse the existing generic 'assessment' source_type
-- that F2's periodic scanForCandidates() already writes for ANY assessment
-- lacking an initiative (see initiativeCandidateService.ts loadDiscoveryArtifacts)
-- — reusing 'assessment' would collide with that unrelated, non-acceptance-
-- gated flow under the same (organization_id, source_type, source_id) dedup
-- key F2 already relies on.
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB): only
-- CREATE TABLE/INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.assessment_candidate_handoffs (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,
    organization_id text NOT NULL,
    assessment_id text NOT NULL,
    -- assessment_accepted_snapshots.id — the specific accepted output this
    -- handoff was produced from (provenance, never re-derived after write).
    output_id text NOT NULL,
    -- assessment_quality_reviews.id — the accept decision that produced the
    -- output above (further provenance chain).
    review_id text,
    -- initiative_candidates.id — the canonical Candidate this handoff
    -- created (or found already existing on a retry).
    candidate_id text NOT NULL,
    source_type text NOT NULL DEFAULT 'assessment_accepted_output',
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- THE idempotency key: one handoff per (org, assessment) — a retried
-- handoff call for the same assessment must find this row and return its
-- candidate_id rather than creating a second candidate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_asm_candidate_handoff_org_assessment
    ON public.assessment_candidate_handoffs (organization_id, assessment_id);

CREATE INDEX IF NOT EXISTS idx_asm_candidate_handoff_candidate
    ON public.assessment_candidate_handoffs (organization_id, candidate_id);
