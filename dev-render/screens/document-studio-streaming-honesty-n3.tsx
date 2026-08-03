/**
 * Dev-render host — N3 (2026-07-28): doktryna streaming "na naszych oczach"
 * (`Harvard/wdrozenie-100/_DOKTRYNA_STREAMING_2026-07-27.md`), cztery naprawy:
 *
 *   1. Cichy fallback SSE→sync: teraz spokojny, jawny komunikat PL
 *      ("Połączenie na żywo zerwane — dokańczam w tle…") zamiast ciszy.
 *   2. Przycisk Stop w panelu generowania (parytet z Canvas `stopStream`).
 *   3. Chipy źródeł ("Based on: X, Y") pod sekcją — `section.blocks[].sourceRef`
 *      już płynął przez SSE, teraz jest renderowany.
 *   4. Mode 3 (z szablonu) pokazuje plan PRZED pisaniem, tak jak Mode 1 —
 *      poprzednio pomijany.
 *
 * Montuje REALNY `DocumentStudioView` (real component tree, AppProviders),
 * podstawiając WYŁĄCZNIE warstwę sieciową — wzorzec z
 * `document-studio-ai-teresa.tsx`.
 *
 * URL:
 *   ?screen=document-studio-streaming-honesty-n3[&theme=light|dark]
 *   Domyślnie: `entry=template` (Mode 3) — pokazuje NAJPIERW naprawę #4
 *   (ekran planu z szablonu, sekcje: "Streszczenie" / "Ustalenia"). Kliknij
 *   "Generate document" na planie, żeby zobaczyć naprawy #1-#3 na żywo:
 *   sekcje pojawiają się co ~1.5s z chipami źródeł pod tytułem, przycisk
 *   "Stop" jest aktywny przez cały czas trwania streamu.
 *
 *   &simFail=1 — zamiast poprawnego streamu, POST /generate/stream odrzuca
 *   transport (symuluje zerwane połączenie) → pokazuje naprawę #1 (komunikat
 *   "Połączenie na żywo zerwane — dokańczam w tle…"), po czym `/generate`
 *   (fallback sync) kończy się sukcesem ~1.5s później i ląduje w edytorze.
 *
 * Zrzut PRZED Piotrem (CLAUDE.md #7) — to jest ten harness.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { DocumentStudioView } from '@/components/DocumentStudio/DocumentStudioView';
import { useAppStore } from '@/store/useAppStore';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

const params = new URLSearchParams(window.location.search);
const simFail = params.get('simFail') === '1';

useAppStore.setState({
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
  currentOrganization: {
    id: 'org-dbr77',
    name: 'DBR77 Sp. z o.o.',
  },
} as any);

const STUB_TEMPLATE = {
  templateId: 'tpl-audyt-1',
  organizationId: 'org-dbr77',
  name: 'Raport z audytu AI',
  category: 'report',
  documentType: 'ai_audit_report',
  purpose: 'Raport z audytu AI dla klienta.',
  audience: ['CxO'],
  language: 'pl',
  languageStyle: 'formal',
  communicationRegister: 'executive',
  density: 'standard',
  confidentiality: 'internal',
  requiredInputs: [],
  sectionBlueprint: [
    {
      title: 'Streszczenie',
      level: 1,
      purpose: 'Podsumowanie wykonawcze dla zarządu.',
      required: true,
      expectedLengthHint: 'short',
    },
    {
      title: 'Ustalenia',
      level: 1,
      purpose: 'Kluczowe ustalenia audytu, z liczbami z danych klienta.',
      required: true,
      expectedLengthHint: 'long',
    },
  ],
  exportRules: { docx: true, pdf: true, markdown: false, approvalRequiredForExport: false },
  status: 'approved',
  version: '1.0',
  createdBy: 'dev-render',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const OUTLINE = {
  documentType: 'ai_audit_report',
  title: 'Raport z audytu AI — Q3',
  sections: [
    { title: 'Streszczenie', level: 1, purpose: 'overview', expectedLengthHint: 'short' },
    { title: 'Ustalenia', level: 1, purpose: 'findings', expectedLengthHint: 'long' },
  ],
  recommendedDensity: 'standard',
  recommendedRegister: 'executive',
  recommendedLanguageStyle: 'formal',
};

const SCHEMA = {
  title: OUTLINE.title,
  sections: OUTLINE.sections.map((s, i) => ({
    id: `sec-${i}`,
    title: s.title,
    blocks: [{ type: 'paragraph', text: `Treść sekcji "${s.title}" (dev-render mock).` }],
  })),
};

/**
 * Naprawa #2/#3 na żywo: strumień SSE emitowany Z OPÓŹNIENIEM (nie od razu
 * jak w harnessu ai-teresa) — żeby nadzorca zdążył zobaczyć każdą sekcję
 * osobno (chip źródła pod tytułem) i miał czas kliknąć "Stop" w trakcie.
 * `blocks[].sourceRef` na drugiej sekcji ma DWA bloki wskazujące na TO SAMO
 * źródło — pokazuje deduplikację chipów.
 */
function buildSlowSseStream(): Response {
  const frame = (event: string, data: unknown) =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      const enqueue = (s: string) => controller.enqueue(encoder.encode(s));
      enqueue(frame('plan', { outline: OUTLINE }));
      setTimeout(() => {
        enqueue(
          frame('section', {
            sectionId: 'sec-0',
            index: 0,
            total: 2,
            title: OUTLINE.sections[0].title,
            blocks: [
              {
                blockId: 'b0',
                type: 'paragraph',
                content: SCHEMA.sections[0].blocks[0].text,
                sourceRef: {
                  sourceType: 'interview',
                  sourceId: 'int-4',
                  sourceTitle: 'Wywiad #4 — CFO',
                },
              },
            ],
          })
        );
      }, 1200);
      setTimeout(() => {
        enqueue(
          frame('section', {
            sectionId: 'sec-1',
            index: 1,
            total: 2,
            title: OUTLINE.sections[1].title,
            blocks: [
              {
                blockId: 'b1',
                type: 'paragraph',
                content: SCHEMA.sections[1].blocks[0].text,
                sourceRef: {
                  sourceType: 'insight',
                  sourceId: 'ins-12',
                  sourceTitle: 'Insight #12 — koszty operacyjne',
                },
              },
              {
                blockId: 'b2',
                type: 'paragraph',
                content: 'kontynuacja…',
                // Ten sam sourceRef co powyżej — sprawdza deduplikację chipów.
                sourceRef: {
                  sourceType: 'insight',
                  sourceId: 'ins-12',
                  sourceTitle: 'Insight #12 — koszty operacyjne',
                },
              },
              {
                blockId: 'b3',
                type: 'paragraph',
                content: 'jeszcze jedno źródło…',
                sourceRef: {
                  sourceType: 'interview',
                  sourceId: 'int-7',
                  sourceTitle: 'Wywiad #7 — Kierownik operacji',
                },
              },
            ],
          })
        );
      }, 2600);
      setTimeout(() => {
        enqueue(
          frame('done', {
            artifactId: 'doc-n3-streaming-mock-1',
            schema: SCHEMA,
            generationWarnings: [],
          })
        );
        controller.close();
      }, 3600);
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
    return new Response(JSON.stringify({ templates: [STUB_TEMPLATE] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.includes('/document-studio/generate/stream')) {
    if (simFail) {
      // Naprawa #1: symuluj zerwane połączenie transportowe — klient MUSI
      // pokazać komunikat, nie po cichu przejść na sync.
      return Promise.reject(new Error('simulated transport failure (dev-render)'));
    }
    return buildSlowSseStream();
  }

  if (simFail && url.includes('/document-studio/generate') && !url.includes('/stream')) {
    // Fallback sync path po zerwanym streamie — kończy się sukcesem po
    // krótkiej zwłoce, żeby zrzut zdążył złapać komunikat najpierw.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return new Response(
      JSON.stringify({
        artifactId: 'doc-n3-fallback-mock-1',
        schema: SCHEMA,
        generationWarnings: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return realFetch(input, init);
}) as typeof window.fetch;

seedRealisticSession();
if (!window.location.pathname.startsWith('/document-studio')) {
  // Domyślnie Mode 3 (template) — pierwsza rzecz do zobaczenia to naprawa #4
  // (ekran planu z szablonu). Wybierz "Z szablonu" na ekranie wyboru trybu
  // jeśli triMode jest ON; w innym wypadku ląduje wprost w formularzu Mode 3.
  window.history.replaceState({}, '', '/document-studio?entry=template');
}

export default function DocumentStudioStreamingHonestyN3Screen(): React.ReactElement {
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
                Document Studio — N3 doktryna streaming (4 naprawy)
              </div>
              <div className="text-xs text-c-text-secondary">
                {simFail ? (
                  <>
                    Tryb <code>simFail=1</code>: wypełnij formularz i wygeneruj — strumień padnie
                    natychmiast, oczekiwane: komunikat „Połączenie na żywo zerwane — dokańczam w
                    tle…" (naprawa #1), potem sukces po ok. 1,5 s.
                  </>
                ) : (
                  <>
                    Wybierz szablon „Raport z audytu AI" → oczekiwane: ekran planu (Streszczenie /
                    Ustalenia) PRZED generowaniem (naprawa #4). Kliknij „Generate document” →
                    oczekiwane: sekcje pojawiają się co ~1,2–1,4 s z chipami „Based on: …” pod
                    tytułem (naprawa #3, drugi chip zdeduplikowany), przycisk „Stop” widoczny przez
                    cały czas trwania (naprawa #2).
                  </>
                )}
              </div>
            </div>
            <div className="h-[calc(100vh-72px)]">
              <DocumentStudioView />
            </div>
          </div>
        </FeatureFlagsProvider>
      </AppProviders>
    </QueryClientProvider>
  );
}
