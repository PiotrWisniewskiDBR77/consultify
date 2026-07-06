/**
 * NotebookTodayView — the daily "Today" cockpit for the Living Notebook (M04).
 *
 * Opens the notebook as a daily driver rather than a segregator table. Four
 * sections, each row clickable → onOpenNote(id):
 *   • Pinned        — owner's pinned notes
 *   • Recent        — most-recently-touched (by updated_at)
 *   • To review     — Stale: verification='disputed' OR active-but-untouched
 *   • Fresh captures — pages that arrived via a capture source
 *
 * Self-contained: fetches GET /api/v8/notebook/today via v8Get. Degrades to an
 * empty cockpit on error — it never blocks the notebook shell. Inline i18n
 * (isPolish) to match neighbouring notebook components.
 *
 * Owned by AGENT 2. Host wiring: see report (Today entry hook).
 */
import {
  AlertTriangle,
  Clock,
  Hash,
  Inbox,
  Loader2,
  Pin,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { v8Get } from '@/services/api/v8/client';

export interface NotebookTodayPage {
  id: string;
  title: string;
  icon?: string | null;
  status?: string;
  pinned?: boolean;
  captureSource?: string | null;
  verificationStatus?: string;
  updatedAt?: string | null;
}

export interface NotebookTodayData {
  pinned: NotebookTodayPage[];
  recent: NotebookTodayPage[];
  toReview: NotebookTodayPage[];
  freshCaptures: NotebookTodayPage[];
}

interface NotebookTodayViewProps {
  /** Open a note by id (host wires this to the editor). */
  onOpenNote: (id: string) => void;
  /** Optional capture slot rendered above the sections (e.g. NotebookQuickCapture). */
  captureSlot?: React.ReactNode;
  /** Bump to force a refetch (e.g. after a quick-capture creates a page). */
  refreshKey?: number;
  className?: string;
}

const EMPTY: NotebookTodayData = { pinned: [], recent: [], toReview: [], freshCaptures: [] };

function formatWhen(iso?: string | null, isPl?: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const NotebookTodayView: React.FC<NotebookTodayViewProps> = ({
  onOpenNote,
  captureSlot,
  refreshKey = 0,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const [data, setData] = useState<NotebookTodayData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await v8Get<NotebookTodayData>('/notebook/today');
      setData({
        pinned: res?.pinned ?? [],
        recent: res?.recent ?? [],
        toReview: res?.toReview ?? [],
        freshCaptures: res?.freshCaptures ?? [],
      });
    } catch {
      // Degraded: empty cockpit, never block the shell.
      setData(EMPTY);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const renderRow = (page: NotebookTodayPage) => (
    <button
      key={page.id}
      type="button"
      onClick={() => onOpenNote(page.id)}
      className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-c-surface-raised"
    >
      <span className="text-base leading-none">{page.icon || '📝'}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-c-text-secondary group-hover:text-c-text">
        {page.title || (isPl ? 'Bez tytułu' : 'Untitled')}
      </span>
      {page.verificationStatus === 'disputed' && (
        <AlertTriangle size={12} className="shrink-0 text-c-warning" />
      )}
      {page.captureSource && (
        <Sparkles size={11} className="shrink-0 text-c-text-muted" />
      )}
      {page.updatedAt && (
        <span className="shrink-0 text-[11px] text-c-text-muted">
          {formatWhen(page.updatedAt, isPl)}
        </span>
      )}
    </button>
  );

  const renderSection = (
    key: keyof NotebookTodayData,
    title: string,
    icon: React.ReactNode,
    emptyHint: string
  ) => {
    const rows = data[key];
    return (
      <section className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface">
        <header className="flex items-center gap-2 border-b border-c-border-subtle px-3 py-2">
          <span className="text-c-text-muted">{icon}</span>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            {title}
          </h3>
          {rows.length > 0 && (
            <span className="ml-auto rounded-full bg-c-surface-raised px-1.5 text-[11px] font-medium text-c-text-muted">
              {rows.length}
            </span>
          )}
        </header>
        <div className="p-1.5">
          {rows.length === 0 ? (
            <p className="px-2 py-3 text-xs text-c-text-muted">{emptyHint}</p>
          ) : (
            rows.map(renderRow)
          )}
        </div>
      </section>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 py-16 text-c-text-muted ${className}`}>
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">{isPl ? 'Ładuję „Dziś”…' : 'Loading Today…'}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-c-text">
          {isPl ? 'Dziś' : 'Today'}
        </h2>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-c-text-muted hover:bg-c-surface-raised"
          title={isPl ? 'Odśwież' : 'Refresh'}
        >
          <RefreshCw size={12} />
          {isPl ? 'Odśwież' : 'Refresh'}
        </button>
      </div>

      {failed && (
        <p className="rounded-lg bg-c-warning/10 px-3 py-2 text-xs text-c-warning">
          {isPl
            ? 'Nie udało się załadować kokpitu „Dziś”. Notatnik działa dalej.'
            : 'Could not load the Today cockpit. The notebook still works.'}
        </p>
      )}

      {captureSlot}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {renderSection(
          'pinned',
          isPl ? 'Przypięte' : 'Pinned',
          <Pin size={13} />,
          isPl ? 'Brak przypiętych notatek.' : 'No pinned notes yet.'
        )}
        {renderSection(
          'recent',
          isPl ? 'Ostatnie' : 'Recent',
          <Clock size={13} />,
          isPl ? 'Brak ostatnich notatek.' : 'No recent notes.'
        )}
        {renderSection(
          'toReview',
          isPl ? 'Do przeglądu' : 'To review',
          <Hash size={13} />,
          isPl ? 'Nic nie czeka na przegląd.' : 'Nothing waiting for review.'
        )}
        {renderSection(
          'freshCaptures',
          isPl ? 'Świeże captures' : 'Fresh captures',
          <Inbox size={13} />,
          isPl ? 'Brak nowych wrzutek.' : 'No fresh captures.'
        )}
      </div>
    </div>
  );
};

export default NotebookTodayView;
