/**
 * MessageRenderer
 *
 * Renders a single chat message with its full UI — avatar, bubble, thinking
 * steps, artifact badges, citations, feedback, deep-thinking CTAs, agent
 * audit details, interactive options, and hover actions.
 *
 * Extracted from UnifiedChatPanel.renderMessage for maintainability.
 */

import {
  Bookmark,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileCode,
  FileText,
  Lightbulb,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  User,
  Volume2,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { usePermissions } from '../../hooks/usePermissions';
import { Artifact, ChatMessage, ResponseFeedback, ThinkingStep } from '../../types';
import { formatExecutiveBrief } from '../../utils/textCleaning';
import { ArtifactBadge } from './ArtifactBadge';
import { ChatTableProposalCard } from './ChatTableProposalCard';
import { CitationList, CitationMarker } from './CitationList';
import {
  type DeepThinkingPendingConfirmBase,
  shouldOpenDeepThinkingClarification,
} from './deepThinkingRuntime';
import { ExecutionProposalMessage } from './ExecutionProposalMessage';
import { InlineResponseFeedback } from './InlineResponseFeedback';
import { ResearchClarification } from './ResearchClarification';
import { ResearchProgress } from './ResearchProgress';
import { SourcesStrip } from './SourcesStrip';
import { StructuredOutputBlock } from './StructuredOutputBlock';
import { ThinkingStatusLine } from './ThinkingStatusLine';
import { TrustBadge } from './TrustBadge';
import { TrustPanel } from './TrustPanel';

// V8 governed proposal / execution message family (CHAT_V8_ACTIONS_AND_APPROVALS)
const V8_EXECUTION_MESSAGE_TYPES = new Set<string>([
  'execution_proposal',
  'execution_progress',
  'execution_result',
]);

// ============================================================================
// Inline citation rendering — feedback #3c5b87cf / #05b77280 / #1cbe2baa.
//
// Why this exists
// ---------------
// Backend `citationExtractor` emits `[N]` markers that map to `msg.citations[N-1]`,
// but the raw LLM text often includes verbose prefixes like
// `Source 2; rag_2; [2]` (default sourceTitle + sourceId defaults from
// citationExtractor) or bare `[1]` / `[2]` without any source name. The old
// renderer passed the markdown straight to ReactMarkdown, so those markers
// stayed as plain text — users couldn't click them to open the source card
// and Quick Savings answers showed `[1]`, `[2]` with no hint what the source
// was. Both regressions (noted in tester feedback) trace back to the same
// missing transform.
//
// What we do
// ----------
// 1. Strip the verbose `Source N; rag_N; ` prefix so the sentence reads
//    naturally with just `[N]` at the end — the CitationList below already
//    shows the full source card, duplicating it inline adds noise.
// 2. While walking the markdown AST (`p`, `li`, `td`, etc.) we split string
//    nodes on `[N]` and replace them with a `CitationMarker` component that
//    opens the source in-app (see `CitationList.handleCitationClick`) or a
//    greyed-out pill when we have no citation for that index (Quick Savings
//    path where the pipeline never attached citations).
// ============================================================================

const CITATION_MARKER_RE = /\[(\d{1,3})\]/g;
const VERBOSE_CITATION_PREFIX_RE = /\s*Source\s+\d+\s*;\s*[A-Za-z0-9_-]+\s*;\s*(\[\d{1,3}\])/g;

function stripVerboseCitationPrefixes(text: string): string {
  if (!text) return text;
  return text.replace(VERBOSE_CITATION_PREFIX_RE, ' $1');
}

function renderNodesWithCitations(
  children: React.ReactNode,
  citations: ReadonlyArray<any> | undefined,
  handleClick: (citation: any) => void,
  keyPrefix: string
): React.ReactNode {
  if (!citations || citations.length === 0) return children;

  const process = (node: React.ReactNode, path: string): React.ReactNode => {
    if (typeof node === 'string') {
      if (!CITATION_MARKER_RE.test(node)) return node;
      CITATION_MARKER_RE.lastIndex = 0;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let i = 0;
      while ((match = CITATION_MARKER_RE.exec(node)) !== null) {
        if (match.index > lastIndex) {
          parts.push(node.slice(lastIndex, match.index));
        }
        const num = parseInt(match[1], 10);
        const citation = citations[num - 1];
        if (citation) {
          parts.push(
            <CitationMarker
              key={`${path}-cite-${i}`}
              number={num}
              citation={citation}
              onClick={() => handleClick(citation)}
            />
          );
        } else {
          // Quick Savings style — pipeline surfaced `[N]` without emitting
          // a matching citation. Render a non-clickable muted pill so the
          // user at least sees it is a citation marker, not prose.
          parts.push(
            <span
              key={`${path}-cite-${i}`}
              className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded align-super mx-0.5"
              title="Citation reference (source not available)"
            >
              {num}
            </span>
          );
        }
        lastIndex = match.index + match[0].length;
        i += 1;
      }
      if (lastIndex < node.length) parts.push(node.slice(lastIndex));
      CITATION_MARKER_RE.lastIndex = 0;
      return parts.length === 1 ? (
        parts[0]
      ) : (
        <>
          {parts.map((p, idx) => (
            <React.Fragment key={`${path}-f-${idx}`}>{p}</React.Fragment>
          ))}
        </>
      );
    }
    if (Array.isArray(node)) {
      return node.map((n, idx) => (
        <React.Fragment key={`${path}-${idx}`}>{process(n, `${path}-${idx}`)}</React.Fragment>
      ));
    }
    return node;
  };

  return process(children, keyPrefix);
}

// ============================================================================
// Types
// ============================================================================

export interface MessageRendererProps {
  msg: ChatMessage;
  index: number;
  displayMessages: ChatMessage[];
  isCompact: boolean;
  isDisabled: boolean;
  isRtlChatLanguage?: boolean;

  // Conversation context
  activeConversationId: string | null;

  // Streaming state
  thinkingSteps: ThinkingStep[];
  streamStartedAt: number | null;
  streamCompletedSignal: boolean;
  retryInfo: { attempt: number; maxRetries: number } | null;
  abortFeedback: 'partial' | 'cancelled' | null;

  // Agent audit state
  agentAuditState: { state?: string; agentsTotal?: number } | null;
  agentAuditBusy: boolean;
  agentRegistryById: Record<string, any>;
  agentReviewProgressByAgentId?: Record<string, { agentId: string; stage: string; error?: string }>;
  agentSourcesByAgentId?: Record<string, { kb: any[]; web: any[] }>;
  agentAuditActiveTabByMessageId: Record<string, string>;
  setAgentAuditActiveTabByMessageId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  runtimeSummaryByRunId?: Record<string, any>;
  canAcceptAgentAuditRisk?: boolean;
  canRunDirectedDeepening?: boolean;

  // Deep Thinking state
  deepThinkingHint: { reason: string; confidence: 'low' | 'medium' | 'high' } | null;
  dtHintDismissed: boolean;
  dtPendingConfirm:
    | (DeepThinkingPendingConfirmBase & {
        attachments?: any[];
        agentAudit?: {
          suggested?: any;
          orchestratorRunId?: string;
          selectedAgentIds: string[];
          userIntent: 'validate' | 'stress_test' | 'approve';
          maxAgents: 2 | 3 | 4;
          decisionContext?: {
            topic: string;
            industry?: string;
            horizon?: string;
            functions?: string[];
            riskFocus?: string[];
          };
        };
      })
    | null;
  setDtPendingConfirm: React.Dispatch<
    React.SetStateAction<MessageRendererProps['dtPendingConfirm']>
  >;
  dtConfirmBusy: boolean;
  dtSavingDecision: string | null;
  dtDecisionSaved: Set<string>;
  interimInsight: { paths: { id: string; label: string; summary?: string }[] } | null;

  // AI config
  aiConfig: { deepResearch?: boolean; [key: string]: any } | null | undefined;

  // Editing state
  editingMessageId: string | null;
  editingText: string;
  editBusy: boolean;
  setEditingText: (text: string) => void;

  // Hover / copy state
  hoveredMessageId: string | null;
  setHoveredMessageId: (id: string | null) => void;
  copiedMessageId: string | null;
  contextSaveBusyMessageId: string | null;
  contextSavedMessageIds: Set<string>;

  // Multi-select state
  selectedMultiOptions: string[];

  // Voice state
  voiceState: { isSpeaking: boolean };

  // Handlers
  handleCopyMessage: (content: string, messageId: string) => void;
  handleStartEditMessage: (messageId: string) => void;
  handleCancelEditMessage: () => void;
  handleCommitEditMessage: () => void;
  handleViewArtifacts: (artifacts: Artifact[]) => void;
  handleFeedback: (messageId: string, content: string, feedback: ResponseFeedback) => void;
  handleSendMessage: (message: string) => void;
  handleEnableDeepThinking: () => void;
  handleDeepThinkingProceed: () => void;
  handleDeepThinkingReconfirm: () => void;
  handleDeepThinkingClarificationComplete: (answers: Record<string, string> | null) => void;
  handleSaveAsDecision: (messageId: string, content: string) => void;
  handleSaveAsIdea: (messageId: string, content: string) => void;
  handleSaveAsNote: (messageId: string, content: string) => void;
  handleSaveToContext: (messageId: string, content: string, role: 'user' | 'ai') => void;
  handleRunDirectedDeepening: (agentAuditPayload: any) => void;
  handleMultiSelectToggle: (value: string) => void;
  handleMultiSelectConfirm: () => void;
  refreshAgentAuditSuggestionsOnly: (overrides?: {
    userIntent?: 'validate' | 'stress_test' | 'approve';
    maxAgents?: 2 | 3 | 4;
  }) => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  setDtHintDismissed: (v: boolean) => void;

  // Artifact store actions
  addArtifact: (artifact: Artifact) => void;
  toggleArtifactsPanel: (open: boolean) => void;
  exportArtifact: (id: string, format: string) => void;

  // Agent audit accept handler (from Api)
  handleAgentAuditAccept: (audit: any, msgId: string) => Promise<void>;

  // Option select handler (external callback)
  onOptionSelect?: (option: { id: string; label: string; value: string }) => void;

  // V8 governed proposal handlers (CHAT_V8_ACTIONS_AND_APPROVALS)
  onProposalApprove?: (proposalId: string, msg: ChatMessage) => void;
  onProposalReject?: (proposalId: string, msg: ChatMessage, reason?: string) => void;
  onProposalInspect?: (proposalId: string, msg: ChatMessage) => void;
  proposalBusyById?: Record<string, { approve?: boolean; reject?: boolean }>;
}

// ============================================================================
// Component
// ============================================================================

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  msg,
  index,
  displayMessages,
  isCompact,
  isDisabled,
  isRtlChatLanguage = false,
  activeConversationId,
  thinkingSteps,
  streamStartedAt,
  streamCompletedSignal,
  retryInfo,
  abortFeedback,
  agentAuditState,
  agentAuditBusy,
  agentRegistryById,
  agentReviewProgressByAgentId,
  agentSourcesByAgentId,
  agentAuditActiveTabByMessageId,
  setAgentAuditActiveTabByMessageId,
  runtimeSummaryByRunId,
  canAcceptAgentAuditRisk = false,
  canRunDirectedDeepening = true,
  deepThinkingHint,
  dtHintDismissed,
  dtPendingConfirm,
  setDtPendingConfirm,
  dtConfirmBusy,
  dtSavingDecision,
  dtDecisionSaved,
  interimInsight,
  aiConfig,
  editingMessageId,
  editingText,
  editBusy,
  setEditingText,
  hoveredMessageId,
  setHoveredMessageId,
  copiedMessageId,
  contextSaveBusyMessageId,
  contextSavedMessageIds,
  selectedMultiOptions,
  voiceState,
  handleCopyMessage,
  handleStartEditMessage,
  handleCancelEditMessage,
  handleCommitEditMessage,
  handleViewArtifacts,
  handleFeedback,
  handleSendMessage,
  handleEnableDeepThinking,
  handleDeepThinkingProceed,
  handleDeepThinkingReconfirm,
  handleDeepThinkingClarificationComplete,
  handleSaveAsDecision,
  handleSaveAsIdea,
  handleSaveAsNote,
  handleSaveToContext,
  handleRunDirectedDeepening,
  handleMultiSelectToggle,
  handleMultiSelectConfirm,
  refreshAgentAuditSuggestionsOnly,
  speak,
  stopSpeaking,
  setDtHintDismissed,
  addArtifact,
  toggleArtifactsPanel,
  exportArtifact,
  handleAgentAuditAccept,
  onOptionSelect,
  onProposalApprove,
  onProposalReject,
  onProposalInspect,
  proposalBusyById,
}) => {
  const { t } = useTranslation();
  // Wave A7.4 — unlocks the `routingTrace` section of TrustPanel. Regular
  // members see the compact trust pills; admins/super-admins get the
  // operator view with lazy-loaded full trace.
  const { isAdmin, isSuperAdmin } = usePermissions();
  const showOperatorDetail = isAdmin || isSuperAdmin;

  const isLastMessage = index === displayMessages.length - 1;
  const isHovered = hoveredMessageId === msg.id;
  const hasArtifacts = msg.artifacts && msg.artifacts.length > 0;
  const hasThinkingSteps = msg.thinkingSteps && msg.thinkingSteps.length > 0;
  const hasCitations = msg.citations && msg.citations.length > 0;
  const isCopied = copiedMessageId === msg.id;
  const isContextSaveBusy = contextSaveBusyMessageId === msg.id;
  const isContextSaved = contextSavedMessageIds.has(msg.id);
  const canSaveToContext = msg.role === 'user' || msg.role === 'ai';
  const contextSaveRole: 'user' | 'ai' = msg.role === 'user' ? 'user' : 'ai';
  const isDeepThinkingConfirm = (msg as any).metadata?.deepThinking?.kind === 'confirm';
  const confirmPayload =
    isDeepThinkingConfirm && dtPendingConfirm?.messageId === msg.id
      ? dtPendingConfirm.confirm
      : (msg as any).metadata?.deepThinkingConfirm;
  const policyDecision = (msg as any).metadata?.policyDecision;
  const policyNotices = Array.isArray((msg as any).metadata?.policyNotices)
    ? ((msg as any).metadata.policyNotices as any[])
    : [];
  const sourceLedger = (msg as any).metadata?.sourceLedger || null;
  const policyUncertaintyNotice =
    policyNotices.find((n: any) => n?.type === 'policy_notice' && n?.kind === 'uncertainty') ||
    policyNotices.find((n: any) => n?.kind === 'uncertainty') ||
    null;
  const policyNoSourcesNotice =
    policyNotices.find((n: any) => n?.type === 'policy_notice' && n?.kind === 'no_sources') ||
    policyNotices.find((n: any) => n?.kind === 'no_sources') ||
    null;
  const isPolicyRefusal = msg.role === 'ai' && policyDecision && policyDecision.allowed === false;

  // V8: first-class render for governed proposal / execution message family
  // (CHAT_V8_ACTIONS_AND_APPROVALS, CHAT_V8_RESPONSE_MODEL).
  // Intercepts before the generic bubble so proposals are never rendered as
  // plain chat text and can never silently mutate state.
  const msgType = (msg as any).type as string | undefined;
  if (msgType && V8_EXECUTION_MESSAGE_TYPES.has(msgType)) {
    const proposalId =
      ((msg as any).metadata?.executionProposal?.proposalId as string | undefined) ||
      ((msg as any).metadata?.proposal?.proposalId as string | undefined) ||
      ((msg as any).metadata?.proposalId as string | undefined);
    const busy = proposalId && proposalBusyById ? proposalBusyById[proposalId] : undefined;
    return (
      <ExecutionProposalMessage
        msg={msg}
        isCompact={isCompact}
        isRtl={isRtlChatLanguage}
        onApprove={onProposalApprove}
        onReject={onProposalReject}
        onInspect={onProposalInspect}
        isApproveBusy={!!busy?.approve}
        isRejectBusy={!!busy?.reject}
      />
    );
  }

  return (
    <div
      key={msg.id}
      className={`flex flex-col space-y-1.5 group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setHoveredMessageId(msg.id)}
      onMouseLeave={() => setHoveredMessageId(null)}
    >
      {/* Cursor-like thinking log: plain dim text, no background, no panel */}
      {/* Only show for the LAST streaming AI message to avoid duplicated lines */}
      {msg.role === 'ai' && msg.isStreaming && isLastMessage && thinkingSteps.length > 0 && (
        <div className={`${isCompact ? 'ml-7' : 'ml-9'} max-w-[85%]`}>
          <ThinkingStatusLine
            compact={isCompact}
            show
            showSpinner={false}
            steps={thinkingSteps
              .filter((s) => String((s as any)?.label || '').trim())
              .map((s) => ({
                label: String((s as any)?.label || '').trim(),
                status:
                  s.status === 'done' || s.status === 'completed'
                    ? ('done' as const)
                    : s.status === 'in_progress'
                      ? ('in_progress' as const)
                      : ('pending' as const),
              }))
              .slice(-6)}
            label={t('thinking.processing', 'Processing live steps…') as string}
          />
        </div>
      )}

      <div
        className={`flex gap-2 ${isCompact ? 'gap-2' : 'gap-3'} ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
      >
        {/* Avatar */}
        <div
          className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
            msg.role === 'ai'
              ? 'bg-primary-50 dark:bg-primary-900/50 border-primary-200 dark:border-primary-700'
              : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
          }`}
        >
          {msg.role === 'ai' ? (
            <Bot size={isCompact ? 12 : 14} className="text-primary-600 dark:text-primary-400" />
          ) : (
            <User size={isCompact ? 12 : 14} className="text-slate-500 dark:text-slate-400" />
          )}
        </div>

        {/* Message Bubble */}
        <div className="flex flex-col max-w-[85%]">
          {/* Author name for team messages */}
          {msg.role === 'user' && msg.authorName && (
            <span
              className={`text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 pr-1 font-medium ${
                isRtlChatLanguage ? 'text-right' : 'text-left'
              }`}
            >
              {msg.authorName}
            </span>
          )}
          <div
            className={`relative rounded-xl px-3 py-2 ${isCompact ? 'text-xs' : 'text-sm'} leading-relaxed shadow-sm ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white rounded-tr-none'
                : 'bg-slate-50 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700 rounded-tl-none'
            } ${isRtlChatLanguage ? 'text-right' : 'text-left'}`}
            dir={isRtlChatLanguage ? 'rtl' : 'ltr'}
          >
            {/* AI Message Content */}
            {msg.role === 'ai' ? (
              <div
                className={`${isDeepThinkingConfirm || (msg as any).metadata?.type === 'table_proposal' ? 'not-prose' : `prose ${isCompact ? 'prose-xs' : 'prose-sm'} dark:prose-invert`} max-w-none`}
              >
                {/* Policy gateway (P34-B): refusal + uncertainty visibility */}
                {isPolicyRefusal && (
                  <div className="not-prose mb-3 p-3 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/30">
                    <div className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                      {t('policy.refusal.title', 'Request blocked by policy')}
                    </div>
                    {String(policyDecision?.rationale || '').trim() ? (
                      <div className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
                        {String(policyDecision.rationale).trim()}
                      </div>
                    ) : null}
                    {Array.isArray(policyDecision?.refusal?.nextSteps) &&
                    policyDecision.refusal.nextSteps.length ? (
                      <div className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">
                        <div className="font-medium">
                          {t('policy.refusal.nextSteps', 'What to do next')}
                        </div>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {policyDecision.refusal.nextSteps.slice(0, 6).map((s: any, i: number) => (
                            <li key={i}>{String(s || '').trim()}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}

                {!isPolicyRefusal && policyUncertaintyNotice && (
                  <div className="not-prose mb-3 p-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/25">
                    <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      {t('policy.uncertainty.title', 'Uncertainty marker')}
                    </div>
                    <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                      {String(
                        policyUncertaintyNotice?.message ||
                          t(
                            'policy.uncertainty.body',
                            'This response includes factual claims without sufficient citations from available sources.'
                          )
                      )}
                    </div>
                  </div>
                )}

                {!isPolicyRefusal && policyNoSourcesNotice && (
                  <div className="not-prose mb-3 p-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/30">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {t('policy.noSources.title', 'No sources found')}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                      {String(
                        policyNoSourcesNotice?.message ||
                          t(
                            'policy.noSources.body',
                            'This answer could not be verified against available sources in your allowed scope.'
                          )
                      )}
                    </div>
                  </div>
                )}

                {!isPolicyRefusal &&
                  sourceLedger &&
                  Array.isArray((sourceLedger as any).blocked_sources) &&
                  (sourceLedger as any).blocked_sources.length > 0 && (
                    <div className="not-prose mb-3 p-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/70 dark:bg-navy-900/25">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {t('policy.sourceLedger.title', 'Source ledger')}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                        {t('policy.sourceLedger.blockedLabel', 'Blocked scopes (high-level):')}
                      </div>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        {(sourceLedger as any).blocked_sources
                          .slice(0, 8)
                          .map((b: any, i: number) => (
                            <li key={i}>
                              {String(b?.category || 'blocked')}
                              {b?.reason ? ` (${String(b.reason)})` : ''}
                            </li>
                          ))}
                      </ul>
                      {sourceLedger?.degraded?.mode ? (
                        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          {t('policy.sourceLedger.degraded', 'Degraded mode:')}{' '}
                          <span className="font-medium">{String(sourceLedger.degraded.mode)}</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                {/* Deep Thinking: Research progress (SSE events) */}
                {(msg as any).metadata?.researchVisibility?.items && (
                  <div className={`${isCompact ? 'mb-2' : 'mb-3'} not-prose`}>
                    <div className="mb-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Research & Sources (planned)
                    </div>
                    <div className="space-y-1">
                      {(msg as any).metadata?.researchVisibility?.items
                        ?.slice(0, 6)
                        .map((it: any) => (
                          <div
                            key={it.id}
                            className="flex items-start justify-between gap-2 text-[11px] bg-slate-100 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1"
                          >
                            <div className="min-w-0">
                              <div className="text-slate-700 dark:text-slate-200 truncate">
                                {it.label}
                              </div>
                              {it.rationale ? (
                                <div className="text-slate-400 dark:text-slate-500 truncate">
                                  {it.rationale}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex-shrink-0 text-slate-500 dark:text-slate-400">
                              {String(it.status || 'planned')}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {(msg as any).metadata?.researchProgress && (
                  <div className={`${isCompact ? 'mb-2' : 'mb-3'} not-prose`}>
                    {((msg as any).metadata?.researchProgress?.error as string | undefined) && (
                      <div className="mb-2 text-[11px] text-amber-600 dark:text-amber-400">
                        {(msg as any).metadata?.researchProgress?.error}
                      </div>
                    )}
                    <ResearchProgress
                      topic={String((msg as any).metadata?.researchProgress?.topic || '')}
                      stage={((msg as any).metadata?.researchProgress?.stage || 'searching') as any}
                      queries={((msg as any).metadata?.researchProgress?.queries || []) as any}
                      sources={((msg as any).metadata?.researchProgress?.sources || []) as any}
                      round={(msg as any).metadata?.researchProgress?.round}
                      totalRounds={(msg as any).metadata?.researchProgress?.totalRounds}
                      researchType={(msg as any).metadata?.researchProgress?.researchType}
                    />
                  </div>
                )}

                {(msg as any).metadata?.type === 'table_proposal' ? (
                  <div className="not-prose">
                    <ChatTableProposalCard
                      proposal={(msg as any).metadata.proposal}
                      onStatusChange={() => {}}
                      onNavigateToTable={(baseId) => {
                        const path = `/my-work/ideas/${encodeURIComponent(baseId)}/workspace/table`;
                        window.location.href = path;
                      }}
                    />
                  </div>
                ) : isDeepThinkingConfirm ? (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Confirm Understanding (Deep Thinking)
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <div className="font-medium">My understanding of your task</div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>
                          <span className="font-medium">Goal:</span>{' '}
                          {String(confirmPayload?.understanding?.goal || '').trim() || '—'}
                        </li>
                        {String(confirmPayload?.understanding?.context || '').trim() ? (
                          <li>
                            <span className="font-medium">Context:</span>{' '}
                            {String(confirmPayload?.understanding?.context || '').trim()}
                          </li>
                        ) : null}
                        {Array.isArray(confirmPayload?.understanding?.constraints) &&
                        confirmPayload.understanding.constraints.length ? (
                          <li>
                            <span className="font-medium">Constraints:</span>{' '}
                            {confirmPayload.understanding.constraints.join('; ')}
                          </li>
                        ) : null}
                        {String(confirmPayload?.understanding?.expectedOutput || '').trim() ? (
                          <li>
                            <span className="font-medium">Output:</span>{' '}
                            {String(confirmPayload.understanding.expectedOutput)}
                          </li>
                        ) : null}
                        {String(confirmPayload?.understanding?.decisionHorizon || '').trim() ? (
                          <li>
                            <span className="font-medium">Horizon:</span>{' '}
                            {String(confirmPayload.understanding.decisionHorizon)}
                          </li>
                        ) : null}
                      </ul>
                    </div>

                    {Array.isArray(confirmPayload?.missingInfoQuestions) &&
                    confirmPayload.missingInfoQuestions.length ? (
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <div className="font-medium mb-1">Assumptions & gaps (optional)</div>
                        <ol className="list-decimal pl-4 space-y-0.5">
                          {confirmPayload.missingInfoQuestions.slice(0, 3).map((q: any) => (
                            <li key={q.id || q.question}>{q.question}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}

                    {/* Agent Audit Layer: manual approval of suggested reviewers */}
                    {dtPendingConfirm?.messageId === msg.id &&
                    Array.isArray(dtPendingConfirm.agentAudit?.suggested?.agents) &&
                    dtPendingConfirm.agentAudit!.suggested.agents.length ? (
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <div className="font-medium mb-2">
                          Suggested reviewers (Agent Audit Layer)
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <label className="text-[11px] text-slate-500 dark:text-slate-400">
                            Intent
                          </label>
                          <select
                            value={dtPendingConfirm.agentAudit?.userIntent || 'validate'}
                            onChange={(e) => {
                              const next = (String(e.target.value) || 'validate') as
                                | 'validate'
                                | 'stress_test'
                                | 'approve';
                              setDtPendingConfirm((prev) =>
                                prev?.agentAudit
                                  ? {
                                      ...prev,
                                      agentAudit: { ...prev.agentAudit, userIntent: next },
                                    }
                                  : prev
                              );
                              void refreshAgentAuditSuggestionsOnly({ userIntent: next });
                            }}
                            className="text-[11px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1"
                          >
                            <option value="validate">Validate</option>
                            <option value="stress_test">Stress-test</option>
                            <option value="approve">Approve</option>
                          </select>

                          <label className="text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                            Max agents
                          </label>
                          <select
                            value={dtPendingConfirm.agentAudit?.maxAgents || 3}
                            onChange={(e) => {
                              const next = Number(e.target.value) as 2 | 3 | 4;
                              setDtPendingConfirm((prev) =>
                                prev?.agentAudit
                                  ? {
                                      ...prev,
                                      agentAudit: { ...prev.agentAudit, maxAgents: next },
                                    }
                                  : prev
                              );
                              void refreshAgentAuditSuggestionsOnly({ maxAgents: next });
                            }}
                            className="text-[11px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1"
                          >
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          {dtPendingConfirm
                            .agentAudit!.suggested.agents.slice(0, 8)
                            .map((a: any) => {
                              const id = String(a?.agentId || '').trim();
                              const isSelected = Boolean(
                                id && dtPendingConfirm.agentAudit!.selectedAgentIds.includes(id)
                              );
                              const label =
                                agentRegistryById[id]?.displayName?.pl ||
                                agentRegistryById[id]?.displayName?.en ||
                                id ||
                                '—';
                              const why = String(a?.whySelected || '').trim();
                              return (
                                <label
                                  key={id}
                                  className="flex items-start gap-2 bg-slate-100 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={isSelected}
                                    onChange={() => {
                                      setDtPendingConfirm((prev) => {
                                        if (!prev?.agentAudit) return prev;
                                        const cur = prev.agentAudit.selectedAgentIds || [];
                                        const next = cur.includes(id)
                                          ? cur.filter((x) => x !== id)
                                          : [...cur, id];
                                        return {
                                          ...prev,
                                          agentAudit: {
                                            ...prev.agentAudit,
                                            selectedAgentIds: next,
                                          },
                                        };
                                      });
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-slate-700 dark:text-slate-200 truncate">
                                      {label}
                                    </div>
                                    {why ? (
                                      <div className="text-slate-400 dark:text-slate-500 truncate">
                                        {why}
                                      </div>
                                    ) : null}
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          Selected: {dtPendingConfirm.agentAudit?.selectedAgentIds?.length || 0}{' '}
                          reviewer(s) · They will audit the final report (no interference with DT).
                        </div>
                      </div>
                    ) : null}

                    {/* Adjust */}
                    {dtPendingConfirm?.messageId === msg.id && (
                      <div className="space-y-2">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          If this is not correct, adjust the task and re-run confirm.
                        </div>
                        <textarea
                          value={dtPendingConfirm.editedMessage}
                          onChange={(e) =>
                            setDtPendingConfirm((prev) =>
                              prev ? { ...prev, editedMessage: e.target.value } : prev
                            )
                          }
                          rows={3}
                          className="w-full text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary-500/40"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleDeepThinkingProceed}
                            disabled={
                              dtConfirmBusy ||
                              isDisabled ||
                              shouldOpenDeepThinkingClarification(
                                dtPendingConfirm.confirm,
                                dtPendingConfirm.clarificationHandled
                              ) ||
                              (Array.isArray(dtPendingConfirm.agentAudit?.suggested?.agents) &&
                                dtPendingConfirm.agentAudit?.suggested?.agents?.length > 0 &&
                                (dtPendingConfirm.agentAudit?.selectedAgentIds?.length || 0) === 0)
                            }
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Confirm & proceed
                          </button>
                          <button
                            onClick={handleDeepThinkingReconfirm}
                            disabled={dtConfirmBusy || isDisabled}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {dtConfirmBusy ? 'Reconfirming…' : 'Adjust & reconfirm'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {(() => {
                      const ideaHintRegex = /💡\s*IDEA_HINT:\s*(.+?)\s*\|\s*(.+)/g;
                      const hints: { title: string; description: string }[] = [];
                      let match: RegExpExecArray | null;
                      while ((match = ideaHintRegex.exec(msg.content)) !== null) {
                        hints.push({ title: match[1].trim(), description: match[2].trim() });
                      }
                      const cleanContent = stripVerboseCitationPrefixes(
                        msg.content.replace(/💡\s*IDEA_HINT:\s*.+?\|.+/g, '')
                      ).trim();

                      const structuredEnvelope = (msg as any)?.metadata?.structuredOutput ?? null;

                      // Feedback #3c5b87cf / #05b77280: wire inline `[N]` markers
                      // to `msg.citations[N-1]` so tappers actually open the
                      // source card. Empty/missing citations fall through to a
                      // muted non-clickable pill (see renderNodesWithCitations).
                      const inlineCitations = Array.isArray(msg.citations) ? msg.citations : [];
                      const handleInlineCitationClick = (citation: any) => {
                        if (!citation) return;
                        if (citation.type === 'external' && citation.link) {
                          window.open(citation.link, '_blank', 'noopener,noreferrer');
                          return;
                        }
                        // Scroll the bottom CitationList into view so the user
                        // immediately sees the full source entry — the list
                        // itself owns the per-type navigation via setCurrentView.
                        try {
                          const el = document.querySelector(
                            `[data-message-id="${msg.id}"] [data-citations-list="true"]`
                          );
                          if (el && 'scrollIntoView' in el) {
                            (el as HTMLElement).scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }
                        } catch {
                          /* DOM not ready, no-op */
                        }
                      };
                      const withCitations = (
                        children: React.ReactNode,
                        key: string
                      ): React.ReactNode =>
                        renderNodesWithCitations(
                          children,
                          inlineCitations,
                          handleInlineCitationClick,
                          `${msg.id}-${key}`
                        );

                      return (
                        <>
                          {structuredEnvelope && (
                            <div className="mb-2">
                              <StructuredOutputBlock envelope={structuredEnvelope} />
                            </div>
                          )}
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: ({ inline, className: codeClassName, children }: any) => {
                                if (inline) {
                                  return (
                                    <code className="px-1 py-0.5 bg-slate-200 dark:bg-navy-700 rounded text-primary-600 dark:text-primary-400 text-xs font-mono">
                                      {children}
                                    </code>
                                  );
                                }
                                return (
                                  <pre className="bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 p-2 rounded-lg overflow-x-auto text-xs my-2">
                                    <code className={codeClassName}>{children}</code>
                                  </pre>
                                );
                              },
                              a: ({ href, children }: any) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-700 underline"
                                >
                                  {children}
                                </a>
                              ),
                              // Feedback #3c5b87cf / #05b77280 — hook inline
                              // citation rewiring on all text-carrying block
                              // elements so `[N]` markers become clickable
                              // pills linked to `msg.citations`.
                              p: ({ children }: any) => <p>{withCitations(children, 'p')}</p>,
                              li: ({ children }: any) => <li>{withCitations(children, 'li')}</li>,
                              td: ({ children }: any) => <td>{withCitations(children, 'td')}</td>,
                              th: ({ children }: any) => <th>{withCitations(children, 'th')}</th>,
                              strong: ({ children }: any) => (
                                <strong>{withCitations(children, 'strong')}</strong>
                              ),
                              em: ({ children }: any) => <em>{withCitations(children, 'em')}</em>,
                            }}
                          >
                            {cleanContent}
                          </ReactMarkdown>
                          {hints.length > 0 && !msg.isStreaming && (
                            <div className="mt-3 space-y-2">
                              {hints.map((hint, hIdx) => (
                                <div
                                  key={hIdx}
                                  className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50/80 to-emerald-50/40 dark:from-amber-900/15 dark:to-emerald-900/10 border border-amber-200/50 dark:border-amber-500/25 hover:shadow-md hover:shadow-amber-500/10 transition-all group"
                                >
                                  <div className="flex-shrink-0 p-1.5 rounded-lg bg-gradient-to-br from-amber-400/20 to-emerald-400/15 group-hover:from-amber-400/30 group-hover:to-emerald-400/20 transition-colors">
                                    <Lightbulb size={16} className="text-amber-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[10px] uppercase tracking-wide text-amber-600/70 dark:text-amber-500/60 font-semibold mb-0.5">
                                      {t('myWork.ideas.gardenSpark', 'Idea Garden Spark')}
                                    </div>
                                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                      {hint.title}
                                    </div>
                                    <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                      {hint.description}
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSaveAsIdea(
                                        msg.id,
                                        `${hint.title}\n\n${hint.description}`
                                      );
                                    }}
                                    className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-gradient-to-r from-amber-500/15 to-emerald-500/10 text-amber-700 dark:text-amber-400 hover:from-amber-500/25 hover:to-emerald-500/15 border border-amber-400/30 transition-colors"
                                    title={t('myWork.ideas.plantInGarden', 'Plant in Idea Garden')}
                                  >
                                    <Sparkles size={12} />
                                    {t('myWork.ideas.plantInGarden', 'Plant')}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {msg.role === 'ai' &&
                      !msg.isStreaming &&
                      (msg as any).metadata?.agentAudit?.kind === 'verdict' && (
                        <div className="mt-3 p-3 bg-slate-50 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 rounded-lg">
                          {(() => {
                            const audit = (msg as any).metadata?.agentAudit || {};
                            const verdict = audit?.verdict || {};
                            const reviews = Array.isArray(audit?.reviews) ? audit.reviews : [];
                            const runtimeRunId =
                              String(
                                audit?.runtimeRunId || audit?.orchestratorRunId || ''
                              ).trim() || null;
                            const runtimeSummary = runtimeRunId
                              ? runtimeSummaryByRunId?.[runtimeRunId]?.run ||
                                runtimeSummaryByRunId?.[runtimeRunId] ||
                                null
                              : null;
                            const gates = Array.isArray(verdict?.gatesTriggered)
                              ? verdict.gatesTriggered
                              : [];
                            const gateExplanations = Array.isArray(verdict?.gateExplanations)
                              ? verdict.gateExplanations
                              : [];

                            const activeAgentId =
                              agentAuditActiveTabByMessageId[msg.id] ||
                              String(reviews[0]?.agentId || '').trim();
                            const activeReview =
                              reviews.find(
                                (r: any) => String(r?.agentId || '') === activeAgentId
                              ) ||
                              reviews[0] ||
                              null;

                            const renderSource = (s: any, idx: number) => {
                              if (!s || !s.type) return null;
                              if (s.type === 'dt_section') {
                                return (
                                  <div
                                    key={`${s.type}-${idx}`}
                                    className="text-[11px] text-slate-600 dark:text-slate-300"
                                  >
                                    <span className="font-medium">DT</span>
                                    {s.quote ? `: "${String(s.quote).slice(0, 180)}"` : ''}
                                  </div>
                                );
                              }
                              if (s.type === 'kb_snippet') {
                                const meta = [
                                  String(s.title || 'KB'),
                                  s.version ? `v${String(s.version)}` : '',
                                  typeof s.score === 'number' ? `score=${s.score.toFixed(2)}` : '',
                                ]
                                  .filter(Boolean)
                                  .join(' · ');
                                return (
                                  <div
                                    key={`${s.type}-${idx}`}
                                    className="text-[11px] text-slate-600 dark:text-slate-300"
                                  >
                                    <div>
                                      <span className="font-medium">KB</span>
                                      {meta ? `: ${meta}` : ''}
                                    </div>
                                    {s.snippet ? (
                                      <div className="mt-1 px-2 py-1 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded text-[10px] leading-snug">
                                        {String(s.snippet).slice(0, 220)}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              }
                              if (s.type === 'web_source') {
                                const url = String(s.url || '').trim();
                                if (!url) return null;
                                const label = String(s.title || s.domain || url);
                                return (
                                  <div key={`${s.type}-${idx}`} className="text-[11px]">
                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                      Web
                                    </span>
                                    {': '}
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary-600 hover:text-primary-700 underline"
                                    >
                                      {label}
                                    </a>
                                  </div>
                                );
                              }
                              return null;
                            };

                            return (
                              <>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    Agent Audit — details
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Status:{' '}
                                    <span className="font-medium">
                                      {String(verdict?.qualityStatus || '—')}
                                    </span>
                                    {gates.length ? ` · Gates: ${gates.join(', ')}` : ''}
                                  </div>
                                </div>

                                {runtimeSummary ? (
                                  <div className="mt-3 rounded-md border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-950 px-3 py-2">
                                    <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                      Runtime run
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                      Status:{' '}
                                      <span className="font-medium">
                                        {String(runtimeSummary?.status || '—')}
                                      </span>
                                      {runtimeSummary?.approvalState
                                        ? ` · Approval: ${String(runtimeSummary.approvalState)}`
                                        : ''}
                                      {runtimeSummary?.latestBarrierState
                                        ? ` · Barrier: ${String(runtimeSummary.latestBarrierState)}`
                                        : ''}
                                      {runtimeSummary?.latestInterruptState
                                        ? ` · Interrupt: ${String(runtimeSummary.latestInterruptState)}`
                                        : ''}
                                    </div>
                                  </div>
                                ) : null}

                                {gateExplanations.length ? (
                                  <div className="mt-2">
                                    <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                                      Gate reasons
                                    </div>
                                    <ul className="space-y-0.5">
                                      {gateExplanations.slice(0, 6).map((g: any, i: number) => (
                                        <li
                                          key={`${String(g?.gate || '')}-${i}`}
                                          className="text-[11px] text-slate-600 dark:text-slate-300"
                                        >
                                          <span className="font-semibold">{String(g.gate)}</span>
                                          {': '}
                                          {String(g.reason || '').trim()}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {String(verdict?.qualityStatus || '') === 'FAIL' &&
                                String(audit?.orchestratorRunId || '').trim() ? (
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                      onClick={() => handleAgentAuditAccept(audit, msg.id)}
                                      disabled={
                                        isDisabled || agentAuditBusy || !canAcceptAgentAuditRisk
                                      }
                                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Accept risk & proceed
                                    </button>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {canAcceptAgentAuditRisk
                                        ? 'This is recorded in the audit trail.'
                                        : 'Admin approval is required to accept risk.'}
                                    </div>
                                  </div>
                                ) : null}

                                {reviews.length ? (
                                  <div className="mt-3">
                                    <div className="flex flex-wrap gap-2">
                                      {reviews.slice(0, 6).map((r: any) => {
                                        const id = String(r?.agentId || '').trim();
                                        const label =
                                          agentRegistryById[id]?.displayName?.pl ||
                                          agentRegistryById[id]?.displayName?.en ||
                                          id;
                                        const isActive = id && id === activeAgentId;
                                        return (
                                          <button
                                            key={id}
                                            onClick={() =>
                                              setAgentAuditActiveTabByMessageId((prev) => ({
                                                ...prev,
                                                [msg.id]: id,
                                              }))
                                            }
                                            className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                                              isActive
                                                ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                                                : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                                            }`}
                                          >
                                            {String(label)}
                                            {String(r?.overreach || '') === 'hard'
                                              ? ' (rejected)'
                                              : ''}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {activeReview ? (
                                      <div className="mt-3">
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                          Verdict:{' '}
                                          <span className="font-medium">
                                            {String(activeReview.verdict || '—')}
                                          </span>
                                          {activeReview.overreach
                                            ? ` · Overreach: ${String(activeReview.overreach)}`
                                            : ''}
                                        </div>

                                        {Array.isArray(activeReview.findings) &&
                                        activeReview.findings.length ? (
                                          <div className="mt-2">
                                            <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                                              Findings
                                            </div>
                                            <div className="space-y-2">
                                              {activeReview.findings
                                                .slice(0, 8)
                                                .map((f: any, i: number) => (
                                                  <div
                                                    key={`${String(f?.area || 'other')}-${i}`}
                                                    className="p-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-md"
                                                  >
                                                    <div className="text-[11px] text-slate-700 dark:text-slate-200">
                                                      <span className="font-semibold">
                                                        {String(f.severity || '').toUpperCase()}
                                                      </span>
                                                      {` · ${String(f.area || 'other')}`} —{' '}
                                                      {String(f.claim || '').trim()}
                                                    </div>

                                                    {Array.isArray(f.sourcesUsed) &&
                                                    f.sourcesUsed.length ? (
                                                      <div className="mt-1 space-y-1">
                                                        {f.sourcesUsed
                                                          .slice(0, 4)
                                                          .map(renderSource)}
                                                      </div>
                                                    ) : null}

                                                    {Array.isArray(f.missingDataQuestions) &&
                                                    f.missingDataQuestions.length ? (
                                                      <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                                        <div className="font-medium">
                                                          Missing data
                                                        </div>
                                                        <ul className="list-disc pl-4">
                                                          {f.missingDataQuestions
                                                            .slice(0, 4)
                                                            .map((q: any, qi: number) => (
                                                              <li key={qi}>{String(q)}</li>
                                                            ))}
                                                        </ul>
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        ) : null}

                                        {Array.isArray(activeReview.conflicts) &&
                                        activeReview.conflicts.length ? (
                                          <div className="mt-2">
                                            <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                                              Conflicts
                                            </div>
                                            <ul className="list-disc pl-4 text-[11px] text-slate-600 dark:text-slate-300">
                                              {activeReview.conflicts
                                                .slice(0, 6)
                                                .map((c: any, ci: number) => (
                                                  <li key={ci}>
                                                    with{' '}
                                                    <span className="font-medium">
                                                      {String(c.withAgentId || '')}
                                                    </span>
                                                    {c.aboutArea ? ` (${String(c.aboutArea)})` : ''}
                                                    : {String(c.conflictStatement || '')}
                                                  </li>
                                                ))}
                                            </ul>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      )}
                  </>
                )}
              </div>
            ) : (
              <>
                {editingMessageId === msg.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={3}
                      className="w-full text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary-500/40 text-slate-900 dark:text-slate-100"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={handleCancelEditMessage}
                        disabled={editBusy}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-50"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                      <button
                        onClick={handleCommitEditMessage}
                        disabled={editBusy || !editingText.trim()}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
                      >
                        {editBusy ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <span>{msg.content}</span>
                )}
              </>
            )}

            {/* Streaming indicator — inline cursor */}
            {msg.isStreaming && (
              <span className="inline-flex items-center gap-0.5 ml-1 align-baseline">
                <span className="w-[3px] h-4 bg-primary-500 rounded-sm animate-pulse" />
              </span>
            )}

            {/* Retry info — transparent communication during auto-retry */}
            {msg.isStreaming && retryInfo && (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400">
                <Loader2 size={12} className="animate-spin flex-shrink-0" />
                <span>
                  {t('stream.retrying', 'Connection issue, retrying...')} ({retryInfo.attempt}/
                  {retryInfo.maxRetries})
                </span>
              </div>
            )}

            {/* Completion signal — subtle checkmark + cost estimate */}
            {!msg.isStreaming && isLastMessage && streamCompletedSignal && (
              <div className="mt-1.5 flex items-center gap-3 text-[11px] transition-opacity duration-500">
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 size={12} />
                  {t('stream.complete', 'Response complete')}
                </span>
                {/* Cost-per-analysis estimate badge */}
                {msg.content && msg.content.length > 50 && (
                  <span
                    className="text-slate-400 dark:text-slate-500"
                    title={t(
                      'stream.costEstimateTooltip',
                      'Estimated AI cost for this response based on token usage'
                    )}
                  >
                    ~$
                    {(
                      (msg.content.length / 4) * 0.000015 +
                      (msg.content.length / 4) * 0.00006
                    ).toFixed(4)}{' '}
                    est.
                  </span>
                )}
              </div>
            )}

            {/* Abort feedback — transparent cancellation acknowledgement */}
            {!msg.isStreaming && isLastMessage && abortFeedback && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 transition-opacity duration-500">
                {abortFeedback === 'partial' ? (
                  <span>
                    {t('stream.stoppedPartial', 'Response stopped. Partial answer shown above.')}
                  </span>
                ) : (
                  <span>{t('stream.cancelled', 'Response cancelled.')}</span>
                )}
              </div>
            )}

            {/* Agent Audit Layer: streamed post-DT progress with agent name badges and status (C7.1) */}
            {msg.isStreaming &&
              agentAuditState?.state &&
              agentAuditState.state !== 'done' &&
              agentAuditState.state !== 'error' && (
                <div className="mt-3 p-2.5 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      {agentAuditState.state === 'reviewing'
                        ? t('agentAudit.streaming.reviewing', 'Multi-Agent Review in Progress')
                        : agentAuditState.state === 'aggregating'
                          ? t('agentAudit.streaming.aggregating', 'Aggregating Agent Findings')
                          : t('agentAudit.streaming.processing', 'Agent Audit Processing')}
                    </span>
                    {agentAuditState.agentsTotal && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                        {Object.keys(agentReviewProgressByAgentId || {}).length}/
                        {agentAuditState.agentsTotal} agents
                      </span>
                    )}
                  </div>
                  {/* Individual agent status badges */}
                  {agentReviewProgressByAgentId &&
                    Object.keys(agentReviewProgressByAgentId).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(agentReviewProgressByAgentId).map(([agentId, progress]) => {
                          const agentDef = agentRegistryById[agentId];
                          const agentName =
                            agentDef?.displayName?.en || agentDef?.displayName?.pl || agentId;
                          const stage = progress?.stage || 'start';
                          const isDone = stage === 'done';
                          const isError = stage === 'error' || stage === 'rejected';
                          const isActive = stage === 'llm_review' || stage === 'kb_retrieval';
                          const sources = agentSourcesByAgentId?.[agentId];
                          const sourceCount =
                            (sources?.kb?.length || 0) + (sources?.web?.length || 0);

                          return (
                            <div
                              key={agentId}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                                isDone
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                                  : isError
                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                                    : isActive
                                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {isDone ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              ) : isError ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              ) : isActive ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              )}
                              <span className="truncate max-w-[100px]">{agentName}</span>
                              {isDone && sourceCount > 0 && (
                                <span className="text-[9px] opacity-70">{sourceCount} src</span>
                              )}
                              {isActive && (
                                <span className="text-[9px] opacity-70">
                                  {stage === 'kb_retrieval' ? 'KB' : 'LLM'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>
              )}

            {/* Retry button for error messages */}
            {msg.role === 'ai' &&
              !msg.isStreaming &&
              msg.content?.includes('⚠️') &&
              (() => {
                // Find the last user message before this error
                const errorIdx = displayMessages.indexOf(msg);
                const prevUserMsg = displayMessages
                  .slice(0, errorIdx)
                  .reverse()
                  .find((m) => m.role === 'user');
                return prevUserMsg ? (
                  <button
                    onClick={() => handleSendMessage(prevUserMsg.content)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                  >
                    <RefreshCw size={12} />
                    {t('aiChat.retry', 'Try again')}
                  </button>
                ) : null;
              })()}

            {/* Hover Actions */}
            {isHovered && !msg.isStreaming && (
              <div
                className={`absolute ${msg.role === 'user' ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'} top-0 flex items-center gap-0.5 bg-slate-50 dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 p-1`}
              >
                {/* Copy */}
                <button
                  onClick={() => handleCopyMessage(msg.content, msg.id)}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700"
                  title={t('chat.actions.copy', 'Copy')}
                >
                  {isCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>

                {/* Edit (user only) */}
                {msg.role === 'user' && (
                  <button
                    onClick={() => handleStartEditMessage(msg.id)}
                    className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700"
                    title={t('chat.actions.edit', 'Edit')}
                  >
                    <Pencil size={12} />
                  </button>
                )}

                {canSaveToContext && (
                  <button
                    onClick={() => handleSaveToContext(msg.id, msg.content, contextSaveRole)}
                    disabled={isContextSaveBusy || isContextSaved}
                    className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      isContextSaved
                        ? t('chat.actions.savedToContext', 'Saved to Context OS')
                        : t('chat.actions.saveToContext', 'Save to Context OS')
                    }
                  >
                    {isContextSaveBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : isContextSaved ? (
                      <CheckCircle2 size={12} className="text-emerald-500" />
                    ) : (
                      <Database size={12} />
                    )}
                  </button>
                )}

                {/* View Artifacts */}
                {msg.role === 'ai' && hasArtifacts && (
                  <button
                    onClick={() => handleViewArtifacts(msg.artifacts!)}
                    className="p-1 rounded-md text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                    title={t('chat.actions.viewArtifacts', 'View Artifacts')}
                  >
                    <FileCode size={12} />
                  </button>
                )}

                {/* Speak */}
                {msg.role === 'ai' && (
                  <button
                    onClick={() => {
                      // Replay behavior: always restart reading from the beginning.
                      stopSpeaking();
                      setTimeout(() => {
                        speak(msg.content);
                      }, 60);
                    }}
                    className={`p-1 rounded-md ${voiceState.isSpeaking ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-navy-700`}
                    title={
                      voiceState.isSpeaking
                        ? t('chat.actions.stop', 'Stop')
                        : t('chat.actions.speak', 'Speak')
                    }
                  >
                    <Volume2 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Artifacts Badge */}
      {msg.role === 'ai' && hasArtifacts && (
        <div className={`${isCompact ? 'ml-7' : 'ml-9'} flex flex-wrap gap-1.5`}>
          {msg.artifacts!.map((artifact, artIdx) => (
            <ArtifactBadge
              key={artIdx}
              artifact={artifact}
              onOpenInPanel={(art) => {
                addArtifact(art);
                toggleArtifactsPanel(true);
              }}
              onDownload={(art) => {
                addArtifact(art);
                exportArtifact(art.id, (art as any).type === 'code' ? 'txt' : 'md');
              }}
            />
          ))}
        </div>
      )}

      {/* TRUST T-TR1 — compact always-visible summary chip. Sits above
          the full `CitationList` so skim-reading the conversation shows
          "this reply cites N sources" without expanding anything. The
          chip also renders for replies with ZERO citations (the "No
          cited sources" tone) so users never silently assume a reply is
          backed by retrieved material when it isn't. Flag-gated; when
          off the component returns null and the layout is unchanged. */}
      {msg.role === 'ai' && !msg.isStreaming && (
        <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-1`}>
          <TrustBadge
            citations={msg.citations}
            modelUsed={
              typeof (msg as { metadata?: { modelUsed?: unknown } }).metadata?.modelUsed ===
              'string'
                ? ((msg as { metadata?: { modelUsed?: string } }).metadata?.modelUsed as string)
                : null
            }
          />
        </div>
      )}

      {/* Citations */}
      {msg.role === 'ai' && hasCitations && (
        <div
          className={`${isCompact ? 'ml-7' : 'ml-9'} mt-1`}
          data-message-id={msg.id}
          data-citations-list="true"
        >
          <CitationList citations={msg.citations!} />
        </div>
      )}

      {/*
        V8 / Wave A7 — Canonical trust panel for AI replies (Gap #10 —
        Output trust as one contract). Empty / missing bundles produce
        no output so historical messages and opt-out producers are
        unaffected. Skipped while streaming — the bundle is only sealed
        at DONE.
      */}
      {msg.role === 'ai' && !msg.isStreaming && (msg as any).metadata?.trustBundle && (
        <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-1 flex flex-col gap-1`}>
          {/* Chat V9 / TRUST TS1 — post-send sources aggregate. Silent when
              the bundle has no meaningful breakdown, so single-class turns
              still read exactly like pre-TS1 (TrustPanel primary pill
              carries the signal). */}
          <SourcesStrip
            bundle={(msg as any).metadata.trustBundle}
            messageId={msg.id || null}
            isCompact={isCompact}
          />
          <TrustPanel
            bundle={(msg as any).metadata.trustBundle}
            isCompact={isCompact}
            isRtl={isRtlChatLanguage}
            showOperatorDetail={showOperatorDetail}
            messageId={msg.id || null}
          />
        </div>
      )}

      {/* Unified Feedback Block (AI only): feedback + idea + note */}
      {msg.role === 'ai' && !msg.isStreaming && (
        <div
          className={`${isCompact ? 'ml-7' : 'ml-9'} mt-1 flex flex-wrap items-start gap-3 p-2 rounded-lg bg-slate-50/80 dark:bg-navy-900/50 border border-slate-200/60 dark:border-navy-700/60`}
        >
          <InlineResponseFeedback
            messageId={msg.id}
            conversationId={activeConversationId || undefined}
            responseLength={msg.content.length}
            onFeedback={(feedback) => handleFeedback(msg.id, msg.content, feedback)}
            compact={isCompact}
          />
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-navy-700 pl-3">
            <button
              onClick={() => handleSaveAsIdea(msg.id, msg.content)}
              className="p-1.5 rounded-md text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              title={t('myWork.ideas.saveAsIdea', 'Save as idea')}
            >
              <Lightbulb size={14} />
            </button>
            <button
              onClick={() => handleSaveAsNote(msg.id, msg.content)}
              className="p-1.5 rounded-md text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              title={t('myWork.notebook.saveAsNote', 'Save as note')}
            >
              <Bookmark size={14} />
            </button>
            <button
              onClick={() => handleSaveToContext(msg.id, msg.content, 'ai')}
              disabled={isContextSaveBusy || isContextSaved}
              className="p-1.5 rounded-md text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                isContextSaved
                  ? t('chat.actions.savedToContext', 'Saved to Context OS')
                  : t('chat.actions.saveToContext', 'Save to Context OS')
              }
            >
              {isContextSaveBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : isContextSaved ? (
                <CheckCircle2 size={14} />
              ) : (
                <Database size={14} />
              )}
            </button>
          </div>
          {dtPendingConfirm?.clarificationRequested ? (
            <ResearchClarification
              message={dtPendingConfirm?.editedMessage || dtPendingConfirm?.originalMessage || ''}
              onComplete={handleDeepThinkingClarificationComplete}
              onCancel={() =>
                setDtPendingConfirm((prev) =>
                  prev
                    ? {
                        ...prev,
                        clarificationRequested: false,
                        clarificationHandled: true,
                        clarificationAnswers: null,
                      }
                    : prev
                )
              }
              className="mt-2"
            />
          ) : null}
        </div>
      )}

      {/* AI-suggested Deep Thinking activation hint */}
      {msg.role === 'ai' &&
        !msg.isStreaming &&
        isLastMessage &&
        deepThinkingHint &&
        !dtHintDismissed &&
        !aiConfig?.deepResearch && (
          <div
            className={`${isCompact ? 'ml-7' : 'ml-9'} mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg`}
          >
            <div className="flex items-start gap-2">
              <Lightbulb size={16} className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                  {t(
                    'deepThinking.hint',
                    'This looks like a strategic problem. Deep Thinking Mode can provide structured, decision-grade analysis.'
                  )}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleEnableDeepThinking}
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1"
                  >
                    <BrainCircuit size={12} />
                    {t('deepThinking.enableHint', 'Enable Deep Thinking')}
                  </button>
                  <button
                    onClick={() => setDtHintDismissed(true)}
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                  >
                    {t('deepThinking.dismissHint', 'Not now')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Deep Thinking CTA: Save as Decision / Convert to Initiative / Export */}
      {msg.role === 'ai' &&
        !msg.isStreaming &&
        (msg as any).metadata?.deepThinking?.kind === 'report' &&
        !dtDecisionSaved.has(msg.id) && (
          <div
            className={`${isCompact ? 'ml-7' : 'ml-9'} mt-2 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/50 rounded-lg`}
          >
            <p className="text-xs font-medium text-primary-800 dark:text-primary-200 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary-500" />
              {t('deepThinking.ctaTitle', 'What do you want to do with this output?')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSaveAsDecision(msg.id, msg.content)}
                disabled={dtSavingDecision === msg.id}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <Bookmark size={12} />
                {dtSavingDecision === msg.id
                  ? t('deepThinking.saving', 'Saving…')
                  : t('deepThinking.saveDecision', 'Save as Decision')}
              </button>
              <button
                onClick={() => handleSaveAsDecision(msg.id, msg.content)}
                disabled={dtSavingDecision === msg.id}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <Zap size={12} />
                {t('deepThinking.convertInitiative', 'Convert to Initiative')}
              </button>
              {/* Board-Ready Export */}
              <button
                onClick={() => {
                  const now = new Date();
                  const dateStr = now.toISOString().slice(0, 10);
                  const header = [
                    `# Deep Thinking Report`,
                    `**Date:** ${dateStr}`,
                    `**Generated by:** Consultify AI`,
                    `**Conversation:** ${activeConversationId || 'N/A'}`,
                    '',
                    '---',
                    '',
                  ].join('\n');
                  const fullContent = header + msg.content;
                  const blob = new Blob([fullContent], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `deep-thinking-report-${dateStr}.md`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-1"
              >
                <Download size={12} />
                {t('deepThinking.exportReport', 'Export Report')}
              </button>
              {/* Save report to Notebook (T004/T005 → T011) */}
              <button
                onClick={() => {
                  const isMarketResearch = !!(aiConfig as any)?.marketResearch;
                  const reportType = isMarketResearch ? 'Market Research' : 'Deep Thinking';
                  const dateStr = new Date().toISOString().slice(0, 10);
                  const reportTitle = `${reportType} Report — ${dateStr}`;
                  handleSaveAsNote(msg.id, `# ${reportTitle}\n\n${msg.content}`);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-1"
              >
                <Bookmark size={12} />
                {t('deepThinking.saveToNotebook', 'Save to Notebook')}
              </button>
              {/* Voice Executive Brief */}
              <button
                onClick={() => {
                  const brief = formatExecutiveBrief(msg.content, 'en');
                  speak(brief);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-1"
              >
                <Volume2 size={12} />
                {t('deepThinking.listenBrief', 'Listen to Brief')}
              </button>
            </div>
          </div>
        )}

      {/* Deep Thinking CTA: saved confirmation */}
      {msg.role === 'ai' && !msg.isStreaming && dtDecisionSaved.has(msg.id) && (
        <div
          className={`${isCompact ? 'ml-7' : 'ml-9'} mt-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg`}
        >
          <p className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center gap-1.5">
            <Check size={14} />
            {t('deepThinking.decisionSaved', 'Decision saved successfully')}
          </p>
        </div>
      )}

      {/* Interim Insight checkpoint */}
      {msg.role === 'ai' &&
        !msg.isStreaming &&
        isLastMessage &&
        interimInsight &&
        interimInsight.paths.length > 0 && (
          <div
            className={`${isCompact ? 'ml-7' : 'ml-9'} mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-lg`}
          >
            <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-1.5">
              <BrainCircuit size={14} className="text-indigo-500" />
              {t('deepThinking.interimInsight', 'Preliminary insight — dominant paths emerging:')}
            </p>
            <ul className="space-y-1 mb-2">
              {interimInsight.paths.map((p) => (
                <li key={p.id} className="text-xs text-indigo-700 dark:text-indigo-300">
                  <span className="font-medium">{p.label}</span>
                  {p.summary ? ` — ${p.summary}` : ''}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  handleSendMessage(t('deepThinking.narrowFocus', 'Narrow focus on the first path'))
                }
                className="px-3 py-1 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                {t('deepThinking.narrowFocusBtn', 'Narrow focus')}
              </button>
              <button
                onClick={() => handleSendMessage(t('deepThinking.goDeeper', 'Go deeper'))}
                className="px-3 py-1 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                {t('deepThinking.continueDeeper', 'Continue to full report')}
              </button>
            </div>
          </div>
        )}

      {/* Agent Audit Layer: Directed Deepening CTA */}
      {msg.role === 'ai' &&
        !msg.isStreaming &&
        (msg as any).metadata?.agentAudit?.kind === 'verdict' &&
        String(
          (msg as any).metadata?.agentAudit?.verdict?.directedLoop?.deepThinkingPrompt || ''
        ).trim() && (
          <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-3 flex flex-wrap gap-2`}>
            <button
              onClick={() => handleRunDirectedDeepening((msg as any).metadata?.agentAudit)}
              disabled={
                isDisabled ||
                agentAuditBusy ||
                Number((msg as any).metadata?.agentAudit?.loopIteration || 1) >= 2 ||
                !canRunDirectedDeepening
              }
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {agentAuditBusy ? 'Running audit…' : 'Run directed deepening'}
            </button>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 self-center">
              Iterations: {String((msg as any).metadata?.agentAudit?.loopIteration || 1)}/2
              {!canRunDirectedDeepening ? ' · Requires authenticated operator access' : ''}
            </div>
          </div>
        )}

      {/* Interactive Options */}
      {msg.role === 'ai' && !msg.isStreaming && msg.options && msg.options.length > 0 && (
        <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-3 flex flex-wrap gap-2`}>
          {msg.multiSelect ? (
            <div className="flex flex-col gap-3 w-full">
              <div className="flex flex-wrap gap-2">
                {msg.options.map((option) => {
                  const isSelected = selectedMultiOptions.includes(option.value);
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleMultiSelectToggle(option.value)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                          : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      {option.label}
                      {isSelected && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
              {isLastMessage && selectedMultiOptions.length > 0 && (
                <button
                  onClick={handleMultiSelectConfirm}
                  className="self-start px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
                >
                  {t('chat.confirmSelection', 'Confirm Selection')}
                </button>
              )}
            </div>
          ) : (
            msg.options.map((option) => (
              <button
                key={option.id}
                onClick={() =>
                  onOptionSelect ? onOptionSelect(option) : handleSendMessage(option.label)
                }
                className="px-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-xs rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/10 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-700 dark:hover:text-primary-300 transition-all"
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MessageRenderer;
