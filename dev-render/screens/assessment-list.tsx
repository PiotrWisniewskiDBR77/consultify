/**
 * Dev-render: LISTA OCEN — REALNY `<AssessmentHub initialTab="processes">`.
 *
 * ★ NAPRAWA PRZEWODU ODBIORU (2026-09-03). Do 2026-09-02 ten plik był
 * REPLIKĄ: sam sklejał `StandardModuleBar` + `StandardTable` z lokalnymi
 * wierszami i lokalnymi handlerami, nie importując `AssessmentHub` w ogóle
 * (audyt: `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`,
 * wiersz `assessment-list` — „REPLIKA"). Właściciel zatwierdził więc obraz
 * przyrządu, nie produktu. Teraz montowany jest realny komponent, ten sam,
 * który dostaje użytkownik pod `/assessment?tab=processes`
 * (`src/routes/AppRoutes.tsx:2301` `<Route index element={<AssessmentHub />} />`).
 *
 * Dane demo idą przez mocki `Api`/`fetch` w
 * `dev-render/mocks/assessmentHubHarness.tsx` — harness nie przełącza żadnej
 * gałęzi kodu produktu (brak wzorca `isShowcase*`), tylko podstawia odpowiedzi
 * sieciowe.
 */
import React from 'react';

import { AssessmentHubScreen, installAssessmentHubHarness } from '../mocks/assessmentHubHarness';

installAssessmentHubHarness('processes');

export function AssessmentListScreen(): React.ReactElement {
  return <AssessmentHubScreen tab="processes" />;
}

export default AssessmentListScreen;
