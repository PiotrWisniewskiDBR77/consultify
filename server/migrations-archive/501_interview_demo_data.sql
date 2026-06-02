-- ============================================================================
-- INTERVIEW MODULE DEMO DATA
-- Migration: 501_interview_demo_data.sql
-- Purpose: Populate Interview module with realistic demo data
-- Created: 2026-01-27
-- ============================================================================

-- ============================================================================
-- INTERVIEW TEMPLATES (6+ templates)
-- ============================================================================

INSERT OR IGNORE INTO interview_templates (id, organization_id, axis_id, area_id, name, description, category, questions, probing_questions, evidence_checklist, status, visibility, is_default, version, created_by, created_at) VALUES
('tpl-digital-maturity', 'org-dbr77-test', 'digital', 'general', 'Digital Maturity Assessment', 'Comprehensive assessment of digital transformation readiness', 'assessment', 
'["What is your current level of digital technology adoption?", "How do you measure digital transformation success?", "What are your main digital initiatives?", "How integrated are your digital systems?", "What is your data strategy?"]',
'["Can you give specific examples?", "What challenges have you faced?", "What would success look like?"]',
'["Digital roadmap document", "IT architecture diagram", "Technology stack inventory"]',
'published', 'organization', 1, 1, 'user-dbr77-admin', datetime('now', '-60 days')),

('tpl-lean-assessment', 'org-dbr77-test', 'operations', 'manufacturing', 'Lean Manufacturing Assessment', 'Evaluate lean principles implementation in production', 'assessment',
'["How do you identify and eliminate waste?", "What is your approach to continuous improvement?", "How do you manage visual management?", "What lean tools are currently in use?", "How do you measure OEE?"]',
'["What specific improvements have you made?", "How do employees participate?", "What are the biggest obstacles?"]',
'["Value stream maps", "5S audit results", "OEE reports", "Kaizen event records"]',
'published', 'organization', 1, 1, 'user-pawel-wojcik', datetime('now', '-45 days')),

('tpl-change-readiness', 'org-dbr77-test', 'people', 'change', 'Change Readiness Assessment', 'Assess organizational readiness for change initiatives', 'assessment',
'["How does leadership communicate change?", "What is the level of employee engagement?", "How are change initiatives typically received?", "What training programs exist?", "How do you measure change adoption?"]',
'["Can you describe a recent change initiative?", "What resistance have you encountered?", "How do you address concerns?"]',
'["Communication plans", "Training materials", "Employee survey results", "Change impact assessments"]',
'published', 'organization', 1, 1, 'user-agnieszka-szymanska', datetime('now', '-40 days')),

('tpl-data-governance', 'org-dbr77-test', 'digital', 'data', 'Data Governance Discovery', 'Discover current data management practices and gaps', 'discovery',
'["Who owns data in your organization?", "How do you ensure data quality?", "What data policies exist?", "How is data access controlled?", "What compliance requirements apply?"]',
'["How is this documented?", "Who is responsible?", "What tools do you use?"]',
'["Data ownership matrix", "Data quality reports", "Access control policies", "Compliance documentation"]',
'published', 'organization', 0, 1, 'user-jan-nowak', datetime('now', '-30 days')),

('tpl-customer-journey', 'org-dbr77-test', 'strategy', 'customer', 'Customer Journey Mapping', 'Map and analyze customer touchpoints and experience', 'discovery',
'["What are your main customer segments?", "How do customers interact with your company?", "What are the key pain points?", "How do you measure customer satisfaction?", "What feedback mechanisms exist?"]',
'["Can you walk me through a typical customer journey?", "Where do customers drop off?", "What improvements are planned?"]',
'["Customer journey maps", "NPS/CSAT scores", "Customer feedback reports", "Support ticket analysis"]',
'published', 'organization', 0, 1, 'user-maria-wisniewska', datetime('now', '-25 days')),

('tpl-process-efficiency', 'org-dbr77-test', 'operations', 'process', 'Process Efficiency Analysis', 'Analyze process efficiency and identify automation opportunities', 'discovery',
'["What are your core business processes?", "Where are the main bottlenecks?", "How much manual work is involved?", "What systems support these processes?", "What metrics do you track?"]',
'["How long does this process take?", "Who is involved?", "What could be automated?"]',
'["Process documentation", "Time studies", "System screenshots", "Performance metrics"]',
'published', 'organization', 0, 1, 'user-tomasz-lewandowski', datetime('now', '-20 days'));

-- ============================================================================
-- INTERVIEW SESSIONS (5+ sessions with various statuses)
-- ============================================================================

INSERT OR IGNORE INTO interview_sessions (id, organization_id, project_id, user_id, owner_id, name, topic, template_id, status, progress_json, total_questions, answered_questions, summary_facts, summary_gaps, summary_constraints, summary_pain_points, started_at, completed_at, last_activity_at, created_at) VALUES
-- Completed session
('session-dt-discovery', 'org-dbr77-test', 'proj-dt-2026', 'user-dbr77-admin', 'user-dbr77-admin', 'Digital Transformation Discovery - Q1 2026', 'Digital Maturity Assessment', 'tpl-digital-maturity', 'completed', 
'{"strategy": 100, "operations": 100, "digital": 100, "people": 80, "finance": 100}',
25, 24,
'["Company uses legacy ERP system (SAP R/3)", "Manual data entry in 60% of processes", "IT team of 5 people", "Annual IT budget: $500K", "Cloud adoption: 20%"]',
'["No clear digital roadmap", "Missing integration between systems", "Unclear ROI measurement methodology"]',
'["Budget limited to $500K/year", "IT team capacity constraints", "Legacy system dependencies"]',
'["Manual reporting takes 2 days/week", "Data silos between departments", "No real-time visibility into operations"]',
datetime('now', '-30 days'), datetime('now', '-25 days'), datetime('now', '-25 days'), datetime('now', '-30 days')),

-- In progress sessions
('session-lean-assessment', 'org-dbr77-test', 'proj-lean-manufacturing', 'user-pawel-wojcik', 'user-pawel-wojcik', 'Lean Manufacturing Baseline Assessment', 'Lean Assessment', 'tpl-lean-assessment', 'active',
'{"strategy": 80, "operations": 60, "digital": 40, "people": 20, "finance": 0}',
20, 12,
'["5S implemented in 2 areas", "OEE currently at 65%", "Changeover times average 45 minutes"]',
'["No TPM program", "Limited visual management", "Inconsistent standard work"]',
'["Production cannot stop for training", "Limited budget for tools"]',
'["High changeover times", "Unplanned downtime", "Quality variations between shifts"]',
datetime('now', '-15 days'), NULL, datetime('now', '-2 days'), datetime('now', '-15 days')),

('session-change-readiness', 'org-dbr77-test', 'proj-dt-2026', 'user-agnieszka-szymanska', 'user-agnieszka-szymanska', 'Change Readiness for ERP Migration', 'Change Management Assessment', 'tpl-change-readiness', 'active',
'{"strategy": 100, "operations": 50, "digital": 30, "people": 0, "finance": 0}',
18, 8,
'["Leadership supports transformation", "Previous change initiatives had mixed results", "Training budget available"]',
'["No formal change management methodology", "Communication gaps identified"]',
'["Resistance from long-tenured employees", "Limited time for training"]',
'["Fear of job loss", "Unclear benefits communication", "Past failed initiatives"]',
datetime('now', '-10 days'), NULL, datetime('now', '-1 days'), datetime('now', '-10 days')),

('session-data-discovery', 'org-dbr77-test', 'proj-data-governance', 'user-jan-nowak', 'user-jan-nowak', 'Data Governance Discovery', 'Data Management Assessment', 'tpl-data-governance', 'active',
'{"strategy": 60, "operations": 40, "digital": 20, "people": 0, "finance": 0}',
15, 6,
'["No formal data ownership", "Multiple sources of truth", "Excel widely used for reporting"]',
'["Data quality metrics not tracked", "No data catalog", "Unclear data lineage"]',
'["No dedicated data team", "Legacy systems hard to integrate"]',
'["Inconsistent customer data", "Report reconciliation issues", "Compliance concerns"]',
datetime('now', '-7 days'), NULL, datetime('now', '-1 days'), datetime('now', '-7 days')),

-- Paused session
('session-customer-journey', 'org-dbr77-test', 'proj-customer-experience', 'user-maria-wisniewska', 'user-maria-wisniewska', 'Customer Journey Mapping Workshop', 'Customer Experience Discovery', 'tpl-customer-journey', 'paused',
'{"strategy": 40, "operations": 20, "digital": 0, "people": 0, "finance": 0}',
12, 3,
'["3 main customer segments identified", "NPS score: 42"]',
'["Journey maps incomplete", "Feedback loop not closed"]',
'["Key stakeholders unavailable"]',
'["Long response times", "Inconsistent service quality"]',
datetime('now', '-20 days'), NULL, datetime('now', '-12 days'), datetime('now', '-20 days'));

-- ============================================================================
-- INTERVIEW QUESTIONS (for each session)
-- ============================================================================

-- Questions for completed session (Digital Transformation)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, answered_by, answered_at, tags, sort_order, created_at) VALUES
('q-dt-001', 'session-dt-discovery', 'org-dbr77-test', 'strategy', 'What is your digital transformation vision?', 'Our vision is to become a digitally-enabled organization with real-time data visibility and automated processes within 3 years.', 'answered', 4, 'user-dbr77-admin', datetime('now', '-28 days'), '["vision", "strategy"]', 1, datetime('now', '-30 days')),
('q-dt-002', 'session-dt-discovery', 'org-dbr77-test', 'strategy', 'How does digital transformation align with business strategy?', 'Digital transformation is one of our 5 strategic pillars, directly linked to cost reduction and customer satisfaction goals.', 'answered', 5, 'user-dbr77-admin', datetime('now', '-28 days'), '["strategy", "alignment"]', 2, datetime('now', '-30 days')),
('q-dt-003', 'session-dt-discovery', 'org-dbr77-test', 'digital', 'What is your current technology stack?', 'We use SAP R/3 for ERP, Salesforce for CRM, and various Excel-based tools for reporting. Infrastructure is 80% on-premises.', 'answered', 5, 'user-michal-zielinski', datetime('now', '-27 days'), '["technology", "infrastructure"]', 3, datetime('now', '-30 days')),
('q-dt-004', 'session-dt-discovery', 'org-dbr77-test', 'digital', 'What are your main integration challenges?', 'Systems are poorly integrated - data is manually transferred between SAP and Salesforce. No API strategy exists.', 'answered', 4, 'user-michal-zielinski', datetime('now', '-27 days'), '["integration", "challenge"]', 4, datetime('now', '-30 days')),
('q-dt-005', 'session-dt-discovery', 'org-dbr77-test', 'operations', 'How much manual work exists in core processes?', 'Approximately 60% of data entry is manual. Order processing takes 3 days due to manual approvals and data re-entry.', 'answered', 4, 'user-tomasz-lewandowski', datetime('now', '-26 days'), '["manual", "process", "waste"]', 5, datetime('now', '-30 days')),
('q-dt-006', 'session-dt-discovery', 'org-dbr77-test', 'operations', 'What are your biggest operational pain points?', 'Reporting takes too long, inventory accuracy is poor, and production planning relies on outdated data.', 'answered', 5, 'user-pawel-wojcik', datetime('now', '-26 days'), '["pain-point", "operations"]', 6, datetime('now', '-30 days')),
('q-dt-007', 'session-dt-discovery', 'org-dbr77-test', 'people', 'What is the digital skill level of your workforce?', 'Mixed - younger employees are tech-savvy, but many production workers struggle with new systems. Training is limited.', 'answered', 3, 'user-agnieszka-szymanska', datetime('now', '-25 days'), '["skills", "training", "gap"]', 7, datetime('now', '-30 days')),
('q-dt-008', 'session-dt-discovery', 'org-dbr77-test', 'people', 'How do you manage change resistance?', 'We have had mixed results. Previous ERP implementations faced significant resistance. No formal change management process.', 'needs_follow_up', 2, 'user-agnieszka-szymanska', datetime('now', '-25 days'), '["change", "resistance", "risk"]', 8, datetime('now', '-30 days')),
('q-dt-009', 'session-dt-discovery', 'org-dbr77-test', 'finance', 'What is your IT budget and how is it allocated?', 'Annual IT budget is $500K. 70% goes to maintenance, 20% to new projects, 10% to training.', 'answered', 5, 'user-dbr77-admin', datetime('now', '-25 days'), '["budget", "investment"]', 9, datetime('now', '-30 days')),
('q-dt-010', 'session-dt-discovery', 'org-dbr77-test', 'finance', 'How do you measure ROI on digital investments?', 'We track basic metrics like cost savings, but lack a formal ROI framework. Benefits are often not quantified.', 'answered', 3, 'user-dbr77-admin', datetime('now', '-25 days'), '["roi", "measurement", "gap"]', 10, datetime('now', '-30 days'));

-- Questions for Lean Assessment (in progress)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, answered_by, answered_at, tags, sort_order, created_at) VALUES
('q-lean-001', 'session-lean-assessment', 'org-dbr77-test', 'strategy', 'What is your lean manufacturing vision?', 'We aim to achieve world-class OEE of 85% and reduce waste by 50% within 2 years.', 'answered', 4, 'user-pawel-wojcik', datetime('now', '-14 days'), '["vision", "lean"]', 1, datetime('now', '-15 days')),
('q-lean-002', 'session-lean-assessment', 'org-dbr77-test', 'operations', 'How do you currently identify waste?', 'We use basic waste walks and have started value stream mapping for key processes.', 'answered', 3, 'user-tomasz-lewandowski', datetime('now', '-13 days'), '["waste", "vsm"]', 2, datetime('now', '-15 days')),
('q-lean-003', 'session-lean-assessment', 'org-dbr77-test', 'operations', 'What lean tools are currently in use?', '5S is implemented in 2 areas, we have a suggestion system, and use basic visual management boards.', 'answered', 4, 'user-tomasz-lewandowski', datetime('now', '-12 days'), '["tools", "5s"]', 3, datetime('now', '-15 days')),
('q-lean-004', 'session-lean-assessment', 'org-dbr77-test', 'operations', 'What is your current OEE?', 'Overall OEE is 65%. Availability is 80%, Performance is 85%, Quality is 96%.', 'answered', 5, 'user-pawel-wojcik', datetime('now', '-10 days'), '["oee", "metrics"]', 4, datetime('now', '-15 days')),
('q-lean-005', 'session-lean-assessment', 'org-dbr77-test', 'operations', 'What are your changeover times?', 'Average changeover is 45 minutes. Line 3 has the longest at 90 minutes.', 'answered', 5, 'user-tomasz-lewandowski', datetime('now', '-8 days'), '["smed", "changeover"]', 5, datetime('now', '-15 days')),
('q-lean-006', 'session-lean-assessment', 'org-dbr77-test', 'digital', 'How do you track production data?', 'Mostly manual on paper forms. Some data entered into Excel at end of shift.', 'answered', 4, 'user-michal-zielinski', datetime('now', '-5 days'), '["data", "tracking"]', 6, datetime('now', '-15 days')),
('q-lean-007', 'session-lean-assessment', 'org-dbr77-test', 'digital', 'What MES/MOM systems do you have?', 'No MES currently. Looking at options as part of digital transformation.', 'answered', 5, 'user-michal-zielinski', datetime('now', '-3 days'), '["mes", "systems"]', 7, datetime('now', '-15 days')),
('q-lean-008', 'session-lean-assessment', 'org-dbr77-test', 'people', 'How are operators involved in improvement?', NULL, 'not_started', 0, NULL, NULL, '["kaizen", "engagement"]', 8, datetime('now', '-15 days')),
('q-lean-009', 'session-lean-assessment', 'org-dbr77-test', 'people', 'What lean training exists?', NULL, 'not_started', 0, NULL, NULL, '["training", "skills"]', 9, datetime('now', '-15 days')),
('q-lean-010', 'session-lean-assessment', 'org-dbr77-test', 'finance', 'How do you measure lean benefits?', NULL, 'not_started', 0, NULL, NULL, '["roi", "benefits"]', 10, datetime('now', '-15 days'));

-- Questions for Change Readiness (in progress)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, answered_by, answered_at, tags, sort_order, created_at) VALUES
('q-change-001', 'session-change-readiness', 'org-dbr77-test', 'strategy', 'How does leadership communicate change?', 'Town halls quarterly, email updates monthly. CEO is visible champion of transformation.', 'answered', 4, 'user-agnieszka-szymanska', datetime('now', '-9 days'), '["communication", "leadership"]', 1, datetime('now', '-10 days')),
('q-change-002', 'session-change-readiness', 'org-dbr77-test', 'strategy', 'What is the change governance structure?', 'Steering committee meets monthly. No dedicated change management office.', 'answered', 3, 'user-agnieszka-szymanska', datetime('now', '-8 days'), '["governance", "structure"]', 2, datetime('now', '-10 days')),
('q-change-003', 'session-change-readiness', 'org-dbr77-test', 'operations', 'How are processes documented for change?', 'Limited documentation. Some SOPs exist but many are outdated.', 'answered', 2, 'user-tomasz-lewandowski', datetime('now', '-7 days'), '["documentation", "process"]', 3, datetime('now', '-10 days')),
('q-change-004', 'session-change-readiness', 'org-dbr77-test', 'operations', 'What impact assessment is done?', 'Basic impact analysis for major changes. No formal methodology.', 'answered', 3, 'user-agnieszka-szymanska', datetime('now', '-5 days'), '["impact", "assessment"]', 4, datetime('now', '-10 days')),
('q-change-005', 'session-change-readiness', 'org-dbr77-test', 'digital', 'How do you train on new systems?', NULL, 'in_progress', 0, NULL, NULL, '["training", "systems"]', 5, datetime('now', '-10 days')),
('q-change-006', 'session-change-readiness', 'org-dbr77-test', 'people', 'What is employee sentiment?', NULL, 'not_started', 0, NULL, NULL, '["sentiment", "engagement"]', 6, datetime('now', '-10 days')),
('q-change-007', 'session-change-readiness', 'org-dbr77-test', 'people', 'How do you handle resistance?', NULL, 'not_started', 0, NULL, NULL, '["resistance", "management"]', 7, datetime('now', '-10 days')),
('q-change-008', 'session-change-readiness', 'org-dbr77-test', 'finance', 'What is the change budget?', NULL, 'not_started', 0, NULL, NULL, '["budget", "resources"]', 8, datetime('now', '-10 days'));

-- ============================================================================
-- INTERVIEW NOTES
-- ============================================================================

INSERT OR IGNORE INTO interview_notes (id, session_id, organization_id, category, title, content, created_by, created_at) VALUES
('note-dt-001', 'session-dt-discovery', 'org-dbr77-test', 'strategy', 'Key Insight: Digital Roadmap Gap', 'The organization lacks a formal digital roadmap. This is a critical gap that should be addressed before major investments.', 'user-dbr77-admin', datetime('now', '-28 days')),
('note-dt-002', 'session-dt-discovery', 'org-dbr77-test', 'digital', 'Integration Priority', 'SAP-Salesforce integration should be prioritized. Current manual process causes 3-day delays in order processing.', 'user-michal-zielinski', datetime('now', '-27 days')),
('note-dt-003', 'session-dt-discovery', 'org-dbr77-test', 'people', 'Change Management Risk', 'Previous failed implementations have created skepticism. Need strong change management for ERP migration.', 'user-agnieszka-szymanska', datetime('now', '-25 days')),
('note-lean-001', 'session-lean-assessment', 'org-dbr77-test', 'operations', 'SMED Opportunity', 'Line 3 changeover of 90 minutes is a major opportunity. SMED workshop could reduce this by 50%.', 'user-tomasz-lewandowski', datetime('now', '-12 days')),
('note-lean-002', 'session-lean-assessment', 'org-dbr77-test', 'digital', 'MES Requirement', 'Manual data collection is limiting improvement efforts. MES is prerequisite for advanced analytics.', 'user-michal-zielinski', datetime('now', '-5 days')),
('note-change-001', 'session-change-readiness', 'org-dbr77-test', 'people', 'Training Gap', 'No structured training program exists. This will be critical for ERP adoption.', 'user-agnieszka-szymanska', datetime('now', '-7 days'));

-- ============================================================================
-- INTERVIEW INSIGHTS (extracted insights)
-- ============================================================================

INSERT OR IGNORE INTO interview_insights (id, session_id, organization_id, category, title, description, source_quote, insight_type, impact_level, confidence, pmo_domain, actionable, status, created_by, created_at) VALUES
('insight-001', 'session-dt-discovery', 'org-dbr77-test', 'digital', 'Legacy System Dependency', 'Heavy reliance on SAP R/3 creates integration challenges and limits agility', 'Systems are poorly integrated - data is manually transferred between SAP and Salesforce', 'constraint', 'high', 'high', 'technology', 1, 'validated', 'user-dbr77-admin', datetime('now', '-25 days')),
('insight-002', 'session-dt-discovery', 'org-dbr77-test', 'operations', 'Manual Process Waste', '60% manual data entry creates significant waste and error potential', 'Approximately 60% of data entry is manual. Order processing takes 3 days', 'pain_point', 'high', 'high', 'process', 1, 'validated', 'user-tomasz-lewandowski', datetime('now', '-26 days')),
('insight-003', 'session-dt-discovery', 'org-dbr77-test', 'people', 'Change Resistance Risk', 'Previous failed implementations have created organizational skepticism', 'Previous ERP implementations faced significant resistance. No formal change management process', 'risk', 'high', 'medium', 'change', 1, 'validated', 'user-agnieszka-szymanska', datetime('now', '-25 days')),
('insight-004', 'session-dt-discovery', 'org-dbr77-test', 'finance', 'ROI Measurement Gap', 'Lack of formal ROI framework limits ability to justify investments', 'We track basic metrics like cost savings, but lack a formal ROI framework', 'gap', 'medium', 'high', 'governance', 1, 'validated', 'user-dbr77-admin', datetime('now', '-25 days')),
('insight-005', 'session-lean-assessment', 'org-dbr77-test', 'operations', 'OEE Improvement Potential', 'Current OEE of 65% indicates significant improvement opportunity', 'Overall OEE is 65%. Availability is 80%, Performance is 85%, Quality is 96%', 'opportunity', 'high', 'high', 'operations', 1, 'draft', 'user-pawel-wojcik', datetime('now', '-10 days')),
('insight-006', 'session-lean-assessment', 'org-dbr77-test', 'operations', 'SMED Priority', 'Line 3 changeover time of 90 minutes is major bottleneck', 'Average changeover is 45 minutes. Line 3 has the longest at 90 minutes', 'opportunity', 'high', 'high', 'operations', 1, 'draft', 'user-tomasz-lewandowski', datetime('now', '-8 days')),
('insight-007', 'session-lean-assessment', 'org-dbr77-test', 'digital', 'MES Prerequisite', 'Manual data collection prevents real-time visibility and analytics', 'Mostly manual on paper forms. Some data entered into Excel at end of shift', 'gap', 'high', 'high', 'technology', 1, 'draft', 'user-michal-zielinski', datetime('now', '-5 days')),
('insight-008', 'session-change-readiness', 'org-dbr77-test', 'people', 'Documentation Gap', 'Outdated SOPs will complicate training and change management', 'Limited documentation. Some SOPs exist but many are outdated', 'gap', 'medium', 'medium', 'process', 1, 'draft', 'user-agnieszka-szymanska', datetime('now', '-7 days'));

-- ============================================================================
-- INTERVIEW ASSIGNMENTS (Inbox items)
-- ============================================================================

INSERT OR IGNORE INTO interview_assignments (id, organization_id, assignee_user_id, template_id, template_version, process_ref, status, session_id, due_at, started_at, submitted_at, created_by, created_at) VALUES
-- Assigned (not started)
('assign-001', 'org-dbr77-test', 'user-dbr77-admin', 'tpl-process-efficiency', 1, 'proj-automation-rpa', 'assigned', NULL, datetime('now', '+7 days'), NULL, NULL, 'user-tomasz-lewandowski', datetime('now', '-3 days')),
('assign-002', 'org-dbr77-test', 'user-jan-nowak', 'tpl-digital-maturity', 1, 'proj-erp-upgrade', 'assigned', NULL, datetime('now', '+14 days'), NULL, NULL, 'user-michal-zielinski', datetime('now', '-2 days')),
('assign-003', 'org-dbr77-test', 'user-maria-wisniewska', 'tpl-customer-journey', 1, 'proj-customer-experience', 'assigned', NULL, datetime('now', '+10 days'), NULL, NULL, 'user-dbr77-admin', datetime('now', '-1 days')),

-- In progress
('assign-004', 'org-dbr77-test', 'user-tomasz-lewandowski', 'tpl-lean-assessment', 1, 'proj-lean-manufacturing', 'in_progress', 'session-lean-assessment', datetime('now', '+5 days'), datetime('now', '-15 days'), NULL, 'user-pawel-wojcik', datetime('now', '-20 days')),
('assign-005', 'org-dbr77-test', 'user-agnieszka-szymanska', 'tpl-change-readiness', 1, 'proj-dt-2026', 'in_progress', 'session-change-readiness', datetime('now', '+3 days'), datetime('now', '-10 days'), NULL, 'user-dbr77-admin', datetime('now', '-15 days')),

-- Submitted (awaiting review)
('assign-006', 'org-dbr77-test', 'user-katarzyna-dabrowska', 'tpl-lean-assessment', 1, 'proj-lean-manufacturing', 'submitted', NULL, datetime('now', '-2 days'), datetime('now', '-10 days'), datetime('now', '-3 days'), 'user-pawel-wojcik', datetime('now', '-15 days')),

-- Completed
('assign-007', 'org-dbr77-test', 'user-michal-zielinski', 'tpl-digital-maturity', 1, 'proj-dt-2026', 'completed', 'session-dt-discovery', datetime('now', '-25 days'), datetime('now', '-30 days'), datetime('now', '-25 days'), 'user-dbr77-admin', datetime('now', '-35 days'));

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Templates: 6 interview templates
-- Sessions: 5 sessions (1 completed, 3 active, 1 paused)
-- Questions: 28 questions across sessions
-- Notes: 6 notes
-- Insights: 8 insights
-- Assignments: 7 assignments (3 assigned, 2 in_progress, 1 submitted, 1 completed)
-- ============================================================================
