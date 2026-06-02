-- P10 Interview Insight candidate findings + review triage
-- Purpose:
--  - Persist candidate findings as the governed working layer before publishable P10 findings
--  - Support review triage actions without creating a parallel truth object

CREATE TABLE IF NOT EXISTS interview_insight_candidates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    insight_id TEXT NOT NULL,
    source_section_type TEXT NOT NULL DEFAULT 'manual',
    source_section_index INTEGER,
    source_key TEXT,
    candidate_statement TEXT NOT NULL,
    rationale_text TEXT NOT NULL,
    confidence_hint TEXT NOT NULL DEFAULT 'insufficient',
    triage_status TEXT NOT NULL DEFAULT 'candidate',
    followup_type TEXT NOT NULL DEFAULT 'investigate',
    followup_recommendation TEXT NOT NULL,
    linked_finding_id TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_insight_candidates_org
    ON interview_insight_candidates(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_candidates_insight
    ON interview_insight_candidates(insight_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_candidates_status
    ON interview_insight_candidates(triage_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_insight_candidates_source_key
    ON interview_insight_candidates(insight_id, source_key);
