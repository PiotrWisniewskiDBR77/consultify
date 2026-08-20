/** @vitest-environment jsdom */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let authState: Record<string, any>;

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: Record<string, any>) => unknown) => selector(authState),
}));
vi.mock('../../src/store/useConversationStore', () => ({
  useConversationStore: () => ({
    activeConversationId: null,
    addMessage: vi.fn(),
    createConversation: vi.fn(),
    setActiveConversation: vi.fn(),
    setConversationChatLanguage: vi.fn(),
    chatLanguageByConversationId: {},
  }),
}));
vi.mock('../../src/store/usePMOStore', () => ({ usePMOStore: () => ({ projectName: null }) }));
vi.mock('../../src/hooks/useTeresaVoice', () => ({
  useTeresaVoice: () => ({
    voiceStatus: 'idle',
    voiceError: null,
    voiceAvailable: false,
    voiceUnavailableReason: 'disabled',
    isMuted: true,
    toggleMute: vi.fn(),
    startVoiceConversation: vi.fn(),
    stopVoiceConversation: vi.fn(),
    sendTextHistory: vi.fn(),
  }),
}));
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: 'pl' },
      t: (_key: string, fallback: string) => fallback,
    }),
  };
});

import { TeresaVoiceProvider } from '../../src/contexts/TeresaVoiceContext';

describe('TeresaVoiceProvider auth boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authState = {
      isAuthInitializing: false,
      currentUser: null,
      currentOrganization: null,
      currentProjectId: null,
      currentView: 'LOGIN',
    };
    vi.stubGlobal('fetch', vi.fn());
  });

  it('makes zero authenticated voice calls on public auth routes', async () => {
    render(<TeresaVoiceProvider><div>login</div></TeresaVoiceProvider>);
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('loads config after auth hydration', async () => {
    authState.currentUser = { isAuthenticated: true, organizationId: 'org-1' };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, unavailableReason: 'disabled' }),
    } as Response);
    render(<TeresaVoiceProvider><div>workspace</div></TeresaVoiceProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/v10/teresa/voice-config',
      expect.objectContaining({ credentials: 'include' })
    ));
  });
});
