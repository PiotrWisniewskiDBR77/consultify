-- V6-SEED-SYSTEM-TEMPLATES-001
-- Purpose: seed 18 V6 system interview templates and their questions.
-- Uses INSERT OR IGNORE for idempotency — safe to re-run.

-- ============================================================
-- T01 — Quick Company Snapshot
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t01_quick_company_snapshot', NULL, 'Quick Company Snapshot', 'A rapid pulse-check covering revenue, headcount, strategic priorities and top pain points. Ideal for first-contact or periodic health checks.', 'Pulse', 'approved', 'global', 'system', 'Owner / General Manager / Sponsor', 5, 'one_question_per_screen', '["strategy","operations","finance"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t01_q01', 'v6_t01_quick_company_snapshot', 'finance', 'What is the company''s approximate annual revenue and how has it trended over the past 3 years?', 'Include currency and whether growth is organic or acquisition-driven.', 'Attach recent P&L summary or annual report extract if available.', 'long_text', '[]', 'Revenue figure with 3-year trend direction (growing / flat / declining) and brief context', 1, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t01_q02', 'v6_t01_quick_company_snapshot', 'people', 'How many full-time employees does the organization have today?', NULL, NULL, 'number', '[]', 'Numeric headcount (FTE)', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t01_q03', 'v6_t01_quick_company_snapshot', 'strategy', 'What are the top 3 strategic priorities for the next 12 months?', 'Think about growth, efficiency, market expansion, digital transformation, etc.', NULL, 'long_text', '[]', 'Ranked list of 3 priorities with one-sentence rationale each', 1, 1, 1, 1, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t01_q04', 'v6_t01_quick_company_snapshot', 'operations', 'What is the single biggest operational bottleneck or pain point right now?', NULL, NULL, 'long_text', '[]', 'Specific bottleneck with impact description', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t01_q05', 'v6_t01_quick_company_snapshot', 'strategy', 'How would you rate the overall health of the business today?', NULL, NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 where 1 = critical issues, 5 = thriving', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T02 — Leadership Alignment Pulse
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t02_leadership_alignment_pulse', NULL, 'Leadership Alignment Pulse', 'Measures how aligned the leadership team is on vision, priorities and resource allocation. Surfaces hidden disagreements early.', 'Pulse', 'approved', 'global', 'system', 'Leadership Team / C-Suite / Board Members', 8, 'one_question_per_screen', '["strategy","people"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t02_q01', 'v6_t02_leadership_alignment_pulse', 'strategy', 'In your own words, what is the company''s #1 strategic priority for the next 12 months?', 'Answer independently — do not discuss with colleagues before responding.', NULL, 'long_text', '[]', 'Single clear priority statement in 1-2 sentences', 1, 1, 0, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t02_q02', 'v6_t02_leadership_alignment_pulse', 'strategy', 'How confident are you that the leadership team shares the same understanding of this priority?', NULL, NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 where 1 = very misaligned, 5 = fully aligned', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t02_q03', 'v6_t02_leadership_alignment_pulse', 'finance', 'Are current resource allocations (budget, people, time) consistent with the stated priorities?', NULL, 'Attach budget overview or resource plan if available.', 'single_choice', '["Fully aligned","Mostly aligned","Partially aligned","Misaligned"]', 'One choice with optional elaboration', 0, 1, 1, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t02_q04', 'v6_t02_leadership_alignment_pulse', 'people', 'What is the one topic the leadership team avoids discussing but should address?', 'Be candid — responses are aggregated anonymously.', NULL, 'long_text', '[]', 'Honest description of an avoided topic and why it matters', 1, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t02_q05', 'v6_t02_leadership_alignment_pulse', 'strategy', 'How effective is the current decision-making process at the leadership level?', NULL, NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 where 1 = dysfunctional, 5 = highly effective', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t02_q06', 'v6_t02_leadership_alignment_pulse', 'people', 'What one change would most improve leadership team effectiveness?', NULL, NULL, 'long_text', '[]', 'Concrete, actionable suggestion', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T03 — Strategic Direction Discovery
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t03_strategic_direction_discovery', NULL, 'Strategic Direction Discovery', 'Deep exploration of corporate strategy, competitive positioning, growth ambitions and strategic risks. Foundation for any transformation engagement.', 'Standard', 'approved', 'global', 'system', 'CEO / Managing Director / BU Heads', 25, 'one_question_per_screen', '["strategy"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t03_q01', 'v6_t03_strategic_direction_discovery', 'strategy', 'What is the company''s long-term vision (3-5 years) and how does it differ from where you are today?', 'Consider market position, scale, capabilities, and geographic reach.', 'Attach strategy deck or vision document if available.', 'long_text', '[]', 'Vision statement with gap analysis vs. current state', 1, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t03_q02', 'v6_t03_strategic_direction_discovery', 'strategy', 'Who are your top 3 competitors and what is your sustainable competitive advantage against each?', NULL, NULL, 'long_text', '[]', 'Named competitors with specific differentiators for each', 1, 1, 0, 1, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t03_q03', 'v6_t03_strategic_direction_discovery', 'strategy', 'What are the primary growth levers you plan to activate — organic growth, M&A, new markets, new products, or pricing?', NULL, NULL, 'long_text', '[]', 'Prioritized list of growth levers with expected contribution', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t03_q04', 'v6_t03_strategic_direction_discovery', 'strategy', 'What are the top 3 strategic risks that could derail your plan?', 'Think about market shifts, regulatory changes, technology disruption, talent gaps, etc.', NULL, 'long_text', '[]', 'Ranked risks with likelihood and potential impact', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t03_q05', 'v6_t03_strategic_direction_discovery', 'finance', 'What revenue and EBITDA targets have been set for the next 2-3 years?', NULL, 'Attach financial plan or board-approved targets if possible.', 'long_text', '[]', 'Specific financial targets with timeline', 0, 1, 1, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t03_q06', 'v6_t03_strategic_direction_discovery', 'strategy', 'How well does the current organizational structure support the strategic direction?', NULL, NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 with explanation of structural gaps', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t03_q07', 'v6_t03_strategic_direction_discovery', 'strategy', 'What strategic initiatives are currently in flight and how would you assess their progress?', NULL, 'Attach initiative tracker or PMO status report.', 'long_text', '[]', 'List of active initiatives with RAG status assessment', 0, 1, 1, 0, 1, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T04 — Operating Model Fit
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t04_operating_model_fit', NULL, 'Operating Model Fit', 'Evaluates whether the current operating model (structure, governance, processes, technology) is fit for the stated strategy. Identifies misalignments.', 'Standard', 'approved', 'global', 'system', 'Management Team / PMO / COO', 20, 'one_question_per_screen', '["strategy","operations","pmo"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t04_q01', 'v6_t04_operating_model_fit', 'operations', 'How would you describe the current operating model in terms of centralization vs. decentralization?', 'Consider decision rights, shared services, BU autonomy.', 'Attach org chart or operating model diagram if available.', 'long_text', '[]', 'Description of model with examples of centralized vs. decentralized functions', 1, 1, 1, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t04_q02', 'v6_t04_operating_model_fit', 'operations', 'Which core processes span multiple departments and where do handoffs break down?', NULL, NULL, 'long_text', '[]', 'Named cross-functional processes with specific breakdown points', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t04_q03', 'v6_t04_operating_model_fit', 'strategy', 'How well does the current governance structure (committees, cadences, escalation paths) support fast decision-making?', NULL, NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 where 1 = severely slows decisions, 5 = enables speed', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t04_q04', 'v6_t04_operating_model_fit', 'operations', 'Are there functions or capabilities that should be shared services but are currently duplicated across business units?', NULL, NULL, 'long_text', '[]', 'List of duplicated functions with consolidation potential', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t04_q05', 'v6_t04_operating_model_fit', 'people', 'Where are the most significant talent or capability gaps relative to the target operating model?', NULL, NULL, 'long_text', '[]', 'Specific roles or capabilities that are missing or understaffed', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t04_q06', 'v6_t04_operating_model_fit', 'operations', 'If you could redesign one aspect of the operating model tomorrow, what would it be and why?', NULL, NULL, 'long_text', '[]', 'Single highest-impact change with expected benefit', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T05 — Operational Excellence Discovery
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t05_operational_excellence_discovery', NULL, 'Operational Excellence Discovery', 'Comprehensive assessment of operational maturity across planning, execution, quality, and continuous improvement. Identifies quick wins and structural improvements.', 'Standard', 'approved', 'global', 'system', 'Operations Leaders / VP Operations / Plant Directors', 25, 'one_question_per_screen', '["operations"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t05_q01', 'v6_t05_operational_excellence_discovery', 'operations', 'What are the top 3 KPIs you use to measure operational performance and what are their current values vs. targets?', 'Examples: OEE, on-time delivery, first-pass yield, cycle time.', 'Attach KPI dashboard or scorecard if available.', 'long_text', '[]', 'Named KPIs with current value, target, and gap', 1, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t05_q02', 'v6_t05_operational_excellence_discovery', 'operations', 'How mature is your demand and capacity planning process?', 'Consider forecast accuracy, planning horizon, S&OP integration.', NULL, 'single_choice', '["Ad-hoc / reactive","Basic spreadsheet-based","Structured with regular cadence","Advanced with system support","Best-in-class integrated S&OP"]', 'One choice reflecting current maturity level', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t05_q03', 'v6_t05_operational_excellence_discovery', 'operations', 'What are the most frequent causes of unplanned downtime or production disruption?', NULL, NULL, 'long_text', '[]', 'Top 3-5 root causes ranked by frequency or impact', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t05_q04', 'v6_t05_operational_excellence_discovery', 'operations', 'Do you have a formal continuous improvement program (Lean, Six Sigma, Kaizen) and how actively is it used?', NULL, NULL, 'single_choice', '["No formal program","Program exists but rarely used","Active in some areas","Broadly embedded","Culture of continuous improvement"]', 'One choice with optional examples', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t05_q05', 'v6_t05_operational_excellence_discovery', 'operations', 'What percentage of your processes are documented with standard operating procedures (SOPs)?', NULL, NULL, 'single_choice', '["<25%","25-50%","50-75%","75-90%",">90%"]', 'Percentage range selection', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t05_q06', 'v6_t05_operational_excellence_discovery', 'operations', 'How do you track and manage quality issues from detection through to root cause resolution?', NULL, 'Attach CAPA log or quality management workflow.', 'long_text', '[]', 'Description of quality management workflow and tools used', 0, 1, 1, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t05_q07', 'v6_t05_operational_excellence_discovery', 'operations', 'What is the single biggest operational improvement opportunity you see today?', NULL, NULL, 'long_text', '[]', 'Specific opportunity with estimated impact', 0, 1, 0, 0, 1, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T06 — Process Pain Mapping
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t06_process_pain_mapping', NULL, 'Process Pain Mapping', 'Captures frontline perspective on process inefficiencies, workarounds, and friction points. Essential for bottom-up improvement identification.', 'Standard', 'approved', 'global', 'system', 'Frontline Staff / Process Owners / Team Leads', 20, 'one_question_per_screen', '["operations"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t06_q01', 'v6_t06_process_pain_mapping', 'operations', 'Which process do you spend the most time on that you feel adds the least value?', 'Think about repetitive tasks, unnecessary approvals, redundant data entry.', NULL, 'long_text', '[]', 'Named process with estimated time spent and reason it feels low-value', 1, 1, 0, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t06_q02', 'v6_t06_process_pain_mapping', 'operations', 'What workarounds have you or your team created because the official process doesn''t work well?', 'Workarounds often signal broken processes — be specific.', NULL, 'long_text', '[]', 'Description of workaround, the problem it solves, and how often it is used', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t06_q03', 'v6_t06_process_pain_mapping', 'operations', 'How many different systems or tools do you use in a typical day to complete your work?', NULL, NULL, 'number', '[]', 'Count of distinct systems/tools', 0, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t06_q04', 'v6_t06_process_pain_mapping', 'operations', 'Where do handoffs between teams or departments cause the most delays or errors?', NULL, NULL, 'long_text', '[]', 'Specific handoff point with description of delay/error and frequency', 1, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t06_q05', 'v6_t06_process_pain_mapping', 'operations', 'How much of your working time is spent on manual data entry, copy-pasting, or re-keying information?', NULL, NULL, 'single_choice', '["<10%","10-25%","25-50%",">50%"]', 'Percentage range of time on manual data handling', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t06_q06', 'v6_t06_process_pain_mapping', 'operations', 'If you could fix one thing about how work flows through your area, what would it be?', NULL, NULL, 'long_text', '[]', 'Single highest-priority fix with expected benefit', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T07 — Manufacturing Walkthrough
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t07_manufacturing_walkthrough', NULL, 'Manufacturing Walkthrough', 'Deep-dive into manufacturing operations covering OEE, maintenance, quality, safety, and shop-floor management systems. Best used alongside a physical plant tour.', 'Deep Dive', 'approved', 'global', 'system', 'Plant Manager / Production Manager / Shift Leaders', 35, 'one_question_per_screen', '["operations"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t07_q01', 'v6_t07_manufacturing_walkthrough', 'operations', 'What is the current OEE (Overall Equipment Effectiveness) and how does it break down into availability, performance, and quality?', 'If OEE is not formally tracked, provide best estimates for each component.', 'Attach OEE report or production dashboard.', 'long_text', '[]', 'OEE percentage with availability/performance/quality breakdown', 1, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t07_q02', 'v6_t07_manufacturing_walkthrough', 'operations', 'What is your maintenance strategy — predominantly reactive, preventive, or predictive?', NULL, NULL, 'single_choice', '["Mostly reactive (fix when broken)","Preventive (scheduled maintenance)","Mix of preventive and predictive","Predominantly predictive / condition-based"]', 'One choice reflecting dominant approach', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t07_q03', 'v6_t07_manufacturing_walkthrough', 'operations', 'What are the top 3 sources of scrap, rework, or quality rejects?', NULL, 'Attach scrap/rework Pareto analysis if available.', 'long_text', '[]', 'Ranked list of quality loss sources with approximate cost or volume impact', 1, 1, 1, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t07_q04', 'v6_t07_manufacturing_walkthrough', 'operations', 'How are changeovers managed and what is the average changeover time for your main production lines?', 'Include whether SMED or similar techniques are used.', NULL, 'long_text', '[]', 'Changeover time in minutes with description of current methodology', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t07_q05', 'v6_t07_manufacturing_walkthrough', 'operations', 'How is production scheduling done — what tools, cadence, and planning horizon do you use?', NULL, NULL, 'long_text', '[]', 'Description of scheduling process, tools (ERP/Excel/MES), and typical horizon', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t07_q06', 'v6_t07_manufacturing_walkthrough', 'operations', 'What shop-floor management routines are in place (daily stand-ups, visual boards, Gemba walks)?', NULL, 'Attach photo of visual management board if possible.', 'long_text', '[]', 'List of routines with frequency and participation level', 0, 1, 1, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t07_q07', 'v6_t07_manufacturing_walkthrough', 'operations', 'What is the current safety record (lost-time incidents, near-misses) and how is safety culture maintained?', NULL, NULL, 'long_text', '[]', 'Safety metrics with description of safety management approach', 0, 1, 0, 0, 1, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t07_q08', 'v6_t07_manufacturing_walkthrough', 'operations', 'What is the single biggest constraint limiting your production throughput today?', NULL, NULL, 'long_text', '[]', 'Specific constraint (machine, material, labor, process) with impact quantification', 0, 1, 0, 0, 1, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T08 — Digital Landscape Discovery
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t08_digital_landscape_discovery', NULL, 'Digital Landscape Discovery', 'Maps the current IT/OT landscape, integration maturity, technical debt, and digital ambitions. Foundation for digital transformation roadmaps.', 'Standard', 'approved', 'global', 'system', 'CIO / IT Director / OT Manager / Operations Leaders', 20, 'one_question_per_screen', '["digital","it"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t08_q01', 'v6_t08_digital_landscape_discovery', 'digital', 'What are the core systems in your technology landscape (ERP, CRM, MES, WMS, BI, etc.) and how old are they?', 'List the main systems, vendors, and approximate implementation year.', 'Attach application landscape diagram or system inventory.', 'long_text', '[]', 'Table-style list: system name, vendor, year deployed, and primary function', 1, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t08_q02', 'v6_t08_digital_landscape_discovery', 'digital', 'How well are your core systems integrated — do they share data automatically or require manual transfers?', NULL, NULL, 'single_choice', '["Mostly siloed — manual transfers","Some point-to-point integrations","Middleware/integration layer in place","Well-integrated with real-time data flow"]', 'One choice reflecting integration maturity', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t08_q03', 'v6_t08_digital_landscape_discovery', 'digital', 'What is your annual IT spend as a percentage of revenue, and how is it split between run-the-business vs. change-the-business?', NULL, 'Attach IT budget breakdown if available.', 'long_text', '[]', 'IT spend percentage with run/change split', 1, 1, 1, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t08_q04', 'v6_t08_digital_landscape_discovery', 'digital', 'Where is technical debt causing the most pain — which systems or integrations are most fragile?', NULL, NULL, 'long_text', '[]', 'Specific systems or integrations with description of fragility and business impact', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t08_q05', 'v6_t08_digital_landscape_discovery', 'digital', 'What digital initiatives are planned or in progress for the next 12-18 months?', NULL, 'Attach digital roadmap or project portfolio.', 'long_text', '[]', 'List of initiatives with timeline and expected business outcome', 0, 1, 1, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t08_q06', 'v6_t08_digital_landscape_discovery', 'digital', 'How would you rate the organization''s overall digital maturity?', NULL, NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 where 1 = paper-based/legacy, 5 = digitally advanced', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T09 — Automation Readiness
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t09_automation_readiness', NULL, 'Automation Readiness', 'Assesses the organization''s readiness for process automation (RPA, workflow automation, AI/ML). Identifies high-value automation candidates.', 'Standard', 'approved', 'global', 'system', 'Operations Leaders / IT / Finance / Process Owners', 20, 'one_question_per_screen', '["digital","operations","it"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t09_q01', 'v6_t09_automation_readiness', 'operations', 'Which processes consume the most manual effort (FTEs or hours per week) and are highly repetitive?', 'Focus on rule-based, high-volume tasks that follow consistent patterns.', NULL, 'long_text', '[]', 'Top 3-5 processes with estimated FTE/hours and volume', 1, 1, 0, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t09_q02', 'v6_t09_automation_readiness', 'digital', 'Have you implemented any automation (RPA, workflow tools, scripts) already? If so, what and with what results?', NULL, NULL, 'long_text', '[]', 'List of existing automations with outcomes (time saved, error reduction)', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t09_q03', 'v6_t09_automation_readiness', 'digital', 'How standardized and documented are the processes you would like to automate?', NULL, NULL, 'single_choice', '["Not documented — tribal knowledge","Partially documented","Well-documented SOPs exist","Documented and already measured"]', 'One choice reflecting documentation maturity', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t09_q04', 'v6_t09_automation_readiness', 'digital', 'What is the quality and accessibility of the data needed for automation (structured, clean, accessible via API)?', NULL, NULL, 'single_choice', '["Poor — unstructured, siloed, inconsistent","Mixed — some structured, some manual","Good — mostly structured and accessible","Excellent — clean, API-accessible, governed"]', 'One choice reflecting data readiness', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t09_q05', 'v6_t09_automation_readiness', 'people', 'How would you describe the workforce''s attitude toward automation — is there enthusiasm, neutrality, or resistance?', NULL, NULL, 'single_choice', '["Strong resistance","Cautious / skeptical","Neutral","Mostly positive","Enthusiastic and pulling for it"]', 'One choice with optional context', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t09_q06', 'v6_t09_automation_readiness', 'finance', 'What budget or investment capacity exists for automation initiatives in the next 12 months?', NULL, NULL, 'long_text', '[]', 'Budget range or investment appetite description', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T10 — Data & Reporting Maturity
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t10_data_reporting_maturity', NULL, 'Data & Reporting Maturity', 'Evaluates data governance, reporting infrastructure, analytics capabilities, and decision-making culture. Identifies gaps between data availability and business needs.', 'Standard', 'approved', 'global', 'system', 'Data Owners / BI Analysts / Controlling / IT', 20, 'one_question_per_screen', '["data","digital"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t10_q01', 'v6_t10_data_reporting_maturity', 'digital', 'What BI/reporting tools does the organization use and how widely are they adopted?', 'Examples: Power BI, Tableau, Qlik, Excel-based reports, custom dashboards.', NULL, 'long_text', '[]', 'List of tools with approximate number of active users and use cases', 1, 1, 0, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t10_q02', 'v6_t10_data_reporting_maturity', 'digital', 'How long does it typically take to get a new report or data analysis from request to delivery?', NULL, NULL, 'single_choice', '["Hours","1-3 days","1-2 weeks","More than 2 weeks","Depends heavily on complexity"]', 'One choice reflecting typical turnaround', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t10_q03', 'v6_t10_data_reporting_maturity', 'digital', 'Is there a single source of truth for key business metrics, or do different departments report different numbers?', NULL, NULL, 'single_choice', '["Single source of truth exists","Mostly aligned with minor discrepancies","Significant discrepancies between departments","No agreed definitions — everyone has their own version"]', 'One choice reflecting data consistency', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t10_q04', 'v6_t10_data_reporting_maturity', 'digital', 'How would you rate the overall data quality across your core systems?', 'Consider completeness, accuracy, timeliness, and consistency.', NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 where 1 = unreliable, 5 = high quality and trusted', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t10_q05', 'v6_t10_data_reporting_maturity', 'digital', 'Is there a formal data governance framework (data owners, data dictionary, quality rules)?', NULL, NULL, 'yes_no', '[]', 'Yes/No with description of what exists', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t10_q06', 'v6_t10_data_reporting_maturity', 'digital', 'What data or analytics capability is most urgently needed but currently missing?', NULL, NULL, 'long_text', '[]', 'Specific capability gap with business impact of not having it', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T11 — Finance Baseline
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t11_finance_baseline', NULL, 'Finance Baseline', 'Establishes the financial baseline: revenue structure, cost base, margins, and financial planning maturity. Essential for any value-creation or cost-reduction program.', 'Standard', 'approved', 'global', 'system', 'CFO / Finance Director / Controlling', 20, 'one_question_per_screen', '["finance"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t11_q01', 'v6_t11_finance_baseline', 'finance', 'What is the revenue breakdown by business line, product group, or geography?', NULL, 'Attach revenue bridge or segmentation report.', 'long_text', '[]', 'Revenue split with percentages by segment', 1, 1, 1, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t11_q02', 'v6_t11_finance_baseline', 'finance', 'What are the current gross margin and EBITDA margin, and how have they trended over the past 3 years?', NULL, 'Attach P&L summary or management accounts.', 'long_text', '[]', 'Margin percentages with 3-year trend and key drivers of change', 1, 1, 1, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t11_q03', 'v6_t11_finance_baseline', 'finance', 'What is the split between fixed and variable costs, and which cost categories are the largest?', NULL, NULL, 'long_text', '[]', 'Fixed/variable split with top 5 cost categories by size', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t11_q04', 'v6_t11_finance_baseline', 'finance', 'How mature is the budgeting and forecasting process — annual budget only, rolling forecasts, or driver-based planning?', NULL, NULL, 'single_choice', '["Annual budget only","Annual budget with quarterly re-forecasts","Rolling forecasts (monthly/quarterly)","Driver-based planning with scenarios"]', 'One choice reflecting planning maturity', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t11_q05', 'v6_t11_finance_baseline', 'finance', 'What is the typical variance between budget and actuals at year-end?', NULL, NULL, 'single_choice', '["<5%","5-10%","10-20%",">20%","Not consistently tracked"]', 'Percentage range of typical variance', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t11_q06', 'v6_t11_finance_baseline', 'finance', 'What are the top 3 financial risks or concerns for the next 12 months?', NULL, NULL, 'long_text', '[]', 'Ranked financial risks with potential magnitude', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T12 — Cost & Efficiency Review
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t12_cost_efficiency_review', NULL, 'Cost & Efficiency Review', 'Identifies cost reduction and efficiency improvement opportunities across the organization. Covers procurement, labor productivity, overhead, and outsourcing potential.', 'Standard', 'approved', 'global', 'system', 'Finance / Controlling / Business Unit Owners', 20, 'one_question_per_screen', '["finance","operations"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t12_q01', 'v6_t12_cost_efficiency_review', 'finance', 'Which cost categories have grown faster than revenue over the past 2-3 years?', NULL, 'Attach cost trend analysis or bridge chart.', 'long_text', '[]', 'Named cost categories with growth rate vs. revenue growth', 1, 1, 1, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t12_q02', 'v6_t12_cost_efficiency_review', 'finance', 'When was the last comprehensive procurement review or supplier renegotiation?', NULL, NULL, 'short_text', '[]', 'Approximate date or timeframe', 0, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t12_q03', 'v6_t12_cost_efficiency_review', 'operations', 'What is the labor productivity trend — revenue per employee or output per labor hour?', NULL, 'Attach productivity metrics or benchmarking data.', 'long_text', '[]', 'Productivity metric with 2-3 year trend direction', 1, 1, 1, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t12_q04', 'v6_t12_cost_efficiency_review', 'finance', 'Are there functions or activities that could be outsourced, offshored, or automated to reduce cost?', NULL, NULL, 'long_text', '[]', 'Specific candidates with estimated savings potential', 1, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t12_q05', 'v6_t12_cost_efficiency_review', 'finance', 'How effective is the current cost control and approval process for discretionary spending?', NULL, NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 where 1 = no controls, 5 = tight and effective', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t12_q06', 'v6_t12_cost_efficiency_review', 'finance', 'What is the single largest cost reduction opportunity you see that has not yet been pursued?', NULL, NULL, 'long_text', '[]', 'Specific opportunity with estimated annual savings', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T13 — Working Capital & Cash
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t13_working_capital_cash', NULL, 'Working Capital & Cash', 'Analyzes working capital management across receivables, payables, and inventory. Identifies cash release opportunities and liquidity risks.', 'Standard', 'approved', 'global', 'system', 'CFO / Treasury / Finance / Procurement', 20, 'one_question_per_screen', '["finance","procurement"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t13_q01', 'v6_t13_working_capital_cash', 'finance', 'What are the current DSO (Days Sales Outstanding), DPO (Days Payable Outstanding), and DIO (Days Inventory Outstanding)?', NULL, 'Attach working capital report or cash conversion cycle analysis.', 'long_text', '[]', 'DSO, DPO, DIO values with trend vs. prior year', 1, 1, 1, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t13_q02', 'v6_t13_working_capital_cash', 'finance', 'What percentage of receivables is overdue (>30 days, >60 days, >90 days)?', NULL, NULL, 'long_text', '[]', 'Aging breakdown with percentages for each bucket', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t13_q03', 'v6_t13_working_capital_cash', 'operations', 'What is the current inventory profile — raw materials, WIP, and finished goods split — and how much is slow-moving or obsolete?', NULL, 'Attach inventory aging report.', 'long_text', '[]', 'Inventory split with slow-moving/obsolete percentage and value', 1, 1, 1, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t13_q04', 'v6_t13_working_capital_cash', 'finance', 'Are payment terms with key suppliers actively managed and optimized?', NULL, NULL, 'single_choice', '["No — standard terms accepted","Some negotiation on major contracts","Active program to optimize terms","Advanced — supply chain finance / dynamic discounting in place"]', 'One choice reflecting payables maturity', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t13_q05', 'v6_t13_working_capital_cash', 'finance', 'How accurate is the cash flow forecast and what is the typical forecast horizon?', NULL, NULL, 'long_text', '[]', 'Forecast accuracy percentage and horizon (weekly/monthly/quarterly)', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t13_q06', 'v6_t13_working_capital_cash', 'finance', 'Where do you see the biggest opportunity to release cash from working capital?', NULL, NULL, 'long_text', '[]', 'Specific lever (receivables, inventory, payables) with estimated cash release', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T14 — Customer Experience Discovery
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t14_customer_experience_discovery', NULL, 'Customer Experience Discovery', 'Maps the end-to-end customer journey, identifies pain points, and assesses service delivery capabilities. Covers acquisition through retention.', 'Standard', 'approved', 'global', 'system', 'Customer Service / Operations / Sales / Marketing', 20, 'one_question_per_screen', '["customer-service","sales","operations"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t14_q01', 'v6_t14_customer_experience_discovery', 'operations', 'What are the key stages in your customer journey from first contact to ongoing service?', 'Think about awareness, evaluation, purchase, onboarding, service, renewal.', 'Attach customer journey map if available.', 'long_text', '[]', 'Named stages with brief description of each', 1, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t14_q02', 'v6_t14_customer_experience_discovery', 'operations', 'At which stage of the customer journey do you lose the most customers or receive the most complaints?', NULL, NULL, 'long_text', '[]', 'Specific stage with description of common failure mode and volume', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t14_q03', 'v6_t14_customer_experience_discovery', 'operations', 'What is your current NPS, CSAT, or equivalent customer satisfaction metric?', NULL, 'Attach latest customer satisfaction survey results.', 'long_text', '[]', 'Metric name, current score, trend, and benchmark comparison', 1, 1, 1, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t14_q04', 'v6_t14_customer_experience_discovery', 'operations', 'What is the average response time for customer inquiries and how does it compare to your SLA?', NULL, NULL, 'long_text', '[]', 'Response time with SLA target and compliance rate', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t14_q05', 'v6_t14_customer_experience_discovery', 'digital', 'What systems and channels do customers use to interact with you (phone, email, portal, chat, in-person)?', NULL, NULL, 'long_text', '[]', 'List of channels with approximate volume split', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t14_q06', 'v6_t14_customer_experience_discovery', 'operations', 'What is your customer retention rate and what are the top reasons for churn?', NULL, NULL, 'long_text', '[]', 'Retention rate percentage with top 3 churn reasons', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T15 — Commercial Pipeline & Forecast
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t15_commercial_pipeline_forecast', NULL, 'Commercial Pipeline & Forecast', 'Assesses sales pipeline health, forecasting accuracy, pricing discipline, and commercial process maturity. Critical for revenue growth programs.', 'Standard', 'approved', 'global', 'system', 'Sales Leaders / Commercial Director / Finance', 20, 'one_question_per_screen', '["sales","finance"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t15_q01', 'v6_t15_commercial_pipeline_forecast', 'finance', 'What is the current sales pipeline value and how does it compare to the revenue target (pipeline coverage ratio)?', NULL, 'Attach pipeline report or CRM dashboard export.', 'long_text', '[]', 'Pipeline value, revenue target, and coverage ratio (e.g. 3x)', 1, 1, 1, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t15_q02', 'v6_t15_commercial_pipeline_forecast', 'finance', 'What is the average win rate and how does it vary by deal size, segment, or product?', NULL, NULL, 'long_text', '[]', 'Overall win rate with breakdown by key dimension', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t15_q03', 'v6_t15_commercial_pipeline_forecast', 'finance', 'How accurate have sales forecasts been over the past 4 quarters (forecast vs. actual)?', NULL, NULL, 'single_choice', '["Within 5%","5-10% variance","10-20% variance",">20% variance","No formal forecast"]', 'One choice reflecting forecast accuracy', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t15_q04', 'v6_t15_commercial_pipeline_forecast', 'finance', 'How is pricing managed — is there a formal pricing governance process or is it largely sales-rep discretion?', NULL, NULL, 'single_choice', '["Largely rep discretion","Guidelines exist but loosely followed","Formal pricing framework with approval levels","Advanced — dynamic/value-based pricing"]', 'One choice reflecting pricing maturity', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t15_q05', 'v6_t15_commercial_pipeline_forecast', 'finance', 'What is the average sales cycle length and has it been increasing or decreasing?', NULL, NULL, 'long_text', '[]', 'Average cycle in days/weeks with trend direction', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t15_q06', 'v6_t15_commercial_pipeline_forecast', 'finance', 'What is the biggest barrier to growing revenue faster?', NULL, NULL, 'long_text', '[]', 'Single biggest constraint with explanation', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T16 — Organization & Roles Clarity
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t16_organization_roles_clarity', NULL, 'Organization & Roles Clarity', 'Assesses organizational design, role clarity, spans of control, and accountability frameworks. Identifies structural inefficiencies and governance gaps.', 'Standard', 'approved', 'global', 'system', 'Managers / HR / PMO', 20, 'one_question_per_screen', '["people","hr","pmo"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t16_q01', 'v6_t16_organization_roles_clarity', 'people', 'How clearly defined are roles and responsibilities in your area — could each person articulate their top 3 accountabilities?', NULL, NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 where 1 = very unclear, 5 = crystal clear with documented RACI', 1, 1, 0, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t16_q02', 'v6_t16_organization_roles_clarity', 'people', 'Where do you see the most overlap or duplication of responsibilities between teams or roles?', NULL, 'Attach org chart or RACI matrix if available.', 'long_text', '[]', 'Specific overlaps with teams/roles involved and impact', 1, 1, 1, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t16_q03', 'v6_t16_organization_roles_clarity', 'people', 'Are there decisions that take too long because it''s unclear who has the authority to make them?', NULL, NULL, 'long_text', '[]', 'Examples of slow decisions with root cause (unclear authority, too many approvers, etc.)', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t16_q04', 'v6_t16_organization_roles_clarity', 'people', 'What is the average span of control for managers in your area and does it feel appropriate?', 'Span of control = number of direct reports per manager.', NULL, 'long_text', '[]', 'Numeric span with assessment of whether it is too narrow, appropriate, or too wide', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t16_q05', 'v6_t16_organization_roles_clarity', 'people', 'How many organizational layers exist between the CEO and the frontline in your area?', NULL, NULL, 'number', '[]', 'Number of layers', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t16_q06', 'v6_t16_organization_roles_clarity', 'people', 'What one structural change would most improve clarity and speed of execution?', NULL, NULL, 'long_text', '[]', 'Single structural recommendation with expected benefit', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T17 — Change Readiness
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t17_change_readiness', NULL, 'Change Readiness', 'Measures the organization''s capacity and willingness to absorb change. Covers change fatigue, communication effectiveness, leadership sponsorship, and past transformation track record.', 'Standard', 'approved', 'global', 'system', 'Leadership Team / Middle Management', 20, 'one_question_per_screen', '["people","strategy"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t17_q01', 'v6_t17_change_readiness', 'people', 'How many significant change initiatives has the organization undertaken in the past 2 years, and how would you rate their success?', 'Consider ERP implementations, restructurings, process changes, digital projects, etc.', NULL, 'long_text', '[]', 'Count of initiatives with success rate assessment and examples', 1, 1, 0, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t17_q02', 'v6_t17_change_readiness', 'people', 'How would you describe the current level of change fatigue in the organization?', NULL, NULL, 'single_choice', '["No fatigue — appetite for more change","Low fatigue — manageable","Moderate fatigue — selective capacity","High fatigue — resistance to new initiatives","Severe — people are burned out"]', 'One choice reflecting fatigue level', 1, 1, 0, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t17_q03', 'v6_t17_change_readiness', 'people', 'How effective is internal communication about change — do people understand the why, what, and how?', NULL, NULL, 'rating', '["1","2","3","4","5"]', 'Rating 1-5 where 1 = poor/no communication, 5 = excellent and consistent', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t17_q04', 'v6_t17_change_readiness', 'strategy', 'Is there visible and consistent executive sponsorship for current change initiatives?', NULL, NULL, 'single_choice', '["No visible sponsorship","Sponsorship exists but inconsistent","Strong sponsorship from some leaders","Consistent sponsorship across leadership team"]', 'One choice reflecting sponsorship quality', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t17_q05', 'v6_t17_change_readiness', 'people', 'What is the biggest reason past change initiatives have failed or underdelivered?', NULL, NULL, 'long_text', '[]', 'Root cause analysis of past failures with specific examples', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t17_q06', 'v6_t17_change_readiness', 'people', 'What would need to be true for the next major change initiative to succeed?', NULL, NULL, 'long_text', '[]', 'Key success factors and prerequisites', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- T18 — Quality, Compliance & Risk
-- ============================================================
INSERT OR IGNORE INTO interview_library_templates
  (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, area_tags, is_default, version, created_by, created_at, updated_at)
VALUES
  ('v6_t18_quality_compliance_risk', NULL, 'Quality, Compliance & Risk', 'Assesses quality management systems, regulatory compliance posture, and enterprise risk management maturity. Covers certifications, audit findings, and risk governance.', 'Standard', 'approved', 'global', 'system', 'Quality Manager / Compliance Officer / Operations Leaders', 20, 'one_question_per_screen', '["compliance","risk","operations"]', 0, 1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO interview_library_template_questions
  (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at, updated_at)
VALUES
  ('v6_t18_q01', 'v6_t18_quality_compliance_risk', 'operations', 'What quality management certifications does the organization hold (ISO 9001, IATF 16949, etc.) and when is the next recertification audit?', NULL, 'Attach certificate copies or audit schedule.', 'long_text', '[]', 'List of certifications with expiry/recertification dates', 1, 1, 1, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t18_q02', 'v6_t18_quality_compliance_risk', 'operations', 'What were the most significant findings from the last internal or external audit?', NULL, 'Attach audit report summary or corrective action log.', 'long_text', '[]', 'Top findings with severity and current remediation status', 1, 1, 1, 0, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t18_q03', 'v6_t18_quality_compliance_risk', 'operations', 'What is the current cost of quality (prevention, appraisal, internal failure, external failure) as a percentage of revenue?', 'If not formally tracked, provide your best estimate.', NULL, 'long_text', '[]', 'Cost of quality breakdown or estimate with percentage of revenue', 1, 1, 0, 0, 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t18_q04', 'v6_t18_quality_compliance_risk', 'operations', 'What regulatory requirements have the most impact on your operations and how confident are you in current compliance?', NULL, NULL, 'long_text', '[]', 'Key regulations with compliance confidence level for each', 0, 1, 0, 0, 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t18_q05', 'v6_t18_quality_compliance_risk', 'operations', 'Is there a formal enterprise risk register and how frequently is it reviewed?', NULL, NULL, 'single_choice', '["No risk register","Exists but rarely updated","Reviewed quarterly","Reviewed monthly with active mitigation tracking"]', 'One choice reflecting risk management maturity', 0, 1, 0, 0, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('v6_t18_q06', 'v6_t18_quality_compliance_risk', 'operations', 'What is the top compliance or quality risk that keeps you up at night?', NULL, NULL, 'long_text', '[]', 'Specific risk with potential impact and current mitigation gaps', 0, 1, 0, 0, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
