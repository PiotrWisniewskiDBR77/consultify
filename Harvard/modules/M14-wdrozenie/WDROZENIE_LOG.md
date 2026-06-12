# M14 — Wdrożenie — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala 2 [INTEGRACJA] | #6 — eksport sygnałów ROI do M15 + deep-link Execution→Results | _ten commit_ | Nowy `executionResultsBridge.ts`: `budget_health` sygnał do `v8_kpi_signals` (KPI z `initiative_id`, dedup pending, AMBER=medium/RED=critical) wpięty w `createBudgetEntry`(ACTUAL)+`deleteBudgetEntry` (fire-and-forget); `budget_health` dodany do `KpiSignalTypeValues`; FE: `BudgetControlPanel` widok inicjatywy → przycisk „Zobacz w Rezultatach" → `/benefits?initiativeId=` (ResultsHub czyta param, `ResultsHub.tsx:146`); i18n PL/EN; testy 6/6 PASS (`executionResultsBridge.test.ts`), resultsROI 99/99, tsc zielony. Żywy dowód (zmiana budżetu → sygnał w M15 UI) = FAZA C | ZROBIONE (kod) / żywa weryfikacja PENDING |
