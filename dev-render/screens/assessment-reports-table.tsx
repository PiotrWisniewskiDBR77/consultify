/**
 * Dev-render: TABELA RAPORTÓW OCENY — REALNY
 * `<AssessmentHub initialTab="reports">`.
 *
 * ★ NAPRAWA PRZEWODU ODBIORU (2026-09-03). Do 2026-09-02 ten plik montował
 * `src/components/assessment/ReportsTable.tsx` — komponent, który ma ZERO
 * wołaczy w produkcie: `git grep -w ReportsTable -- src/` zwraca wyłącznie
 * własną definicję i komentarze w czterech innych plikach (audyt
 * `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`,
 * wiersz `assessment-reports-table` — „ROZJAZD"). Żaden użytkownik nigdy tej
 * tabeli nie zobaczył.
 *
 * Realna tabela raportów w module Ocena to zakładka „Raporty" huba
 * (`/assessment?tab=reports`, `AssessmentHub.renderContent` case `'reports'`),
 * karmiona `Api.getAssessmentReports()` + `Api.listReportImports()`.
 * `ReportsManagementPanel` (Ocena → sesja → Manage → Raporty) to inna, per-
 * sesyjna powierzchnia i ma własny ekran harnessu:
 * `?screen=assessment-reports-panel`.
 *
 * Martwego `ReportsTable.tsx` NIE usuwam — decyzja o kasowaniu należy do
 * nadzorcy (patrz `evidence/grafika/przewody-odbioru-20260903.md`).
 */
import React from 'react';

import { AssessmentHubScreen, installAssessmentHubHarness } from '../mocks/assessmentHubHarness';

installAssessmentHubHarness('reports');

export default function AssessmentReportsTableScreen(): React.ReactElement {
  return <AssessmentHubScreen tab="reports" />;
}
