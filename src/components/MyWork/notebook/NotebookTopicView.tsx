/**
 * NotebookTopicView — the living aggregate of a topic.
 *
 * Shows: notes pinned to the topic, linked outputs, linked initiatives, and the
 * "last active" timestamp — the "this topic has 7 notes, 2 reports, 1 initiative"
 * surface from the Living Notebook vision.
 *
 * Data: GET /api/v8/notebook/topics/:id (returns the TopicAggregate envelope).
 * Owned by AGENT 1. Host opens this from NotebookTopicChips.onOpenTopic.
 */
import { FileText, Hash, Loader2, Rocket, StickyNote, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { v8Get } from '@/services/api/v8/client';

interface AggregatedNote {
  id: string;
  title: string;
  updatedAt: string | null;
  score: number;
  source: 'ai' | 'manual';
}
interface AggregatedArtifact {
  type: string;
  id: string;
  bucket: 'output' | 'initiative' | 'other';
}
interface TopicAggregate {
  topic: { id: string; name: string; slug: string };
  notes: AggregatedNote[];
  outputs: AggregatedArtifact[];
  initiatives: AggregatedArtifact[];
  counts: { notes: number; outputs: number; initiatives: number };
  lastActiveAt: string | null;
}

interface NotebookTopicViewProps {
  topicId: string;
  onClose?: () => void;
  /** Open a note by id (host wires to notebook navigation). */
  onOpenNote?: (noteId: string) => void;
  className?: string;
}

const formatDate = (iso: string | null, isPl: boolean): string => {
  if (!iso) return isPl ? '—' : '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const NotebookTopicView: React.FC<NotebookTopicViewProps> = ({
  topicId,
  onClose,
  onOpenNote,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const [agg, setAgg] = useState<TopicAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!topicId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await v8Get<TopicAggregate>(`/notebook/topics/${topicId}`);
      setAgg(data);
    } catch (err: any) {
      setError(err?.message || (isPl ? 'Nie udało się wczytać tematu' : 'Failed to load topic'));
      setAgg(null);
    } finally {
      setLoading(false);
    }
  }, [topicId, isPl]);

  useEffect(() => {
    load();
  }, [load]);

  const Stat: React.FC<{ icon: React.ReactNode; n: number; label: string }> = ({
    icon,
    n,
    label,
  }) => (
    <div className="flex items-center gap-1.5 rounded-lg bg-c-surface-raised px-2.5 py-1.5">
      <span className="text-c-text-muted">{icon}</span>
      <span className="text-sm font-semibold text-c-text">{n}</span>
      <span className="text-[11px] text-c-text-muted">{label}</span>
    </div>
  );

  return (
    <div
      className={`w-80 shrink-0 rounded-2xl border border-c-border-subtle overflow-hidden bg-c-bg flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-c-border-subtle">
        <div className="flex items-center gap-2 min-w-0 text-sm font-semibold text-c-text">
          <Hash size={16} className="text-c-text-muted shrink-0" />
          <span className="truncate">{agg?.topic?.name || (isPl ? 'Temat' : 'Topic')}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-c-text-muted hover:bg-c-surface-raised"
            aria-label={isPl ? 'Zamknij' : 'Close'}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading && !agg ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Loader2 size={20} className="animate-spin text-c-text-muted" />
          <span className="text-xs text-c-text-muted">
            {isPl ? 'Wczytywanie tematu…' : 'Loading topic…'}
          </span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
          <span className="text-xs text-c-text-muted">{error}</span>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg bg-c-surface-raised hover:bg-c-border-subtle text-c-text-secondary text-xs font-medium"
          >
            {isPl ? 'Spróbuj ponownie' : 'Retry'}
          </button>
        </div>
      ) : agg ? (
        <div className="flex-1 overflow-y-auto">
          {/* Stats + last active */}
          <div className="px-3 py-3 border-b border-c-border-subtle space-y-2">
            <div className="flex flex-wrap gap-2">
              <Stat
                icon={<StickyNote size={14} />}
                n={agg.counts.notes}
                label={isPl ? 'notatki' : 'notes'}
              />
              <Stat
                icon={<FileText size={14} />}
                n={agg.counts.outputs}
                label={isPl ? 'outputy' : 'outputs'}
              />
              <Stat
                icon={<Rocket size={14} />}
                n={agg.counts.initiatives}
                label={isPl ? 'inicjatywy' : 'initiatives'}
              />
            </div>
            <p className="text-[11px] text-c-text-muted">
              {isPl ? 'Ostatnio aktywny: ' : 'Last active: '}
              {formatDate(agg.lastActiveAt, isPl)}
            </p>
          </div>

          {/* Notes */}
          <Section title={isPl ? 'Notatki' : 'Notes'} count={agg.notes.length}>
            {agg.notes.length === 0 ? (
              <Empty text={isPl ? 'Brak przypiętych notatek' : 'No pinned notes'} />
            ) : (
              agg.notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onOpenNote?.(n.id)}
                  className="w-full text-left rounded-lg border border-c-border bg-c-surface-raised px-2.5 py-2 hover:border-c-border-strong transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-c-text truncate">
                      {n.title || (isPl ? 'Bez tytułu' : 'Untitled')}
                    </span>
                    {n.source === 'ai' && (
                      <span className="text-[11px] uppercase tracking-wide text-c-text-muted shrink-0">
                        AI
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-c-text-muted">{formatDate(n.updatedAt, isPl)}</span>
                </button>
              ))
            )}
          </Section>

          {/* Outputs */}
          <Section title={isPl ? 'Powiązane outputy' : 'Linked outputs'} count={agg.outputs.length}>
            {agg.outputs.length === 0 ? (
              <Empty text={isPl ? 'Brak powiązanych outputów' : 'No linked outputs'} />
            ) : (
              agg.outputs.map((a) => <ArtifactRow key={`${a.type}:${a.id}`} artifact={a} />)
            )}
          </Section>

          {/* Initiatives */}
          <Section
            title={isPl ? 'Powiązane inicjatywy' : 'Linked initiatives'}
            count={agg.initiatives.length}
          >
            {agg.initiatives.length === 0 ? (
              <Empty text={isPl ? 'Brak powiązanych inicjatyw' : 'No linked initiatives'} />
            ) : (
              agg.initiatives.map((a) => <ArtifactRow key={`${a.type}:${a.id}`} artifact={a} />)
            )}
          </Section>
        </div>
      ) : null}
    </div>
  );
};

const Section: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({
  title,
  count,
  children,
}) => (
  <div className="px-3 py-3 border-b border-c-border-subtle last:border-0 space-y-1.5">
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
        {title}
      </span>
      <span className="text-[10px] text-c-text-muted">{count}</span>
    </div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-[11px] text-c-text-muted italic">{text}</p>
);

const ArtifactRow: React.FC<{ artifact: AggregatedArtifact }> = ({ artifact }) => (
  <div className="flex items-center gap-2 rounded-lg border border-c-border bg-c-surface-raised px-2.5 py-1.5">
    <span className="text-[11px] uppercase tracking-wide text-c-text-muted shrink-0">
      {artifact.type}
    </span>
    <span className="text-xs text-c-text-secondary truncate">{artifact.id}</span>
  </div>
);

export default NotebookTopicView;
