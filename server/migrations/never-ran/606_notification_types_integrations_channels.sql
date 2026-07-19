-- Migration: 606_notification_types_integrations_channels.sql
-- Purpose: Ensure decision/gate notifications can route to Slack/Teams via NotificationService

INSERT INTO notification_types (id, name, category, display_name, default_channels, icon, is_critical)
VALUES
  ('nt-decision-required', 'DECISION_REQUIRED', 'decisions', 'Decision Required', '["in_app","email","slack","teams"]', '🔴', FALSE),
  ('nt-decision-reminder', 'DECISION_REMINDER', 'decisions', 'Decision Reminder', '["in_app","email","slack","teams"]', '⏰', FALSE),
  ('nt-decision-delegated', 'DECISION_DELEGATED', 'decisions', 'Decision Delegated', '["in_app","email","slack","teams"]', '➡️', FALSE),
  ('nt-gate-pending-approval', 'GATE_PENDING_APPROVAL', 'decisions', 'Gate Pending Approval', '["in_app","email","slack","teams"]', '🛑', FALSE),
  ('nt-task-assigned-v3', 'TASK_ASSIGNED', 'tasks', 'Task Assigned', '["in_app","email","slack","teams"]', '📋', FALSE)
ON CONFLICT (id) DO NOTHING;

