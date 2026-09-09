\pset pager off
\set ORG '''468b234c-66c4-54e1-b626-5e0fb3a92f6a'''
\echo === TRANSFORMATION_CASES
select transformation_case_id, status, lifecycle_stage, left(mandate,60) from transformation_cases where organization_id=:ORG;
\echo === TOOL_SESSIONS
select id, tool_type, name, status, completion_percent from tool_sessions where organization_id=:ORG;
\echo === KPI defs + latest version name
select d.kpi_code, d.status, v.name, v.unit, v.target_value from rvn_kpi_definitions d left join rvn_kpi_definition_versions v on v.kpi_definition_version_id=d.current_definition_version_id where d.organization_id=:ORG;
\echo === ROI cases
select case_id, title, status, currency from rvn_roi_cases where organization_id=:ORG;
\echo === AUDIT programs
select id, name, status, lifecycle_state from audit_programs where organization_id=:ORG;
\echo === REPORT BUILDER
select id, name, status from report_builder_reports where organization_id=:ORG;
\echo === GENERATED WORKBOOKS
select id, organization_id from generated_workbooks where organization_id=:ORG;
\echo === INBOX user
select u.email, count(*) from canonical_inbox_items c join users u on u.id::text=c.user_id::text where c.organization_id=:ORG group by 1;
\echo === MEETING NOTES
select id, meeting_id, left(content,80) from meeting_notes where organization_id=:ORG;
\echo === V8 OUTPUT ARTIFACTS types
select artifact_type, count(*) from v8_output_artifacts where organization_id=:ORG group by 1 order by 2 desc;
\echo === PROJECTS
select id, name, status from projects where organization_id=:ORG;
