-- FIN-06 — Finance-approved source (Investment Case / Statement Pack /
-- Valuation Recommendation) -> canonical Candidate (`initiative_candidates`,
-- F2 Skrzynka Kandydatów) with a durable, idempotent receipt.
--
-- Foundation only: this migration + `financeCandidateHandoffCore.ts` are the
-- shared plumbing three later Phase-2 adapters (one per Finance source type)
-- will call. No source-specific eligibility logic lives here.
--
-- Mirrors the ASM-08 / INT-08 / TLS-07 shape exactly (see
-- `20260802_asm008_candidate_handoff.sql`, `20260802_int008_candidate_handoff.sql`,
-- `20260802_tls007_swot_candidate_handoff.sql`) — this table is only the
-- HANDOFF RECEIPT: it records that a Finance source object was handed off,
-- which candidate row it produced, and gives a hard idempotency key so a
-- retried handoff call returns the same candidateId instead of inserting
-- twice. `initiative_candidates` (server/migrations/20260627_initiative_candidates.sql)
-- stays the single canonical writer target — reached only through
-- `createCandidateFromSource` (initiativeCandidateService.ts).
--
-- `source_type` deliberately has NO CHECK constraint, matching
-- `initiative_candidates.source_type`'s own unconstrained TEXT pattern —
-- Phase 2 will populate it with 'finance_investment_case' /
-- 'finance_statement_pack' / 'finance_valuation_recommendation' (added to
-- `DiscoverySourceType` in initiativeCandidateService.ts), and a future round
-- may add more Finance source types without a schema migration.
--
-- Dedupe key: (organization_id, source_type, source_id) — one handoff per
-- Finance source object, ever, per org.
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB): only
-- CREATE TABLE/INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.finance_candidate_handoffs (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,
    organization_id text NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    -- initiative_candidates.id — the canonical Candidate this handoff
    -- created (or found already existing on a retry).
    candidate_id text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- THE idempotency key: one handoff per (org, source_type, source_id) — a
-- retried handoff call for the same Finance source object must find this row
-- and return its candidate_id rather than creating a second candidate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin006_candidate_handoff_dedupe
    ON public.finance_candidate_handoffs (organization_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_fin006_candidate_handoff_candidate
    ON public.finance_candidate_handoffs (organization_id, candidate_id);
