-- M02-P16b: request-bound idempotency for POST /api/ai/agent-plan/:id/run.
--
-- Follow-up to 941 (execution lease). 941's claimExecution() CAS already
-- makes duplicate STEP execution safe once a background job actually runs
-- (proven locally: two concurrent claimExecution() calls on the same plan,
-- exactly one wins). This column closes a narrower gap one layer up: a
-- client retry/double-click on POST /:id/run, made *before* either request's
-- background job has run claimExecution, would otherwise pass the route's
-- `status === 'planning'` guard twice, call replaceSteps() twice (which has
-- no CAS guard of its own — DELETE+INSERT, not idempotent under a race), and
-- enqueue two AGENT_BACKGROUND_TASK jobs.
--
-- Additive and replay-safe: nullable column, no backfill, no constraint.
ALTER TABLE ai_agent_plans
  ADD COLUMN IF NOT EXISTS run_idempotency_key TEXT;
