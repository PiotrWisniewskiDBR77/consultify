/**
 * AITopicsPanel — AI-suggested topics worth analyzing for the note.
 * Remove: dismiss topic and fetch replacement. Add: insert into note as AI callout.
 */
import type { Editor } from '@tiptap/react';
import { Loader2, MessageSquare, Pencil, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

interface AITopicsPanelProps {
  open: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle: string;
  noteTags: string[];
  contentText: string;
  editor: Editor | null;
}

export const AITopicsPanel: React.FC<AITopicsPanelProps> = ({
  open,
  onClose,
  noteId,
  noteTitle,
  noteTags,
  contentText,
  editor,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const { setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();

  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [replacingFor, setReplacingFor] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const fetchTopics = useCallback(
    async (excluded: string[] = []) => {
      setLoading(true);
      setError(null);
      try {
        const { topics: next } = await Api.suggestNotebookTopics(noteId, {
          excludedTopics: excluded,
          language: isPl ? 'pl' : 'en',
        });
        setTopics(next || []);
        trackFunnelEvent('notebook_ai_topics_fetched', { noteId, count: (next || []).length });
      } catch (err: any) {
        const msg = err?.message || t('myWorkNotebook.aiTopicsPanel.fetchFailed');
        setError(msg);
        setTopics([]);
        toast.error(msg);
      } finally {
        setLoading(false);
        setReplacingFor(null);
      }
    },
    [noteId, isPl, t]
  );

  useEffect(() => {
    if (open && noteId) {
      setDismissed(new Set());
      fetchTopics();
    }
  }, [open, noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemove = useCallback(
    async (topic: string) => {
      setDismissed((prev) => new Set(prev).add(topic));
      const remaining = topics.filter((tp) => tp !== topic);
      setTopics(remaining);
      setReplacingFor(topic);
      try {
        const excluded = [...remaining, topic, ...dismissed];
        const { topics: next } = await Api.suggestNotebookTopics(noteId, {
          excludedTopics: excluded,
          language: isPl ? 'pl' : 'en',
        });
        const newOne = (next || []).find((tp) => !excluded.includes(tp));
        if (newOne) setTopics((prev) => [...prev, newOne]);
      } catch {
        /* keep remaining list */
      } finally {
        setReplacingFor(null);
      }
    },
    [topics, dismissed, noteId, isPl]
  );

  const handleAdd = useCallback(
    (topic: string) => {
      if (!editor) return;
      const aiLabel = t('myWorkNotebook.aiTopicsPanel.aiSuggestionLabel');
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'callout',
          attrs: { variant: 'primary' },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `✨ ${aiLabel}: ${topic}` }],
            },
          ],
        })
        .run();
      setTopics((prev) => prev.filter((tp) => tp !== topic));
      trackFunnelEvent('notebook_ai_topic_added', { noteId });
      toast.success(t('myWorkNotebook.aiTopicsPanel.addedToNote'));
    },
    [editor, isPl, noteId, t]
  );

  const handleStartEdit = useCallback((topic: string) => {
    setEditingTopic(topic);
    setEditingValue(topic);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingTopic) return;
    const next = editingValue.trim();
    if (!next) {
      toast.error(t('myWorkNotebook.aiTopicsPanel.topicCannotBeEmpty'));
      return;
    }
    setTopics((prev) => prev.map((tp) => (tp === editingTopic ? next : tp)));
    setEditingTopic(null);
    setEditingValue('');
    trackFunnelEvent('notebook_ai_topic_edited', { noteId });
    toast.success(t('myWorkNotebook.aiTopicsPanel.saved'));
  }, [editingTopic, editingValue, isPl, noteId, t]);

  const handleCancelEdit = useCallback(() => {
    setEditingTopic(null);
    setEditingValue('');
  }, []);

  const handleSendToChat = useCallback(
    (topic: string) => {
      const tags = noteTags.filter(Boolean).slice(0, 12).join(', ');
      const excerpt = String(contentText || '')
        .trim()
        .slice(0, 700);
      const msg = [
        t('myWorkNotebook.aiTopicsPanel.chatWorkingOnNote', {
          title: noteTitle || t('myWorkNotebook.aiTopicsPanel.untitled'),
        }),
        tags ? t('myWorkNotebook.aiTopicsPanel.chatTags', { tags }) : null,
        t('myWorkNotebook.aiTopicsPanel.chatTopic', { topic }),
        t('myWorkNotebook.aiTopicsPanel.chatInstruction'),
        excerpt ? t('myWorkNotebook.aiTopicsPanel.chatContext', { excerpt }) : null,
      ]
        .filter(Boolean)
        .join('\n');

      setChatKickoffMessage(msg);
      if (isChatCollapsed) toggleChatCollapse();
      trackFunnelEvent('notebook_ai_topic_sent_to_chat', { noteId });
      toast.success(t('myWorkNotebook.aiTopicsPanel.addedToChat'));
    },
    [
      contentText,
      isChatCollapsed,
      isPl,
      noteId,
      noteTags,
      noteTitle,
      setChatKickoffMessage,
      toggleChatCollapse,
      t,
    ]
  );

  if (!open) return null;

  return (
    <div className="w-72 shrink-0 rounded-2xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden bg-c-surface flex flex-col">
      <div className="flex items-center justify-between px-3 py-3 border-b border-c-border-subtle">
        <div className="flex items-center gap-2 text-sm font-semibold text-c-text-secondary">
          <Sparkles size={16} />
          <span>{t('myWorkNotebook.aiTopicsPanel.topicsToAnalyze')}</span>
        </div>
        <div className="flex items-center gap-1">
          {(topics.length === 0 || error) && (
            <button
              onClick={() => fetchTopics()}
              disabled={loading}
              className="p-1.5 rounded-lg text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
              title={t('myWorkNotebook.aiTopicsPanel.generateSuggestions')}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-c-text-muted hover:bg-c-surface-raised"
            aria-label={t('myWorkNotebook.aiTopicsPanel.close')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-c-border-subtle bg-c-surface-raised">
        <p className="text-[11px] text-c-text-secondary leading-relaxed">
          {t('myWorkNotebook.aiTopicsPanel.intro')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading && topics.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Loader2 size={20} className="animate-spin text-c-text-muted" />
            <span className="text-xs text-c-text-muted">
              {t('myWorkNotebook.aiTopicsPanel.analyzing')}
            </span>
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center px-3">
            <Sparkles size={24} className="text-c-text-secondary" />
            <span className="text-xs text-c-text-muted">
              {error
                ? t('myWorkNotebook.aiTopicsPanel.fetchFailedHint')
                : t('myWorkNotebook.aiTopicsPanel.noSuggestions')}
            </span>
            <button
              onClick={() => fetchTopics()}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-c-surface-raised hover:bg-c-surface-raised text-c-text-secondary text-xs font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t('myWorkNotebook.aiTopicsPanel.generate')}
            </button>
          </div>
        ) : (
          topics.map((topic) => (
            <div
              key={topic}
              className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                {editingTopic === topic ? (
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text text-sm p-2 outline-none focus:ring-2 focus:ring-[var(--c-focus)] focus:border-[var(--c-focus-solid)] resize-none"
                      placeholder={t('myWorkNotebook.aiTopicsPanel.editTopicPlaceholder')}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex items-center justify-center gap-1 rounded-lg bg-c-surface-raised hover:bg-c-border-subtle text-c-text-secondary px-2.5 py-1 text-[11px] font-medium transition-colors"
                      >
                        {t('myWorkNotebook.aiTopicsPanel.save')}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center justify-center gap-1 rounded-lg bg-c-surface-raised text-c-text-secondary px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-c-border-subtle"
                      >
                        {t('myWorkNotebook.aiTopicsPanel.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-c-text flex-1 min-w-0">{topic}</p>
                )}

                <RowActionsMenu
                  iconVariant="horizontal"
                  // #40 — pure-wiring bridge onto the sectional kebab contract. Disabled
                  // items are filtered out here (not passed through to sections) to keep
                  // the legacy flat-menu semantics exactly — zero visible menu change.
                  sections={[
                    {
                      id: 'legacy',
                      actions: [
                        {
                          id: 'add',
                          label: t('myWorkNotebook.aiTopicsPanel.addToNote'),
                          icon: Plus,
                          onClick: () => handleAdd(topic),
                          variant: 'primary' as const,
                          disabled: !editor || editingTopic === topic,
                        },
                        {
                          id: 'chat',
                          label: t('myWorkNotebook.aiTopicsPanel.sendToChat'),
                          icon: MessageSquare,
                          onClick: () => handleSendToChat(topic),
                          disabled: editingTopic === topic,
                        },
                        {
                          id: 'edit',
                          label: t('myWorkNotebook.aiTopicsPanel.edit'),
                          icon: Pencil,
                          onClick: () => handleStartEdit(topic),
                          disabled: editingTopic !== null,
                        },
                        {
                          id: 'remove',
                          label: t('myWorkNotebook.aiTopicsPanel.delete'),
                          icon: Trash2,
                          onClick: () => handleRemove(topic),
                          variant: 'danger' as const,
                          disabled: replacingFor === topic || editingTopic === topic,
                          divider: true,
                        },
                      ].filter((a) => !a.disabled),
                    },
                  ]}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-c-border-subtle">
        <div className="text-[10px] text-c-text-muted space-y-1">
          <p>{t('myWorkNotebook.aiTopicsPanel.footerGoal')}</p>
          <p>{t('myWorkNotebook.aiTopicsPanel.footerTip')}</p>
        </div>
      </div>
    </div>
  );
};
