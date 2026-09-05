import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageRenderer, type MessageRendererProps } from '../../../src/components/AIChat/MessageRenderer';

function buildProps(overrides?: Partial<MessageRendererProps>): MessageRendererProps {
  const message = {
    id: 'm-ai-1',
    role: 'ai',
    content: 'Structured answer to save.',
    timestamp: new Date(),
    isStreaming: false,
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

describe('MessageRenderer context save action', () => {
  it('routes Deep Thinking decision and initiative CTAs with distinct record types', () => {
    const handleSaveAsDecision = vi.fn();
    const msg = {
      id: 'm-dt-370',
      role: 'ai',
      content: '# Executive Summary\nDay 370',
      timestamp: new Date(),
      isStreaming: false,
      metadata: { deepThinking: { kind: 'report' } },
    } as any;
    render(<MessageRenderer {...buildProps({ msg, displayMessages: [msg], handleSaveAsDecision })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save as Decision' }));
    fireEvent.click(screen.getByRole('button', { name: 'Convert to Initiative' }));

    expect(handleSaveAsDecision).toHaveBeenNthCalledWith(1, 'm-dt-370', '# Executive Summary\nDay 370');
    expect(handleSaveAsDecision).toHaveBeenNthCalledWith(2, 'm-dt-370', '# Executive Summary\nDay 370', 'initiative');
  });

  it('calls save-to-context handler from the feedback action row', () => {
    const handleSaveToContext = vi.fn();

    render(<MessageRenderer {...buildProps({ handleSaveToContext })} />);

    // For AI messages the save-to-context action now lives inside the compact
    // "More actions" dropdown, which must be opened first.
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByTitle('Save to Context OS'));

    expect(handleSaveToContext).toHaveBeenCalledWith('m-ai-1', 'Structured answer to save.', 'ai');
  });
});
