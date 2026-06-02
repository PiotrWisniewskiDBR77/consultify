/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TeresaVoiceProvider, useTeresaVoiceContext } from '../../src/contexts/TeresaVoiceContext';

const { state, createConversationMock, setActiveConversationMock, setConversationChatLanguageMock } =
  vi.hoisted(() => ({
    createConversationMock: vi.fn(),
    setActiveConversationMock: vi.fn(),
    setConversationChatLanguageMock: vi.fn(),
    state: {
      app: {
        currentUser: { firstName: 'Alex', organizationName: 'Org A', organizationId: 'org-1' },
        currentOrganization: { id: 'org-1', name: 'Org A' },
        currentProjectId: 'project-1',
        currentView: 'MY_WORK',
      },
      conversation: {
        activeConversationId: null as string | null,
        chatLanguageByConversationId: {} as Record<string, string>,
        addMessage: vi.fn(),
        createConversation: vi.fn(),
        setActiveConversation: vi.fn(),
        setConversationChatLanguage: vi.fn(),
      },
      pmo: { projectName: 'Project A' },
      i18nLanguage: 'en',
    },
  }));

const toastErrorMock = vi.fn();
const useTeresaVoiceMock = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: {
    error: toastErrorMock,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: state.i18nLanguage },
    t: (_k: string, fallback?: string) => fallback ?? _k,
  }),
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(state.app),
}));

vi.mock('../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: any) => selector(state.conversation),
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

describe('TeresaVoiceContext', () => {
  it('derives voice language from active conversation language map', async () => {
    const stopVoiceConversation = vi.fn(async () => undefined);
    const startVoiceConversation = vi.fn(async () => undefined);
    state.conversation.activeConversationId = 'conv-1';
    state.conversation.chatLanguageByConversationId = { 'conv-1': 'de' };
    state.conversation.createConversation = createConversationMock;
    state.conversation.setActiveConversation = setActiveConversationMock;
    state.conversation.setConversationChatLanguage = setConversationChatLanguageMock;
    useTeresaVoiceMock.mockImplementation((options: any) => ({
      voiceStatus: 'idle',
      voiceError: null,
      voiceAvailable: true,
      isMuted: false,
      toggleMute: vi.fn(),
      startVoiceConversation,
      stopVoiceConversation,
      sendTextHistory: vi.fn(),
      __language: options.language,
    }));

    renderHook(() => useTeresaVoiceContext(), { wrapper });

    await waitFor(() =>
      expect(useTeresaVoiceMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'de' })
      )
    );
  });

  it('shows Teresa failure toast and does not start voice when conversation creation fails', async () => {
    const startVoiceConversation = vi.fn(async () => undefined);
    state.conversation.activeConversationId = null;
    state.conversation.chatLanguageByConversationId = {};
    state.conversation.createConversation = vi.fn(async () => {
      throw new Error('create failed');
    });
    useTeresaVoiceMock.mockImplementation((_options: any) => ({
      voiceStatus: 'idle',
      voiceError: null,
      voiceAvailable: true,
      isMuted: false,
      toggleMute: vi.fn(),
      startVoiceConversation,
      stopVoiceConversation: vi.fn(async () => undefined),
      sendTextHistory: vi.fn(),
    }));

    const { result } = renderHook(() => useTeresaVoiceContext(), { wrapper });
    await act(async () => {
      await result.current.handleVoiceToggle();
    });

    expect(startVoiceConversation).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it('stops active Teresa voice session when active conversation is cleared', async () => {
    const stopVoiceConversation = vi.fn(async () => undefined);
    state.conversation.activeConversationId = 'conv-live';
    state.conversation.chatLanguageByConversationId = { 'conv-live': 'en' };
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
