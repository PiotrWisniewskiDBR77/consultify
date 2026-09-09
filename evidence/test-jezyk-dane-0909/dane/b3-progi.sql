\pset pager off
\set ORG '''468b234c-66c4-54e1-b626-5e0fb3a92f6a'''
\echo === B3 PROGI ===
select 'Inicjatywy: razem' k, count(*)::text v from initiatives where organization_id=:ORG
union all select 'Inicjatywy: DRAFT', count(*)::text from initiatives where organization_id=:ORG and status='DRAFT'
union all select 'Inicjatywy: APPROVED', count(*)::text from initiatives where organization_id=:ORG and status='APPROVED'
union all select 'Inicjatywy: IN_EXECUTION', count(*)::text from initiatives where organization_id=:ORG and status='IN_EXECUTION'
union all select 'Inicjatywy: on_hold=true', count(*)::text from initiatives where organization_id=:ORG and on_hold
union all select 'Inicjatywy: CLOSED', count(*)::text from initiatives where organization_id=:ORG and status='CLOSED'
union all select 'Realizacja: inicjatywy w realizacji', count(*)::text from initiatives where organization_id=:ORG and status='IN_EXECUTION'
union all select 'Realizacja: zadania', count(*)::text from tasks where organization_id=:ORG
union all select 'Realizacja: RAID', count(*)::text from raid_items where organization_id=:ORG
union all select 'Realizacja: decyzje', count(*)::text from decisions where organization_id=:ORG
union all select 'Realizacja: kamienie milowe', count(*)::text from initiative_milestones where organization_id=:ORG
union all select 'Realizacja: raporty statusu', count(*)::text from status_reports where organization_id=:ORG
union all select 'Moja Praca: zadania wlasciciela', count(*)::text from tasks t join users u on u.id=t.assignee_id where t.organization_id=:ORG and u.email='james.whitfield@northwind.example'
union all select 'Moja Praca: skrzynka', count(*)::text from canonical_inbox_items where organization_id=:ORG
union all select 'Spotkania: razem', count(*)::text from meetings where organization_id=:ORG
union all select 'Spotkania: notatki', count(*)::text from meeting_notes where organization_id=:ORG
union all select 'Wywiad: sesje', count(*)::text from interview_sessions where organization_id=:ORG
union all select 'Wywiad: pytania odpowiedziane', count(*)::text from interview_questions where organization_id=:ORG and status='answered'
union all select 'Wywiad: wnioski', count(*)::text from interview_insights where organization_id=:ORG
union all select 'Ocena: sesje ukonczone', count(*)::text from assessments where organization_id=:ORG and status='APPROVED'
union all select 'Ocena: raporty', count(*)::text from assessment_reports where organization_id=:ORG
union all select 'Narzedzia: sesje', count(*)::text from tool_sessions where organization_id=:ORG
union all select 'Narzedzia: typy', count(distinct tool_type)::text from tool_sessions where organization_id=:ORG
union all select 'Wyniki: definicje KPI', count(*)::text from rvn_kpi_definitions where organization_id=:ORG
union all select 'Wyniki: pomiary KPI', count(*)::text from rvn_kpi_measurements where organization_id=:ORG
union all select 'Wyniki: karty wynikow', count(*)::text from rvn_kpi_scorecards where organization_id=:ORG
union all select 'Wyniki: OKR cele', count(*)::text from okr_vnext_objectives where organization_id=:ORG
union all select 'Finanse: budzety', count(*)::text from budgets where organization_id=:ORG
union all select 'Finanse: pozycje budzetu', count(*)::text from budget_lines bl join budgets b on b.id=bl.budget_id where b.organization_id=:ORG
union all select 'Finanse: sprawy ROI', count(*)::text from rvn_roi_cases where organization_id=:ORG
union all select 'Finanse: sprawozdania', count(*)::text from financial_statements where organization_id=:ORG
union all select 'Materialy: raporty/dokumenty', count(*)::text from report_builder_reports where organization_id=:ORG
union all select 'Materialy: prezentacje', count(*)::text from presentation_decks where organization_id=:ORG
union all select 'Materialy: arkusze', count(*)::text from generated_workbooks where organization_id=:ORG
union all select 'Audyty: programy', count(*)::text from audit_programs where organization_id=:ORG
union all select 'Audyty: ustalenia', count(*)::text from audit_program_findings where organization_id=:ORG
union all select 'Organizacja: profil', count(*)::text from organization_profiles where organization_id=:ORG
union all select 'Organizacja: profile_completeness', coalesce(max(profile_completeness)::text,'brak') from organization_profiles where organization_id=:ORG
union all select 'Organizacja: strategic_priorities', coalesce(max(strategic_priorities::text),'brak') from organization_profiles where organization_id=:ORG
union all select 'Organizacja: czlonkowie ACTIVE', count(*)::text from organization_members where organization_id=:ORG and status='ACTIVE'
union all select 'Admin: uzytkownicy', count(*)::text from users where organization_id=:ORG
union all select 'Czat: rozmowy', count(*)::text from conversations where organization_id=:ORG
union all select 'Czat: wiadomosci', coalesce(sum(message_count)::text,'0') from conversations where organization_id=:ORG;
