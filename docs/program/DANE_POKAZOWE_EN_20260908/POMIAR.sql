-- POMIAR bazy — 2026-09-08
-- Uruchamiane WYŁĄCZNIE na kopii:
--   docker exec -i consultify-pg18 psql -U postgres -d consultify_staging_kopia < POMIAR.sql
-- NIGDY na stagingu (thomas), demo (trolley) ani produkcji (centerbeam).
-- Wszystkie zapytania są SELECT. Żadnego DDL/DML.

-- ============================================================ Q1
-- Liczba tabel w schemacie public.  Wynik: 1808
select count(*) as tabel
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- ============================================================ Q2
-- Dokładna liczba wierszy w KAŻDEJ tabeli (nie estymata z pg_class).
-- query_to_xml wykonuje count(*) per tabela bez potrzeby ANALYZE.
-- Wynik zapisany do pomiar-wiersze-per-tabela.txt (1808 wierszy).
-- Agregaty: 546 tabel niepustych, 1262 puste, suma 164 403 wiersze.
select table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from public.%I', table_name),
                           false, true, '')))[1]::text::bigint as n
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by n desc, table_name;

-- ============================================================ Q3
-- Ile tabel niesie kolumnę organizacji.  Wynik: 1283
select count(distinct c.relname) as tabel_z_organization_id
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
join pg_attribute a on a.attrelid = c.oid
                   and a.attname in ('organization_id','org_id','tenant_id')
where c.relkind = 'r';

-- ============================================================ Q4
-- Podział wszystkich wierszy w tabelach z organization_id na trzy grupy:
-- 6 organizacji realnych / demo-org / reszta (325 organizacji testowych).
-- Wynik: 123 497 = 52 841 + 14 352 + 56 304 ; 378 tabel niepustych.
with tab as (
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id'
  where c.relkind = 'r'
), m as (
  select relname,
    (xpath('/row/c/text()', query_to_xml(
      format('select count(*) c from public.%I', relname), false, true, '')))[1]::text::bigint as total,
    (xpath('/row/c/text()', query_to_xml(
      format($f$select count(*) c from public.%I
              where organization_id::text in
                ('a3e05d4a-5397-419d-b486-8e44366c0063','atelier','nordwind','vts','system','dbr77')$f$,
             relname), false, true, '')))[1]::text::bigint as w_6_org,
    (xpath('/row/c/text()', query_to_xml(
      format($f$select count(*) c from public.%I where organization_id::text = 'demo-org'$f$,
             relname), false, true, '')))[1]::text::bigint as w_demo_org
  from tab
)
select sum(total)                                as wiersze_w_tabelach_z_org,
       sum(w_6_org)                              as nalezy_do_6_realnych,
       sum(w_demo_org)                           as nalezy_do_demo_org,
       sum(total) - sum(w_6_org) - sum(w_demo_org) as reszta_smieci,
       count(*) filter (where total > 0)         as tabel_niepustych
from m;

-- ============================================================ Q5
-- Klasyfikacja 331 organizacji.  Wynik: e2e=286, testowe=32, mycompany=4.
select count(*) filter (where name ~ '(?i)e2e')                                    as e2e,
       count(*) filter (where name ~ '(?i)(test|qa|retest|auto|fix|sandbox|trial|persist|audit corp|antigravity|uniquecorp|deepgate|jetski)') as testowe,
       count(*) filter (where name = 'My Company')                                 as mycompany,
       count(*) filter (where name is null or name = '')                           as bez_nazwy,
       count(*)                                                                    as total
from organizations;

-- Lista organizacji, które NIE wpadają w żaden wzorzec śmieciowy (11 wierszy).
select id, name, created_at from organizations
where name !~ '(?i)(e2e|test|qa|retest|auto co|autofix|fix |sandbox|trial|persist|antigravity|uniquecorp|deepgate|jetski|my company|corp|audit firm)'
order by name;

-- ============================================================ Q6
-- Użytkownicy i członkostwa; kontrola sierot.
select 'users total' as k, count(*) as v from users
union all select 'organization_members total', count(*) from organization_members
union all select 'org_members sierot (org nie istnieje)', count(*)
  from organization_members m where not exists (select 1 from organizations o where o.id = m.organization_id)
union all select 'users bez zadnego czlonkostwa', count(*)
  from users u where not exists (select 1 from organization_members m where m.user_id = u.id);

-- ============================================================ Q7 / Q8
-- Ile wierszy w każdej tabeli należy do organizacji do skasowania.
-- Lista „keep" = 6 realnych + demo-org (demo-org kasowany osobno, patrz PLAN).
with tab as (
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id'
  where c.relkind = 'r'
)
select relname,
  (xpath('/row/c/text()', query_to_xml(format(
    $f$select count(*) c from public.%I
       where organization_id is not null
         and organization_id::text not in
           ('a3e05d4a-5397-419d-b486-8e44366c0063','atelier','nordwind','vts','system','dbr77','demo-org')$f$,
    relname), false, true, '')))[1]::text::bigint as do_kasacji
from tab order by 2 desc nulls last limit 40;

-- ============================================================ Q9
-- Zawartość demo-org (worek po rejestracjach testowych).
select 'my_ideas' as t, count(*) from my_ideas where organization_id = 'demo-org'
union all select 'organization_members', count(*) from organization_members where organization_id = 'demo-org'
union all select 'conversations', count(*) from conversations where organization_id = 'demo-org'
union all select 'tasks', count(*) from tasks where organization_id = 'demo-org'
union all select 'decisions', count(*) from decisions where organization_id = 'demo-org';

-- ============================================================ Q10
-- Gotowość danych per moduł dla 4 organizacji realnych.
-- UWAGA: tabele `tools` i `partner_organizations` NIE mają organization_id
--        (sprawdzone) — dlatego nie ma ich w tym zestawieniu.
select k,
  coalesce(sum(case when org = 'a3e05d4a-5397-419d-b486-8e44366c0063' then n end), 0) as dbr77,
  coalesce(sum(case when org = 'atelier'  then n end), 0) as atelier,
  coalesce(sum(case when org = 'nordwind' then n end), 0) as nordwind,
  coalesce(sum(case when org = 'vts'      then n end), 0) as vts
from (
  select organization_id org, '01 conversations' k, count(*) n from conversations group by 1
  union all select organization_id, '02 tasks',                 count(*) from tasks group by 1
  union all select organization_id, '02 my_ideas',              count(*) from my_ideas group by 1
  union all select organization_id, '03 interview_sessions',    count(*) from interview_sessions group by 1
  union all select organization_id, '03 interview_questions',   count(*) from interview_questions group by 1
  union all select organization_id, '04 tool_sessions',         count(*) from tool_sessions group by 1
  union all select organization_id, '05 assessments',           count(*) from assessments group by 1
  union all select organization_id, '05 assessment_reports',    count(*) from assessment_reports group by 1
  union all select organization_id, '06 initiatives',           count(*) from initiatives group by 1
  union all select organization_id, '06 ie_aggregate_state',    count(*) from ie_aggregate_state group by 1
  union all select organization_id, '07 projects',              count(*) from projects group by 1
  union all select organization_id, '07 decisions',             count(*) from decisions group by 1
  union all select organization_id, '07 raid_items',            count(*) from raid_items group by 1
  union all select organization_id, '07 initiative_milestones', count(*) from initiative_milestones group by 1
  union all select organization_id, '07 status_reports',        count(*) from status_reports group by 1
  union all select organization_id, '08 rvn_kpi_definitions',   count(*) from rvn_kpi_definitions group by 1
  union all select organization_id, '08 rvn_kpi_measurements',  count(*) from rvn_kpi_measurements group by 1
  union all select organization_id, '08 okr_vnext_objectives',  count(*) from okr_vnext_objectives group by 1
  union all select organization_id, '09 financial_statements',  count(*) from financial_statements group by 1
  union all select organization_id, '09 budgets',               count(*) from budgets group by 1
  union all select organization_id, '10 knowledge_docs',        count(*) from knowledge_docs group by 1
  union all select organization_id, '10 presentation_decks',    count(*) from presentation_decks group by 1
  union all select organization_id, '10 generated_workbooks',   count(*) from generated_workbooks group by 1
  union all select organization_id, '11 audits',                count(*) from audits group by 1
  union all select organization_id, '12 meetings',              count(*) from meetings group by 1
  union all select organization_id, '13 organization_members',  count(*) from organization_members group by 1
  union all select organization_id, '13 teams',                 count(*) from teams group by 1
) t
where org in ('a3e05d4a-5397-419d-b486-8e44366c0063','atelier','nordwind','vts')
group by k order by k;

-- ============================================================ Q11
-- Defekty formatu danych.
select 'initiatives status spoza DEC-424' as k, count(*) as v from initiatives
  where status not in ('PROPOSED','DRAFT','PENDING_APPROVAL','APPROVED','IN_EXECUTION','CLOSED','REJECTED')
union all select 'initiatives z flaga on_hold', count(*) from initiatives where coalesce(on_hold, false) = true
union all select 'initiatives bez opisu',       count(*) from initiatives where description is null or description = ''
union all select 'initiatives IN_EXECUTION bez project_id', count(*) from initiatives
  where status = 'IN_EXECUTION' and project_id is null
union all select 'tasks bez initiative_id',     count(*) from tasks where initiative_id is null
union all select 'tasks bez assignee',          count(*) from tasks where assignee_id is null
union all select 'users.role = stanowisko',     count(*) from users
  where role not in ('ADMIN','USER','MANAGER','OWNER','MEMBER','SUPERADMIN','CONSULTANT')
union all select 'users bez job_title',         count(*) from users where job_title is null or job_title = ''
union all select 'initiative_stakeholders (RACI)', count(*) from initiative_stakeholders
union all select 'ie_aggregate_state',          count(*) from ie_aggregate_state
union all select 'ie_aggregate_relations',      count(*) from ie_aggregate_relations;

-- ============================================================ Q12
-- Rozkład statusów inicjatyw (cała baza).
select status, count(*) from initiatives group by 1 order by 2 desc;
-- Kontrola: role w tabeli users — pokazuje 4 wartości będące STANOWISKAMI.
select role, count(*) from users group by 1 order by 2 desc;

-- ============================================================ Q13
-- Język danych — dolna granica polskości (heurystyka: znaki diakrytyczne).
-- OGRANICZENIE: „Wdrozenie RPA" przejdzie jako angielskie. To jest dolna granica.
select 'initiatives PL' as k, count(*) as v from initiatives where title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'initiatives total',  count(*) from initiatives
union all select 'tasks PL',           count(*) from tasks where title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'tasks total',        count(*) from tasks
union all select 'decisions PL',       count(*) from decisions where title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'decisions total',    count(*) from decisions
union all select 'conversations PL',   count(*) from conversations where title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'conversations total',count(*) from conversations
union all select 'meetings PL',        count(*) from meetings where title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'meetings total',     count(*) from meetings
union all select 'raid PL',            count(*) from raid_items where title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
union all select 'raid total',         count(*) from raid_items;

-- Język i kompletność per organizacja (inicjatywy).
select organization_id, count(*) n,
       count(*) filter (where title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')     as pl,
       count(*) filter (where description is null or description = '') as bez_opisu,
       count(*) filter (where id ~ '(?i)(demo|seed|test|acceptance)')  as syntetyczne
from initiatives group by 1 order by 2 desc limit 8;

-- ============================================================ Q14
-- Atelier Toys — próbka inicjatyw (angielskie tytuły, pełny rozkład DEC-424).
select organization_id, id, left(title, 60) as title, status
from initiatives where organization_id in ('atelier','nordwind') order by 1 limit 30;

-- Skład osobowy Atelier (19 realnych + 3 śmieci).
select u.email, u.first_name || ' ' || coalesce(u.last_name, '') as nazwisko,
       u.role, coalesce(u.job_title, '-') as stanowisko, m.role as czlonkostwo
from users u join organization_members m on m.user_id = u.id
where m.organization_id = 'atelier' order by u.email;

-- ============================================================ Q15
-- Skład osobowy DBR77 (16 kont — konta testowe, SUPERADMIN, duplikat osoby,
-- job_title z potrójnie zakodowaną encją HTML).
select u.email, u.first_name || ' ' || coalesce(u.last_name, '') as nazwisko,
       u.role, coalesce(u.job_title, '-') as stanowisko, m.role as czlonkostwo
from users u join organization_members m on m.user_id = u.id
where m.organization_id = 'a3e05d4a-5397-419d-b486-8e44366c0063' order by u.email;

-- ============================================================ Q16 (pomocnicze)
-- Które z tabel planowanego seedu NIE mają organization_id — pułapka przy pisaniu
-- skryptu czyszczącego i --verify.  Wynik: tools, partner_organizations.
select t.tab from (values
  ('conversations'),('tasks'),('my_ideas'),('interview_sessions'),('interview_questions'),
  ('tool_sessions'),('tools'),('assessments'),('assessment_reports'),('initiatives'),
  ('ie_aggregate_state'),('projects'),('decisions'),('raid_items'),('initiative_milestones'),
  ('status_reports'),('rvn_kpi_definitions'),('rvn_kpi_measurements'),('okr_vnext_objectives'),
  ('financial_statements'),('budgets'),('knowledge_docs'),('presentation_decks'),
  ('generated_workbooks'),('audits'),('meetings'),('teams'),('organization_members'),
  ('partner_organizations')
) t(tab)
where not exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = t.tab and c.column_name = 'organization_id');

-- Kolumny NOT NULL bez wartości domyślnej w tabelach seedu (obowiązkowe w INSERT).
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('initiatives','tasks','projects','decisions','raid_items',
                     'initiative_milestones','organization_members','organizations','meetings')
  and is_nullable = 'NO' and column_default is null
order by 1, 2;

-- ============================================================ Q17 (pomocnicze)
-- Pułapka nazewnicza: organizacje mają DWIE kolumny "typu".
--   organization_type: TRIAL=255, PAID=73, DEMO=3  (to czyta AccessTypes.ts)
--   plan:              enterprise=278, trial=43, free=8, demo=2 (małymi literami)
select organization_type, count(*) from organizations group by 1 order by 2 desc;
select plan, count(*) from organizations group by 1 order by 2 desc;

-- Kontrola przed decyzją o usunięciu Nordwind i VTS.
select 'nordwind czlonkowie' as k, count(*) as v from organization_members where organization_id = 'nordwind'
union all select 'nordwind users.organization_id', count(*) from users where organization_id = 'nordwind'
union all select 'vts czlonkowie', count(*) from organization_members where organization_id = 'vts'
union all select 'initiatives PROPOSED', count(*) from initiatives where status = 'PROPOSED';

-- ============================================================ Q18 (pomocnicze)
-- Tabele, które ekran czyta ZAMIAST tabeli źródłowej (projekcje).
-- Pokazuje, dlaczego Atelier ma puste Wyniki / My Work / Assessment mimo danych.
select k,
  coalesce(sum(case when org like 'a3e05d4a%' then n end), 0) as dbr77,
  coalesce(sum(case when org = 'atelier' then n end), 0)      as atelier,
  sum(n)                                                      as razem_w_bazie
from (
  select organization_id org, 'canonical_inbox_items' k, count(*) n from canonical_inbox_items group by 1
  union all select organization_id, 'rvn_platform_resource_visibility', count(*) from rvn_platform_resource_visibility group by 1
  union all select organization_id, 'v8_output_artifacts',              count(*) from v8_output_artifacts group by 1
  union all select organization_id, 'organization_context_store',       count(*) from organization_context_store group by 1
  union all select organization_id, 'audit_packs',                      count(*) from audit_packs group by 1
  union all select organization_id, 'audit_programs',                   count(*) from audit_programs group by 1
  union all select organization_id, 'method_sessions',                  count(*) from method_sessions group by 1
  union all select organization_id, 'method_outputs',                   count(*) from method_outputs group by 1
  union all select organization_id, 'financial_statement_packs',        count(*) from financial_statement_packs group by 1
  union all select organization_id, 'chat_projects',                    count(*) from chat_projects group by 1
  union all select organization_id, 'interview_library_templates',      count(*) from interview_library_templates group by 1
) t group by k order by k;

-- Tabele globalne (bez organization_id) — NIE seedować per organizacja.
select 'tools (katalog globalny)' as k, count(*) as v from tools
union all select 'team_members',    count(*) from team_members
union all select 'project_members', count(*) from project_members
union all select 'partner_users',   count(*) from partner_users
union all select 'om ACTIVE atelier', count(*) from organization_members
  where organization_id = 'atelier' and status = 'ACTIVE'
union all select 'om ACTIVE dbr77',   count(*) from organization_members
  where organization_id = 'a3e05d4a-5397-419d-b486-8e44366c0063' and status = 'ACTIVE';

-- ============================================================ Q19
-- Pułapka `audit_findings`: tabela ma wiersze i NIE MA czytelnika.
-- auditInitiativeService.ts:12-13 — „Findings are stored INLINE as a JSON array
-- in `audits.findings` (there is no separate audit_findings table)".
-- Żywa tabela nowej ścieżki: audit_program_findings (aiProposalService.ts:1134).
select 'audit_findings (MARTWA)'       as k, count(*) as v from audit_findings
union all select 'audit_program_findings (ZYWA)', count(*) from audit_program_findings
union all select 'audits.findings niepuste',      count(*) from audits
  where findings is not null and findings not in ('', '[]');
-- Wynik 08.09: 3 / 0 / 2.  Seed modułu Audits ma pisać do audit_program_findings.
