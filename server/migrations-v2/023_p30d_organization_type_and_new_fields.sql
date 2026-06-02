-- Ported from: 20260411_p30d_organization_type_and_new_fields.sql (SQLite idioms fixed for Postgres)
-- P30-D: Add organization_type and new profile fields for universal org support
-- See contract §11.2

ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS organization_type TEXT DEFAULT 'OTHER';
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS revenue_model TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS delivery_model TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS core_systems TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS founding_year INTEGER;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS digital_budget_percent REAL;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS market_share_estimate REAL;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS key_competitors TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS customer_segments TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS primary_markets TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS regulatory_environment TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS risk_appetite TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS budget_constraints TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS timeline_constraints TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS communication_style TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS industry_jargon_level TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS mission_statement TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS vision_statement TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS competitive_position TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS growth_stage TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS technology_stack TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS cloud_adoption_level TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS industry_code TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS industry_subsector TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS currency TEXT;

-- P30-D Phase 2: Manufacturing-specific fields
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS production_archetype TEXT; -- discrete, process, hybrid
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS shift_pattern TEXT; -- single, double, triple, continuous
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS automation_level TEXT; -- manual, semi_automated, fully_automated
