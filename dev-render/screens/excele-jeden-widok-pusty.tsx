/**
 * Dev-render host — odbiór "jeden Excel na każdej ścieżce" (2026-07-28),
 * ŚCIEŻKA 2: /excele → "Start new" → wybór trybu → "Czysto" (Pusty arkusz).
 *
 * PRZED naprawą: `POST /api/workbook/blank` budował schema z `columns: []`,
 * `rows: []` — `EditableSpreadsheetGrid` renderuje `null` dla pustych kolumn
 * (`if (!activeRaw?.columns?.length) return null;`), więc "Pusty arkusz"
 * kończył się na zastępczym obrazku "Spreadsheet preview" (KimiWorkspaceShell
 * fallback), nie na klikalnej siatce. PO naprawie `/workbook/blank` zwraca
 * prawdziwy szkielet 12×30 pustych komórek (`server/src/routes/workbook.routes.ts`).
 *
 * Ten harness mockuje `Api.post('/workbook/blank', …)` DOKŁADNIE tym samym
 * kształtem, jaki teraz produkuje serwer (12 kolumn A..L, 30 pustych wierszy),
 * żeby dowieść: dwuklik w DOWOLNĄ komórkę pustej siatki otwiera edycję.
 *
 * Ścieżka wchodzi przez `TriModeChooser` (ff_tri_tryby, domyślnie ON) —
 * `?view=new` pokazuje wybór "Czysto / Z AI / Z szablonu"; klik "Czysto"
 * woła `handleCreateEmptyGrid` → `POST /workbook/blank` → nawigacja do
 * `?artifactId=<id>` → istniejąca ścieżka reopen.
 *
 * URL: ?screen=excele-jeden-widok-pusty&theme=light|dark&lang=pl
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ExceleView } from '@/components/AIChat/KimiWorkspace/ExceleView';
import { Api } from '@/services/api';

const ID = 'wb-dev-render-blank-grid';

// Kopia 1:1 kształtu z server/src/routes/workbook.routes.ts POST /workbook/blank
// (2026-07-28 fix) — 12 kolumn (A..L), 30 pustych wierszy (cells: {}).
const BLANK_GRID_COLUMNS = 12;
const BLANK_GRID_ROWS = 30;
const colLetter = (index: number): string => {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};
const blankColumns = Array.from({ length: BLANK_GRID_COLUMNS }, (_, i) => ({
  key: colLetter(i),
  header: colLetter(i),
}));
const blankRows = Array.from({ length: BLANK_GRID_ROWS }, () => ({ cells: {} }));

const WORKBOOK = {
  id: ID,
  title: 'Pusty arkusz',
  schema_json: {
    title: 'Pusty arkusz',
    sheets: [{ name: 'Arkusz1', columns: blankColumns, rows: blankRows }],
  },
};

function installMocks(): void {
  const realGet = Api.get.bind(Api);
  Api.get = (async (url: string, ...rest: unknown[]) => {
    if (typeof url === 'string' && url.includes(`/workbook/${ID}`)) return WORKBOOK;
    return realGet(url, ...(rest as []));
  }) as typeof Api.get;

  const realPost = Api.post.bind(Api);
  Api.post = (async (url: string, data?: unknown) => {
    if (url === '/workbook/blank') {
      return { data: { id: ID, title: 'Pusty arkusz' } };
    }
    return realPost(url, data);
  }) as typeof Api.post;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function ExceleJedenWidokPustyScreen(): React.ReactElement {
  installMocks();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/excele?view=new']}>
        <div className="h-screen w-full overflow-hidden bg-c-bg">
          <ExceleView />
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
