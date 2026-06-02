-- P30-D: Add organization_type and new profile fields for universal org support
-- See contract §11.2

ALTER TABLE organization_profiles ADD COLUMN organization_type TEXT DEFAULT 'OTHER';
ALTER TABLE organization_profiles ADD COLUMN revenue_model TEXT;
ALTER TABLE organization_profiles ADD COLUMN delivery_model TEXT;
ALTER TABLE organization_profiles ADD COLUMN core_systems TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN founding_year INTEGER;
ALTER TABLE organization_profiles ADD COLUMN digital_budget_percent REAL;
ALTER TABLE organization_profiles ADD COLUMN market_share_estimate REAL;
ALTER TABLE organization_profiles ADD COLUMN key_competitors TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN customer_segments TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN primary_markets TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN regulatory_environment TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN risk_appetite TEXT;
ALTER TABLE organization_profiles ADD COLUMN budget_constraints TEXT;
ALTER TABLE organization_profiles ADD COLUMN timeline_constraints TEXT;
ALTER TABLE organization_profiles ADD COLUMN communication_style TEXT;
ALTER TABLE organization_profiles ADD COLUMN industry_jargon_level TEXT;
ALTER TABLE organization_profiles ADD COLUMN mission_statement TEXT;
ALTER TABLE organization_profiles ADD COLUMN vision_statement TEXT;
ALTER TABLE organization_profiles ADD COLUMN competitive_position TEXT;
ALTER TABLE organization_profiles ADD COLUMN growth_stage TEXT;
ALTER TABLE organization_profiles ADD COLUMN technology_stack TEXT; -- JSON array
ALTER TABLE organization_profiles ADD COLUMN cloud_adoption_level TEXT;
ALTER TABLE organization_profiles ADD COLUMN industry_code TEXT;
ALTER TABLE organization_profiles ADD COLUMN industry_subsector TEXT;
ALTER TABLE organization_profiles ADD COLUMN currency TEXT;

-- P30-D Phase 2: Manufacturing-specific fields
ALTER TABLE organization_profiles ADD COLUMN production_archetype TEXT; -- discrete, process, hybrid
ALTER TABLE organization_profiles ADD COLUMN shift_pattern TEXT; -- single, double, triple, continuous
ALTER TABLE organization_profiles ADD COLUMN automation_level TEXT; -- manual, semi_automated, fully_automated
