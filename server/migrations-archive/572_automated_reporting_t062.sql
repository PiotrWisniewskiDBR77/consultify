-- ============================================
-- Migration 572: Automated Reporting (T062)
-- Adds event-triggered scheduling, trigger rules,
-- throttling, deliverable types, and trigger fire log
-- ============================================

-- Extend report_schedules with schedule_type and deliverable_type
ALTER TABLE report_schedules ADD COLUMN schedule_type TEXT DEFAULT 'time_based';
-- 'time_based' | 'event_triggered' | 'hybrid'

ALTER TABLE report_schedules ADD COLUMN deliverable_type TEXT DEFAULT 'report';
-- 'report' | 'presentation' | 'both'

ALTER TABLE report_schedules ADD COLUMN scope_type TEXT DEFAULT 'organization';
-- 'organization' | 'portfolio' | 'project' | 'initiative'

ALTER TABLE report_schedules ADD COLUMN scope_id TEXT;

ALTER TABLE report_schedules ADD COLUMN description TEXT;

-- Extend schedule_executions with trigger info
ALTER TABLE schedule_executions ADD COLUMN trigger_type TEXT;
-- 'cron' | 'delay_threshold' | 'risk_high' | 'budget_threshold' | 'milestone_reached' | 'artifact_approved' | 'manual'

ALTER TABLE schedule_executions ADD COLUMN trigger_reason TEXT;

ALTER TABLE schedule_executions ADD COLUMN deliverable_type TEXT DEFAULT 'report';

ALTER TABLE schedule_executions ADD COLUMN generated_presentation_id TEXT;

-- ============================================
-- SCHEDULE TRIGGER RULES
-- Defines conditions for event-triggered schedules
-- ============================================

CREATE TABLE IF NOT EXISTS schedule_trigger_rules (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    -- 'delay_threshold' | 'risk_high' | 'budget_threshold' | 'milestone_reached' | 'artifact_approved'
    conditions_json TEXT DEFAULT '{}',
    -- e.g., {"threshold": 90, "severity": "critical", "delayDays": 5}
    is_active BOOLEAN DEFAULT true,
    throttle_hours INTEGER DEFAULT 24,
    -- max 1 fire per throttle_hours per project per trigger type
    last_fired_at TIMESTAMP,
    fire_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (schedule_id) REFERENCES report_schedules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trigger_rules_schedule ON schedule_trigger_rules(schedule_id);
CREATE INDEX IF NOT EXISTS idx_trigger_rules_type ON schedule_trigger_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_trigger_rules_active ON schedule_trigger_rules(is_active);

-- ============================================
-- TRIGGER FIRE LOG
-- Tracks every trigger evaluation and fire for audit and throttling
-- ============================================

CREATE TABLE IF NOT EXISTS trigger_fire_log (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    scope_type TEXT,
    scope_id TEXT,
    project_id TEXT,
    fired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    signal_data_json TEXT DEFAULT '{}',
    execution_id TEXT,
    throttled BOOLEAN DEFAULT false,

    FOREIGN KEY (schedule_id) REFERENCES report_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES schedule_trigger_rules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trigger_fire_schedule ON trigger_fire_log(schedule_id);
CREATE INDEX IF NOT EXISTS idx_trigger_fire_rule ON trigger_fire_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_trigger_fire_project ON trigger_fire_log(project_id, trigger_type, fired_at);
CREATE INDEX IF NOT EXISTS idx_trigger_fire_throttle ON trigger_fire_log(rule_id, project_id, fired_at DESC);
