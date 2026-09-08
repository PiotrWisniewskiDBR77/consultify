\pset format aligned
\echo === A. INICJATYWY: smieci i braki ===
select 'inicjatywy razem' as rodzaj, count(*) from initiatives where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063'
union all select 'nazwa testowa (test/e2e/sample/demo/acceptance)', count(*) from initiatives where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and (coalesce(title,name) ~* '(test|e2e|sample|acceptance|\[ACCEPTANCE\])' or id ~* '(acceptance|seed:|demo-|manual-)')
union all select 'IN_EXECUTION bez project_id', count(*) from initiatives where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and status='IN_EXECUTION' and coalesce(project_id,'')=''
union all select 'IN_EXECUTION bez dat planu', count(*) from initiatives where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and status='IN_EXECUTION' and start_date is null and end_date is null
union all select 'IN_EXECUTION bez wlasciciela wykonania', count(*) from initiatives where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and status='IN_EXECUTION' and coalesce(owner_execution_id,'')=''
union all select 'IN_EXECUTION bez zadnego zadania', count(*) from initiatives i where i.organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and i.status='IN_EXECUTION' and not exists (select 1 from tasks t where t.initiative_id=i.id)
union all select 'tytul po angielsku (heurystyka)', count(*) from initiatives where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and coalesce(title,name) ~ '^[A-Za-z0-9 ,.&()\-—]+$' and coalesce(title,name) !~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]';
\echo
\echo === B. ZADANIA ===
select 'zadania razem' as rodzaj, count(*) from tasks where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063'
union all select 'bez assignee', count(*) from tasks where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and coalesce(assignee_id,'')=''
union all select 'bez assignee ale z owner_id (UI pokazuje osobe)', count(*) from tasks where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and coalesce(assignee_id,'')='' and coalesce(owner_id,'')<>''
union all select 'bez terminu', count(*) from tasks where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and due_date is null
union all select 'bez inicjatywy', count(*) from tasks where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and coalesce(initiative_id,'')=''
union all select 'otwarte i po terminie', count(*) from tasks where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and due_date < now() and lower(coalesce(status,'')) not in ('done','completed','validated','cancelled')
union all select 'opis po angielsku (heurystyka)', count(*) from tasks where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and coalesce(description,'') <> '' and description !~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'tytul po angielsku (heurystyka)', count(*) from tasks where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and coalesce(title,'') <> '' and title !~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'nazwa testowa', count(*) from tasks where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and title ~* '(test|e2e|sample|probe|smoke)';
\echo
\echo === C. UZYTKOWNICY ===
select 'uzytkownicy org' as rodzaj, count(*) from users where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063'
union all select 'bez job_title', count(*) from users where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and coalesce(job_title,'')=''
union all select 'job_title = rola systemowa/platformowa', count(*) from users where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and job_title ~* '(superadmin|admin|platform|owner|system)'
union all select 'bez weekly_capacity_hours (podaz domyslna 40h)', count(*) from users where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and weekly_capacity_hours is null
union all select 'konto testowe (email .local/test/e2e)', count(*) from users where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and email ~* '(\.local|test|e2e|example\.)';
\echo
\echo === D. AGREGATY RUNTIME (realizacje) ===
select 'execution_case razem' as rodzaj, count(*) from ie_aggregate_state where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and aggregate_type='execution_case'
union all select 'execution_case seedowy demo-story/acceptance/aco', count(*) from ie_aggregate_state where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and aggregate_type='execution_case' and (aggregate_id like 'demo-story-%' or aggregate_id like '%acceptance%' or aggregate_id like 'aco-%')
union all select 'initiative-agregat bez projectId (niewidoczny fail-closed)', count(*) from ie_aggregate_state where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and aggregate_type='initiative' and not (payload_json::jsonb ? 'projectId')
union all select 'initiative-agregat z initiativeId = wlasne id (samowskazanie)', count(*) from ie_aggregate_state where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and aggregate_type='initiative' and payload_json::jsonb->>'initiativeId' = aggregate_id;
\echo
\echo === E. RAID / DECYZJE ===
select 'raid razem' as rodzaj, count(*) from raid_items where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063'
union all select 'raid bez terminu', count(*) from raid_items where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and due_date is null
union all select 'raid bez inicjatywy', count(*) from raid_items where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and coalesce(initiative_id,'')=''
union all select 'raid tytul po angielsku', count(*) from raid_items where organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' and coalesce(title,'')<>'' and title !~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]';
