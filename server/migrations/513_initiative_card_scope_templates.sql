-- Migration: 513_initiative_card_scope_templates
-- Purpose: Add initiative template linkage + seed card-scope templates (public)
-- Date: 2026-02-04
--
-- Notes:
-- - SQLite doesn't support ADD COLUMN IF NOT EXISTS; migration runner should ignore duplicates.
-- - Template "category" must match the CHECK constraint in 045_initiative_templates.sql.

-- Link initiatives to a template defining card scope/sections
ALTER TABLE initiatives
  ADD COLUMN initiative_template_id TEXT REFERENCES initiative_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_initiatives_template_id ON initiatives(initiative_template_id);

-- Seed public card-scope templates (id is stable for frontend references)
INSERT OR IGNORE INTO initiative_templates
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
  );

