\pset pager off
\set ORG '''468b234c-66c4-54e1-b626-5e0fb3a92f6a'''
\echo === INITIATIVES on_hold/archived flags
select status, on_hold, archived, (archived_at is not null) arch_at, (cancelled_at is not null) canc from initiatives where organization_id=:ORG order by status;
\echo === TRANSFORMATION_CASES cols
select string_agg(column_name,', ' order by ordinal_position) from information_schema.columns where table_name='transformation_cases';
\echo === TOOL_SESSIONS cols
select string_agg(column_name,', ' order by ordinal_position) from information_schema.columns where table_name='tool_sessions';
\echo === KPIDEF cols
select string_agg(column_name,', ' order by ordinal_position) from information_schema.columns where table_name='rvn_kpi_definitions';
\echo === ROI cols
select string_agg(column_name,', ' order by ordinal_position) from information_schema.columns where table_name='rvn_roi_cases';
\echo === AUDITPROG cols
select string_agg(column_name,', ' order by ordinal_position) from information_schema.columns where table_name='audit_programs';
