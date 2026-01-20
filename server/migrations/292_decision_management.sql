-- FLOW-DECISION-002: Decision Management Enhancements
-- Adds escalation + impact fields and decision impacts table

-- Extend decisions table for decision management requirements
ALTER TABLE decisions ADD COLUMN priority TEXT DEFAULT 'MEDIUM';
ALTER TABLE decisions ADD COLUMN impact TEXT DEFAULT 'MEDIUM';
ALTER TABLE decisions ADD COLUMN escalation_level TEXT DEFAULT 'none';
ALTER TABLE decisions ADD COLUMN pmo_domain TEXT;
ALTER TABLE decisions ADD COLUMN required INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_decisions_priority ON decisions(priority);
CREATE INDEX IF NOT EXISTS idx_decisions_escalation_level ON decisions(escalation_level);

-- Decision impacts (blocked items, governance impacts)
CREATE TABLE IF NOT EXISTS decision_impacts (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    impacted_type TEXT NOT NULL, -- 'task', 'initiative', 'project', 'gate'
    impacted_id TEXT NOT NULL,
    impact_description TEXT,
    is_blocker INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decision_impacts_decision ON decision_impacts(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_impacts_blocker ON decision_impacts(is_blocker);
