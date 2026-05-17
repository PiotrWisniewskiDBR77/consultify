-- Migration: 513_initiative_card_scope_templates
-- Purpose: Add initiative template linkage + seed card-scope templates (public)
-- Date: 2026-02-04
--
-- Notes:
-- - SQLite doesn't support ADD COLUMN IF NOT EXISTS; migration runner should ignore duplicates.
-- - Template "category" must match the CHECK constraint in 045_initiative_templates.sql.

CREATE TABLE IF NOT EXISTS initiative_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('DATA', 'PROCESS', 'PRODUCT', 'CULTURE', 'SECURITY', 'AI_ML', 'CUSTOM')),
    description TEXT,
    applicable_axes TEXT,
    template_data TEXT NOT NULL,
    is_public INTEGER DEFAULT 0,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON initiative_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_org ON initiative_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_public ON initiative_templates(is_public);

-- Link initiatives to a template defining card scope/sections
ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS initiative_template_id TEXT REFERENCES initiative_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_initiatives_template_id ON initiatives(initiative_template_id);

-- Seed public card-scope templates (id is stable for frontend references)
INSERT INTO initiative_templates
  (id, name, category, description, applicable_axes, template_data, is_public, organization_id, created_by, created_at, updated_at)
VALUES
  (
    'tpl-card-lite',
    'Card Scope: Lite',
    'CUSTOM',
    'Minimal initiative card for quick wins (no decisions, no economics).',
    '[]',
    '{
      "cardScope": {
        "showTasks": true,
        "showDecisions": false,
        "showRaid": true,
        "showGates": false,
        "showFinancialAnalysis": false,
        "showFinancialImpact": false,
        "showTeam": true
      },
      "suggestedTasks": [],
      "suggestedRoles": []
    }',
    1,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'tpl-card-standard',
    'Card Scope: Standard',
    'CUSTOM',
    'Standard enterprise initiative card (tasks, decisions, RAID, gates; economics optional).',
    '[]',
    '{
      "cardScope": {
        "showTasks": true,
        "showDecisions": true,
        "showRaid": true,
        "showGates": true,
        "showFinancialAnalysis": false,
        "showFinancialImpact": true,
        "showTeam": true
      },
      "suggestedTasks": [],
      "suggestedRoles": []
    }',
    1,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'tpl-card-governance',
    'Card Scope: Governance-heavy',
    'CUSTOM',
    'Governance-driven card (decisions + gates + RAID).',
    '[]',
    '{
      "cardScope": {
        "showTasks": true,
        "showDecisions": true,
        "showRaid": true,
        "showGates": true,
        "showFinancialAnalysis": false,
        "showFinancialImpact": false,
        "showTeam": true
      },
      "suggestedTasks": [],
      "suggestedRoles": ["PMO", "Sponsor", "Owner"]
    }',
    1,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'tpl-card-economics',
    'Card Scope: Economics-heavy',
    'CUSTOM',
    'Value/economics-driven card (financial analysis + impact required).',
    '[]',
    '{
      "cardScope": {
        "showTasks": true,
        "showDecisions": true,
        "showRaid": true,
        "showGates": true,
        "showFinancialAnalysis": true,
        "showFinancialImpact": true,
        "showTeam": true
      },
      "suggestedTasks": [],
      "suggestedRoles": ["Finance Partner", "Owner", "Sponsor"]
    }',
    1,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  applicable_axes = EXCLUDED.applicable_axes,
  template_data = EXCLUDED.template_data,
  is_public = EXCLUDED.is_public,
  organization_id = EXCLUDED.organization_id,
  created_by = EXCLUDED.created_by,
  updated_at = EXCLUDED.updated_at;

