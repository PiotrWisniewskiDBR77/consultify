/**
 * Dev-render host — CHIPY SUGESTII POD OKNEM ROZMOWY TERESY (D4, 2026-07-28).
 *
 * Zgłoszenie właściciela: „teraz Teresa — wywal te przyciski pod oknem rozmowy"
 * (dwa różowe chipy „Open Outputs Library" / „Review pending artifacts").
 * Decyzja: usuwamy w CAŁEJ APLIKACJI (komponent jest współdzielony).
 *
 * Ten harness montuje REALNY `<UnifiedChatPanel>` (nie atrapę) DWA RAZY,
 * z dwoma różnymi kontekstami roboczymi, bo to kontekst decyduje, które
 * sugestie w ogóle powstają (`chatSuggestions` w UnifiedChatPanel.tsx):
 *
 *   A) workspaceContext.type = 'report'  → warunek `artifactMentioned` = true
 *      → PRZED naprawą: chipy „Open Outputs Library" + „Review pending artifacts"
 *      → PO naprawie: pod oknem rozmowy NIC
 *
 *   B) workspaceContext.type = 'insight' → rodzina sugestii wywiadu/insightu
 *      (Wygeneruj insighty · Prześlij do recenzji · Eksportuj do inicjatywy)
 *      → dowód, że mechanizm sugestii ŻYJE i nie usunęliśmy go przy okazji,
 *        oraz że chipy nie są już crimsonowe (tokeny c-*).
 *
 * Historia rozmowy jest podana przez prop `customMessages` (2 wiadomości —
 * `chatSuggestions` wymaga `displayMessages.length >= 2`), więc nie trzeba
 * logowania ani żywego modelu. Warstwa sieciowa jest zaślepiona: każdy
 * `/api/*` zwraca pusty, poprawny kształt, żeby panel się zmontował.
 *
 * URL: ?screen=teresa-chipy-sugestii[&theme=light|dark][&lang=pl|en]
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { UnifiedChatPanel } from '@/components/AIChat/UnifiedChatPanel';
import { useAppStore } from '@/store/useAppStore';
import type { ChatMessage } from '@/types/core';
import type { WorkspaceContext } from '@/types/workspace';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

const params = new URLSearchParams(window.location.search);
const isPl = params.get('lang') !== 'en';

useAppStore.setState({
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
  currentOrganization: { id: 'org-dbr77', name: 'DBR77 Sp. z o.o.' },
} as any);

// Zaślepka sieci: panel odpytuje kilka końcówek przy montowaniu (konwersacje,
// pamięć, flagi). Bez logowania dostałby 401 i wysypał konsolę — zwracamy
// puste, poprawne kształty. Nic poza /api/ nie jest przechwytywane.
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : (input?.url ?? '');
  if (url.includes('/api/')) {
    return new Response(JSON.stringify({ data: [], items: [], conversations: [], messages: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return realFetch(input, init);
}) as typeof window.fetch;

seedRealisticSession();

const ts = (iso: string) => new Date(iso);

/** A) kontekst artefaktu — to on wywoływał dwa chipy zgłoszone przez właściciela. */
const REPORT_MESSAGES: ChatMessage[] = [
  {
    id: 'a-u1',
    role: 'user',
    content: isPl
      ? 'Przygotuj raport dla zarządu z audytu Q3.'
      : 'Prepare the board report from the Q3 audit.',
    timestamp: ts('2026-07-28T09:00:00Z'),
  },
  {
    id: 'a-ai1',
    role: 'ai',
    content: isPl
      ? 'Gotowe — raport ma 4 sekcje i jest podpięty pod audyt Q3. Chcesz, żebym rozwinęła sekcję ryzyk?'
      : 'Done — the report has 4 sections and is linked to the Q3 audit. Want me to expand the risks section?',
    timestamp: ts('2026-07-28T09:00:12Z'),
  },
];

const REPORT_CONTEXT: WorkspaceContext = {
  view: 'documents' as any,
  type: 'report',
  entityId: 'rep-q3-2026',
  entityName: isPl ? 'Raport zarządczy — audyt Q3' : 'Board report — Q3 audit',
  timestamp: ts('2026-07-28T09:00:00Z'),
};

/** B) kontekst insightu — rodzina sugestii, która MA zostać przy życiu. */
const INSIGHT_MESSAGES: ChatMessage[] = [
  {
    id: 'b-u1',
    role: 'user',
    content: isPl
      ? 'Co wynika z ostatnich wywiadów o kanałach sprzedaży?'
      : 'What do the latest interviews say about sales channels?',
    timestamp: ts('2026-07-28T09:10:00Z'),
  },
  {
    id: 'b-ai1',
    role: 'ai',
    content: isPl
      ? 'Cztery z sześciu rozmów wskazują lukę w kanale partnerskim — to najmocniejszy sygnał w tej próbie.'
      : 'Four of six conversations point to a partner-channel gap — the strongest signal in this sample.',
    timestamp: ts('2026-07-28T09:10:15Z'),
  },
];

const INSIGHT_CONTEXT: WorkspaceContext = {
  view: 'insights' as any,
  type: 'insight',
  entityId: 'ins-kanaly-1',
  entityName: isPl ? 'Luka w kanale partnerskim' : 'Partner channel gap',
  timestamp: ts('2026-07-28T09:10:00Z'),
};

function Pane({
  title,
  note,
  messages,
  context,
}: {
  title: string;
  note: string;
  messages: ChatMessage[];
  context: WorkspaceContext;
}): React.ReactElement {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-c-border-subtle last:border-r-0">
      <header className="border-b border-c-border-subtle px-4 py-2">
        <h2 className="text-sm font-semibold text-c-text">{title}</h2>
        <p className="text-xs leading-snug text-c-text-secondary">{note}</p>
      </header>
      <div className="min-h-0 flex-1">
        <UnifiedChatPanel
          mode="split"
          showModeToggle={false}
          showHistoryTrigger={false}
          showFocusMode={false}
          customMessages={messages}
          workspaceContext={context}
        />
      </div>
    </section>
  );
}

export default function TeresaChipySugestiiScreen(): React.ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <FeatureFlagsProvider showDevTools={false}>
          <div className="flex h-screen w-full flex-col bg-c-bg">
            <div className="border-b border-c-border px-6 py-3">
              <div className="text-sm font-semibold text-c-text">
                Teresa — chipy sugestii pod oknem rozmowy (D4)
              </div>
              <div className="text-xs text-c-text-secondary">
                oczekiwane PO naprawie: lewy panel (kontekst raportu) — pod polem wpisywania NIC;
                prawy panel (kontekst insightu) — sugestie wywiadu nadal są i nie są różowe.
              </div>
            </div>
            <div className="flex min-h-0 flex-1">
              <Pane
                title={isPl ? 'A · kontekst RAPORTU' : 'A · REPORT context'}
                note={
                  isPl
                    ? 'warunek artifactMentioned = true — tu siedziały „Open Outputs Library" i „Review pending artifacts"'
                    : 'artifactMentioned = true — this is where the two chips lived'
                }
                messages={REPORT_MESSAGES}
                context={REPORT_CONTEXT}
              />
              <Pane
                title={isPl ? 'B · kontekst INSIGHTU' : 'B · INSIGHT context'}
                note={
                  isPl
                    ? 'rodzina sugestii wywiadu/insightu — ma zostać, dowód że mechanizm żyje'
                    : 'interview/insight suggestion family — must survive'
                }
                messages={INSIGHT_MESSAGES}
                context={INSIGHT_CONTEXT}
              />
            </div>
          </div>
        </FeatureFlagsProvider>
      </AppProviders>
    </QueryClientProvider>
  );
}
