-- Migration 061: Initiative Lifecycle Enhancement
-- Adds tables for status history, KPIs, and measurements
-- Supports full PMO lifecycle from DRAFT to ARCHIVED

-- ==========================================
-- INITIATIVE STATUS HISTORY
-- Tracks all status transitions for audit trail
-- ==========================================
CREATE TABLE IF NOT EXISTS initiative_status_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    initiative_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT,
    reason TEXT,
    context_json TEXT, -- Stores validation context (charter completeness, etc.)
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_status_history_initiative 
    ON initiative_status_history(initiative_id);

CREATE INDEX IF NOT EXISTS idx_status_history_changed_at 
    ON initiative_status_history(changed_at);

-- ==========================================
-- INITIATIVE KPIs
-- Defines KPIs to track for completed initiatives
-- ==========================================
CREATE TABLE IF NOT EXISTS initiative_kpis (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    initiative_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_value REAL,
    unit TEXT, -- e.g., '%', 'PLN', 'count', 'hours'
    measurement_frequency TEXT DEFAULT 'MONTHLY', -- DAILY, WEEKLY, MONTHLY, QUARTERLY
    alert_threshold REAL, -- Value below which alert is triggered
    alert_direction TEXT DEFAULT 'BELOW', -- BELOW or ABOVE
    is_primary INTEGER DEFAULT 0, -- Primary KPI shown in dashboard
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kpis_initiative 
    ON initiative_kpis(initiative_id);

-- ==========================================
-- KPI MEASUREMENTS
-- Historical measurements for each KPI
-- ==========================================
CREATE TABLE IF NOT EXISTS kpi_measurements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    kpi_id TEXT NOT NULL,
    value REAL NOT NULL,
    measured_at DATETIME NOT NULL,
    notes TEXT,
    explanation TEXT, -- Why target not met (if applicable)
    action_items TEXT, -- JSON array of action items to address gap
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kpi_id) REFERENCES initiative_kpis(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_measurements_kpi 
    ON kpi_measurements(kpi_id);

CREATE INDEX IF NOT EXISTS idx_measurements_date 
    ON kpi_measurements(measured_at);

-- ==========================================
-- ADD NEW COLUMNS TO INITIATIVES TABLE
-- ==========================================

-- Blocked reason (required when status = BLOCKED)
ALTER TABLE initiatives ADD COLUMN blocked_reason TEXT;

-- Blocked at timestamp
ALTER TABLE initiatives ADD COLUMN blocked_at DATETIME;

-- Completed at timestamp
ALTER TABLE initiatives ADD COLUMN completed_at DATETIME;

-- Cancelled at timestamp  
ALTER TABLE initiatives ADD COLUMN cancelled_at DATETIME;

-- Cancelled reason
ALTER TABLE initiatives ADD COLUMN cancelled_reason TEXT;

-- Archived at timestamp
ALTER TABLE initiatives ADD COLUMN archived_at DATETIME;

-- Charter completeness percentage (0-100)
ALTER TABLE initiatives ADD COLUMN charter_completeness INTEGER DEFAULT 0;

-- Location ID for filtering
ALTER TABLE initiatives ADD COLUMN location_id TEXT;

-- Review submitted at
ALTER TABLE initiatives ADD COLUMN review_submitted_at DATETIME;

-- Review submitted by
ALTER TABLE initiatives ADD COLUMN review_submitted_by TEXT;

-- Approved at timestamp
ALTER TABLE initiatives ADD COLUMN approved_at DATETIME;

-- Approved by
ALTER TABLE initiatives ADD COLUMN approved_by TEXT;

-- Execution started at
ALTER TABLE initiatives ADD COLUMN execution_started_at DATETIME;

-- ==========================================
-- INITIATIVE REVIEWS
-- Tracks approval reviews
-- ==========================================
CREATE TABLE IF NOT EXISTS initiative_reviews (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    initiative_id TEXT NOT NULL,
    reviewer_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CHANGES_REQUESTED
    comments TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_initiative 
    ON initiative_reviews(initiative_id);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer 
    ON initiative_reviews(reviewer_id);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_initiatives_status 
    ON initiatives(status);

CREATE INDEX IF NOT EXISTS idx_initiatives_location 
    ON initiatives(location_id);

CREATE INDEX IF NOT EXISTS idx_initiatives_charter_completeness 
    ON initiatives(charter_completeness);














