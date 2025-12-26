-- Migration: 045_initiative_templates.sql
-- Description: Create initiative templates table for reusable charter patterns
-- Date: 2024-12-26

-- Initiative Templates Table
CREATE TABLE IF NOT EXISTS initiative_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('DATA', 'PROCESS', 'PRODUCT', 'CULTURE', 'SECURITY', 'AI_ML', 'CUSTOM')),
    description TEXT,
    applicable_axes TEXT, -- JSON array of DRD axes
    template_data TEXT NOT NULL, -- JSON with all pre-filled fields
    is_public INTEGER DEFAULT 0,
    organization_id TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_category ON initiative_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_org ON initiative_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_public ON initiative_templates(is_public);

-- AI Charter Generation Logs (for audit and improvement)
CREATE TABLE IF NOT EXISTS ai_charter_generations (
    id TEXT PRIMARY KEY,
    initiative_id TEXT,
    source_type TEXT NOT NULL CHECK(source_type IN ('GAP', 'REPORT', 'MANUAL')),
    template_id TEXT,
    gaps_json TEXT, -- Input gaps
    constraints_json TEXT, -- Generation constraints
    generated_charter_json TEXT, -- Full generated output
    confidence_score REAL,
    user_edits_json TEXT, -- Track what user changed post-generation
    generation_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL,
    FOREIGN KEY (template_id) REFERENCES initiative_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_charter_gen_initiative ON ai_charter_generations(initiative_id);
CREATE INDEX IF NOT EXISTS idx_charter_gen_template ON ai_charter_generations(template_id);

