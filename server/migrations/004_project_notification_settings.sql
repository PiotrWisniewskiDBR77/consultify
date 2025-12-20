-- MED-04: Project Notification Settings
-- Per-project notification configuration

CREATE TABLE IF NOT EXISTS project_notification_settings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    -- Task notifications
    task_overdue_enabled INTEGER DEFAULT 1,
    task_due_soon_enabled INTEGER DEFAULT 1,
    task_blocked_enabled INTEGER DEFAULT 1,
    -- Decision notifications
    decision_pending_enabled INTEGER DEFAULT 1,
    decision_escalation_enabled INTEGER DEFAULT 1,
    -- Phase notifications
    phase_transition_enabled INTEGER DEFAULT 1,
    gate_blocked_enabled INTEGER DEFAULT 1,
    -- Initiative notifications
    initiative_at_risk_enabled INTEGER DEFAULT 1,
    -- Escalation settings
    escalation_days INTEGER DEFAULT 3,
    escalation_email_enabled INTEGER DEFAULT 0,
    -- Email digest settings
    email_daily_digest INTEGER DEFAULT 0,
    email_weekly_summary INTEGER DEFAULT 0,
    -- Metadata
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pns_project_id ON project_notification_settings(project_id);
