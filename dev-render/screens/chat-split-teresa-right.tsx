/**
 * Dev-render: ODWRÓCONY split /chat (decyzja Piotra, D17) — artefakt po LEWEJ,
 * Teresa po PRAWEJ.
 *
 * ★ NAPRAWA PARYTETU 2026-09-01 (AUDYT_PRZYRZADU_20260901.md, Kategoria 4).
 * Poprzednia wersja tego pliku miała ATRAPĘ OBU STRON: własny `ArtifactMock`
 * i własny `TeresaChatMock`, z ręcznie odtworzonymi klasami `lg:order-*`.
 * Właściciel oceniał więc rysunek układu, nie układ. Nagłówek tłumaczył to
 * tym, że „realny UnifiedChatPanel ciągnie store/API/logowanie i nie zmontuje
 * się w harnessie" — sprawdzone: montuje się, jeśli wypełnić store auth
 * i podstawić wołania listy konwersacji/wiadomości.
 *
 * Teraz montujemy REALNY `<UnifiedChatPanel mode="full">`
 * (`src/components/AIChat/UnifiedChatPanel.tsx`) — ten sam komponent, który
 * renderuje `/chat`. Podział, o który chodzi w D17, jest JEGO wewnętrznym
 * układem: `chat-work-panel` (artefakt, `lg:order-1`, linia 7360) po lewej,
 * kolumna kompozytora rozmowy (`lg:order-2`, linia 6552) po prawej. Panel
 * artefaktu otwieramy tak, jak robi to produkcja — parametrem adresu
 * `?workPanel=1` (UnifiedChatPanel.tsx:6360), nie podmianą stanu.
 *
 * Zero backendu: podstawiamy tylko wołania, które ten ekran robi przy montażu.
 * Zrzut robi nadzorca przed odbiorem właściciela (CLAUDE.md #7).
 *
 * URL: ?screen=chat-split-teresa-right[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { QueryClientProvider } from '@tanstack/react-query';

import { UnifiedChatPanel } from '../../src/components/AIChat/UnifiedChatPanel';
import { AccessPolicyProvider } from '../../src/contexts/AccessPolicyContext';
import { AIProvider } from '../../src/contexts/AIContext';
import { AutoSaveProvider } from '../../src/contexts/AutoSaveContext';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { HelpProvider } from '../../src/contexts/HelpContext';
import { OrgProvider } from '../../src/contexts/OrgContext';
import { TeresaVoiceProvider } from '../../src/contexts/TeresaVoiceContext';
import { TrialProvider } from '../../src/contexts/TrialContext';
import { createAppQueryClient } from '../../src/lib/createAppQueryClient';
import { V8Provider } from '../../src/providers/V8Provider';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { useConversationStore } from '../../src/store/useConversationStore';

const CONVERSATION_ID = 'conv-atelier-toys-0001';

// Ten sam klient co produkcyjny `AppProviders` (src/providers/AppProviders.tsx:23).
const queryClient = createAppQueryClient();

// Panel artefaktu otwiera się TĄ SAMĄ drogą co w produkcji: parametrem adresu
// `?workPanel=1` (UnifiedChatPanel.tsx:6360-6369, czyta `window.location`).
// Dopisujemy go do adresu harnessu, żeby zrzut był deterministyczny bez klikania
// — nie podmieniamy stanu komponentu.
{
  const url = new URL(window.location.href);
  if (!url.searchParams.has('workPanel')) {
    url.searchParams.set('workPanel', '1');
    window.history.replaceState(null, '', url.toString());
  }
}

useAppStore.setState({
  currentUser: {
    id: 'usr-piotr',
    email: 'piotr@atelier-toys.pl',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    role: 'OWNER',
    organizationId: 'org-atelier-toys-0001',
  },
  currentOrganization: { id: 'org-atelier-toys-0001', name: 'Atelier Toys Sp. z o.o.' },
  isAuthInitializing: false,
} as never);

// Rozmowa po prawej — bez niej kolumna Teresy jest pusta i zrzut nie pokazuje
// tego, co decyzja D17 rozstrzyga (co stoi po której stronie).
useConversationStore.setState({
  activeConversationId: CONVERSATION_ID,
  activeMessages: [
    {
      id: 'msg-1',
      conversationId: CONVERSATION_ID,
      role: 'user',
      content: 'Rozpisz tezę wejścia na rynek niemiecki.',
      messageType: 'text',
      createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-2',
      conversationId: CONVERSATION_ID,
      role: 'ai',
      content:
        'Gotowe — tezę i trzy hipotezy dopisałam do dokumentu po lewej. Rozwinąć sekcję ryzyk regulacyjnych?',
      messageType: 'text',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ],
} as never);

Object.assign(Api, {
  workCanvasListDrafts: async () => [],
  getConversations: async () => [
    {
      id: CONVERSATION_ID,
      title: 'Strategia wejścia na rynek DE',
      updatedAt: new Date().toISOString(),
    },
  ],
  getConversationMessages: async () => [],
  getMessages: async () => [],
});

export default function ChatSplitTeresaRightScreen(): React.ReactElement {
  return (
    <MemoryRouter initialEntries={['/chat?workPanel=1']}>
      <QueryClientProvider client={queryClient}>
        <FeatureFlagsProvider showDevTools={false}>
          <AutoSaveProvider>
            <HelpProvider>
              <V8Provider>
                <OrgProvider>
                  <AccessPolicyProvider>
                    <TrialProvider>
                      <AIProvider>
                        <TeresaVoiceProvider>
                          <div className="h-screen w-screen overflow-hidden bg-c-bg">
                            <UnifiedChatPanel mode="full" showHistoryTrigger showFocusMode />
                          </div>
                        </TeresaVoiceProvider>
                      </AIProvider>
                    </TrialProvider>
                  </AccessPolicyProvider>
                </OrgProvider>
              </V8Provider>
            </HelpProvider>
          </AutoSaveProvider>
        </FeatureFlagsProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
