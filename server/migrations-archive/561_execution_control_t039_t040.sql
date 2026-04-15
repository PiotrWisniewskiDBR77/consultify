-- Bundle 10 (T039 + T040) — Execution Control: Timeline Management & Risk Signaling
-- Extends raid_items with mitigation management fields
-- Adds execution audit log for date/status changes

-- 1. Add mitigation management columns to raid_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raid_items' AND column_name = 'mitigation_plan') THEN
        ALTER TABLE raid_items ADD COLUMN mitigation_plan TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raid_items' AND column_name = 'response_strategy') THEN
        ALTER TABLE raid_items ADD COLUMN response_strategy TEXT CHECK (response_strategy IN ('AVOID', 'TRANSFER', 'MITIGATE', 'ACCEPT', 'ESCALATE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raid_items' AND column_name = 'mitigation_owner_id') THEN
        ALTER TABLE raid_items ADD COLUMN mitigation_owner_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raid_items' AND column_name = 'mitigation_due_date') THEN
        ALTER TABLE raid_items ADD COLUMN mitigation_due_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raid_items' AND column_name = 'mitigation_status') THEN
        ALTER TABLE raid_items ADD COLUMN mitigation_status TEXT DEFAULT 'OPEN' CHECK (mitigation_status IN ('OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'CLOSED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raid_items' AND column_name = 'materialized_at') THEN
        ALTER TABLE raid_items ADD COLUMN materialized_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raid_items' AND column_name = 'source') THEN
        ALTER TABLE raid_items ADD COLUMN source TEXT DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'HEURISTIC', 'AI'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raid_items' AND column_name = 'signal_type') THEN
        ALTER TABLE raid_items ADD COLUMN signal_type TEXT;
    END IF;
END $$;

-- 2. Execution audit log for timeline changes (dates, statuses, dependencies)
CREATE TABLE IF NOT EXISTS execution_audit_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_audit_initiative ON execution_audit_log(initiative_id);
CREATE INDEX IF NOT EXISTS idx_exec_audit_org ON execution_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_exec_audit_changed_at ON execution_audit_log(changed_at DESC);

-- 3. Risk signal alerts table (throttled notifications)
CREATE TABLE IF NOT EXISTS risk_signal_alerts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    initiative_id TEXT,
    raid_item_id TEXT,
    signal_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    title TEXT NOT NULL,
    description TEXT,
    suggested_action TEXT,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_by TEXT,
    dismissed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_alerts_org ON risk_signal_alerts(organization_id, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_initiative ON risk_signal_alerts(initiative_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_created ON risk_signal_alerts(created_at DESC);
