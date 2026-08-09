import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  MessageRenderer,
  sanitizeUserVisibleAiText,
  type MessageRendererProps,
} from '../../../src/components/AIChat/MessageRenderer';

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
  it('renders persisted execution proposals using messageType', () => {
    const onProposalApprove = vi.fn();
    const msg = {
      id: 'm-ai-proposal',
      role: 'ai',
      content: 'Create the initiative after review.',
      timestamp: new Date(),
      messageType: 'execution_proposal',
      metadata: {
        executionProposal: {
          proposalId: 'proposal-123',
          lifecycleState: 'pending_review',
          planSummary: 'Create the initiative after review.',
        },
      },
    } as any;

    render(
      <MessageRenderer
        {...buildProps({
          msg,
          displayMessages: [msg],
          onProposalApprove,
          onProposalReject: vi.fn(),
          onProposalExecute: vi.fn(),
        })}
      />
    );

    expect(screen.getByTestId('execution-proposal-message')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(onProposalApprove).toHaveBeenCalledWith('proposal-123', msg);
  });

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

  it('keeps uncertainty audit notices hidden unless explicitly user-visible', () => {
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

    expect(screen.queryByText('Uncertainty marker')).not.toBeInTheDocument();
    expect(screen.queryByText('Citations were insufficient.')).not.toBeInTheDocument();
    expect(screen.queryByText('Request blocked by policy')).not.toBeInTheDocument();
  });

  it('renders explicitly visible no-sources notice without leaking the blocked-scope ledger', () => {
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
            displayToUser: true,
            message: 'No sources in allowed scope.',
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
    expect(screen.getByText('No sources in allowed scope.')).toBeInTheDocument();
    expect(screen.queryByText('Source ledger')).not.toBeInTheDocument();
    expect(screen.queryByText(/other_user_private/i)).not.toBeInTheDocument();
    // Ledger must not enumerate any forbidden object identifiers or policy internals.
    expect(screen.queryByText(/doc_/i)).not.toBeInTheDocument();
  });

  it('renders expandable TrustBundleV1 details without raw source ledger', () => {
    const msg = {
      id: 'm-ai-trust-bundle',
      role: 'ai',
      content: 'A sourced answer [1]',
      timestamp: new Date(),
      isStreaming: false,
      metadata: {
        deepThinking: { kind: 'report' },
        trustBundle: {
          version: 'TrustBundleV1',
          answerId: 'answer-1',
          conversationId: 'conv-1',
          messageId: 'msg-1',
          model: 'gpt-4o-mini',
          provider: 'openai',
          tier: 'STANDARD',
          sourceClasses: ['product_knowledge', 'web_research', 'mixed'],
          citationsCount: 1,
          sourceLedgerSummary: {
            usedCount: 1,
            blockedCount: 1,
            degraded: null,
          },
          confidence: 0.86,
          tokens: { input: 10, output: 20, total: 30 },
          warnings: [],
        },
      },
    } as any;

    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg] })} />);

    // Trust details now live behind the compact "More actions" → "Sources
    // details" disclosure rather than rendering inline by default.
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sources details' }));

    expect(screen.getByTestId('sources-strip')).toHaveTextContent('Product Knowledge');
    expect(screen.getByTestId('trust-panel')).toHaveTextContent('Why this answer? Trust details');
    expect(screen.getByTestId('trust-panel')).toHaveTextContent('Confidence: 86%');
    expect(screen.queryByText(/source_ledger/i)).not.toBeInTheDocument();
  });

  it('suppresses no-sources notice when citations are attached', () => {
    const msg = {
      id: 'm-ai-with-sources',
      role: 'ai',
      content: 'A cited answer [1]',
      timestamp: new Date(),
      isStreaming: false,
      citations: [
        {
          id: 'c1',
          title: 'DBR77 Marketplace',
          type: 'external',
          reference: 'dbr77.com',
          link: 'https://dbr77.com',
        },
      ],
      metadata: {
        deepThinking: { kind: 'report' },
        policyNotices: [
          {
            type: 'policy_notice',
            kind: 'no_sources',
            message: 'No sources in allowed scope — explicit marker added.',
          },
        ],
      },
    } as any;

    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg] })} />);

    expect(screen.queryByText('No sources found')).not.toBeInTheDocument();

    // The deep-search sources list is revealed via the compact disclosure.
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sources details' }));
    expect(screen.getByText('Deep search sources')).toBeInTheDocument();
  });

  it('renders source cards for regular chat answers when citations are attached', () => {
    const msg = {
      id: 'm-ai-regular-with-sources',
      role: 'ai',
      content: 'A regular cited answer [1]',
      timestamp: new Date(),
      isStreaming: false,
      citations: [
        {
          id: 'c1',
          title: 'Regular chat source',
          type: 'external',
          reference: 'example.com',
          link: 'https://example.com',
        },
      ],
      metadata: {},
    } as any;

    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg] })} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sources details' }));
    fireEvent.click(screen.getByText('Deep search sources'));
    expect(screen.getByText('Regular chat source')).toBeInTheDocument();
  });

  it('sanitizes internal source/debug markers from user-visible AI text', () => {
    const clean = sanitizeUserVisibleAiText(
      'Maturity is below benchmark [DT].\nNo sources: internal audit text\nRisk repeats from memory [MEM]. Source trace rag_1.'
    );

    expect(clean).toContain('Maturity is below benchmark.');
    expect(clean).toContain('Risk repeats from memory.');
    expect(clean).not.toMatch(/\[(?:DT|MEM)\]/);
    expect(clean).not.toMatch(/\brag_1\b/);
    expect(clean).not.toContain('No sources: internal audit text');
  });

  it('sanitizes markdown and bullet variants of "No cited sources" debug lines', () => {
    const clean = sanitizeUserVisibleAiText(
      [
        'Answer line 1.',
        '- **No cited sources**',
        '2) No cited sources',
        '* No cited sources',
        'Answer line 2.',
      ].join('\n')
    );

    expect(clean).toContain('Answer line 1.');
    expect(clean).toContain('Answer line 2.');
    expect(clean).not.toMatch(/No cited sources/i);
  });

  it('uses sanitized AI content for user actions like copy and text-to-speech', async () => {
    const handleCopyMessage = vi.fn();
    const speak = vi.fn();
    const msg = {
      id: 'm-ai-actions',
      role: 'ai',
      content: 'Maturity is low [DT].\nNo sources: audit-only diagnostic\nMemory pattern repeats [MEM].',
      timestamp: new Date(),
      isStreaming: false,
      metadata: {},
    } as any;

    render(
      <MessageRenderer
        {...buildProps({
          msg,
          displayMessages: [msg],
          hoveredMessageId: msg.id,
          handleCopyMessage,
          speak,
        })}
      />
    );

    fireEvent.click(screen.getByTitle('Copy'));
    expect(handleCopyMessage).toHaveBeenCalledWith(
      'Maturity is low.\nMemory pattern repeats.',
      msg.id
    );

    fireEvent.click(screen.getByTitle('Speak'));
    await waitFor(() =>
      expect(speak).toHaveBeenCalledWith('Maturity is low.\nMemory pattern repeats.')
    );
  });

  it('sanitizes internal markers from rendered citation titles and excerpts', () => {
    const msg = {
      id: 'm-ai-citation-markers',
      role: 'ai',
      content: 'A cited answer [1]',
      timestamp: new Date(),
      isStreaming: false,
      citations: [
        {
          id: 'c1',
          title: 'Decision memory [MEM]',
          type: 'report',
          reference: 'MEM: prior decision log',
          excerpt: 'Repeated risk pattern [DT]',
        },
      ],
      metadata: { deepThinking: { kind: 'report' } },
    } as any;

    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg] })} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sources details' }));
    fireEvent.click(screen.getByText('Deep search sources'));
    expect(screen.getByText('Decision memory')).toBeInTheDocument();
    expect(screen.getByText('prior decision log')).toBeInTheDocument();
    expect(screen.getByText('"Repeated risk pattern"')).toBeInTheDocument();
    expect(screen.queryByText(/\[MEM\]|\[DT\]|MEM:/)).not.toBeInTheDocument();
  });

  it('does not render raw rag source ids in citation references', () => {
    const msg = {
      id: 'm-ai-citation-rag-ref',
      role: 'ai',
      content: 'A cited answer [1]',
      timestamp: new Date(),
      isStreaming: false,
      citations: [
        {
          id: 'c1',
          title: 'Source 1',
          type: 'external',
          reference: 'rag_2',
          excerpt: 'Relevant source summary',
        },
      ],
      metadata: { deepThinking: { kind: 'report' } },
    } as any;

    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg] })} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sources details' }));
    fireEvent.click(screen.getByText('Deep search sources'));
    expect(screen.getAllByText('External source').length).toBeGreaterThan(0);
    expect(screen.queryByText(/\brag_2\b/)).not.toBeInTheDocument();
  });

  it('renders Teresa proposal cards from persisted AI message metadata', () => {
    const msg = {
      id: 'm-ai-teresa-proposal',
      role: 'ai',
      content: 'I prepared a governed proposal.',
      timestamp: new Date(),
      isStreaming: false,
      metadata: {
        proposal: {
          proposalId: 'proposal-1',
          contractId: 'teresa_copilot_v1',
          title: 'Create transformation initiative',
          summary: 'Draft initiative for COO review.',
          state: 'proposal',
          approvalState: 'awaiting_review',
          allowedActions: ['approve', 'reject'],
          targetModule: 'initiatives',
          targetLabel: 'Initiatives',
          handoffIntent: 'create',
          previewLines: ['Owner: COO', 'Approval required before execution'],
          auditCount: 1,
          resultRef: null,
          degraded: null,
        },
      },
    } as any;

    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg] })} />);

    expect(screen.getByText('Create transformation initiative')).toBeInTheDocument();
    expect(screen.getByText('Draft initiative for COO review.')).toBeInTheDocument();
    expect(screen.getByText('Approval required before execution')).toBeInTheDocument();
  });
});

