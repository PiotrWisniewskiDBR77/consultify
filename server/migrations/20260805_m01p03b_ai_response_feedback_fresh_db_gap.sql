-- M01-P03B — fresh-db gap: `ai_response_feedback` table.
--
-- `ai_response_feedback` is the REAL runtime write target of
-- POST /api/ai-feedback/response (server/src/services/ai/adaptiveResponseService.ts
-- `processFeedback()`), which is the actual path a chat message thumbs
-- up/down rating goes through end to end:
--   InlineResponseFeedback.tsx -> feedbackLearningService.submitFeedback()
--   -> Api.aiFeedback() -> POST /api/ai-feedback/response
--   -> adaptiveResponseService.processFeedback()
--   -> INSERT INTO ai_response_feedback (...)
--
-- The table's sole prior producer, server/migrations/add_response_feedback.sql,
-- is EXCLUDED from the canonical Postgres migration flow by
-- server/scripts/migrate.postgres.ts's `isSqliteOnlyMigration()` heuristic:
-- any filename starting with "add_" is treated as legacy/seed-like and
-- skipped outright (see that function's `f.startsWith('add_')` branch) —
-- confirmed against a live Postgres catalog on a fresh `--safe` migration
-- run (2026-08-05): `\d ai_response_feedback` -> "Did not find any relation".
--
-- Without this table, EVERY real user's thumbs rating throws
-- `relation "ai_response_feedback" does not exist`, caught by the route's
-- try/catch, and returns a 500 "Failed to submit response feedback" — the
-- message-feedback flow was completely broken end to end on any
-- canonically-migrated Postgres database, not merely missing the GET-side
-- hydration join that finding M01-036 originally flagged. See
-- M01-P03B packet report for the full trace.
--
-- This migration is purely additive and idempotent (CREATE TABLE/INDEX IF
-- NOT EXISTS). It does not modify, replace, or supersede
-- add_response_feedback.sql, which stays excluded from the Postgres runner
-- (its trigger/view use SQLite `BEGIN...END` trigger syntax, invalid on
-- Postgres) and is left untouched.
--
-- Scope note: `add_response_feedback.sql` also defines `user_ai_profiles`,
-- a satisfaction-score view, and an update trigger. Only the table this
-- packet's owned surface (POST /api/ai-feedback/response persistence +
-- GET /api/conversations/:id hydration) actually reads/writes —
-- `ai_response_feedback` — is reproduced here. `user_ai_profiles` and the
-- trigger/view are a separate, still-open gap (GET /api/ai-feedback/response/
-- preferences and /response/stats both read from tables that are equally
-- absent on a fresh Postgres run) — out of this packet's scope, flagged in
-- the M01-P03B report for follow-up.

CREATE TABLE IF NOT EXISTS ai_response_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    conversation_id TEXT,

    -- Core feedback
    rating TEXT CHECK (rating IN ('positive', 'negative', 'neutral')),

    -- Length assessment
    length_feedback TEXT CHECK (length_feedback IN ('too_short', 'just_right', 'too_long')),

    -- Detail assessment
    detail_feedback TEXT CHECK (detail_feedback IN ('needs_more_detail', 'good_detail', 'too_detailed')),

    -- Format assessment
    format_feedback TEXT CHECK (format_feedback IN ('needs_structure', 'good_format', 'too_complex')),

    -- What user wanted
    wanted_mode TEXT CHECK (wanted_mode IN ('quick', 'standard', 'deepStudy')),

    -- Free-form feedback
    custom_feedback TEXT,

    -- Context
    response_mode_used TEXT CHECK (response_mode_used IN ('quick', 'standard', 'deepStudy')),
    response_length_actual INTEGER,
    capability_used TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key (matches add_response_feedback.sql's original constraint)
    CONSTRAINT fk_ai_response_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reconcile databases where the legacy producer created the table with the
-- old `response_mode` / `capability` names. CREATE TABLE IF NOT EXISTS alone
-- is insufficient there: the application writes the canonical *_used names
-- and would otherwise return HTTP 500 despite this migration being recorded
-- as successfully applied.
ALTER TABLE ai_response_feedback
  ADD COLUMN IF NOT EXISTS response_mode_used TEXT
    CHECK (response_mode_used IN ('quick', 'standard', 'deepStudy'));
ALTER TABLE ai_response_feedback
  ADD COLUMN IF NOT EXISTS capability_used TEXT;

-- Indexes carried over from add_response_feedback.sql
CREATE INDEX IF NOT EXISTS idx_response_feedback_user ON ai_response_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_rating ON ai_response_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_response_feedback_created ON ai_response_feedback(created_at);

-- New index added by M01-P03B: GET /api/conversations/:id hydration
-- (conversations.routes.ts) filters `WHERE message_id IN (...) AND user_id = ?`
-- on every conversation open — this is the lookup path that index serves.
CREATE INDEX IF NOT EXISTS idx_response_feedback_message ON ai_response_feedback(message_id);
