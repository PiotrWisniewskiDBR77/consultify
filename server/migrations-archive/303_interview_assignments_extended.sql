-- INTERVIEW-ASSIGNMENTS-003: Extended assignment workflow with team support and notifications
-- Migration: 303_interview_assignments_extended.sql
-- Purpose:
--  - Add priority, reminder tracking, escalation fields to interview_assignments
--  - Create interview_assignment_members table for team assignments
--  - Create interview_notifications table for notification history
--  - Seed notification types for interview workflow

-- ==========================================
-- EXTEND INTERVIEW_ASSIGNMENTS TABLE
-- ==========================================

-- Priority level for assignments
ALTER TABLE interview_assignments ADD COLUMN priority TEXT DEFAULT 'medium';

-- Reminder tracking
ALTER TABLE interview_assignments ADD COLUMN reminder_sent_at TIMESTAMP;
ALTER TABLE interview_assignments ADD COLUMN reminder_count INTEGER DEFAULT 0;
ALTER TABLE interview_assignments ADD COLUMN last_reminder_type TEXT;

-- Escalation tracking
ALTER TABLE interview_assignments ADD COLUMN escalated_at TIMESTAMP;
ALTER TABLE interview_assignments ADD COLUMN escalation_count INTEGER DEFAULT 0;

-- Team assignment flag
ALTER TABLE interview_assignments ADD COLUMN is_team_assignment INTEGER DEFAULT 0;

-- Notes from assigner
ALTER TABLE interview_assignments ADD COLUMN notes TEXT;

-- ==========================================
-- TEAM MEMBERS TABLE (for multi-assignee)
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_assignment_members (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',  -- 'lead' or 'member'
    progress_percent INTEGER DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES interview_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(assignment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_assignment_members_assignment 
    ON interview_assignment_members(assignment_id);
CREATE INDEX IF NOT EXISTS idx_interview_assignment_members_user 
    ON interview_assignment_members(user_id);

-- ==========================================
-- INTERVIEW NOTIFICATIONS HISTORY
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_notifications (
    id TEXT PRIMARY KEY,
    assignment_id TEXT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,  -- reminder_48h, reminder_24h, reminder_2h, deadline_passed, escalation, etc.
    channel TEXT NOT NULL,  -- 'email' or 'in_app'
    title TEXT,
    body TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    metadata TEXT,  -- JSON for additional data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES interview_assignments(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interview_notifications_assignment 
    ON interview_notifications(assignment_id);
CREATE INDEX IF NOT EXISTS idx_interview_notifications_user 
    ON interview_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_notifications_type 
    ON interview_notifications(type);
CREATE INDEX IF NOT EXISTS idx_interview_notifications_sent 
    ON interview_notifications(sent_at);

-- ==========================================
-- NOTIFICATION TYPES FOR INTERVIEW
-- ==========================================

-- Insert notification types (ignore if exists)
INSERT OR IGNORE INTO notification_types (name, category, default_channels, icon, description) VALUES
    ('interview_assigned', 'interview', '["in_app","email"]', 'clipboard-list', 'New interview assignment notification'),
    ('interview_reminder_48h', 'interview', '["in_app","email"]', 'clock', '48 hours before deadline reminder'),
    ('interview_reminder_24h', 'interview', '["in_app","email"]', 'clock', '24 hours before deadline reminder'),
    ('interview_reminder_2h', 'interview', '["in_app"]', 'alert-triangle', '2 hours before deadline reminder'),
    ('interview_deadline_passed', 'interview', '["in_app","email"]', 'alert-circle', 'Deadline has passed notification'),
    ('interview_escalation', 'interview', '["in_app","email"]', 'alert-octagon', 'Escalation to assigner notification'),
    ('interview_submitted', 'interview', '["in_app","email"]', 'check-circle', 'Interview submitted for review'),
    ('interview_sent_back', 'interview', '["in_app","email"]', 'rotate-ccw', 'Interview sent back for revision'),
    ('interview_approved', 'interview', '["in_app","email"]', 'check-circle-2', 'Interview approved notification');

-- ==========================================
-- ADD INDEX FOR OVERDUE QUERIES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_interview_assignments_due_status 
    ON interview_assignments(due_at, status);

-- ==========================================
-- PERMISSIONS FOR REMINDER/ESCALATION
-- ==========================================

-- Note: PostgreSQL permissions table may not have 'name' and 'icon' columns
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
    ('INTERVIEW_REMIND', 'Send reminders for interview assignments', 'INTERVIEW');

INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description) VALUES
    ('rp_interview_remind_pm', 'PROJECT_MANAGER', 'INTERVIEW_REMIND', 'Send interview reminders'),
    ('rp_interview_remind_admin', 'ADMIN', 'INTERVIEW_REMIND', 'Send interview reminders'),
    ('rp_interview_remind_super', 'SUPERADMIN', 'INTERVIEW_REMIND', 'Send interview reminders');
