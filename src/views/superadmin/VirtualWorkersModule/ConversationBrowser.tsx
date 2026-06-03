import {
  ArrowLeft,
  Clock,
  EyeOff,
  MessageSquare,
  Mic,
  RefreshCw,
  Tag,
  Trash2,
  Type,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../../services/api';

interface Conversation {
  id: string;
  session_id: string | null;
  channel: string;
  locale: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  duration_seconds: number | null;
  outcome: string;
  primary_topic: string | null;
  intent: string | null;
  products_discussed: string[];
  summary: string | null;
  fallback_reason: string | null;
  quality_flags: string[];
}

interface Message {
  id: string;
  role: string;
  content: string;
  knowledge_sources_used: string[] | null;
  matched_products: string[] | null;
  token_count: number | null;
  latency_ms: number | null;
  retrieval_query: string | null;
  used_pill_ids: string[];
  used_pill_sections: string[];
  response_mode: string | null;
  message_topic: string | null;
  message_intent: string | null;
  created_at: string;
}

interface ConversationBrowserProps {
  workerId: string;
}

const OUTCOME_COLORS: Record<string, string> = {
  demo_requested: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  trial_started: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  question_answered: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  escalated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  abandoned: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  unknown: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export const ConversationBrowser: React.FC<ConversationBrowserProps> = ({ workerId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [privacyActionLoading, setPrivacyActionLoading] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');
  const [topicFilter, setTopicFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (channelFilter) params.set('channel', channelFilter);
      if (outcomeFilter) params.set('outcome', outcomeFilter);
      if (topicFilter.trim()) params.set('topic', topicFilter.trim());
      if (intentFilter.trim()) params.set('intent', intentFilter.trim());

      const response = await Api.get(
        `/api/virtual-workers/${workerId}/conversations?${params.toString()}`
      );
      if (response?.data) {
        const payload = response.data;
        setConversations(Array.isArray(payload.data) ? payload.data : []);
        setTotal(payload.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const response = await Api.get(`/api/virtual-workers/${workerId}/conversations/${convId}`);
      if (response?.data) {
        const list = response.data.data ?? response.data;
        setMessages(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [workerId, channelFilter, outcomeFilter, topicFilter, intentFilter]);

  const handleSelectConv = (convId: string) => {
    setSelectedConv(convId);
    fetchMessages(convId);
  };

  const handleRedactConversation = async () => {
    if (!selectedConv) return;
    setPrivacyActionLoading(true);
    setError(null);
    try {
      await Api.post(`/api/virtual-workers/${workerId}/conversations/${selectedConv}/redact`, {});
      await fetchMessages(selectedConv);
      await fetchConversations();
    } catch (err: any) {
      console.error('Failed to redact conversation:', err);
      setError(err?.response?.data?.error || 'Failed to redact conversation.');
    } finally {
      setPrivacyActionLoading(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConv) return;
    setPrivacyActionLoading(true);
    setError(null);
    try {
      await Api.delete(`/api/virtual-workers/${workerId}/conversations/${selectedConv}`);
      setSelectedConv(null);
      setMessages([]);
      await fetchConversations();
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
      setError(err?.response?.data?.error || 'Failed to delete conversation.');
    } finally {
      setPrivacyActionLoading(false);
    }
  };

  if (selectedConv) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setSelectedConv(null);
              setMessages([]);
              setError(null);
            }}
            className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <ArrowLeft size={16} />
            Back to conversations
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRedactConversation}
              disabled={privacyActionLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-navy-600 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50"
            >
              {privacyActionLoading ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <EyeOff size={13} />
              )}
              Redact transcript
            </button>
            <button
              onClick={handleDeleteConversation}
              disabled={privacyActionLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-50"
            >
              <Trash2 size={13} />
              Delete conversation
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </div>
        )}

        {loadingMessages ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
            No messages in this conversation.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-4 ${
                  msg.role === 'user'
                    ? 'bg-slate-100 dark:bg-navy-700 ml-8'
                    : 'bg-indigo-50 dark:bg-indigo-900/20 mr-8'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    {msg.role}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-500">
                    {formatDate(msg.created_at)}
                    {msg.latency_ms ? ` · ${msg.latency_ms}ms` : ''}
                  </span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {msg.content}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {msg.message_topic && (
                    <span className="inline-block px-2 py-0.5 bg-white/60 dark:bg-navy-800/60 rounded text-xs text-slate-500 dark:text-slate-400">
                      topic: {msg.message_topic}
                    </span>
                  )}
                  {msg.message_intent && (
                    <span className="inline-block px-2 py-0.5 bg-white/60 dark:bg-navy-800/60 rounded text-xs text-slate-500 dark:text-slate-400">
                      intent: {msg.message_intent}
                    </span>
                  )}
                  {msg.response_mode && (
                    <span className="inline-block px-2 py-0.5 bg-white/60 dark:bg-navy-800/60 rounded text-xs text-slate-500 dark:text-slate-400">
                      mode: {msg.response_mode}
                    </span>
                  )}
                </div>
                {msg.knowledge_sources_used && msg.knowledge_sources_used.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.knowledge_sources_used.map((src, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-0.5 bg-white/60 dark:bg-navy-800/60 rounded text-xs text-slate-500 dark:text-slate-400"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
                {msg.used_pill_sections?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.used_pill_sections.map((src, i) => (
                      <span
                        key={`${src}-${i}`}
                        className="inline-block px-2 py-0.5 bg-indigo-100/70 dark:bg-indigo-900/20 rounded text-xs text-indigo-700 dark:text-indigo-300"
                      >
                        section: {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {total} conversation{total !== 1 ? 's' : ''} total
        </p>
        <div className="flex items-center gap-2">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-2 py-1 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="">All channels</option>
            <option value="text_chat">Text</option>
            <option value="voice">Voice</option>
          </select>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="px-2 py-1 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="">All outcomes</option>
            <option value="demo_requested">Demo Requested</option>
            <option value="trial_started">Trial Started</option>
            <option value="question_answered">Question Answered</option>
            <option value="escalated">Escalated</option>
            <option value="abandoned">Abandoned</option>
            <option value="unknown">Unknown</option>
          </select>
          <input
            type="text"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            placeholder="Filter topic"
            className="px-2 py-1 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 text-xs"
          />
          <input
            type="text"
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            placeholder="Intent"
            className="px-2 py-1 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 text-xs"
          />
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        Privacy controls are available inside a conversation: redact transcript content or delete
        the conversation entirely.
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-10 h-10 mx-auto text-slate-600 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No conversations recorded yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelectConv(conv.id)}
              className="w-full text-left bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl px-5 py-3 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {conv.channel === 'voice' ? (
                    <Mic size={16} className="text-blue-500" />
                  ) : (
                    <Type size={16} className="text-slate-600" />
                  )}
                  <div>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {formatDate(conv.started_at)}
                    </span>
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                      {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
                    </span>
                    {conv.primary_topic && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Tag size={12} />
                        {conv.primary_topic}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {conv.duration_seconds && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Clock size={12} />
                      {formatDuration(conv.duration_seconds)}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${OUTCOME_COLORS[conv.outcome] || OUTCOME_COLORS.unknown}`}
                  >
                    {conv.outcome.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {conv.intent && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    intent: {conv.intent}
                  </span>
                )}
                {conv.products_discussed?.length > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    products: {conv.products_discussed.join(', ')}
                  </span>
                )}
                {conv.fallback_reason && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    fallback: {conv.fallback_reason}
                  </span>
                )}
              </div>
              {conv.summary && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {conv.summary}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
