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

import { Artifact, ChatMessage, ResponseFeedback, ThinkingStep } from '../../types';
import { formatExecutiveBrief } from '../../utils/textCleaning';
import { ArtifactBadge } from './ArtifactBadge';
import { ChatTableProposalCard } from './ChatTableProposalCard';
import { CitationList } from './CitationList';
import { InlineResponseFeedback } from './InlineResponseFeedback';
import { ResearchProgress } from './ResearchProgress';
import { ThinkingStatusLine } from './ThinkingStatusLine';

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
}) => {
  const { t } = useTranslation();

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

  return (
    <div
      key={msg.id}
      className={`flex flex-col space-y-1.5 group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setHoveredMessageId(msg.id)}
      onMouseLeave={() => setHoveredMessageId(null)}
    >
      {/* Cursor-like thinking log: plain dim text, no background, no panel */}
      {/* Only show for the LAST streaming AI message to avoid duplicated lines */}
      {msg.role === 'ai' &&
        msg.isStreaming &&
        isLastMessage &&
        (thinkingSteps.length > 0 || !msg.content?.trim()) && (
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
              label={t('thinking.processing', 'Rozważam Twoje zapytanie...') as string}
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
                      const cleanContent = msg.content
                        .replace(/💡\s*IDEA_HINT:\s*.+?\|.+/g, '')
                        .trim();

                      return (
                        <>
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
                                      disabled={isDisabled || agentAuditBusy}
                                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Accept risk & proceed
                                    </button>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
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

      {/* Citations */}
      {msg.role === 'ai' && hasCitations && (
        <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-1`}>
          <CitationList citations={msg.citations!} />
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
                Number((msg as any).metadata?.agentAudit?.loopIteration || 1) >= 2
              }
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {agentAuditBusy ? 'Running audit…' : 'Run directed deepening'}
            </button>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 self-center">
              Iterations: {String((msg as any).metadata?.agentAudit?.loopIteration || 1)}/2
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
