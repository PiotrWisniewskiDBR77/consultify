-- Journey Analytics Tables
-- Phase: P0 Implementation
-- Purpose: Track user journey events for activation metrics and TTV

-- Journey events table
CREATE TABLE IF NOT EXISTS journey_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    event_type TEXT NOT NULL,  -- 'phase_entry', 'milestone', 'feature_use', 'tour_event'
    event_name TEXT NOT NULL,
    phase TEXT,                -- A, B, C, D, E, F
    metadata TEXT,             -- JSON
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_journey_user ON journey_events(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_type ON journey_events(event_type);
CREATE INDEX IF NOT EXISTS idx_journey_event_name ON journey_events(event_name);
CREATE INDEX IF NOT EXISTS idx_journey_phase ON journey_events(phase);
CREATE INDEX IF NOT EXISTS idx_journey_created ON journey_events(created_at);

-- Composite index for funnel queries
CREATE INDEX IF NOT EXISTS idx_journey_funnel ON journey_events(event_type, phase, created_at);

-- User activation status (denormalized for fast queries)
CREATE TABLE IF NOT EXISTS user_activation_status (
    user_id TEXT PRIMARY KEY,
    current_phase TEXT DEFAULT 'A',
    phase_a_activated INTEGER DEFAULT 0,
    phase_b_activated INTEGER DEFAULT 0,
    phase_c_activated INTEGER DEFAULT 0,
    phase_d_activated INTEGER DEFAULT 0,
    phase_e_activated INTEGER DEFAULT 0,
    phase_f_activated INTEGER DEFAULT 0,
    first_event_at TEXT,
    last_event_at TEXT,
    total_ttv_ms INTEGER,  -- Time to Value in milliseconds
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
