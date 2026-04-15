-- INTERVIEW-TEMPLATES-003: Extended Interview Templates (Draft/Planned)
-- Migration: 298_interview_draft_templates.sql
-- Purpose:
--  - Add 4 planned templates from documentation (status: 'draft')
--  - A) Automation Readiness (RPA/AI)
--  - B) Voice of Employee / Change Readiness
--  - C) Customer Experience / Service Blueprint
--  - D) IT–Business Alignment
--
-- These templates are in draft status, pending validation in real projects.

-- ==========================================
-- SEED: 4 DRAFT TEMPLATES (planned extensions)
-- ==========================================

INSERT OR IGNORE INTO interview_library_templates (id, organization_id, name, description, category, status, visibility, is_default, version, created_by)
VALUES
('itpl_automation_readiness_v1', NULL, 'Automation Readiness (RPA/AI)', 'Deeper assessment for RPA and AI automation candidates - exception rates, data types, and integration feasibility', 'AUTOMATION', 'draft', 'global', 0, 1, 'system'),
('itpl_change_readiness_v1', NULL, 'Voice of Employee / Change Readiness', 'Capture adoption risks, resistance patterns, capability gaps, and support needs', 'CHANGE', 'draft', 'global', 0, 1, 'system'),
('itpl_customer_experience_v1', NULL, 'Customer Experience / Service Blueprint', 'Map customer touchpoints, backstage dependencies, and service delivery friction', 'CUSTOMER', 'draft', 'global', 0, 1, 'system'),
('itpl_it_business_alignment_v1', NULL, 'IT–Business Alignment', 'Ensure IT prioritization and governance align with business strategy', 'ALIGNMENT', 'draft', 'global', 0, 1, 'system');

-- ==========================================
-- SEED: TEMPLATE QUESTIONS
-- ==========================================

-- A) Automation Readiness (RPA/AI)
INSERT OR IGNORE INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
-- Strategy
('itq_ar_strategy_1', 'itpl_automation_readiness_v1', 'strategy', 'What is the primary driver for automation (cost reduction, quality improvement, speed, scalability, or compliance)?', 10, 'open', 1),
('itq_ar_strategy_2', 'itpl_automation_readiness_v1', 'strategy', 'Which processes have been identified as automation candidates and why?', 20, 'open', 1),
('itq_ar_strategy_3', 'itpl_automation_readiness_v1', 'strategy', 'What is the target timeline and expected ROI for automation initiatives?', 30, 'open', 0),
-- Operations
('itq_ar_operations_1', 'itpl_automation_readiness_v1', 'operations', 'What is the current exception rate in the process (percentage of cases requiring human intervention)?', 10, 'open', 1),
('itq_ar_operations_2', 'itpl_automation_readiness_v1', 'operations', 'Describe the typical happy path vs. exception handling flow for this process.', 20, 'open', 1),
('itq_ar_operations_3', 'itpl_automation_readiness_v1', 'operations', 'What is the current volume (transactions/day) and peak/trough variation?', 30, 'open', 0),
('itq_ar_operations_4', 'itpl_automation_readiness_v1', 'operations', 'How stable are the business rules? How often do they change?', 40, 'open', 0),
-- Digital
('itq_ar_digital_1', 'itpl_automation_readiness_v1', 'digital', 'What input types does the process use (structured data, PDFs, emails, images, handwritten)?', 10, 'open', 1),
('itq_ar_digital_2', 'itpl_automation_readiness_v1', 'digital', 'Which systems need to be integrated for end-to-end automation (APIs available, screen scraping needed)?', 20, 'open', 1),
('itq_ar_digital_3', 'itpl_automation_readiness_v1', 'digital', 'What is the current state of data quality (completeness, accuracy, consistency)?', 30, 'open', 0),
('itq_ar_digital_4', 'itpl_automation_readiness_v1', 'digital', 'Are there AI/ML opportunities (document understanding, decision support, pattern recognition)?', 40, 'open', 0),
-- People
('itq_ar_people_1', 'itpl_automation_readiness_v1', 'people', 'How many FTEs currently perform this process and what is the skill level required?', 10, 'open', 1),
('itq_ar_people_2', 'itpl_automation_readiness_v1', 'people', 'What is the plan for affected employees (redeployment, upskilling, natural attrition)?', 20, 'open', 0),
('itq_ar_people_3', 'itpl_automation_readiness_v1', 'people', 'Who will own and maintain the automation solution post-implementation?', 30, 'open', 0),
-- Finance
('itq_ar_finance_1', 'itpl_automation_readiness_v1', 'finance', 'What is the current cost per transaction and target cost after automation?', 10, 'open', 1),
('itq_ar_finance_2', 'itpl_automation_readiness_v1', 'finance', 'What compliance or audit requirements must the automation satisfy?', 20, 'open', 0);

-- B) Voice of Employee / Change Readiness
INSERT OR IGNORE INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
-- Strategy
('itq_cr_strategy_1', 'itpl_change_readiness_v1', 'strategy', 'What is the scope and ambition of the change (incremental improvement vs. transformation)?', 10, 'open', 1),
('itq_cr_strategy_2', 'itpl_change_readiness_v1', 'strategy', 'How has similar change been communicated to the organization so far?', 20, 'open', 0),
('itq_cr_strategy_3', 'itpl_change_readiness_v1', 'strategy', 'What is at stake if the change fails (for the business and for individuals)?', 30, 'open', 0),
-- Operations
('itq_cr_operations_1', 'itpl_change_readiness_v1', 'operations', 'Which teams/departments will be most affected by the change?', 10, 'open', 1),
('itq_cr_operations_2', 'itpl_change_readiness_v1', 'operations', 'What will people need to do differently on a daily basis after the change?', 20, 'open', 1),
('itq_cr_operations_3', 'itpl_change_readiness_v1', 'operations', 'What support structures are in place during the transition (super-users, helpdesk, coaches)?', 30, 'open', 0),
-- Digital
('itq_cr_digital_1', 'itpl_change_readiness_v1', 'digital', 'What new tools/systems will employees need to learn?', 10, 'open', 0),
('itq_cr_digital_2', 'itpl_change_readiness_v1', 'digital', 'What is the current digital literacy level of affected employees (1-5)?', 20, 'scale', 0),
-- People
('itq_cr_people_1', 'itpl_change_readiness_v1', 'people', 'How would you rate overall readiness for change in the organization (1-5)?', 10, 'scale', 1),
('itq_cr_people_2', 'itpl_change_readiness_v1', 'people', 'What are the main sources of resistance or concern you anticipate?', 20, 'open', 1),
('itq_cr_people_3', 'itpl_change_readiness_v1', 'people', 'Who are the key influencers and opinion leaders that should champion this change?', 30, 'open', 0),
('itq_cr_people_4', 'itpl_change_readiness_v1', 'people', 'What has worked well in past change initiatives? What has failed?', 40, 'open', 0),
('itq_cr_people_5', 'itpl_change_readiness_v1', 'people', 'What training and development needs have been identified?', 50, 'open', 0),
-- Finance
('itq_cr_finance_1', 'itpl_change_readiness_v1', 'finance', 'What budget is allocated for change management, training, and communication?', 10, 'open', 0),
('itq_cr_finance_2', 'itpl_change_readiness_v1', 'finance', 'What is the estimated productivity dip during transition and how will it be managed?', 20, 'open', 0);

-- C) Customer Experience / Service Blueprint
INSERT OR IGNORE INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
-- Strategy
('itq_cx_strategy_1', 'itpl_customer_experience_v1', 'strategy', 'What is the strategic importance of customer experience (differentiator, parity, or cost driver)?', 10, 'open', 1),
('itq_cx_strategy_2', 'itpl_customer_experience_v1', 'strategy', 'Which customer segments are most valuable and what are their key expectations?', 20, 'open', 1),
('itq_cx_strategy_3', 'itpl_customer_experience_v1', 'strategy', 'What are the top 3 CX priorities for the next 12 months?', 30, 'open', 0),
-- Operations
('itq_cx_operations_1', 'itpl_customer_experience_v1', 'operations', 'Walk through the key customer journey stages (awareness, purchase, onboarding, use, support, renewal).', 10, 'open', 1),
('itq_cx_operations_2', 'itpl_customer_experience_v1', 'operations', 'Where are the "moments of truth" - critical touchpoints that make or break the experience?', 20, 'open', 1),
('itq_cx_operations_3', 'itpl_customer_experience_v1', 'operations', 'Which handoffs between teams/channels cause the most friction?', 30, 'open', 0),
('itq_cx_operations_4', 'itpl_customer_experience_v1', 'operations', 'What are the top customer complaints and how are they addressed today?', 40, 'open', 0),
-- Digital
('itq_cx_digital_1', 'itpl_customer_experience_v1', 'digital', 'Which channels do customers use (web, mobile, phone, chat, in-person) and which are preferred?', 10, 'open', 1),
('itq_cx_digital_2', 'itpl_customer_experience_v1', 'digital', 'What systems support customer interactions (CRM, helpdesk, e-commerce) and are they integrated?', 20, 'open', 0),
('itq_cx_digital_3', 'itpl_customer_experience_v1', 'digital', 'How is customer feedback collected and analyzed (surveys, NPS, social, reviews)?', 30, 'open', 0),
-- People
('itq_cx_people_1', 'itpl_customer_experience_v1', 'people', 'Do frontline employees have the authority and tools to resolve customer issues?', 10, 'open', 1),
('itq_cx_people_2', 'itpl_customer_experience_v1', 'people', 'How are employees trained and incentivized to deliver great customer experience?', 20, 'open', 0),
('itq_cx_people_3', 'itpl_customer_experience_v1', 'people', 'How quickly can policies be updated when they cause customer friction?', 30, 'open', 0),
-- Finance
('itq_cx_finance_1', 'itpl_customer_experience_v1', 'finance', 'What is the cost of poor CX (churn, complaints, returns, bad reviews)?', 10, 'open', 0),
('itq_cx_finance_2', 'itpl_customer_experience_v1', 'finance', 'How is ROI of CX investments measured (NPS, retention, LTV, revenue)?', 20, 'open', 0);

-- D) IT–Business Alignment
INSERT OR IGNORE INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
-- Strategy
('itq_ita_strategy_1', 'itpl_it_business_alignment_v1', 'strategy', 'How is IT strategy derived from business strategy (cascade, co-creation, reactive)?', 10, 'open', 1),
('itq_ita_strategy_2', 'itpl_it_business_alignment_v1', 'strategy', 'What are the top 3 business priorities and how does IT support them?', 20, 'open', 1),
('itq_ita_strategy_3', 'itpl_it_business_alignment_v1', 'strategy', 'How often are IT and business strategies reviewed and realigned?', 30, 'open', 0),
-- Operations
('itq_ita_operations_1', 'itpl_it_business_alignment_v1', 'operations', 'How are IT projects prioritized (committee, scoring model, first-come)?', 10, 'open', 1),
('itq_ita_operations_2', 'itpl_it_business_alignment_v1', 'operations', 'What is the typical approval and delivery timeline for IT requests?', 20, 'open', 0),
('itq_ita_operations_3', 'itpl_it_business_alignment_v1', 'operations', 'Where does IT spend the most time (run vs. grow vs. transform)?', 30, 'open', 0),
('itq_ita_operations_4', 'itpl_it_business_alignment_v1', 'operations', 'How is technical debt managed and communicated to business stakeholders?', 40, 'open', 0),
-- Digital
('itq_ita_digital_1', 'itpl_it_business_alignment_v1', 'digital', 'What is the current enterprise architecture maturity (ad-hoc, documented, governed)?', 10, 'open', 1),
('itq_ita_digital_2', 'itpl_it_business_alignment_v1', 'digital', 'How are technology standards set and enforced?', 20, 'open', 0),
('itq_ita_digital_3', 'itpl_it_business_alignment_v1', 'digital', 'What is the ratio of custom vs. packaged vs. SaaS solutions in the portfolio?', 30, 'open', 0),
-- People
('itq_ita_people_1', 'itpl_it_business_alignment_v1', 'people', 'How would you describe the relationship between IT and business (partner, service provider, bottleneck)?', 10, 'open', 1),
('itq_ita_people_2', 'itpl_it_business_alignment_v1', 'people', 'Are there business-IT liaison or product owner roles? How effective are they?', 20, 'open', 0),
('itq_ita_people_3', 'itpl_it_business_alignment_v1', 'people', 'What governance forums exist for IT-business alignment (steering committees, portfolio boards)?', 30, 'open', 0),
-- Finance
('itq_ita_finance_1', 'itpl_it_business_alignment_v1', 'finance', 'How is IT budget allocated (run/grow/transform, by department, by project)?', 10, 'open', 1),
('itq_ita_finance_2', 'itpl_it_business_alignment_v1', 'finance', 'How transparent is IT cost and value to business stakeholders?', 20, 'open', 0),
('itq_ita_finance_3', 'itpl_it_business_alignment_v1', 'finance', 'What is the process for funding IT initiatives outside the annual budget?', 30, 'open', 0);
