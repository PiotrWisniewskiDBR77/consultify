-- Initiative dependencies for roadmap timeline
-- Allows linking initiatives with scheduling constraints

CREATE TABLE IF NOT EXISTS initiative_dependencies (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    from_initiative_id TEXT NOT NULL,
    to_initiative_id TEXT NOT NULL,
    type TEXT DEFAULT 'FINISH_TO_START',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY(from_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY(to_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_org
ON initiative_dependencies(organization_id);

CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_project
ON initiative_dependencies(project_id);

CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_from
ON initiative_dependencies(from_initiative_id);

CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_to
ON initiative_dependencies(to_initiative_id);
