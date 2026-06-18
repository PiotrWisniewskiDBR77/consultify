/**
 * ConversationalPanel (T013)
 *
 * Chat-like transcript panel for conversational interview mode.
 * Displays transcript messages, provides input for user responses,
 * and supports AI-assisted parse-to-answers flow with draft review.
 */

import {
  ArrowRight,
  Check,
  CheckCircle,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { TeresaMark } from '@/components/shared/TeresaMark';

import { getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

const API_BASE = '/api/interview';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface AnswerMapping {
  questionId: string;
  answerText: string;
  questionText?: string;
  accepted?: boolean;
}

interface Question {
  id: string;
  questionText: string;
  category: string;
  status: string;
}

interface ConversationalPanelProps {
  sessionId: string;
  questions: Question[];
  onQuestionAnswered?: (questionId: string, answerText: string) => void;
  locked?: boolean;
}

export const ConversationalPanel: React.FC<ConversationalPanelProps> = ({
  sessionId,
  questions,
  onQuestionAnswered,
  locked = false,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [draftMappings, setDraftMappings] = useState<AnswerMapping[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const answeredCount = questions.filter((q) => q.status === 'answered').length;
  const totalCount = questions.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const acceptedDraftCount = draftMappings?.filter((m) => m.accepted).length ?? 0;

  const fetchMessages = useCallback(async () => {
    try {
      // I3 — include auth + org headers. The legacy interview router requires
      // verifyToken + requireOrgAccess; a bare fetch only succeeded when an
      // access_token cookie happened to be set, and never sent the org header.
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/transcript`, {
        headers: getHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || locked) return;

    setInputValue('');
    const optimistic: TranscriptMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/transcript`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ role: 'user', content: text }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      const msg = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? msg : m)));
      trackFunnelEvent('interview_transcript_message_added', { sessionId });
    } catch {
      toast.error('Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setLoading(false);
    }
  }, [inputValue, sessionId, locked]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const parseToAnswers = useCallback(async () => {
    if (messages.length === 0) return;

    setParsing(true);
    trackFunnelEvent('interview_ai_parse_requested', { sessionId });

    try {
      const transcript = messages
        .filter((m) => m.role !== 'system')
        .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join('\n');

      const res = await fetch(`${API_BASE}/sessions/${sessionId}/ai-parse`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text: transcript }),
      });

      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();
      const answers: AnswerMapping[] = (data.answers || []).map((a: any) => {
        const q = questions.find((q) => q.id === a.questionId);
        return {
          ...a,
          questionText: q?.questionText || a.questionId,
          accepted: true,
        };
      });

      if (answers.length === 0) {
        toast(t('interview.conversational.noMappings'));
      } else {
        setDraftMappings(answers);
      }
    } catch {
      toast.error('Failed to parse answers');
    } finally {
      setParsing(false);
    }
  }, [messages, sessionId, questions, t]);

  const applyDraftMappings = useCallback(() => {
    if (!draftMappings) return;

    const accepted = draftMappings.filter((m) => m.accepted);
    for (const mapping of accepted) {
      onQuestionAnswered?.(mapping.questionId, mapping.answerText);
    }
    trackFunnelEvent('interview_ai_parse_applied', {
      sessionId,
      totalMappings: draftMappings.length,
      accepted: accepted.length,
    });
    setDraftMappings(null);
    toast.success(`Applied ${accepted.length} answers`);
  }, [draftMappings, sessionId, onQuestionAnswered]);

  const toggleMapping = (index: number) => {
    setDraftMappings((prev) =>
      prev ? prev.map((m, i) => (i === index ? { ...m, accepted: !m.accepted } : m)) : null
    );
  };

  const acceptAll = () => {
    setDraftMappings((prev) => prev?.map((m) => ({ ...m, accepted: true })) || null);
  };

  const roleColors: Record<string, string> = {
    user: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
    ai: 'bg-primary-50 border-primary-200 dark:bg-primary-950/30 dark:border-primary-800',
    system: 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('interview.conversational.progress')}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {answeredCount}/{totalCount} ({progressPct}%)
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 dark:text-gray-500">
            <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">{t('interview.conversational.startConversation')}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl border p-3 ${roleColors[msg.role] || roleColors.system}`}
          >
            <div className="flex items-center gap-2 mb-1">
              {msg.role === 'ai' ? (
                <span className="inline-flex items-center gap-1 text-crimson-700 dark:text-crimson-300">
                  <TeresaMark size={13} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Teresa</span>
                </span>
              ) : (
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {msg.role}
                </span>
              )}
              <span className="text-xs text-gray-600 dark:text-gray-500">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Draft review UI */}
      {draftMappings && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-950/20 p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('interview.conversational.reviewing')}
            </h4>
            <div className="flex gap-2">
              <button
                onClick={acceptAll}
                className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
              >
                {t('interview.conversational.acceptAll')}
              </button>
              <button
                onClick={() => setDraftMappings(null)}
                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {draftMappings.map((mapping, idx) => (
              <div
                key={mapping.questionId}
                className={`flex items-start gap-3 p-2 rounded-lg border ${
                  mapping.accepted
                    ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                    : 'border-rose-200 bg-rose-50/30 dark:border-rose-800 dark:bg-rose-950/20 opacity-60'
                }`}
              >
                <button onClick={() => toggleMapping(idx)} className="mt-0.5 flex-shrink-0">
                  {mapping.accepted ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <X className="w-4 h-4 text-rose-400" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                    {mapping.questionText}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                    {mapping.answerText}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={applyDraftMappings}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium hover:bg-navy-800 transition-colors"
          >
            <Check className="w-4 h-4" />
            {t('interview.conversational.acceptAnswer')} ({acceptedDraftCount})
          </button>
        </div>
      )}

      {/* Input area */}
      {!locked && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('interview.conversational.inputPlaceholder')}
                className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || loading}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Send"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={parseToAnswers}
                disabled={parsing || messages.length === 0}
                className="flex items-center justify-center w-10 h-10 rounded-xl border border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title={t('interview.conversational.parseToAnswers')}
              >
                {parsing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationalPanel;
