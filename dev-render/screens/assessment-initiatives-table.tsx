/**
 * Dev-render: TABLICA INICJATYW STRATEGICZNYCH (Ocena) — REALNY
 * `<AssessmentHub initialTab="initiatives">`.
 *
 * ★ NAPRAWA PRZEWODU ODBIORU (2026-09-03). Do 2026-09-02 ten plik montował
 * `src/components/assessment/InitiativesTable.tsx` — komponent, który ma ZERO
 * wołaczy w produkcie: `git grep -w InitiativesTable -- src/` zwraca wyłącznie
 * własną definicję i komentarze w dwóch innych plikach (audyt
 * `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`,
 * wiersz `assessment-initiatives-table` — „ROZJAZD"). `docs/program/grafika/
 * status.json` przyznawał to wprost w polu `gdzie` („To NIE jest ekran
 * dostępny w aplikacji"), a mimo to ekran szedł do odbioru.
 *
 * Realna tabela inicjatyw modułu Ocena to zakładka „Inicjatywy" huba
 * (`/assessment?tab=initiatives`, `AssessmentHub.renderContent` case
 * `'initiatives'`), karmiona `Api.get('/initiatives?source=assessment')` i
 * filtrowana przez `isAssessmentModuleInitiative` (AssessmentHub.tsx:335).
 * `InitiativesManagementPanel` (Ocena → sesja → Manage → Inicjatywy) to inna,
 * per-sesyjna powierzchnia: `?screen=assessment-initiatives-panel`.
 *
 * Martwego `InitiativesTable.tsx` NIE usuwam — decyzja należy do nadzorcy
 * (patrz `evidence/grafika/przewody-odbioru-20260903.md`).
 */
import React from 'react';

import { AssessmentHubScreen, installAssessmentHubHarness } from '../mocks/assessmentHubHarness';

installAssessmentHubHarness('initiatives');

export default function AssessmentInitiativesTableScreen(): React.ReactElement {
  return <AssessmentHubScreen tab="initiatives" />;
}
