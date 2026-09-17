import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ChatMessage } from '../../../types';
import { MessageRenderer, type MessageRendererProps } from '../MessageRenderer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrValues?: string | Record<string, unknown>) => {
      if (key === 'aiChat.attachments.imagePreviewAlt') {
        const values = typeof fallbackOrValues === 'object' ? fallbackOrValues : {};
        return `Preview of ${String(values.name || '')}`;
      }
      return typeof fallbackOrValues === 'string' ? fallbackOrValues : key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ isAdmin: false, isSuperAdmin: false }),
}));

vi.mock('../../../services/api', () => ({
  Api: new Proxy({}, { get: () => vi.fn(async () => ({})) }),
}));

function renderUserMessage(metadata: Record<string, unknown>) {
  const msg: ChatMessage = {
    id: 'user-image-turn',
    role: 'user',
    content: 'Please inspect this image.',
    timestamp: new Date('2026-09-17T00:00:00Z'),
    metadata,
  };
  const inert = vi.fn();
  const props = {
    msg,
    index: 0,
    displayMessages: [msg],
    isCompact: false,
    isDisabled: false,
    activeConversationId: 'conversation-368',
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
    setAgentAuditActiveTabByMessageId: inert,
    deepThinkingHint: null,
    dtHintDismissed: true,
    dtPendingConfirm: null,
    setDtPendingConfirm: inert,
    dtConfirmBusy: false,
    dtSavingDecision: null,
    dtDecisionSaved: new Set<string>(),
    interimInsight: null,
    aiConfig: null,
    editingMessageId: null,
    editingText: '',
    editBusy: false,
    setEditingText: inert,
    hoveredMessageId: null,
    setHoveredMessageId: inert,
    copiedMessageId: null,
    contextSaveBusyMessageId: null,
    contextSavedMessageIds: new Set<string>(),
    selectedMultiOptions: [],
    voiceState: { isSpeaking: false },
    handleCopyMessage: inert,
    handleStartEditMessage: inert,
    handleCancelEditMessage: inert,
    handleCommitEditMessage: inert,
    handleViewArtifacts: inert,
    handleFeedback: inert,
    handleSendMessage: inert,
    handleEnableDeepThinking: inert,
    handleDeepThinkingProceed: inert,
    handleDeepThinkingReconfirm: inert,
    handleSaveAsDecision: inert,
    handleSaveAsIdea: inert,
    handleSaveAsNote: inert,
    handleSaveToContext: inert,
    handleRunDirectedDeepening: inert,
    handleMultiSelectToggle: inert,
    handleMultiSelectConfirm: inert,
    refreshAgentAuditSuggestionsOnly: inert,
    speak: inert,
    stopSpeaking: inert,
    setDtHintDismissed: inert,
    addArtifact: inert,
    toggleArtifactsPanel: inert,
    exportArtifact: inert,
    handleAgentAuditAccept: vi.fn(async () => undefined),
  } as unknown as MessageRendererProps;
  return render(<MessageRenderer {...props} />);
}

describe('MessageRenderer persisted chat image', () => {
  it('renders the persisted image thumbnail in the transcript when the flag is ON', () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    renderUserMessage({
      images: [
        {
          name: 'persistent.png',
          mimeType: 'image/png',
          dataUrl,
          width: 1,
          height: 1,
          size: 68,
        },
      ],
    });

    expect(screen.getByRole('img', { name: 'Preview of persistent.png' })).toHaveAttribute(
      'src',
      dataUrl
    );
  });

  it('does not render persisted image metadata while the flag is OFF', () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'false');

    renderUserMessage({
      images: [
        {
          name: 'hidden.png',
          mimeType: 'image/png',
          dataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          width: 1,
          height: 1,
          size: 68,
        },
      ],
    });

    expect(screen.queryByRole('img', { name: 'hidden.png' })).not.toBeInTheDocument();
  });
});
