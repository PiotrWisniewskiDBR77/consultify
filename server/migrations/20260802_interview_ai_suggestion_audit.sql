-- INT-04: durable, tenant-scoped provenance for Teresa answer suggestions.
BEGIN;

CREATE TABLE IF NOT EXISTS interview_ai_suggestion_audit (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    generated_by TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'interview_question_ai_suggest',
    model_id TEXT NOT NULL,
    provider TEXT,
    prompt_version TEXT NOT NULL,
    suggested_answer_text TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    confidence_score INTEGER NOT NULL,
    decision TEXT NOT NULL DEFAULT 'pending'
      CHECK (decision IN ('pending', 'accepted', 'rejected')),
    final_answer_text TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMPTZ,
    decided_by TEXT,
    FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interview_ai_suggestion_question
  ON interview_ai_suggestion_audit(organization_id, question_id, generated_at DESC);

COMMIT;
