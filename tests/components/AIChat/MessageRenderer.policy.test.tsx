import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageRenderer, type MessageRendererProps } from '../../../src/components/AIChat/MessageRenderer';

function buildProps(overrides?: Partial<MessageRendererProps>): MessageRendererProps {
  const message = {
    id: 'm-ai-policy-1',
    role: 'ai',
    content: 'AI content',
    timestamp: new Date(),
    isStreaming: false,
    metadata: {},
  } as any;

  return {
    msg: message,
    index: 0,
    displayMessages: [message],
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

describe('MessageRenderer policy UX (P34-B)', () => {
  it('renders refusal callout with next steps when policyDecision.allowed=false', () => {
    const msg = {
      id: 'm-ai-deny',
      role: 'ai',
      content: 'Refusal text body',
      timestamp: new Date(),
      isStreaming: false,
      metadata: {
        policyDecision: {
          allowed: false,
          rationale: 'Sensitive data request detected',
          refusal: {
            nextSteps: ['Use official reset/admin channels.', 'Describe your security goal.'],
          },
        },
      },
    } as any;

    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg] })} />);

    expect(screen.getByText('Request blocked by policy')).toBeInTheDocument();
    expect(screen.getByText('What to do next')).toBeInTheDocument();
    expect(screen.getByText('Use official reset/admin channels.')).toBeInTheDocument();
  });

  it('renders uncertainty notice when policy_notice(kind=uncertainty) is present', () => {
    const msg = {
      id: 'm-ai-uncertainty',
      role: 'ai',
      content: 'A factful answer',
      timestamp: new Date(),
      isStreaming: false,
      metadata: {
        policyDecision: { allowed: true },
        policyNotices: [{ type: 'policy_notice', kind: 'uncertainty', message: 'Citations were insufficient.' }],
      },
    } as any;

    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg] })} />);

    expect(screen.getByText('Uncertainty marker')).toBeInTheDocument();
    expect(screen.getByText('Citations were insufficient.')).toBeInTheDocument();
    expect(screen.queryByText('Request blocked by policy')).not.toBeInTheDocument();
  });

  it('renders no-sources notice and a non-leaky blocked-scope ledger when present', () => {
    const msg = {
      id: 'm-ai-no-sources',
      role: 'ai',
      content: 'A general answer',
      timestamp: new Date(),
      isStreaming: false,
      metadata: {
        policyDecision: { allowed: true },
        policyNotices: [
          {
            type: 'policy_notice',
            kind: 'no_sources',
            message: 'No sources in allowed scope — explicit marker added.',
          },
        ],
        sourceLedger: {
          type: 'source_ledger',
          used_sources: [],
          blocked_sources: [{ category: 'other_user_private', reason: 'forbidden_by_policy' }],
          degraded: { mode: 'no_sources', reason: 'no_citations_collected' },
        },
      },
    } as any;

    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg] })} />);

    expect(screen.getByText('No sources found')).toBeInTheDocument();
    expect(screen.getByText('No sources in allowed scope — explicit marker added.')).toBeInTheDocument();
    expect(screen.getByText('Source ledger')).toBeInTheDocument();
    expect(screen.getByText(/other_user_private/i)).toBeInTheDocument();
    // Ledger must not enumerate any forbidden object identifiers.
    expect(screen.queryByText(/doc_/i)).not.toBeInTheDocument();
  });
});

