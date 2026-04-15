-- T039/T041: Initiative schedule baseline snapshots
-- Adds persistent baseline versioning + snapshot storage for timeline management.

-- Baseline metadata on initiatives
ALTER TABLE initiatives ADD COLUMN baseline_version INTEGER DEFAULT 0;
ALTER TABLE initiatives ADD COLUMN schedule_baseline_id TEXT;

-- Baseline snapshots (one initiative → many baselines, versioned)
CREATE TABLE IF NOT EXISTS initiative_schedule_baselines (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    status_at_baseline TEXT,
    planned_start_date TIMESTAMPTZ,
    planned_end_date TIMESTAMPTZ,
    snapshot TEXT NOT NULL DEFAULT '{}', -- JSON string (portable)
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ini_schedule_baselines_unique
ON initiative_schedule_baselines(initiative_id, version);

CREATE INDEX IF NOT EXISTS idx_ini_schedule_baselines_org
ON initiative_schedule_baselines(organization_id);

CREATE INDEX IF NOT EXISTS idx_ini_schedule_baselines_initiative
ON initiative_schedule_baselines(initiative_id);

