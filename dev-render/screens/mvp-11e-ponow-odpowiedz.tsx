/** MVP 1.1-E: krótka odpowiedź Teresy — rząd akcji wiadomości asystenta.
 * Odtwarza zgłoszenie właściciela: "nie mam jak ponownie zaprosić Teresę,
 * żeby to przeanalizowała" — krótka odpowiedź pokazuje tylko 3 ikony
 * (kopiuj/głośnik/chevron), a "Ponów odpowiedź" siedział za rozwinięciem.
 */
import React from 'react';

import { MessageRenderer } from '../../src/components/AIChat/MessageRenderer';

const user = {
  id: 'u11e',
  role: 'user' as const,
  content: 'Co sądzisz o tym pomyśle na wdrożenie?',
  timestamp: '2026-09-06T08:00:00Z',
};
const message = {
  id: 'ai11e',
  role: 'ai' as const,
  content: 'Nie jestem pewna, o co dokładnie pytasz — doprecyzuj zakres.',
  timestamp: '2026-09-06T08:00:05Z',
  isStreaming: false,
};
const noop = () => {};
const props = {
  msg: message,
  index: 1,
  displayMessages: [user, message],
  isLastMessage: true,
  isCompact: false,
  isDisabled: false,
  activeConversationId: 'mvp11e',
  thinkingSteps: [],
  streamStartedAt: null,
  streamCompletedSignal: false,
  retryInfo: null,
  abortFeedback: null,
  agentAuditState: null,
  agentAuditBusy: false,
  agentRegistryById: {},
  agentAuditActiveTabByMessageId: {},
  setAgentAuditActiveTabByMessageId: noop,
  deepThinkingHint: null,
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
