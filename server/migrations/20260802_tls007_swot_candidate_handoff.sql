-- TLS-07 — governed SWOT recommendation -> canonical Initiative Candidate.
-- The receipt is the durable, idempotent lineage edge. Candidate creation and
-- receipt insertion are committed in one pinned PostgreSQL transaction.

CREATE TABLE IF NOT EXISTS public.swot_candidate_handoffs (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,
    organization_id text NOT NULL,
    tool_session_id text NOT NULL,
    recommendation_id text NOT NULL,
    candidate_id text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tls007_swot_candidate_handoff_dedupe
    ON public.swot_candidate_handoffs
    (organization_id, tool_session_id, recommendation_id);

CREATE INDEX IF NOT EXISTS idx_tls007_swot_candidate_handoff_candidate
    ON public.swot_candidate_handoffs (organization_id, candidate_id);
