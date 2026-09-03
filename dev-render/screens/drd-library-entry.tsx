/**
 * Dev-render: BIBLIOTEKA METODYK (wejście do DRD) — REALNY
 * `<AssessmentHub initialTab="library">` → `AssessmentLibraryTab`
 * (`src/components/assessment/library/AssessmentLibraryTab.tsx`).
 *
 * ★ NAPRAWA PRZEWODU ODBIORU (2026-09-03). Do 2026-09-02 ten plik był
 * REPLIKĄ: sam sklejał `StandardModuleBar` + `StandardTable` +
 * `StandardPreview` z jednym wymyślonym wierszem DRD i nie importował
 * żadnego Huba (audyt
 * `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`,
 * wiersz `drd-library-entry` — „REPLIKA"). Uwaga właściciela z 2026-09-02
 * („nie ma żadnego podglądu; kolumny nie są wystarczające… do powtórki")
 * dotyczyła więc przyrządu. Realna Biblioteka ma własny `StandardTable`
 * + `StandardPreview` i katalog pięciu metodyk (DRD włączone, SIRI/ADMA/
 * CMMI/LEAN jako jawnie wyłączone wiersze z powodem — TRIADA_KANON C3).
 *
 * Trasa produktu: `/assessment?tab=library` (`src/routes/AppRoutes.tsx:2301`).
 * Katalog Biblioteki jest statyczny w komponencie — nie wymaga mocków; mocki
 * z `assessmentHubHarness` obsługują pozostałe wywołania huba (lista sesji,
 * raporty, inicjatywy), żeby zakładka nie renderowała się na banerze błędu.
 */
import React from 'react';

import { AssessmentHubScreen, installAssessmentHubHarness } from '../mocks/assessmentHubHarness';

installAssessmentHubHarness('library');

export function DrdLibraryEntryScreen(): React.ReactElement {
  return <AssessmentHubScreen tab="library" />;
}

export default DrdLibraryEntryScreen;
