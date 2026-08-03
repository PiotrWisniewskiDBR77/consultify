/**
 * Dev-render host — DRUGI EKRAN dla D4: chipy sugestii w PANELU ARTEFAKTU.
 *
 * `UnifiedChatPanel` jest komponentem CAŁEJ APLIKACJI, więc dowód „chipy
 * zniknęły" musi obejmować więcej niż jedną powierzchnię. Tu montujemy REALNY
 * `<AIConsultantPanel>` (kanoniczna Teresa POZIOM 3 — artefakt, prawy panel
 * ~360px, używana m.in. przez Insight i Inicjatywę) — inny moduł, inny wrapper,
 * ten sam współdzielony czat w środku.
 *
 * Różnica względem `teresa-chipy-sugestii`: tam historia rozmowy szła propem
 * `customMessages`, tu NIE — `AIConsultantPanel` nie podaje tego propu, więc
 * wiadomości pochodzą ze SKLEPU (`useConversationStore.activeMessages`),
 * dokładnie jak w produkcji. Zasiewamy dwie wiadomości; ostatnia mówi
 * o prezentacji/szablonie, czyli trafia w warunek, który PRZED naprawą
 * wywoływał chipy „Open Outputs Library" / „Review pending artifacts".
 *
 * URL: ?screen=teresa-chipy-panel-artefaktu[&theme=light|dark][&lang=pl|en]
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { AIConsultantPanel } from '@/components/shared/NModeLayout/AIConsultantPanel';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
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

const CONVERSATION_ID = 'conv-d4-artefakt';

// Zasiew ŻYWEGO sklepu rozmów — tą samą drogą, którą idzie produkcja.
useConversationStore.setState({
  activeConversationId: CONVERSATION_ID,
  activeMessages: [
    {
      id: 'm1',
      conversationId: CONVERSATION_ID,
      role: 'user',
      content: isPl
        ? 'Zrób z tego insightu prezentację dla zarządu na bazie naszego szablonu.'
        : 'Turn this insight into a board presentation based on our template.',
      messageType: 'text',
      createdAt: new Date('2026-07-28T08:00:00Z'),
    },
    {
      id: 'm2',
      conversationId: CONVERSATION_ID,
      role: 'ai',
      content: isPl
        ? 'Zrobione — deck ma 8 slajdów i trzyma się szablonu zarządczego. Chcesz, żebym dołożyła slajd z ryzykami?'
        : 'Done — the deck has 8 slides and follows the board template. Want me to add a risks slide?',
      messageType: 'text',
      createdAt: new Date('2026-07-28T08:00:20Z'),
    },
  ],
} as any);

const WORKSPACE_CONTEXT: WorkspaceContext = {
  view: 'insights' as any,
  type: 'presentation',
  entityId: 'ins-kanaly-1',
  entityName: isPl ? 'Luka w kanale partnerskim' : 'Partner channel gap',
  timestamp: new Date('2026-07-28T08:00:00Z'),
};

export default function TeresaChipyPanelArtefaktuScreen(): React.ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <FeatureFlagsProvider showDevTools={false}>
          <div className="relative h-screen w-full bg-c-bg">
            <div className="border-b border-c-border px-6 py-3">
              <div className="text-sm font-semibold text-c-text">
                Teresa POZIOM 3 (panel artefaktu) — chipy sugestii pod oknem rozmowy (D4)
              </div>
              <div className="text-xs text-c-text-secondary">
                inny moduł, inny wrapper, ten sam współdzielony czat. Historia rozmowy ze SKLEPU
                (jak w produkcji), ostatnia wiadomość mówi o prezentacji i szablonie. Oczekiwane PO
                naprawie: pod polem wpisywania NIC.
              </div>
            </div>
            <AIConsultantPanel
              open
              onClose={() => undefined}
              artifactType="insight"
              artifactId="ins-kanaly-1"
              artifactTitle={isPl ? 'Luka w kanale partnerskim' : 'Partner channel gap'}
              workspaceContext={WORKSPACE_CONTEXT}
              isPolish={isPl}
              actions={[]}
            />
          </div>
        </FeatureFlagsProvider>
      </AppProviders>
    </QueryClientProvider>
  );
}
