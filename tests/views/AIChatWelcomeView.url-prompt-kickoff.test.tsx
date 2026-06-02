/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIChatWelcomeView } from '../../src/views/AIChatWelcomeView';

const setChatKickoffMessageMock = vi.fn();
const clearChatKickoffMessageMock = vi.fn();
const createConversationMock = vi.fn().mockResolvedValue({ id: 'conv-1' });
const addMessageMock = vi.fn();
const setActiveConversationMock = vi.fn();
const setConversationChatLanguageMock = vi.fn();
const useAIStreamStartStreamMock = vi.fn();
const uploadChatAttachmentMock = vi.fn();
const ingestChatUrlAttachmentMock = vi.fn();
const enhancedChatInputPropsRef: { current: any } = { current: null };

const appState: any = {
  currentUser: { firstName: 'Piotr', role: 'ADMIN' },
  currentProjectId: null,
  aiConfig: { textToSpeech: false, privateMode: true },
  currentOrganization: null,
  setCurrentView: vi.fn(),
  isChatCollapsed: false,
  toggleChatCollapse: vi.fn(),
  setAIConfig: vi.fn(),
  setChatKickoffMessage: setChatKickoffMessageMock,
  chatKickoffMessage: null,
  clearChatKickoffMessage: clearChatKickoffMessageMock,
};

const conversationState: any = {
  activeConversationId: null,
  activeMessages: [],
  isLoading: false,
  isSidebarOpen: false,
  workspaceContext: null,
  createConversation: createConversationMock,
  addMessage: addMessageMock,
  setActiveConversation: setActiveConversationMock,
  clearActiveChat: vi.fn(),
  truncateFromMessage: vi.fn(),
  generateTitle: vi.fn(),
  draftChatLanguage: null,
  chatLanguageByConversationId: {},
  setConversationChatLanguage: setConversationChatLanguageMock,
  conversations: [],
};

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
      i18n: { language: 'en' },
    }),
  };
});

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => appState,
}));

vi.mock('../../src/store/useConversationStore', () => ({
  useConversationStore: () => conversationState,
}));

vi.mock('../../src/store/usePMOStore', () => ({
  usePMOStore: () => ({ projectName: 'Project' }),
}));

vi.mock('../../src/contexts/AIContext', () => ({
  useAIContext: () => ({ pmoContext: {}, globalContext: {}, screenContext: {} }),
}));

vi.mock('../../src/hooks/useAIStream', () => ({
  useAIStream: () => ({
    isStreaming: false,
    streamedContent: '',
    startStream: useAIStreamStartStreamMock,
    thinkingSteps: [],
    abortStream: vi.fn(),
    retryLastStream: vi.fn(),
    lastError: null,
    clearLastError: vi.fn(),
    researchProgress: null,
    streamStartedAt: null,
    streamCompletedSignal: 0,
    retryInfo: null,
  }),
}));

vi.mock('../../src/services/api', () => ({
  Api: {
    uploadChatAttachment: uploadChatAttachmentMock,
    ingestChatUrlAttachment: ingestChatUrlAttachmentMock,
  },
}));

vi.mock('../../src/hooks/useUniversalVoice', () => ({
  useUniversalVoice: () => ({
    state: { isSpeaking: false, isListening: false },
    startListening: vi.fn(),
    stopListening: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    isSupported: true,
    endConversation: vi.fn(),
  }),
}));

vi.mock('../../src/contexts/TeresaVoiceContext', () => ({
  useTeresaVoiceContext: () => ({
    isConnected: false,
    isConnecting: false,
    isListening: false,
    transcript: '',
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendTextMessage: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useActionHandler', () => ({
  ACTION_TYPES: {},
  useActionHandler: () => ({
    executeAction: vi.fn(),
    confirmAction: vi.fn(),
    pendingActions: [],
    isExecuting: false,
  }),
}));

vi.mock('../../src/components/AIChat/ChatExportModal', () => ({
  ChatExportModal: () => null,
}));
vi.mock('../../src/components/AIChat/ChatSlidingPanel', () => ({
  ChatSlidingPanel: () => null,
}));
vi.mock('../../src/components/AIChat/CitationList', () => ({
  CitationList: () => null,
}));
vi.mock('../../src/components/AIChat/EnhancedChatInput', () => ({
  EnhancedChatInput: (props: any) => {
    enhancedChatInputPropsRef.current = props;
    return null;
  },
}));
vi.mock('../../src/components/AIChat/Messages/MessageActions', () => ({
  MessageActions: () => null,
}));
vi.mock('../../src/components/AIChat/Messages/ThinkingBlock', () => ({
  ThinkingBlock: () => null,
}));
vi.mock('../../src/components/AIChat/OutputToolSelector', () => ({
  OutputToolSelector: () => null,
}));
vi.mock('../../src/components/AIChat/ResearchClarification', () => ({
  ResearchClarification: () => null,
}));
vi.mock('../../src/components/AIChat/ResearchProgress', () => ({
  ResearchProgress: () => null,
}));
vi.mock('../../src/components/AIChat/ResponseActions', () => ({
  ResponseActions: () => null,
}));
vi.mock('../../src/components/AIChat/SmartSuggestions', () => ({
  SmartSuggestions: () => null,
}));
vi.mock('../../src/components/AIChat/TeresaProposalCard', () => ({
  TeresaProposalCard: () => null,
}));
vi.mock('../../src/components/AIChat/ThinkingStatusLine', () => ({
  ThinkingStatusLine: () => null,
}));
vi.mock('../../src/components/AIChat/TTSIndicator', () => ({
  TTSIndicator: () => null,
}));
vi.mock('../../src/components/AIChat/V8ArtifactRunControl', () => ({
  V8ArtifactRunControl: () => null,
}));
vi.mock('../../src/components/AIChat/V8ContextIndicator', () => ({
  V8ContextIndicator: () => null,
}));

describe('AIChatWelcomeView URL prompt kickoff', () => {
  const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    appState.chatKickoffMessage = null;
    conversationState.activeMessages = [];
    enhancedChatInputPropsRef.current = null;
    uploadChatAttachmentMock.mockResolvedValue({
      success: true,
      docId: 'file-doc-1',
      extractionStatus: 'extracted',
    });
    ingestChatUrlAttachmentMock.mockResolvedValue({
      success: true,
      docId: 'url-doc-1',
      filename: 'Example URL',
      sourceUrl: 'https://example.com/context',
      mimeType: 'text/html',
    });
  });

  it('promotes ?prompt query to kickoff message and clears query', async () => {
    render(
      <MemoryRouter initialEntries={['/chat?prompt=Review%20budget&foo=1']}>
        <Routes>
          <Route
            path="/chat"
            element={
              <>
                <AIChatWelcomeView />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(setChatKickoffMessageMock).toHaveBeenCalledWith('Review budget');
    });
    expect(
      await screen.findByTestId('location-probe')
    ).toHaveTextContent('/chat?foo=1');
  });

  it('ingests URL attachments and passes attachmentDocIds to stream context', async () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route path="/chat" element={<AIChatWelcomeView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(enhancedChatInputPropsRef.current).toBeTruthy();
    await enhancedChatInputPropsRef.current.onSend('hello with url', [
      { kind: 'url', url: 'https://example.com/context', title: 'Context page' },
    ]);

    await waitFor(() => expect(ingestChatUrlAttachmentMock).toHaveBeenCalled());
    await waitFor(() => expect(useAIStreamStartStreamMock).toHaveBeenCalled());

    const call = useAIStreamStartStreamMock.mock.calls.at(-1);
    const contextArg = call?.[3] ?? {};
    expect(contextArg).toEqual(
      expect.objectContaining({
        attachmentDocIds: expect.arrayContaining(['url-doc-1']),
        attachments: expect.arrayContaining([expect.objectContaining({ docId: 'url-doc-1' })]),
      })
    );
  });
});
