-- P10 Interview Insight artifact persistence and permissions
-- Purpose:
--  - Persist findings, evidence pointers, handoffs, and audit log for Interview Insights
--  - Enforce canonical bounded handoff / evidence-ledger semantics
--  - Extend Interview Insights permissions for review / publish / handoff actions

-- These governance tables historically lived only in excluded 000 baselines.
-- Establish their canonical minimum before inserting module permissions.
CREATE TABLE IF NOT EXISTS permissions (
    key TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    category TEXT,
    icon TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    permission_key TEXT NOT NULL REFERENCES permissions(key),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_key)
);

CREATE TABLE IF NOT EXISTS interview_insight_findings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    insight_id TEXT NOT NULL,
    source_section_type TEXT NOT NULL DEFAULT 'manual',
    source_section_index INTEGER,
    source_key TEXT,
    finding_statement TEXT NOT NULL,
    confidence_level TEXT NOT NULL DEFAULT 'insufficient',
    limits_text TEXT NOT NULL,
    limits_json TEXT DEFAULT '[]',
    next_action_text TEXT NOT NULL,
    next_action_json TEXT DEFAULT '[]',
    review_status TEXT NOT NULL DEFAULT 'draft',
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_insight_findings_org
    ON interview_insight_findings(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_findings_insight
    ON interview_insight_findings(insight_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_findings_review
    ON interview_insight_findings(review_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_insight_findings_source_key
    ON interview_insight_findings(insight_id, source_key);

CREATE TABLE IF NOT EXISTS interview_insight_evidence_pointers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    insight_id TEXT NOT NULL,
    finding_id TEXT NOT NULL,
    pointer_type TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    source_fingerprint TEXT NOT NULL,
    captured_excerpt TEXT,
    captured_at TIMESTAMP NOT NULL,
    pointer_state TEXT NOT NULL DEFAULT 'active',
    removal_reason TEXT,
    removed_at TIMESTAMP,
    duplicate_observed_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_insight_evidence_org
    ON interview_insight_evidence_pointers(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_evidence_finding
    ON interview_insight_evidence_pointers(finding_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_evidence_state
    ON interview_insight_evidence_pointers(pointer_state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_insight_evidence_dedupe
    ON interview_insight_evidence_pointers(finding_id, source_ref, source_fingerprint);

CREATE TABLE IF NOT EXISTS interview_insight_handoffs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    insight_id TEXT NOT NULL,
    finding_id TEXT NOT NULL,
    target_kind TEXT NOT NULL DEFAULT 'initiative',
    target_id TEXT,
    target_ref_type TEXT NOT NULL DEFAULT 'handoff_request',
    status TEXT NOT NULL DEFAULT 'pending',
    payload_json TEXT NOT NULL,
    operator_decision_json TEXT DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_insight_handoffs_org
    ON interview_insight_handoffs(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_handoffs_finding
    ON interview_insight_handoffs(finding_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_handoffs_target
    ON interview_insight_handoffs(target_kind, target_id);

CREATE TABLE IF NOT EXISTS interview_insight_audit_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    insight_id TEXT NOT NULL,
    finding_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    action TEXT NOT NULL,
    actor_user_id TEXT,
    detail_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_insight_audit_org
    ON interview_insight_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_audit_insight
    ON interview_insight_audit_log(insight_id);
CREATE INDEX IF NOT EXISTS idx_interview_insight_audit_finding
    ON interview_insight_audit_log(finding_id);

INSERT INTO permissions (key, description, category) VALUES
    ('INTERVIEW_INSIGHTS_REVIEW', 'Review interview insights findings and evidence', 'INTERVIEW'),
    ('INTERVIEW_INSIGHTS_PUBLISH', 'Publish interview insights artifacts', 'INTERVIEW'),
    ('INTERVIEW_INSIGHTS_HANDOFF', 'Create bounded handoff from interview insights', 'INTERVIEW')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (id, role, permission_key, description) VALUES
    ('rp_interview_insights_review_pm', 'PROJECT_MANAGER', 'INTERVIEW_INSIGHTS_REVIEW', 'Review interview insights'),
    ('rp_interview_insights_publish_pm', 'PROJECT_MANAGER', 'INTERVIEW_INSIGHTS_PUBLISH', 'Publish interview insights'),
    ('rp_interview_insights_handoff_pm', 'PROJECT_MANAGER', 'INTERVIEW_INSIGHTS_HANDOFF', 'Handoff interview findings'),
    ('rp_interview_insights_review_admin', 'ADMIN', 'INTERVIEW_INSIGHTS_REVIEW', 'Review interview insights'),
    ('rp_interview_insights_publish_admin', 'ADMIN', 'INTERVIEW_INSIGHTS_PUBLISH', 'Publish interview insights'),
    ('rp_interview_insights_handoff_admin', 'ADMIN', 'INTERVIEW_INSIGHTS_HANDOFF', 'Handoff interview findings'),
    ('rp_interview_insights_review_super', 'SUPERADMIN', 'INTERVIEW_INSIGHTS_REVIEW', 'Review interview insights'),
    ('rp_interview_insights_publish_super', 'SUPERADMIN', 'INTERVIEW_INSIGHTS_PUBLISH', 'Publish interview insights'),
    ('rp_interview_insights_handoff_super', 'SUPERADMIN', 'INTERVIEW_INSIGHTS_HANDOFF', 'Handoff interview findings')
ON CONFLICT DO NOTHING;
