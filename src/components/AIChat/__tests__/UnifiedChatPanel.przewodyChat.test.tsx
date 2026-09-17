import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  const navigate = vi.fn();
  const clearKickoff = vi.fn();
  const addChatMessage = vi.fn();
  const startStream = vi.fn(async (_prompt: string): Promise<void> => undefined);
  const featureFlags = new Map<string, boolean>();
  const appState: Record<string, unknown> = {
  currentStreamContent: '',
  isBotTyping: false,
  addChatMessage,
  deleteChatMessage: vi.fn(),
  setIsBotTyping: vi.fn(),
  aiFreezeStatus: { isFrozen: false },
  aiConfig: { selectedTier: 'STANDARD', selectedModelId: null, autoMode: false },
  setAIConfig: vi.fn(),
  currentUser: { id: 'user-368', firstName: 'Piotr', role: 'OWNER' },
  currentOrganization: { id: 'org-368', name: 'Day 368' },
  isAuthInitializing: false,
  chatModuleIntent: null,
  chatKickoffMessage: undefined,
  clearChatKickoffMessage: clearKickoff,
  chatOutputTool: 'auto',
  setChatKickoffMessage: vi.fn(),
  setChatOutputTool: vi.fn(),
  };
  const conversationState: Record<string, unknown> = {
  activeConversationId: null,
  activeMessages: [],
  isLoading: false,
  isSidebarOpen: false,
  displayMode: 'full',
  createConversation: vi.fn(async () => ({ id: 'conversation-368' })),
  addMessage: vi.fn(async () => undefined),
  setActiveConversation: vi.fn(),
  fetchConversation: vi.fn(),
  clearActiveChat: vi.fn(),
  truncateFromMessage: vi.fn(),
  toggleSidebar: vi.fn(),
  setDisplayMode: vi.fn(),
  expandToFullScreen: vi.fn(),
  collapseToSplit: vi.fn(),
  draftChatLanguage: 'pl',
  chatLanguageByConversationId: {},
  _activeConversationState: null,
  _activeConversationStateMessage: null,
  notifyModelChange: vi.fn(),
  exportConversation: vi.fn(),
  purgeConversation: vi.fn(),
  teresaEntityContext: null,
  };
  const useAppStoreMock = Object.assign(
    (selector?: (state: typeof appState) => unknown) => (selector ? selector(appState) : appState),
    { getState: () => appState }
  );
  const useConversationStoreMock = Object.assign(
    (selector?: (state: typeof conversationState) => unknown) =>
      selector ? selector(conversationState) : conversationState,
    { getState: () => conversationState }
  );
  return {
    navigate,
    clearKickoff,
    addChatMessage,
    startStream,
    featureFlags,
    appState,
    conversationState,
    useAppStoreMock,
    useConversationStoreMock,
  };
});

vi.mock('@/store/useAppStore', () => ({ useAppStore: harness.useAppStoreMock }));
vi.mock('../../../store/useAppStore', () => ({ useAppStore: harness.useAppStoreMock }));
vi.mock('../../../store/useConversationStore', () => ({
  useConversationStore: harness.useConversationStoreMock,
}));
vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    isEnabled: (id: string) => harness.featureFlags.get(id) ?? false,
  }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => harness.navigate };
});
vi.mock('../../../contexts/TeresaVoiceContext', () => ({
  useTeresaVoiceContext: () => ({
    voiceState: { isSpeaking: false },
    speak: vi.fn(async () => undefined),
    stopSpeaking: vi.fn(),
    autoReadEnabled: false,
    setAutoReadEnabled: vi.fn(),
    updateVoiceSettings: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useAIStream', () => ({
  useAIStream: () => ({
    startStream: harness.startStream,
    stopStream: vi.fn(),
    isStreaming: false,
    streamedContent: '',
    streamedReasoning: '',
    thinkingSteps: [],
    deepThinkingState: null,
    researchProgress: null,
    toolSteps: [],
    researchVisibility: null,
    policyDecision: null,
    policyNotices: [],
    memoryCandidate: null,
    error: null,
  }),
}));
vi.mock('../../../hooks/useUniversalVoice', () => ({
  useUniversalVoice: () => ({
    state: {
      mode: 'idle',
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      transcript: '',
      interimTranscript: '',
      error: null,
      audioLevel: 0,
      recordingDuration: 0,
    },
    settings: {
      autoSpeakResponses: false,
    },
    isSupported: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    speak: vi.fn(async () => undefined),
    stopSpeaking: vi.fn(),
    updateSettings: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useDemoSession', () => ({
  useDemoSession: () => ({
    isDemo: false,
    demoTimeRemainingMs: 0,
    aiInteractionsRemaining: 0,
    aiInteractionsLimit: 0,
    consumeAIInteraction: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useChatActions', () => ({
  useChatActions: () => ({ handleAction: vi.fn() }),
}));
vi.mock('../../../store/useAIActionsStore', () => ({
  useAIActionsStore: (selector: (state: { pendingCount: number }) => unknown) =>
    selector({ pendingCount: 0 }),
}));
vi.mock('../../../store/useArtifactsStore', () => ({
  useArtifactsStore: () => ({ addArtifact: vi.fn(), togglePanel: vi.fn(), exportArtifact: vi.fn() }),
}));
vi.mock('../../../store/useProposalLifecycleStore', () => ({
  useProposalLifecycleStore: () => ({ proposals: [], updateProposal: vi.fn() }),
}));
vi.mock('../EnhancedChatInput', () => ({
  EnhancedChatInput: (props: { onSend: (message: string, attachments?: File[]) => void }) => (
    <div data-testid="chat-input">
      <button
        type="button"
        onClick={() =>
          props.onSend('Describe this image', [
            new File(['png'], 'screen.png', { type: 'image/png' }),
          ])
        }
      >
        send-test-image
      </button>
      <button
        type="button"
        onClick={() =>
          props.onSend('Describe one image', [
            new File(['one'], 'one.png', { type: 'image/png' }),
            new File(['two'], 'two.png', { type: 'image/png' }),
          ])
        }
      >
        send-two-test-images
      </button>
    </div>
  ),
}));
vi.mock('../ChatSlidingPanel', () => ({ ChatSlidingPanel: () => null }));
vi.mock('../MessageRenderer', () => ({ MessageRenderer: () => null }));
vi.mock('../ChatSignalsPanel', () => ({ ChatSignalsPanel: () => null }));
vi.mock('../WorkCanvasDocumentPanel', () => ({ WorkCanvasDocumentPanel: () => null }));
vi.mock('../TeresaTTSPlayer', () => ({ TeresaTTSPlayer: () => null }));
vi.mock('../V8ArtifactRunControl', () => ({ V8ArtifactRunControl: () => null }));
vi.mock('../V8ContextIndicator', () => ({ V8ContextIndicator: () => null }));
vi.mock('../PrivateModeDetails', () => ({ PrivateModeDetails: () => null }));
vi.mock('../OutputToolSelector', () => ({ OutputToolSelector: () => null }));
vi.mock('../ContextBadge', () => ({ ContextBadge: () => null }));
vi.mock('../BranchSelector', () => ({ BranchSelector: () => null }));
vi.mock('../../Chat/ChatSmartSuggestions', () => ({ ChatSmartSuggestions: () => null }));
vi.mock('@/components/MyWork/table/ChatToSchemaPanel', () => ({ ChatToSchemaPanel: () => null }));

import { UnifiedChatPanel } from '../UnifiedChatPanel';
import { Api } from '../../../services/api';

describe('UnifiedChatPanel chat route wiring', () => {
  beforeEach(() => {
    harness.navigate.mockReset();
    harness.clearKickoff.mockReset();
    harness.addChatMessage.mockReset();
    harness.startStream.mockReset();
    harness.startStream.mockResolvedValue(undefined);
    harness.featureFlags.clear();
    harness.appState.chatKickoffMessage = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uploads an enabled image outside document ingest and forwards it in context.images', async () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    const imagePayload = {
      name: 'screen.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,cG5n',
      width: 20,
      height: 10,
      size: 3,
    };
    const imageUpload = vi.spyOn(Api, 'uploadChatImage').mockResolvedValue({
      success: true,
      image: imagePayload,
    });
    const documentUpload = vi.spyOn(Api, 'uploadChatAttachment');

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <UnifiedChatPanel mode="full" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'send-test-image' }));

    await waitFor(() => expect(harness.startStream).toHaveBeenCalled());
    expect(imageUpload).toHaveBeenCalledWith(expect.any(File));
    expect(documentUpload).not.toHaveBeenCalled();
    expect(harness.startStream.mock.calls[0]?.[3]).toEqual(
      expect.objectContaining({
        images: [imagePayload],
        hasAttachments: true,
        attachmentFileNames: ['screen.png'],
      })
    );
  });

  it('never transports more than one image in context.images', async () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    const imageUpload = vi.spyOn(Api, 'uploadChatImage').mockResolvedValue({
      success: true,
      image: {
        name: 'one.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,b25l',
        width: 1,
        height: 1,
        size: 3,
      },
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <UnifiedChatPanel mode="full" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'send-two-test-images' }));

    await waitFor(() => expect(harness.startStream).toHaveBeenCalled());
    expect(imageUpload).toHaveBeenCalledTimes(1);
    expect(harness.startStream.mock.calls[0]?.[3]?.images).toHaveLength(1);
  });

  it('maps a server image error code to localized copy before transport', async () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    vi.spyOn(Api, 'uploadChatImage').mockRejectedValue({
      message: 'Invalid or corrupted image data',
      data: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        error: 'Invalid or corrupted image data',
      },
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <UnifiedChatPanel mode="full" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'send-test-image' }));

    await waitFor(() => expect(harness.startStream).toHaveBeenCalled());
    expect(harness.startStream.mock.calls[0]?.[3]?.failedAttachments).toEqual([
      expect.objectContaining({
        filename: 'screen.png',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        error: expect.not.stringContaining('Invalid or corrupted image data'),
      }),
    ]);
  });

  it('keeps Business Actions hidden with the flag at its default OFF value', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <UnifiedChatPanel mode="full" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('chat-business-button')).not.toBeInTheDocument();
  });

  it('routes Business Actions to the public AI Actions screen when the default-OFF flag is enabled', () => {
    harness.featureFlags.set('chatBusinessActionsNav', true);

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <UnifiedChatPanel mode="full" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /business actions|akcje biznesowe/i }));
    expect(harness.navigate).toHaveBeenCalledWith('/ai-actions');
  });

  it('sends and consumes the store kickoff with the exact props used by the chat route', async () => {
    harness.appState.chatKickoffMessage = 'Przeanalizuj ryzyko dostawcy';

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <UnifiedChatPanel mode="full" />
      </MemoryRouter>
    );

    await waitFor(() => expect(harness.startStream).toHaveBeenCalled());
    expect(harness.startStream.mock.calls[0]?.[0]).toBe('Przeanalizuj ryzyko dostawcy');
    expect(harness.clearKickoff).toHaveBeenCalledTimes(1);
  });

  it('preserves an embedded panel kickoff prop and does not clear the unrelated global handoff', async () => {
    harness.appState.chatKickoffMessage = 'Globalny kickoff';

    render(
      <MemoryRouter initialEntries={['/artifact']}>
        <UnifiedChatPanel mode="split" kickoffMessage="Lokalny kickoff" />
      </MemoryRouter>
    );

    await waitFor(() => expect(harness.startStream).toHaveBeenCalled());
    expect(harness.startStream.mock.calls[0]?.[0]).toBe('Lokalny kickoff');
    expect(harness.clearKickoff).not.toHaveBeenCalled();
  });

  it('keeps MainLayout-style consumption delegated to the provided callback', async () => {
    const onKickoffConsumed = vi.fn();
    harness.appState.chatKickoffMessage = 'Kickoff z MainLayout';

    render(
      <MemoryRouter initialEntries={['/organization']}>
        <UnifiedChatPanel
          mode="split"
          kickoffMessage={undefined}
          onKickoffConsumed={onKickoffConsumed}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(harness.startStream).toHaveBeenCalled());
    expect(harness.startStream.mock.calls[0]?.[0]).toBe('Kickoff z MainLayout');
    expect(onKickoffConsumed).toHaveBeenCalledTimes(1);
    expect(harness.clearKickoff).not.toHaveBeenCalled();
  });

  it('changes the work panel title and accessible label after opening it', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <UnifiedChatPanel mode="full" />
      </MemoryRouter>
    );

    const button = screen.getByTestId('chat-work-panel-button');
    expect(button).toHaveAttribute('title', 'Open work panel');
    expect(button).toHaveAttribute('aria-label', 'Open work panel');

    fireEvent.click(button);

    expect(button).toHaveAttribute('title', 'Close work panel');
    expect(button).toHaveAttribute('aria-label', 'Close work panel');
  });
});
