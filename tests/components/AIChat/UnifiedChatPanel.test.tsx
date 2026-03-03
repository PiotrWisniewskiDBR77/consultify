import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Mocks (stateful, but scoped to this test file)
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  trackFunnelEventMock: vi.fn(),
  apiMock: {
    agentAuditAcceptRun: vi.fn(),
    agentAuditListAgents: vi.fn(),
    agentAuditReview: vi.fn(),
    agentAuditSuggest: vi.fn(),
    aiFeedback: vi.fn(),
    chatConfirm: vi.fn(),
    createMyIdea: vi.fn(),
    deepThinkingEvent: vi.fn(),
    saveDeepThinkingDecision: vi.fn(),
    uploadChatAttachment: vi.fn(),
  },
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: h.trackFunnelEventMock,
}));

vi.mock('../../../src/services/api', () => ({
  Api: h.apiMock,
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const addChatMessageMock = vi.fn();
const deleteChatMessageMock = vi.fn();
const setIsBotTypingMock = vi.fn();
const setAIConfigMock = vi.fn();
const setCurrentViewMock = vi.fn();

let appStoreState: any = {
  currentStreamContent: '',
  isBotTyping: false,
  addChatMessage: addChatMessageMock,
  deleteChatMessage: deleteChatMessageMock,
  setIsBotTyping: setIsBotTypingMock,
  aiFreezeStatus: { isFrozen: false },
  aiConfig: {
    deepResearch: false,
    webSearch: false,
    showReasoning: false,
    marketResearch: false,
    textToSpeech: false,
    responseStyle: 'normal',
  },
  setAIConfig: setAIConfigMock,
  setCurrentView: setCurrentViewMock,
};

const useAppStoreMock: any = () => appStoreState;
useAppStoreMock.getState = () => appStoreState;

vi.doMock('../../../src/store/useAppStore', () => ({
  useAppStore: useAppStoreMock,
}));

const createConversationMock = vi.fn();
const addMessageToConversationMock = vi.fn();
const setActiveConversationMock = vi.fn();
const fetchConversationMock = vi.fn();
const clearActiveChatMock = vi.fn();
const truncateFromMessageMock = vi.fn();
const toggleSidebarMock = vi.fn();
const expandToFullScreenMock = vi.fn();
const collapseToSplitMock = vi.fn();

let conversationStoreState: any = {
  activeConversationId: null,
  activeMessages: [],
  isLoading: false,
  isSidebarOpen: false,
  displayMode: 'full',
  createConversation: createConversationMock,
  addMessage: addMessageToConversationMock,
  setActiveConversation: setActiveConversationMock,
  fetchConversation: fetchConversationMock,
  clearActiveChat: clearActiveChatMock,
  truncateFromMessage: truncateFromMessageMock,
  toggleSidebar: toggleSidebarMock,
  setDisplayMode: vi.fn(),
  expandToFullScreen: expandToFullScreenMock,
  collapseToSplit: collapseToSplitMock,
  draftChatLanguage: null,
  chatLanguageByConversationId: {},
};

const useConversationStoreMock: any = () => conversationStoreState;
useConversationStoreMock.getState = () => conversationStoreState;

vi.doMock('../../../src/store/useConversationStore', () => ({
  useConversationStore: useConversationStoreMock,
}));

const addArtifactMock = vi.fn();
const toggleArtifactsPanelMock = vi.fn();
const exportArtifactMock = vi.fn();
vi.doMock('../../../src/store/useArtifactsStore', () => ({
  useArtifactsStore: () => ({
    addArtifact: addArtifactMock,
    togglePanel: toggleArtifactsPanelMock,
    exportArtifact: exportArtifactMock,
  }),
}));

let pendingActionsCountState = 0;
vi.doMock('../../../src/store/useAIActionsStore', () => ({
  useAIActionsStore: (selector: any) => selector({ pendingCount: pendingActionsCountState }),
}));

const speakMock = vi.fn(async () => undefined);
const stopSpeakingMock = vi.fn();
const updateVoiceSettingsMock = vi.fn();
let voiceStateState: any = { isSpeaking: false, isListening: false };
let ttsSupportedState = true;

vi.doMock('../../../src/hooks/useUniversalVoice', () => ({
  useUniversalVoice: () => ({
    speak: speakMock,
    stopSpeaking: stopSpeakingMock,
    state: voiceStateState,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    settings: {},
    updateSettings: updateVoiceSettingsMock,
    isSupported: ttsSupportedState,
  }),
}));

let demoState: any = {
  isDemo: false,
  timeRemainingMs: 1_000_000,
  aiInteractionsRemaining: 100,
  aiInteractionsLimit: 100,
  consumeAIInteraction: vi.fn(),
};

vi.doMock('../../../src/hooks/useDemoSession', () => ({
  useDemoSession: () => demoState,
}));

const startStreamMock = vi.fn();
const abortStreamMock = vi.fn(() => false);
const retryLastStreamMock = vi.fn();
const clearLastErrorMock = vi.fn();

let aiStreamOptionsCaptured: any = null;
let aiStreamState: any = {
  abortStream: abortStreamMock,
  retryLastStream: retryLastStreamMock,
  lastError: null,
  clearLastError: clearLastErrorMock,
  isStreaming: false,
  streamedContent: '',
  researchProgress: null,
  researchVisibility: 'hidden',
  deepThinkingState: null,
  deepThinkingHint: null,
  interimInsight: null,
  agentAuditState: null,
  agentAuditVerdict: null,
  agentReviewProgressByAgentId: {},
  agentSourcesByAgentId: {},
  retryInfo: null,
  streamStartedAt: null,
  streamCompletedSignal: 0,
};

vi.doMock('../../../src/hooks/useAIStream', () => ({
  useAIStream: (options: any) => {
    aiStreamOptionsCaptured = options;
    return { startStream: startStreamMock, ...aiStreamState };
  },
}));

vi.doMock('../../../src/components/AIChat/ChatSlidingPanel', () => ({
  ChatSlidingPanel: ({
    onNewChat,
    onSelectConversation,
  }: {
    onNewChat: () => void;
    onSelectConversation: (id: string) => void;
  }) => (
    <div data-testid="chat-sliding-panel">
      <button onClick={onNewChat}>panel:new</button>
      <button onClick={() => onSelectConversation('conv-from-panel')}>panel:select</button>
    </div>
  ),
}));

vi.doMock('../../../src/components/AIChat/ContextBadge', () => ({
  ContextBadge: () => <div data-testid="context-badge" />,
}));

vi.doMock('../../../src/components/AIChat/PendingActionsIndicator', () => ({
  PendingActionsIndicator: ({ onViewAll }: { onViewAll?: () => void }) => (
    <button data-testid="pending-actions" onClick={() => onViewAll?.()}>
      pending-actions
    </button>
  ),
}));

vi.doMock('../../../src/components/AIChat/EnhancedChatInput', () => ({
  EnhancedChatInput: ({
    onSend,
    onStopGenerating,
    disabled,
    placeholder,
    chatLanguage,
  }: {
    onSend: (msg: string, attachments?: any[]) => void;
    onStopGenerating: () => void;
    disabled: boolean;
    placeholder: string;
    chatLanguage: string;
  }) => (
    <div data-testid="enhanced-chat-input">
      <div data-testid="chat-lang">{chatLanguage}</div>
      <div data-testid="chat-placeholder">{placeholder}</div>
      <textarea data-testid="chat-input" disabled={disabled} defaultValue="hello" />
      <button
        data-testid="send-button"
        disabled={disabled}
        onClick={() => onSend('hello')}
      >
        send
      </button>
      <button
        data-testid="send-pdf"
        disabled={disabled}
        onClick={() => onSend('with pdf', [new File(['x'], 'test.pdf', { type: 'application/pdf' })])}
      >
        send-pdf
      </button>
      <button
        data-testid="send-unsupported"
        disabled={disabled}
        onClick={() =>
          onSend('with exe', [new File(['x'], 'bad.exe', { type: 'application/octet-stream' })])
        }
      >
        send-unsupported
      </button>
      <button data-testid="stop-button" onClick={onStopGenerating}>
        stop
      </button>
    </div>
  ),
}));

vi.mock('../../../src/components/AIChat/MessageRenderer', () => ({
  MessageRenderer: (props: any) => {
    const {
      msg,
      copiedMessageId,
      editingMessageId,
      editingText,
      setEditingText,
      handleCopyMessage,
      handleStartEditMessage,
      handleCancelEditMessage,
      handleCommitEditMessage,
      handleViewArtifacts,
      handleFeedback,
      handleEnableDeepThinking,
      handleDeepThinkingProceed,
      handleDeepThinkingReconfirm,
      handleSaveAsDecision,
      handleSaveAsIdea,
      handleMultiSelectToggle,
      handleMultiSelectConfirm,
      handleAgentAuditAccept,
    } = props;

    return (
      <div data-testid="message-renderer">
        <div data-testid="msg-id">{msg.id}</div>
        <div data-testid="copied-id">{copiedMessageId || ''}</div>
        <div data-testid="editing-id">{editingMessageId || ''}</div>
        <div data-testid="editing-text">{editingText || ''}</div>
        <button onClick={() => handleCopyMessage('copy me', msg.id)}>copy</button>
        <button onClick={() => handleStartEditMessage(msg.id)}>edit-start</button>
        <button onClick={() => handleCancelEditMessage()}>edit-cancel</button>
        <button onClick={() => handleCommitEditMessage()}>edit-commit</button>
        <input
          aria-label="edit-input"
          value={editingText || ''}
          onChange={(e) => setEditingText(e.target.value)}
        />
        <button
          onClick={() =>
            handleViewArtifacts([{ id: 'a1', type: 'md', title: 'A', content: 'X' }])
          }
        >
          view-artifacts
        </button>
        <button
          onClick={() =>
            handleFeedback(msg.id, msg.content, {
              rating: 'up',
              lengthFeedback: 'too_short',
              detailFeedback: 'more_detail',
              wantedMode: 'executive',
              customFeedback: 'ok',
            })
          }
        >
          feedback
        </button>
        <button onClick={() => handleEnableDeepThinking()}>enable-dt</button>
        <button onClick={() => handleDeepThinkingProceed()}>dt-proceed</button>
        <button onClick={() => handleDeepThinkingReconfirm()}>dt-reconfirm</button>
        <button onClick={() => handleSaveAsDecision(msg.id, 'decision')}>save-decision</button>
        <button onClick={() => handleSaveAsIdea(msg.id, '# Idea title\nDetails')}>save-idea</button>
        <button onClick={() => handleMultiSelectToggle('a')}>multi-a</button>
        <button onClick={() => handleMultiSelectToggle('b')}>multi-b</button>
        <button onClick={() => handleMultiSelectConfirm()}>multi-confirm</button>
        <button onClick={() => handleAgentAuditAccept({ orchestratorRunId: 'run-1' }, msg.id)}>
          accept-risk
        </button>
      </div>
    );
  },
}));

let UnifiedChatPanel: any;

describe('UnifiedChatPanel (L2)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Clipboard exists in JSDOM, but not always with writeText.
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });

    localStorage.removeItem('consultinity-preferred-chat-lang');

    pendingActionsCountState = 0;
    voiceStateState = { isSpeaking: false, isListening: false };
    ttsSupportedState = true;
    demoState = {
      isDemo: false,
      timeRemainingMs: 1_000_000,
      aiInteractionsRemaining: 100,
      aiInteractionsLimit: 100,
      consumeAIInteraction: vi.fn(),
    };

    ({ UnifiedChatPanel } = await import('../../../src/components/AIChat/UnifiedChatPanel'));

    appStoreState = {
      ...appStoreState,
      isBotTyping: false,
      aiFreezeStatus: { isFrozen: false },
      aiConfig: {
        deepResearch: false,
        webSearch: false,
        showReasoning: false,
        marketResearch: false,
        textToSpeech: false,
        responseStyle: 'normal',
      },
    };

    conversationStoreState = {
      ...conversationStoreState,
      activeConversationId: null,
      activeMessages: [],
      isLoading: false,
      isSidebarOpen: false,
      displayMode: 'full',
      draftChatLanguage: null,
      chatLanguageByConversationId: {},
    };

    aiStreamState = {
      ...aiStreamState,
      lastError: null,
      isStreaming: false,
      streamedContent: '',
      agentAuditVerdict: null,
    };
    aiStreamOptionsCaptured = null;

    h.apiMock.uploadChatAttachment.mockResolvedValue({ docId: 'doc-1' });
    h.apiMock.chatConfirm.mockResolvedValue({
      confirm: { understanding: { goal: 'G', context: 'C', constraints: ['X'], expectedOutput: 'O' } },
    });
    h.apiMock.agentAuditSuggest.mockResolvedValue({
      suggested: {
        orchestratorRunId: 'or-1',
        agents: [{ agentId: 'a-1', whySelected: 'w' }],
      },
    });
    h.apiMock.agentAuditReview.mockResolvedValue({
      orchestratorRunId: 'or-2',
      verdict: {
        qualityStatus: 'PASS',
        gatesTriggered: ['g1'],
        criticalRisks: [{ title: 'r1', reason: 'rr' }],
        actionableFollowups: [{ title: 'f1' }],
      },
      reviews: [{ agentId: 'a-1', status: 'ok' }],
    });
    h.apiMock.agentAuditListAgents.mockResolvedValue({
      agents: [{ id: 'a-1', displayName: { en: 'Agent 1' } }],
    });
    h.apiMock.agentAuditAcceptRun.mockResolvedValue({ ok: true });
    h.apiMock.deepThinkingEvent.mockResolvedValue({ ok: true });
    h.apiMock.saveDeepThinkingDecision.mockResolvedValue({ ok: true });
    h.apiMock.createMyIdea.mockResolvedValue({ id: 'idea-1' });
    h.apiMock.aiFeedback.mockResolvedValue({ ok: true });
  });

  it('derives chat language from explicit preference over store fallbacks', () => {
    localStorage.setItem('consultinity-preferred-chat-lang', 'de-DE');
    conversationStoreState.draftChatLanguage = 'fr';

    renderWithRouter(<UnifiedChatPanel />);
    expect(screen.getByTestId('chat-lang')).toHaveTextContent('de');
  });

  it('renders welcome state, skip link, and key header actions', () => {
    renderWithRouter(<UnifiedChatPanel />);

    expect(screen.getByText('Skip to chat input')).toHaveClass('sr-only');
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    expect(screen.getByTestId('chat-new-button')).toBeInTheDocument();
    expect(screen.getByTestId('chat-history-button')).toBeInTheDocument();
  });

  it('new chat clears state and creates/selects a conversation', async () => {
    createConversationMock.mockResolvedValue({ id: 'conv-1' });
    renderWithRouter(<UnifiedChatPanel />);

    fireEvent.click(screen.getByTestId('chat-new-button'));
    await waitFor(() => expect(clearActiveChatMock).toHaveBeenCalled());
    await waitFor(() => expect(createConversationMock).toHaveBeenCalled());
    await waitFor(() => expect(setActiveConversationMock).toHaveBeenCalledWith('conv-1'));
  });

  it('sends a message (creates conversation if needed) and starts stream', async () => {
    createConversationMock.mockResolvedValue({ id: 'conv-1' });
    renderWithRouter(<UnifiedChatPanel onMessageSent={vi.fn()} />);

    fireEvent.click(screen.getByTestId('send-button'));

    await waitFor(() => expect(createConversationMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(addMessageToConversationMock).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'user', content: 'hello' })
      )
    );
    await waitFor(() => expect(startStreamMock).toHaveBeenCalled());
  });

  it('uploads supported attachments and shows analysis status; skips unsupported types', async () => {
    createConversationMock.mockResolvedValue({ id: 'conv-1' });
    renderWithRouter(<UnifiedChatPanel />);

    fireEvent.click(screen.getByTestId('send-pdf'));
    await waitFor(() => expect(h.apiMock.uploadChatAttachment).toHaveBeenCalled());
    expect(addChatMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Analyzing') })
    );
    expect(setIsBotTypingMock).toHaveBeenCalledWith(true);
    await waitFor(() =>
      expect(addMessageToConversationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          metadata: expect.objectContaining({
            attachments: [expect.objectContaining({ docId: 'doc-1', filename: 'test.pdf' })],
          }),
        })
      )
    );

    fireEvent.click(screen.getByTestId('send-unsupported'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('renders error retry UI when lastError is set and wires actions', () => {
    aiStreamState.lastError = new Error('boom');
    renderWithRouter(<UnifiedChatPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retryLastStreamMock).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(clearLastErrorMock).toHaveBeenCalled();
  });

  it('business button tracks funnel and navigates; badge caps at 9+', () => {
    pendingActionsCountState = 12;
    const onNavigateToActions = vi.fn();
    renderWithRouter(<UnifiedChatPanel onNavigateToActions={onNavigateToActions} />);

    expect(screen.getByText('9+')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-business-button'));
    expect(h.trackFunnelEventMock).toHaveBeenCalledWith(
      'chat_business_button_clicked',
      expect.objectContaining({ pendingCount: 12 })
    );
    expect(onNavigateToActions).toHaveBeenCalled();
  });

  it('auto-read toggle stops speaking when disabling and syncs voice settings', () => {
    appStoreState.aiConfig = { ...appStoreState.aiConfig, textToSpeech: true };
    voiceStateState = { isSpeaking: true, isListening: false };

    renderWithRouter(<UnifiedChatPanel />);
    fireEvent.click(screen.getByTestId('chat-autoread-button'));

    expect(stopSpeakingMock).toHaveBeenCalled();
    expect(updateVoiceSettingsMock).toHaveBeenCalledWith({ autoSpeakResponses: false });
  });

  it('executes onStreamDone pipeline (stores AI msg + artifacts + TTS remaining text)', async () => {
    conversationStoreState.activeConversationId = 'conv-1';
    appStoreState.aiConfig = { ...appStoreState.aiConfig, textToSpeech: true };

    renderWithRouter(<UnifiedChatPanel />);
    expect(aiStreamOptionsCaptured?.onStreamDone).toBeTypeOf('function');

    await aiStreamOptionsCaptured.onStreamDone('', [], [{ id: 'ar1', type: 'md', title: 'T', content: 'C' }], {
      citations: [{ url: 'x' }],
    });

    expect(addMessageToConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'ai',
        metadata: expect.objectContaining({
          artifacts: [expect.objectContaining({ id: 'ar1', title: 'T' })],
          citations: [{ url: 'x' }],
        }),
      })
    );
    expect(addChatMessageMock).toHaveBeenCalledWith(expect.objectContaining({ role: 'ai' }));
    expect(speakMock).toHaveBeenCalled();
  });

  it('deep thinking flow: confirm, proceed, and post-run agent audit (streamed verdict path)', async () => {
    appStoreState.aiConfig = { ...appStoreState.aiConfig, deepResearch: true };
    aiStreamState.agentAuditVerdict = {
      orchestratorRunId: 'stream-run-1',
      verdict: { qualityStatus: 'PASS', gatesTriggered: [] },
      reviews: [],
      loopIteration: 1,
    };
    conversationStoreState.activeConversationId = 'conv-1';
    conversationStoreState.activeMessages = [
      { id: 'm1', role: 'user', content: 'hello', createdAt: new Date(), metadata: {} },
    ];

    renderWithRouter(
      <UnifiedChatPanel
        customMessages={[
          { id: 'm1', role: 'user', content: 'hello', timestamp: new Date() } as any,
        ]}
      />
    );

    // Send -> confirm card stored -> dtPendingConfirm set (via local state)
    fireEvent.click(screen.getByTestId('send-button'));
    await waitFor(() => expect(h.apiMock.chatConfirm).toHaveBeenCalled());

    // Proceed via MessageRenderer mock
    fireEvent.click(screen.getByRole('button', { name: 'dt-proceed' }));
    await waitFor(() => expect(startStreamMock).toHaveBeenCalled());

    // Complete stream: should use streamed verdict (no REST review)
    await aiStreamOptionsCaptured.onStreamDone('report', [], [], {});
    expect(h.apiMock.agentAuditReview).not.toHaveBeenCalled();
    expect(addMessageToConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'ai', content: expect.stringContaining('Agent Audit (post Deep Thinking)') })
    );
  });

  it('agent audit accept handler persists acknowledgement and updates stores', async () => {
    conversationStoreState.activeConversationId = 'conv-1';
    renderWithRouter(
      <UnifiedChatPanel
        customMessages={[{ id: 'm1', role: 'user', content: 'x', timestamp: new Date() } as any]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'accept-risk' }));
    await waitFor(() =>
      expect(h.apiMock.agentAuditAcceptRun).toHaveBeenCalledWith({ runId: 'run-1' })
    );
    expect(addChatMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ agentAudit: expect.anything() }) })
    );
  });

  it('inline edit & regenerate truncates and restarts stream (non-deepResearch path)', async () => {
    conversationStoreState.activeConversationId = 'conv-1';
    conversationStoreState.activeMessages = [
      { id: 'm1', role: 'user', content: 'old', createdAt: new Date(), metadata: {} },
      { id: 'm2', role: 'ai', content: 'x', createdAt: new Date(), metadata: {} },
    ];

    renderWithRouter(
      <UnifiedChatPanel
        customMessages={[
          { id: 'm1', role: 'user', content: 'old', timestamp: new Date() } as any,
          { id: 'm2', role: 'ai', content: 'x', timestamp: new Date() } as any,
        ]}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'edit-start' })[0]);
    fireEvent.change(screen.getAllByLabelText('edit-input')[0], { target: { value: 'new text' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'edit-commit' })[0]);

    await waitFor(() => expect(truncateFromMessageMock).toHaveBeenCalledWith('m1', 'new text'));
    await waitFor(() => expect(startStreamMock).toHaveBeenCalled());
  });

  it('multi-select confirm calls onMultiSelectSubmit (or falls back to onOptionSelect)', async () => {
    const onMultiSelectSubmit = vi.fn();
    renderWithRouter(
      <UnifiedChatPanel
        onMultiSelectSubmit={onMultiSelectSubmit}
        customMessages={[{ id: 'm1', role: 'user', content: 'x', timestamp: new Date() } as any]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'multi-a' }));
    fireEvent.click(screen.getByRole('button', { name: 'multi-b' }));
    fireEvent.click(screen.getByRole('button', { name: 'multi-confirm' }));

    expect(onMultiSelectSubmit).toHaveBeenCalledWith(['a', 'b']);
  });
});
