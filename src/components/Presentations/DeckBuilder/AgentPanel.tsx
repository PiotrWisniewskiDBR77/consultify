import { Check, FileDiff, MessageSquare, Send, Sparkles, X, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConversationStore } from '@/store/useConversationStore';

interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

interface PendingProposal {
  operationId: string;
  plan?: {
    scope?: string;
    mutationKinds?: string[];
    targetSlides?: Array<string | number>;
    sectionHint?: string;
    [key: string]: unknown;
  };
  diff?: {
    editPlan?: unknown;
    [key: string]: unknown;
  };
  reply?: string;
  appliedActions?: string[];
}

interface AgentPanelProps {
  onClose: () => void;
  sourceNames?: string[];
  onSendMessage?: (
    message: string
  ) => Promise<{ reply?: string; [key: string]: unknown } | string | void>;
  conversationId?: string | null;
  deckId?: string;
  onProposalAccepted?: (payload: { operationId: string; deck?: any; version?: number }) => void;
  onProposalRejected?: (payload: { operationId: string }) => void;
}

const SUGGESTION_KEYS = [
  'presentations.agent.suggestions.addSummary',
  'presentations.agent.suggestions.makeConcise',
  'presentations.agent.suggestions.addNotes',
  'presentations.agent.suggestions.updateData',
  'presentations.agent.suggestions.improveVisuals',
];

export const AgentPanel: React.FC<AgentPanelProps> = ({
  onClose,
  sourceNames,
  onSendMessage,
  conversationId,
  deckId,
  onProposalAccepted,
  onProposalRejected,
}) => {
  const { t } = useTranslation();
  const { activeMessages, addMessage } = useConversationStore();
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'greeting',
      role: 'agent',
      text: t('presentations.agent.greeting', {
        sources: sourceNames?.join(', ') || 'your sources',
        defaultValue: `Hi! I know this deck was built from ${sourceNames?.join(', ') || 'your sources'}. How can I help?`,
      }),
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId || !activeMessages?.length) return;
    const kimiMessages: AgentMessage[] = activeMessages
      .filter((m) => m.role === 'user' || m.role === 'ai')
      .map((m) => ({
        id: m.id || `kimi-${Date.now()}-${Math.random()}`,
        role: m.role === 'user' ? ('user' as const) : ('agent' as const),
        text: typeof m.content === 'string' ? m.content : '',
        timestamp: (m as { timestamp?: string }).timestamp || new Date().toISOString(),
      }))
      .filter((m) => m.text);
    if (kimiMessages.length > 0) {
      setMessages((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newMsgs = kimiMessages.filter((m) => !existingIds.has(m.id));
        return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
      });
    }
  }, [conversationId, activeMessages]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const message = input.trim();
    const userMsg: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: message,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    if (conversationId) {
      addMessage?.({ conversationId, role: 'user', content: message, messageType: 'text' }).catch(
        () => {}
      );
    }

    try {
      const response = await onSendMessage?.(message);
      const isProposal =
        typeof response === 'object' &&
        response !== null &&
        'operationId' in response &&
        (response as { status?: unknown }).status === 'proposal';

      if (isProposal) {
        const payload = response as {
          operationId: string;
          plan?: PendingProposal['plan'];
          diff?: PendingProposal['diff'];
          reply?: string;
          appliedActions?: string[];
        };
        const appliedActions =
          payload.appliedActions ||
          (Array.isArray(payload.plan?.mutationKinds)
            ? (payload.plan?.mutationKinds as string[])
            : undefined);
        setPendingProposal({
          operationId: payload.operationId,
          plan: payload.plan,
          diff: payload.diff,
          reply: payload.reply,
          appliedActions,
        });
        setProposalError(null);
        if (payload.reply) {
          const agentMsg: AgentMessage = {
            id: `msg-${Date.now()}-agent`,
            role: 'agent',
            text: payload.reply,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, agentMsg]);
          if (conversationId) {
            addMessage?.({
              conversationId,
              role: 'ai',
              content: payload.reply,
              messageType: 'text',
            }).catch(() => {});
          }
        }
        return;
      }

      const reply =
        typeof response === 'string'
          ? response
          : response?.reply ||
            t(
              'presentations.agent.updated',
              'Deck updated. Review the applied changes on the canvas.'
            );
      const agentMsg: AgentMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        text: reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);

      if (conversationId) {
        addMessage?.({ conversationId, role: 'ai', content: reply, messageType: 'text' }).catch(
          () => {}
        );
      }
    } catch {
      const agentMsg: AgentMessage = {
        id: `msg-${Date.now()}-agent-error`,
        role: 'agent',
        text: t(
          'presentations.agent.failed',
          'I could not apply that edit to the deck. Please try a different instruction.'
        ),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    }
  }, [input, onSendMessage, t, conversationId, addMessage]);

  const handleSuggestion = (key: string) => {
    const text = t(key, '');
    if (text) {
      setInput(text);
    }
  };

  const pushAgentMessage = useCallback(
    (text: string) => {
      const agentMsg: AgentMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);
      if (conversationId) {
        addMessage?.({
          conversationId,
          role: 'ai',
          content: text,
          messageType: 'text',
        }).catch(() => {});
      }
    },
    [conversationId, addMessage]
  );

  const handleAcceptProposal = useCallback(async () => {
    if (!pendingProposal || !deckId) return;
    setProposalBusy(true);
    setProposalError(null);
    try {
      const res = await fetch(
        `/api/presentations/decks/${encodeURIComponent(deckId)}/agent-edit/${encodeURIComponent(
          pendingProposal.operationId
        )}/accept`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }
      );
      if (!res.ok) {
        setProposalError(
          t(
            'presentations.agent.proposal.acceptFailed',
            'Could not accept the proposal. Please retry.'
          )
        );
        return;
      }
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: {
          deck?: unknown;
          operationId?: string;
          appliedActions?: string[];
          reply?: string;
          version?: number;
        };
      } | null;
      const data = json?.data;
      const applied =
        (data?.appliedActions && data.appliedActions.length > 0
          ? data.appliedActions
          : pendingProposal.appliedActions) || [];
      onProposalAccepted?.({
        operationId: pendingProposal.operationId,
        deck: data?.deck,
        version: data?.version,
      });
      pushAgentMessage(
        applied.length > 0
          ? `Applied: ${applied.join(', ')}`
          : data?.reply || t('presentations.agent.proposal.applied', 'Applied changes.')
      );
      setPendingProposal(null);
    } catch {
      setProposalError(
        t(
          'presentations.agent.proposal.acceptFailed',
          'Could not accept the proposal. Please retry.'
        )
      );
    } finally {
      setProposalBusy(false);
    }
  }, [pendingProposal, deckId, onProposalAccepted, pushAgentMessage, t]);

  const handleRejectProposal = useCallback(async () => {
    if (!pendingProposal || !deckId) return;
    setProposalBusy(true);
    setProposalError(null);
    try {
      const res = await fetch(
        `/api/presentations/decks/${encodeURIComponent(deckId)}/agent-edit/${encodeURIComponent(
          pendingProposal.operationId
        )}/reject`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }
      );
      if (!res.ok) {
        setProposalError(
          t(
            'presentations.agent.proposal.rejectFailed',
            'Could not reject the proposal. Please retry.'
          )
        );
        return;
      }
      onProposalRejected?.({ operationId: pendingProposal.operationId });
      pushAgentMessage(t('presentations.agent.proposal.rejected', 'Proposal rejected.'));
      setPendingProposal(null);
    } catch {
      setProposalError(
        t(
          'presentations.agent.proposal.rejectFailed',
          'Could not reject the proposal. Please retry.'
        )
      );
    } finally {
      setProposalBusy(false);
    }
  }, [pendingProposal, deckId, onProposalRejected, pushAgentMessage, t]);

  return (
    <div className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-navy-800">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-primary-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-white">
            {t('presentations.agent.title', 'AI Agent')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTION_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleSuggestion(key)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
              >
                <Sparkles size={10} />
                {t(key, '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending Proposal */}
      {pendingProposal && deckId && (
        <div className="mx-3 mb-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5">
          <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200/70 dark:border-amber-500/20">
            <div className="flex items-center gap-2">
              <FileDiff size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('presentations.agent.proposal.title', 'Proposed Edit')}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
              {t('presentations.agent.proposal.awaiting', 'Awaiting your approval')}
            </span>
          </div>
          <div className="px-3 py-2 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            {pendingProposal.plan?.scope && (
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-200">Scope:</span>{' '}
                {pendingProposal.plan.scope}
              </div>
            )}
            {Array.isArray(pendingProposal.plan?.mutationKinds) &&
              pendingProposal.plan!.mutationKinds!.length > 0 && (
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Mutation kinds:
                  </span>{' '}
                  {pendingProposal.plan!.mutationKinds!.join(', ')}
                </div>
              )}
            {Array.isArray(pendingProposal.plan?.targetSlides) &&
              pendingProposal.plan!.targetSlides!.length > 0 && (
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Target slides:
                  </span>{' '}
                  {pendingProposal.plan!.targetSlides!.map((s) => String(s)).join(', ')}
                </div>
              )}
            {pendingProposal.plan?.sectionHint && (
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Section hint:
                </span>{' '}
                {pendingProposal.plan.sectionHint}
              </div>
            )}
          </div>
          <div className="px-3 pb-2">
            {pendingProposal.diff?.editPlan !== undefined ? (
              <pre className="max-h-48 overflow-auto rounded-md bg-slate-900/90 dark:bg-navy-950 text-[10px] leading-snug text-slate-100 px-2 py-1.5 whitespace-pre-wrap break-words">
                {JSON.stringify(pendingProposal.diff.editPlan, null, 2).slice(0, 1000)}
              </pre>
            ) : pendingProposal.appliedActions && pendingProposal.appliedActions.length > 0 ? (
              <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                {pendingProposal.appliedActions.map((action, idx) => (
                  <li key={`${action}-${idx}`}>{action}</li>
                ))}
              </ul>
            ) : (
              <div className="text-[11px] italic text-slate-500 dark:text-slate-400">
                {t('presentations.agent.proposal.noDiff', 'No diff details available.')}
              </div>
            )}
          </div>
          {proposalError && (
            <div className="mx-3 mb-2 rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">
              {proposalError}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 pb-3">
            <button
              type="button"
              onClick={handleAcceptProposal}
              disabled={proposalBusy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check size={12} />
              {t('presentations.agent.proposal.accept', 'Accept')}
            </button>
            <button
              type="button"
              onClick={handleRejectProposal}
              disabled={proposalBusy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 border border-slate-200 dark:border-navy-700 disabled:opacity-50"
            >
              <XCircle size={12} />
              {t('presentations.agent.proposal.reject', 'Reject')}
            </button>
            {proposalBusy && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('presentations.agent.proposal.working', 'Working...')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-slate-100 dark:border-navy-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t(
              'presentations.agent.placeholder',
              'Ask me to edit, create, or style anything'
            )}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-700 dark:text-slate-300 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
