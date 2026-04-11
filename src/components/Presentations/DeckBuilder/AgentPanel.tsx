import { MessageSquare, Send, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConversationStore } from '@/store/useConversationStore';

interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

interface AgentPanelProps {
  onClose: () => void;
  sourceNames?: string[];
  onSendMessage?: (message: string) => Promise<{ reply?: string } | string | void>;
  conversationId?: string | null;
}

const SUGGESTION_KEYS = [
  'presentations.agent.suggestions.addSummary',
  'presentations.agent.suggestions.makeConcise',
  'presentations.agent.suggestions.addNotes',
  'presentations.agent.suggestions.updateData',
  'presentations.agent.suggestions.improveVisuals',
];

export const AgentPanel: React.FC<AgentPanelProps> = ({ onClose, sourceNames, onSendMessage, conversationId }) => {
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

  useEffect(() => {
    if (!conversationId || !activeMessages?.length) return;
    const kimiMessages: AgentMessage[] = activeMessages
      .filter((m) => m.role === 'user' || m.role === 'ai')
      .map((m) => ({
        id: m.id || `kimi-${Date.now()}-${Math.random()}`,
        role: m.role === 'user' ? 'user' as const : 'agent' as const,
        text: typeof m.content === 'string' ? m.content : '',
        timestamp: m.timestamp || new Date().toISOString(),
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
      addMessage?.({ conversationId, role: 'user', content: message, messageType: 'text' }).catch(() => {});
    }

    try {
      const response = await onSendMessage?.(message);
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
        addMessage?.({ conversationId, role: 'ai', content: reply, messageType: 'text' }).catch(() => {});
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

  return (
    <div className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-navy-800">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-purple-500" />
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
                  ? 'bg-purple-500 text-white'
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
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
              >
                <Sparkles size={10} />
                {t(key, '')}
              </button>
            ))}
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
            className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
