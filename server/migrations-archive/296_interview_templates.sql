-- INTERVIEW-TEMPLATES-001: Interview Templates Library + AI Assist Permissions
-- Migration: 296_interview_templates.sql
-- Purpose:
--  - Add interview template library (6 templates for manufacturing-first discovery + Quick)
--  - Add template metadata to interview_sessions (template_id, template_version)
--  - Seed initial templates and their questions (snapshotable)
--  - Add permissions for template view/use/manage
--
-- Notes:
--  - This does NOT remove the legacy `interview_question_templates` table.
--  - Sessions created via template endpoints should snapshot questions into `interview_questions`.

-- ==========================================
-- TEMPLATES LIBRARY
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT,                         -- NULL = global library, otherwise org-scoped
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,                       -- DIGITAL | OPERATIONAL | COST | DATA | STANDARD | QUICK
    status TEXT DEFAULT 'approved',               -- draft | approved
    visibility TEXT DEFAULT 'org',                -- org | role_based | admin_only | global
    is_default INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_templates_org ON interview_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_templates_status ON interview_templates(status);
CREATE INDEX IF NOT EXISTS idx_interview_templates_category ON interview_templates(category);

CREATE TABLE IF NOT EXISTS interview_template_questions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    category TEXT NOT NULL,                       -- strategy | operations | digital | people | finance
    question_text TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    answer_type TEXT DEFAULT 'open',              -- open | number | select | scale | boolean
    is_required INTEGER DEFAULT 0,
    help_hint TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES interview_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interview_template_questions_template ON interview_template_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_interview_template_questions_category ON interview_template_questions(category);

-- ==========================================
-- SESSION METADATA (template snapshot)
-- ==========================================

ALTER TABLE interview_sessions ADD COLUMN template_id TEXT;
ALTER TABLE interview_sessions ADD COLUMN template_version INTEGER DEFAULT 1;

-- ==========================================
-- PERMISSIONS (Templates library)
-- ==========================================

-- Note: PostgreSQL permissions table may not have 'name' and 'icon' columns
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
('INTERVIEW_TEMPLATE_VIEW', 'View interview templates library', 'INTERVIEW'),
('INTERVIEW_TEMPLATE_USE', 'Create interview session from template', 'INTERVIEW'),
('INTERVIEW_TEMPLATE_MANAGE', 'Create/edit/publish interview templates', 'INTERVIEW');

INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description) VALUES
('rp_interview_tpl_view_user', 'USER', 'INTERVIEW_TEMPLATE_VIEW', 'View interview templates'),
('rp_interview_tpl_use_user', 'USER', 'INTERVIEW_TEMPLATE_USE', 'Use interview templates'),
('rp_interview_tpl_view_pm', 'PROJECT_MANAGER', 'INTERVIEW_TEMPLATE_VIEW', 'View interview templates'),
('rp_interview_tpl_use_pm', 'PROJECT_MANAGER', 'INTERVIEW_TEMPLATE_USE', 'Use interview templates'),
('rp_interview_tpl_manage_pm', 'PROJECT_MANAGER', 'INTERVIEW_TEMPLATE_MANAGE', 'Manage interview templates'),
('rp_interview_tpl_view_admin', 'ADMIN', 'INTERVIEW_TEMPLATE_VIEW', 'View interview templates'),
('rp_interview_tpl_use_admin', 'ADMIN', 'INTERVIEW_TEMPLATE_USE', 'Use interview templates'),
('rp_interview_tpl_manage_admin', 'ADMIN', 'INTERVIEW_TEMPLATE_MANAGE', 'Manage interview templates'),
('rp_interview_tpl_view_super', 'SUPERADMIN', 'INTERVIEW_TEMPLATE_VIEW', 'View interview templates'),
('rp_interview_tpl_use_super', 'SUPERADMIN', 'INTERVIEW_TEMPLATE_USE', 'Use interview templates'),
('rp_interview_tpl_manage_super', 'SUPERADMIN', 'INTERVIEW_TEMPLATE_MANAGE', 'Manage interview templates');

-- ==========================================
-- SEED: 6 TEMPLATES (manufacturing-first + quick)
-- ==========================================

INSERT OR IGNORE INTO interview_templates (id, organization_id, name, description, category, status, visibility, is_default, version, created_by)
VALUES
('itpl_operational_excellence_v1', NULL, 'Operational Excellence', 'Lean and process improvement focused discovery', 'OPERATIONAL', 'approved', 'global', 1, 1, 'system'),
('itpl_digital_maturity_discovery_v1', NULL, 'Digital Maturity Discovery', 'Standard template for digital transformation assessments', 'DIGITAL', 'approved', 'global', 1, 1, 'system'),
('itpl_cost_efficiency_v1', NULL, 'Cost & Efficiency', 'Cost drivers, quick wins, and efficiency baseline for manufacturing operations', 'COST', 'approved', 'global', 0, 1, 'system'),
('itpl_data_metrics_v1', NULL, 'Data & Metrics', 'Data capture, KPI trust, reporting, and measurement maturity', 'DATA', 'approved', 'global', 0, 1, 'system'),
('itpl_standard_work_v1', NULL, 'Standard Work', 'Work standards, SOPs, training, and quality gates', 'STANDARD', 'approved', 'global', 0, 1, 'system'),
('itpl_quick_assessment_v1', NULL, 'Quick Assessment', 'Shortened version for initial consultations', 'QUICK', 'approved', 'global', 0, 1, 'system');

-- ==========================================
-- SEED: TEMPLATE QUESTIONS
-- ==========================================

-- Operational Excellence (manufacturing-friendly but still generic)
INSERT OR IGNORE INTO interview_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_oe_strategy_1', 'itpl_operational_excellence_v1', 'strategy', 'What is the primary business outcome you expect from improving operations (cost, lead time, quality, service, flexibility)?', 10, 'open', 1),
('itq_oe_strategy_2', 'itpl_operational_excellence_v1', 'strategy', 'Which processes are most critical to customer value and competitive advantage?', 20, 'open', 1),
('itq_oe_strategy_3', 'itpl_operational_excellence_v1', 'strategy', 'What is the target timeline and how will success be measured?', 30, 'open', 1),

('itq_oe_operations_1', 'itpl_operational_excellence_v1', 'operations', 'Which end-to-end process are we focusing on (e.g., order-to-fulfill, procure-to-pay, plan-to-produce)?', 10, 'open', 1),
('itq_oe_operations_2', 'itpl_operational_excellence_v1', 'operations', 'Walk me through the current process step-by-step (including handoffs). Where does it slow down?', 20, 'open', 1),
('itq_oe_operations_3', 'itpl_operational_excellence_v1', 'operations', 'Where do you see the biggest bottlenecks (capacity constraints, approvals, waiting, rework)?', 30, 'open', 1),
('itq_oe_operations_4', 'itpl_operational_excellence_v1', 'operations', 'What is the typical lead time vs. value-added time (rough estimate is OK)?', 40, 'open', 0),
('itq_oe_operations_5', 'itpl_operational_excellence_v1', 'operations', 'Where do defects, scrap, or rework occur most often? What are the top root causes?', 50, 'open', 0),
('itq_oe_operations_6', 'itpl_operational_excellence_v1', 'operations', 'What are the most frequent exceptions and how are they handled?', 60, 'open', 0),

('itq_oe_digital_1', 'itpl_operational_excellence_v1', 'digital', 'Which systems support this process (ERP/MES/WMS/CMMS/Excel) and where are manual workarounds?', 10, 'open', 1),
('itq_oe_digital_2', 'itpl_operational_excellence_v1', 'digital', 'Where is information duplicated or re-entered? What integrations are missing?', 20, 'open', 0),
('itq_oe_digital_3', 'itpl_operational_excellence_v1', 'digital', 'Which steps could be automated without introducing unacceptable risk?', 30, 'open', 0),

('itq_oe_people_1', 'itpl_operational_excellence_v1', 'people', 'Who owns the process and who performs key steps? Where is accountability unclear?', 10, 'open', 1),
('itq_oe_people_2', 'itpl_operational_excellence_v1', 'people', 'What skills/training gaps impact process quality or throughput?', 20, 'open', 0),
('itq_oe_people_3', 'itpl_operational_excellence_v1', 'people', 'How are improvements proposed, tested, and adopted (continuous improvement routine)?', 30, 'open', 0),

('itq_oe_finance_1', 'itpl_operational_excellence_v1', 'finance', 'What is the approximate cost impact of current inefficiencies (labor, scrap, downtime, expedited freight)?', 10, 'open', 0),
('itq_oe_finance_2', 'itpl_operational_excellence_v1', 'finance', 'What is the acceptable payback period and what constraints apply (budget, resources)?', 20, 'open', 0);

-- Digital Maturity Discovery (manufacturing baseline: systems + automation + data capture)
INSERT OR IGNORE INTO interview_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_dm_strategy_1', 'itpl_digital_maturity_discovery_v1', 'strategy', 'What digital capabilities are most important to your manufacturing strategy (visibility, predictability, traceability, flexibility)?', 10, 'open', 1),
('itq_dm_strategy_2', 'itpl_digital_maturity_discovery_v1', 'strategy', 'What are your top 3 digital transformation priorities for the next 12 months?', 20, 'open', 1),

('itq_dm_operations_1', 'itpl_digital_maturity_discovery_v1', 'operations', 'Which operational decisions are hardest to make today due to lack of data or slow feedback?', 10, 'open', 1),
('itq_dm_operations_2', 'itpl_digital_maturity_discovery_v1', 'operations', 'Where do you experience planning vs. execution mismatches (schedule adherence, shortages, changeovers)?', 20, 'open', 0),

('itq_dm_digital_1', 'itpl_digital_maturity_discovery_v1', 'digital', 'What core systems do you use (ERP/MES/WMS/PLM/CMMS/QMS)?', 10, 'open', 1),
('itq_dm_digital_2', 'itpl_digital_maturity_discovery_v1', 'digital', 'What is your current level of automation (manual, semi, automated) and where?', 20, 'open', 1),
('itq_dm_digital_3', 'itpl_digital_maturity_discovery_v1', 'digital', 'How is shopfloor data captured (manual entry, sensors/IoT, machine integration)?', 30, 'open', 1),
('itq_dm_digital_4', 'itpl_digital_maturity_discovery_v1', 'digital', 'What are the biggest pain points with IT systems (usability, reliability, integrations, reporting)?', 40, 'open', 0),
('itq_dm_digital_5', 'itpl_digital_maturity_discovery_v1', 'digital', 'How do you manage identities/access and data security for operational systems?', 50, 'open', 0),

('itq_dm_people_1', 'itpl_digital_maturity_discovery_v1', 'people', 'How would you describe digital skills on the shopfloor and in planning/engineering teams?', 10, 'open', 1),
('itq_dm_people_2', 'itpl_digital_maturity_discovery_v1', 'people', 'How do employees react to new tools/processes? What has worked in past rollouts?', 20, 'open', 0),

('itq_dm_finance_1', 'itpl_digital_maturity_discovery_v1', 'finance', 'How are digital initiatives funded and how do you evaluate ROI (cost, quality, throughput, risk)?', 10, 'open', 0);

-- Cost & Efficiency (hard: cost drivers, baseline, quick wins)
INSERT OR IGNORE INTO interview_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_ce_strategy_1', 'itpl_cost_efficiency_v1', 'strategy', 'Which cost reduction objectives are in scope (COGS, SG&A, working capital, energy, quality cost)?', 10, 'open', 1),
('itq_ce_strategy_2', 'itpl_cost_efficiency_v1', 'strategy', 'What constraints must we respect (service levels, quality, compliance, labor agreements)?', 20, 'open', 1),

('itq_ce_operations_1', 'itpl_cost_efficiency_v1', 'operations', 'Which parts of the process consume the most time (waiting, searching, rework, approvals, transport)?', 10, 'open', 1),
('itq_ce_operations_2', 'itpl_cost_efficiency_v1', 'operations', 'Where do you see the biggest losses (downtime, scrap, overtime, changeovers, expedite)?', 20, 'open', 1),
('itq_ce_operations_3', 'itpl_cost_efficiency_v1', 'operations', 'What are the top recurring issues that trigger firefighting?', 30, 'open', 0),

('itq_ce_digital_1', 'itpl_cost_efficiency_v1', 'digital', 'Which steps are still manual due to missing tools/integrations? What would be the simplest automation wins?', 10, 'open', 0),
('itq_ce_digital_2', 'itpl_cost_efficiency_v1', 'digital', 'Do you have reliable time/cost data per order/batch/sku? If not, why?', 20, 'open', 0),

('itq_ce_people_1', 'itpl_cost_efficiency_v1', 'people', 'Which roles are overloaded and why (peaks, variability, rework, unclear standards)?', 10, 'open', 0),
('itq_ce_people_2', 'itpl_cost_efficiency_v1', 'people', 'What incentives or local KPIs drive suboptimal behaviors (local optimization)?', 20, 'open', 0),

('itq_ce_finance_1', 'itpl_cost_efficiency_v1', 'finance', 'How do you currently calculate cost drivers (labor, overhead, energy, materials losses)?', 10, 'open', 1),
('itq_ce_finance_2', 'itpl_cost_efficiency_v1', 'finance', 'What is the current baseline for cost (monthly) and what is the target (12 months)?', 20, 'open', 0),
('itq_ce_finance_3', 'itpl_cost_efficiency_v1', 'finance', 'List 3 quick wins you believe can deliver savings in 30/60/90 days and what blocks them.', 30, 'open', 0);

-- Data & Metrics (hard: trust in numbers, KPI definitions, data capture)
INSERT OR IGNORE INTO interview_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_dm2_strategy_1', 'itpl_data_metrics_v1', 'strategy', 'Which KPIs are considered “north star” for operations and why?', 10, 'open', 1),
('itq_dm2_strategy_2', 'itpl_data_metrics_v1', 'strategy', 'How are KPI targets set and reviewed (cadence, owners, governance)?', 20, 'open', 0),

('itq_dm2_operations_1', 'itpl_data_metrics_v1', 'operations', 'Which operational decisions rely on metrics today, and where do people rely on intuition instead?', 10, 'open', 1),
('itq_dm2_operations_2', 'itpl_data_metrics_v1', 'operations', 'Where are measurements missing that would materially improve throughput/quality/lead time?', 20, 'open', 0),

('itq_dm2_digital_1', 'itpl_data_metrics_v1', 'digital', 'Where do KPIs come from (systems, manual logs, Excel)? Describe the data pipeline briefly.', 10, 'open', 1),
('itq_dm2_digital_2', 'itpl_data_metrics_v1', 'digital', 'What is the biggest source of data errors (manual entry, definitions, timing, duplicates)?', 20, 'open', 0),
('itq_dm2_digital_3', 'itpl_data_metrics_v1', 'digital', 'Do you have one source of truth for key entities (orders, inventory, routing, downtime)?', 30, 'open', 0),

('itq_dm2_people_1', 'itpl_data_metrics_v1', 'people', 'Do different teams interpret the same KPI differently? Give examples.', 10, 'open', 0),
('itq_dm2_people_2', 'itpl_data_metrics_v1', 'people', 'When numbers are questioned, what is the typical reason (trust, politics, inconsistency)?', 20, 'open', 0),

('itq_dm2_finance_1', 'itpl_data_metrics_v1', 'finance', 'Which KPIs are used for financial steering and how do they map to operational metrics?', 10, 'open', 0),
('itq_dm2_finance_2', 'itpl_data_metrics_v1', 'finance', 'What reports are produced regularly, by whom, and how long do they take to prepare?', 20, 'open', 0);

-- Standard Work (hard+soft: SOP, training, quality gates, deviations)
INSERT OR IGNORE INTO interview_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_sw_strategy_1', 'itpl_standard_work_v1', 'strategy', 'Which processes must be standardized first to unlock scale, quality, or compliance?', 10, 'open', 1),
('itq_sw_strategy_2', 'itpl_standard_work_v1', 'strategy', 'What is the desired balance between standardization and flexibility (exceptions, custom orders)?', 20, 'open', 0),

('itq_sw_operations_1', 'itpl_standard_work_v1', 'operations', 'Do you have documented SOPs/work instructions for critical steps? Are they current?', 10, 'open', 1),
('itq_sw_operations_2', 'itpl_standard_work_v1', 'operations', 'Where do teams execute the same work differently (shifts, sites, lines)? Why?', 20, 'open', 0),
('itq_sw_operations_3', 'itpl_standard_work_v1', 'operations', 'What quality gates exist (inspections, approvals, checks)? Which are effective vs. ritual?', 30, 'open', 0),

('itq_sw_digital_1', 'itpl_standard_work_v1', 'digital', 'Where do systems enforce standards (forms, validations, workflows) and where is it tribal knowledge?', 10, 'open', 0),
('itq_sw_digital_2', 'itpl_standard_work_v1', 'digital', 'Do you have version control for standards (who changes what, audit trail)?', 20, 'open', 0),

('itq_sw_people_1', 'itpl_standard_work_v1', 'people', 'How do you onboard/train new employees for this process? How long to full productivity?', 10, 'open', 1),
('itq_sw_people_2', 'itpl_standard_work_v1', 'people', 'How are deviations handled (feedback loop, root cause, updating the standard)?', 20, 'open', 0),

('itq_sw_finance_1', 'itpl_standard_work_v1', 'finance', 'What is the business impact of non-standard work (rework, quality cost, delays, audit risk)?', 10, 'open', 0);

-- Quick Assessment (minimal set; still uses 5 categories)
INSERT OR IGNORE INTO interview_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_q_strategy_1', 'itpl_quick_assessment_v1', 'strategy', 'What is the main objective for this engagement?', 10, 'open', 1),
('itq_q_strategy_2', 'itpl_quick_assessment_v1', 'strategy', 'How will we measure success in one sentence?', 20, 'open', 0),

('itq_q_operations_1', 'itpl_quick_assessment_v1', 'operations', 'What is the single biggest operational pain point today?', 10, 'open', 1),
('itq_q_operations_2', 'itpl_quick_assessment_v1', 'operations', 'Name one bottleneck that causes delays most often.', 20, 'open', 0),

('itq_q_digital_1', 'itpl_quick_assessment_v1', 'digital', 'What is the biggest systems/data problem blocking improvement?', 10, 'open', 0),
('itq_q_digital_2', 'itpl_quick_assessment_v1', 'digital', 'Where do you see one quick automation win?', 20, 'open', 0),

('itq_q_people_1', 'itpl_quick_assessment_v1', 'people', 'Where does execution break due to unclear roles/skills/standards?', 10, 'open', 0),
('itq_q_people_2', 'itpl_quick_assessment_v1', 'people', 'How ready is the organization to change (1-5) and why?', 20, 'open', 0),

('itq_q_finance_1', 'itpl_quick_assessment_v1', 'finance', 'What cost or value metric matters most for leadership right now?', 10, 'open', 0),
('itq_q_finance_2', 'itpl_quick_assessment_v1', 'finance', 'List 3 quick wins that could deliver value in 30/60/90 days.', 20, 'open', 0);

