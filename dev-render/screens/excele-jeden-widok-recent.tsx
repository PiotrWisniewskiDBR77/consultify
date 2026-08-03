/**
 * Dev-render host — odbiór "jeden Excel na każdej ścieżce" (2026-07-28),
 * ŚCIEŻKA 3: /excele → zakładka "Recent"/"Saved" → otwarcie istniejącego.
 *
 * Renderuje REALNY `ExceleView` na `/excele` (home, bez artifactId) —
 * `ArtifactModuleHome`'s "Recent" tab woła `useModuleRecentArtifacts` →
 * `useArtifactOutputsList('mine')`, który (w przeciwieństwie do
 * `Api.listWorkbookTemplates` itp.) woła SUROWY `window.fetch('/api/artifacts?...')`,
 * nie `Api.get` — patrz `src/components/ReportsAndPresentations/useRapData.ts`.
 * Dlatego ten harness patchuje `window.fetch` (scoped: tylko URL-e zawierające
 * `/artifacts?`, wszystko inne przechodzi do oryginalnego fetch — i18n locale
 * loader też używa fetch, więc pełne przejęcie zepsułoby tłumaczenia).
 *
 * Klik na wiersz w "Recent" wywołuje `handleArtifactClick` →
 * `navigate('/excele?artifactId=<id>')` — DOKŁADNIE tę samą ścieżkę reopen co
 * bezpośredni link (patrz `excele-edytowalna-siatka.tsx`), więc ten sam
 * `Api.get('/workbook/:id')` mock obsługuje oba harnessy.
 *
 * URL: ?screen=excele-jeden-widok-recent&theme=light|dark&lang=pl
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ExceleView } from '@/components/AIChat/KimiWorkspace/ExceleView';
import { Api } from '@/services/api';

const ID = 'wb-dev-render-recent-open';

const kol = (key: string, header: string) => ({ key, header });
const wiersz = (cells: Record<string, { value?: unknown; formula?: string }>) => ({ cells });

const ZALOZENIA = {
  name: 'Założenia',
  columns: [kol('driver', 'Driver'), kol('wartosc', 'Wartość')],
  rows: [
    wiersz({ driver: { value: 'Budżet roczny' }, wartosc: { value: 250000 } }),
    wiersz({ driver: { value: 'Wzrost %' }, wartosc: { value: 0.08 } }),
  ],
};
const WYNIKI = {
  name: 'Wyniki',
  columns: [kol('metryka', 'Metryka'), kol('wartosc', 'Wartość')],
  rows: [
    wiersz({
      metryka: { value: 'Budżet rok 2' },
      wartosc: { formula: `'Założenia'!$B$2*(1+'Założenia'!$B$3)` },
    }),
  ],
};

const WORKBOOK = {
  id: ID,
  title: 'Budżet operacyjny (mock — otwarty z Recent)',
  schema_json: {
    title: 'Budżet operacyjny (mock — otwarty z Recent)',
    sheets: [ZALOZENIA, WYNIKI],
  },
};

function installMocks(): () => void {
  const realGet = Api.get.bind(Api);
  Api.get = (async (url: string, ...rest: unknown[]) => {
    if (typeof url === 'string' && url.includes(`/workbook/${ID}`)) return WORKBOOK;
    return realGet(url, ...(rest as []));
  }) as typeof Api.get;

  const realFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.includes('/artifacts?')) {
      const raw = {
        originRuntime: 'sheet',
        originRecordId: ID,
        artifactId: ID,
        title: 'Budżet operacyjny (mock — otwarty z Recent)',
        updatedAt: new Date().toISOString(),
        originStatus: 'draft',
      };
      return new Response(JSON.stringify({ data: [raw] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return realFetch(input as any, init);
  }) as typeof window.fetch;

  return () => {
    Api.get = realGet;
    window.fetch = realFetch;
  };
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function ExceleJedenWidokRecentScreen(): React.ReactElement {
  installMocks();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/excele']}>
        <div className="h-screen w-full overflow-hidden bg-c-bg">
          <ExceleView />
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
