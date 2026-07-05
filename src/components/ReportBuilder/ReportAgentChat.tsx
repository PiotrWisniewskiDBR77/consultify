/**
 * ReportAgentChat — T060
 *
 * Gamma-style sidebar chat for the report builder.
 * The agent can modify report structure, add/remove sections,
 * suggest best practices, and run quality checks.
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import TeresaMark from '../shared/TeresaMark';

// ── Types ──────────────────────────────────────────────────────

interface DiffChange {
  type: 'add' | 'remove' | 'move' | 'modify';
  sectionKey: string;
  field?: string;
  before?: string;
  after?: string;
}

interface DiffPreview {
  changes: DiffChange[];
  summary: string;
}

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structuredAction?: { type: string } | null;
  diffPreview?: DiffPreview | null;
  applied: boolean;
  createdAt: string;
}

interface ReportAgentChatProps {
  reportId: string;
  isOpen: boolean;
  onClose: () => void;
  onStructureChanged?: () => void;
}

// ── Quick Actions ──────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: 'Suggest structure',
    message: 'Suggest a best practice structure for this report',
    icon: <Sparkles size={13} />,
  },
  {
    label: 'Quality check',
    message: "Check what's missing in this report",
    icon: <CheckCircle2 size={13} />,
  },
  { label: 'Add KPI section', message: 'Add a KPI Dashboard section', icon: <Zap size={13} /> },
  {
    label: 'Add Next Steps',
    message: 'Add a Next Steps & Actions section',
    icon: <ArrowRight size={13} />,
  },
];

// ── Component ──────────────────────────────────────────────────

export const ReportAgentChat: React.FC<ReportAgentChatProps> = ({
  reportId,
  isOpen,
  onClose,
  onStructureChanged,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load messages
  useEffect(() => {
    if (!isOpen || !reportId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/report-builder/${reportId}/agent/messages`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {
        /* */
      }
    })();
  }, [isOpen, reportId]);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  // Send message
  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;

    setInput('');
    setSending(true);

    const tempUserMsg: AgentMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: msg,
      applied: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`${API_URL}/report-builder/${reportId}/agent/message`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, data]);
        trackFunnelEvent('report_agent_message_sent', {
          reportId,
          actionType: data.structuredAction?.type,
        });
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Apply action
  const handleApply = async (messageId: string) => {
    setApplying(messageId);
    try {
      const res = await fetch(`${API_URL}/report-builder/${reportId}/agent/apply/${messageId}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, applied: true } : m)));
        toast.success(t('reports.agent.changesApplied', 'Changes applied'));
        onStructureChanged?.();
      }
    } catch {
      toast.error('Failed to apply changes');
    } finally {
      setApplying(null);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  // ── Render ─────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="fixed right-0 top-0 bottom-0 w-96 bg-c-surface border-l border-c-border z-40 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-c-border">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-c-accent-soft0 rounded-lg">
            <TeresaMark size={18} className="text-c-accent" />
          </div>
          <div>
            <div className="text-sm font-medium text-c-text">
              {t('reports.agent.title', 'Report Agent')}
            </div>
            <div className="text-xs text-c-text-secondary">
              {t('reports.agent.subtitle', 'Edit structure via chat')}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-c-text-secondary hover:text-c-text hover:opacity-90 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <TeresaMark className="mx-auto text-c-text-secondary mb-3" size={32} />
            <p className="text-sm text-c-text-secondary mb-1">
              {t('reports.agent.welcome', "I'm your report assistant")}
            </p>
            <p className="text-xs text-c-text-secondary">
              {t(
                'reports.agent.welcomeDesc',
                'Ask me to modify your report structure, add sections, or check quality.'
              )}
            </p>

            <div className="mt-4 space-y-1.5">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => handleSend(qa.message)}
                  disabled={sending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-c-text-secondary hover:text-c-accent hover:bg-c-accent-soft0 rounded-lg border border-c-border hover:border-c-accent transition-colors text-left"
                >
                  {qa.icon}
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-c-accent-soft0 flex items-center justify-center shrink-0 mt-1">
                <TeresaMark size={12} className="text-c-accent" />
              </div>
            )}
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div
                className={`px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-c-text text-c-bg rounded-br-sm'
                    : 'bg-c-surface-raised text-c-text-secondary rounded-bl-sm border border-c-border'
                }`}
              >
                <div className="whitespace-pre-wrap text-xs leading-relaxed">{msg.content}</div>
              </div>

              {/* Diff preview + Apply button */}
              {msg.role === 'assistant' &&
                msg.diffPreview &&
                msg.diffPreview.changes.length > 0 && (
                  <div className="mt-2 rounded-lg bg-c-surface-raised border border-c-border p-2.5">
                    <div className="text-xs text-c-text-secondary mb-1.5 font-medium">
                      {t('reports.agent.proposedChanges', 'Proposed changes:')}
                    </div>
                    <div className="space-y-1">
                      {msg.diffPreview.changes.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span
                            className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                              c.type === 'add'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : c.type === 'remove'
                                  ? 'bg-danger-500/10 text-danger-400'
                                  : c.type === 'modify'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {c.type}
                          </span>
                          <span className="text-c-text-secondary truncate">
                            {c.after || c.before || c.sectionKey}
                          </span>
                        </div>
                      ))}
                    </div>
                    {!msg.applied ? (
                      <button
                        onClick={() => handleApply(msg.id)}
                        disabled={applying === msg.id}
                        className="mt-2 w-full px-3 py-1.5 text-xs bg-c-text text-c-bg hover:opacity-90 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {applying === msg.id ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />{' '}
                            {t('reports.agent.applying', 'Applying…')}
                          </>
                        ) : (
                          <>
                            <Check size={12} /> {t('reports.agent.applyChanges', 'Apply Changes')}
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 size={12} />
                        {t('reports.agent.applied', 'Applied')}
                      </div>
                    )}
                  </div>
                )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-c-surface-raised flex items-center justify-center shrink-0 mt-1">
                <User size={12} className="text-c-text-secondary" />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-c-accent-soft0 flex items-center justify-center shrink-0">
              <TeresaMark size={12} className="text-c-accent" />
            </div>
            <div className="px-3 py-2 rounded-xl bg-c-surface-raised border border-c-border">
              <Loader2 size={14} className="animate-spin text-c-accent" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-c-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('reports.agent.placeholder', 'Ask me to modify the report…')}
            rows={1}
            className="flex-1 px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text placeholder:text-c-text-muted resize-none focus:outline-none focus:border-c-accent"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="p-2 bg-c-text text-c-bg hover:opacity-90 rounded-lg transition-colors disabled:opacity-30 shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ReportAgentChat;
