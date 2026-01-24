-- Quick Demo Data - Fixed Schema
-- Inserts initiatives and tasks using correct column names

-- INITIATIVES (without 'axis' column)
INSERT OR IGNORE INTO initiatives (id, project_id, organization_id, name, description, priority, status, owner_business_id, created_at)
VALUES 
('init-001', 'project-dbr77-001', 'org-dbr77-system', 'Smart Production Line Integration', 'Integrate IoT sensors and real-time monitoring across production lines', 'HIGH', 'IN_PROGRESS', 'admin-001', datetime('now', '-30 days')),
('init-002', 'project-dbr77-001', 'org-dbr77-system', 'Predictive Maintenance System', 'AI-powered predictive maintenance to reduce downtime', 'HIGH', 'APPROVED', 'admin-001', datetime('now', '-25 days')),
('init-003', 'project-dbr77-001', 'org-dbr77-system', 'Digital Twin Implementation', 'Create digital twins of critical assets', 'MEDIUM', 'IN_PROGRESS', 'admin-001', datetime('now', '-20 days')),
('init-004', 'project-dbr77-001', 'org-dbr77-system', 'Real-time Inventory Tracking', 'RFID-based inventory management system', 'HIGH', 'COMPLETED', 'admin-001', datetime('now', '-45 days')),
('init-005', 'project-dbr77-001', 'org-dbr77-system', 'Supplier Portal 2.0', 'Enhanced supplier collaboration platform', 'MEDIUM', 'IN_PROGRESS', 'admin-001', datetime('now', '-15 days')),
('init-006', 'project-dbr77-001', 'org-dbr77-system', 'Demand Forecasting AI', 'Machine learning for demand prediction', 'HIGH', 'APPROVED', 'admin-001', datetime('now', '-10 days')),
('init-007', 'project-dbr77-001', 'org-dbr77-system', 'Customer 360 Platform', 'Unified customer data platform', 'HIGH', 'IN_PROGRESS', 'admin-001', datetime('now', '-35 days')),
('init-008', 'project-dbr77-001', 'org-dbr77-system', 'AI Chatbot Implementation', 'Customer service automation', 'MEDIUM', 'COMPLETED', 'admin-001', datetime('now', '-50 days')),
('init-009', 'project-dbr77-001', 'org-dbr77-system', 'Mobile App Redesign', 'Modern mobile experience', 'HIGH', 'IN_PROGRESS', 'admin-001', datetime('now', '-12 days')),
('init-010', 'project-dbr77-001', 'org-dbr77-system', 'ML Platform Setup', 'Enterprise machine learning infrastructure', 'HIGH', 'APPROVED', 'admin-001', datetime('now', '-8 days'));

-- TASKS
INSERT OR IGNORE INTO tasks (id, project_id, organization_id, title, description, status, priority, assignee_id, due_date, reporter_id, created_at, updated_at)
VALUES
('task-101', 'project-dbr77-001', 'org-dbr77-system', 'Configure ML pipeline for demand forecasting', 'Set up data pipeline and model training infrastructure', 'IN_PROGRESS', 'HIGH', 'admin-001', date('now', '+3 days'), 'admin-001', datetime('now', '-2 days'), datetime('now')),
('task-102', 'project-dbr77-001', 'org-dbr77-system', 'Review supplier integration API documentation', 'Analyze API specs and integration requirements', 'IN_PROGRESS', 'MEDIUM', 'admin-001', date('now', '+2 days'), 'admin-001', datetime('now', '-3 days'), datetime('now')),
('task-103', 'project-dbr77-001', 'org-dbr77-system', 'Prepare stakeholder presentation for Q1 review', 'Create executive summary and progress report', 'IN_PROGRESS', 'HIGH', 'admin-001', date('now', '+1 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-104', 'project-dbr77-001', 'org-dbr77-system', 'Test new customer portal authentication flow', 'QA testing for SSO and MFA', 'IN_PROGRESS', 'HIGH', 'admin-001', date('now', '+4 days'), 'admin-001', datetime('now', '-4 days'), datetime('now')),
('task-105', 'project-dbr77-001', 'org-dbr77-system', 'Document data governance policies', 'Create comprehensive data governance framework', 'IN_PROGRESS', 'MEDIUM', 'admin-001', date('now', '+5 days'), 'admin-001', datetime('now', '-2 days'), datetime('now')),
('task-106', 'project-dbr77-001', 'org-dbr77-system', 'Schedule vendor demo for IoT sensors', 'Coordinate with vendors for product demonstrations', 'TODO', 'LOW', 'admin-001', date('now', '+7 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-107', 'project-dbr77-001', 'org-dbr77-system', 'Create training materials for new ERP module', 'Develop user guides and training videos', 'TODO', 'MEDIUM', 'admin-001', date('now', '+10 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-108', 'project-dbr77-001', 'org-dbr77-system', 'Analyze legacy system dependencies', 'Map dependencies for migration planning', 'TODO', 'HIGH', 'admin-001', date('now', '+5 days'), 'admin-001', datetime('now', '-2 days'), datetime('now')),
('task-109', 'project-dbr77-001', 'org-dbr77-system', 'Set up monitoring dashboards for production', 'Configure Grafana and alerting', 'TODO', 'MEDIUM', 'admin-001', date('now', '+8 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-110', 'project-dbr77-001', 'org-dbr77-system', 'Review security audit findings', 'Address critical security vulnerabilities', 'TODO', 'HIGH', 'admin-001', date('now', '+3 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-111', 'project-dbr77-001', 'org-dbr77-system', 'Complete Phase 1 infrastructure setup', 'Finalize cloud infrastructure deployment', 'DONE', 'HIGH', 'admin-001', date('now', '-2 days'), 'admin-001', datetime('now', '-10 days'), datetime('now', '-2 days')),
('task-112', 'project-dbr77-001', 'org-dbr77-system', 'Finalize vendor contract negotiations', 'Sign contracts with selected vendors', 'DONE', 'HIGH', 'admin-001', date('now', '-3 days'), 'admin-001', datetime('now', '-15 days'), datetime('now', '-3 days')),
('task-113', 'project-dbr77-001', 'org-dbr77-system', 'Deploy staging environment', 'Set up staging for UAT', 'DONE', 'MEDIUM', 'admin-001', date('now', '-1 days'), 'admin-001', datetime('now', '-8 days'), datetime('now', '-1 days')),
('task-114', 'project-dbr77-001', 'org-dbr77-system', 'Conduct user acceptance testing', 'Run UAT with key stakeholders', 'DONE', 'HIGH', 'admin-001', date('now', '-4 days'), 'admin-001', datetime('now', '-12 days'), datetime('now', '-4 days')),
('task-115', 'project-dbr77-001', 'org-dbr77-system', 'Update project timeline documentation', 'Refresh Gantt charts and milestones', 'DONE', 'LOW', 'admin-001', date('now', '-5 days'), 'admin-001', datetime('now', '-20 days'), datetime('now', '-5 days'));

-- NOTIFICATIONS
INSERT OR IGNORE INTO notifications (id, user_id, organization_id, type, title, message, is_read, created_at)
VALUES
('notif-101', 'admin-001', 'org-dbr77-system', 'task_assigned', 'New Task Assigned', 'You have been assigned to "Configure ML pipeline for demand forecasting"', 0, datetime('now', '-2 hours')),
('notif-102', 'admin-001', 'org-dbr77-system', 'initiative_update', 'Initiative Status Changed', 'Predictive Maintenance System moved to Approved status', 0, datetime('now', '-5 hours')),
('notif-103', 'admin-001', 'org-dbr77-system', 'deadline_reminder', 'Deadline Approaching', 'Task "Prepare stakeholder presentation" is due tomorrow', 0, datetime('now', '-1 hours')),
('notif-104', 'admin-001', 'org-dbr77-system', 'task_completed', 'Task Completed', 'Phase 1 infrastructure setup has been marked as complete', 1, datetime('now', '-2 days')),
('notif-105', 'admin-001', 'org-dbr77-system', 'milestone_completed', 'Milestone Completed', 'Q4 2024 objectives achieved', 1, datetime('now', '-3 days'));

-- Summary
SELECT 'Demo data inserted!' as message;
SELECT COUNT(*) as initiatives FROM initiatives WHERE project_id = 'project-dbr77-001';
SELECT COUNT(*) as tasks FROM tasks WHERE project_id = 'project-dbr77-001';
SELECT COUNT(*) as notifications FROM notifications WHERE user_id = 'admin-001';
