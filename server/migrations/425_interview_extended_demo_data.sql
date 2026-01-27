-- INTERVIEW-DEMO-002: Extended demo data for Interview module
-- Migration: 425_interview_extended_demo_data.sql
-- Purpose: Seed comprehensive demo data (min 10 records per table) for Interview module
-- Date: 2026-01-27

-- ==========================================
-- INTERVIEW SESSIONS (10+ records)
-- Uses actual schema: project_id, user_id, topic, status, progress
-- ==========================================

-- Session 4: Active - Manufacturing Assessment
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, template_id
) VALUES (
    'demo_session_004',
    'project-dbr77-001',
    'admin-001',
    'Manufacturing Process Assessment',
    'active',
    '{"completed":["strategy","operations"],"current":"digital","remaining":["people","finance"]}',
    datetime('now', '-10 days'),
    'itpl_operational_excellence_v1'
);

-- Session 5: Completed - Supply Chain Interview
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, completed_at, template_id
) VALUES (
    'demo_session_005',
    'project-dbr77-001',
    'admin-001',
    'Supply Chain Optimization Discovery',
    'completed',
    '{"completed":["strategy","operations","digital","people","finance"],"current":null,"remaining":[]}',
    datetime('now', '-60 days'),
    datetime('now', '-50 days'),
    'itpl_cost_efficiency_v1'
);

-- Session 6: Active - HR & Culture Assessment
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, template_id
) VALUES (
    'demo_session_006',
    'project-dbr77-cx',
    'admin-001',
    'HR & Culture Transformation',
    'active',
    '{"completed":["strategy","people"],"current":"operations","remaining":["digital","finance"]}',
    datetime('now', '-7 days'),
    'itpl_digital_maturity_discovery_v1'
);

-- Session 7: Completed - Quality Management Interview
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, completed_at, template_id
) VALUES (
    'demo_session_007',
    'project-dbr77-001',
    'admin-001',
    'Quality Management System Review',
    'completed',
    '{"completed":["strategy","operations","digital","people","finance"],"current":null,"remaining":[]}',
    datetime('now', '-35 days'),
    datetime('now', '-28 days'),
    'itpl_standard_work_v1'
);

-- Session 8: Active - IT Infrastructure Assessment
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, template_id
) VALUES (
    'demo_session_008',
    'project-dbr77-dt2025',
    'admin-001',
    'IT Infrastructure Modernization',
    'active',
    '{"completed":["digital"],"current":"strategy","remaining":["operations","people","finance"]}',
    datetime('now', '-14 days'),
    'itpl_digital_maturity_discovery_v1'
);

-- Session 9: Completed - Customer Experience Interview
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, completed_at, template_id
) VALUES (
    'demo_session_009',
    'project-dbr77-cx',
    'admin-001',
    'Customer Experience Assessment',
    'completed',
    '{"completed":["strategy","operations","digital","people","finance"],"current":null,"remaining":[]}',
    datetime('now', '-20 days'),
    datetime('now', '-15 days'),
    'itpl_quick_assessment_v1'
);

-- Session 10: Active - Sustainability Assessment
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, template_id
) VALUES (
    'demo_session_010',
    'project-dbr77-001',
    'admin-001',
    'Sustainability & ESG Discovery',
    'active',
    '{"completed":["strategy","operations"],"current":"digital","remaining":["people","finance"]}',
    datetime('now', '-4 days'),
    'itpl_data_metrics_v1'
);

-- Session 11: Paused - Financial Analysis
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, template_id
) VALUES (
    'demo_session_011',
    'project-dbr77-001',
    'admin-001',
    'Financial Process Analysis',
    'paused',
    '{"completed":["strategy"],"current":"finance","remaining":["operations","digital","people"]}',
    datetime('now', '-21 days'),
    'itpl_cost_efficiency_v1'
);

-- Session 12: Active - Lean Assessment
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, template_id
) VALUES (
    'demo_session_012',
    'project-dbr77-dt2025',
    'admin-001',
    'Lean Manufacturing Assessment',
    'active',
    '{"completed":["operations"],"current":"strategy","remaining":["digital","people","finance"]}',
    datetime('now', '-3 days'),
    'itpl_operational_excellence_v1'
);

-- Session 13: Completed - Data Governance
INSERT OR IGNORE INTO interview_sessions (
    id, project_id, user_id, topic, status, progress,
    started_at, completed_at, template_id
) VALUES (
    'demo_session_013',
    'project-dbr77-dt2025',
    'admin-001',
    'Data Governance Discovery',
    'completed',
    '{"completed":["strategy","operations","digital","people","finance"],"current":null,"remaining":[]}',
    datetime('now', '-45 days'),
    datetime('now', '-38 days'),
    'itpl_data_metrics_v1'
);

-- ==========================================
-- INTERVIEW QUESTIONS (10+ per session)
-- ==========================================

-- Questions for Session 4 (Manufacturing)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, sort_order) VALUES
('demo_q_101', 'demo_session_004', 'demo-org', 'strategy', 'What are your manufacturing excellence goals?', 'Reduce cycle time by 25%, improve OEE to 85%, and achieve zero defects in critical processes.', 'answered', 4, 1),
('demo_q_102', 'demo_session_004', 'demo-org', 'strategy', 'How does manufacturing align with business strategy?', 'Manufacturing is seen as a competitive advantage. We compete on quality and flexibility, not just cost.', 'answered', 5, 2),
('demo_q_103', 'demo_session_004', 'demo-org', 'operations', 'What is your current OEE?', 'Overall OEE is 72%. Availability: 85%, Performance: 90%, Quality: 94%.', 'answered', 5, 3),
('demo_q_104', 'demo_session_004', 'demo-org', 'operations', 'What are the main causes of downtime?', 'Changeovers (35%), breakdowns (25%), material shortages (20%), other (20%).', 'answered', 4, 4),
('demo_q_105', 'demo_session_004', 'demo-org', 'operations', 'How do you handle production scheduling?', 'Weekly MRP run in SAP, daily adjustments in Excel by planners.', 'answered', 3, 5),
('demo_q_106', 'demo_session_004', 'demo-org', 'digital', 'What MES capabilities do you have?', 'Basic MES for tracking production orders, no real-time monitoring or analytics.', 'answered', 4, 6),
('demo_q_107', 'demo_session_004', 'demo-org', 'digital', 'How is machine data captured?', 'Manual entry by operators at end of shift. Some machines have PLCs but data is not integrated.', 'answered', 4, 7),
('demo_q_108', 'demo_session_004', 'demo-org', 'people', 'What is the skill level of operators?', NULL, 'in_progress', 0, 8),
('demo_q_109', 'demo_session_004', 'demo-org', 'people', 'How is continuous improvement organized?', NULL, 'not_started', 0, 9),
('demo_q_110', 'demo_session_004', 'demo-org', 'finance', 'What is the manufacturing cost breakdown?', NULL, 'not_started', 0, 10);

-- Questions for Session 5 (Supply Chain)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, sort_order) VALUES
('demo_q_201', 'demo_session_005', 'demo-org', 'strategy', 'What is your supply chain strategy?', 'Balanced approach: cost efficiency with resilience. Dual sourcing for critical materials.', 'answered', 5, 1),
('demo_q_202', 'demo_session_005', 'demo-org', 'strategy', 'How do you manage supply chain risk?', 'Quarterly supplier reviews, safety stock for critical items, but no formal risk scoring.', 'answered', 4, 2),
('demo_q_203', 'demo_session_005', 'demo-org', 'operations', 'How is demand forecasting done?', 'Monthly S&OP process, Excel-based forecasts from sales team, 70% accuracy.', 'answered', 4, 3),
('demo_q_204', 'demo_session_005', 'demo-org', 'operations', 'What is your inventory policy?', 'Min-max levels in ERP, 30-day safety stock for A-items, 60-day for B-items.', 'answered', 5, 4),
('demo_q_205', 'demo_session_005', 'demo-org', 'operations', 'How do you manage supplier performance?', 'Quarterly scorecards: delivery, quality, cost. Top 10 suppliers reviewed monthly.', 'answered', 4, 5),
('demo_q_206', 'demo_session_005', 'demo-org', 'digital', 'What systems support supply chain?', 'SAP MM/PP, Excel for planning, email for supplier communication.', 'answered', 5, 6),
('demo_q_207', 'demo_session_005', 'demo-org', 'digital', 'Do you have supply chain visibility?', 'Limited. We see our inventory but not supplier or in-transit inventory.', 'answered', 4, 7),
('demo_q_208', 'demo_session_005', 'demo-org', 'people', 'How is the supply chain team organized?', '12 people: 4 planners, 3 buyers, 2 logistics, 2 analysts, 1 manager.', 'answered', 5, 8),
('demo_q_209', 'demo_session_005', 'demo-org', 'people', 'What skills are missing?', 'Data analytics, demand sensing, supplier development.', 'answered', 4, 9),
('demo_q_210', 'demo_session_005', 'demo-org', 'finance', 'What is the supply chain cost?', 'Total: $12M/year. Logistics: 40%, inventory carrying: 25%, procurement: 35%.', 'answered', 5, 10);

-- Questions for Session 6 (HR & Culture)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, sort_order) VALUES
('demo_q_301', 'demo_session_006', 'demo-org', 'strategy', 'What is your people strategy?', 'Become employer of choice, develop internal talent, reduce turnover to <10%.', 'answered', 5, 1),
('demo_q_302', 'demo_session_006', 'demo-org', 'strategy', 'How does culture support business goals?', 'We aim for continuous improvement culture, but execution varies by department.', 'answered', 4, 2),
('demo_q_303', 'demo_session_006', 'demo-org', 'operations', 'What is current employee turnover?', '15% overall, 25% in production, 8% in office roles.', 'answered', 5, 3),
('demo_q_304', 'demo_session_006', 'demo-org', 'operations', 'How is performance managed?', 'Annual reviews, no continuous feedback system, limited goal alignment.', 'answered', 4, 4),
('demo_q_305', 'demo_session_006', 'demo-org', 'digital', 'What HR systems do you use?', 'SAP HCM for payroll, Excel for everything else.', 'answered', 4, 5),
('demo_q_306', 'demo_session_006', 'demo-org', 'people', 'How is training delivered?', 'Mostly on-the-job, some classroom for safety. No LMS.', 'answered', 4, 6),
('demo_q_307', 'demo_session_006', 'demo-org', 'people', 'What is employee engagement level?', NULL, 'in_progress', 0, 7),
('demo_q_308', 'demo_session_006', 'demo-org', 'people', 'How do you identify high potentials?', NULL, 'not_started', 0, 8),
('demo_q_309', 'demo_session_006', 'demo-org', 'finance', 'What is the HR budget?', NULL, 'not_started', 0, 9),
('demo_q_310', 'demo_session_006', 'demo-org', 'finance', 'What is the cost of turnover?', NULL, 'not_started', 0, 10);

-- Questions for Session 7 (Quality)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, sort_order) VALUES
('demo_q_401', 'demo_session_007', 'demo-org', 'strategy', 'What is your quality strategy?', 'Zero defects philosophy, ISO 9001 certified, customer satisfaction focus.', 'answered', 5, 1),
('demo_q_402', 'demo_session_007', 'demo-org', 'operations', 'What is your current DPPM?', '2500 DPPM, target is 1000. Main issues on Line 3.', 'answered', 5, 2),
('demo_q_403', 'demo_session_007', 'demo-org', 'operations', 'How do you handle non-conformances?', 'NCR system in place, root cause analysis for major issues, corrective actions tracked.', 'answered', 4, 3),
('demo_q_404', 'demo_session_007', 'demo-org', 'digital', 'What QMS system do you use?', 'Paper-based with some Excel tracking. No integrated QMS software.', 'answered', 4, 4),
('demo_q_405', 'demo_session_007', 'demo-org', 'people', 'How are quality inspectors trained?', 'On-the-job training, annual certification for critical inspections.', 'answered', 4, 5);

-- Questions for Session 8 (IT)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, sort_order) VALUES
('demo_q_501', 'demo_session_008', 'demo-org', 'digital', 'What is your current IT infrastructure?', '100% on-premises, 7-year-old servers, Windows Server 2016.', 'answered', 5, 1),
('demo_q_502', 'demo_session_008', 'demo-org', 'digital', 'What is your cloud strategy?', 'Evaluating Azure for non-critical workloads. Security concerns for production data.', 'answered', 4, 2),
('demo_q_503', 'demo_session_008', 'demo-org', 'digital', 'How do you handle integrations?', 'Point-to-point, mostly manual file transfers. No integration platform.', 'answered', 4, 3),
('demo_q_504', 'demo_session_008', 'demo-org', 'strategy', 'What is the IT budget?', NULL, 'in_progress', 0, 4),
('demo_q_505', 'demo_session_008', 'demo-org', 'people', 'What is the IT team structure?', NULL, 'not_started', 0, 5);

-- ==========================================
-- INTERVIEW NOTES (10+ records)
-- ==========================================

INSERT OR IGNORE INTO interview_notes (id, session_id, organization_id, category, title, content, created_by) VALUES
('demo_note_004', 'demo_session_004', 'demo-org', 'operations', 'OEE Improvement Potential', 'Based on the breakdown, changeover reduction could add 10% to OEE. SMED workshop recommended.', 'admin-001'),
('demo_note_005', 'demo_session_004', 'demo-org', 'digital', 'MES Gap', 'Current MES is outdated (2015). No real-time visibility. Consider cloud MES evaluation.', 'admin-001'),
('demo_note_006', 'demo_session_005', 'demo-org', 'strategy', 'Risk Assessment', 'Single source for 3 critical components. Need to develop alternative suppliers.', 'admin-001'),
('demo_note_007', 'demo_session_005', 'demo-org', 'operations', 'Forecast Accuracy', '70% accuracy is below benchmark (85%). AI/ML forecasting could help.', 'admin-001'),
('demo_note_008', 'demo_session_006', 'demo-org', 'people', 'Turnover Root Cause', 'Exit interviews show: 40% compensation, 30% career growth, 30% management.', 'admin-001'),
('demo_note_009', 'demo_session_007', 'demo-org', 'operations', 'Line 3 Quality Issue', 'Root cause: worn tooling and inconsistent material from new supplier.', 'admin-001'),
('demo_note_010', 'demo_session_008', 'demo-org', 'digital', 'Cloud Migration', 'IT team prefers Azure. Current on-prem infrastructure is 7 years old.', 'admin-001'),
('demo_note_011', 'demo_session_009', 'demo-org', 'strategy', 'CX Priority', 'CEO wants NPS > 50 by end of year. Current focus on response time reduction.', 'admin-001'),
('demo_note_012', 'demo_session_010', 'demo-org', 'strategy', 'ESG Pressure', 'Key customers requiring carbon footprint reporting by Q3. No current capability.', 'admin-001'),
('demo_note_013', 'demo_session_010', 'demo-org', 'operations', 'Energy Consumption', 'Production accounts for 80% of energy use. No sub-metering by line.', 'admin-001'),
('demo_note_014', 'demo_session_011', 'demo-org', 'finance', 'Budget Constraints', 'CFO wants ROI within 18 months for any new investment. Cash flow tight in Q2.', 'admin-001'),
('demo_note_015', 'demo_session_012', 'demo-org', 'operations', 'Lean Maturity', 'Some 5S implemented, no formal kaizen program. Opportunity for quick wins.', 'admin-001');

-- ==========================================
-- INTERVIEW EVIDENCE (10+ records)
-- ==========================================

INSERT OR IGNORE INTO interview_evidence (id, session_id, organization_id, question_id, evidence_type, title, description, file_name, file_type, uploaded_by) VALUES
('demo_ev_001', 'demo_session_004', 'demo-org', 'demo_q_103', 'document', 'OEE Report Q4 2025', 'Monthly OEE tracking report from production', 'oee_report_q4_2025.pdf', 'application/pdf', 'admin-001'),
('demo_ev_002', 'demo_session_004', 'demo-org', 'demo_q_104', 'document', 'Downtime Analysis', 'Pareto analysis of downtime causes', 'downtime_pareto.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'admin-001'),
('demo_ev_003', 'demo_session_005', 'demo-org', 'demo_q_204', 'document', 'Inventory Policy Document', 'Current inventory management policy', 'inventory_policy_v3.pdf', 'application/pdf', 'admin-001'),
('demo_ev_004', 'demo_session_005', 'demo-org', NULL, 'link', 'Supplier Portal', 'Link to supplier management portal', NULL, NULL, 'admin-001'),
('demo_ev_005', 'demo_session_006', 'demo-org', 'demo_q_303', 'document', 'Turnover Report 2025', 'Annual turnover analysis by department', 'turnover_report_2025.pdf', 'application/pdf', 'admin-001'),
('demo_ev_006', 'demo_session_007', 'demo-org', NULL, 'document', 'ISO 9001 Certificate', 'Current ISO 9001:2015 certification', 'iso_9001_cert.pdf', 'application/pdf', 'admin-001'),
('demo_ev_007', 'demo_session_007', 'demo-org', NULL, 'document', 'Quality Metrics Dashboard', 'Screenshot of quality KPI dashboard', 'quality_dashboard.png', 'image/png', 'admin-001'),
('demo_ev_008', 'demo_session_008', 'demo-org', NULL, 'document', 'IT Architecture Diagram', 'Current state IT architecture', 'it_architecture_current.pdf', 'application/pdf', 'admin-001'),
('demo_ev_009', 'demo_session_009', 'demo-org', NULL, 'document', 'NPS Survey Results', 'Q4 2025 NPS survey detailed results', 'nps_survey_q4_2025.pdf', 'application/pdf', 'admin-001'),
('demo_ev_010', 'demo_session_010', 'demo-org', NULL, 'document', 'Energy Consumption Report', 'Annual energy consumption by facility', 'energy_report_2025.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'admin-001'),
('demo_ev_011', 'demo_session_010', 'demo-org', NULL, 'link', 'ESG Framework Reference', 'Link to GRI standards reference', NULL, NULL, 'admin-001'),
('demo_ev_012', 'demo_session_012', 'demo-org', NULL, 'document', 'Lean Assessment Checklist', '5S audit results from last month', 'lean_5s_audit.pdf', 'application/pdf', 'admin-001');

-- ==========================================
-- INTERVIEW INSIGHTS (10+ records)
-- Uses actual schema: session_id, category, title, description, insight_type, etc.
-- ==========================================

INSERT OR IGNORE INTO interview_insights (
    id, session_id, organization_id, category, title, description, 
    source_quote, insight_type, impact_level, confidence, status, created_by
) VALUES 
(
    'demo_insight_004',
    'demo_session_004',
    'demo-org',
    'operations',
    'OEE Improvement Opportunity',
    'Current OEE of 72% is below world-class benchmark of 85%. Changeover reduction through SMED could add 10% to OEE.',
    'Changeovers account for 35% of downtime',
    'opportunity',
    'high',
    'high',
    'draft',
    'admin-001'
),
(
    'demo_insight_005',
    'demo_session_004',
    'demo-org',
    'digital',
    'Real-time Visibility Gap',
    'No real-time production monitoring. Manual data entry delays decisions by 8+ hours.',
    'Manual entry by operators at end of shift',
    'gap',
    'high',
    'high',
    'draft',
    'admin-001'
),
(
    'demo_insight_006',
    'demo_session_005',
    'demo-org',
    'strategy',
    'Single Source Risk',
    '3 critical components have no alternative supplier. Lead time for qualification is 8-12 weeks.',
    'Dual sourcing for critical materials - but 3 components still single source',
    'risk',
    'critical',
    'high',
    'draft',
    'admin-001'
),
(
    'demo_insight_007',
    'demo_session_005',
    'demo-org',
    'operations',
    'Forecast Accuracy Below Benchmark',
    '70% forecast accuracy vs 85% industry benchmark. AI/ML forecasting recommended.',
    '70% accuracy - Monthly S&OP process, Excel-based',
    'gap',
    'high',
    'medium',
    'draft',
    'admin-001'
),
(
    'demo_insight_008',
    'demo_session_006',
    'demo-org',
    'people',
    'High Production Turnover',
    '25% turnover in production vs 8% in office. Root causes: compensation (40%), career growth (30%), management (30%).',
    '15% overall, 25% in production, 8% in office roles',
    'problem',
    'high',
    'high',
    'draft',
    'admin-001'
),
(
    'demo_insight_009',
    'demo_session_007',
    'demo-org',
    'operations',
    'Line 3 Quality Issue Root Cause',
    'DPPM on Line 3 is 2x plant average. Root cause: worn tooling and inconsistent material from new supplier.',
    '2500 DPPM, target is 1000. Main issues on Line 3',
    'problem',
    'high',
    'high',
    'draft',
    'admin-001'
),
(
    'demo_insight_010',
    'demo_session_008',
    'demo-org',
    'digital',
    'Infrastructure Modernization Needed',
    '7-year-old on-premises infrastructure limiting digital transformation. Azure migration recommended.',
    '100% on-premises, 7-year-old servers',
    'recommendation',
    'high',
    'high',
    'draft',
    'admin-001'
),
(
    'demo_insight_011',
    'demo_session_009',
    'demo-org',
    'strategy',
    'NPS Improvement Priority',
    'CEO target: NPS > 50 (current: 42). Focus on response time reduction and self-service.',
    'CEO wants NPS > 50 by end of year',
    'priority',
    'high',
    'high',
    'draft',
    'admin-001'
),
(
    'demo_insight_012',
    'demo_session_010',
    'demo-org',
    'strategy',
    'ESG Reporting Urgency',
    'Key customers requiring carbon footprint reporting by Q3. No current capability - urgent action needed.',
    'Key customers requiring carbon footprint reporting by Q3',
    'risk',
    'critical',
    'high',
    'draft',
    'admin-001'
),
(
    'demo_insight_013',
    'demo_session_010',
    'demo-org',
    'operations',
    'Energy Sub-metering Gap',
    'Production accounts for 80% of energy use but no sub-metering by line. Cannot identify optimization opportunities.',
    'Production accounts for 80% of energy use. No sub-metering by line.',
    'gap',
    'medium',
    'high',
    'draft',
    'admin-001'
),
(
    'demo_insight_014',
    'demo_session_012',
    'demo-org',
    'operations',
    'Lean Quick Wins Available',
    'Some 5S implemented but no formal kaizen program. Quick wins available in changeover reduction and visual management.',
    'Some 5S implemented, no formal kaizen program',
    'opportunity',
    'medium',
    'medium',
    'draft',
    'admin-001'
),
(
    'demo_insight_015',
    'demo_session_013',
    'demo-org',
    'digital',
    'Data Governance Foundation Needed',
    'No single source of truth for key entities. Data quality issues causing reporting delays and decision errors.',
    'Data silos across departments, manual reconciliation',
    'gap',
    'high',
    'high',
    'draft',
    'admin-001'
);

-- ==========================================
-- INTERVIEW ASSIGNMENTS (10+ records)
-- ==========================================

-- Assignment 4: Completed
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, started_at, submitted_at, priority, notes, created_by
) VALUES (
    'demo_assign_004',
    'demo-org',
    'admin-001',
    'itpl_digital_maturity_discovery_v1',
    1,
    'completed',
    datetime('now', '-20 days'),
    datetime('now', '-25 days'),
    datetime('now', '-22 days'),
    'high',
    'Completed ahead of schedule. Great insights gathered.',
    'admin-001'
);

-- Assignment 5: Submitted (awaiting review)
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, started_at, submitted_at, priority, created_by
) VALUES (
    'demo_assign_005',
    'demo-org',
    'e2e-user',
    'itpl_cost_efficiency_v1',
    1,
    'submitted',
    datetime('now', '+3 days'),
    datetime('now', '-7 days'),
    datetime('now', '-1 days'),
    'medium',
    'admin-001'
);

-- Assignment 6: Sent back for revision
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, started_at, sent_back_at, sent_back_reason, priority, created_by
) VALUES (
    'demo_assign_006',
    'demo-org',
    'e2e-user',
    'itpl_data_metrics_v1',
    1,
    'sent_back',
    datetime('now', '+5 days'),
    datetime('now', '-10 days'),
    datetime('now', '-2 days'),
    'Please add more detail to the finance section. Need specific cost figures.',
    'high',
    'admin-001'
);

-- Assignment 7: Pending (new)
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, priority, notes, created_by
) VALUES (
    'demo_assign_007',
    'demo-org',
    'e2e-user',
    'itpl_standard_work_v1',
    1,
    'assigned',
    datetime('now', '+14 days'),
    'low',
    'New assignment for standard work assessment. Take your time.',
    'admin-001'
);

-- Assignment 8: In Progress
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, started_at, priority, created_by
) VALUES (
    'demo_assign_008',
    'demo-org',
    'admin-001',
    'itpl_quick_assessment_v1',
    1,
    'in_progress',
    datetime('now', '+7 days'),
    datetime('now', '-2 days'),
    'medium',
    'admin-001'
);

-- Assignment 9: Overdue (urgent)
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, priority, notes, created_by
) VALUES (
    'demo_assign_009',
    'demo-org',
    'e2e-user',
    'itpl_operational_excellence_v1',
    1,
    'assigned',
    datetime('now', '-5 days'),
    'urgent',
    'OVERDUE! Please complete immediately. Steering committee waiting.',
    'admin-001'
);

-- Assignment 10: Completed (old)
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, started_at, submitted_at, priority, created_by
) VALUES (
    'demo_assign_010',
    'demo-org',
    'admin-001',
    'itpl_digital_maturity_discovery_v1',
    1,
    'completed',
    datetime('now', '-45 days'),
    datetime('now', '-50 days'),
    datetime('now', '-47 days'),
    'medium',
    'admin-001'
);

-- Assignment 11: In Progress (team)
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, started_at, priority, is_team_assignment, notes, created_by
) VALUES (
    'demo_assign_011',
    'demo-org',
    'admin-001',
    'itpl_cost_efficiency_v1',
    1,
    'in_progress',
    datetime('now', '+10 days'),
    datetime('now', '-1 days'),
    'high',
    1,
    'Team assignment - coordinate with operations and finance.',
    'admin-001'
);

-- Assignment 12: Pending (scheduled)
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, priority, notes, created_by
) VALUES (
    'demo_assign_012',
    'demo-org',
    'e2e-user',
    'itpl_data_metrics_v1',
    1,
    'assigned',
    datetime('now', '+21 days'),
    'medium',
    'Scheduled for next sprint. Focus on KPI definitions.',
    'admin-001'
);

-- Assignment 13: Completed with escalation
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, started_at, submitted_at, priority, escalated_at, escalation_count, created_by
) VALUES (
    'demo_assign_013',
    'demo-org',
    'e2e-user',
    'itpl_operational_excellence_v1',
    1,
    'completed',
    datetime('now', '-30 days'),
    datetime('now', '-35 days'),
    datetime('now', '-28 days'),
    'high',
    datetime('now', '-32 days'),
    1,
    'admin-001'
);
