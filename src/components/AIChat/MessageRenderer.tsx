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
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  CornerDownRight,
  Database,
  Download,
  FileCode,
  FilePlus2,
  FileText,
  Flag,
  GitBranch,
  Lightbulb,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { usePermissions } from '../../hooks/usePermissions';
import { Api } from '../../services/api';
import type { GovernedChatHandoffProposal } from '../../services/api/v8/chat';
import { Artifact, ChatMessage, ResponseFeedback, ThinkingStep } from '../../types';
import { formatExecutiveBrief } from '../../utils/textCleaning';
import { ArtifactBadge } from './ArtifactBadge';
import { ArtifactChip } from './ArtifactChip';
import { shouldOfferDocumentEmission } from './canvasEmissionHeuristic';
import { CaseIntakeConfirmCard } from './CaseIntakeConfirmCard';
import { ChatCodeBlock } from './ChatCodeBlock';
import { ChatTableProposalCard } from './ChatTableProposalCard';
import { CitationList, CitationMarker } from './CitationList';
import { ExecutionProposalMessage } from './ExecutionProposalMessage';
import { GovernedChatHandoffCard } from './GovernedChatHandoffCard';
import { InlineResponseFeedback } from './InlineResponseFeedback';
import { ThinkingIndicator } from './Messages/InlineThinkingStream';
import { ReasoningTrace } from './Messages/ReasoningTrace';
import { ResearchProgress } from './ResearchProgress';
import { SourcesStrip } from './SourcesStrip';
import { StructuredOutputBlock } from './StructuredOutputBlock';
import { TeresaProposalCard } from './TeresaProposalCard';
import { TrustBadge } from './TrustBadge';
import { TrustPanel } from './TrustPanel';

// V8 governed proposal / execution message family (CHAT_V8_ACTIONS_AND_APPROVALS)
const V8_EXECUTION_MESSAGE_TYPES = new Set<string>([
  'execution_proposal',
  'execution_progress',
  'execution_result',
]);

// M01-010 — report reasons offered in the AI-message "More actions" menu.
// The i18n keys already exist under `chat.report.*`; the key itself doubles as
// the `reason` string sent to POST /api/ai/report (schema: reason = string min 1),
// except for `other`, where the user's own text is sent instead.
const REPORT_REASON_KEYS = ['incorrect', 'harmful', 'unhelpful', 'other'] as const;
type ReportReasonKey = (typeof REPORT_REASON_KEYS)[number];
const REPORT_REASON_FALLBACKS: Record<ReportReasonKey, string> = {
  incorrect: 'Factually incorrect',
  harmful: 'Harmful or unsafe content',
  unhelpful: 'Not helpful or relevant',
  other: 'Other issue',
};

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

const CITATION_MARKER_RE = /\[(A?)(\d{1,3})\]/gi;
const VERBOSE_CITATION_PREFIX_RE = /\s*Source\s+\d+\s*;\s*[A-Za-z0-9_-]+\s*;\s*(\[\d{1,3}\])/g;
const INTERNAL_SOURCE_MARKER_RE = /\s*\[(?:MEM|DT|BM|KB|WEB|ASS|FIN)\](?=[\s.,;:!?)]|$)/gi;
const INTERNAL_RAG_ID_RE = /\b(?:rag|chunk)_\d+\b/gi;
const INTERNAL_DEBUG_LINE_RE =
  /^[^\S\r\n]*(?:[-*•]|\d+[.)])?[^\S\r\n]*(?:\*\*)?(?:No sources|No cited sources|Uncertainty\s*\/\s*verification|Source ledger|Blocked scopes|cross_tenant|other_user_private|organization_data|forbidden_by_policy|disabled_by_user|Source\s+\d+)(?:\*\*)?\b.*(?:\r?\n)?/gim;
const RAW_ARTIFACT_ENVELOPE_RE = /(?:^|\n)artifact:[a-z0-9_-]+:\s*\{[\s\S]*$/i;
const WORKBOOK_MUTATION_BLOCK_RE =
  /(?:^|\n)[ \t]*```workbook-mutation[ \t]*\r?\n[\s\S]*?\r?\n[ \t]*```[ \t]*(?=\r?\n|$)/gi;

function stripVerboseCitationPrefixes(text: string): string {
  if (!text) return text;
  return text.replace(VERBOSE_CITATION_PREFIX_RE, ' $1');
}

export function sanitizeUserVisibleAiText(text: string): string {
  if (!text) return text;
  return (
    text
      // Governed workbook mutation JSON is rendered by TeresaProposalCard.
      // Keep the conversational explanation, but do not expose or duplicate the
      // machine envelope in the user-facing message body.
      .replace(WORKBOOK_MUTATION_BLOCK_RE, '\n')
      .replace(RAW_ARTIFACT_ENVELOPE_RE, '')
      .replace(INTERNAL_DEBUG_LINE_RE, '')
      .replace(INTERNAL_SOURCE_MARKER_RE, '')
      .replace(INTERNAL_RAG_ID_RE, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
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
        const num = parseInt(match[2], 10);
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
              className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-semibold bg-c-surface-raised text-c-text-muted rounded align-super mx-0.5"
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

  // Deep Thinking state
  deepThinkingHint: { reason: string; confidence: 'low' | 'medium' | 'high' } | null;
  dtHintDismissed: boolean;
  dtPendingConfirm: {
    messageId: string;
    conversationId: string | null;
    originalMessage: string;
    editedMessage: string;
    confirm: any;
    context: any;
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
  } | null;
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
  handleBranchFromMessage?: (messageId: string) => void;
  handleCancelEditMessage: () => void;
  handleCommitEditMessage: () => void;
  handleViewArtifacts: (artifacts: Artifact[]) => void;
  handleFeedback: (messageId: string, content: string, feedback: ResponseFeedback) => void;
  handleSendMessage: (message: string) => void;
  handleEnableDeepThinking: () => void;
  handleDeepThinkingProceed: () => void;
  handleDeepThinkingReconfirm: () => void;
  handleSaveAsDecision: (messageId: string, content: string) => void;
  handleSaveAsIdea: (messageId: string, content: string) => void;
  handleSaveAsNote: (messageId: string, content: string) => void;
  handleSaveToContext: (messageId: string, content: string, role: 'user' | 'ai') => void;
  governedHandoffByMessageId?: Record<string, GovernedChatHandoffProposal>;
  governedHandoffBusyById?: Record<
    string,
    'create' | 'approve' | 'reject' | 'materialize' | undefined
  >;
  governedHandoffErrorById?: Record<string, string | undefined>;
  governedHandoffTargetById?: Record<string, string | undefined>;
  onCreateGovernedDocument?: (msg: ChatMessage) => void;
  onApproveGovernedHandoff?: (proposalId: string) => void;
  onRejectGovernedHandoff?: (proposalId: string) => void;
  onMaterializeGovernedHandoff?: (proposalId: string) => void;
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

  /**
   * B2 (artifact lifecycle): opens the canvas split-view with a chat-generated
   * deliverable (deck/doc/sheet) mounted. Fed by persisted `metadata.deliverable`
   * on the message, so the chip survives reloads.
   */
  onOpenDeliverableArtifact?: (deliverable: {
    kind: 'deck' | 'doc' | 'sheet';
    generationId: string;
    title?: string;
  }) => void;

  /**
   * B4 (auto-emission): when an AI answer is itself document-shaped (per
   * shouldOfferDocumentEmission), the transcript offers "open as document" —
   * lifts the message content into a fresh Canvas draft. Unlike
   * onOpenDeliverableArtifact, no artifact exists yet; this creates one on click.
   */
  onEmitArtifactFromMessage?: (content: string, title: string) => void;

  // Agent audit accept handler (from Api)
  handleAgentAuditAccept: (audit: any, msgId: string) => Promise<void>;

  // Option select handler (external callback)
  onOptionSelect?: (option: { id: string; label: string; value: string }) => void;

  // V8 governed proposal handlers (CHAT_V8_ACTIONS_AND_APPROVALS)
  onProposalApprove?: (proposalId: string, msg: ChatMessage) => void;
  onProposalReject?: (proposalId: string, msg: ChatMessage, reason?: string) => void;
  onProposalExecute?: (proposalId: string, msg: ChatMessage) => void;
  onProposalInspect?: (proposalId: string, msg: ChatMessage) => void;
  proposalBusyById?: Record<string, { approve?: boolean; reject?: boolean; execute?: boolean }>;

  // Krok A (domknięcie Teresy) — potwierdzenie akcji `confirmBeforeRun` z rejestru
  // Idea Workspace (`src/actions/ideaActionRegistry.ts`). Analogiczne do
  // `dtPendingConfirm` powyżej: `teresaPendingConfirm.messageId` wskazuje JEDNĄ
  // wiadomość, która dziś pokazuje przyciski „Potwierdź"/„Anuluj" — po kliknięciu
  // stan wraca do `null` i przyciski znikają (bez podwójnego wykonania).
  teresaPendingConfirm?: {
    messageId: string;
    toolName: string;
    args?: Record<string, unknown>;
    ideaId: string;
    tool: string;
    language: 'pl' | 'en';
  } | null;
  teresaConfirmBusy?: boolean;
  onTeresaConfirmProceed?: () => void;
  onTeresaConfirmCancel?: () => void;
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
  handleBranchFromMessage,
  handleCancelEditMessage,
  handleCommitEditMessage,
  handleViewArtifacts,
  handleFeedback,
  handleSendMessage,
  handleEnableDeepThinking,
  handleDeepThinkingProceed,
  handleDeepThinkingReconfirm,
  handleSaveAsDecision,
  handleSaveAsIdea,
  handleSaveAsNote,
  handleSaveToContext,
  governedHandoffByMessageId = {},
  governedHandoffBusyById = {},
  governedHandoffErrorById = {},
  governedHandoffTargetById = {},
  onCreateGovernedDocument,
  onApproveGovernedHandoff,
  onRejectGovernedHandoff,
  onMaterializeGovernedHandoff,
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
  onOpenDeliverableArtifact,
  onEmitArtifactFromMessage,
  handleAgentAuditAccept,
  onOptionSelect,
  onProposalApprove,
  onProposalReject,
  onProposalExecute,
  onProposalInspect,
  proposalBusyById,
  teresaPendingConfirm,
  teresaConfirmBusy = false,
  onTeresaConfirmProceed,
  onTeresaConfirmCancel,
}) => {
  const { t, i18n } = useTranslation();
  // Wave A7.4 — unlocks the `routingTrace` section of TrustPanel. Regular
  // members see the compact trust pills; admins/super-admins get the
  // operator view with lazy-loaded full trace.
  const { isAdmin, isSuperAdmin } = usePermissions();
  const showOperatorDetail = isAdmin || isSuperAdmin;

  const isLastMessage = index === displayMessages.length - 1;
  const isHovered = hoveredMessageId === msg.id;
  const hasArtifacts = msg.artifacts && msg.artifacts.length > 0;
  const hasThinkingSteps = msg.thinkingSteps && msg.thinkingSteps.length > 0;
  const hasCitations = Array.isArray(msg.citations) && msg.citations.length > 0;
  const metadata = (msg as any).metadata || {};
  const isDeepSearchAnswer = Boolean(metadata?.deepThinking?.kind === 'report');
  const visibleCitations = Array.isArray(msg.citations) ? msg.citations : [];
  const hasVisibleCitations = visibleCitations.length > 0;
  const isCopied = copiedMessageId === msg.id;
  const isContextSaveBusy = contextSaveBusyMessageId === msg.id;
  const isContextSaved = contextSavedMessageIds.has(msg.id);
  const governedHandoff = governedHandoffByMessageId[msg.id];
  const [showCompactActions, setShowCompactActions] = useState(false);
  const [showSourcesDetails, setShowSourcesDetails] = useState(false);

  // ── M01-010: AI-message actions (regenerate / continue / report) ───────────
  // Every one of the three is wired to a real flow: regenerate and continue go
  // through the same `handleSendMessage` the composer and the error-retry
  // button use; report goes through `Api.reportMessageFeedback` →
  // POST /api/ai/report. Nothing here confirms anything it did not actually do.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReasonKey, setReportReasonKey] = useState<ReportReasonKey>('incorrect');
  const [reportOtherText, setReportOtherText] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSentAt, setReportSentAt] = useState<number | null>(null);
  const reportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reportDialogRef = useRef<HTMLDivElement | null>(null);

  // A11y: closing the dialog must always hand focus back to its trigger.
  const closeReportDialog = useCallback(() => {
    setReportOpen(false);
    setReportError(null);
    reportTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!reportOpen) return;
    // Move focus into the dialog so keyboard users are not stranded behind it.
    reportDialogRef.current?.querySelector<HTMLElement>('[data-report-autofocus="true"]')?.focus();
  }, [reportOpen]);

  const canSaveToContext = msg.role === 'user' || msg.role === 'ai';
  const contextSaveRole: 'user' | 'ai' = msg.role === 'user' ? 'user' : 'ai';
  const userVisibleContent =
    msg.role === 'ai' ? sanitizeUserVisibleAiText(msg.content || '') : msg.content || '';

  // Last user turn before this message — the same lookup the error-retry button
  // uses; `regenerate` re-sends exactly that prompt.
  const precedingUserMessage = (() => {
    const currentIdx = displayMessages.indexOf(msg);
    if (currentIdx <= 0) return null;
    return (
      displayMessages
        .slice(0, currentIdx)
        .reverse()
        .find((m) => m.role === 'user') || null
    );
  })();
  const canRegenerate = Boolean(precedingUserMessage?.content);

  const handleRegenerateMessage = () => {
    const prompt = precedingUserMessage?.content;
    if (!prompt) return;
    handleSendMessage(prompt);
  };

  const handleContinueMessage = () => {
    handleSendMessage(
      t('chat.actions.continueInstruction', 'Continue the previous answer from where it stopped.')
    );
  };

  const handleSubmitReport = async () => {
    // Server contract: reason must be a non-empty string. `other` sends the
    // user's own words; the preset options send their key.
    const reason = reportReasonKey === 'other' ? reportOtherText.trim() : reportReasonKey;
    if (!reason || reportBusy) return;
    setReportBusy(true);
    setReportError(null);
    try {
      await Api.reportMessageFeedback(msg.id, reason);
      setReportSentAt(Date.now());
      setReportOpen(false);
      reportTriggerRef.current?.focus();
    } catch (err) {
      // Honest failure: the dialog stays open and says the report did NOT go out.
      console.error('[MessageRenderer] Report failed:', err);
      setReportError(t('chat.report.failed', 'Report could not be sent. Please try again.'));
    } finally {
      setReportBusy(false);
    }
  };

  const isDeepThinkingConfirm = (msg as any).metadata?.deepThinking?.kind === 'confirm';
  // Krok A — patrz `teresaPendingConfirm` w UnifiedChatPanel.tsx. Znacznik na
  // wiadomości mówi "to JEST pytanie o potwierdzenie"; dopasowanie po
  // `messageId` w stanie lokalnym mówi "i to pytanie NADAL czeka" (znika po
  // kliknięciu, więc drugi render tej samej wiadomości już nie pokaże przycisków).
  const isTeresaConfirm = (msg as any).metadata?.teresaConfirm === true;
  const isTeresaConfirmPending = isTeresaConfirm && teresaPendingConfirm?.messageId === msg.id;
  const confirmPayload =
    isDeepThinkingConfirm && dtPendingConfirm?.messageId === msg.id
      ? dtPendingConfirm.confirm
      : (msg as any).metadata?.deepThinkingConfirm;
  const policyDecision = (msg as any).metadata?.policyDecision;
  const policyNotices = Array.isArray((msg as any).metadata?.policyNotices)
    ? ((msg as any).metadata.policyNotices as any[])
    : [];
  const visiblePolicyNotices = policyNotices.filter((n: any) => n?.displayToUser === true);
  const policyUncertaintyNotice =
    visiblePolicyNotices.find(
      (n: any) => n?.type === 'policy_notice' && n?.kind === 'uncertainty'
    ) ||
    visiblePolicyNotices.find((n: any) => n?.kind === 'uncertainty') ||
    null;
  const policyNoSourcesNotice =
    visiblePolicyNotices.find(
      (n: any) => n?.type === 'policy_notice' && n?.kind === 'no_sources'
    ) ||
    visiblePolicyNotices.find((n: any) => n?.kind === 'no_sources') ||
    null;
  const isPolicyRefusal = msg.role === 'ai' && policyDecision && policyDecision.allowed === false;

  // V8: first-class render for governed proposal / execution message family
  // (CHAT_V8_ACTIONS_AND_APPROVALS, CHAT_V8_RESPONSE_MODEL).
  // Intercepts before the generic bubble so proposals are never rendered as
  // plain chat text and can never silently mutate state.
  const msgType = ((msg as any).type ||
    (msg as any).messageType ||
    (msg as any).metadata?.messageType) as string | undefined;
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
        onExecute={onProposalExecute}
        onInspect={onProposalInspect}
        isApproveBusy={!!busy?.approve}
        isRejectBusy={!!busy?.reject}
        isExecuteBusy={!!busy?.execute}
      />
    );
  }

  return (
    <div
      key={msg.id}
      // Anchor for deep links (e.g. jumping from a history search hit).
      data-message-anchor={msg.id}
      className={`mx-auto w-full max-w-5xl flex flex-col space-y-1.5 group mb-8 last:mb-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setHoveredMessageId(msg.id)}
      onMouseLeave={() => setHoveredMessageId(null)}
    >
      {/* Message column. No avatar — like ChatGPT, Claude, Gemini: the speaker
          is signalled by alignment (right=you, left=Teresa) and, for the user,
          a subtle bubble; Teresa's answer flows as document-style text. The
          extra avatar+flex-row wrapper was a messaging-app vestige and made
          short messages feel cramped. */}
      <div className="flex flex-col max-w-full md:max-w-[80%]">
        {/* Reasoning trace ("Tok rozumowania") — above the answer, like Grok/OpenAI.
              Expanded while streaming, collapsed once complete; persisted via metadata. */}
        {msg.role === 'ai' && (msg as any).metadata?.reasoning && (
          <ReasoningTrace
            reasoning={String((msg as any).metadata.reasoning)}
            isStreaming={!!msg.isStreaming}
            isCompact={isCompact}
            isRtl={isRtlChatLanguage}
          />
        )}
        {/* Author name for team messages */}
        {msg.role === 'user' && msg.authorName && (
          <span
            className={`text-[10px] text-c-text-muted mb-0.5 pr-1 font-medium ${
              isRtlChatLanguage ? 'text-right' : 'text-left'
            }`}
          >
            {msg.authorName}
          </span>
        )}
        <div
          className={`relative ${isCompact ? 'text-xs' : 'text-sm'} leading-relaxed ${
            msg.role === 'user'
              ? // User: subtle rounded bubble (the one place where a bubble is
                // still useful — it says "this is what *you* said"). Neutral
                // surface + soft border, fully rounded (ChatGPT/Claude/Gemini).
                // NON-crimson per SPEC-K §16 (walkthrough: "red AI bubbles").
                'rounded-2xl px-4 py-2.5 shadow-sm bg-c-surface-raised text-c-text border border-c-border'
              : // Teresa: NO bubble — answer flows as document-style text on
                // the page background. This is how ChatGPT, Claude, Grok and
                // Gemini all render the assistant turn. No bg, no border, no
                // shadow — only typography. Keeps `relative` so any
                // absolutely-positioned children inside still anchor here.
                'text-c-text'
          } ${isRtlChatLanguage ? 'text-right' : 'text-left'}`}
          dir={isRtlChatLanguage ? 'rtl' : 'ltr'}
        >
          {/* AI Message Content */}
          {msg.role === 'ai' ? (
            <div
              className={`${isDeepThinkingConfirm || isTeresaConfirm || (msg as any).metadata?.type === 'table_proposal' ? 'not-prose' : `prose ${isCompact ? 'prose-xs' : 'prose-sm'} dark:prose-invert`} max-w-none`}
            >
              {/* Policy gateway (P34-B): refusal + uncertainty visibility */}
              {isPolicyRefusal && (
                <div className="not-prose mb-3 p-3 rounded-lg border border-danger-200 dark:border-danger-900/40 bg-danger-50/70 dark:bg-danger-900/30">
                  <div className="text-xs font-semibold text-danger-800 dark:text-danger-200">
                    {t('policy.refusal.title', 'Request blocked by policy')}
                  </div>
                  {String(policyDecision?.rationale || '').trim() ? (
                    <div className="mt-1 text-[11px] text-danger-700 dark:text-danger-300">
                      {String(policyDecision.rationale).trim()}
                    </div>
                  ) : null}
                  {Array.isArray(policyDecision?.refusal?.nextSteps) &&
                  policyDecision.refusal.nextSteps.length ? (
                    <div className="mt-2 text-[11px] text-danger-700 dark:text-danger-300">
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

              {!isPolicyRefusal && policyNoSourcesNotice && !hasCitations && (
                <div className="not-prose mb-3 p-3 rounded-lg border border-c-border bg-c-surface-raised">
                  <div className="text-xs font-semibold text-c-text">
                    {t('policy.noSources.title', 'No sources found')}
                  </div>
                  <div className="mt-1 text-[11px] text-c-text-secondary">
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

              {/* Source ledger remains in message metadata for operator telemetry.
                    It is intentionally not rendered in the normal chat UX. */}

              {/* Deep Thinking: Research progress (SSE events) */}
              {isDeepSearchAnswer && (msg as any).metadata?.researchVisibility?.items && (
                <div className={`${isCompact ? 'mb-2' : 'mb-3'} not-prose`}>
                  <div className="mb-2 text-[11px] font-medium text-c-text-secondary">
                    Research & Sources (planned)
                  </div>
                  <div className="space-y-1">
                    {(msg as any).metadata?.researchVisibility?.items
                      ?.slice(0, 6)
                      .map((it: any) => (
                        <div
                          key={it.id}
                          className="flex items-start justify-between gap-2 text-[11px] bg-c-surface-raised border border-c-border rounded-md px-2 py-1"
                        >
                          <div className="min-w-0">
                            <div className="text-c-text-secondary truncate">{it.label}</div>
                            {it.rationale ? (
                              <div className="text-c-text-muted truncate">{it.rationale}</div>
                            ) : null}
                          </div>
                          <div className="flex-shrink-0 text-c-text-muted">
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

              {msg.role === 'ai' &&
                (msg as any).metadata?.proposal &&
                (msg as any).metadata?.type !== 'table_proposal' && (
                  <div className="not-prose mb-3">
                    <TeresaProposalCard
                      proposal={(msg as any).metadata.proposal}
                      onNavigate={(proposal) => {
                        const targetModule = String(proposal?.targetModule || '').toLowerCase();
                        if (targetModule.includes('canvas')) {
                          window.location.href = '/ai/work-canvas';
                          return;
                        }
                        if (targetModule.includes('action')) {
                          window.location.href = '/ai/action-center';
                          return;
                        }
                        window.location.href = '/chat';
                      }}
                    />
                  </div>
                )}

              {(msg as any).metadata?.type === 'case_intake_proposal' ? (
                // R4-P1: Teresa proposed a durable work order for THIS
                // conversation (`caseIntakeService.proposeConversationWorkOrder`,
                // reached via `/api/v10/teresa/case-intake/conversations/:id/summary`
                // — see `routes/v10/teresa.routes.ts`). Nothing was created yet
                // (CW-CANON-01); the card's own "Confirm" button is the only
                // thing that can create the Case.
                // ★ Nothing in this chat pipeline attaches this metadata type
                // today — see `CaseIntakeConfirmCard.tsx`'s header for the
                // literal PARTIAL this leaves.
                <div className="not-prose">
                  <CaseIntakeConfirmCard
                    conversationId={
                      (msg as any).metadata?.proposal?.conversationId || activeConversationId || ''
                    }
                    workOrder={(msg as any).metadata.proposal.workOrder}
                    workOrderDigest={(msg as any).metadata.proposal.workOrderDigest}
                  />
                </div>
              ) : (msg as any).metadata?.type === 'table_proposal' ? (
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
              ) : isTeresaConfirm ? (
                // Krok A — odmowa `confirmBeforeRun` z rejestru akcji (patrz
                // `teresaPendingConfirm` w UnifiedChatPanel.tsx). Treść odmowy
                // (PL, z rejestru) zostaje bez zmian; przyciski dochodzą tylko
                // dopóki TA KONKRETNA wiadomość jest oczekującym potwierdzeniem.
                <div className="not-prose space-y-2">
                  <div className="whitespace-pre-wrap">{userVisibleContent}</div>
                  {isTeresaConfirmPending && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onTeresaConfirmProceed?.()}
                        disabled={teresaConfirmBusy}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-text hover:opacity-90 text-c-surface disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {teresaConfirmBusy
                          ? teresaPendingConfirm?.language === 'pl'
                            ? 'Wykonuję…'
                            : 'Running…'
                          : teresaPendingConfirm?.language === 'pl'
                            ? 'Potwierdź'
                            : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onTeresaConfirmCancel?.()}
                        disabled={teresaConfirmBusy}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-surface border border-c-border text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {teresaPendingConfirm?.language === 'pl' ? 'Anuluj' : 'Cancel'}
                      </button>
                    </div>
                  )}
                </div>
              ) : isDeepThinkingConfirm ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-c-text-secondary">
                    Confirm Understanding (Deep Thinking)
                  </div>
                  <div className="text-xs text-c-text-secondary space-y-1">
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
                    <div className="text-xs text-c-text-secondary">
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
                    <div className="text-xs text-c-text-secondary">
                      <div className="font-medium mb-2">
                        Suggested reviewers (Agent Audit Layer)
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <label className="text-[11px] text-c-text-muted">Intent</label>
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
                          className="text-[11px] bg-c-surface border border-c-border rounded-md px-2 py-1"
                        >
                          <option value="validate">Validate</option>
                          <option value="stress_test">Stress-test</option>
                          <option value="approve">Approve</option>
                        </select>

                        <label className="text-[11px] text-c-text-muted ml-2">Max agents</label>
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
                          className="text-[11px] bg-c-surface border border-c-border rounded-md px-2 py-1"
                        >
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        {dtPendingConfirm.agentAudit!.suggested.agents.slice(0, 8).map((a: any) => {
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
                              className="flex items-start gap-2 bg-c-surface-raised border border-c-border rounded-md px-2 py-1"
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
                                <div className="text-c-text-secondary truncate">{label}</div>
                                {why ? (
                                  <div className="text-c-text-muted truncate">{why}</div>
                                ) : null}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-[11px] text-c-text-muted">
                        Selected: {dtPendingConfirm.agentAudit?.selectedAgentIds?.length || 0}{' '}
                        reviewer(s) · They will audit the final report (no interference with DT).
                      </div>
                    </div>
                  ) : null}

                  {/* Adjust */}
                  {dtPendingConfirm?.messageId === msg.id && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-c-text-muted">
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
                        className="w-full text-xs bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg p-2 outline-none focus:ring-2 focus:ring-c-focus"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleDeepThinkingProceed}
                          disabled={
                            dtConfirmBusy ||
                            isDisabled ||
                            (Array.isArray(dtPendingConfirm.agentAudit?.suggested?.agents) &&
                              dtPendingConfirm.agentAudit?.suggested?.agents?.length > 0 &&
                              (dtPendingConfirm.agentAudit?.selectedAgentIds?.length || 0) === 0)
                          }
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-text hover:opacity-90 text-c-surface disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Confirm & proceed
                        </button>
                        <button
                          onClick={handleDeepThinkingReconfirm}
                          disabled={dtConfirmBusy || isDisabled}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-surface border border-c-border text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
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
                    const cleanContent = sanitizeUserVisibleAiText(
                      stripVerboseCitationPrefixes(
                        msg.content.replace(/💡\s*IDEA_HINT:\s*.+?\|.+/g, '')
                      )
                    );

                    const structuredEnvelope = (msg as any)?.metadata?.structuredOutput ?? null;

                    // Feedback #3c5b87cf / #05b77280: wire inline `[N]` markers
                    // to `msg.citations[N-1]` so tappers actually open the
                    // source card. Empty/missing citations fall through to a
                    // muted non-clickable pill (see renderNodesWithCitations).
                    const inlineCitations = visibleCitations;
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
                                  <code className="px-1 py-0.5 bg-c-surface-raised border border-c-border rounded text-c-text text-xs font-mono">
                                    {children}
                                  </code>
                                );
                              }
                              // Chat P1-2 — production-grade fenced code block:
                              // language label, hover-revealed Copy button,
                              // Mermaid render via the shared lazy renderer.
                              return (
                                <ChatCodeBlock className={codeClassName}>{children}</ChatCodeBlock>
                              );
                            },
                            a: ({ href, children }: any) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-c-accent hover:opacity-80 underline underline-offset-2"
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
                                  <div className="text-[11px] text-c-text-secondary mt-0.5">
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
                      <div className="mt-3 p-3 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg">
                        {(() => {
                          const audit = (msg as any).metadata?.agentAudit || {};
                          const verdict = audit?.verdict || {};
                          const reviews = Array.isArray(audit?.reviews) ? audit.reviews : [];
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
                            reviews.find((r: any) => String(r?.agentId || '') === activeAgentId) ||
                            reviews[0] ||
                            null;

                          const renderSource = (s: any, idx: number) => {
                            if (!s || !s.type) return null;
                            if (s.type === 'dt_section') {
                              return (
                                <div
                                  key={`${s.type}-${idx}`}
                                  className="text-[11px] text-c-text-secondary"
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
                                  className="text-[11px] text-c-text-secondary"
                                >
                                  <div>
                                    <span className="font-medium">KB</span>
                                    {meta ? `: ${meta}` : ''}
                                  </div>
                                  {s.snippet ? (
                                    <div className="mt-1 px-2 py-1 bg-c-surface border border-c-border rounded text-[10px] leading-snug">
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
                                  <span className="font-medium text-c-text-secondary">Web</span>
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
                                <div className="text-xs font-semibold text-c-text-secondary">
                                  Agent Audit — details
                                </div>
                                <div className="text-[11px] text-c-text-muted">
                                  Status:{' '}
                                  <span className="font-medium">
                                    {String(verdict?.qualityStatus || '—')}
                                  </span>
                                  {gates.length ? ` · Gates: ${gates.join(', ')}` : ''}
                                </div>
                              </div>

                              {gateExplanations.length ? (
                                <div className="mt-2">
                                  <div className="text-[11px] font-medium text-c-text-secondary mb-1">
                                    Gate reasons
                                  </div>
                                  <ul className="space-y-0.5">
                                    {gateExplanations.slice(0, 6).map((g: any, i: number) => (
                                      <li
                                        key={`${String(g?.gate || '')}-${i}`}
                                        className="text-[11px] text-c-text-secondary"
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
                                    disabled={isDisabled || agentAuditBusy}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-text hover:opacity-90 text-c-surface disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Accept risk & proceed
                                  </button>
                                  <div className="text-[11px] text-c-text-muted">
                                    This is recorded in the audit trail.
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
                                              : 'bg-c-surface border-c-border text-c-text-secondary hover:bg-c-surface-raised'
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
                                      <div className="text-[11px] text-c-text-muted">
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
                                          <div className="text-[11px] font-medium text-c-text-secondary mb-1">
                                            Findings
                                          </div>
                                          <div className="space-y-2">
                                            {activeReview.findings
                                              .slice(0, 8)
                                              .map((f: any, i: number) => (
                                                <div
                                                  key={`${String(f?.area || 'other')}-${i}`}
                                                  className="p-2 bg-c-surface border border-c-border rounded-md"
                                                >
                                                  <div className="text-[11px] text-c-text-secondary">
                                                    <span className="font-semibold">
                                                      {String(f.severity || '').toUpperCase()}
                                                    </span>
                                                    {` · ${String(f.area || 'other')}`} —{' '}
                                                    {String(f.claim || '').trim()}
                                                  </div>

                                                  {Array.isArray(f.sourcesUsed) &&
                                                  f.sourcesUsed.length ? (
                                                    <div className="mt-1 space-y-1">
                                                      {f.sourcesUsed.slice(0, 4).map(renderSource)}
                                                    </div>
                                                  ) : null}

                                                  {Array.isArray(f.missingDataQuestions) &&
                                                  f.missingDataQuestions.length ? (
                                                    <div className="mt-1 text-[11px] text-c-text-secondary">
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
                                          <div className="text-[11px] font-medium text-c-text-secondary mb-1">
                                            Conflicts
                                          </div>
                                          <ul className="list-disc pl-4 text-[11px] text-c-text-secondary">
                                            {activeReview.conflicts
                                              .slice(0, 6)
                                              .map((c: any, ci: number) => (
                                                <li key={ci}>
                                                  with{' '}
                                                  <span className="font-medium">
                                                    {String(c.withAgentId || '')}
                                                  </span>
                                                  {c.aboutArea ? ` (${String(c.aboutArea)})` : ''}:{' '}
                                                  {String(c.conflictStatement || '')}
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
                    className="w-full text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg p-2 outline-none focus:ring-2 focus:ring-c-focus text-c-text"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleCancelEditMessage}
                      disabled={editBusy}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-surface border border-c-border text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      onClick={handleCommitEditMessage}
                      disabled={editBusy || !editingText.trim()}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-text hover:opacity-90 text-c-surface disabled:opacity-50"
                    >
                      {editBusy ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                    </button>
                  </div>
                </div>
              ) : (
                // Plain user content. Edit is hover-revealed in the floating
                // toolbar (single, discoverable affordance — no duplicate pencil
                // crammed into the bubble corner). Matches Claude/Grok/Gemini.
                <span>{userVisibleContent}</span>
              )}
              {/* Chat P0-4 — render the attachments the composer captured on
                  this user message. Previously stored on metadata.attachments
                  but never displayed; users couldn't tell whether their
                  attachment had actually been sent. Matches ChatGPT/Claude
                  pattern of inline chips. */}
              {Array.isArray((msg as any).metadata?.attachments) &&
                (msg as any).metadata.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(msg as any).metadata.attachments
                      .slice(0, 12)
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .map((att: any, idx: number) => {
                        const name = String(att?.name || att?.title || att?.id || 'attachment');
                        const kind = String(att?.kind || att?.type || 'file').toLowerCase();
                        const url = typeof att?.url === 'string' ? att.url : null;
                        const label = name.length > 40 ? `${name.slice(0, 38)}…` : name;
                        const icon = kind.startsWith('image')
                          ? '🖼️'
                          : kind.startsWith('link') || kind.startsWith('url')
                            ? '🔗'
                            : kind === 'voice' || kind === 'audio'
                              ? '🎤'
                              : '📎';
                        return url ? (
                          <a
                            key={`${name}-${idx}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-primary-100/70 px-2 py-0.5 text-[11px] font-medium text-primary-800 hover:bg-primary-200/70 dark:bg-primary-800/30 dark:text-primary-100 dark:hover:bg-primary-700/40"
                            title={name}
                          >
                            <span aria-hidden>{icon}</span>
                            <span>{label}</span>
                          </a>
                        ) : (
                          <span
                            key={`${name}-${idx}`}
                            className="inline-flex items-center gap-1 rounded-full bg-primary-100/70 px-2 py-0.5 text-[11px] font-medium text-primary-800 dark:bg-primary-800/30 dark:text-primary-100"
                            title={name}
                          >
                            <span aria-hidden>{icon}</span>
                            <span>{label}</span>
                          </span>
                        );
                      })}
                  </div>
                )}
            </>
          )}

          {/* Streaming indicator:
                - no content yet  → "Thinking…" dots (single avatar-aligned row)
                - content flowing → inline blinking cursor at the end of the text */}
          {msg.isStreaming &&
            (!msg.content?.trim() ? (
              <ThinkingIndicator
                isActive
                label={t('thinking.processing', 'Thinking...') as string}
                className={isCompact ? 'text-[11px]' : ''}
              />
            ) : (
              <span className="inline-flex items-center gap-0.5 ml-1 align-baseline">
                {/* Typographic streaming cursor: thin vertical bar that inherits
                    text color (ChatGPT/Claude pattern). h-[1.1em] tracks the
                    current font size; bg-current themes automatically. */}
                <span className="inline-block w-[2px] h-[1.1em] align-baseline bg-current opacity-70 animate-pulse" />
              </span>
            ))}

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
              {userVisibleContent && userVisibleContent.length > 50 && (
                <span
                  className="text-c-text-muted"
                  title={t(
                    'stream.costEstimateTooltip',
                    'Estimated AI cost for this response based on token usage'
                  )}
                >
                  ~$
                  {(
                    (userVisibleContent.length / 4) * 0.000015 +
                    (userVisibleContent.length / 4) * 0.00006
                  ).toFixed(4)}{' '}
                  est.
                </span>
              )}
            </div>
          )}

          {/* Abort feedback — transparent cancellation acknowledgement */}
          {!msg.isStreaming && isLastMessage && abortFeedback && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-c-text-muted transition-opacity duration-500">
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
              <div className="mt-3 p-2.5 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-c-accent animate-pulse" />
                  <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                    {agentAuditState.state === 'reviewing'
                      ? t('agentAudit.streaming.reviewing', 'Multi-Agent Review in Progress')
                      : agentAuditState.state === 'aggregating'
                        ? t('agentAudit.streaming.aggregating', 'Aggregating Agent Findings')
                        : t('agentAudit.streaming.processing', 'Agent Audit Processing')}
                  </span>
                  {agentAuditState.agentsTotal && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
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
                                  ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300'
                                  : isActive
                                    ? 'bg-c-info/10 border-c-info/30 text-c-info'
                                    : 'bg-c-surface-raised border-c-border text-c-text-secondary'
                            }`}
                          >
                            {isDone ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            ) : isError ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-danger-500" />
                            ) : isActive ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-c-accent animate-pulse" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-c-text-muted" />
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

          {/* User hover toolbar moved below the bubble (ChatGPT/Claude
                pattern) — see end of this column. */}
        </div>

        {/* Hover Actions — user messages, BELOW the bubble.
              Always rendered, fades in/out via the outer `group` on hover so the
              transition is smooth (no pop in/out). Right-aligned because the
              column itself sits at items-end for user turns. */}
        {!msg.isStreaming && msg.role === 'user' && (
          <div className="flex items-center gap-0.5 mt-1 self-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
            {/* Copy */}
            <button
              onClick={() => handleCopyMessage(userVisibleContent, msg.id)}
              className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised"
              title={t('chat.actions.copy', 'Copy')}
            >
              {isCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>

            {/* Edit (user only) */}
            <button
              onClick={() => handleStartEditMessage(msg.id)}
              className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised"
              title={t('chat.actions.edit', 'Edit')}
            >
              <Pencil size={12} />
            </button>

            {canSaveToContext && (
              <button
                onClick={() => handleSaveToContext(msg.id, userVisibleContent, contextSaveRole)}
                disabled={isContextSaveBusy || isContextSaved}
                className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Branch / Fork (composer #4) — copy the thread up to here into a
                new conversation. Hidden for not-yet-persisted local messages. */}
            {handleBranchFromMessage && !String(msg.id || '').startsWith('local-') && (
              <button
                onClick={() => handleBranchFromMessage(msg.id)}
                className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised"
                title={t('chat.actions.branch', 'Branch from here')}
              >
                <GitBranch size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* B2 — Deliverable artifact chip (deck/doc generated in chat).
          Reads the persisted message metadata, so it re-renders after reload;
          clicking re-opens the canvas split-view with the artifact mounted. */}
      {msg.role === 'ai' &&
        !msg.isStreaming &&
        onOpenDeliverableArtifact &&
        (metadata as any)?.deliverable?.generationId && (
          <div className="mt-1.5">
            <ArtifactChip
              kind={
                (metadata as any).deliverable.kind === 'doc'
                  ? 'doc'
                  : (metadata as any).deliverable.kind === 'sheet'
                    ? 'sheet'
                    : 'deck'
              }
              title={String(
                (metadata as any).deliverable.title ||
                  ((metadata as any).deliverable.kind === 'doc'
                    ? 'Document'
                    : (metadata as any).deliverable.kind === 'sheet'
                      ? 'Sheet'
                      : 'Presentation')
              )}
              onOpen={() => onOpenDeliverableArtifact((metadata as any).deliverable)}
            />
          </div>
        )}

      {/* B4 — auto-emission offer. When an AI answer is itself document-shaped
          (and didn't already produce a deliverable), offer to lift it into a
          Canvas draft. Decision D-C-4: a chip, never an auto-opened panel. */}
      {(() => {
        if (msg.role !== 'ai' || msg.isStreaming) return null;
        if (!onEmitArtifactFromMessage) return null;
        if ((metadata as any)?.deliverable?.generationId) return null; // B2 chip already shown
        const content = String(msg.content || '');
        const decision = shouldOfferDocumentEmission(content);
        if (!decision.offer) return null;
        return (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => onEmitArtifactFromMessage(content, decision.title)}
              className="group inline-flex max-w-full items-center gap-2 rounded-xl border border-c-border bg-c-surface-raised px-3 py-1.5 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/70 dark:hover:border-primary-700/50 dark:hover:bg-primary-900/20"
              title={t('chat.message.emitDocumentTooltip', 'Create a document from this answer')}
            >
              <FilePlus2
                size={14}
                className="shrink-0 text-c-text-muted group-hover:text-primary-500"
              />
              <span className="truncate text-xs font-medium text-c-text-secondary group-hover:text-primary-600">
                {t('chat.message.openAsDocument', 'Open as document')}
              </span>
            </button>
          </div>
        );
      })()}

      {/* Enhanced Artifacts Badge */}
      {msg.role === 'ai' && hasArtifacts && (
        <div className={`flex flex-wrap gap-1.5`}>
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

      {/* TRUST T-TR1 — compact sources chip, revealed on hover (clean default).
          Render whenever the backend provides real citations; empty/missing stay silent. */}
      {msg.role === 'ai' &&
        !msg.isStreaming &&
        hasVisibleCitations &&
        (isHovered || isLastMessage || showCompactActions || showSourcesDetails) && (
          <div className={`mt-1`}>
            <TrustBadge
              citations={visibleCitations}
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
      {msg.role === 'ai' && hasVisibleCitations && showCompactActions && showSourcesDetails && (
        <div className={`mt-1`} data-message-id={msg.id} data-citations-list="true">
          <CitationList citations={visibleCitations} collapsed />
        </div>
      )}

      {msg.role === 'ai' && governedHandoff ? (
        <GovernedChatHandoffCard
          proposal={governedHandoff}
          busy={
            governedHandoffBusyById[governedHandoff.proposalId] === 'create'
              ? null
              : (governedHandoffBusyById[governedHandoff.proposalId] as
                  | 'approve'
                  | 'reject'
                  | 'materialize'
                  | undefined)
          }
          error={governedHandoffErrorById[governedHandoff.proposalId]}
          targetRecordId={governedHandoffTargetById[governedHandoff.proposalId]}
          onApprove={() => onApproveGovernedHandoff?.(governedHandoff.proposalId)}
          onReject={() => onRejectGovernedHandoff?.(governedHandoff.proposalId)}
          onMaterialize={() => onMaterializeGovernedHandoff?.(governedHandoff.proposalId)}
        />
      ) : null}

      {/*
        V8 / Wave A7 — Canonical trust panel for AI replies (Gap #10 —
        Output trust as one contract). Empty / missing bundles produce
        no output so historical messages and opt-out producers are
        unaffected. Skipped while streaming — the bundle is only sealed
        at DONE.
      */}
      {msg.role === 'ai' &&
        !msg.isStreaming &&
        metadata?.trustBundle &&
        showCompactActions &&
        showSourcesDetails && (
          <div className={`mt-1 flex flex-col gap-1`}>
            {/* Chat V9 / TRUST TS1 — post-send sources aggregate. Silent when
              the bundle has no meaningful breakdown, so single-class turns
              still read exactly like pre-TS1 (TrustPanel primary pill
              carries the signal). */}
            <SourcesStrip
              bundle={metadata.trustBundle}
              messageId={msg.id || null}
              isCompact={isCompact}
            />
            <TrustPanel
              bundle={metadata.trustBundle}
              isCompact={isCompact}
              isRtl={isRtlChatLanguage}
              showOperatorDetail={showOperatorDetail}
              messageId={msg.id || null}
            />
          </div>
        )}

      {/* One stable response-action capsule. Controls stay mounted while the
          response streams or capabilities are temporarily unavailable; their
          disabled/busy state replaces the former layout-shifting disappearance. */}
      {msg.role === 'ai' && (
        <div
          className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-xl border border-white/30 bg-gradient-to-br from-white/85 to-white/65 px-1.5 py-1 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:from-navy-900/80 dark:to-navy-800/60"
          data-testid="message-response-actions"
          data-response-state={msg.isStreaming ? 'streaming' : isDisabled ? 'disabled' : 'ready'}
        >
          {/* Copy — always visible */}
          <button
            onClick={() => handleCopyMessage(userVisibleContent, msg.id)}
            disabled={msg.isStreaming}
            className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title={t('chat.actions.copy', 'Copy')}
            aria-label={t('chat.actions.copy', 'Copy')}
          >
            {isCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>
          {/* Speak — always visible */}
          <button
            onClick={() => {
              stopSpeaking();
              setTimeout(() => speak(userVisibleContent), 60);
            }}
            disabled={msg.isStreaming}
            className={`p-1 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              voiceState.isSpeaking
                ? 'text-danger-500'
                : 'text-c-text-muted hover:text-c-text hover:bg-c-surface-raised'
            }`}
            title={
              voiceState.isSpeaking
                ? t('chat.actions.stop', 'Stop')
                : t('chat.actions.speak', 'Speak')
            }
            aria-label={t('chat.actions.speak', 'Speak')}
          >
            <Volume2 size={12} />
          </button>
          {/* More (feedback / save / sources) */}
          <button
            onClick={() =>
              setShowCompactActions((v) => {
                const next = !v;
                if (!next) setShowSourcesDetails(false);
                return next;
              })
            }
            disabled={msg.isStreaming}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-c-border text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title={t('chat.actions.toggleResponseActions', 'More actions')}
            aria-label={t('chat.actions.toggleResponseActions', 'More actions')}
          >
            {showCompactActions ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          <fieldset
            disabled={msg.isStreaming || isDisabled}
            className={`relative items-center gap-0.5 border-l border-c-border pl-1 ${showCompactActions ? 'inline-flex' : 'hidden'}`}
            aria-hidden={!showCompactActions}
            data-testid="message-response-actions-expanded"
          >
            <InlineResponseFeedback
              messageId={msg.id}
              conversationId={activeConversationId || undefined}
              responseLength={userVisibleContent.length}
              onFeedback={(feedback) => handleFeedback(msg.id, userVisibleContent, feedback)}
              compact
              thumbsOnly
              // M01-P03 §7 — hydrate "already rated" from the persisted
              // message. M01-P03B (2026-08-05) wired the server-side
              // join that makes this real: GET /api/conversations/:id
              // now attaches the caller's own ai_response_feedback
              // rating onto each message, so `msg.feedback` is no
              // longer always null on real data.
              existingFeedback={
                msg.feedback &&
                (msg.feedback.rating === 'positive' || msg.feedback.rating === 'negative')
                  ? { rating: msg.feedback.rating, timestamp: new Date() }
                  : null
              }
            />
            {/* Regenerate remains mounted; without a preceding user turn it is
                honestly disabled instead of changing the action-row geometry. */}
            <button
              onClick={handleRegenerateMessage}
              disabled={isDisabled || msg.isStreaming || !canRegenerate}
              data-testid="message-action-regenerate"
              className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              title={t('chat.actions.regenerate', 'Regenerate')}
              aria-label={t('chat.actions.regenerate', 'Regenerate')}
            >
              <RefreshCw size={12} />
            </button>
            {/* M01-010 — Continue: sends a continuation instruction on the
                    same `handleSendMessage` path. */}
            <button
              onClick={handleContinueMessage}
              disabled={isDisabled}
              data-testid="message-action-continue"
              className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              title={t('chat.actions.continue', 'Continue')}
              aria-label={t('chat.actions.continue', 'Continue')}
            >
              <CornerDownRight size={12} />
            </button>
            {/* M01-010 — Report: opens the reason prompt, then really POSTs
                    to /api/ai/report via Api.reportMessageFeedback.
                    Hidden for optimistic messages: the endpoint requires a
                    persisted uuid, so a `local-` id could only ever 400. Same
                    guard Branch uses. */}
            <button
              ref={reportTriggerRef}
              onClick={() => {
                setReportError(null);
                setReportOpen((v) => !v);
              }}
              data-testid="message-action-report"
              aria-haspopup="dialog"
              aria-expanded={reportOpen}
              disabled={msg.isStreaming || String(msg.id || '').startsWith('local-')}
              className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              title={t('chat.actions.report', 'Report')}
              aria-label={t('chat.actions.report', 'Report')}
            >
              <Flag size={12} />
            </button>
            <button
              onClick={() => handleSaveAsNote(msg.id, userVisibleContent)}
              className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
              title={t('myWork.notebook.saveAsNote', 'Save as note')}
              aria-label={t('myWork.notebook.saveAsNote', 'Save as note')}
            >
              <Bookmark size={12} />
            </button>
            <button
              onClick={() => handleSaveAsIdea(msg.id, userVisibleContent)}
              className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
              title={t('myWork.ideas.saveAsIdea', 'Save as idea')}
              aria-label={t('myWork.ideas.saveAsIdea', 'Save as idea')}
            >
              <Lightbulb size={12} />
            </button>
            {!governedHandoff && onCreateGovernedDocument ? (
              <button
                onClick={() => onCreateGovernedDocument(msg)}
                disabled={Boolean(governedHandoffBusyById[msg.id])}
                className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('chat.governedHandoff.proposeDocument', 'Propose governed document')}
                aria-label={t('chat.governedHandoff.proposeDocument', 'Propose governed document')}
              >
                {governedHandoffBusyById[msg.id] === 'create' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FilePlus2 size={12} />
                )}
              </button>
            ) : null}
            {canSaveToContext && (
              <button
                onClick={() => handleSaveToContext(msg.id, userVisibleContent, contextSaveRole)}
                disabled={isContextSaveBusy || isContextSaved}
                className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isContextSaved
                    ? t('chat.actions.savedToContext', 'Saved to Context OS')
                    : t('chat.actions.saveToContext', 'Save to Context OS')
                }
                aria-label={t('chat.actions.saveToContext', 'Save to Context OS')}
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
            <button
              onClick={() => setShowSourcesDetails((v) => !v)}
              className={`p-1 rounded-md transition-colors ${
                showSourcesDetails
                  ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/25'
                  : 'text-c-text-muted hover:text-c-text hover:bg-c-surface-raised'
              }`}
              title={t('chat.sources.details', 'Sources details')}
              aria-label={t('chat.sources.details', 'Sources details')}
            >
              <ShieldCheck size={12} />
            </button>
            <span className="mx-0.5 h-3 w-px bg-c-border" />

            {/* M01-010 — report reason prompt. Escape closes it and focus
                    returns to the Report button (see closeReportDialog). */}
            {reportOpen && (
              <div
                ref={reportDialogRef}
                role="dialog"
                aria-modal="false"
                aria-label={t('chat.report.title', 'Report an issue')}
                data-testid="message-report-dialog"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    closeReportDialog();
                  }
                }}
                className="absolute top-full left-0 z-30 mt-1 w-64 rounded-xl border border-c-border bg-c-surface p-3 shadow-lg text-left"
              >
                <div className="text-xs font-semibold text-c-text">
                  {t('chat.report.title', 'Report an issue')}
                </div>
                <p className="mt-0.5 text-[11px] text-c-text-muted">
                  {t('chat.report.description', 'Let us know what went wrong with this response.')}
                </p>
                <div className="mt-2 flex flex-col gap-1" role="radiogroup">
                  {REPORT_REASON_KEYS.map((key, idx) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-[11px] text-c-text-secondary cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`report-reason-${msg.id}`}
                        value={key}
                        checked={reportReasonKey === key}
                        onChange={() => setReportReasonKey(key)}
                        data-report-autofocus={idx === 0 ? 'true' : undefined}
                        className="accent-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      />
                      <span>{t(`chat.report.${key}`, REPORT_REASON_FALLBACKS[key])}</span>
                    </label>
                  ))}
                </div>
                {reportReasonKey === 'other' && (
                  <textarea
                    value={reportOtherText}
                    onChange={(e) => setReportOtherText(e.target.value)}
                    rows={2}
                    data-testid="message-report-other-text"
                    placeholder={t('chat.report.otherPlaceholder', 'Describe the issue...')}
                    aria-label={t('chat.report.otherPlaceholder', 'Describe the issue...')}
                    className="mt-2 w-full rounded-lg border border-c-border bg-c-surface-raised px-2 py-1 text-[11px] text-c-text placeholder:text-c-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  />
                )}
                {reportError && (
                  <div
                    role="alert"
                    data-testid="message-report-error"
                    className="mt-2 text-[11px] text-danger-600 dark:text-danger-300"
                  >
                    {reportError}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={closeReportDialog}
                    data-testid="message-report-cancel"
                    className="h-6 px-2 rounded-md text-[11px] text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReport}
                    disabled={
                      reportBusy ||
                      (reportReasonKey === 'other' && reportOtherText.trim().length === 0)
                    }
                    data-testid="message-report-submit"
                    className="h-6 px-2 rounded-md border border-c-border bg-c-surface text-[11px] font-medium text-c-text hover:bg-c-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    {reportBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      t('chat.report.submit', 'Report')
                    )}
                  </button>
                </div>
              </div>
            )}
          </fieldset>

          {/* Honest result of the last report attempt (success only — a
                failure keeps the dialog open with an inline error). */}
          {!reportOpen && reportSentAt !== null && (
            <span
              role="status"
              data-testid="message-report-status"
              className="text-[11px] text-c-text-muted"
            >
              {t('chat.report.sent', 'Report sent for review.')}
            </span>
          )}
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
            className={`mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg`}
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
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-c-surface border border-c-border text-c-text-secondary hover:bg-c-surface-raised transition-colors"
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
            className={`mt-2 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/50 rounded-lg`}
          >
            <p className="text-xs font-medium text-primary-800 dark:text-primary-200 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary-500" />
              {t('deepThinking.ctaTitle', 'What do you want to do with this output?')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSaveAsDecision(msg.id, userVisibleContent)}
                disabled={dtSavingDecision === msg.id}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-text hover:opacity-90 text-c-surface disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <Bookmark size={12} />
                {dtSavingDecision === msg.id
                  ? t('deepThinking.saving', 'Saving…')
                  : t('deepThinking.saveDecision', 'Save as Decision')}
              </button>
              <button
                onClick={() => handleSaveAsDecision(msg.id, userVisibleContent)}
                disabled={dtSavingDecision === msg.id}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-surface border border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 disabled:opacity-50 transition-colors flex items-center gap-1"
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
                  const fullContent = header + userVisibleContent;
                  const blob = new Blob([fullContent], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `deep-thinking-report-${dateStr}.md`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-surface border border-c-border text-c-text-secondary hover:bg-c-surface-raised transition-colors flex items-center gap-1"
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
                  handleSaveAsNote(msg.id, `# ${reportTitle}\n\n${userVisibleContent}`);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-surface border border-c-border text-c-text-secondary hover:bg-c-surface-raised transition-colors flex items-center gap-1"
              >
                <Bookmark size={12} />
                {t('deepThinking.saveToNotebook', 'Save to Notebook')}
              </button>
              {/* Voice Executive Brief */}
              <button
                onClick={() => {
                  const brief = formatExecutiveBrief(userVisibleContent, 'en');
                  speak(brief);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-surface border border-c-border text-c-text-secondary hover:bg-c-surface-raised transition-colors flex items-center gap-1"
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
          className={`mt-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg`}
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
            className={`mt-2 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/50 rounded-lg`}
          >
            <p className="text-xs font-semibold text-primary-800 dark:text-primary-200 mb-2 flex items-center gap-1.5">
              <BrainCircuit size={14} className="text-primary-500" />
              {t('deepThinking.interimInsight', 'Preliminary insight — dominant paths emerging:')}
            </p>
            <ul className="space-y-1 mb-2">
              {interimInsight.paths.map((p) => (
                <li key={p.id} className="text-xs text-primary-700 dark:text-primary-300">
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
                className="px-3 py-1 text-xs font-medium rounded-lg bg-c-text hover:opacity-90 text-c-surface transition-colors"
              >
                {t('deepThinking.narrowFocusBtn', 'Narrow focus')}
              </button>
              <button
                onClick={() => handleSendMessage(t('deepThinking.goDeeper', 'Go deeper'))}
                className="px-3 py-1 text-xs font-medium rounded-lg bg-c-surface border border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 transition-colors"
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
          <div className={`mt-3 flex flex-wrap gap-2`}>
            <button
              onClick={() => handleRunDirectedDeepening((msg as any).metadata?.agentAudit)}
              disabled={
                isDisabled ||
                agentAuditBusy ||
                Number((msg as any).metadata?.agentAudit?.loopIteration || 1) >= 2
              }
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {agentAuditBusy ? 'Running audit…' : 'Run directed deepening'}
            </button>
            <div className="text-[11px] text-c-text-muted self-center">
              Iterations: {String((msg as any).metadata?.agentAudit?.loopIteration || 1)}/2
            </div>
          </div>
        )}

      {/* Interactive Options */}
      {msg.role === 'ai' && !msg.isStreaming && msg.options && msg.options.length > 0 && (
        <div className={`mt-3 flex flex-wrap gap-2`}>
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
                          : 'bg-c-surface border-c-border text-c-text-secondary hover:bg-c-surface-raised'
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
                  className="self-start px-4 py-1.5 bg-c-text hover:opacity-90 text-c-surface text-xs font-medium rounded-lg transition-colors shadow-sm"
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
                className="px-3 py-1.5 bg-c-surface border border-c-border text-c-text-secondary text-xs rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/10 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-700 dark:hover:text-primary-300 transition-all"
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
