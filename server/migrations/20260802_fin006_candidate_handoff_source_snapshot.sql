-- FIN-06 — retrofit: structured, source-type-agnostic value snapshot on the
-- EXISTING `finance_candidate_handoffs` receipt table (migration
-- `20260802_fin006_candidate_handoff.sql`). No new table, no new source
-- types — this is purely an additive column on the one receipt table the
-- three Finance source adapters (Investment Case / Statement Pack /
-- Valuation Recommendation) already write to.
--
-- Per the explicit Codex correction for this packet: FIN-06 must never
-- RECOMPUTE a financial figure and must never silently substitute 0/null for
-- a value the source does not have. `source_snapshot` is the durable,
-- structured place that invariant is enforced — every key is either a real
-- value read straight off the source row/JSONB blob, or the literal string
-- 'unknown' (see `FinanceCandidateSourceSnapshot` /
-- `unknownIfMissing()` in `financeCandidateHandoffCore.ts`).
--
-- `jsonb` (not a set of typed columns) because the shape is intentionally
-- shared across three structurally different source tables
-- (`financial_models`, `financial_statement_packs`, `valuations.advisory`)
-- with no common relational schema to hang typed columns off.
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB): only
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.finance_candidate_handoffs
  ADD COLUMN IF NOT EXISTS source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
