/**
 * Dev-render — dowód wizualny KONTROLKI POTWIERDZENIA Teresy (F1 Krok A,
 * commit a877e21295 / integracja 2026-07-26).
 *
 * Montuje REALNY <MessageRenderer> (nie replikę JSX) z dwiema wiadomościami:
 * pytanie użytkownika + odmowa `confirmBeforeRun` z rejestru akcji
 * (metadata.teresaConfirm=true, teresaPendingConfirm wskazuje tę wiadomość).
 * Przyciski „Potwierdź"/„Anuluj" działają: klik loguje akcję do paska stanu
 * ekranu i gasi pending (drugi render bez przycisków — dokładnie jak w
 * UnifiedChatPanel po wykonaniu/anulowaniu).
 *
 * URL: ?screen=teresa-confirm-chip [&theme=light|dark] [&lang=pl|en]
 */
import React from 'react';

import { MessageRenderer } from '../../src/components/AIChat/MessageRenderer';
import { useAppStore } from '../../src/store/useAppStore';

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const isPl = new URLSearchParams(window.location.search).get('lang') !== 'en';

const MSG_USER = {
  id: 'u1',
  role: 'user' as const,
  content: isPl ? 'Zduplikuj tę ideę' : 'Duplicate this idea',
  timestamp: new Date('2026-07-26T12:00:00Z').toISOString(),
};

const MSG_CONFIRM = {
  id: 'ai1',
  role: 'ai' as const,
  content: isPl
    ? '„Duplikuj Ideę" zmienia dane na trwałe — potwierdź, zanim to zrobię.'
    : '"Duplicate Idea" changes data permanently — confirm before I do it.',
  timestamp: new Date('2026-07-26T12:00:05Z').toISOString(),
  metadata: { teresaConfirm: true },
};

/** No-op defaults dla propsów, których ścieżka confirm-chipa nie dotyka. */
const NOOP_DEFAULTS: Record<string, unknown> = {
  index: 1,
  displayMessages: [MSG_USER, MSG_CONFIRM],
  isCompact: false,
  isDisabled: false,
  activeConversationId: 'conv-dev',
  thinkingSteps: [],
  streamStartedAt: null,
  streamCompletedSignal: false,
  retryInfo: null,
  abortFeedback: null,
  agentAuditState: null,
  agentAuditBusy: false,
  agentRegistryById: {},
  agentAuditActiveTabByMessageId: {},
  setAgentAuditActiveTabByMessageId: () => {},
  deepThinkingHint: null,
  dtHintDismissed: false,
  dtPendingConfirm: null,
  copiedMessageId: null,
  contextSaveBusyMessageId: null,
  contextSavedMessageIds: new Set(),
  voiceState: { isSpeaking: false },
  setDtPendingConfirm: () => {},
  dtConfirmBusy: false,
  dtSavingDecision: null,
  dtDecisionSaved: new Set(),
  interimInsight: null,
  aiConfig: null,
  editingMessageId: null,
  editingText: '',
  editBusy: false,
  setEditingText: () => {},
  hoveredMessageId: null,
  setHoveredMessageId: () => {},
  selectedMultiOptions: [],
  handleCopyMessage: () => {},
  handleStartEditMessage: () => {},
  handleCancelEditMessage: () => {},
  handleCommitEditMessage: () => {},
  handleViewArtifacts: () => {},
  handleFeedback: () => {},
  handleSendMessage: () => {},
  handleEnableDeepThinking: () => {},
  handleDeepThinkingProceed: () => {},
  handleDeepThinkingReconfirm: () => {},
  handleSaveAsDecision: () => {},
  handleSaveAsIdea: () => {},
  handleSaveAsNote: () => {},
  handleSaveToContext: () => {},
  handleRunDirectedDeepening: () => {},
  handleMultiSelectToggle: () => {},
  handleMultiSelectConfirm: () => {},
  refreshAgentAuditSuggestionsOnly: () => {},
  speak: () => {},
  stopSpeaking: () => {},
  setDtHintDismissed: () => {},
  addArtifact: () => {},
  toggleArtifactsPanel: () => {},
  exportArtifact: () => {},
  handleAgentAuditAccept: async () => {},
};

const Screen: React.FC = () => {
  const [pending, setPending] = React.useState<{
    messageId: string;
    language: 'pl' | 'en';
  } | null>({ messageId: 'ai1', language: isPl ? 'pl' : 'en' });
  const [busy, setBusy] = React.useState(false);
  const [log, setLog] = React.useState<string>(isPl ? '(czeka na decyzję)' : '(awaiting decision)');

  const commonProps: Record<string, unknown> = {
    ...NOOP_DEFAULTS,
    teresaPendingConfirm: pending,
    teresaConfirmBusy: busy,
    onTeresaConfirmProceed: () => {
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        setPending(null);
        setLog(
          isPl
            ? '✔ POTWIERDZONO — executeTeresaTool(confirmed:true) — ta sama ścieżka co klik'
            : '✔ CONFIRMED — executeTeresaTool(confirmed:true)'
        );
      }, 600);
    },
    onTeresaConfirmCancel: () => {
      setPending(null);
      setLog(isPl ? '✖ ANULOWANO — akcja nie wykonana' : '✖ CANCELLED');
    },
  };

  const Renderer = MessageRenderer as unknown as React.FC<Record<string, unknown>>;
  return (
    <div className="min-h-screen bg-c-bg text-c-text p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-sm font-semibold text-c-text-secondary">
          {isPl
            ? 'F1-A · Kontrolka potwierdzenia Teresy (realny MessageRenderer)'
            : 'F1-A · Teresa confirm chip (real MessageRenderer)'}
        </h1>
        <div className="rounded-xl border border-c-border bg-c-surface p-4 space-y-3">
          <Renderer {...commonProps} msg={MSG_USER} index={0} />
          <Renderer {...commonProps} msg={MSG_CONFIRM} index={1} />
        </div>
        <div
          className="text-xs text-c-text-muted border border-c-border-subtle rounded-lg px-3 py-2"
          data-testid="confirm-log"
        >
          {log}
        </div>
      </div>
    </div>
  );
};

export default Screen;
