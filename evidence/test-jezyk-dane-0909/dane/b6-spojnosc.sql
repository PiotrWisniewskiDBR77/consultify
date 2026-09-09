\pset pager off
\set ORG '''468b234c-66c4-54e1-b626-5e0fb3a92f6a'''
\echo === B6.1 INICJATYWY: nazwa, wlasciciel biznesowy/wykonawczy, sponsor
select i.title, i.status,
  coalesce(ob.first_name||' '||ob.last_name,'(BRAK)') as wlasciciel_biz,
  coalesce(oe.first_name||' '||oe.last_name,'(BRAK)') as wlasciciel_exe,
  coalesce(sp.first_name||' '||sp.last_name,'(BRAK)') as sponsor
from initiatives i
left join users ob on ob.id=i.owner_business_id
left join users oe on oe.id=i.owner_execution_id
left join users sp on sp.id=i.sponsor_id
where i.organization_id=:ORG order by i.title;
\echo === B6.2 POLSKIE WTRETY w tekstach rekordow (ogonki)
select 'initiatives' t, count(*) from initiatives where organization_id=:ORG and (title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' or coalesce(summary,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' or coalesce(description,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
union all select 'tasks', count(*) from tasks where organization_id=:ORG and (title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' or coalesce(description,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
union all select 'raid_items', count(*) from raid_items where organization_id=:ORG and title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'decisions', count(*) from decisions where organization_id=:ORG and title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'meetings', count(*) from meetings where organization_id=:ORG and title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'conversations', count(*) from conversations where organization_id=:ORG and coalesce(title,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'presentation_decks', count(*) from presentation_decks where organization_id=:ORG and coalesce(title,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'tool_sessions', count(*) from tool_sessions where organization_id=:ORG and coalesce(name,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'interview_questions', count(*) from interview_questions where organization_id=:ORG and coalesce(text,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]';
\echo === B6.3 ZADANIA bez wykonawcy / bez opisu
select count(*) filter (where assignee_id is null) bez_wykonawcy,
       count(*) filter (where coalesce(description,'')='') bez_opisu,
       count(*) filter (where due_date is null) bez_terminu, count(*) razem
from tasks where organization_id=:ORG;
\echo === B6.4 INICJATYWY: puste pola opisowe
select count(*) filter (where coalesce(summary,'')='') bez_summary,
       count(*) filter (where coalesce(problem_statement,'')='') bez_problem,
       count(*) filter (where coalesce(description,'')='') bez_desc,
       count(*) filter (where owner_business_id is null) bez_wlasciciela,
       count(*) filter (where start_date is null) bez_startu,
       count(*) filter (where estimated_budget is null) bez_budzetu, count(*) razem
from initiatives where organization_id=:ORG;
\echo === B6.5 RAID/DECYZJE bez wlasciciela
select 'raid' t, count(*) filter (where owner_id is null) bez_wl, count(*) razem from raid_items where organization_id=:ORG;
\echo === B6.6 OCENA: obszary/osie (jezyk mieszany, dlug K6)
select left(name,60), assessment_type, framework, framework_type from assessments where organization_id=:ORG;
\echo === B6.7 PYTANIA WYWIADU - jezyk
select left(text,90) from interview_questions where organization_id=:ORG limit 8;
\echo === B6.8 KPI nazwy
select v.* from rvn_kpi_definition_versions v join rvn_kpi_definitions d on d.kpi_id=v.kpi_id where d.organization_id=:ORG limit 3;
