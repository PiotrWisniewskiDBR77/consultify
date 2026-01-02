-- Migration: Workspace Defaults
-- Purpose: Store organization-level workspace default settings

CREATE TABLE IF NOT EXISTS workspace_defaults (
    organization_id TEXT PRIMARY KEY,
    
    -- Project Defaults
    project_default_view_mode TEXT DEFAULT 'kanban',
    project_auto_assign_creator INTEGER DEFAULT 1,
    project_default_privacy TEXT DEFAULT 'team',
    project_enable_time_tracking INTEGER DEFAULT 1,
    project_enable_dependencies INTEGER DEFAULT 1,
    project_default_estimation_unit TEXT DEFAULT 'hours',
    
    -- Task Defaults
    task_default_priority TEXT DEFAULT 'medium',
    task_default_due_offset INTEGER DEFAULT 7,
    task_default_assignee TEXT DEFAULT 'creator',
    task_auto_add_to_my_work INTEGER DEFAULT 1,
    
    -- Workflow States (JSON array)
    workflow_states TEXT DEFAULT '[]',
    
    -- Priorities (JSON array)
    priorities TEXT DEFAULT '[]',
    
    -- Regional Settings
    timezone TEXT DEFAULT 'Europe/Warsaw',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    time_format TEXT DEFAULT '24h',
    week_start TEXT DEFAULT 'monday',
    working_days TEXT DEFAULT '[1,2,3,4,5]',
    working_hours_start TEXT DEFAULT '09:00',
    working_hours_end TEXT DEFAULT '17:00',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Insert migration record
INSERT OR IGNORE INTO migrations (name, applied_at) VALUES ('110_workspace_defaults', datetime('now'));


