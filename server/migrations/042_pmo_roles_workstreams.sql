-- ============================================
-- PMO ROLES & WORKSTREAMS MIGRATION
-- ============================================
-- Compliant with: ISO 21500:2021, PMI PMBOK 7th Edition, PRINCE2
-- See: docs/00_foundation/PMO_STANDARDS_COMPLIANCE.md
--
-- This migration creates:
-- 1. workstreams - Logical grouping of initiatives (MUST BE FIRST - referenced by project_members)
-- 2. project_members - Team members with project-level roles
-- 3. task_escalations - Escalation history tracking
-- 4. Extensions to tasks table for SLA and escalation
-- ============================================

-- ============================================
-- 1. WORKSTREAMS TABLE (MUST BE CREATED FIRST)
-- ============================================
-- ISO 21500: Work Breakdown Structure (Clause 4.4.3)
-- PMBOK 7: Work Package Grouping
-- PRINCE2: Work Package Cluster

CREATE TABLE IF NOT EXISTS workstreams (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Display name
  name TEXT NOT NULL,
  
  -- Description
  description TEXT,
  
  -- Owner of this workstream (must have WORKSTREAM_OWNER role)
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  
  -- Status: ACTIVE, ON_HOLD, COMPLETED, CANCELLED
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  
  -- Color for UI display (hex)
  color TEXT DEFAULT '#3B82F6',
  
  -- Order for sorting
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  -- Audit fields
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workstreams_project ON workstreams(project_id);
CREATE INDEX IF NOT EXISTS idx_workstreams_owner ON workstreams(owner_id);
CREATE INDEX IF NOT EXISTS idx_workstreams_status ON workstreams(status);

-- ============================================
-- 2. PROJECT MEMBERS TABLE
-- ============================================
-- ISO 21500: Project Team (Clause 4.6.2)
-- PMBOK 7: Team Performance Domain
-- PRINCE2: Organization Theme (Project Roles)

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role within this project
  -- Values: SPONSOR, DECISION_OWNER, PMO_LEAD, WORKSTREAM_OWNER, 
  --         INITIATIVE_OWNER, TASK_ASSIGNEE, SME, REVIEWER, 
  --         OBSERVER, CONSULTANT, STAKEHOLDER
  project_role TEXT NOT NULL DEFAULT 'TASK_ASSIGNEE',
  
  -- Optional workstream assignment (now workstreams table exists)
  workstream_id TEXT REFERENCES workstreams(id) ON DELETE SET NULL,
  
  -- Allocation percentage (0-100)
  allocation_percent INTEGER NOT NULL DEFAULT 100 CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  
  -- Permissions (JSON blob, for flexibility)
  permissions TEXT DEFAULT '{}',
  
  -- Assignment period
  start_date TEXT,
  end_date TEXT,
  
  -- Audit fields
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  
  -- Unique constraint: one role per user per project
  UNIQUE(project_id, user_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(project_role);
CREATE INDEX IF NOT EXISTS idx_project_members_workstream ON project_members(workstream_id);

-- ============================================
-- 3. TASK ESCALATIONS TABLE
-- ============================================
-- ISO 21500: Escalation (Clause 4.3.4)
-- PMBOK 7: Escalation Path
-- PRINCE2: Exception Report

CREATE TABLE IF NOT EXISTS task_escalations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Escalation level transition (0→1→2→3)
  from_level INTEGER NOT NULL DEFAULT 0,
  to_level INTEGER NOT NULL DEFAULT 1,
  
  -- Who received the escalation
  escalated_to_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  
  -- Reason for escalation
  reason TEXT NOT NULL,
  
  -- Type of escalation trigger: SLA_BREACH, BLOCKED, MANUAL, PRIORITY_CHANGE
  trigger_type TEXT NOT NULL DEFAULT 'SLA_BREACH',
  
  -- Resolution (if resolved)
  resolved_at TEXT,
  resolution_note TEXT,
  
  -- Audit fields
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_escalations_task ON task_escalations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_escalations_project ON task_escalations(project_id);
CREATE INDEX IF NOT EXISTS idx_task_escalations_escalated_to ON task_escalations(escalated_to_id);
CREATE INDEX IF NOT EXISTS idx_task_escalations_trigger ON task_escalations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_task_escalations_unresolved ON task_escalations(resolved_at) WHERE resolved_at IS NULL;

-- ============================================
-- 4. EXTEND TASKS TABLE
-- ============================================
-- Add PMO fields for workstream, SLA, and escalation tracking

-- Workstream assignment
ALTER TABLE tasks ADD COLUMN workstream_id TEXT REFERENCES workstreams(id) ON DELETE SET NULL;

-- SLA tracking
ALTER TABLE tasks ADD COLUMN sla_hours INTEGER DEFAULT 24;
ALTER TABLE tasks ADD COLUMN sla_due_at TEXT;

-- Escalation tracking
ALTER TABLE tasks ADD COLUMN escalation_level INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN escalated_to_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN last_escalated_at TEXT;

-- Indexes for task extensions
CREATE INDEX IF NOT EXISTS idx_tasks_workstream ON tasks(workstream_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sla_due ON tasks(sla_due_at) WHERE sla_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_escalation ON tasks(escalation_level) WHERE escalation_level > 0;

-- ============================================
-- 5. EXTEND INITIATIVES TABLE
-- ============================================
-- Add workstream assignment to initiatives

ALTER TABLE initiatives ADD COLUMN workstream_id TEXT REFERENCES workstreams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_initiatives_workstream ON initiatives(workstream_id);

-- ============================================
-- 6. TRIGGERS FOR SLA AND ESCALATION
-- ============================================

-- Create a trigger to auto-populate SLA due date when task is assigned
CREATE TRIGGER IF NOT EXISTS tr_task_sla_on_assign
AFTER UPDATE OF assignee_id ON tasks
WHEN NEW.assignee_id IS NOT NULL AND OLD.assignee_id IS NULL
BEGIN
  UPDATE tasks 
  SET sla_due_at = datetime('now', '+' || COALESCE(NEW.sla_hours, 24) || ' hours')
  WHERE id = NEW.id;
END;

-- Create a trigger to reset escalation when task is completed
CREATE TRIGGER IF NOT EXISTS tr_task_reset_escalation_on_complete
AFTER UPDATE OF status ON tasks
WHEN NEW.status = 'DONE' OR NEW.status = 'COMPLETED'
BEGIN
  UPDATE tasks 
  SET escalation_level = 0,
      escalated_to_id = NULL,
      last_escalated_at = NULL
  WHERE id = NEW.id;
END;

-- ============================================
-- 7. MIGRATION COMPLETE
-- ============================================
-- All tables and indexes created for PMO roles and workstreams.
-- 
-- Tables created (in dependency order):
-- 1. workstreams (initiative groupings) - NO DEPENDENCIES
-- 2. project_members (team with project roles) - DEPENDS ON workstreams
-- 3. task_escalations (escalation history) - DEPENDS ON tasks
--
-- Extensions:
-- - tasks: workstream_id, sla_hours, sla_due_at, escalation_level, escalated_to_id, last_escalated_at
-- - initiatives: workstream_id
--
-- Triggers:
-- - tr_task_sla_on_assign: Auto-set SLA due date on assignment
-- - tr_task_reset_escalation_on_complete: Reset escalation on completion
