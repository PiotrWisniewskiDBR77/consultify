/**
 * Dev-render host — odbiór naprawy "nie mam czego otworzyć" (2026-07-23):
 * realny ExceleView otwierany z `?artifactId=` wskazującym na artefakt typu
 * 'sheet', którego origin (tp_tables.id) NIE istnieje w bazie (dokładnie ten
 * przypadek dotyczy ~55% arkuszy z realnego demo — audyt origin/demo,
 * org Piotra: 41/75 origin_record_id nie pasuje do generated_workbooks ANI
 * tp_tables — "wisząca" referencja).
 *
 * PRZED naprawą: `.catch()` w ExceleView fabrykował pusty podgląd "Spreadsheet"
 * (1 pusta zakładka "Sheet1", bez komórek) — wyglądało jakby się otworzyło,
 * w środku nic. PO naprawie: honest error state (ta sama, już istniejąca,
 * ścieżka `isFailed` w KimiWorkspaceShell — czerwona plakietka + komunikat),
 * plus toast. Realny GENERUJĄCY łańcuch (workbook istnieje LUB
 * tp_tables istnieje → redirect do Table Studio) nie jest tu mockowany:
 * harness nie ma backendu, więc `Api.get('/workbook/:id')` i
 * `TablePlatformApi.getTable` i tak zawodzą sieciowo — to naturalnie
 * odtwarza dokładnie ścieżkę "NIC się nie rozwiązało" bez potrzeby mocków.
 *
 * URL: ?screen=excele-reopen-verify&theme=light|dark&lang=pl
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ExceleView } from '@/components/AIChat/KimiWorkspace/ExceleView';
import { Api } from '@/services/api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

// Zapewnij deterministyczne odrzucenie GET /workbook/:id (zamiast czekać na
// realny (i tak nieudany) fetch sieciowy w harnessie bez backendu) — dokładnie
// odtwarza 404, jaki zwraca serwer dla artifactId spoza `generated_workbooks`.
// UWAGA: main.tsx eagerly importuje WSZYSTKIE ekrany harnessu; kilka innych
// (`karta-decision`, `karta-task`, `decision-record`, ...) też patchują
// `Api.get` na poziomie modułu, więc kolejność importów decyduje, kto wygrywa.
// Patch tutaj wewnątrz komponentu (przy każdym renderze, idempotentnie) —
// to gwarantuje, że NASZ patch jest ostatni, bo komponent montuje się PO tym,
// jak wszystkie moduły harnessu już się wykonały.
function installWorkbookNotFoundMock(): void {
  const realGet = Api.get.bind(Api);
  Api.get = (async (url: string) => {
    if (url.startsWith('/workbook/')) {
      throw new Error('Workbook not found (mock 404)');
    }
    if (url.includes('/action-target')) {
      throw new Error('No action target (mock 404)');
    }
    return realGet(url);
  }) as typeof Api.get;
}

export default function ExceleReopenVerifyScreen(): React.ReactElement {
  installWorkbookNotFoundMock();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/excele?artifactId=mock-dangling-origin-id']}>
        <div className="h-screen w-full overflow-hidden bg-c-bg">
          <ExceleView />
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
