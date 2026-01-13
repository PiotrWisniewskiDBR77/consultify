-- Quick Demo Data Population Script
-- Adds initiatives, tasks, and assessments to existing projects

-- Get existing IDs (replace these with actual values from your database)
-- Organization: org-dbr77-system
-- User: admin-001
-- Projects: Use existing project IDs

-- ============================================================
-- INITIATIVES
-- ============================================================

INSERT INTO initiatives (id, project_id, organization_id, name, description, axis, priority, status, cost_capex, business_value, owner_business_id, created_at)
VALUES 
('init-001', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Smart Production Line Integration', 'Integrate IoT sensors and real-time monitoring across production lines', 'processes', 'HIGH', 'IN_PROGRESS', 450000, 'HIGH', 'admin-001', datetime('now', '-30 days')),
('init-002', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Predictive Maintenance System', 'AI-powered predictive maintenance to reduce downtime', 'aiMaturity', 'HIGH', 'APPROVED', 280000, 'HIGH', 'admin-001', datetime('now', '-25 days')),
('init-003', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Digital Twin Implementation', 'Create digital twins of critical assets', 'digitalProducts', 'MEDIUM', 'IN_PROGRESS', 520000, 'HIGH', 'admin-001', datetime('now', '-20 days')),
('init-004', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Real-time Inventory Tracking', 'RFID-based inventory management system', 'dataManagement', 'HIGH', 'COMPLETED', 180000, 'HIGH', 'admin-001', datetime('now', '-45 days')),
('init-005', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Supplier Portal 2.0', 'Enhanced supplier collaboration platform', 'processes', 'MEDIUM', 'IN_PROGRESS', 120000, 'MEDIUM', 'admin-001', datetime('now', '-15 days')),
('init-006', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Demand Forecasting AI', 'Machine learning for demand prediction', 'aiMaturity', 'HIGH', 'APPROVED', 350000, 'HIGH', 'admin-001', datetime('now', '-10 days')),
('init-007', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Customer 360 Platform', 'Unified customer data platform', 'dataManagement', 'HIGH', 'IN_PROGRESS', 380000, 'HIGH', 'admin-001', datetime('now', '-35 days')),
('init-008', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'AI Chatbot Implementation', 'Customer service automation', 'aiMaturity', 'MEDIUM', 'COMPLETED', 85000, 'MEDIUM', 'admin-001', datetime('now', '-50 days')),
('init-009', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Mobile App Redesign', 'Modern mobile experience', 'digitalProducts', 'HIGH', 'IN_PROGRESS', 220000, 'HIGH', 'admin-001', datetime('now', '-12 days')),
('init-010', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'ML Platform Setup', 'Enterprise machine learning infrastructure', 'aiMaturity', 'HIGH', 'APPROVED', 480000, 'HIGH', 'admin-001', datetime('now', '-8 days'));

-- ============================================================
-- TASKS
-- ============================================================

INSERT INTO tasks (id, project_id, organization_id, title, description, status, priority, assignee_id, due_date, reporter_id, created_at, updated_at)
VALUES
('task-001', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Configure ML pipeline for demand forecasting', 'Set up data pipeline and model training infrastructure', 'IN_PROGRESS', 'HIGH', 'admin-001', date('now', '+3 days'), 'admin-001', datetime('now', '-2 days'), datetime('now')),
('task-002', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Review supplier integration API documentation', 'Analyze API specs and integration requirements', 'IN_PROGRESS', 'MEDIUM', 'admin-001', date('now', '+2 days'), 'admin-001', datetime('now', '-3 days'), datetime('now')),
('task-003', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Prepare stakeholder presentation for Q1 review', 'Create executive summary and progress report', 'IN_PROGRESS', 'HIGH', 'admin-001', date('now', '+1 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-004', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Test new customer portal authentication flow', 'QA testing for SSO and MFA', 'IN_PROGRESS', 'HIGH', 'admin-001', date('now', '+4 days'), 'admin-001', datetime('now', '-4 days'), datetime('now')),
('task-005', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Document data governance policies', 'Create comprehensive data governance framework', 'IN_PROGRESS', 'MEDIUM', 'admin-001', date('now', '+5 days'), 'admin-001', datetime('now', '-2 days'), datetime('now')),
('task-006', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Schedule vendor demo for IoT sensors', 'Coordinate with vendors for product demonstrations', 'TODO', 'LOW', 'admin-001', date('now', '+7 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-007', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Create training materials for new ERP module', 'Develop user guides and training videos', 'TODO', 'MEDIUM', 'admin-001', date('now', '+10 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-008', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Analyze legacy system dependencies', 'Map dependencies for migration planning', 'TODO', 'HIGH', 'admin-001', date('now', '+5 days'), 'admin-001', datetime('now', '-2 days'), datetime('now')),
('task-009', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Set up monitoring dashboards for production', 'Configure Grafana and alerting', 'TODO', 'MEDIUM', 'admin-001', date('now', '+8 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-010', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Review security audit findings', 'Address critical security vulnerabilities', 'TODO', 'HIGH', 'admin-001', date('now', '+3 days'), 'admin-001', datetime('now', '-1 days'), datetime('now')),
('task-011', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Complete Phase 1 infrastructure setup', 'Finalize cloud infrastructure deployment', 'DONE', 'HIGH', 'admin-001', date('now', '-2 days'), 'admin-001', datetime('now', '-10 days'), datetime('now', '-2 days')),
('task-012', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Finalize vendor contract negotiations', 'Sign contracts with selected vendors', 'DONE', 'HIGH', 'admin-001', date('now', '-3 days'), 'admin-001', datetime('now', '-15 days'), datetime('now', '-3 days')),
('task-013', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Deploy staging environment', 'Set up staging for UAT', 'DONE', 'MEDIUM', 'admin-001', date('now', '-1 days'), 'admin-001', datetime('now', '-8 days'), datetime('now', '-1 days')),
('task-014', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Conduct user acceptance testing', 'Run UAT with key stakeholders', 'DONE', 'HIGH', 'admin-001', date('now', '-4 days'), 'admin-001', datetime('now', '-12 days'), datetime('now', '-4 days')),
('task-015', (SELECT id FROM projects LIMIT 1), 'org-dbr77-system', 'Update project timeline documentation', 'Refresh Gantt charts and milestones', 'DONE', 'LOW', 'admin-001', date('now', '-5 days'), 'admin-001', datetime('now', '-20 days'), datetime('now', '-5 days'));

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

INSERT INTO notifications (id, user_id, organization_id, type, title, message, is_read, created_at)
VALUES
('notif-001', 'admin-001', 'org-dbr77-system', 'task_assigned', 'New Task Assigned', 'You have been assigned to "Configure ML pipeline for demand forecasting"', 0, datetime('now', '-2 hours')),
('notif-002', 'admin-001', 'org-dbr77-system', 'initiative_update', 'Initiative Status Changed', 'Predictive Maintenance System moved to Approved status', 0, datetime('now', '-5 hours')),
('notif-003', 'admin-001', 'org-dbr77-system', 'deadline_reminder', 'Deadline Approaching', 'Task "Prepare stakeholder presentation" is due tomorrow', 0, datetime('now', '-1 hours')),
('notif-004', 'admin-001', 'org-dbr77-system', 'task_completed', 'Task Completed', 'Phase 1 infrastructure setup has been marked as complete', 1, datetime('now', '-2 days')),
('notif-005', 'admin-001', 'org-dbr77-system', 'milestone_completed', 'Milestone Completed', 'Q4 2024 objectives achieved', 1, datetime('now', '-3 days'));

-- ============================================================
-- SUMMARY
-- ============================================================

SELECT 'Demo data inserted successfully!' as message;
SELECT COUNT(*) as initiatives_count FROM initiatives;
SELECT COUNT(*) as tasks_count FROM tasks;
SELECT COUNT(*) as notifications_count FROM notifications;
