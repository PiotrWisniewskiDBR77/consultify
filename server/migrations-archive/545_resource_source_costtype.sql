-- ==========================================
-- ADD source COLUMN TO ALL RESOURCE TABLES
-- ==========================================
-- Tracks whether a row was added manually or by AI

ALTER TABLE initiative_budget_items ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE initiative_resources ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE initiative_tools ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE initiative_intangible_assets ADD COLUMN source TEXT DEFAULT 'manual';

-- ==========================================
-- ADD cost_type (CAPEX/OPEX) TO TOOLS & INTANGIBLE ASSETS
-- ==========================================

ALTER TABLE initiative_tools ADD COLUMN cost_type TEXT DEFAULT 'OPEX';
ALTER TABLE initiative_intangible_assets ADD COLUMN cost_type TEXT DEFAULT 'OPEX';
