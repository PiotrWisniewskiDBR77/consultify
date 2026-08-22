import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Mocks (stateful, but scoped to this test file)
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  trackFunnelEventMock: vi.fn(),
  // RISK-30 (S22-TERESA, 2026-08-12) — controllable per-test double for the
  // Z4 tool-executor. Real `executeTeresaTool` runs the full registry
  // (`runIdeaAction` -> handler); these reply-layer tests only care about
  // what UnifiedChatPanel DOES with a given `ActionResult`, so they drive it
  // directly rather than re-exercising the whole registry here (that is
  // covered separately by `runtimeHelpers`-level tests).
  executeTeresaToolMock: vi.fn(),
  apiMock: {
    agentAuditAcceptRun: vi.fn(),
    agentAuditListAgents: vi.fn(),
    agentAuditReview: vi.fn(),
    agentAuditSuggest: vi.fn(),
    aiFeedback: vi.fn(),
    chatConfirm: vi.fn(),
    createResearchSession: vi.fn(),
    createMyIdea: vi.fn(),
    deepThinkingEvent: vi.fn(),
    getConversationProposals: vi.fn(),
    saveDeepThinkingDecision: vi.fn(),
    uploadChatAttachment: vi.fn(),
    // M01-P03A — conversation branching (BranchSelector mount, finding M01-035)
    getConversationBranches: vi.fn(),
    branchConversation: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
  },
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: h.trackFunnelEventMock,
}));

vi.mock('../../../src/services/api', () => ({
  Api: h.apiMock,
  default: h.apiMock,
}));

// RISK-30 (S22-TERESA): `buildTeresaToolManifest`/`toServerIdeaActionManifest`
// stay harmless stubs — they only run when `activeIdeaWorkspaceTool` is one
// of the four canvas tools (null by default, so every PRE-EXISTING test in
// this file never touches them). `executeTeresaTool` is the one function the
// new `describe` block below configures per test.
vi.mock('../../../src/actions/teresaActionManifest', () => ({
  buildTeresaToolManifest: () => [],
  toServerIdeaActionManifest: () => [],
  shouldUseLegacyIdeaIntentFallback: () => false,
  executeTeresaTool: h.executeTeresaToolMock,
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const addChatMessageMock = vi.fn();
const deleteChatMessageMock = vi.fn();
const setIsBotTypingMock = vi.fn();
const setAIConfigMock = vi.fn();
const setCurrentViewMock = vi.fn();
const setChatKickoffMessageMock = vi.fn();
const setChatOutputToolMock = vi.fn();
const setMyWorkIntentMock = vi.fn();

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
  chatOutputTool: 'auto',
  setChatKickoffMessage: setChatKickoffMessageMock,
  setChatOutputTool: setChatOutputToolMock,
  setMyWorkIntent: setMyWorkIntentMock,
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
  setConversationChatLanguage: vi.fn(),
};

const useConversationStoreMock: any = () => conversationStoreState;
useConversationStoreMock.getState = () => conversationStoreState;

vi.doMock('../../../src/store/useConversationStore', () => ({
  useConversationStore: useConversationStoreMock,
}));

const addArtifactMock = vi.fn();
const toggleArtifactsPanelMock = vi.fn();
const exportArtifactMock = vi.fn();
const artifactsStoreState: any = {
  addArtifact: addArtifactMock,
  togglePanel: toggleArtifactsPanelMock,
  exportArtifact: exportArtifactMock,
  conversationArtifacts: {},
  activeArtifactId: null,
  setActiveArtifact: vi.fn(),
  registerConversationDeliverable: vi.fn(),
  loadConversationArtifacts: vi.fn(),
};
const useArtifactsStoreMock: any = (selector?: any) =>
  typeof selector === 'function' ? selector(artifactsStoreState) : artifactsStoreState;
useArtifactsStoreMock.getState = () => artifactsStoreState;
vi.doMock('../../../src/store/useArtifactsStore', () => ({
  useArtifactsStore: useArtifactsStoreMock,
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

vi.doMock('../../../src/contexts/TeresaVoiceContext', () => ({
  useTeresaVoiceContext: () => ({
    isVoiceActive: false,
    isMuted: false,
    handleVoiceToggle: vi.fn(),
    toggleMute: vi.fn(),
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
const checkPartialResponseMock = vi.fn(async () => null);
const resumeFromPartialMock = vi.fn();

let aiStreamOptionsCaptured: any = null;
let aiStreamState: any = {
  abortStream: abortStreamMock,
  retryLastStream: retryLastStreamMock,
  lastError: null,
  clearLastError: clearLastErrorMock,
  checkPartialResponse: checkPartialResponseMock,
  resumeFromPartial: resumeFromPartialMock,
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
      <button data-testid="send-button" disabled={disabled} onClick={() => onSend('hello')}>
        send
      </button>
      <button
        data-testid="send-retired-task"
        disabled={disabled}
        onClick={() => onSend('/task Prepare steering committee brief')}
      >
        send-retired-task
      </button>
      <button
        data-testid="send-retired-decision"
        disabled={disabled}
        onClick={() => onSend('/decision Approve the recovery plan')}
      >
        send-retired-decision
      </button>
      <button
        data-testid="send-pdf"
        disabled={disabled}
        onClick={() =>
          onSend('with pdf', [new File(['x'], 'test.pdf', { type: 'application/pdf' })])
        }
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
      <button
        data-testid="send-oversized"
        disabled={disabled}
        onClick={() => {
          // In-matrix format (PDF) but over the 25MB MAX_CHAT_ATTACHMENT_BYTES
          // limit — overriding File.size avoids allocating a real 26MB buffer.
          const oversized = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
          Object.defineProperty(oversized, 'size', { value: 26 * 1024 * 1024 });
          onSend('with huge pdf', [oversized]);
        }}
      >
        send-oversized
      </button>
      <button
        data-testid="send-url"
        disabled={disabled}
        onClick={() =>
          onSend('with url', [
            {
              kind: 'url',
              url: 'https://example.com/report',
              title: 'Example report',
              name: 'example.com/report',
            },
          ])
        }
      >
        send-url
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
      teresaPendingConfirm,
      teresaConfirmBusy,
      onTeresaConfirmProceed,
      onTeresaConfirmCancel,
    } = props;

    return (
      <div data-testid="message-renderer">
        <div data-testid="msg-id">{msg.id}</div>
        {/* RISK-30 (S22-TERESA, 2026-08-12) — real props from UnifiedChatPanel's
            own `teresaPendingConfirm` state (set inside `onIdeaAction` when the
            registry asks for confirmation), not a stub: clicking these buttons
            exercises the ACTUAL `handleTeresaConfirmProceed`/`handleTeresaConfirmCancel`
            callbacks. Renders once per message row (same as every other prop
            here); harmless no-op for every OTHER test in this file because
            `teresaPendingConfirm` stays null unless a test drives `onIdeaAction`
            into the confirm-required branch. */}
        {msg?.metadata?.teresaConfirm ? (
          <div data-testid="teresa-confirm-message">{msg.content}</div>
        ) : null}
        {teresaPendingConfirm ? (
          <div data-testid="teresa-confirm-block">
            <button
              data-testid="teresa-confirm-proceed"
              disabled={teresaConfirmBusy}
              onClick={() => onTeresaConfirmProceed?.()}
            >
              teresa-confirm-proceed
            </button>
            <button data-testid="teresa-confirm-cancel" onClick={() => onTeresaConfirmCancel?.()}>
              teresa-confirm-cancel
            </button>
          </div>
        ) : null}
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
          onClick={() => handleViewArtifacts([{ id: 'a1', type: 'md', title: 'A', content: 'X' }])}
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

vi.mock('../../../src/components/AIChat/V8ArtifactRunControl', () => ({
  V8ArtifactRunControl: () => <div data-testid="v8-artifact-run-control" />,
}));

vi.mock('../../../src/components/AIChat/V8ContextIndicator', () => ({
  V8ContextIndicator: () => <div data-testid="v8-context-indicator" />,
}));

let UnifiedChatPanel: any;
let buildCanvasContextPacket: any;
let unifiedChatPrivate: any;

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
    localStorage.removeItem('workCanvas.splitWidthPercent');

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

    ({
      UnifiedChatPanel,
      buildCanvasContextPacket,
      __private__: unifiedChatPrivate,
    } = await import('../../../src/components/AIChat/UnifiedChatPanel'));

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
      chatOutputTool: 'auto',
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
      _activeConversationState: null,
      _activeConversationStateMessage: null,
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
      confirm: {
        understanding: { goal: 'G', context: 'C', constraints: ['X'], expectedOutput: 'O' },
      },
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
    h.apiMock.getConversationProposals.mockResolvedValue({ proposals: [] });
    h.apiMock.saveDeepThinkingDecision.mockResolvedValue({ ok: true });
    h.apiMock.createResearchSession.mockResolvedValue({
      success: true,
      session: { sessionId: 'rs-chat-canvas-1', status: 'planned' },
    });
    h.apiMock.createMyIdea.mockResolvedValue({ id: 'idea-1' });
    h.apiMock.aiFeedback.mockResolvedValue({ ok: true });
    h.apiMock.getConversationBranches.mockResolvedValue({
      conversationId: 'conv-branch-test',
      isBranch: false,
      parentConversationId: null,
      parentBranchId: null,
      forkMessageId: null,
      branchName: null,
      branches: [],
    });
    h.apiMock.branchConversation.mockResolvedValue({
      conversation: { id: 'conv-new-branch' },
      branchedFrom: 'conv-branch-test',
      copiedMessages: 1,
      branch: {
        id: 'conv-new-branch',
        conversationId: 'conv-branch-test',
        parentBranchId: null,
        forkMessageId: 'msg-1',
        branchName: 'My branch',
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        messageCount: 1,
      },
    });
    h.apiMock.updateConversation.mockResolvedValue({ id: 'conv-new-branch' });
    h.apiMock.deleteConversation.mockResolvedValue({ success: true, deleted: 'conv-new-branch' });
    checkPartialResponseMock.mockReset();
    checkPartialResponseMock.mockResolvedValue(null);
    resumeFromPartialMock.mockReset();
    resumeFromPartialMock.mockResolvedValue(undefined);
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
    expect(screen.getByTestId('chat-full-welcome')).toBeInTheDocument();
    expect(screen.getByText('Analiza rynku')).toBeInTheDocument();
    expect(screen.getByText('Analiza finansowa')).toBeInTheDocument();
    expect(screen.getByText('Klasyczny consulting')).toBeInTheDocument();
    expect(screen.getByText('Transformacja cyfrowa')).toBeInTheDocument();
    expect(screen.getByText('Daily brief')).toBeInTheDocument();
    expect(screen.getByText('Quick savings')).toBeInTheDocument();
    expect(screen.getByTestId('chat-new-button')).toBeInTheDocument();
    expect(screen.getByTestId('chat-history-button')).toBeInTheDocument();
  });

  it.each([
    ['permission_denied', 'You do not have access to this conversation'],
    ['not_found', 'This conversation does not exist'],
    ['deleted', 'This conversation has been deleted'],
    ['archived', 'This conversation is archived'],
  ] as const)(
    'renders the %s deep-link state instead of a false welcome and disables writes',
    (state, expectedCopy) => {
      conversationStoreState.activeConversationId = `conv-${state}`;
      conversationStoreState._activeConversationState = state;
      conversationStoreState._activeConversationStateMessage = null;

      renderWithRouter(<UnifiedChatPanel mode="full" />);

      const stateCard = screen.getByTestId('chat-conversation-state');
      expect(stateCard).toHaveAttribute('data-state', state);
      expect(stateCard).toHaveTextContent(expectedCopy);
      expect(screen.queryByTestId('chat-full-welcome')).not.toBeInTheDocument();
      expect(screen.getByTestId('chat-input')).toBeDisabled();
      expect(screen.getByTestId('send-button')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Start a new conversation' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Open conversation history' })).toBeVisible();
      expect(startStreamMock).not.toHaveBeenCalled();
    }
  );

  it('discovers a cold partial response and resumes only after explicit user action', async () => {
    conversationStoreState.activeConversationId = 'conv-partial';
    conversationStoreState.activeMessages = [
      { id: 'u1', role: 'user', content: 'Continue this analysis' },
    ];
    checkPartialResponseMock.mockResolvedValue({
      sessionId: 'conv-partial',
      content: 'Saved partial',
      canResume: true,
    });

    renderWithRouter(<UnifiedChatPanel />);

    expect(await screen.findByTestId('chat-partial-recovery')).toHaveTextContent(
      'An interrupted response is available.'
    );
    expect(resumeFromPartialMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() =>
      expect(resumeFromPartialMock).toHaveBeenCalledWith(
        'conv-partial',
        'Continue this analysis',
        []
      )
    );
  });

  it('fails closed when a partial checkpoint has no persisted user request', async () => {
    conversationStoreState.activeConversationId = 'conv-no-prompt';
    conversationStoreState.activeMessages = [];
    checkPartialResponseMock.mockResolvedValue({
      sessionId: 'conv-no-prompt',
      content: 'Saved partial',
      canResume: true,
    });

    renderWithRouter(<UnifiedChatPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
    await waitFor(() =>
      expect(screen.getByTestId('chat-partial-recovery')).toHaveTextContent(
        'The original request is unavailable'
      )
    );
    expect(resumeFromPartialMock).not.toHaveBeenCalled();
  });

  it('renders a forbidden checkpoint without a Resume button', async () => {
    conversationStoreState.activeConversationId = 'conv-forbidden';
    conversationStoreState.activeMessages = [
      { id: 'u1', role: 'user', content: 'Continue this analysis' },
    ];
    checkPartialResponseMock.mockResolvedValue({
      sessionId: 'conv-forbidden',
      content: '',
      canResume: false,
      forbidden: true,
    });

    renderWithRouter(<UnifiedChatPanel />);

    const notice = await screen.findByTestId('chat-partial-recovery');
    expect(notice).toHaveAttribute('data-state', 'forbidden');
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(resumeFromPartialMock).not.toHaveBeenCalled();
  });

  it('renders a stale checkpoint without a Resume button', async () => {
    conversationStoreState.activeConversationId = 'conv-stale';
    conversationStoreState.activeMessages = [
      { id: 'u1', role: 'user', content: 'Continue this analysis' },
    ];
    checkPartialResponseMock.mockResolvedValue({
      sessionId: 'conv-stale',
      content: 'Superseded partial content',
      canResume: false,
      stale: true,
    });

    renderWithRouter(<UnifiedChatPanel />);

    const notice = await screen.findByTestId('chat-partial-recovery');
    expect(notice).toHaveAttribute('data-state', 'stale');
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(resumeFromPartialMock).not.toHaveBeenCalled();
  });

  it('renders an available checkpoint with its Resume button', async () => {
    conversationStoreState.activeConversationId = 'conv-available';
    conversationStoreState.activeMessages = [
      { id: 'u1', role: 'user', content: 'Continue this analysis' },
    ];
    checkPartialResponseMock.mockResolvedValue({
      sessionId: 'conv-available',
      content: 'Saved partial',
      canResume: true,
    });

    renderWithRouter(<UnifiedChatPanel />);

    const notice = await screen.findByTestId('chat-partial-recovery');
    expect(notice).toHaveAttribute('data-state', 'available');
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(resumeFromPartialMock).not.toHaveBeenCalled();
  });

  // M01-P03A — BranchSelector was found fully orphaned (finding M01-035):
  // imported nowhere in src/. These tests are the negative-control proof
  // that it is now REALLY mounted and wired, not just present in the tree
  // unreachably. Deleting the mount block in UnifiedChatPanel.tsx (the
  // `{activeConversationId && !String(...).startsWith('local-') && (...)}`
  // guard around <BranchSelector .../>) must turn the first assertion red.
  describe('M01-P03A conversation branching (BranchSelector)', () => {
    it('mounts the branch selector once a real (non-local) conversation is active and lists its branches', async () => {
      conversationStoreState.activeConversationId = 'conv-branch-test';
      conversationStoreState.activeMessages = [{ id: 'msg-1', role: 'user', content: 'hello' }];
      h.apiMock.getConversationBranches.mockResolvedValue({
        conversationId: 'conv-branch-test',
        isBranch: false,
        parentConversationId: null,
        parentBranchId: null,
        forkMessageId: null,
        branchName: null,
        branches: [
          {
            id: 'conv-existing-branch',
            conversationId: 'conv-branch-test',
            parentBranchId: null,
            forkMessageId: 'msg-1',
            branchName: 'Existing branch',
            createdBy: 'user-1',
            createdAt: new Date().toISOString(),
            messageCount: 2,
          },
        ],
      });

      renderWithRouter(<UnifiedChatPanel mode="full" />);

      await waitFor(() =>
        expect(h.apiMock.getConversationBranches).toHaveBeenCalledWith('conv-branch-test')
      );

      const trigger = await screen.findByTestId('branch-selector-trigger');
      expect(trigger).toBeInTheDocument();
      // Real data reached the UI (not a fabricated/empty placeholder): the
      // branch count badge reflects the one branch the mock API returned.
      expect(trigger).toHaveTextContent('1');

      fireEvent.click(trigger);
      expect(await screen.findByText('Existing branch')).toBeInTheDocument();
    });

    it('does NOT fetch or render a branch selector for a local (not-yet-persisted) conversation', () => {
      conversationStoreState.activeConversationId = 'local-draft-1';

      renderWithRouter(<UnifiedChatPanel mode="full" />);

      expect(h.apiMock.getConversationBranches).not.toHaveBeenCalled();
      expect(screen.queryByTestId('branch-selector-trigger')).not.toBeInTheDocument();
    });

    it('creating a branch from the selector calls the real API with the trailing message as fork point, then refreshes the list', async () => {
      conversationStoreState.activeConversationId = 'conv-branch-test';
      conversationStoreState.activeMessages = [{ id: 'msg-1', role: 'user', content: 'hi' }];

      renderWithRouter(<UnifiedChatPanel mode="full" />);

      const trigger = await screen.findByTestId('branch-selector-trigger');
      fireEvent.click(trigger);
      fireEvent.click(await screen.findByTestId('branch-selector-open-create'));

      const input = screen.getByPlaceholderText('Branch name...');
      fireEvent.change(input, { target: { value: 'My branch' } });
      fireEvent.click(screen.getByTestId('branch-selector-submit-create'));

      await waitFor(() =>
        expect(h.apiMock.branchConversation).toHaveBeenCalledWith(
          'conv-branch-test',
          'msg-1',
          'My branch'
        )
      );
      // Post-create, the panel re-fetches so a fresh reopen of the dropdown
      // would show the newly created branch (not a locally-fabricated one).
      await waitFor(() => expect(h.apiMock.getConversationBranches).toHaveBeenCalledTimes(2));
    });
  });

  it('mindmap deliverable: forwards the backend skeleton graph as seedGraph and skips the AI-kickoff startMode', async () => {
    // Regression test for the "Teresa Mind Map: backend skeleton ignored by
    // FE" bug — onDeliverable used to always set
    // seedIntent.startMode = 'describe_with_ai' and drop payload.graph on the
    // floor, so IdeaMapWorkspace always re-kicked-off a fresh AI generation
    // instead of opening the graph the backend already built. The fix
    // forwards `graph` as `seedIntent.seedGraph` and only falls back to the
    // AI-kickoff startMode when no usable graph was provided.
    renderWithRouter(<UnifiedChatPanel mode="full" />);

    expect(aiStreamOptionsCaptured?.onDeliverable).toBeInstanceOf(Function);

    const skeletonGraph = {
      nodes: [
        { id: 'center', type: 'center', data: { label: 'Transformacja cyfrowa' } },
        { id: 'branch-1', type: 'branch', data: { label: 'Ludzie' } },
      ],
      edges: [{ id: 'e-center-branch-1', source: 'center', target: 'branch-1' }],
    };

    act(() => {
      aiStreamOptionsCaptured.onDeliverable({
        draftId: 'chat-mindmap-1',
        generationId: 'chat-mindmap-1',
        kind: 'mindmap',
        format: 'mindmap',
        title: 'Transformacja cyfrowa',
        graph: skeletonGraph,
        seedText: 'Mapa myśli o transformacji cyfrowej',
        preferredSystem: 'mindmap',
      });
    });

    expect(setMyWorkIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: 'ideas',
        open: expect.objectContaining({
          type: 'idea',
          data: expect.objectContaining({
            isNew: true,
            seedIntent: expect.objectContaining({
              // The skeleton graph made it through instead of being dropped.
              seedGraph: { nodes: skeletonGraph.nodes, edges: skeletonGraph.edges },
              // No AI re-kickoff: startMode must NOT be describe_with_ai when
              // a usable graph is already present.
              startMode: 'blank_canvas',
              preferredSystem: 'mindmap',
            }),
          }),
        }),
      })
    );
  });

  it('mindmap deliverable: falls back to the AI-kickoff startMode when no graph is provided', async () => {
    renderWithRouter(<UnifiedChatPanel mode="full" />);

    act(() => {
      aiStreamOptionsCaptured.onDeliverable({
        draftId: 'chat-mindmap-2',
        generationId: 'chat-mindmap-2',
        kind: 'mindmap',
        format: 'mindmap',
        title: 'Bez szkieletu',
        seedText: 'Mapa myśli bez szkieletu',
        preferredSystem: 'mindmap',
      });
    });

    expect(setMyWorkIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        open: expect.objectContaining({
          data: expect.objectContaining({
            seedIntent: expect.objectContaining({
              seedGraph: null,
              startMode: 'describe_with_ai',
            }),
          }),
        }),
      })
    );
  });

  it('does not render the full welcome surface in split/sidebar mode', () => {
    renderWithRouter(<UnifiedChatPanel mode="split" />);

    expect(screen.queryByTestId('chat-full-welcome')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-compact-empty-state')).toBeInTheDocument();
    expect(screen.queryByText('Good morning')).not.toBeInTheDocument();
    expect(screen.queryByText('Analiza rynku')).not.toBeInTheDocument();
    expect(screen.queryByText('Analiza finansowa')).not.toBeInTheDocument();
    expect(screen.queryAllByAltText('Consultify')).toHaveLength(0);
    expect(screen.getByTestId('send-button')).toBeInTheDocument();
  });

  it('keeps explicit full mode welcome even when the stored display mode is split', () => {
    conversationStoreState.displayMode = 'split';

    renderWithRouter(<UnifiedChatPanel mode="full" />);

    expect(screen.getByTestId('chat-full-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-compact-empty-state')).not.toBeInTheDocument();
  });

  it('opens a clean work panel from the chat header', () => {
    renderWithRouter(<UnifiedChatPanel mode="full" />);

    fireEvent.click(screen.getByTestId('chat-work-panel-button'));

    expect(screen.getByTestId('chat-work-panel')).toBeInTheDocument();
    expect(screen.queryByText('Work panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Empty workspace for documents and canvas')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-work-panel')).toHaveAttribute('aria-label', 'Canvas work area');
    expect(screen.queryByText('Active document:')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Canvas document title')).toHaveValue('Company Work Note');
    // The view toggle and diagnostics now live inside the Canvas menu dropdown.
    fireEvent.click(screen.getByRole('button', { name: 'Canvas menu' }));
    expect(screen.getByRole('button', { name: 'Dock view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Markdown view' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /MD file properties/i }));
    expect(screen.getByText('Markdown canonical')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-full-welcome')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-work-panel-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-compact-empty-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('enhanced-chat-input')).toBeInTheDocument();
  });

  it('does not render selected Canvas context chrome in the chat side', async () => {
    renderWithRouter(<UnifiedChatPanel mode="full" />);

    fireEvent.click(screen.getByTestId('chat-work-panel-button'));
    fireEvent.click(screen.getByRole('button', { name: 'Canvas menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Markdown view' }));
    const mdView = await screen.findByTestId('canvas-md-view');
    const textarea = mdView as HTMLTextAreaElement;
    const selected = 'Operating workspace';
    const start = textarea.value.indexOf(selected);
    textarea.setSelectionRange(start, start + selected.length);
    fireEvent.select(textarea);

    expect(screen.queryByTestId('chat-canvas-selection-context')).not.toBeInTheDocument();
    expect(screen.queryByText('Selected from Canvas')).not.toBeInTheDocument();
  });

  it('passes active Canvas document context to Teresa without creating context chrome', async () => {
    conversationStoreState.activeConversationId = 'conv-1';
    renderWithRouter(<UnifiedChatPanel mode="full" />);

    fireEvent.click(screen.getByTestId('chat-work-panel-button'));
    await waitFor(() =>
      expect(screen.getByLabelText('Canvas document title')).toHaveValue('Company Work Note')
    );

    fireEvent.click(screen.getByTestId('send-button'));

    await waitFor(() => expect(startStreamMock).toHaveBeenCalled());
    const context = startStreamMock.mock.calls.at(-1)?.[3];
    expect(context).toEqual(
      expect.objectContaining({
        conversationId: 'conv-1',
        canvasContext: expect.objectContaining({
          draftId: null,
          title: 'Company Work Note',
          packetSchemaVersion: 'canvas-context/v1',
        }),
        canvasContextPacket: expect.objectContaining({
          schemaVersion: 'canvas-context/v1',
          activeDraft: expect.objectContaining({
            draftId: null,
            title: 'Company Work Note',
            lifecycleState: 'draft',
          }),
          markdownProjection: expect.stringContaining('# Company Work Note'),
          memorySnapshot: expect.objectContaining({
            summary: expect.stringContaining('Company Work Note'),
            limitations: expect.arrayContaining([
              expect.stringContaining('raw native block JSON is not included'),
            ]),
          }),
        }),
      })
    );
    expect(addMessageToConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        role: 'user',
        metadata: expect.objectContaining({
          canvasContext: expect.objectContaining({
            schemaVersion: 'canvas-context/v1',
            activeDraft: expect.objectContaining({ title: 'Company Work Note' }),
          }),
        }),
      })
    );
    expect(screen.queryByText('Active document:')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-canvas-selection-context')).not.toBeInTheDocument();
  });

  it('passes selected Canvas text to Teresa as the active Canvas context', async () => {
    conversationStoreState.activeConversationId = 'conv-1';
    renderWithRouter(<UnifiedChatPanel mode="full" />);

    fireEvent.click(screen.getByTestId('chat-work-panel-button'));
    fireEvent.click(screen.getByRole('button', { name: 'Canvas menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Markdown view' }));
    const mdView = (await screen.findByTestId('canvas-md-view')) as HTMLTextAreaElement;
    const selected = 'Operating workspace';
    const start = mdView.value.indexOf(selected);
    mdView.setSelectionRange(start, start + selected.length);
    fireEvent.select(mdView);

    fireEvent.click(screen.getByTestId('send-button'));

    await waitFor(() => expect(startStreamMock).toHaveBeenCalled());
    const context = startStreamMock.mock.calls.at(-1)?.[3];
    expect(context?.canvasContext).toEqual(
      expect.objectContaining({
        draftId: null,
        title: 'Company Work Note',
        mode: 'md',
        selectedText: selected,
        packetSchemaVersion: 'canvas-context/v1',
      })
    );
    expect(context?.canvasContextPacket).toEqual(
      expect.objectContaining({
        schemaVersion: 'canvas-context/v1',
        selection: expect.objectContaining({
          mode: 'md',
          selectedText: selected,
        }),
        memorySnapshot: expect.objectContaining({
          anchors: expect.objectContaining({ title: 'Company Work Note' }),
        }),
      })
    );
    expect(screen.queryByText('Selected from Canvas')).not.toBeInTheDocument();
  });

  it('routes explicit chat commands into the Research Canvas without starting Teresa stream', async () => {
    conversationStoreState.activeConversationId = 'conv-1';
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          conversationId: 'conv-1',
          kind: 'research',
          researchSessionId: 'rs-chat-canvas-1',
        });
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-chat-canvas-1',
              title: 'Market Research Brief',
              kind: 'research',
              contentMd: body.contentMd,
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
              researchSessionId: 'rs-chat-canvas-1',
            },
          }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithRouter(
      <UnifiedChatPanel
        mode="full"
        kickoffMessage="zrób research canvas dla segmentu robotyki"
        onKickoffConsumed={vi.fn()}
      />
    );

    expect(await screen.findByTestId('chat-work-panel')).toBeInTheDocument();
    await waitFor(() => expect(h.apiMock.createResearchSession).toHaveBeenCalled());
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts', expect.any(Object))
    );
    expect(addMessageToConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        role: 'user',
        metadata: expect.objectContaining({
          canvasCommand: expect.objectContaining({ starterId: 'research' }),
        }),
      })
    );
    expect(addChatMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'ai',
        content: expect.stringContaining('Research Canvas'),
      })
    );
    expect(startStreamMock).not.toHaveBeenCalled();
  });

  it('parses Canvas routing commands into the expected starter', () => {
    expect(unifiedChatPrivate.parseChatCanvasIntent('/canvas decision memo')?.starterId).toBe(
      'decision'
    );
    expect(
      unifiedChatPrivate.parseChatCanvasIntent('wrzuć to do Canvas jako plan')?.starterId
    ).toBe('plan');
    expect(unifiedChatPrivate.parseChatCanvasIntent('normalna wiadomość bez routingu')).toBeNull();
  });

  it('summarizes recent workflow timeline events in the Canvas context packet', () => {
    const packet = buildCanvasContextPacket(
      {
        draftId: 'draft-1',
        title: 'Client proposal',
        saveState: 'saved',
        lifecycleState: 'draft',
        activeStarterId: 'work-note',
        kind: 'document',
        contentMd: '# Client proposal',
        markdownProjectionStatus: 'synced',
        blocks: [],
        linkedOutputs: [],
        workflowRuns: [
          {
            id: 'workflow-1',
            draftId: 'draft-1',
            conversationId: 'conv-1',
            template: 'client_proposal_to_deck',
            title: 'Client proposal to deck',
            status: 'active',
            steps: [],
            approvals: [],
            outputs: [
              {
                stepId: 'step-2',
                type: 'presentation',
                id: 'output-1',
                title: 'Presentation: Client proposal',
                url: '/work-canvas?draftId=output-1',
              },
            ],
            collaboration: {
              ownerId: 'user-1',
              reviewerId: 'reviewer-1',
              lifecycle: 'in_review',
              comments: [
                {
                  id: 'comment-1',
                  authorId: 'reviewer-1',
                  body: 'Sensitive reviewer comment should not be copied into workflowRuns.',
                  createdAt: '2026-05-03T00:02:00.000Z',
                },
              ],
            },
            events: [
              {
                id: 'event-1',
                type: 'created',
                actorId: 'user-1',
                summary: 'Workflow created from template: Client proposal to deck.',
                createdAt: '2026-05-03T00:00:00.000Z',
                metadata: { raw: 'not projected' },
              },
              {
                id: 'event-2',
                type: 'output_created',
                actorId: 'user-1',
                summary: 'Created presentation output: Presentation: Client proposal.',
                createdAt: '2026-05-03T00:01:00.000Z',
                metadata: { outputId: 'output-1' },
              },
            ],
            createdBy: 'user-1',
            createdAt: '2026-05-03T00:00:00.000Z',
            updatedAt: '2026-05-03T00:01:00.000Z',
          },
        ],
      },
      null
    );

    expect(packet?.workflowEventSummaries).toEqual([
      expect.objectContaining({
        workflowRunId: 'workflow-1',
        workflowTitle: 'Client proposal to deck',
        eventType: 'created',
        actorId: 'user-1',
        summary: 'Workflow created from template: Client proposal to deck.',
      }),
      expect.objectContaining({
        workflowRunId: 'workflow-1',
        eventType: 'output_created',
        summary: 'Created presentation output: Presentation: Client proposal.',
      }),
    ]);
    expect(packet?.workflowEventSummaries?.[0]).not.toHaveProperty('metadata');
    expect(packet?.workflowRuns).toEqual([
      expect.objectContaining({
        id: 'workflow-1',
        title: 'Client proposal to deck',
        lifecycle: 'in_review',
        outputCount: 1,
        stepSummaries: [],
        approvalStatuses: [],
      }),
    ]);
    expect(packet?.workflowRuns?.[0]).not.toHaveProperty('events');
    expect(packet?.workflowRuns?.[0]).not.toHaveProperty('collaboration');
    expect(JSON.stringify(packet?.workflowRuns)).not.toContain('Sensitive reviewer comment');
    expect(packet?.workflowOutputSummaries).toEqual([
      expect.objectContaining({
        workflowRunId: 'workflow-1',
        workflowTitle: 'Client proposal to deck',
        stepId: 'step-2',
        type: 'presentation',
        id: 'output-1',
        title: 'Presentation: Client proposal',
        url: '/work-canvas?draftId=output-1',
      }),
    ]);
    expect(packet?.memorySnapshot.anchors.workflowRunIds).toEqual(['workflow-1']);
  });

  it('keeps the full Canvas rollout context safe and anchored for Teresa', () => {
    const packet = buildCanvasContextPacket(
      {
        draftId: 'draft-rollout-1',
        researchSessionId: 'rs-rollout-1',
        title: 'Rollout Gate Memo',
        saveState: 'saved',
        lifecycleState: 'draft',
        activeStarterId: 'decision',
        kind: 'decision',
        contentMd: '# Rollout Gate Memo\n\nApprove the Canvas rollout after evidence review.',
        markdownProjectionStatus: 'synced',
        linkedOutputs: [
          {
            stepId: 'step-output',
            type: 'report',
            id: 'report-rollout-1',
            title: 'Report: Rollout Gate Memo',
            url: '/work-canvas?draftId=report-rollout-1',
          },
        ],
        blocks: [
          {
            id: 'block-risk-table',
            kind: 'table',
            schemaVersion: 'canvas-block/v1',
            title: 'Rollout Risks',
            status: 'ready',
            capabilities: ['view', 'export'],
            data: {
              secretInternalRows: [{ risk: 'raw JSON must not enter Teresa context' }],
            },
            provenance: { source: 'assistant' },
            markdownProjection: '| Risk | Mitigation |\n| --- | --- |\n| Context loss | E2E gate |',
            markdownProjectionStatus: 'synced',
          },
        ],
        workflowRuns: [
          {
            id: 'workflow-rollout-1',
            draftId: 'draft-rollout-1',
            conversationId: 'conv-rollout-1',
            template: 'decision_memo_to_execution_plan',
            title: 'Decision memo to execution plan',
            status: 'completed',
            steps: [
              {
                id: 'step-approval',
                kind: 'user_approval',
                title: 'Approve execution plan',
                summary: 'Approval before durable rollout output.',
                status: 'completed',
                approvalRequired: true,
                outputType: 'report',
                outputId: 'report-rollout-1',
                createdAt: '2026-05-03T00:00:00.000Z',
              },
            ],
            approvals: [
              {
                stepId: 'step-approval',
                status: 'approved',
                requiredCapability: 'work_canvas.workflow.approve',
              },
            ],
            outputs: [
              {
                stepId: 'step-output',
                type: 'report',
                id: 'report-rollout-1',
                title: 'Report: Rollout Gate Memo',
                url: '/work-canvas?draftId=report-rollout-1',
              },
            ],
            collaboration: {
              ownerId: 'user-1',
              reviewerId: 'reviewer-1',
              lifecycle: 'approved',
              comments: [
                {
                  id: 'comment-sensitive',
                  authorId: 'reviewer-1',
                  body: 'Do not leak this raw reviewer note into Teresa context.',
                  createdAt: '2026-05-03T00:01:00.000Z',
                },
              ],
            },
            events: [
              {
                id: 'event-output',
                type: 'output_created',
                actorId: 'user-1',
                summary: 'Created report output: Report: Rollout Gate Memo.',
                createdAt: '2026-05-03T00:02:00.000Z',
                metadata: { internalAuditPayload: 'raw metadata should stay out' },
              },
            ],
            createdBy: 'user-1',
            createdAt: '2026-05-03T00:00:00.000Z',
            updatedAt: '2026-05-03T00:02:00.000Z',
          },
        ],
      },
      {
        mode: 'document',
        draftId: 'draft-rollout-1',
        selectedText: 'Approve the Canvas rollout',
        start: 22,
        end: 48,
      }
    );

    expect(packet).toMatchObject({
      schemaVersion: 'canvas-context/v1',
      activeDraft: {
        draftId: 'draft-rollout-1',
        researchSessionId: 'rs-rollout-1',
        title: 'Rollout Gate Memo',
        kind: 'decision',
        saveState: 'saved',
      },
      selection: {
        draftId: 'draft-rollout-1',
        selectedText: 'Approve the Canvas rollout',
      },
      memorySnapshot: {
        anchors: {
          draftId: 'draft-rollout-1',
          researchSessionId: 'rs-rollout-1',
          title: 'Rollout Gate Memo',
          kind: 'decision',
          workflowRunIds: ['workflow-rollout-1'],
          blockIds: ['block-risk-table'],
        },
      },
    });
    expect(packet?.blockSummaries).toEqual([
      expect.objectContaining({
        blockId: 'block-risk-table',
        kind: 'table',
        markdownProjection: expect.stringContaining('| Risk | Mitigation |'),
      }),
    ]);
    expect(packet?.workflowRuns).toEqual([
      expect.objectContaining({
        id: 'workflow-rollout-1',
        lifecycle: 'approved',
        outputCount: 1,
        stepSummaries: [
          expect.objectContaining({ id: 'step-approval', outputId: 'report-rollout-1' }),
        ],
        approvalStatuses: [
          expect.objectContaining({ stepId: 'step-approval', status: 'approved' }),
        ],
      }),
    ]);
    expect(packet?.workflowEventSummaries).toEqual([
      expect.objectContaining({
        workflowRunId: 'workflow-rollout-1',
        eventType: 'output_created',
      }),
    ]);
    expect(packet?.workflowOutputSummaries).toEqual([
      expect.objectContaining({
        workflowRunId: 'workflow-rollout-1',
        id: 'report-rollout-1',
        url: '/work-canvas?draftId=report-rollout-1',
      }),
    ]);
    const serializedPacket = JSON.stringify(packet);
    expect(serializedPacket).not.toContain('secretInternalRows');
    expect(serializedPacket).not.toContain('Do not leak this raw reviewer note');
    expect(serializedPacket).not.toContain('internalAuditPayload');
  });

  it('lets users resize the chat and Canvas split from the Canvas edge', () => {
    // Split-width contract (M01-003, resolved in M01-P01): D17
    // (commit 6834ed2674, owner-authored, "layout(#D17): /chat split — Teresa
    // na PRAWO, artefakt na LEWO") deliberately reversed the split — canvas
    // moved to lg:order-1 (left), chat/Teresa to lg:order-2 (right) — and its
    // own commit message documents the matching formula change: "matematyka
    // resize: canvasPercent = clientX-rect.left (bez 100-)". The stored
    // value is the CANVAS's own width (it feeds --work-canvas-width, applied
    // directly as the canvas <aside>'s CSS width), measured as the
    // divider's distance from the shell's LEFT edge — because the canvas is
    // now the LEFT-hand pane, and the divider sits on its right edge.
    // This test's magic numbers (64/66) predated that reversal and were
    // never updated, which is what M01-003 flagged. Verified against the
    // implementation, not just the commit message: with the canvas on the
    // left, dragging the divider further LEFT (a smaller clientX) must
    // shrink the canvas — 45 (clamped at MIN_WORK_CANVAS_WIDTH_PERCENT) is
    // the geometrically correct result of this drag, not a bug.
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
      toJSON: () => ({}),
    });

    renderWithRouter(<UnifiedChatPanel mode="full" />);
    fireEvent.click(screen.getByTestId('chat-work-panel-button'));

    expect(screen.getByTestId('chat-work-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-work-panel-resizer')).not.toBeInTheDocument();
    const edgeResizer = screen.getByTestId('chat-work-panel-edge-resizer');
    expect(edgeResizer).toHaveAttribute('role', 'separator');

    // Drag the divider to clientX=500 (50% of the 1000px shell, exactly
    // representable in binary floating point — 550 would give
    // "55.00000000000001" from the (clientX / width) * 100 division, an
    // unrelated fp-precision artifact, not a contract question) — inside
    // the unclamped [45, 72] band, so this exercises the actual formula
    // rather than bottoming out at MIN_WORK_CANVAS_WIDTH_PERCENT.
    fireEvent.mouseDown(edgeResizer, { clientX: 600 });
    fireEvent.mouseMove(window, { clientX: 500 });
    fireEvent.mouseUp(window);
    expect(localStorage.getItem('workCanvas.splitWidthPercent')).toBe('50');

    // ArrowLeft narrows the canvas by 2 points (handleWorkCanvasEdgeKeyDown's
    // own comment: "ArrowLeft = węższy" — canvas is on the left, so
    // narrowing it is a DECREASE, not an increase).
    fireEvent.keyDown(edgeResizer, { key: 'ArrowLeft' });
    expect(localStorage.getItem('workCanvas.splitWidthPercent')).toBe('48');

    fireEvent.doubleClick(edgeResizer);
    expect(localStorage.getItem('workCanvas.splitWidthPercent')).toBe('60');

    rectSpy.mockRestore();
  });

  it('M01-030: with ?m=<id> present and the message loaded, jumps to and highlights the matched message', async () => {
    // tests/setup.ts replaces `window.location` with a static plain object
    // (to stub assign/replace/reload, since jsdom throws on real
    // navigation) — `window.history.pushState` therefore does NOT update
    // `window.location.search` in this test environment. The effect under
    // test reads `window.location.search` directly (global, not
    // react-router's `useLocation()` — matches the pre-existing
    // `?workPanel=` deep-link effect in the same file), so the location
    // object itself must be mutated directly instead.
    conversationStoreState.activeConversationId = 'conv-1';
    conversationStoreState.activeMessages = [
      { id: 'm1', role: 'user', content: 'hello', createdAt: new Date(), metadata: {} },
      { id: 'm2', role: 'ai', content: 'matched content', createdAt: new Date(), metadata: {} },
    ];
    Object.assign(window.location, { pathname: '/chat/conv-1', search: '?m=m2' });

    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    renderWithRouter(
      <UnifiedChatPanel
        customMessages={[
          { id: 'm1', role: 'user', content: 'hello', timestamp: new Date() } as any,
          { id: 'm2', role: 'ai', content: 'matched content', timestamp: new Date() } as any,
        ]}
      />
    );

    // `scrollIntoView` is also called by the unrelated auto-scroll-to-bottom
    // effect (`messagesEndRef.current?.scrollIntoView({behavior:'smooth'})`,
    // no `block`) — disambiguate by the deep-link effect's distinct call
    // shape (`{behavior:'smooth', block:'center'}`).
    await waitFor(() =>
      expect(scrollSpy).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth', block: 'center' })
      )
    );

    const anchor = document.querySelector('[data-message-anchor="m2"]');
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveClass('ring-c-focus');

    Object.assign(window.location, { pathname: '/chat', search: '' });
  });

  it('M01-030: without ?m= in the URL (post-consumption or an ordinary reload), nothing is scrolled/highlighted', async () => {
    // Simulates the state AFTER the deep link's `m` param has already been
    // consumed (navigateToRoute(..., {replace:true}) stripped it) — a hard
    // reload/fresh reopen at that point sees a plain `/chat/:id` URL, same
    // as opening the conversation any other way. Documents that `?m=` is a
    // one-shot jump, not a durable "always land on this message" contract.
    conversationStoreState.activeConversationId = 'conv-1';
    conversationStoreState.activeMessages = [
      { id: 'm1', role: 'user', content: 'hello', createdAt: new Date(), metadata: {} },
      { id: 'm2', role: 'ai', content: 'matched content', createdAt: new Date(), metadata: {} },
    ];
    Object.assign(window.location, { pathname: '/chat/conv-1', search: '' });

    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    renderWithRouter(
      <UnifiedChatPanel
        customMessages={[
          { id: 'm1', role: 'user', content: 'hello', timestamp: new Date() } as any,
          { id: 'm2', role: 'ai', content: 'matched content', timestamp: new Date() } as any,
        ]}
      />
    );

    // Give the effect a tick to (not) fire. `scrollIntoView` MAY still be
    // called by the unrelated auto-scroll-to-bottom effect
    // (`{behavior:'smooth'}`, no `block`) — that's expected and not what
    // this test is about. What must never happen is the deep-link jump's
    // distinct call shape.
    await act(async () => {
      await Promise.resolve();
    });
    expect(scrollSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', block: 'center' })
    );
  });

  it('new chat clears state and creates/selects a conversation', async () => {
    createConversationMock.mockResolvedValue({ id: 'conv-1' });
    renderWithRouter(<UnifiedChatPanel />);

    fireEvent.click(screen.getByTestId('chat-new-button'));
    await waitFor(() => expect(clearActiveChatMock).toHaveBeenCalled());
    await waitFor(() => expect(createConversationMock).toHaveBeenCalled());
    await waitFor(() => expect(setActiveConversationMock).toHaveBeenCalledWith('conv-1'));
  });

  it('shows Teresa fallback toast when creating a new chat fails', async () => {
    createConversationMock.mockRejectedValueOnce(new Error('create failed'));
    renderWithRouter(<UnifiedChatPanel />);

    fireEvent.click(screen.getByTestId('chat-new-button'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(setActiveConversationMock).not.toHaveBeenCalled();
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

  it.each([
    ['send-retired-task', 'task'],
    ['send-retired-decision', 'decision'],
  ] as const)(
    'fails governed slash command %s closed in the mounted panel without starting a chat write',
    async (buttonId, targetKind) => {
      conversationStoreState.activeConversationId = 'conv-governed-boundary';
      renderWithRouter(<UnifiedChatPanel onMessageSent={vi.fn()} />);

      fireEvent.click(screen.getByTestId(buttonId));

      await waitFor(() =>
        expect(addChatMessageMock).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'ai',
            content: expect.stringContaining(`No ${targetKind} was created`),
          })
        )
      );
      expect(addChatMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('/my-work?tab=agent') })
      );
      expect(addMessageToConversationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-governed-boundary',
          role: 'ai',
        })
      );
      expect(createConversationMock).not.toHaveBeenCalled();
      expect(startStreamMock).not.toHaveBeenCalled();
    }
  );

  it('uses the live store conversation when sending immediately after switching chats', async () => {
    conversationStoreState.activeConversationId = 'conv-old';
    conversationStoreState.activeMessages = [
      {
        id: 'old-msg',
        conversationId: 'conv-old',
        role: 'user',
        content: 'old context',
        createdAt: new Date(),
      },
    ];

    renderWithRouter(<UnifiedChatPanel onMessageSent={vi.fn()} />);

    conversationStoreState.activeConversationId = 'conv-new';
    conversationStoreState.activeMessages = [];

    fireEvent.click(screen.getByTestId('send-button'));

    await waitFor(() =>
      expect(addMessageToConversationMock).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-new', role: 'user', content: 'hello' })
      )
    );
    await waitFor(() => expect(startStreamMock).toHaveBeenCalled());
    expect(startStreamMock.mock.calls.at(-1)?.[1]).toEqual([]);
  });

  it('dispatches a localized access block code when demo time expires', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    demoState = {
      ...demoState,
      isDemo: true,
      timeRemainingMs: 0,
      aiInteractionsRemaining: 10,
      aiInteractionsLimit: 10,
    };

    renderWithRouter(<UnifiedChatPanel />);
    fireEvent.click(screen.getByTestId('send-button'));

    await waitFor(() => expect(dispatchSpy).toHaveBeenCalled());
    const event = dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent;
    expect(event.type).toBe('access:blocked');
    expect(event.detail).toEqual({ code: 'DEMO_TIME_EXPIRED' });
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

  // M01-P04A — size half of the format/size matrix (packet §3.3): an
  // in-matrix FORMAT that exceeds MAX_CHAT_ATTACHMENT_BYTES must be rejected
  // with a SPECIFIC reason (SIZE_LIMIT_EXCEEDED), not the generic
  // "unsupported format" message, and never uploaded to the server at all
  // (uploadChatAttachment must not be called — the matrix pre-check saves
  // the round-trip).
  it('rejects an oversized (but otherwise supported) file with a size-specific reason, without uploading it', async () => {
    createConversationMock.mockResolvedValue({ id: 'conv-1' });
    renderWithRouter(<UnifiedChatPanel />);

    fireEvent.click(screen.getByTestId('send-oversized'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(h.apiMock.uploadChatAttachment).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(addMessageToConversationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          metadata: expect.objectContaining({
            failedAttachments: [
              expect.objectContaining({
                filename: 'huge.pdf',
                code: 'SIZE_LIMIT_EXCEEDED',
              }),
            ],
          }),
        })
      )
    );
  });

  it('ingests URL attachments and persists them in message metadata', async () => {
    createConversationMock.mockResolvedValue({ id: 'conv-1' });
    h.apiMock.ingestChatUrlAttachment = vi.fn().mockResolvedValue({
      success: true,
      docId: 'url-doc-1',
      filename: 'Example page',
      mimeType: 'text/html',
      sourceUrl: 'https://example.com/report',
    });

    renderWithRouter(<UnifiedChatPanel />);

    fireEvent.click(screen.getByTestId('send-url'));

    await waitFor(() => expect(h.apiMock.ingestChatUrlAttachment).toHaveBeenCalled());
    await waitFor(() =>
      expect(addMessageToConversationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          metadata: expect.objectContaining({
            attachments: [
              expect.objectContaining({
                docId: 'url-doc-1',
                kind: 'url',
                sourceUrl: 'https://example.com/report',
              }),
            ],
          }),
        })
      )
    );
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

    await aiStreamOptionsCaptured.onStreamDone(
      '',
      [],
      [{ id: 'ar1', type: 'md', title: 'T', content: 'C' }],
      {
        citations: [{ url: 'x' }],
        sourceLedger: {
          type: 'source_ledger',
          used_sources: [{ id: 'doc-1', type: 'document' }],
          blocked_sources: [],
        },
        proposal: {
          proposalId: 'proposal-1',
          title: 'Create initiative',
          summary: 'Proposal summary',
          state: 'proposal',
          approvalState: 'awaiting_review',
          allowedActions: ['approve'],
          targetModule: 'initiatives',
          targetLabel: 'Initiatives',
          handoffIntent: 'create',
          previewLines: ['Approval required'],
          auditCount: 1,
          resultRef: null,
          degraded: null,
        },
      }
    );

    expect(addMessageToConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'ai',
        metadata: expect.objectContaining({
          artifacts: [expect.objectContaining({ id: 'ar1', title: 'T' })],
          citations: [{ url: 'x' }],
          sourceLedger: {
            type: 'source_ledger',
            used_sources: [{ id: 'doc-1', type: 'document' }],
            blocked_sources: [],
          },
          proposal: expect.objectContaining({ proposalId: 'proposal-1' }),
        }),
      })
    );
    expect(addChatMessageMock).toHaveBeenCalledWith(expect.objectContaining({ role: 'ai' }));
    expect(speakMock).toHaveBeenCalled();
  });

  it('persists a product-safe Teresa fallback when stream start fails', async () => {
    conversationStoreState.activeConversationId = 'conv-1';

    renderWithRouter(<UnifiedChatPanel />);
    expect(aiStreamOptionsCaptured?.onStreamError).toBeTypeOf('function');

    await aiStreamOptionsCaptured.onStreamError(new Error('provider boot failed'));

    expect(addMessageToConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        role: 'ai',
        content:
          '⚠️ Teresa is temporarily unavailable. Please try again in a moment. If the problem persists, start a new chat or refresh the view.',
        metadata: expect.objectContaining({
          error: 'provider boot failed',
        }),
      })
    );
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
      expect.objectContaining({
        role: 'ai',
        content: expect.stringContaining('Agent Audit (post Deep Thinking)'),
      })
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
      expect.objectContaining({
        metadata: expect.objectContaining({ agentAudit: expect.anything() }),
      })
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

  // ==========================================================================
  // RISK-30 (S22-TERESA, 2026-08-12) — reply layer honesty for Teresa's
  // idea-action tool calls. Every test here asserts what `addChatMessage` was
  // called with — the exact `content` string that `MessageRenderer` puts on
  // screen for an AI message (this file's own precedent for "what the user
  // sees", e.g. the "agent audit accept" test above) — never just the raw
  // `ActionResult` object. `executeTeresaTool` is fully mocked
  // (`h.executeTeresaToolMock`) so each test controls exactly the result
  // `onIdeaAction`/`handleTeresaConfirmProceed` receive, independent of the
  // real registry (covered separately for the runtimeHelpers.ts migration).
  // ==========================================================================
  describe('RISK-30 S22 — Teresa idea-action reply layer', () => {
    // The outer `beforeEach` above only does `vi.clearAllMocks()`, which
    // clears call history but NOT queued `mockResolvedValueOnce`/
    // `mockRejectedValueOnce` implementations — those survive a retry
    // (`vitest.config.ts` retries once locally), so a failed first attempt
    // can leave an unconsumed queued value that shifts the RETRY's calls out
    // of order. `mockReset()` clears the queue too; each test queues its own.
    beforeEach(() => {
      h.executeTeresaToolMock.mockReset();
    });

    // Fake `t` matching real i18next's `{{var}}` interpolation (the global
    // test-setup mock in `tests/setup.ts` only replaces single-brace `{var}`,
    // a test-environment quirk unrelated to production — see the "unconfirmed"
    // component-level test below, which asserts via `toMatch`/`toContain`
    // specifically to stay correct under that quirk). This unit describe
    // tests the pure function directly, so it uses the REAL interpolation
    // syntax the production keys actually use.
    const fakeT = (_key: string, opts: { defaultValue: string; action?: string }) =>
      opts.defaultValue.replace('{{action}}', String(opts.action ?? ''));

    describe('describeUnconfirmedTeresaResult (pure helper — decides what the user sees)', () => {
      it("passes an existing result.message through verbatim (refusals keep the registry's own text)", () => {
        const content = unifiedChatPrivate.describeUnconfirmedTeresaResult(
          { ok: false, actionId: 'x', message: 'Nie mogę tego zrobić.' },
          'idea_x',
          fakeT
        );
        expect(content).toBe('Nie mogę tego zrobić.');
      });

      it('ok:true + confirmed:true + no message -> null (a real confirmation is not the RISK-30 defect)', () => {
        const content = unifiedChatPrivate.describeUnconfirmedTeresaResult(
          { ok: true, actionId: 'x', confirmed: true },
          'idea_x',
          fakeT
        );
        expect(content).toBeNull();
      });

      it('ok:true + confirmed:false + no message -> honest "unconfirmed" fallback naming the action', () => {
        const content = unifiedChatPrivate.describeUnconfirmedTeresaResult(
          { ok: true, actionId: 'x', confirmed: false },
          'idea_lane_pf_delete',
          fakeT
        );
        expect(content).toContain('idea_lane_pf_delete');
        expect(content).toMatch(/nie mam potwierdzenia/i);
      });

      it('ok:true + confirmed left undefined (never-migrated shape) is treated exactly like confirmed:false', () => {
        const content = unifiedChatPrivate.describeUnconfirmedTeresaResult(
          { ok: true, actionId: 'x' },
          'idea_y',
          fakeT
        );
        expect(content).toContain('idea_y');
        expect(content).toMatch(/nie mam potwierdzenia/i);
      });

      it('ok:false + no message (defensive — registry convention says this should not happen) -> honest generic refusal naming the action', () => {
        const content = unifiedChatPrivate.describeUnconfirmedTeresaResult(
          { ok: false, actionId: 'x' },
          'idea_z',
          fakeT
        );
        expect(content).toContain('idea_z');
        expect(content).toMatch(/odmówił/i);
      });

      it('no result at all (the catch/exception path) -> null, left to the caller', () => {
        const content = unifiedChatPrivate.describeUnconfirmedTeresaResult(
          undefined,
          'idea_w',
          fakeT
        );
        expect(content).toBeNull();
      });
    });

    // Populates `teresaIdeaCtxRef` (a ref read only inside `onIdeaAction`) by
    // driving the SAME path a real Idea workspace uses: broadcast the active
    // tool, then send one message so `handleSendMessage` runs and captures it
    // — exactly like the pre-existing "agent audit (post Deep Thinking)" test
    // above (`renderWithRouter` + `send-button` + `waitFor(startStreamMock)`).
    async function openMindmapContextAndSend() {
      act(() => {
        window.dispatchEvent(
          new CustomEvent('idea-workspace-active-tool', { detail: { tool: 'mindmap' } })
        );
      });
      fireEvent.click(screen.getByTestId('send-button'));
      await waitFor(() => expect(startStreamMock).toHaveBeenCalled());
    }

    // `displayMessages` is `customMessages || messages` — an EMPTY array is
    // still truthy in JS, so `customMessages={[]}` would permanently starve
    // `.map(renderMessage)` and `MessageRenderer` (and the `teresaPendingConfirm`
    // props it carries) would never render even once, regardless of how many
    // `addChatMessage` calls happen afterwards (that mock has no store side
    // effect — same reason the pre-existing tests in this file seed BOTH
    // `conversationStoreState.activeMessages` and a matching `customMessages`
    // prop, e.g. the "inline edit & regenerate" test above). One seed row is
    // enough to give `MessageRenderer` a mount point to read live props from.
    function renderWithIdeaWorkspace() {
      conversationStoreState.activeMessages = [
        { id: 'seed-1', role: 'user', content: 'hi', createdAt: new Date(), metadata: {} },
      ];
      return renderWithRouter(
        <UnifiedChatPanel
          workspaceContext={
            {
              view: 'MY_WORK',
              type: 'idea',
              entityId: 'idea-1',
              timestamp: new Date(),
            } as any
          }
          customMessages={[
            { id: 'seed-1', role: 'user', content: 'hi', timestamp: new Date() } as any,
          ]}
        />
      );
    }

    it('proposal -> confirm -> execution -> result: shows the confirm prompt, then the real result after Confirm', async () => {
      conversationStoreState.activeConversationId = 'conv-risk30-1';
      h.executeTeresaToolMock
        .mockResolvedValueOnce({
          ok: false,
          actionId: 'idea.lane.pf_delete',
          message: 'Usunąć jedyny tor? Nie da się tego cofnąć.',
          data: { needsConfirmation: true },
        })
        .mockResolvedValueOnce({
          ok: true,
          actionId: 'idea.lane.pf_delete',
          confirmed: true,
          message: 'Usunięto tor.',
        });

      renderWithIdeaWorkspace();
      await openMindmapContextAndSend();

      await act(async () => {
        await aiStreamOptionsCaptured.onIdeaAction({
          toolName: 'idea_lane_pf_delete',
          args: { laneId: 'lane-1' },
        });
      });

      // The confirm prompt is exactly the registry's own message — no
      // fallback text needed, `result.message` was present.
      expect(addChatMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Usunąć jedyny tor? Nie da się tego cofnąć.',
          metadata: { teresaConfirm: true },
        })
      );

      const proceedBtn = await screen.findByTestId('teresa-confirm-proceed');
      fireEvent.click(proceedBtn);

      await waitFor(() => expect(h.executeTeresaToolMock).toHaveBeenCalledTimes(2));
      // The second call is the REAL confirmed execution — same tool, `confirmed: true`.
      expect(h.executeTeresaToolMock.mock.calls[1][0]).toBe('idea_lane_pf_delete');
      expect(h.executeTeresaToolMock.mock.calls[1][1]).toEqual(
        expect.objectContaining({ confirmed: true })
      );
      await waitFor(() =>
        expect(addChatMessageMock).toHaveBeenCalledWith(
          expect.objectContaining({ content: 'Usunięto tor.' })
        )
      );
    });

    it('decline: registry refusal shows its own message, with no confirm buttons', async () => {
      conversationStoreState.activeConversationId = 'conv-risk30-2';
      h.executeTeresaToolMock.mockResolvedValueOnce({
        ok: false,
        actionId: 'idea.lane.pf_delete',
        message:
          'NIE usunąłem toru `lane-1` — to jedyny pozostały tor Przepływu, a przepływ bez torów nie jest poprawnym stanem.',
      });

      renderWithIdeaWorkspace();
      await openMindmapContextAndSend();

      await act(async () => {
        await aiStreamOptionsCaptured.onIdeaAction({
          toolName: 'idea_lane_pf_delete',
          args: { laneId: 'lane-1' },
        });
      });

      expect(addChatMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('NIE usunąłem toru'),
        })
      );
      // A plain refusal never sets `teresaConfirm` metadata and never renders
      // the confirm block — the screen shows exactly one honest message, no
      // buttons implying there is anything left to confirm.
      const call = addChatMessageMock.mock.calls.find((c) =>
        String(c[0]?.content || '').includes('NIE usunąłem toru')
      );
      expect(call?.[0]?.metadata).toBeUndefined();
      expect(screen.queryByTestId('teresa-confirm-block')).not.toBeInTheDocument();
    });

    it('cancel: clicking "Anuluj" posts the cancellation message and never re-invokes the tool', async () => {
      conversationStoreState.activeConversationId = 'conv-risk30-3';
      h.executeTeresaToolMock.mockResolvedValueOnce({
        ok: false,
        actionId: 'idea.lane.pf_delete',
        message: 'Usunąć jedyny tor? Nie da się tego cofnąć.',
        data: { needsConfirmation: true },
      });

      renderWithIdeaWorkspace();
      await openMindmapContextAndSend();

      await act(async () => {
        await aiStreamOptionsCaptured.onIdeaAction({
          toolName: 'idea_lane_pf_delete',
          args: { laneId: 'lane-1' },
        });
      });

      const cancelBtn = await screen.findByTestId('teresa-confirm-cancel');
      fireEvent.click(cancelBtn);

      expect(addChatMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Cancelled.' })
      );
      // Cancelling never re-calls the tool — only the ORIGINAL (unconfirmed) call happened.
      expect(h.executeTeresaToolMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('teresa-confirm-block')).not.toBeInTheDocument();
    });

    it('error: a thrown/rejected tool call still posts a truthful message naming the action', async () => {
      conversationStoreState.activeConversationId = 'conv-risk30-4';
      h.executeTeresaToolMock.mockRejectedValueOnce(new Error('network exploded'));

      renderWithIdeaWorkspace();
      await openMindmapContextAndSend();

      await act(async () => {
        await aiStreamOptionsCaptured.onIdeaAction({
          toolName: 'idea_lane_pf_delete',
          args: { laneId: 'lane-1' },
        });
      });

      // BEFORE this change, the catch block only did `console.warn` — the
      // model's already-streamed reply stood unchallenged on screen. Now a
      // real message lands, naming the tool that failed.
      await waitFor(() =>
        expect(addChatMessageMock).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('idea_lane_pf_delete'),
          })
        )
      );
      const call = addChatMessageMock.mock.calls.find((c) =>
        String(c[0]?.content || '').includes('idea_lane_pf_delete')
      );
      expect(String(call?.[0]?.content)).toMatch(/błąd|error/i);
    });

    it('unconfirmed/timeout: ok:true with confirmed:false and no message still posts an honest, non-success message naming the action', async () => {
      conversationStoreState.activeConversationId = 'conv-risk30-5';
      // Shape of a migrated UI-closure site (`runUiClosureAsync`) whose
      // closure returned nothing usable, or a bus dispatch whose
      // `awaitQuickActionAck` resolved `no_receiver` — `ok:true`,
      // `confirmed:false`, and (the defect) NO `message`.
      h.executeTeresaToolMock.mockResolvedValueOnce({
        ok: true,
        actionId: 'idea.node.duplicate',
        confirmed: false,
      });

      renderWithIdeaWorkspace();
      await openMindmapContextAndSend();

      await act(async () => {
        await aiStreamOptionsCaptured.onIdeaAction({
          toolName: 'idea_node_duplicate',
          args: {},
        });
      });

      // BEFORE this change: `if (result?.message)` was false (no message),
      // so `addChatMessage` was NEVER called — the model's streamed "done"
      // stood unchallenged. Now a message is posted, and it must not read as
      // a plain success.
      await waitFor(() =>
        expect(addChatMessageMock).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('idea_node_duplicate'),
          })
        )
      );
      const call = addChatMessageMock.mock.calls.find((c) =>
        String(c[0]?.content || '').includes('idea_node_duplicate')
      );
      const shown = String(call?.[0]?.content || '');
      // Explicitly says NO confirmation exists — "nie mam potwierdzenia" —
      // never a bare claim of success on its own (a standalone "Zrobione."/
      // "Done." would be the RISK-30 defect this test guards against).
      expect(shown).toMatch(/nie mam potwierdzenia|no confirmation/i);
      expect(shown.trim().toLowerCase()).not.toBe('zrobione.');
      expect(shown.trim().toLowerCase()).not.toBe('done.');
    });
  });
});
