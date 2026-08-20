import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeresaVoiceProvider } from '../TeresaVoiceContext';

const state = vi.hoisted(() => ({
  currentUser: null as null | { id: string; isAuthenticated: boolean },
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
      currentView: 'login',
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

describe('TeresaVoiceProvider authenticated config gate', () => {
  beforeEach(() => {
    state.currentUser = null;
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not request the authenticated voice config on login and loads it after login', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, unavailableReason: 'disabled' }),
    } as Response);

    const view = render(
      <TeresaVoiceProvider>
        <div>child</div>
      </TeresaVoiceProvider>
    );

    await act(async () => undefined);
    expect(fetchMock).not.toHaveBeenCalled();

    state.currentUser = { id: 'user-1', isAuthenticated: true };
    view.rerender(
      <TeresaVoiceProvider>
        <div>child</div>
      </TeresaVoiceProvider>
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v10/teresa/voice-config',
      expect.objectContaining({ credentials: 'include' })
    );
  });
});
