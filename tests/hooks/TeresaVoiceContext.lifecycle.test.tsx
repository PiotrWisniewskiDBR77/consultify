/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TeresaVoiceProvider, useTeresaVoiceContext } from '../../src/contexts/TeresaVoiceContext';

const { state } = vi.hoisted(() => ({
  state: {
    app: {
      currentUser: { firstName: 'Alex', organizationName: 'Org A', organizationId: 'org-1' },
      currentOrganization: { id: 'org-1', name: 'Org A' },
      currentProjectId: 'project-1',
      currentView: 'MY_WORK',
    },
    conversation: {
      activeConversationId: 'conv-live' as string | null,
      chatLanguageByConversationId: { 'conv-live': 'en' } as Record<string, string>,
      addMessage: vi.fn(),
      createConversation: vi.fn(),
      setActiveConversation: vi.fn(),
      setConversationChatLanguage: vi.fn(),
    },
    pmo: { projectName: 'Project A' },
    i18nLanguage: 'en',
  },
}));

const stopVoiceConversation = vi.fn(async () => undefined);
const useTeresaVoiceMock = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn() },
}));

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: state.i18nLanguage },
      t: (_k: string, fallback?: string) => fallback ?? _k,
    }),
  };
});

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(state.app),
}));

vi.mock('../../src/store/useConversationStore', () => ({
  useConversationStore: (selector?: any) =>
    typeof selector === 'function' ? selector(state.conversation) : state.conversation,
}));

vi.mock('../../src/store/usePMOStore', () => ({
  usePMOStore: () => state.pmo,
}));

vi.mock('../../src/hooks/useTeresaVoice', () => ({
  useTeresaVoice: (options: any) => useTeresaVoiceMock(options),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <TeresaVoiceProvider>{children}</TeresaVoiceProvider>;
}

describe('TeresaVoiceContext lifecycle', () => {
  it('stops active voice when active conversation is cleared', async () => {
    stopVoiceConversation.mockClear();
    useTeresaVoiceMock.mockImplementation((_options: any) => ({
      voiceStatus: 'live',
      voiceError: null,
      voiceAvailable: true,
      isMuted: false,
      toggleMute: vi.fn(),
      startVoiceConversation: vi.fn(async () => undefined),
      stopVoiceConversation,
      sendTextHistory: vi.fn(),
    }));

    const { rerender } = renderHook(() => useTeresaVoiceContext(), { wrapper });
    state.conversation.activeConversationId = null;
    rerender();

    await waitFor(() => expect(stopVoiceConversation).toHaveBeenCalledTimes(1));
  });
});
