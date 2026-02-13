-- Delete ALL existing notifications
DELETE FROM notifications;

-- 8 fully-populated notifications (English)
-- User: piotr-dbr77, Org: org-dbr77-system, Project: project-dbr77-001

-- ═══════════════════════════════════════════════════════
-- 1. UNREAD, CRITICAL — Task overdue
-- ═══════════════════════════════════════════════════════
INSERT INTO notifications (
  id, user_id, organization_id, project_id, initiative_id, task_id,
  type, severity, priority, title, message, data,
  related_object_type, related_object_id,
  is_read, read, is_actionable, action_url,
  created_at
) VALUES (
  'notif-rich-001',
  'piotr-dbr77', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001', 'task-rich-003',
  'TASK_OVERDUE', 'HIGH', 'critical',
  'OVERDUE: Fix Critical Production Bug — 1 day past deadline',
  'The task "Fix Critical Production Bug" was due yesterday and remains in progress. Memory leak in the payment module is causing pod OOMKills every 4 hours. 3 client escalations received. Immediate resolution required to prevent further revenue impact.',
  '{"task_title":"Fix Critical Production Bug","days_overdue":1,"assignee":"Piotr Wisniewski","client_escalations":3}',
  'task', 'task-rich-003',
  0, 0, 1, '/my-work/tasks/task-rich-003',
  datetime('now', '-3 hours')
);

-- ═══════════════════════════════════════════════════════
-- 2. UNREAD, WARNING — Decision required
-- ═══════════════════════════════════════════════════════
INSERT INTO notifications (
  id, user_id, organization_id, project_id, initiative_id,
  type, severity, priority, title, message, data,
  related_object_type, related_object_id,
  is_read, read, is_actionable, action_url,
  created_at
) VALUES (
  'notif-rich-002',
  'piotr-dbr77', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'DECISION_REQUIRED', 'WARNING', 'high',
  'Decision needed: CRM Platform Selection — deadline in 3 days',
  'You are the decision owner for "Select CRM Platform for Enterprise Rollout". The deadline is approaching in 3 days. All three vendor proposals (Salesforce, HubSpot, Dynamics 365) have been evaluated. 5 weighted criteria are ready for scoring. The procurement team needs your decision to begin contract negotiations.',
  '{"decision_title":"Select CRM Platform for Enterprise Rollout","deadline_days":3,"options_count":3,"criteria_count":5}',
  'decision', 'dec-rich-001',
  0, 0, 1, '/my-work/decisions/dec-rich-001',
  datetime('now', '-6 hours')
);

-- ═══════════════════════════════════════════════════════
-- 3. UNREAD, INFO — AI recommendation
-- ═══════════════════════════════════════════════════════
INSERT INTO notifications (
  id, user_id, organization_id, project_id, initiative_id,
  type, severity, priority, title, message, data,
  related_object_type, related_object_id,
  is_read, read, is_actionable, action_url,
  created_at
) VALUES (
  'notif-rich-003',
  'piotr-dbr77', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'AI_RECOMMENDATION', 'INFO', 'medium',
  'AI Insight: 22% cost reduction identified in cloud infrastructure',
  'Analysis of your AWS spending patterns over the past 90 days suggests potential annual savings of $47K through: (1) right-sizing 12 over-provisioned EC2 instances, (2) switching 3 RDS instances to Aurora Serverless, and (3) implementing S3 Intelligent-Tiering for 8TB of infrequently accessed data. Confidence: 89%.',
  '{"savings_annual":"$47,200","confidence":89,"recommendations":3,"analysis_period_days":90}',
  'project', 'project-dbr77-001',
  0, 0, 1, '/my-work/tasks/task-rich-009',
  datetime('now', '-1 days')
);

-- ═══════════════════════════════════════════════════════
-- 4. UNREAD, WARNING — Gate pending approval
-- ═══════════════════════════════════════════════════════
INSERT INTO notifications (
  id, user_id, organization_id, project_id, initiative_id,
  type, severity, priority, title, message, data,
  related_object_type, related_object_id,
  is_read, read, is_actionable, action_url,
  created_at
) VALUES (
  'notif-rich-004',
  'piotr-dbr77', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'GATE_PENDING_APPROVAL', 'WARNING', 'high',
  'Stage Gate Review: Data Governance Framework requires GO/NO-GO',
  'The Enterprise Data Governance Framework has been escalated and requires your immediate GO/NO-GO decision. Legal has flagged $2.4M regulatory exposure from GDPR and CCPA non-compliance. The board audit committee deadline is March 1st. Two escalation attempts have been made in the past week.',
  '{"decision_title":"Approve Enterprise Data Governance Framework","regulatory_exposure":"$2.4M","escalation_count":2,"board_deadline":"2026-03-01"}',
  'decision', 'dec-rich-005',
  0, 0, 1, '/my-work/decisions/dec-rich-005',
  datetime('now', '-1 days', '+4 hours')
);

-- ═══════════════════════════════════════════════════════
-- 5. READ — Task assigned
-- ═══════════════════════════════════════════════════════
INSERT INTO notifications (
  id, user_id, organization_id, project_id, initiative_id, task_id,
  type, severity, priority, title, message, data,
  related_object_type, related_object_id,
  is_read, read, is_actionable, action_url,
  read_at, created_at
) VALUES (
  'notif-rich-005',
  'piotr-dbr77', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001', 'task-rich-007',
  'TASK_ASSIGNED', 'INFO', 'medium',
  'New task assigned: Prepare Demo for Stakeholders',
  'You have been assigned to "Prepare Demo for Stakeholders" by Justyna Laskowska. Due date: 3 days from now. Priority: High. The task involves building a demo environment for the executive stakeholder meeting showcasing AI-powered reporting and the decision management module. Budget: $500 allocated.',
  '{"task_title":"Prepare Demo for Stakeholders","assigned_by":"Justyna Laskowska","due_in_days":3,"priority":"high","budget":500}',
  'task', 'task-rich-007',
  1, 1, 1, '/my-work/tasks/task-rich-007',
  datetime('now', '-2 days', '+3 hours'), datetime('now', '-2 days')
);

-- ═══════════════════════════════════════════════════════
-- 6. READ — Milestone completed
-- ═══════════════════════════════════════════════════════
INSERT INTO notifications (
  id, user_id, organization_id, project_id, initiative_id,
  type, severity, priority, title, message, data,
  related_object_type, related_object_id,
  is_read, read, is_actionable, action_url,
  read_at, created_at
) VALUES (
  'notif-rich-006',
  'piotr-dbr77', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'MILESTONE_COMPLETED', 'INFO', 'low',
  'Milestone achieved: v2.5 Production Release deployed successfully',
  'The v2.5 production deployment has been completed successfully. 47 features and 23 bug fixes shipped. Zero-downtime migration executed. Error rate at 0.04% (well below 0.1% threshold). All 4 coordinating teams confirmed green status. Release notes published to the customer portal.',
  '{"version":"2.5","features":47,"bugfixes":23,"error_rate":"0.04%","teams_confirmed":4}',
  'task', 'task-rich-014',
  1, 1, 0, '/my-work/tasks/task-rich-014',
  datetime('now', '-3 days', '+2 hours'), datetime('now', '-3 days')
);

-- ═══════════════════════════════════════════════════════
-- 7. READ — AI risk detected
-- ═══════════════════════════════════════════════════════
INSERT INTO notifications (
  id, user_id, organization_id, project_id, initiative_id,
  type, severity, priority, title, message, data,
  related_object_type, related_object_id,
  is_read, read, is_actionable, action_url,
  read_at, created_at
) VALUES (
  'notif-rich-007',
  'piotr-dbr77', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'AI_RECOMMENDATION', 'WARNING', 'high',
  'AI Risk Alert: DataDog contract expiry — service disruption in 18 days',
  'Automated analysis detected that the DataDog enterprise monitoring contract (dec-rich-004) expires in 18 days with no renewal in place. Current annual spend: $340K. If the contract lapses, production observability will be severely degraded. The decision has been escalated but remains unresolved. Recommend prioritizing decision within 5 business days to allow procurement lead time.',
  '{"contract":"DataDog Enterprise","expires_in_days":18,"annual_spend":"$340K","decision_id":"dec-rich-004","risk":"service_disruption"}',
  'decision', 'dec-rich-004',
  1, 1, 1, '/my-work/decisions/dec-rich-004',
  datetime('now', '-4 days', '+5 hours'), datetime('now', '-4 days')
);

-- ═══════════════════════════════════════════════════════
-- 8. READ — User feedback / system alert
-- ═══════════════════════════════════════════════════════
INSERT INTO notifications (
  id, user_id, organization_id, project_id, initiative_id, task_id,
  type, severity, priority, title, message, data,
  related_object_type, related_object_id,
  is_read, read, is_actionable, action_url,
  read_at, created_at
) VALUES (
  'notif-rich-008',
  'piotr-dbr77', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001', 'task-rich-015',
  'USER_FEEDBACK', 'INFO', 'low',
  'Security audit completed — CrowdStrike final report available',
  'The quarterly penetration test with CrowdStrike has been completed and the final report is now available. Results: 0 critical findings, 0 high findings, 4 medium-severity issues (all remediated within SLA). CISO sign-off obtained. Next quarterly audit scheduled for May 2026. Full report archived in the GRC portal.',
  '{"vendor":"CrowdStrike","critical_findings":0,"high_findings":0,"medium_findings":4,"all_remediated":true,"next_audit":"2026-05"}',
  'task', 'task-rich-015',
  1, 1, 0, '/my-work/tasks/task-rich-015',
  datetime('now', '-6 days', '+1 hours'), datetime('now', '-7 days')
);
