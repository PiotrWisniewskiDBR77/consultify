-- Migration: Assessment Permissions System
-- Creates tables for role-based access control in assessments
-- Supports: Admin, Manager, Editor, Viewer roles with granular permissions

-- Needed for gen_random_uuid() used for TEXT ids
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- Table: assessment_roles
-- Stores user roles and permissions per assessment
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_roles (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  
  -- Role: admin, manager, editor, viewer
  role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'editor', 'viewer')),
  
  -- Granular permissions (primarily for manager role customization)
  can_edit BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT FALSE,
  can_manage_team BOOLEAN DEFAULT FALSE,
  can_change_status BOOLEAN DEFAULT FALSE,
  can_generate_report BOOLEAN DEFAULT FALSE,
  can_generate_initiatives BOOLEAN DEFAULT FALSE,
  
  -- Area restrictions (JSON array of area IDs, NULL = all areas)
  assigned_areas TEXT,
  
  -- Assignment tracking
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one role per user per assessment
  UNIQUE(assessment_id, user_id)
);

-- Indexes for assessment_roles
CREATE INDEX IF NOT EXISTS idx_assessment_roles_assessment ON assessment_roles(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_roles_user ON assessment_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_roles_org ON assessment_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessment_roles_role ON assessment_roles(role);

-- ============================================
-- Table: assessment_access_requests
-- Stores requests for access to assessments
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_access_requests (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  
  -- What they're requesting
  requested_role TEXT NOT NULL CHECK(requested_role IN ('editor', 'manager')),
  requested_areas TEXT, -- JSON array of specific areas, NULL = all
  
  -- Request details
  justification TEXT NOT NULL,
  priority TEXT DEFAULT 'NORMAL' CHECK(priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  
  -- Status tracking
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  
  -- Review details
  reviewed_by TEXT,
  reviewed_at DATETIME,
  review_notes TEXT,
  
  -- What was actually granted (may differ from requested)
  granted_role TEXT,
  granted_permissions TEXT, -- JSON object with permission flags
  granted_areas TEXT, -- JSON array
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for assessment_access_requests
CREATE INDEX IF NOT EXISTS idx_assessment_access_requests_assessment ON assessment_access_requests(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_access_requests_requester ON assessment_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_assessment_access_requests_status ON assessment_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_assessment_access_requests_org ON assessment_access_requests(organization_id);

-- ============================================
-- Trigger: Auto-update updated_at on assessment_roles
-- ============================================
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assessment_roles_updated_at ON assessment_roles;
CREATE TRIGGER trg_assessment_roles_updated_at
BEFORE UPDATE ON assessment_roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- ============================================
-- Trigger: Auto-update updated_at on assessment_access_requests
-- ============================================
DROP TRIGGER IF EXISTS trg_assessment_access_requests_updated_at ON assessment_access_requests;
CREATE TRIGGER trg_assessment_access_requests_updated_at
BEFORE UPDATE ON assessment_access_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- ============================================
-- Seed: Add permissions to permissions table
-- ============================================
INSERT INTO permissions (key, description, category, created_at)
VALUES 
  ('ASSESSMENT_CREATE', 'Create new assessments', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_DELETE', 'Delete assessments', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_VIEW', 'View assessments', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_EDIT', 'Edit assessment content', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_MANAGE', 'Access assessment management panel', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_MANAGE_TEAM', 'Manage assessment team members', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_CHANGE_STATUS', 'Change assessment workflow status', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_APPROVE', 'Approve assessments', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_GENERATE_REPORT', 'Generate assessment reports', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessment', 'ASSESSMENT', CURRENT_TIMESTAMP),
  ('ASSESSMENT_REQUEST_ACCESS', 'Request access to assessments', 'ASSESSMENT', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Seed: Add role permissions mappings
-- ============================================
-- ADMIN gets all assessment permissions
INSERT INTO role_permissions (id, role, permission_key)
SELECT 
  gen_random_uuid()::text,
  'ADMIN',
  key
FROM permissions WHERE category = 'ASSESSMENT'
ON CONFLICT (role, permission_key) DO NOTHING;

-- PROJECT_MANAGER gets most assessment permissions except delete
INSERT INTO role_permissions (id, role, permission_key)
SELECT 
  gen_random_uuid()::text,
  'PROJECT_MANAGER',
  key
FROM permissions 
WHERE category = 'ASSESSMENT' 
  AND key NOT IN ('ASSESSMENT_DELETE', 'ASSESSMENT_CREATE')
ON CONFLICT (role, permission_key) DO NOTHING;

-- TEAM_MEMBER gets view and edit
INSERT INTO role_permissions (id, role, permission_key)
VALUES 
  (gen_random_uuid()::text, 'TEAM_MEMBER', 'ASSESSMENT_VIEW'),
  (gen_random_uuid()::text, 'TEAM_MEMBER', 'ASSESSMENT_EDIT'),
  (gen_random_uuid()::text, 'TEAM_MEMBER', 'ASSESSMENT_REQUEST_ACCESS')
ON CONFLICT (role, permission_key) DO NOTHING;

-- VIEWER gets view and request access only
INSERT INTO role_permissions (id, role, permission_key)
VALUES 
  (gen_random_uuid()::text, 'VIEWER', 'ASSESSMENT_VIEW'),
  (gen_random_uuid()::text, 'VIEWER', 'ASSESSMENT_REQUEST_ACCESS')
ON CONFLICT (role, permission_key) DO NOTHING;
