/**
 * Dev-render host — stany wizualne WPROWADZONE PRZEZ P1 (odbiór architekta):
 * „Użyj wzorca" rozwiązywane serwerowo, a odrzucenie musi dać stan BLOKUJĄCY,
 * bez cichego fallbacku do pickera ani do generacji z AI.
 *
 * Montujemy REALNY `DocumentStudioView` (nie kopię markupu) i podstawiamy
 * wyłącznie WARSTWĘ SIECIOWĄ: `POST /api/document-studio/templates/resolve`
 * odpowiada tak, jak odpowiedziałby serwer po odrzuceniu. Dzięki temu zrzut
 * pokazuje ten sam kod, który zobaczy użytkownik.
 *
 * URL: ?screen=document-studio-template-resolve-error
 *        [&case=orphaned|forbidden|deprecated|not_indexed|resolving]
 *        [&theme=light|dark][&lang=pl|en]
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { DocumentStudioView } from '@/components/DocumentStudio/DocumentStudioView';

const CASES: Record<string, { status: number; error: string }> = {
  orphaned: { status: 404, error: 'TEMPLATE_ORPHANED' },
  not_indexed: { status: 404, error: 'TEMPLATE_NOT_INDEXED' },
  forbidden: { status: 403, error: 'TEMPLATE_FORBIDDEN' },
  deprecated: { status: 409, error: 'TEMPLATE_DEPRECATED' },
};

const params = new URLSearchParams(window.location.search);
const caseKey = params.get('case') || 'orphaned';

// Podstawiamy sieć RAZ, na poziomie modułu — zanim widok zdąży się zamontować
// i wystrzelić żądanie rozwiązania wzorca.
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : (input?.url ?? '');

  if (url.includes('/document-studio/templates/resolve')) {
    if (caseKey === 'resolving') {
      // Stan „resolving": żądanie, które nigdy nie wraca — pokazuje, że widok
      // NIE renderuje w tym czasie pickera.
      return new Promise(() => {}) as any;
    }
    const c = CASES[caseKey] ?? CASES.orphaned;
    return new Response(JSON.stringify({ error: c.error }), {
      status: c.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Lista zatwierdzonych szablonów — pusta, żeby było widać, że stan błędu
  // NIE degraduje się po cichu do wyboru ręcznego.
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

export default function DocumentStudioTemplateResolveErrorScreen(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={['/document-studio?entry=template&templateArtifactId=art-index-123']}
      >
        {/* GRAFIKA 2026-08-30: `min-h-screen` dawał kontenerowi wysokość NATURALNĄ,
            więc wyśrodkowany w pionie komunikat błędu i tak lądował przy górze —
            i wyglądał na niewyśrodkowany, choć w produkcie jest. Pełna wysokość
            z rozciągliwym środkiem, żeby zrzut pokazywał to, co widzi użytkownik. */}
        <div className="flex h-screen w-full flex-col overflow-hidden bg-c-bg">
          <div className="border-b border-c-border px-6 py-3">
            <div className="text-sm font-semibold text-c-text">
              Document Studio — „Użyj wzorca" odrzucone przez serwer
            </div>
            <div className="text-xs text-c-text-secondary">
              case={caseKey} · stan blokujący: bez pickera, bez AI
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
