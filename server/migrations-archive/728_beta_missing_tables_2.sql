-- Migration 728: Additional missing tables for beta modules (decisions, AI actions, interview evidence)

CREATE TABLE IF NOT EXISTS decision_impacts (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    impacted_type TEXT NOT NULL,
    impacted_id TEXT NOT NULL,
    impact_description TEXT,
    is_blocker BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS decision_stakeholders (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    organization_id TEXT,
    user_id TEXT NOT NULL,
    user_name TEXT,
    role TEXT NOT NULL,
    notify_on_create BOOLEAN DEFAULT TRUE,
    notify_on_update BOOLEAN DEFAULT TRUE,
    notify_on_decision BOOLEAN DEFAULT TRUE,
    notify_on_escalation BOOLEAN DEFAULT TRUE,
    notified_at TEXT,
    acknowledged_at TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS decision_votes (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote TEXT NOT NULL,
    comment TEXT,
    voted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
    UNIQUE(decision_id, user_id)
);

CREATE TABLE IF NOT EXISTS decision_history (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    details TEXT,
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    project_id TEXT,
    action_type TEXT,
    payload TEXT,
    draft_content TEXT,
    required_policy_level TEXT,
    current_policy_level TEXT,
    requires_approval BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'PENDING',
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_evidence (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    question_id TEXT,
    evidence_type TEXT NOT NULL DEFAULT 'document',
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,
    url TEXT,
    uploaded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    storage_backend TEXT DEFAULT 'db',
    storage_key TEXT,
    file_size_bytes INTEGER,
    content_hash TEXT,
    virus_scan_status TEXT DEFAULT 'pending',
    virus_scan_at TIMESTAMPTZ,
    retention_until TIMESTAMPTZ,
    evidence_role TEXT DEFAULT 'supporting',
    transcript_text TEXT,
    ingest_to_knowledge BOOLEAN DEFAULT TRUE,
    knowledge_document_id TEXT,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_decision_impacts_decision ON decision_impacts(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_stakeholders_decision ON decision_stakeholders(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_votes_decision ON decision_votes(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_history_decision ON decision_history(decision_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_user ON ai_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_org ON ai_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_actions(status);
CREATE INDEX IF NOT EXISTS idx_interview_evidence_session ON interview_evidence(session_id);
