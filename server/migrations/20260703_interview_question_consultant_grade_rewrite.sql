-- ============================================================================
-- 20260703 — Interview (M10) question content: consultant-grade rewrite
-- ----------------------------------------------------------------------------
-- Task: OXFORD O5.6 (#89) — the default Interview question set must read like
-- a senior consultant's discovery diagnostic, not an HR engagement survey.
--
-- Audit finding: `interview_question_templates` (seeded in 295_interview_context.sql)
-- is the DEFAULT question bank copied into every new interview_sessions row
-- created via the plain "start session" path in InterviewController.ts
-- (`SELECT * FROM interview_question_templates ORDER BY category, sort_order`
-- -> INSERT INTO interview_questions ...). It is therefore the highest-traffic
-- question set in the module, and it previously contained textbook survey
-- anti-patterns:
--   - closed yes/no with no follow-up ("Do you have dedicated IT/Digital team?",
--     "Are you using any cloud services? Which ones?")
--   - a bare 1-5 rating with no business context ("How would you rate your
--     digital maturity (1-5)?")
--   - generic/vague prompts with no probe for a specific case, cost, or root
--     cause ("What are your main operational processes?", "How do employees
--     typically react to new tools/processes?")
--
-- Fix: rewrite all 25 questions in place (same ids, same category, same
-- sort_order, same is_required) as open, process-anchored diagnostic
-- questions with a built-in follow-up/probe ("Walk me through...", "Tell me
-- about the last time...", "What did that cost?"), matching the standard
-- already used by server/scripts/rewrite-en-system-templates.ts for the
-- `lib-tpl-*__en` system templates.
--
-- Also upgrades the two bare 1-5 scale questions in the 298_interview_draft_
-- templates.sql "Voice of Employee / Change Readiness" template
-- (interview_library_template_questions), which had the same anti-pattern.
--
-- Schema: UNCHANGED. No columns added, no tables created. Pure content UPDATE
-- by stable id, idempotent — safe to re-run any number of times.
--
-- Language: `interview_question_templates` and `interview_library_template_
-- questions` (for the ids touched here) have no per-row language column —
-- unlike `interview_library_templates`, which has `language` and already
-- carries a matching EN/PL pair for the 5 "lib-tpl-*" system templates
-- (see server/scripts/rewrite-en-system-templates.ts and
-- rewrite-pl-system-templates.cjs). Per explicit instruction, this migration
-- does NOT add a language column to tables that don't have one. The ids
-- touched here remain English-only, matching their pre-existing state; this
-- is a known, called-out gap (see task report), not an oversight.
--
-- Auto-applied by DatabaseInitializer (pattern ^\d{8}_.*\.sql$) and tracked
-- in tp_migration_history.
-- ============================================================================

-- ==========================================
-- interview_question_templates (default session seed, 25 questions)
-- ==========================================

UPDATE interview_question_templates SET question_text = 'Walk me through your top 2-3 business objectives for the next 2-3 years — and for each, what specifically has to change operationally for you to get there?' WHERE id = 'tpl_strategy_1';
UPDATE interview_question_templates SET question_text = 'Describe a recent decision where digital capability — or the lack of it — directly changed a business outcome. What does that tell you about where transformation needs to go next?' WHERE id = 'tpl_strategy_2';
UPDATE interview_question_templates SET question_text = 'Which competitor or market shift worries you most right now, and what capability would you need to build to stay ahead of it?' WHERE id = 'tpl_strategy_3';
UPDATE interview_question_templates SET question_text = 'Of everything on this year''s roadmap, what is the one initiative that would hurt the business most if it failed? Why does it carry that much weight?' WHERE id = 'tpl_strategy_4';
UPDATE interview_question_templates SET question_text = 'What is one external change — customer behavior, regulation, a competitor move — that has already forced you to change how you operate? How did you respond?' WHERE id = 'tpl_strategy_5';

UPDATE interview_question_templates SET question_text = 'Walk me through your core end-to-end process — from request or order to delivery — step by step, including every handoff between teams. Where does it slow down?' WHERE id = 'tpl_operations_1';
UPDATE interview_question_templates SET question_text = 'Tell me about the last time this process broke down or ran late. What actually went wrong, and what did it cost you — in time, money, or a customer?' WHERE id = 'tpl_operations_2';
UPDATE interview_question_templates SET question_text = 'Where does work pile up and wait, even when everyone is busy? What is the real constraint, and how do you know it is the actual bottleneck and not just where you happen to be looking?' WHERE id = 'tpl_operations_3';
UPDATE interview_question_templates SET question_text = 'Which operational metric do you trust the least, and why? What would you need to see instead to make a confident call?' WHERE id = 'tpl_operations_4';
UPDATE interview_question_templates SET question_text = 'Which task do you or your team repeat by hand every week that a system should be doing instead? What is stopping you from automating it?' WHERE id = 'tpl_operations_5';

UPDATE interview_question_templates SET question_text = 'Which systems run this business day to day, and where does someone have to re-key or copy-paste data between them?' WHERE id = 'tpl_digital_1';
UPDATE interview_question_templates SET question_text = 'Describe a decision in the last month that had to wait because the data was not available or not trusted. What happened, and what should have been possible?' WHERE id = 'tpl_digital_2';
UPDATE interview_question_templates SET question_text = 'Which process is fully automated end-to-end today, and which one looks automated but actually depends on someone manually checking or fixing exceptions?' WHERE id = 'tpl_digital_3';
UPDATE interview_question_templates SET question_text = 'What is the one system everyone complains about? What specifically breaks, and what workaround have people built around it?' WHERE id = 'tpl_digital_4';
UPDATE interview_question_templates SET question_text = 'Which parts of your infrastructure are cloud-based today, and what is the concrete plan — or blocker — for migrating what is left?' WHERE id = 'tpl_digital_5';

UPDATE interview_question_templates SET question_text = 'Tell me about the last time your team had to learn a new tool or system. How long did it take to reach full productivity, and what made it hard?' WHERE id = 'tpl_people_1';
UPDATE interview_question_templates SET question_text = 'Think of the last major change initiative here. What actually happened when it launched — did people adopt it, work around it, or quietly ignore it?' WHERE id = 'tpl_people_2';
UPDATE interview_question_templates SET question_text = 'Who owns digital initiatives day to day — a dedicated team, a shared function, or whoever has time? What is the biggest limitation of that setup?' WHERE id = 'tpl_people_3';
UPDATE interview_question_templates SET question_text = 'When someone needs a new skill to do their job better, what actually happens — formal training, on-the-job mentoring, or are they left to figure it out?' WHERE id = 'tpl_people_4';
UPDATE interview_question_templates SET question_text = 'Tell me about the last new tool or process you rolled out. What resistance did you hit, and what specifically won people over — or didn''t?' WHERE id = 'tpl_people_5';

UPDATE interview_question_templates SET question_text = 'What budget is actually committed for this initiative this year, and what would you need to see to unlock more?' WHERE id = 'tpl_finance_1';
UPDATE interview_question_templates SET question_text = 'For your last major digital investment, what return did you expect going in, and what did you actually measure coming out?' WHERE id = 'tpl_finance_2';
UPDATE interview_question_templates SET question_text = 'What financial constraint would kill this initiative if we ignored it — a budget cap, a cash-flow timing issue, a competing priority?' WHERE id = 'tpl_finance_3';
UPDATE interview_question_templates SET question_text = 'What payback period would make this an easy yes for you, and what is the longest you have ever approved — and why?' WHERE id = 'tpl_finance_4';
UPDATE interview_question_templates SET question_text = 'Walk me through how a digital investment actually gets funded here — one central budget, business-unit chargeback, or case-by-case approval? Where does that process slow things down?' WHERE id = 'tpl_finance_5';

-- ==========================================
-- interview_library_template_questions (298 draft: Voice of Employee / Change
-- Readiness) — replace the two bare 1-5 scale questions with open, evidence-
-- anchored diagnostics. Same ids, same template_id, same category/sort_order.
-- ==========================================

UPDATE interview_library_template_questions
SET question_text = 'Walk me through the last time you rolled out a new tool. What digital skills were missing on day one, and how long did it actually take people to become productive with it?',
    answer_type = 'open'
WHERE id = 'itq_cr_digital_2';

UPDATE interview_library_template_questions
SET question_text = 'Think of the last two change initiatives here — one that stuck and one that didn''t. What was different about how people responded, and what does that tell you about readiness for this one?',
    answer_type = 'open'
WHERE id = 'itq_cr_people_1';
