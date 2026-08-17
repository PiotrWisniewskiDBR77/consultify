-- 952_interview_public_distribution_answers.sql
-- Package A (Claude F2 cross-flow runtime build) — public, token-bound respondent writes.
--
-- Until now an external respondent could only READ an invite
-- (`GET /public/distributions/:token`); there was no public write path at all,
-- so the "invite → response" half of the interview chain was structurally
-- unreachable. This migration adds the minimum durable state that path needs.
--
-- Additive and forward-only: no DROP, no DELETE, no rewrite of existing rows.
-- Old readers are unaffected — every column added here is nullable.

-- (1) Provenance: which invite produced this answer.
--     Deliberately NOT storing IP or user agent. The respondent is external and
--     usually unauthenticated; the distribution id is already an internal
--     identifier that the public GET exposes, so it leaks nothing new, while IP
--     or UA would introduce personal data into a table that has no retention
--     policy of its own.
ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS answered_via_distribution_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'interview_questions_answered_via_distribution_fkey'
  ) THEN
    ALTER TABLE interview_questions
      ADD CONSTRAINT interview_questions_answered_via_distribution_fkey
      FOREIGN KEY (answered_via_distribution_id)
      REFERENCES interview_distributions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interview_questions_answered_via_distribution
  ON interview_questions (answered_via_distribution_id)
  WHERE answered_via_distribution_id IS NOT NULL;

-- (2) Idempotency ledger for public writes.
--     A respondent on a flaky mobile connection retries; without a durable
--     idempotency key a retry is indistinguishable from a second, different
--     answer. The UNIQUE constraint is the enforcement point — application code
--     is not trusted to be the only writer.
--
--     `request_fingerprint` stores a hash of the semantic payload so that the
--     SAME key with a DIFFERENT payload is a detectable collision (409) rather
--     than a silently replayed success.
CREATE TABLE IF NOT EXISTS interview_public_answer_receipts (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  -- RESTRICT, not CASCADE, and deliberately so. These rows attest that an
  -- external party wrote something through this invite. CASCADE would either
  -- destroy that trail together with the invite, or — because the table is
  -- append-only at the trigger level — make the cascade itself fail with a
  -- confusing "append-only" error on an unrelated DELETE. RESTRICT states the
  -- real rule plainly: an invite that has been used cannot be deleted.
  distribution_id   TEXT NOT NULL REFERENCES interview_distributions(id) ON DELETE RESTRICT,
  session_id        TEXT NOT NULL,
  question_id       TEXT NOT NULL,
  idempotency_key   TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  answered_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resulting_updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_public_answer_receipt_key
  ON interview_public_answer_receipts (organization_id, distribution_id, question_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_interview_public_answer_receipt_distribution
  ON interview_public_answer_receipts (distribution_id, answered_at DESC);

-- (3) Receipts are an audit record of an external party's action: append-only.
--     Enforced by the database, not by service-layer discipline, because the
--     service is not the only thing with a connection string.
CREATE OR REPLACE FUNCTION interview_public_answer_receipt_guard()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'interview_public_answer_receipts is append-only (attempted %)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_interview_public_answer_receipt_guard ON interview_public_answer_receipts;
CREATE TRIGGER trg_interview_public_answer_receipt_guard
  BEFORE UPDATE OR DELETE ON interview_public_answer_receipts
  FOR EACH ROW EXECUTE FUNCTION interview_public_answer_receipt_guard();
