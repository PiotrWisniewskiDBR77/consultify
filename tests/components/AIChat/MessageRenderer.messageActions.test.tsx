import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reportMessageFeedback = vi.fn();

vi.mock('../../../src/services/api', () => ({
  Api: {
    reportMessageFeedback: (...args: unknown[]) => reportMessageFeedback(...args),
  },
  api: {
    reportMessageFeedback: (...args: unknown[]) => reportMessageFeedback(...args),
  },
  getHeaders: () => ({}),
  API_URL: '/api',
  default: {
    reportMessageFeedback: (...args: unknown[]) => reportMessageFeedback(...args),
  },
}));

import {
  MessageRenderer,
  type MessageRendererProps,
} from '../../../src/components/AIChat/MessageRenderer';

const USER_MESSAGE = {
  id: 'm-user-1',
  role: 'user',
  content: 'Summarise the Q3 plan.',
  timestamp: new Date(),
  isStreaming: false,
} as any;

const AI_MESSAGE = {
  id: 'm-ai-1',
  role: 'ai',
  content: 'Here is the summary.',
  timestamp: new Date(),
  isStreaming: false,
} as any;

function buildProps(overrides?: Partial<MessageRendererProps>): MessageRendererProps {
  return {
    msg: AI_MESSAGE,
    index: 1,
    displayMessages: [USER_MESSAGE, AI_MESSAGE],
    isCompact: false,
    isDisabled: false,
    isRtlChatLanguage: false,
    activeConversationId: 'conv-1',
    thinkingSteps: [],
    streamStartedAt: null,
    streamCompletedSignal: false,
    retryInfo: null,
    abortFeedback: null,
    agentAuditState: null,
    agentAuditBusy: false,
    agentRegistryById: {},
    agentReviewProgressByAgentId: {},
    agentSourcesByAgentId: {},
    agentAuditActiveTabByMessageId: {},
    setAgentAuditActiveTabByMessageId: vi.fn(),
    deepThinkingHint: null,
    dtHintDismissed: true,
    dtPendingConfirm: null,
    setDtPendingConfirm: vi.fn(),
    dtConfirmBusy: false,
    dtSavingDecision: null,
    dtDecisionSaved: new Set(),
    interimInsight: null,
    aiConfig: {},
    editingMessageId: null,
    editingText: '',
    editBusy: false,
    setEditingText: vi.fn(),
    hoveredMessageId: null,
    setHoveredMessageId: vi.fn(),
    copiedMessageId: null,
    contextSaveBusyMessageId: null,
    contextSavedMessageIds: new Set(),
    selectedMultiOptions: [],
    voiceState: { isSpeaking: false },
    handleCopyMessage: vi.fn(),
    handleStartEditMessage: vi.fn(),
    handleCancelEditMessage: vi.fn(),
    handleCommitEditMessage: vi.fn(),
    handleViewArtifacts: vi.fn(),
    handleFeedback: vi.fn(),
    handleSendMessage: vi.fn(),
    handleEnableDeepThinking: vi.fn(),
    handleDeepThinkingProceed: vi.fn(),
    handleDeepThinkingReconfirm: vi.fn(),
    handleSaveAsDecision: vi.fn(),
    handleSaveAsIdea: vi.fn(),
    handleSaveAsNote: vi.fn(),
    handleSaveToContext: vi.fn(),
    handleRunDirectedDeepening: vi.fn(),
    handleMultiSelectToggle: vi.fn(),
    handleMultiSelectConfirm: vi.fn(),
    refreshAgentAuditSuggestionsOnly: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    setDtHintDismissed: vi.fn(),
    addArtifact: vi.fn(),
    toggleArtifactsPanel: vi.fn(),
    exportArtifact: vi.fn(),
    handleAgentAuditAccept: vi.fn(async () => {}),
    ...overrides,
  };
}

/** Opens the "More actions" menu on the AI message row. */
function openMoreActions() {
  fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
}

describe('MessageRenderer message actions (M01-010)', () => {
  beforeEach(() => {
    reportMessageFeedback.mockReset();
    reportMessageFeedback.mockResolvedValue({ success: true });
  });

  it('regenerate re-sends the preceding user message', () => {
    const handleSendMessage = vi.fn();
    render(<MessageRenderer {...buildProps({ handleSendMessage })} />);

    openMoreActions();
    fireEvent.click(screen.getByTestId('message-action-regenerate'));

    expect(handleSendMessage).toHaveBeenCalledTimes(1);
    expect(handleSendMessage).toHaveBeenCalledWith('Summarise the Q3 plan.');
  });

  it('keeps regenerate mounted but disabled when there is no preceding user message', () => {
    render(
      <MessageRenderer {...buildProps({ index: 0, displayMessages: [AI_MESSAGE] })} />
    );

    openMoreActions();
    expect(screen.getByTestId('message-action-regenerate')).toBeDisabled();
  });

  it('continue sends a continuation instruction through the same send path', () => {
    const handleSendMessage = vi.fn();
    render(<MessageRenderer {...buildProps({ handleSendMessage })} />);

    openMoreActions();
    fireEvent.click(screen.getByTestId('message-action-continue'));

    expect(handleSendMessage).toHaveBeenCalledTimes(1);
    expect(handleSendMessage).toHaveBeenCalledWith(
      'Continue the previous answer from where it stopped.'
    );
  });

  it('report calls Api.reportMessageFeedback with the chosen reason and confirms', async () => {
    render(<MessageRenderer {...buildProps()} />);

    openMoreActions();
    fireEvent.click(screen.getByTestId('message-action-report'));

    const dialog = screen.getByTestId('message-report-dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Harmful or unsafe content' }));
    fireEvent.click(screen.getByTestId('message-report-submit'));

    await waitFor(() => {
      expect(reportMessageFeedback).toHaveBeenCalledWith('m-ai-1', 'harmful');
    });
    await waitFor(() => {
      expect(screen.getByTestId('message-report-status')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('message-report-dialog')).not.toBeInTheDocument();
  });

  it('sends the free-text reason when "other" is chosen', async () => {
    render(<MessageRenderer {...buildProps()} />);

    openMoreActions();
    fireEvent.click(screen.getByTestId('message-action-report'));

    const dialog = screen.getByTestId('message-report-dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Other issue' }));
    fireEvent.change(screen.getByTestId('message-report-other-text'), {
      target: { value: 'It invented a client name' },
    });
    fireEvent.click(screen.getByTestId('message-report-submit'));

    await waitFor(() => {
      expect(reportMessageFeedback).toHaveBeenCalledWith('m-ai-1', 'It invented a client name');
    });
  });

  it('surfaces an error when the report call rejects (no false success)', async () => {
    reportMessageFeedback.mockRejectedValue(new Error('Failed to report message'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<MessageRenderer {...buildProps()} />);

    openMoreActions();
    fireEvent.click(screen.getByTestId('message-action-report'));
    fireEvent.click(screen.getByTestId('message-report-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('message-report-error')).toBeInTheDocument();
    });
    // The dialog stays open and no success confirmation is shown.
    expect(screen.getByTestId('message-report-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('message-report-status')).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('closes the report dialog on Escape and returns focus to the trigger', () => {
    render(<MessageRenderer {...buildProps()} />);

    openMoreActions();
    const trigger = screen.getByTestId('message-action-report');
    fireEvent.click(trigger);
    expect(screen.getByTestId('message-report-dialog')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('message-report-dialog'), { key: 'Escape' });

    expect(screen.queryByTestId('message-report-dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders the Branch action exactly once across a user + AI message pair', () => {
    const handleBranchFromMessage = vi.fn();
    const props = buildProps({ handleBranchFromMessage });

    render(
      <>
        <MessageRenderer {...props} msg={USER_MESSAGE} index={0} />
        <MessageRenderer {...props} msg={AI_MESSAGE} index={1} />
      </>
    );

    // Expand the AI "More actions" menu — the duplicate used to live there.
    openMoreActions();

    expect(screen.getAllByTitle('Branch from here')).toHaveLength(1);
  });

  it('keeps Report mounted but disabled on a message that has not been persisted yet', () => {
    // /api/ai/report validates messageId as a uuid, so an optimistic `local-`
    // id could only ever come back 400. Offering the action would be a button
    // that cannot succeed.
    render(
      <MessageRenderer
        {...buildProps()}
        msg={{ ...AI_MESSAGE, id: 'local-pending-1' }}
        index={1}
      />
    );

    openMoreActions();

    expect(screen.getByTestId('message-action-report')).toBeDisabled();
    // The other actions remain available.
    expect(screen.getByTestId('message-action-continue')).toBeInTheDocument();
  });

  it('keeps one stable disabled capsule while a response is streaming', () => {
    render(
      <MessageRenderer
        {...buildProps()}
        msg={{ ...AI_MESSAGE, isStreaming: true }}
      />
    );

    const capsule = screen.getByTestId('message-response-actions');
    expect(capsule).toHaveAttribute('data-response-state', 'streaming');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Speak' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeDisabled();
    expect(screen.getByTestId('message-response-actions-expanded')).toBeInTheDocument();
  });

  it('uses the same capsule for long code-rich and error responses', () => {
    const handleCopyMessage = vi.fn();
    const longCode = `${'Detailed client context. '.repeat(80)}\n\n\`\`\`ts\nconst answer = 42;\n\`\`\``;
    const { rerender } = render(
      <MessageRenderer
        {...buildProps({ handleCopyMessage })}
        msg={{ ...AI_MESSAGE, content: longCode }}
      />
    );
    expect(screen.getAllByTestId('message-response-actions')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(handleCopyMessage).toHaveBeenCalledWith(longCode, 'm-ai-1');

    rerender(
      <MessageRenderer
        {...buildProps()}
        msg={{ ...AI_MESSAGE, content: 'The response failed safely.', error: 'provider_timeout' } as any}
      />
    );
    expect(screen.getAllByTestId('message-response-actions')).toHaveLength(1);
    expect(screen.getByTestId('message-response-actions')).toHaveAttribute(
      'data-response-state',
      'ready'
    );
  });

  /**
   * M01-P03 §7 — "Feedback: zapis → hard reload → wartość zachowana". Before
   * this fix `InlineResponseFeedback` always mounted with blank
   * rating/submitted state, so a message the user had already rated showed
   * the SAME thumbs-up/down prompt again after a fresh reopen — nothing
   * round-tripped the saved value. This asserts a message carrying a
   * persisted `feedback` renders the "already rated" confirmation
   * immediately, with no click required.
   */
  it('shows the message as already rated when it carries persisted feedback (fresh-reopen simulation)', () => {
    render(
      <MessageRenderer
        {...buildProps()}
        msg={{
          ...AI_MESSAGE,
          feedback: { rating: 'positive', timestamp: new Date() },
        }}
        index={1}
      />
    );

    openMoreActions();

    // The "already rated" confirmation, not the blank thumbs-up/down prompt.
    expect(screen.getByText('Thank you for your feedback!')).toBeInTheDocument();
    expect(screen.queryByTitle('Pomocne')).not.toBeInTheDocument();
  });

  it('shows the blank rating prompt when the message has no persisted feedback', () => {
    render(<MessageRenderer {...buildProps()} />);

    openMoreActions();

    expect(screen.queryByText('Thank you for your feedback!')).not.toBeInTheDocument();
  });
});
