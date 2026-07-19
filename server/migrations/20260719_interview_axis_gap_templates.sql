-- O5.6: Interview coverage matrix — new questions for DRD-axis gaps
-- Migration: 20260719_interview_axis_gap_templates.sql
-- Source of truth for the gap analysis: docs/standards/INTERVIEW_COVERAGE_MATRIX.md
--   (audit be1c9b8a5b, 2026-07-18) — 7 DRD axes (src/services/drdStructure.ts) x
--   270 existing bank questions. Result: 3 axes practically dead (Digital Products,
--   Digital Business Models, Cybersecurity), AI Maturity near-dead (1 question, in a
--   draft template), plus weak areas inside axes 1/4/5 (1B/1C/1H/1I, 4B/4D, 5D).
--
-- Piotr's decision (2026-07-19): "dopuść NOWE pytania do macierzy Wywiadu wg gotowego
-- audytu, przyrostowo" — add new questions per the ready audit, incrementally.
--
-- DECISIONS taken by this migration (the audit left 3 open questions for Piotr in
-- its §6 — "przyrostowo, zachowując istniejące" resolves them conservatively):
--   1) New axis coverage = 5 NEW, SEPARATE templates (not appended into existing
--      T01-T18 / default-bank templates). Existing templates/questions are
--      untouched — nothing is edited, only added. This is the low-risk reading of
--      audit open-question #1 ("osobne szablony" vs "dopięte do istniejących") and
--      keeps demo data / existing sessions unaffected.
--   2) itq_ar_digital_4 (the one existing AI question, sitting in the DRAFT
--      'itpl_automation_readiness_v1' template) is NOT promoted/flipped to
--      'approved' here — that would silently publish 15 unrelated automation
--      questions along with it, which is a bigger call than "add new questions"
--      and stays explicitly open for Piotr (audit open-question #2). Instead, an
--      equivalent AI-usage question is added fresh in the new AI Maturity template
--      below, so axis 7 gets real coverage without touching the existing draft.
--   3) English only, no PL translation in this pass — matches audit open-question
--      #3's lower-risk option ("EN first + walidacja, tłumaczenie w kolejnym
--      kroku") and mirrors how the existing draft family (298) started EN-only.
--   All 5 new templates are seeded with status='draft' (same convention as the
--   298 draft family) — visible to consultants via the templates library in draft
--   mode, NOT auto-copied into new interview sessions (only the approved default
--   bank is). Promotion draft->approved is a content-review decision, left to Piotr.
--
-- Idempotent: INSERT OR IGNORE (adapted to Postgres ON CONFLICT via adaptQuery();
-- first column of each INSERT column list is `id`, the real PRIMARY KEY, so the
-- unregistered-table first-column fallback in conflictTargets.ts resolves correctly
-- — same pattern already used by 297/298/669 for these two tables).

-- ==========================================
-- 5 NEW TEMPLATES (draft — axis coverage gaps)
-- ==========================================

INSERT OR IGNORE INTO interview_library_templates (id, organization_id, name, description, category, status, visibility, is_default, version, created_by)
VALUES
('itpl_digital_product_portfolio_v1', NULL, 'Digital Product Portfolio', 'Closes DRD axis 2 (Digital Products) coverage gap — probes the organization''s digital/physical product mix, validation practices, and scalability of digital offerings', 'DIGITAL_PRODUCTS', 'draft', 'global', 0, 1, 'system'),
('itpl_digital_business_model_v1', NULL, 'Digital Business Model Discovery', 'Closes DRD axis 3 (Digital Business Models) coverage gap — probes e-commerce/platform/as-a-service/asset-sharing/data-monetization revenue models', 'BUSINESS_MODELS', 'draft', 'global', 0, 1, 'system'),
('itpl_cybersecurity_baseline_v1', NULL, 'Cybersecurity & Resilience Baseline', 'Closes DRD axis 6 (Cybersecurity) coverage gap — risk assessment, incident history, access control, security awareness, continuity, and compliance posture (ISO 27001/NIS2/GDPR)', 'SECURITY', 'draft', 'global', 0, 1, 'system'),
('itpl_ai_readiness_governance_v1', NULL, 'AI Readiness & Governance', 'Closes DRD axis 7 (AI Maturity) coverage gap — current AI/gen-AI usage, data readiness for AI, governance/accountability, team comfort with AI, and AI-in-offering potential', 'AI_MATURITY', 'draft', 'global', 0, 1, 'system'),
('itpl_drd_axis_supplement_v1', NULL, 'DRD Coverage Supplement (Axis 1/4/5)', 'Fills the weak areas identified inside otherwise well-covered axes: 1B Marketing, 1C Process Tech/R&D, 1H Financial Mgmt digitalization, 1I HR digitalization, 4B Data Storage, 4D Big Data Analysis, 5D Innovation Culture', 'DRD_SUPPLEMENT', 'draft', 'global', 0, 1, 'system');

-- ==========================================
-- AXIS 2 — Digital Product Portfolio
-- ==========================================
INSERT OR IGNORE INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_dp_strategy_1', 'itpl_digital_product_portfolio_v1', 'strategy', 'Walk me through your current product or service portfolio — which parts are physical, which are digital, and which combine both? What is driving the shift toward more digital, if any?', 10, 'open', 1),
('itq_dp_digital_1', 'itpl_digital_product_portfolio_v1', 'digital', 'Tell me about the last digital feature or product you shipped — what customer problem did it solve, and how do you know it solved it (usage data, feedback, revenue)?', 20, 'open', 1),
('itq_dp_strategy_2', 'itpl_digital_product_portfolio_v1', 'strategy', 'Which of your products or services could exist as a community/ecosystem play — customers interacting with each other, not just with you? What would need to be true to build that?', 30, 'open', 0),
('itq_dp_operations_1', 'itpl_digital_product_portfolio_v1', 'operations', 'How do you validate that a new digital product feature actually fits what customers expect before you build it — and what was the last time that validation caught a wrong assumption?', 40, 'open', 0),
('itq_dp_operations_2', 'itpl_digital_product_portfolio_v1', 'operations', 'If demand for your digital product tripled overnight, what would break first — the technology, the team, or the process? Walk me through why.', 50, 'open', 0);

-- ==========================================
-- AXIS 3 — Digital Business Model Discovery
-- ==========================================
INSERT OR IGNORE INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_bm_strategy_1', 'itpl_digital_business_model_v1', 'strategy', 'What percentage of revenue today comes through a purely digital channel (e-commerce, online booking, app) versus traditional channels? How has that mix moved in the last 2 years?', 10, 'open', 1),
('itq_bm_strategy_2', 'itpl_digital_business_model_v1', 'strategy', 'Do you operate — or have you considered — a platform model where you connect two sides of a market (buyers/sellers, providers/users) rather than selling directly? What stopped or started that?', 20, 'open', 1),
('itq_bm_finance_1', 'itpl_digital_business_model_v1', 'finance', 'Which of your offerings could be sold as a subscription or usage-based service instead of a one-time sale? What would you need to change operationally to do that?', 30, 'open', 0),
('itq_bm_strategy_3', 'itpl_digital_business_model_v1', 'strategy', 'Do you share, rent, or pool physical assets with customers or partners instead of selling them outright anywhere in the business? Walk me through the closest example.', 40, 'open', 0),
('itq_bm_finance_2', 'itpl_digital_business_model_v1', 'finance', 'Is there data you collect today that a customer or partner would pay for directly — even if you have never offered it as a product? What is stopping you from testing that?', 50, 'open', 0);

-- ==========================================
-- AXIS 6 — Cybersecurity & Resilience Baseline
-- ==========================================
INSERT OR IGNORE INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_cyb_strategy_1', 'itpl_cybersecurity_baseline_v1', 'strategy', 'Walk me through your last formal cybersecurity risk assessment — who ran it, what did it flag, and what actually got fixed afterward versus what is still open?', 10, 'open', 1),
('itq_cyb_digital_1', 'itpl_cybersecurity_baseline_v1', 'digital', 'Tell me about the last time you had a security incident or near-miss — what happened, how was it detected, and how long did it take to contain?', 20, 'open', 1),
('itq_cyb_digital_2', 'itpl_cybersecurity_baseline_v1', 'digital', 'How is access to critical systems and data controlled today — single sign-on with role-based access, shared passwords, or something in between? Where are the weakest points?', 30, 'open', 1),
('itq_cyb_people_1', 'itpl_cybersecurity_baseline_v1', 'people', 'When did your team last go through security awareness training, and can you recall a concrete example of someone catching — or falling for — a phishing attempt since then?', 40, 'open', 0),
('itq_cyb_operations_1', 'itpl_cybersecurity_baseline_v1', 'operations', 'If your core systems went down for 48 hours right now, what is the actual recovery plan — and when was it last tested for real, not just documented?', 50, 'open', 0),
('itq_cyb_compliance_1', 'itpl_cybersecurity_baseline_v1', 'compliance', 'Which security or data-protection standards (ISO 27001, NIS2, GDPR, industry-specific) apply to you, and where are you today against each — certified, in progress, or not started?', 60, 'open', 0);

-- ==========================================
-- AXIS 7 — AI Readiness & Governance
-- ==========================================
INSERT OR IGNORE INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
('itq_aim_digital_1', 'itpl_ai_readiness_governance_v1', 'digital', 'Walk me through any AI or generative-AI tool your team already uses day to day — what task does it actually replace or speed up, and how do you know it is working versus just novel?', 10, 'open', 1),
('itq_aim_strategy_1', 'itpl_ai_readiness_governance_v1', 'strategy', 'What decision in your business would most benefit from AI-assisted prediction or recommendation today — and what data would you need that you do not yet have in usable form?', 20, 'open', 1),
('itq_aim_digital_2', 'itpl_ai_readiness_governance_v1', 'digital', 'Is the data you would feed into an AI system today clean and structured enough to trust — or would someone have to clean it up first? Walk me through the worst offender.', 30, 'open', 0),
('itq_aim_compliance_1', 'itpl_ai_readiness_governance_v1', 'compliance', 'Who in the organization is accountable if an AI tool gives a wrong or biased recommendation that a person acts on — and has that scenario ever actually happened?', 40, 'open', 0),
('itq_aim_people_1', 'itpl_ai_readiness_governance_v1', 'people', 'How would you describe your team''s comfort with AI tools — actively experimenting, curious but cautious, or resistant? What is one concrete example that shows it?', 50, 'open', 0),
('itq_aim_strategy_2', 'itpl_ai_readiness_governance_v1', 'strategy', 'Where could AI change what you sell, not just how you operate — i.e. an AI-powered feature or service customers would pay for? Has anyone explored that seriously?', 60, 'open', 0);

-- ==========================================
-- SUPPLEMENT — Axis 1 (1B/1C/1H/1I) and Axis 4 (4B/4D) and Axis 5 (5D) weak areas
-- ==========================================
INSERT OR IGNORE INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required) VALUES
-- 1B Marketing
('itq_sup_1b_marketing_1', 'itpl_drd_axis_supplement_v1', 'digital', 'Walk me through how a marketing campaign gets planned, launched, and measured today — which parts are manual, and where do you lose visibility into what is actually working?', 10, 'open', 0),
-- 1C Process Tech / R&D
('itq_sup_1c_rd_1', 'itpl_drd_axis_supplement_v1', 'operations', 'Tell me about your last product/process improvement that came out of formal R&D versus one that came from someone''s ad-hoc idea. What does that tell you about how R&D actually works here?', 20, 'open', 0),
-- 1H Financial Mgmt digitalization
('itq_sup_1h_finance_1', 'itpl_drd_axis_supplement_v1', 'finance', 'Walk me through what happens between the last day of the month and closed books — which steps are automated, and which still depend on someone manually reconciling in Excel?', 30, 'open', 0),
-- 1I HR digitalization
('itq_sup_1i_hr_1', 'itpl_drd_axis_supplement_v1', 'people', 'Tell me about the last time you hired someone — which parts of onboarding were digital/self-service, and where did HR or the new hire have to chase paper or email?', 40, 'open', 0),
-- 4B Data Storage
('itq_sup_4b_data_1', 'itpl_drd_axis_supplement_v1', 'digital', 'Where does your operational data actually live today — one system of record, a patchwork of systems, or mostly spreadsheets? What is the plan, if any, to consolidate it?', 50, 'open', 0),
-- 4D Big Data Analysis
('itq_sup_4d_data_1', 'itpl_drd_axis_supplement_v1', 'digital', 'Beyond standard reports, has anyone tried to find a pattern or predict an outcome from your data (e.g. predicting demand, churn, failure)? What happened when they tried?', 60, 'open', 0),
-- 5D Innovation Culture
('itq_sup_5d_culture_1', 'itpl_drd_axis_supplement_v1', 'people', 'Tell me about the last idea an employee — not a manager — proposed that actually got tried. What happened to it, and what does that outcome signal to the rest of the team about whether it is safe to suggest something new?', 70, 'open', 0);
