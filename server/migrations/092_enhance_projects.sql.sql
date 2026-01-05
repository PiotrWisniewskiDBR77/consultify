-- Migration: 092_enhance_projects.sql
-- Description: Add description and goal (CEL) to projects table

-- Add description column
ALTER TABLE projects ADD COLUMN description TEXT;

-- Add goal (CEL) column 
ALTER TABLE projects ADD COLUMN goal TEXT;

-- Add summary count fields for optimization (optional but helpful for list view)
ALTER TABLE projects ADD COLUMN initiative_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN assessment_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN member_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN document_count INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_org_status ON projects(organization_id, status);
