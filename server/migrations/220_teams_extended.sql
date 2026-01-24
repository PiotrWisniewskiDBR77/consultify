-- Migration: 220_teams_extended.sql
-- Purpose: Extend teams table with additional fields for SaaS enterprise features
-- Date: 2025-01-01

-- Add color column for team visual identification
ALTER TABLE teams ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'violet';

-- Add default_project_role for team members when assigned to projects
ALTER TABLE teams ADD COLUMN IF NOT EXISTS default_project_role TEXT DEFAULT 'TEAM_MEMBER';

-- Add team role/category
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_type TEXT DEFAULT 'standard'; -- standard, functional, cross-functional, project, virtual

-- Add active status
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;

-- Add updated_at for tracking changes
ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Create index on organization_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_organization ON teams(organization_id);

-- Create index on lead_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_lead ON teams(lead_id);

-- Team member role with more detail
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_primary_team INTEGER DEFAULT 0;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS allocation_percent INTEGER DEFAULT 100;

-- Create index on team_members for user lookup
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
