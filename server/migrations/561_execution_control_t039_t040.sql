-- Bundle 10 (T039 + T040) — Execution Control: Timeline Management & Risk Signaling
-- Extends raid_items with mitigation management fields
-- Adds execution audit log for date/status changes

CREATE TABLE IF NOT EXISTS raid_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    initiative_id TEXT REFERENCES initiatives(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK(type IN ('RISK', 'ASSUMPTION', 'ISSUE', 'DEPENDENCY')),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'MITIGATED', 'REALIZED', 'CLOSED')),
    probability TEXT CHECK(probability IN ('LOW', 'MEDIUM', 'HIGH')),
    impact TEXT CHECK(impact IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    mitigation_plan TEXT,
    owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    due_date TEXT,
    linked_items TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raid_org ON raid_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_raid_initiative ON raid_items(initiative_id);
CREATE INDEX IF NOT EXISTS idx_raid_type_status ON raid_items(type, status);
CREATE INDEX IF NOT EXISTS idx_raid_owner ON raid_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_raid_due_date ON raid_items(due_date);

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

-- FRESH-DB PARITY (2026-07-14): 20260623_raid_assumption_issue.sql sorts BEFORE
-- this file on a fresh replay, so its raid_items governance columns are skipped
-- (guarded on table existence). Re-apply them here idempotently so the final
-- schema matches staging/prod. No-op wherever they already exist.
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS validation_status TEXT;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS validation_due_date TEXT;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS resolution_due_date TEXT;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS materialized_at TEXT;

CREATE INDEX IF NOT EXISTS idx_raid_items_validation
  ON raid_items (organization_id, type, validation_status)
  WHERE validation_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raid_items_resolution_due
  ON raid_items (organization_id, type, resolution_due_date)
  WHERE resolution_due_date IS NOT NULL;
