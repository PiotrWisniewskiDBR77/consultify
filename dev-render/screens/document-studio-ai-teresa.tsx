/**
 * Dev-render host — FAZA B1 (2026-07-27): "Z AI" bez formularza, Teresa z boku.
 *
 * Właściciel (N11-N13, _NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md) skreślił
 * formularz intake (Description/Type/Density/Goal/Audience) z przepływu "Z AI":
 * "Z AI → otwiera się dokument, a Z BOKU okno AI (czat)." Ten harness montuje
 * REALNY `DocumentStudioView` z flagą `ff_zai_teresa` wymuszoną ON (żeby
 * nadzorca zobaczył nowy ekran bez pamiętania dodatkowego query param) i
 * podstawia WYŁĄCZNIE warstwę sieciową:
 *   GET  /api/document-studio/templates          → { templates: [] }
 *   POST /api/document-studio/generate/stream     → prawdziwy strumień SSE
 *        (plan → 2×section → done), żeby zrzut pokazał sekcja-po-sekcji na
 *        żywo (N16), nie tylko stan końcowy.
 *
 * Panel czatu jest PRAWDZIWY (`UnifiedChatPanel`, nie atrapa) — żeby zobaczyć
 * przejście empty → generating → document, wpisz w polu czatu wiadomość
 * ≥10 znaków (np. "Przygotuj raport dla zarządu z audytu Q3") i wyślij.
 * `onModuleIntent` przechwytuje ją PRZED normalnym wywołaniem AI chatu, więc
 * żadnych dodatkowych mocków sieciowych dla samego czatu nie potrzeba.
 *
 * URL: ?screen=document-studio-ai-teresa[&theme=light|dark][&lang=pl|en]
 *
 * Zrzut PRZED Piotrem (CLAUDE.md #7) — flaga `ff_zai_teresa` jest domyślnie
 * OFF w kodzie produkcyjnym (src/utils/zaiTeresaFlag.ts); ten harness ją
 * wymusza tylko lokalnie, w tej karcie przeglądarki.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { DocumentStudioView } from '@/components/DocumentStudio/DocumentStudioView';
import { useAppStore } from '@/store/useAppStore';
import { ZAI_TERESA_FLAG_KEYS } from '@/utils/zaiTeresaFlag';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

const params = new URLSearchParams(window.location.search);

// Wymuś flagę ON tylko w tej karcie (localStorage — patrz zaiTeresaFlag.ts
// priorytet #2). Produkcyjny default zostaje OFF.
window.localStorage.setItem(ZAI_TERESA_FLAG_KEYS.localStorage, '1');

useAppStore.setState({
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
  currentOrganization: {
    id: 'org-dbr77',
    name: 'DBR77 Sp. z o.o.',
  },
} as any);

/** Zbuduj ciało odpowiedzi SSE dla /generate/stream — plan + 2 sekcje + done. */
function buildSseStreamResponse(): Response {
  const frame = (event: string, data: unknown) =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const outline = {
    documentType: 'executive_memo',
    title: 'Raport dla zarządu — audyt Q3',
    sections: [
      { title: 'Podsumowanie', level: 1, purpose: 'overview', expectedLengthHint: 'short' },
      { title: 'Kluczowe wnioski', level: 1, purpose: 'findings', expectedLengthHint: 'medium' },
    ],
    recommendedDensity: 'standard',
    recommendedRegister: 'executive',
    recommendedLanguageStyle: 'formal',
  };
  const schema = {
    title: outline.title,
    sections: outline.sections.map((s, i) => ({
      id: `sec-${i}`,
      title: s.title,
      blocks: [{ type: 'paragraph', text: `Treść sekcji "${s.title}" (dev-render mock).` }],
    })),
  };
  const frames = [
    frame('plan', { outline }),
    frame('section', {
      sectionId: 'sec-0',
      index: 0,
      total: 2,
      title: outline.sections[0].title,
      blocks: schema.sections[0].blocks,
    }),
    frame('section', {
      sectionId: 'sec-1',
      index: 1,
      total: 2,
      title: outline.sections[1].title,
      blocks: schema.sections[1].blocks,
    }),
    frame('done', {
      artifactId: 'doc-ai-teresa-mock-1',
      schema,
      generationWarnings: [],
    }),
  ];

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      // Emituje wszystkie klatki od razu — wystarczające do zrzutu; realny
      // serwer je rozkłada w czasie, ale konsument SSE (`generate/stream`
      // consumer w `document-studio/api.ts`) parsuje identycznie niezależnie
      // od tempa.
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : (input?.url ?? '');

  if (url.includes('/document-studio/templates')) {
    return new Response(JSON.stringify({ templates: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (url.includes('/document-studio/generate/stream')) {
    return buildSseStreamResponse();
  }
  return realFetch(input, init);
}) as typeof window.fetch;

seedRealisticSession();
if (!window.location.pathname.startsWith('/document-studio')) {
  window.history.replaceState({}, '', '/document-studio?entry=ai');
}

export default function DocumentStudioAiTeresaScreen(): React.ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <FeatureFlagsProvider showDevTools={false}>
          <div className="min-h-screen w-full bg-c-bg">
            <div className="border-b border-c-border px-6 py-3">
              <div className="text-sm font-semibold text-c-text">
                Document Studio — "Z AI" bez formularza, Teresa z boku (FAZA B1)
              </div>
              <div className="text-xs text-c-text-secondary">
                oczekiwane: brak pól Description/Type/Density/Goal/Audience, dokument-placeholder w
                środku + czat Teresy po prawej. Wpisz w polu czatu wiadomość (≥10 znaków) i wyślij,
                żeby zobaczyć przejście generating→document.
              </div>
            </div>
            <div className="h-[calc(100vh-64px)]">
              <DocumentStudioView />
            </div>
          </div>
        </FeatureFlagsProvider>
      </AppProviders>
    </QueryClientProvider>
  );
}
