-- INTERVIEW-DEMO-001: Demo data for Interview module
-- Migration: 420_interview_demo_data.sql
-- Purpose: Seed demo data for testing Interview module
-- Note: Uses demo organization ID from existing seed data

-- ==========================================
-- DEMO INTERVIEW SESSIONS
-- ==========================================

-- Get demo org ID (assuming it exists from previous seeds)
-- We'll use 'demo_org_001' as placeholder - adjust if needed

-- Session 1: Completed Digital Transformation Interview
INSERT OR IGNORE INTO interview_sessions (
    id, organization_id, project_id, name, owner_id, status,
    progress_json, total_questions, answered_questions,
    summary_facts, summary_gaps, summary_constraints, summary_pain_points,
    started_at, completed_at, last_activity_at
) VALUES (
    'demo_session_001',
    (SELECT id FROM organizations LIMIT 1),
    NULL,
    'Digital Transformation Discovery - Q1 2024',
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1),
    'completed',
    '{"strategy": 100, "operations": 100, "digital": 100, "people": 80, "finance": 100}',
    25, 24,
    '["Company uses legacy ERP system (SAP R/3)", "Manual data entry in 60% of processes", "IT team of 5 people", "Annual IT budget: $500K", "Cloud adoption: 20%"]',
    '["No clear digital roadmap", "Missing integration between systems", "Unclear ROI measurement methodology"]',
    '["Budget limited to $500K/year", "IT team capacity constraints", "Legacy system dependencies"]',
    '["Manual reporting takes 2 days/week", "Data silos between departments", "No real-time visibility into operations"]',
    datetime('now', '-30 days'),
    datetime('now', '-25 days'),
    datetime('now', '-25 days')
);

-- Session 2: Active Operational Excellence Interview
INSERT OR IGNORE INTO interview_sessions (
    id, organization_id, project_id, name, owner_id, status,
    progress_json, total_questions, answered_questions,
    started_at, last_activity_at
) VALUES (
    'demo_session_002',
    (SELECT id FROM organizations LIMIT 1),
    NULL,
    'Operational Excellence Assessment',
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1),
    'active',
    '{"strategy": 60, "operations": 40, "digital": 20, "people": 0, "finance": 0}',
    20, 6,
    datetime('now', '-5 days'),
    datetime('now', '-1 days')
);

-- Session 3: Completed Cost Efficiency Interview
INSERT OR IGNORE INTO interview_sessions (
    id, organization_id, project_id, name, owner_id, status,
    progress_json, total_questions, answered_questions,
    summary_facts, summary_gaps, summary_constraints, summary_pain_points,
    started_at, completed_at, last_activity_at
) VALUES (
    'demo_session_003',
    (SELECT id FROM organizations LIMIT 1),
    NULL,
    'Cost & Efficiency Baseline',
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1),
    'completed',
    '{"strategy": 100, "operations": 100, "digital": 100, "people": 100, "finance": 100}',
    15, 15,
    '["Current COGS: 65% of revenue", "Labor costs: 40% of COGS", "Energy costs increased 15% YoY", "Inventory turnover: 4x/year"]',
    '["No activity-based costing", "Limited visibility into indirect costs"]',
    '["Union agreements limit workforce flexibility", "Minimum inventory requirements from customers"]',
    '["High overtime costs (20% of labor)", "Scrap rate: 3.5%", "Expedited shipping: $200K/year"]',
    datetime('now', '-45 days'),
    datetime('now', '-40 days'),
    datetime('now', '-40 days')
);

-- ==========================================
-- DEMO INTERVIEW QUESTIONS (for active session)
-- ==========================================

-- Strategy questions
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, sort_order) VALUES
('demo_q_001', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'strategy', 'What are your main business objectives for the next 2-3 years?', 'Increase market share by 15%, reduce operational costs by 20%, and launch 3 new product lines.', 'answered', 4, 1),
('demo_q_002', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'strategy', 'What is your company''s vision for digital transformation?', 'Become a data-driven organization with automated core processes and real-time decision making capabilities.', 'answered', 5, 2),
('demo_q_003', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'strategy', 'What competitive advantages are you trying to build?', NULL, 'not_started', 0, 3);

-- Operations questions
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, sort_order) VALUES
('demo_q_004', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'operations', 'What are your main operational processes?', 'Order-to-cash, procure-to-pay, plan-to-produce, and hire-to-retire.', 'answered', 4, 1),
('demo_q_005', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'operations', 'Where do you see the biggest inefficiencies?', 'Manual data entry between systems, approval bottlenecks, and lack of standardized procedures.', 'answered', 3, 2),
('demo_q_006', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'operations', 'What are the main bottlenecks in your operations?', NULL, 'in_progress', 0, 3);

-- Digital questions
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, sort_order) VALUES
('demo_q_007', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'digital', 'What systems and tools do you currently use?', 'SAP ERP, Excel for reporting, Outlook for communication, custom Access databases.', 'answered', 5, 1),
('demo_q_008', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'digital', 'How would you rate your digital maturity (1-5)?', NULL, 'not_started', 0, 2);

-- People questions (not started)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, status, sort_order) VALUES
('demo_q_009', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'people', 'How would you describe your team''s digital skills?', 'not_started', 1),
('demo_q_010', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'people', 'What is the organizational culture like regarding change?', 'not_started', 2);

-- Finance questions (not started)
INSERT OR IGNORE INTO interview_questions (id, session_id, organization_id, category, question_text, status, sort_order) VALUES
('demo_q_011', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'finance', 'What is the available budget for transformation initiatives?', 'not_started', 1),
('demo_q_012', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'finance', 'What ROI do you expect from digital investments?', 'not_started', 2);

-- ==========================================
-- DEMO INTERVIEW NOTES
-- ==========================================

INSERT OR IGNORE INTO interview_notes (id, session_id, organization_id, category, title, content, created_by) VALUES
('demo_note_001', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'operations', 'Key Observation', 'The finance team spends approximately 2 days per week on manual reporting. This is a significant opportunity for automation.', (SELECT id FROM users LIMIT 1)),
('demo_note_002', 'demo_session_002', (SELECT id FROM organizations LIMIT 1), 'digital', 'System Integration Gap', 'No integration between SAP and the custom Access databases. Data is manually exported/imported weekly.', (SELECT id FROM users LIMIT 1)),
('demo_note_003', 'demo_session_001', (SELECT id FROM organizations LIMIT 1), 'strategy', 'Executive Sponsor', 'CFO is the main sponsor for digital transformation. Strong support from CEO as well.', (SELECT id FROM users LIMIT 1));

-- ==========================================
-- DEMO INTERVIEW INSIGHTS (AI-generated)
-- ==========================================

INSERT OR IGNORE INTO interview_insights (
    id, organization_id, title, prompt_type, source_session_ids, 
    content, status, source_session_count, created_by
) VALUES 
(
    'demo_insight_001',
    (SELECT id FROM organizations LIMIT 1),
    'Digital Transformation Readiness Analysis',
    'summary',
    '["demo_session_001"]',
    '## Executive Summary

Based on the completed interview session, the organization shows **moderate digital maturity** with significant opportunities for improvement.

### Key Findings

1. **Legacy Systems Dependency**
   - Current ERP (SAP R/3) is outdated and limits integration capabilities
   - 60% of processes still rely on manual data entry
   - Cloud adoption at only 20%

2. **Resource Constraints**
   - IT team of 5 people is stretched thin
   - Annual IT budget of $500K may be insufficient for major transformation
   - No dedicated digital transformation team

3. **Quick Wins Identified**
   - Automate manual reporting (potential savings: 2 days/week)
   - Implement basic integrations between existing systems
   - Cloud migration for non-critical workloads

### Recommendations Priority

| Priority | Initiative | Estimated Impact |
|----------|-----------|------------------|
| High | Reporting automation | $50K savings/year |
| High | System integration | 30% efficiency gain |
| Medium | Cloud migration | Scalability + cost reduction |
| Low | ERP upgrade | Long-term foundation |

### Risk Assessment

- **Budget Risk**: Current budget may not support comprehensive transformation
- **Capacity Risk**: IT team needs augmentation for major initiatives
- **Change Management**: Organization culture assessment needed',
    'completed',
    1,
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1)
),
(
    'demo_insight_002',
    (SELECT id FROM organizations LIMIT 1),
    'Cost Efficiency Opportunities',
    'summary',
    '["demo_session_003"]',
    '## Cost Efficiency Analysis

### Current State

- **COGS**: 65% of revenue (industry benchmark: 55-60%)
- **Labor costs**: 40% of COGS
- **Scrap rate**: 3.5% (target: <2%)
- **Overtime**: 20% of labor costs

### Identified Opportunities

1. **Labor Optimization** - $150K potential savings
   - Reduce overtime through better planning
   - Cross-training to improve flexibility

2. **Scrap Reduction** - $80K potential savings
   - Root cause analysis of defects
   - Quality gates at critical points

3. **Logistics Optimization** - $200K potential savings
   - Reduce expedited shipping
   - Optimize inventory levels

### 30-60-90 Day Plan

**30 Days:**
- Implement overtime tracking dashboard
- Start scrap root cause analysis

**60 Days:**
- Launch cross-training program
- Pilot quality gates on Line 1

**90 Days:**
- Roll out improvements to all lines
- Review and adjust targets',
    'completed',
    1,
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1)
),
(
    'demo_insight_003',
    (SELECT id FROM organizations LIMIT 1),
    'Cross-Interview Trends Analysis',
    'trends',
    '["demo_session_001", "demo_session_003"]',
    '## Cross-Interview Trend Analysis

### Common Themes Across Sessions

1. **Manual Processes**
   - Both sessions highlight significant manual work
   - Data entry, reporting, and approvals are key pain points
   - Estimated 30% of staff time on non-value-added activities

2. **System Integration Gaps**
   - Siloed systems across departments
   - No single source of truth for key metrics
   - Excel as the "integration layer"

3. **Visibility Challenges**
   - Real-time data not available
   - Decision-making based on outdated information
   - KPIs measured monthly instead of daily

### Strategic Implications

The organization needs a **foundation-first approach**:
1. Establish data integration layer
2. Implement real-time dashboards
3. Then pursue advanced automation

### Recommended Next Steps

- [ ] Conduct detailed process mapping
- [ ] Evaluate integration platforms (iPaaS)
- [ ] Define KPI framework and data sources
- [ ] Build business case for transformation investment',
    'completed',
    2,
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1)
);

-- ==========================================
-- DEMO INTERVIEW ASSIGNMENTS
-- ==========================================

-- Assignment 1: Pending (not started)
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, priority, notes, created_by
) VALUES (
    'demo_assign_001',
    (SELECT id FROM organizations LIMIT 1),
    (SELECT id FROM users WHERE role = 'USER' OR role = 'TEAM_MEMBER' LIMIT 1),
    'itpl_digital_maturity_discovery_v1',
    1,
    'assigned',
    datetime('now', '+7 days'),
    'high',
    'Please complete this assessment before our next steering committee meeting.',
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1)
);

-- Assignment 2: In Progress
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, started_at, priority, created_by
) VALUES (
    'demo_assign_002',
    (SELECT id FROM organizations LIMIT 1),
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1),
    'itpl_operational_excellence_v1',
    1,
    'in_progress',
    datetime('now', '+14 days'),
    datetime('now', '-3 days'),
    'medium',
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1)
);

-- Assignment 3: Overdue
INSERT OR IGNORE INTO interview_assignments (
    id, organization_id, assignee_user_id, template_id, template_version,
    status, due_at, priority, notes, created_by
) VALUES (
    'demo_assign_003',
    (SELECT id FROM organizations LIMIT 1),
    (SELECT id FROM users WHERE role = 'USER' OR role = 'TEAM_MEMBER' LIMIT 1),
    'itpl_cost_efficiency_v1',
    1,
    'assigned',
    datetime('now', '-3 days'),
    'urgent',
    'URGENT: This was due last week. Please complete ASAP.',
    (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER') LIMIT 1)
);

-- ==========================================
-- UPDATE SESSION COUNTS
-- ==========================================

-- Update question counts for demo sessions
UPDATE interview_sessions 
SET total_questions = (SELECT COUNT(*) FROM interview_questions WHERE session_id = interview_sessions.id),
    answered_questions = (SELECT COUNT(*) FROM interview_questions WHERE session_id = interview_sessions.id AND status = 'answered')
WHERE id LIKE 'demo_session_%';
