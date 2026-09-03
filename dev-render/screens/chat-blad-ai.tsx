/**
 * Dev-render: Czat w STANIE BŁĘDU DOSTAWCY AI (CHAT-OWN-016).
 *
 * URL: ?screen=chat-blad-ai&stan=blad-ai[&wariant=przed|po][&kod=AI_RATE_LIMIT]
 *      [&lang=pl|en][&theme=light|dark]
 *
 * Montujemy REALNY `<UnifiedChatPanel mode="full">` — ten sam komponent, który
 * renderuje `/chat` — i wkładamy do rozmowy dokładnie taką wiadomość, jaką
 * produkuje ścieżka błędu. Przyrząd NIE rysuje własnego komunikatu: cały widok
 * powstaje w `MessageRenderer` → `AiProviderErrorNotice` na podstawie
 * `metadata.aiProviderError` (wariant PO) albo samego tekstu (wariant PRZED).
 *
 * `wariant=przed` odtwarza stan sprzed naprawy DOSŁOWNIE. Treść skopiowana
 * z `git show c800e48860~1:src/components/AIChat/teresaRuntimeCopy.ts` — czyli
 * z kodu, który wtedy działał; nie jest wymyślona na potrzeby zrzutu. Rola
 * użytkownika w harnessie to OWNER, więc PRZED pokazuje to, co realnie widział
 * właściciel: blok diagnostyki administratora wklejony w rozmowę.
 *
 * `wariant=po` (domyślny) idzie normalną drogą produkcyjną: metadane wiadomości
 * niosą KOD błędu, a zdanie bierze się z `aiChat.providerError.*`.
 */
import React from 'react';

import { MemoryRouter } from 'react-router-dom';

import { QueryClientProvider } from '@tanstack/react-query';

import { UnifiedChatPanel } from '../../src/components/AIChat/UnifiedChatPanel';
import { getAiErrorLine } from '../../src/components/AIChat/aiProviderErrorCopy';
import { AccessPolicyProvider } from '../../src/contexts/AccessPolicyContext';
import { AIProvider } from '../../src/contexts/AIContext';
import { AutoSaveProvider } from '../../src/contexts/AutoSaveContext';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { HelpProvider } from '../../src/contexts/HelpContext';
import { OrgProvider } from '../../src/contexts/OrgContext';
import { TeresaVoiceProvider } from '../../src/contexts/TeresaVoiceContext';
import { TrialProvider } from '../../src/contexts/TrialContext';
import i18n from '../../src/i18n';
import { createAppQueryClient } from '../../src/lib/createAppQueryClient';
import { V8Provider } from '../../src/providers/V8Provider';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { useConversationStore } from '../../src/store/useConversationStore';

const CONVERSATION_ID = 'conv-blad-ai-0001';
const params = new URLSearchParams(window.location.search);
const STAN = params.get('stan') || 'blad-ai';
const WARIANT = (params.get('wariant') || 'po').toLowerCase();

/**
 * Cztery przypadki, o które chodzi w uwadze właściciela: limit dostawcy, brak
 * konfiguracji, przekroczony czas i przerwany strumień. Jeden zrzut pokazuje
 * wszystkie cztery obok siebie — pojedynczy kadr nie udowodniłby, że każdy
 * przypadek dostał WŁASNE zdanie, a nie jeden ogólnik.
 */
const PRZYPADKI = ['AI_RATE_LIMIT', 'AI_CONFIG', 'AI_TIMEOUT', 'AI_STREAM_INTERRUPTED'] as const;

/**
 * DOSŁOWNY tekst sprzed naprawy — `getTeresaStartFailureMessage` z commita
 * poprzedzającego c800e48860, dla `language='pl'` i roli OWNER (właściciel jest
 * uprzywilejowany, więc dostawał `adminDiagnostic` wprost w rozmowie).
 * Diagnostyka to wynik `formatTeresaAdminDiagnostic` na realnym błędzie
 * dostawcy, tak jak trafiał tam z ramki SSE `{ error: <surowa treść> }`.
 */
const PRZED_TEKST: Record<string, string> = {
  AI_RATE_LIMIT:
    '⚠️ Teresa jest chwilowo niedostepna. Sprobuj ponownie za chwile. Jesli problem wraca, rozpocznij nowa rozmowe lub odswiez widok.\n\n' +
    '🔧 Szczegoly (admin): HTTP 429 · AI_STREAM_ERROR · Rate limit exceeded for model openai/gpt-4o-mini on openrouter.ai\n' +
    'Sprawdz /api/llm/health/detailed oraz logi serwera.',
  AI_CONFIG:
    '⚠️ Teresa jest chwilowo niedostepna. Sprobuj ponownie za chwile. Jesli problem wraca, rozpocznij nowa rozmowe lub odswiez widok.\n\n' +
    '🔧 Szczegoly (admin): HTTP 500 · NO_LLM_PROVIDER · No LLM provider configured on the backend. Set OPENROUTER_API_KEY or configure OpenRouter in llm_providers.\n' +
    'Sprawdz /api/llm/health/detailed oraz logi serwera.',
  AI_TIMEOUT:
    '⚠️ Teresa jest chwilowo niedostepna. Sprobuj ponownie za chwile. Jesli problem wraca, rozpocznij nowa rozmowe lub odswiez widok.\n\n' +
    '🔧 Szczegoly (admin): HTTP 502 · AI_STREAM_ERROR · Request to https://openrouter.ai/api/v1/chat/completions timed out after 60000ms\n' +
    'Sprawdz /api/llm/health/detailed oraz logi serwera.',
  AI_STREAM_INTERRUPTED:
    '⚠️ Teresa jest chwilowo niedostepna. Sprobuj ponownie za chwile. Jesli problem wraca, rozpocznij nowa rozmowe lub odswiez widok.\n\n' +
    '🔧 Szczegoly (admin): HTTP 502 · AI_STREAM_ERROR · socket hang up (ECONNRESET) while reading Circuit [openrouter] stream\n' +
    'Sprawdz /api/llm/health/detailed oraz logi serwera.',
};

const PYTANIA: Record<string, string> = {
  AI_RATE_LIMIT: 'Rozpisz tezę wejścia na rynek niemiecki.',
  AI_CONFIG: 'Podsumuj wyniki oceny dojrzałości dla zarządu.',
  AI_TIMEOUT: 'Zbuduj model finansowy dla wariantu B.',
  AI_STREAM_INTERRUPTED: 'Dokończ analizę ryzyk regulacyjnych.',
};

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

if (STAN === 'blad-ai') {
  const teraz = Date.now();
  const wiadomosci: unknown[] = [];
  PRZYPADKI.forEach((kod, i) => {
    wiadomosci.push({
      id: `msg-user-${i}`,
      conversationId: CONVERSATION_ID,
      role: 'user',
      content: PYTANIA[kod],
      messageType: 'text',
      createdAt: new Date(teraz - (PRZYPADKI.length - i) * 120000).toISOString(),
    });
    wiadomosci.push({
      id: `msg-err-${i}`,
      conversationId: CONVERSATION_ID,
      role: 'ai',
      messageType: 'text',
      createdAt: new Date(teraz - (PRZYPADKI.length - i) * 120000 + 3000).toISOString(),
      ...(WARIANT === 'przed'
        ? { content: PRZED_TEKST[kod] }
        : {
            content: `⚠️ ${getAiErrorLine(
              i18n.t.bind(i18n) as (k: string, d?: string) => string,
              { errorCode: kod }
            )}`,
            metadata: { aiProviderError: { code: kod } },
          }),
    });
  });
  useConversationStore.setState({
    activeConversationId: CONVERSATION_ID,
    activeMessages: wiadomosci,
  } as never);
}

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

export default function ChatBladAiScreen(): React.ReactElement {
  return (
    <MemoryRouter initialEntries={['/chat']}>
      <QueryClientProvider client={createAppQueryClient()}>
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
