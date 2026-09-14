/**
 * D1 — telemetria głosu milczy, gdy głosu nie ma.
 *
 * Broni zmierzonego defektu: wejście na bank Realizacji / Wywiad → Insights
 * (konto OWNER DBR77) zostawiało w konsoli `403` z
 * `POST /api/v10/teresa/voice-event`, bo klient odsyłał serwerowi jego własną
 * odpowiedź `enabled:false` sprzed milisekundy.
 *
 * Test patrzy na RUCH SIECIOWY, nie na stan komponentu: gdy `voice-config`
 * mówi `enabled:false`, na tych ekranach nie może paść ANI JEDEN POST — bo
 * tylko brak zapytania gwarantuje brak odmowy i brak wpisu w konsoli,
 * niezależnie od tego, która bramka globalna odmawia.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeresaVoiceProvider, useTeresaVoiceContext } from '../TeresaVoiceContext';

const state = vi.hoisted(() => ({
  currentUser: { id: 'user-1', isAuthenticated: true } as null | {
    id: string;
    isAuthenticated: boolean;
  },
}));

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));
vi.mock('../../hooks/useTeresaVoice', () => ({
  useTeresaVoice: () => ({
    voiceStatus: 'idle',
    voiceError: null,
    voiceAvailable: false,
    voiceUnavailableReason: null,
    isMuted: true,
    toggleMute: vi.fn(),
    startVoiceConversation: vi.fn(),
    stopVoiceConversation: vi.fn(),
    sendTextHistory: vi.fn(),
  }),
}));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: (selector: (value: Record<string, unknown>) => unknown) =>
    selector({
      currentUser: state.currentUser,
      currentOrganization: null,
      currentProjectId: null,
      currentView: 'execution',
    }),
}));
vi.mock('../../store/useConversationStore', () => ({
  useConversationStore: () => ({
    activeConversationId: null,
    addMessage: vi.fn(),
    createConversation: vi.fn(),
    setActiveConversation: vi.fn(),
    setConversationChatLanguage: vi.fn(),
    chatLanguageByConversationId: {},
  }),
}));
vi.mock('../../store/usePMOStore', () => ({ usePMOStore: () => ({ projectName: null }) }));
vi.mock('../../utils/chatLanguagePreference', () => ({
  readPreferredChatLanguage: () => null,
}));
vi.mock('../../utils/teresaVoiceInstruction', () => ({
  buildTeresaVoiceSystemInstruction: () => 'system instruction',
}));
vi.mock('../../components/AIChat/teresaRuntimeCopy', () => ({
  getTeresaStartFailureMessage: () => 'failed',
}));

const VOICE_EVENT_PATH = '/api/v10/teresa/voice-event';
const VOICE_CONFIG_PATH = '/api/v10/teresa/voice-config';

/**
 * Odpowiednik mikrofonu w powłoce czatu: na ekranie bez głosu kliknięcie i tak
 * wchodzi w gałąź `voice_unavailable`. To najtwardszy przypadek bramki —
 * użytkownik AKTYWNIE prosi o głos tam, gdzie go nie ma.
 */
const MicProbe: React.FC = () => {
  const { handleVoiceToggle } = useTeresaVoiceContext();
  return (
    <button type="button" onClick={() => void handleVoiceToggle()}>
      mic
    </button>
  );
};

const voiceEventCalls = (fetchMock: ReturnType<typeof vi.mocked<typeof fetch>>) =>
  fetchMock.mock.calls.filter((call) => call[0] === VOICE_EVENT_PATH);

const renderProvider = async () => {
  const view = render(
    <TeresaVoiceProvider>
      <MicProbe />
    </TeresaVoiceProvider>
  );
  await act(async () => undefined);
  return view;
};

describe('TeresaVoiceProvider — bramka telemetrii głosu', () => {
  beforeEach(() => {
    state.currentUser = { id: 'user-1', isAuthenticated: true };
    localStorage.setItem('token', 'test-token');
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('nie wysyła ŻADNEGO zdarzenia, gdy serwer zgłasza głos jako niedostępny', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, unavailableReason: 'voice_disabled_for_org' }),
    } as Response);

    await renderProvider();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(VOICE_CONFIG_PATH, expect.anything());
    });
    await act(async () => undefined);

    expect(voiceEventCalls(fetchMock)).toHaveLength(0);

    // Nawet kliknięcie mikrofonu na takim ekranie nie może nic wysłać.
    await act(async () => {
      screen.getByText('mic').click();
    });
    expect(voiceEventCalls(fetchMock)).toHaveLength(0);
  });

  it('wysyła voice_config_loaded, gdy serwer potwierdzi włączony głos', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((async (input: RequestInfo | URL) => {
      if (input === VOICE_CONFIG_PATH) {
        return {
          ok: true,
          json: async () => ({
            enabled: true,
            session: { clientToken: 'client-token' },
            voiceName: 'Kore',
          }),
        } as Response;
      }
      return { ok: true, status: 202, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch);

    await renderProvider();

    await waitFor(() => {
      expect(voiceEventCalls(fetchMock)).toHaveLength(1);
    });

    const [, init] = voiceEventCalls(fetchMock)[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('voice_config_loaded');
  });

  it('zamyka telemetrię z powrotem, gdy config przestaje się wczytywać', async () => {
    // Bramka jest stanem MODUŁU, więc musi umieć wrócić do „nie wolno". Bez
    // tego sesja, w której głos raz był włączony, dalej dobijałaby się do
    // kanału, który właśnie zawiódł — i to jest dokładnie ten ruch, który
    // zostawiał 403 w konsoli.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((async (input: RequestInfo | URL) => {
      if (input === VOICE_CONFIG_PATH) {
        return {
          ok: true,
          json: async () => ({ enabled: true, session: { clientToken: 'client-token' } }),
        } as Response;
      }
      return { ok: true, status: 202, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch);

    const view = await renderProvider();
    await waitFor(() => {
      expect(voiceEventCalls(fetchMock).length).toBeGreaterThan(0);
    });

    // Teraz config przestaje odpowiadać. Efekt configu wisi na fladze
    // uwierzytelnienia, więc przeładowanie sesji (wylogowanie → zalogowanie)
    // jest jedyną drogą, którą klient realnie przechodzi ponownie przez
    // `voice-config` — i tą drogą tu idziemy.
    fetchMock.mockRejectedValue(new Error('network down'));
    const rerenderProvider = async () => {
      await act(async () => {
        view.rerender(
          <TeresaVoiceProvider>
            <MicProbe />
          </TeresaVoiceProvider>
        );
      });
    };
    state.currentUser = null;
    await rerenderProvider();
    state.currentUser = { id: 'user-1', isAuthenticated: true };
    await rerenderProvider();
    await act(async () => undefined);
    const afterFailure = voiceEventCalls(fetchMock).length;

    // Mikrofon po awarii configu musi milczeć — bramka wróciła do „nie wolno".
    await act(async () => {
      screen.getByText('mic').click();
    });
    await act(async () => undefined);

    expect(voiceEventCalls(fetchMock)).toHaveLength(afterFailure);
  });
});
