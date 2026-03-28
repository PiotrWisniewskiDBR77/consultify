import { ArrowLeft, Clock, MessageSquare, Mic, RefreshCw, Type } from 'lucide-react';
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
}

interface Message {
  id: string;
  role: string;
  content: string;
  knowledge_sources_used: string[] | null;
  matched_products: string[] | null;
  token_count: number | null;
  latency_ms: number | null;
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
  abandoned: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
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
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (channelFilter) params.set('channel', channelFilter);
      if (outcomeFilter) params.set('outcome', outcomeFilter);

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
  }, [workerId, channelFilter, outcomeFilter]);

  const handleSelectConv = (convId: string) => {
    setSelectedConv(convId);
    fetchMessages(convId);
  };

  if (selectedConv) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setSelectedConv(null);
            setMessages([]);
          }}
          className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <ArrowLeft size={16} />
          Back to conversations
        </button>

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
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {formatDate(msg.created_at)}
                    {msg.latency_ms ? ` · ${msg.latency_ms}ms` : ''}
                  </span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {msg.content}
                </p>
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
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
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
                    <Type size={16} className="text-slate-400" />
                  )}
                  <div>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {formatDate(conv.started_at)}
                    </span>
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                      {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
                    </span>
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
