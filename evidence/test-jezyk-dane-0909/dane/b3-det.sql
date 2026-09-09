\pset pager off
\set ORG '''468b234c-66c4-54e1-b626-5e0fb3a92f6a'''
\echo === INITIATIVES status
select status, count(*) from initiatives where organization_id=:ORG group by 1 order by 2 desc;
\echo === INITIATIVES stage/current_stage
select current_stage, stage, count(*) from initiatives where organization_id=:ORG group by 1,2 order by 3 desc;
\echo === TRANSFORMATION_CASES
select id, title, status from transformation_cases where organization_id=:ORG;
\echo === TASKS status
select status, count(*) from tasks where organization_id=:ORG group by 1 order by 2 desc;
\echo === TASKS per assignee
select u.email, count(*) from tasks t left join users u on u.id=t.assignee_id where t.organization_id=:ORG group by 1 order by 2 desc;
\echo === INBOX per user
select user_id, count(*) from canonical_inbox_items where organization_id=:ORG group by 1;
\echo === MEETINGS
select id, title, status, start_at from meetings where organization_id=:ORG;
\echo === INTERVIEW SESSIONS
select id, status, created_at from interview_sessions where organization_id=:ORG;
\echo === INTERVIEW ANSWERS count per session
select session_id, count(*) from interview_answers group by 1;
\echo === ASSESSMENTS
select id, name, status, completion_percent, overall_score from assessments where organization_id=:ORG;
\echo === TOOL_SESSIONS
select id, tool_type, title, status from tool_sessions where organization_id=:ORG;
\echo === KPI
select id, name, current_value, target_value, unit from rvn_kpi_definitions where organization_id=:ORG;
\echo === BUDGETS
select id, title, status, planned_amount, actual_amount, currency from budgets where organization_id=:ORG;
\echo === ROI
select id, title, status from rvn_roi_cases where organization_id=:ORG;
\echo === PRESENTATION DECKS
select id, title, status from presentation_decks where organization_id=:ORG;
\echo === AUDITS
select id, title, status from audit_programs where organization_id=:ORG;
\echo === ORG PROFILE
select * from organization_profiles where organization_id=:ORG;
\echo === CONVERSATIONS
select id, title, message_count, language from conversations where organization_id=:ORG;
\echo === RAID
select id, type, title, status from raid_items where organization_id=:ORG;
\echo === DECISIONS
select id, title, status from decisions where organization_id=:ORG;
\echo === MILESTONES
select count(*) from initiative_milestones where organization_id=:ORG;
\echo === STATUS REPORTS
select id, title, status from status_reports where organization_id=:ORG;
