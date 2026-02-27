-- Migration: Performance Optimization Indexes
-- Date: 2025-01-XX
-- Purpose: Add indexes to optimize frequently used queries and eliminate N+1 patterns

-- ==========================================
-- TASKS TABLE INDEXES
-- ==========================================

-- Optimize: GET /tasks (filtered by org, assignee, status)
CREATE INDEX IF NOT EXISTS idx_tasks_org_assignee_status 
ON tasks(organization_id, assignee_id, status);

-- Optimize: GET /my-work/dashboard (tasks by org, assignee, due_date)
CREATE INDEX IF NOT EXISTS idx_tasks_org_assignee_due_date 
ON tasks(organization_id, assignee_id, due_date) 
WHERE status != 'done';

-- Optimize: Tasks by project and status
CREATE INDEX IF NOT EXISTS idx_tasks_project_status 
ON tasks(project_id, status) 
WHERE status NOT IN ('done', 'DONE', 'cancelled');

-- Optimize: Tasks by initiative
CREATE INDEX IF NOT EXISTS idx_tasks_initiative 
ON tasks(initiative_id) 
WHERE initiative_id IS NOT NULL;

-- Optimize: Tasks by due_date for workload calculations
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_status 
ON tasks(due_date, status) 
WHERE due_date IS NOT NULL AND status NOT IN ('done', 'DONE', 'cancelled');

-- Optimize: Tasks by reporter
CREATE INDEX IF NOT EXISTS idx_tasks_reporter 
ON tasks(organization_id, reporter_id);

-- ==========================================
-- INITIATIVES TABLE INDEXES
-- ==========================================

-- Optimize: Initiatives by project and status
CREATE INDEX IF NOT EXISTS idx_initiatives_project_status 
ON initiatives(project_id, status) 
WHERE status NOT IN ('COMPLETED', 'CANCELLED');

-- Optimize: Initiatives by owner
CREATE INDEX IF NOT EXISTS idx_initiatives_owner 
ON initiatives(owner_business_id) 
WHERE owner_business_id IS NOT NULL;

-- Optimize: Initiatives by organization and status
CREATE INDEX IF NOT EXISTS idx_initiatives_org_status 
ON initiatives(organization_id, status);

-- ==========================================
-- DECISIONS TABLE INDEXES
-- ==========================================

-- Optimize: Decisions by owner and status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'decisions'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_decisions_owner_status
             ON decisions(decision_maker_id, status)
             WHERE status IN (''pending'', ''escalated'')';
  END IF;
END $$;

-- Optimize: Decisions by project
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'decisions'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_decisions_project
             ON decisions(project_id)
             WHERE project_id IS NOT NULL';
  END IF;
END $$;

-- ==========================================
-- NOTIFICATIONS TABLE INDEXES
-- ==========================================

-- Optimize: Notifications by user and read status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_read
             ON notifications(user_id, read, created_at)
             WHERE read = 0';
  END IF;
END $$;

-- Optimize: Notifications by user and severity
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'severity'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_severity
             ON notifications(user_id, severity, created_at)';
  END IF;
END $$;

-- ==========================================
-- USERS TABLE INDEXES
-- ==========================================

-- Optimize: Users by organization and status
CREATE INDEX IF NOT EXISTS idx_users_org_status 
ON users(organization_id, status) 
WHERE status = 'active';

-- ==========================================
-- ACTIVITY_LOGS TABLE INDEXES
-- ==========================================

-- Optimize: Activity logs by organization and time
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_time 
ON activity_logs(organization_id, created_at DESC);

-- Optimize: Activity logs by entity
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity 
ON activity_logs(entity_type, entity_id);

-- ==========================================
-- USER_CAPACITY_PROFILE TABLE INDEXES
-- ==========================================

-- Optimize: User capacity profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_capacity_profile'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_capacity_profile_user
             ON user_capacity_profile(user_id)';
  END IF;
END $$;

-- ==========================================
-- INITIATIVE_LOCATIONS TABLE INDEXES
-- ==========================================

-- Optimize: Initiative locations lookup
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'initiative_locations'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_initiative_locations_initiative
             ON initiative_locations(initiative_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'initiative_locations'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_initiative_locations_location
             ON initiative_locations(location_id)';
  END IF;
END $$;

-- ==========================================
-- KNOWLEDGE_CHUNKS TABLE INDEXES
-- ==========================================

-- Optimize: Knowledge chunks by document
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc 
ON knowledge_chunks(doc_id);

-- ==========================================
-- COMMENTS
-- ==========================================
-- These indexes are designed to:
-- 1. Eliminate N+1 query patterns by enabling efficient JOINs
-- 2. Speed up filtered queries (by org, assignee, status, etc.)
-- 3. Optimize workload calculations and aggregations
-- 4. Improve dashboard and list view performance



























