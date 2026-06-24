-- M16/3.3: Value Capture Pipeline + Stage-Gates (G0..G5)
-- Tracks each initiative's progression through value-capture stage-gates,
-- with explicit sign-off and captured value evidence per gate.

CREATE TABLE IF NOT EXISTS value_capture_gates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    gate TEXT NOT NULL,                     -- G0 | G1 | G2 | G3 | G4 | G5
    status TEXT NOT NULL DEFAULT 'pending', -- pending | passed | blocked
    criteria TEXT,                          -- JSON / free-text exit criteria
    signed_off_by TEXT,
    signed_off_at TEXT,
    value_evidence REAL,                    -- captured value at this gate
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for org-scoped lookups and per-initiative funnel queries
CREATE INDEX IF NOT EXISTS idx_value_capture_gates_org ON value_capture_gates(organization_id);
CREATE INDEX IF NOT EXISTS idx_value_capture_gates_initiative ON value_capture_gates(organization_id, initiative_id);
CREATE INDEX IF NOT EXISTS idx_value_capture_gates_gate ON value_capture_gates(organization_id, gate);
