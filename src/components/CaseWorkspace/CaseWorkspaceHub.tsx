/**
 * Zlecenia (Case Workspace) — punkt wejścia modułu.
 *
 * Czysta powierzchnia modułu: BEZ chrome'u aplikacji. Chrome (sidebar,
 * topbar) dokłada `CaseWorkspaceRoute`, a harness zrzutowy renderuje ten hub
 * bezpośrednio — dzięki temu zrzut pokazuje moduł, a nie ramkę wokół niego.
 *
 * Trasy wewnętrzne:
 *   /zlecenia            → lista
 *   /zlecenia/:caseId    → jedno zlecenie (Plan · Realizacja · Rezultaty)
 */

import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { CaseDetailScreen } from './CaseDetailScreen';
import { CasesListScreen } from './CasesListScreen';

export const CaseWorkspaceHub: React.FC = () => (
  // ŚWIADOMIE bez `overflow-x-hidden`: przycięcie ukryłoby przepełnienie
  // zamiast je usunąć, a warunek właściciela mówi o BRAKU poziomego scrolla,
  // nie o zamaskowaniu go. Przepełnienie naprawiamy u źródła (min-w-0 +
  // własne przewijanie tabeli), a pomiar `document.scrollWidth` w zrzutach
  // musi to potwierdzać.
  <div className="h-full min-w-0 bg-c-bg text-c-text">
    <Routes>
      <Route index element={<CasesListScreen />} />
      <Route path=":caseId" element={<CaseDetailScreen />} />
    </Routes>
  </div>
);

export default CaseWorkspaceHub;
