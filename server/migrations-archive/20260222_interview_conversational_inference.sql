-- Migration: T013 Conversational + T016 Structured Insights

-- T013: Interview transcript messages
CREATE TABLE IF NOT EXISTS interview_transcript_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL,
    organization_id TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('user', 'ai', 'system')),
    content         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_msg_session ON interview_transcript_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transcript_msg_org ON interview_transcript_messages(organization_id);

-- T013: AI parse tracking (audit trail for draft→apply flow)
CREATE TABLE IF NOT EXISTS interview_ai_parse_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL,
    organization_id TEXT NOT NULL,
    input_text      TEXT,
    output_json     JSONB,
    applied         BOOLEAN DEFAULT FALSE,
    applied_at      TIMESTAMPTZ,
    applied_by      TEXT,
    tokens_used     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_parse_log_session ON interview_ai_parse_log(session_id);

-- T016: Add structured content columns to interview_insights
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS structured_content JSONB;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS evidence_links JSONB DEFAULT '[]'::JSONB;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS unknowns JSONB DEFAULT '[]'::JSONB;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS counterpoints JSONB DEFAULT '[]'::JSONB;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS assumptions JSONB DEFAULT '[]'::JSONB;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS confidence_score INTEGER;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS inference_run_id TEXT;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS insight_category TEXT;

-- T016: Inference runs tracking
CREATE TABLE IF NOT EXISTS interview_inference_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    project_id      TEXT,
    session_ids     JSONB DEFAULT '[]'::JSONB,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    insights_count  INTEGER DEFAULT 0,
    tokens_used     INTEGER DEFAULT 0,
    generation_time_ms INTEGER,
    error_message   TEXT,
    created_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inference_run_org ON interview_inference_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_inference_run_project ON interview_inference_runs(project_id);
