/**
 * Dev-render host — stan błędu WZNOWIENIA dokumentu (P0.2, 2026-07-27):
 * wejście na /document-studio/:artifactId z nieistniejącym/niedostępnym
 * rekordem MUSI pokazać blokujący błąd PL z powrotem do Materiałów —
 * NIGDY cichy spadek do formularza intake (to był dramat zgłoszony przez
 * właściciela: „klik w dokument otwiera generator").
 *
 * Montujemy REALNY `DocumentStudioView`, podstawiamy tylko sieć:
 * GET /api/document-studio/:artifactId → 404 (case=notfound, default)
 * albo 500 (case=server).
 *
 * URL: ?screen=document-studio-resume-error[&case=notfound|server][&theme=...]
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { DocumentStudioView } from '@/components/DocumentStudio/DocumentStudioView';

const params = new URLSearchParams(window.location.search);
const caseKey = params.get('case') || 'notfound';

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : (input?.url ?? '');

  // Wznowienie artefaktu — symulujemy brak/awarię rekordu.
  if (/\/document-studio\/[^/?]+$/.test(url.split('?')[0]) && !url.includes('/templates')) {
    const status = caseKey === 'server' ? 500 : 404;
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (url.includes('/document-studio/templates')) {
    return new Response(JSON.stringify({ templates: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return realFetch(input, init);
}) as typeof window.fetch;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function DocumentStudioResumeErrorScreen(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      {/* #84b: widok czyta artifactId z path LUB query — query nie wymaga
          definiowania Route z parametrem w harnessie. */}
      <MemoryRouter initialEntries={['/document-studio?artifactId=art-nie-istnieje-404']}>
        {/* GRAFIKA 2026-08-30: `min-h-screen` dawał kontenerowi wysokość NATURALNĄ,
            więc wyśrodkowany w pionie komunikat błędu i tak lądował przy górze —
            i wyglądał na niewyśrodkowany, choć w produkcie jest. Pełna wysokość
            z rozciągliwym środkiem, żeby zrzut pokazywał to, co widzi użytkownik. */}
        <div className="flex h-screen w-full flex-col overflow-hidden bg-c-bg">
          <div className="border-b border-c-border px-6 py-3">
            <div className="text-sm font-semibold text-c-text">
              Document Studio — nieudane wznowienie dokumentu (P0.2)
            </div>
            <div className="text-xs text-c-text-secondary">
              case={caseKey} · oczekiwane: blokujący błąd PL, NIGDY formularz intake
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <DocumentStudioView />
          </div>
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
