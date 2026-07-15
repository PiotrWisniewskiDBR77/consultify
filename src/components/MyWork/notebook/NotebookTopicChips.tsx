/**
 * NotebookTopicChips — topic chips shown on a note (rail/editor header).
 *
 * Lists topics pinned to a page; click a chip to open the topic aggregate
 * (via onOpenTopic, which the host wires to NotebookTopicView). Owner can pin a
 * new topic inline.
 *
 * Data: GET/POST/DELETE /api/v8/notebook/(topics | pages/:id/topics).
 * Owned by AGENT 1. Host integration: see report (rail slot).
 */
import { Hash, Loader2, Plus, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { v8Delete, v8Get, v8Post } from '@/services/api/v8/client';

export interface NotebookTopicChip {
  id: string;
  name: string;
  slug: string;
  score?: number;
  source?: 'ai' | 'manual';
}

interface NotebookTopicChipsProps {
  noteId: string;
  /** Owner-only actions (pin/unpin). Read-only when false. */
  canEdit?: boolean;
  /** Open the topic aggregate view (host wires this to NotebookTopicView). */
  onOpenTopic?: (topicId: string) => void;
  className?: string;
}

export const NotebookTopicChips: React.FC<NotebookTopicChipsProps> = ({
  noteId,
  canEdit = false,
  onOpenTopic,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const [topics, setTopics] = useState<NotebookTopicChip[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!noteId) return;
    setLoading(true);
    try {
      // The aggregate of a page's topics is exposed via the page-topics list.
      const data = await v8Get<NotebookTopicChip[]>(`/notebook/pages/${noteId}/topics`);
      setTopics(Array.isArray(data) ? data : []);
    } catch {
      // Degraded: chips simply don't render; never block the editor.
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await v8Post<{ topic: NotebookTopicChip }>(`/notebook/pages/${noteId}/topics`, {
        topicName: name,
        source: 'manual',
      });
      const topic = res?.topic;
      if (topic) {
        setTopics((prev) =>
          prev.some((tp) => tp.id === topic.id) ? prev : [...prev, { ...topic, source: 'manual' }]
        );
      }
      setNewName('');
      setAdding(false);
      toast.success(t('myWorkNotebook.topicChips.topicPinned'));
    } catch (err: any) {
      toast.error(err?.message || t('myWorkNotebook.topicChips.pinFailed'));
    } finally {
      setBusy(false);
    }
  }, [newName, noteId, isPl, t]);

  const handleRemove = useCallback(
    async (topicId: string) => {
      const prev = topics;
      setTopics((cur) => cur.filter((tp) => tp.id !== topicId));
      try {
        await v8Delete(`/notebook/pages/${noteId}/topics/${topicId}`);
      } catch (err: any) {
        setTopics(prev); // rollback
        toast.error(err?.message || t('myWorkNotebook.topicChips.unpinFailed'));
      }
    },
    [topics, noteId, isPl, t]
  );

  if (loading && topics.length === 0) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-c-text-muted ${className}`}>
        <Loader2 size={12} className="animate-spin" />
        <span>{t('myWorkNotebook.topicChips.topicsLoading')}</span>
      </div>
    );
  }

  if (!canEdit && topics.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {topics.map((tp) => (
        <span
          key={tp.id}
          className="group inline-flex items-center gap-1 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised pl-2 pr-1.5 py-0.5 text-[11px] font-medium text-c-text-secondary"
        >
          <button
            type="button"
            onClick={() => onOpenTopic?.(tp.id)}
            className="inline-flex items-center gap-1 hover:text-c-text"
            title={t('myWorkNotebook.topicChips.openTopic')}
          >
            {tp.source === 'ai' ? (
              <Sparkles size={11} className="text-c-text-muted" />
            ) : (
              <Hash size={11} className="text-c-text-muted" />
            )}
            {tp.name}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => handleRemove(tp.id)}
              className="rounded-full p-0.5 text-c-text-muted opacity-0 group-hover:opacity-100 hover:bg-c-surface-raised hover:text-c-text transition-opacity"
              aria-label={t('myWorkNotebook.topicChips.unpin')}
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}

      {canEdit &&
        (adding ? (
          <span className="inline-flex items-center gap-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') {
                  setAdding(false);
                  setNewName('');
                }
              }}
              disabled={busy}
              placeholder={t('myWorkNotebook.topicChips.newTopicPlaceholder')}
              className="w-32 rounded-full border border-c-border-subtle bg-c-surface px-2 py-0.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-[var(--c-focus)] focus:border-[var(--c-focus-solid)]"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || !newName.trim()}
              className="rounded-full p-1 text-c-text-secondary hover:bg-c-surface-raised0/10 disabled:opacity-40"
              aria-label={t('myWorkNotebook.topicChips.add')}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-c-border-subtle px-2 py-0.5 text-[11px] text-c-text-muted hover:text-c-text hover:border-c-border-strong transition-colors"
          >
            <Plus size={11} />
            {t('myWorkNotebook.topicChips.topic')}
          </button>
        ))}
    </div>
  );
};

export default NotebookTopicChips;
