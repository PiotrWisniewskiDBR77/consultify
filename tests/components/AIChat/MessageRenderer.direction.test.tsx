import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageRenderer, type MessageRendererProps } from '../../../src/components/AIChat/MessageRenderer';

const baseMessage = {
  id: 'm1',
  role: 'user',
  content: 'Sample user text',
  timestamp: new Date(),
} as any;

function buildProps(overrides?: Partial<MessageRendererProps>): MessageRendererProps {
  return {
    msg: baseMessage,
    index: 0,
    displayMessages: [baseMessage],
    isCompact: false,
    isDisabled: false,
    isRtlChatLanguage: false,
    activeConversationId: null,
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

describe('MessageRenderer text direction', () => {
  it('uses LTR for non-Arabic languages', () => {
    render(<MessageRenderer {...buildProps({ isRtlChatLanguage: false })} />);

    const textNode = screen.getByText('Sample user text');
    const dirElement = textNode.closest('[dir]');
    expect(dirElement).toHaveAttribute('dir', 'ltr');
  });

  it('uses RTL for Arabic language mode', () => {
    render(<MessageRenderer {...buildProps({ isRtlChatLanguage: true })} />);

    const textNode = screen.getByText('Sample user text');
    const dirElement = textNode.closest('[dir]');
    expect(dirElement).toHaveAttribute('dir', 'rtl');
  });
});
