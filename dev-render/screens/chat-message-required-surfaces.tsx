/** Dyżur 315: one real MessageRenderer exposing every required data branch. */
import React from 'react';

import { MessageRenderer } from '../../src/components/AIChat/MessageRenderer';

const user = {
  id: 'u315',
  role: 'user' as const,
  content: 'Przygotuj warianty decyzji.',
  timestamp: '2026-09-04T08:00:00Z',
};
const message = {
  id: 'ai315',
  role: 'ai' as const,
  content: '⚠️ Odpowiedź jest częściowa. Wybierz dalszy krok.',
  timestamp: '2026-09-04T08:00:05Z',
  options: [
    { id: 'o1', label: 'Zbierz więcej danych', value: 'research' },
    { id: 'o2', label: 'Zapisz decyzję', value: 'decision' },
  ],
  metadata: {
    deepThinking: { kind: 'report' },
    researchProgress: {
      stage: 'searching',
      topic: 'Jak usunąć crimson z interakcji Czatu?',
      queries: ['kanon fokusu', 'neutralne stany hover'],
      sources: [{ title: 'TRIADA_KANON', url: '/docs/ui-standards/TRIADA_KANON.md' }],
    },
  },
};
const noop = () => {};
const props = {
  msg: message,
  index: 1,
  displayMessages: [user, message],
  isLastMessage: true,
  isCompact: false,
  isDisabled: false,
  activeConversationId: 'day315',
  thinkingSteps: [],
  streamStartedAt: null,
  streamCompletedSignal: false,
  retryInfo: null,
  abortFeedback: 'partial',
  agentAuditState: null,
  agentAuditBusy: false,
  agentRegistryById: {},
  agentAuditActiveTabByMessageId: {},
  setAgentAuditActiveTabByMessageId: noop,
  deepThinkingHint: { reason: 'Wymaga decyzji strategicznej', confidence: 'high' },
  dtHintDismissed: false,
  dtPendingConfirm: null,
  copiedMessageId: null,
  contextSaveBusyMessageId: null,
  contextSavedMessageIds: new Set(),
  voiceState: { isSpeaking: false },
  setDtPendingConfirm: noop,
  dtConfirmBusy: false,
  dtSavingDecision: null,
  dtDecisionSaved: new Set(),
  interimInsight: null,
  aiConfig: { deepResearch: false },
  editingMessageId: null,
  editingText: '',
  editBusy: false,
  setEditingText: noop,
  hoveredMessageId: null,
  setHoveredMessageId: noop,
  selectedMultiOptions: [],
  handleCopyMessage: noop,
  handleStartEditMessage: noop,
  handleCancelEditMessage: noop,
  handleCommitEditMessage: noop,
  handleViewArtifacts: noop,
  handleFeedback: noop,
  handleSendMessage: noop,
  handleEnableDeepThinking: noop,
  handleDeepThinkingProceed: noop,
  handleDeepThinkingReconfirm: noop,
  handleSaveAsDecision: noop,
  handleSaveAsIdea: noop,
  handleSaveAsNote: noop,
  handleSaveToContext: noop,
  handleRunDirectedDeepening: noop,
  handleMultiSelectToggle: noop,
  handleMultiSelectConfirm: noop,
  refreshAgentAuditSuggestionsOnly: noop,
  speak: noop,
  stopSpeaking: noop,
  setDtHintDismissed: noop,
  addArtifact: noop,
  toggleArtifactsPanel: noop,
  exportArtifact: noop,
  handleAgentAuditAccept: async () => {},
} as unknown as React.ComponentProps<typeof MessageRenderer>;

const Screen: React.FC = () => (
  <main className="min-h-screen bg-c-bg p-10 text-c-text">
    <MessageRenderer {...props} />
  </main>
);

export default Screen;
