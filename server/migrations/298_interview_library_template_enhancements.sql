-- INTERVIEW-TEMPLATES-003: Template question options + Coming Soon templates
-- Migration: 298_interview_library_template_enhancements.sql
-- Purpose:
--  - Add `answer_options` to interview_library_template_questions for closed questions.
--  - Update selected questions to be closed (scale/select/boolean) with options.
--  - Add 5 draft \"Coming Soon\" templates (not approved).

-- 1) Add options column (JSON string)
ALTER TABLE interview_library_template_questions ADD COLUMN IF NOT EXISTS answer_options TEXT DEFAULT '[]';

-- 2) Mark selected questions as closed + set options
-- Quick Assessment: readiness scale 1-5
UPDATE interview_library_template_questions
SET answer_type = 'scale', answer_options = '["1","2","3","4","5"]'
WHERE id = 'itq_q_people_2';

-- Digital Maturity Discovery: automation level select
UPDATE interview_library_template_questions
SET answer_type = 'select', answer_options = '["Manual","Semi-automated","Automated","Mixed / depends on area"]'
WHERE id = 'itq_dm_digital_2';

-- Standard Work: SOP existence boolean-ish
UPDATE interview_library_template_questions
SET answer_type = 'select', answer_options = '["Yes","Partially","No"]'
WHERE id = 'itq_sw_operations_1';

-- Data & Metrics: source of truth select
UPDATE interview_library_template_questions
SET answer_type = 'select', answer_options = '["Yes","Partially","No","Unknown"]'
WHERE id = 'itq_dm2_digital_3';

-- 3) Coming Soon templates (draft)
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, is_default, version, created_by)
VALUES
  ('itpl_automation_readiness_v1', NULL, 'Automation Readiness', 'Coming soon: RPA/AI automation candidate discovery and feasibility', 'AUTOMATION', 'draft', 'global', 0, 1, 'system'),
  ('itpl_voice_of_employee_v1', NULL, 'Voice of Employee', 'Coming soon: change readiness, adoption risks, capability gaps', 'PEOPLE', 'draft', 'global', 0, 1, 'system'),
  ('itpl_customer_experience_blueprint_v1', NULL, 'Customer Experience Blueprint', 'Coming soon: customer journey + backstage service blueprint', 'CUSTOMER', 'draft', 'global', 0, 1, 'system'),
  ('itpl_it_business_alignment_v1', NULL, 'IT–Business Alignment', 'Coming soon: governance, prioritization, value metrics alignment', 'ALIGNMENT', 'draft', 'global', 0, 1, 'system'),
  ('itpl_executive_owner_discovery_v1', NULL, 'Executive / Owner Discovery', 'Coming soon: strategic discovery with owners/executives', 'EXECUTIVE', 'draft', 'global', 0, 1, 'system');

-- Seed minimal questions for Coming Soon templates (still in 5 categories)
INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, sort_order, answer_type, is_required, answer_options)
VALUES
  -- Automation Readiness
  ('itq_ar_1', 'itpl_automation_readiness_v1', 'operations', 'Which steps are most repetitive and rules-based?', 10, 'open', 1, '[]'),
  ('itq_ar_2', 'itpl_automation_readiness_v1', 'operations', 'What % of cases are exceptions vs standard flow?', 20, 'open', 0, '[]'),
  ('itq_ar_3', 'itpl_automation_readiness_v1', 'digital', 'How structured are inputs/outputs for the candidate steps?', 10, 'select', 1, '["Structured","Mixed","Unstructured"]'),
  ('itq_ar_4', 'itpl_automation_readiness_v1', 'digital', 'Are required systems integrated via APIs (or possible)?', 20, 'select', 0, '["Yes","Partially","No","Unknown"]'),
  ('itq_ar_5', 'itpl_automation_readiness_v1', 'finance', 'What is the expected primary benefit from automation?', 10, 'select', 0, '["Cost","Lead time","Quality","Risk/Compliance","Service"]'),

  -- Voice of Employee
  ('itq_voe_1', 'itpl_voice_of_employee_v1', 'people', 'How clear is the purpose of the change for employees?', 10, 'scale', 1, '["1","2","3","4","5"]'),
  ('itq_voe_2', 'itpl_voice_of_employee_v1', 'people', 'What are the top 3 concerns or fears about the change?', 20, 'open', 1, '[]'),
  ('itq_voe_3', 'itpl_voice_of_employee_v1', 'people', 'How strong is leadership support and communication?', 30, 'scale', 0, '["1","2","3","4","5"]'),
  ('itq_voe_4', 'itpl_voice_of_employee_v1', 'operations', 'Where does current work break down due to unclear roles/standards?', 10, 'open', 0, '[]'),

  -- Customer Experience Blueprint
  ('itq_cx_1', 'itpl_customer_experience_blueprint_v1', 'strategy', 'Which customer segment and journey scenario are in scope?', 10, 'open', 1, '[]'),
  ('itq_cx_2', 'itpl_customer_experience_blueprint_v1', 'operations', 'Walk through a recent real customer case step-by-step.', 10, 'open', 1, '[]'),
  ('itq_cx_3', 'itpl_customer_experience_blueprint_v1', 'operations', 'Where are the biggest handoff failures or delays?', 20, 'open', 0, '[]'),
  ('itq_cx_4', 'itpl_customer_experience_blueprint_v1', 'digital', 'Which touchpoints/channels are used (phone, email, portal)?', 10, 'select', 0, '["Phone","Email","Portal/App","In-person","Mixed"]'),

  -- IT–Business Alignment
  ('itq_align_1', 'itpl_it_business_alignment_v1', 'strategy', 'How are business priorities translated into IT initiatives today?', 10, 'open', 1, '[]'),
  ('itq_align_2', 'itpl_it_business_alignment_v1', 'strategy', 'Do you have clear success metrics/KPIs for IT delivery value?', 20, 'select', 0, '["Yes","Partially","No"]'),
  ('itq_align_3', 'itpl_it_business_alignment_v1', 'digital', 'How are IT changes governed and approved?', 10, 'open', 0, '[]'),
  ('itq_align_4', 'itpl_it_business_alignment_v1', 'finance', 'How is ROI / value tracked after delivery?', 10, 'open', 0, '[]'),

  -- Executive / Owner Discovery
  ('itq_exec_1', 'itpl_executive_owner_discovery_v1', 'strategy', 'What are the top 3 business objectives for the next 12–24 months?', 10, 'open', 1, '[]'),
  ('itq_exec_2', 'itpl_executive_owner_discovery_v1', 'strategy', 'What does success look like (KPIs + behaviors)?', 20, 'open', 1, '[]'),
  ('itq_exec_3', 'itpl_executive_owner_discovery_v1', 'finance', 'Which constraints are non-negotiable (budget, risk, compliance)?', 10, 'open', 0, '[]'),
  ('itq_exec_4', 'itpl_executive_owner_discovery_v1', 'people', 'Which stakeholders must be aligned and where is resistance expected?', 10, 'open', 0, '[]');

