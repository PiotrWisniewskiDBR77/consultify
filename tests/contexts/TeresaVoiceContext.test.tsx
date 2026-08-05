/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TeresaVoiceProvider, useTeresaVoiceContext } from '../../src/contexts/TeresaVoiceContext';

// `toastErrorMock` and `useTeresaVoiceMock` MUST live inside this same
// vi.hoisted() block, not as plain top-level `const`s below it: vitest
// hoists every `vi.mock(...)` call (further down this file) above ALL
// top-level code, imports included. A `vi.mock` factory that closes over a
// plain `const` declared later in file order throws
// "Cannot access '<name>' before initialization" the moment the module is
// evaluated — which is exactly what made this whole suite fail to even
// collect (0 tests recorded, not an assertion failure) before this fix.
const {
  state,
  createConversationMock,
  setActiveConversationMock,
  setConversationChatLanguageMock,
  toastErrorMock,
  useTeresaVoiceMock,
} = vi.hoisted(() => ({
  createConversationMock: vi.fn(),
  setActiveConversationMock: vi.fn(),
  setConversationChatLanguageMock: vi.fn(),
  toastErrorMock: vi.fn(),
  useTeresaVoiceMock: vi.fn(),
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

vi.mock('react-hot-toast', () => ({
  default: {
    error: toastErrorMock,
  },
}));

// This file's own `vi.mock('react-i18next', ...)` completely replaces the
// global one in tests/setup.ts (a local factory always wins for the file
// that declares it — it doesn't merge with the global mock). That's
// intentional here (this suite needs `i18n.language` driven by mutable
// `state.i18nLanguage`, which the global mock doesn't support), but it must
// still re-provide every export the global mock did that real, unmocked
// code transitively needs: `TeresaVoiceContext.tsx` imports
// `readPreferredChatLanguage` from `src/utils/chatLanguagePreference.ts`,
// which imports the REAL `src/i18n.ts` (not mocked/mockable — it's the
// actual i18next singleton setup), which calls
// `.use(initReactI18next)` at module-load time. Without `initReactI18next`
// here, that side-effecting import chain throws before a single test can
// even be collected (see the pre-fix failure: "No initReactI18next export
// is defined on the react-i18next mock").
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: state.i18nLanguage },
    t: (_k: string, fallback?: string) => fallback ?? _k,
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(state.app),
}));

// `TeresaVoiceProvider` calls `useConversationStore()` with NO selector
// (destructuring the whole store state directly — real Zustand hooks
// support that, returning the entire state) rather than
// `useConversationStore((s) => ...)`. A mock that unconditionally calls
// `selector(state.conversation)` throws "selector is not a function" the
// instant `selector` is `undefined`, which is exactly what made every test
// in this file fail once the file could actually be collected (see the two
// fixes above this one). This mirrors the `typeof selector === 'function'
// ? selector(state) : state` pattern already used elsewhere in this repo's
// tests (e.g. Sidebar.test.tsx) for the same real-Zustand no-selector call.
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
