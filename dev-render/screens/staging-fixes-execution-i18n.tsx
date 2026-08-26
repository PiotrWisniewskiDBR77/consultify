/**
 * Dev-render: staging-fixes-20260826, Naprawa 1 — REALNY <ExecutionHub>.
 *
 * Weryfikacja wzrokowa (CLAUDE.md #7) naprawy mieszanki PL/EN: brakujące klucze
 * i18n (tasks/decisionsBuckets/actionQueue/executiveHealth/healthSnapshot
 * failedDesc, reportCatalog.noDataDesc) oraz konwersja hardkodowanych
 * angielskich etykiet `label: 'Progress'|'Blocked'|'Tasks'|'Initiatives'|
 * 'Missing dates'|'Due soon'|'Overdue'|'Pending'` w kafelkach highlights
 * katalogu raportów (zakładka "Raporty") na `t(...)`.
 *
 * `seedRealisticSession()` ustawia `isDemoMode: true` w store; ExecutionHub
 * renderuje się bez backendu (błędy sieci -> stany degradowane, które są
 * właśnie częścią tej naprawy — widoczne komunikaty zamiast cichej maski).
 *
 * Otwórz zakładkę "Raporty" (Menu 1) ręcznie po załadowaniu, żeby zobaczyć
 * naprawiony katalog raportów fallback z polskimi etykietami highlights.
 */
import React from 'react';

import { ExecutionHub } from '../../src/components/Execution/ExecutionHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

export default function StagingFixesExecutionI18nScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <ExecutionHub />
      </div>
    </AppProviders>
  );
}
