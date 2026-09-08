/**
 * JEDNO ŹRÓDŁO zapytań budujących wiadro DANE (wartości pochodzące z bazy, nie
 * z interfejsu). Czytają je OBA skrypty paczki J-małe: `zrzuty-jmale.mjs`
 * (pomiar) i `skoryguj-przed.mjs` (przeliczenie fazy PRZED tym samym
 * przyrządem). Gdy lista żyła w jednym z nich, korekta PRZED liczyła innym
 * zestawem niż pomiar PO — czyli porównywała dwa różne przyrządy.
 */
export const ZAPYTANIA_DANE = [

  'select name from organizations',
  'select title from initiatives',
  'select name from initiatives',
  'select description from initiatives',
  'select problem_statement from initiatives',
  'select target_state from initiatives',
  'select success_criteria from initiatives',
  'select summary from initiatives',
  'select hypothesis from initiatives',
  'select business_value from initiatives',
  'select title from tasks',
  'select description from tasks',
  'select title from decisions',
  "select coalesce(display_name, first_name || ' ' || last_name) from users",
  'select first_name from users',
  'select last_name from users',

  'select title from meetings',
  'select name from meetings',
  'select name from audit_programs',
  'select title from audit_programs',
  'select title from interviews',
  'select name from interview_sessions',
  'select name from kpi_definitions',
  'select name from kpi_scorecards',
  'select name from rvn_kpi_scorecards',
  'select name from rvn_kpi_definitions',
  'select name from rvn_kpi_scorecard_items',
  'select name from rvn_roi_cases',
  'select title from rvn_roi_cases',
  'select name from kpi_scorecard_items',
  'select name from kpis',
  'select title from kpis',
  'select name from okr_vnext_sets',
  'select title from okr_vnext_sets',
  'select title from okr_vnext_objectives',
  'select name from okr_vnext_objectives',
  'select title from okr_vnext_key_results',
  'select name from okr_vnext_key_results',
  'select title from okr_objectives',
  'select name from okr_objectives',
  'select title from okr_key_results',
  'select name from roi_cases',
  'select title from roi_cases',
  'select name from management_reports',
  'select title from management_reports',
  // Rejestr inicjatyw jest ZDARZENIOWY: tytuły, opisy problemu i stanu
  // docelowego widoczne w module siedzą w payloadzie agregatu, nie w kolumnach
  // tabeli `initiatives` (ta ma inne, angielskie rekordy). Ten sam zapis co
  // w scripts/dev/jezyk-j7/zrzuty-j7.mjs.
  "select distinct trim(both '\"' from v) from (select jsonb_path_query(payload_json::jsonb, 'strict $.**.title')::text v from ie_aggregate_state union all select jsonb_path_query(payload_json::jsonb, 'strict $.**.name')::text from ie_aggregate_state union all select jsonb_path_query(payload_json::jsonb, 'strict $.**.description')::text from ie_aggregate_state union all select jsonb_path_query(payload_json::jsonb, 'strict $.**.problem')::text from ie_aggregate_state union all select jsonb_path_query(payload_json::jsonb, 'strict $.**.outcome')::text from ie_aggregate_state union all select jsonb_path_query(payload_json::jsonb, 'strict $.**.goal')::text from ie_aggregate_state union all select jsonb_path_query(payload_json::jsonb, 'strict $.**.proposedOutcome')::text from ie_aggregate_state union all select jsonb_path_query(payload_json::jsonb, 'strict $.**.successCriteria')::text from ie_aggregate_state) s"
];
