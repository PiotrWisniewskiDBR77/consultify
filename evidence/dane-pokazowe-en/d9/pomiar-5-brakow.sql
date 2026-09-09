-- D9 — pomiar PIĘCIU BRAKÓW z RAPORT_DANE.md §5, organizacja Northwind.
-- Uruchamiać PRZED i PO etapie 09-dosiew-po-tescie.ts na tej samej bazie.
--   docker exec -i consultify-pg18 psql -U postgres -d <baza> -f - < ten-plik
\pset pager off
\set org '468b234c-66c4-54e1-b626-5e0fb3a92f6a'

\echo ''
\echo '=== BRAK 1 — Organizacja: profil (13 pol UI) ==='
SELECT
  (industry_code IS NOT NULL AND industry_code <> '')                    AS ma_industry_code,
  coalesce(jsonb_array_length(strategic_priorities::jsonb), 0)           AS priorytety_strategiczne,
  (mission_statement IS NOT NULL AND mission_statement <> '')            AS ma_misje,
  (digital_maturity_overall IS NOT NULL)                                 AS ma_dojrzalosc,
  coalesce(jsonb_array_length(technology_stack::jsonb), 0)               AS stos_technologiczny,
  coalesce(jsonb_array_length(primary_markets::jsonb), 0)                AS rynki_glowne,
  coalesce(jsonb_array_length(customer_segments::jsonb), 0)              AS segmenty_klientow,
  profile_completeness
FROM organization_profiles WHERE organization_id = :'org';

\echo ''
\echo '=== BRAK 2 — Wywiad: przydzialy Northwind (per status) ==='
SELECT coalesce(status,'(brak)') AS status, count(*) AS n
FROM interview_assignments WHERE organization_id = :'org' GROUP BY 1 ORDER BY 1;
SELECT count(*) AS przydzialy_razem FROM interview_assignments WHERE organization_id = :'org';
SELECT count(*) AS czlonkowie_przydzialow FROM interview_assignment_members m
  JOIN interview_assignments a ON a.id = m.assignment_id WHERE a.organization_id = :'org';
SELECT count(*) AS w_skrzynce_wlasciciela FROM interview_assignments a
 WHERE a.organization_id = :'org'
   AND lower(replace(a.status,'-','_')) <> 'completed'
   AND (a.assignee_user_id = '08c54d75-5260-57b1-9db6-a30aed89a587'
        OR EXISTS (SELECT 1 FROM interview_assignment_members m
                   WHERE m.assignment_id = a.id AND m.user_id = '08c54d75-5260-57b1-9db6-a30aed89a587'));

\echo ''
\echo '=== BRAK 3 — Wyniki: migawki przegladu karty KPI ==='
SELECT coalesce(status,'(brak)') AS status, count(*) AS n
FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id = :'org' GROUP BY 1 ORDER BY 1;
SELECT count(*) AS migawki_razem FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id = :'org';
SELECT count(*) AS pomiary_w_migawkach FROM rvn_kpi_scorecard_review_snapshot_measurements m
  JOIN rvn_kpi_scorecard_review_snapshots s ON s.snapshot_id = m.snapshot_id
 WHERE s.organization_id = :'org';

\echo ''
\echo '=== BRAK 4 — Realizacja: rozklad zadan na 8 tygodni od dzis ==='
SELECT count(*) AS zadan_razem,
       count(*) FILTER (WHERE due_date >= now() AND due_date < now() + interval '8 weeks') AS w_oknie_8_tyg,
       count(estimated_hours) AS z_estymata,
       count(effort_estimate_hours) AS z_pracochlonnoscia,
       round(coalesce(sum(estimated_hours) FILTER (WHERE due_date >= now() AND due_date < now() + interval '8 weeks')::numeric,0),1) AS godziny_w_oknie
FROM tasks WHERE organization_id = :'org';
SELECT count(DISTINCT date_trunc('week', due_date)) AS tygodnie_z_popytem
FROM tasks WHERE organization_id = :'org'
  AND due_date >= date_trunc('week', now()) AND due_date < date_trunc('week', now()) + interval '8 weeks'
  AND estimated_hours IS NOT NULL AND estimated_hours > 0
  AND lower(status) NOT IN ('done','cancelled');
SELECT date_trunc('week', due_date)::date AS tydzien, count(*) AS zadan,
       round(coalesce(sum(estimated_hours)::numeric,0),1) AS godzin
FROM tasks WHERE organization_id = :'org'
  AND due_date >= date_trunc('week', now()) AND due_date < date_trunc('week', now()) + interval '8 weeks'
  AND lower(status) NOT IN ('done','cancelled')
GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== BRAK 5 — Pola pochodne ==='
\echo '--- Materialy: FORMAT/SOURCE (v8_output_artifacts, bez szablonow) ---'
SELECT artifact_family,
       count(*) AS n,
       count(*) FILTER (WHERE template_family_ref IS NOT NULL AND template_family_ref <> '') AS ma_template_family_ref,
       count(*) FILTER (WHERE origin_summary_json IS NOT NULL AND origin_summary_json <> '') AS ma_origin_summary
FROM v8_output_artifacts WHERE organization_id = :'org' GROUP BY 1 ORDER BY 1;
\echo '--- KPI: LEVEL/VARIANCE (progi w wersjach definicji) ---'
SELECT count(*) AS wersje_definicji,
       count(warning_low)  AS ma_warning_low,
       count(warning_high) AS ma_warning_high,
       count(critical_low) AS ma_critical_low,
       count(critical_high) AS ma_critical_high,
       count(target_value) AS ma_target
FROM rvn_kpi_definition_versions WHERE organization_id = :'org';
