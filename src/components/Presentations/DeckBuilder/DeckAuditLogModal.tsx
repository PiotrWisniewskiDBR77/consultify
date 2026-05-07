import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  History,
  RefreshCw,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchPresentationAuditLog,
  type AuditLogFetchStatus,
  type PresentationAuditLogEvent,
} from '@/services/presentationAuditLog';

interface DeckAuditLogModalProps {
  deckId: string;
  onClose: () => void;
}

const PAGE_SIZE = 50;

const ACTION_CHIP: Record<string, { bg: string; text: string; ring: string }> = {
  create: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-1 ring-blue-500/30',
  },
  update: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
    ring: 'ring-1 ring-slate-500/30',
  },
  delete: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-1 ring-rose-500/30',
  },
  share: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-1 ring-violet-500/30',
  },
  propose: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-1 ring-amber-500/30',
  },
  approve: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-1 ring-emerald-500/30',
  },
  reject: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
    ring: 'ring-1 ring-slate-500/30',
  },
};

const ACTOR_CHIP: Record<string, { bg: string; text: string; label: string }> = {
  USER: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'User',
  },
  AI_AGENT: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-300',
    label: 'AI Agent',
  },
  AI: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-300',
    label: 'AI Agent',
  },
  SYSTEM: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
    label: 'System',
  },
  CONSULTANT: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    label: 'Consultant',
  },
  INTEGRATION: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Integration',
  },
};

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function actionChipStyle(action: string): { bg: string; text: string; ring: string } {
  const key = String(action || '').toLowerCase();
  return (
    ACTION_CHIP[key] || {
      bg: 'bg-slate-500/15',
      text: 'text-slate-700 dark:text-slate-300',
      ring: 'ring-1 ring-slate-500/30',
    }
  );
}

function actorChipStyle(actor: string): { bg: string; text: string; label: string } {
  const key = String(actor || '').toUpperCase();
  return (
    ACTOR_CHIP[key] || {
      bg: 'bg-slate-500/15',
      text: 'text-slate-700 dark:text-slate-300',
      label: key || 'System',
    }
  );
}

const FILTERABLE_ACTOR_TYPES = ['USER', 'AI_AGENT', 'SYSTEM'] as const;
type FilterableActorType = (typeof FILTERABLE_ACTOR_TYPES)[number];

const ACTOR_FILTER_LABEL: Record<FilterableActorType, string> = {
  USER: 'User',
  AI_AGENT: 'AI Agent',
  SYSTEM: 'System',
};

function normalizeActorForFilter(actor: string | null | undefined): string {
  const key = String(actor || '').toUpperCase();
  if (key === 'AI') return 'AI_AGENT';
  return key;
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function truncateJson(value: unknown, maxLen = 1500): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(value, null, 2);
  } catch {
    serialized = String(value);
  }
  if (serialized.length > maxLen) {
    return `${serialized.slice(0, maxLen)}\n… (truncated)`;
  }
  return serialized;
}

const AuditEventRow: React.FC<{ event: PresentationAuditLogEvent }> = ({ event }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const actionStyle = actionChipStyle(event.action);
  const actorStyle = actorChipStyle(event.actorType);
  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

  return (
    <li className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800/40">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-shrink-0 text-[11px] font-mono text-slate-500 dark:text-slate-400 min-w-[140px]">
          {formatTimestamp(event.timestamp)}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${actionStyle.bg} ${actionStyle.text} ${actionStyle.ring}`}
        >
          {event.action}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actorStyle.bg} ${actorStyle.text}`}
        >
          {actorStyle.label}
        </span>
        {event.scope ? (
          <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-navy-800 px-1.5 py-0.5 text-[10px] italic text-slate-600 dark:text-slate-300">
            {event.scope}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">
          {event.summary}
        </div>
        {hasMetadata ? (
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800"
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Details
          </button>
        ) : null}
      </div>
      {detailsOpen && hasMetadata ? (
        <pre className="mt-2 ml-[140px] max-h-72 overflow-auto rounded-md border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 p-2 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-all">
          {truncateJson(event.metadata)}
        </pre>
      ) : null}
    </li>
  );
};

export const DeckAuditLogModal: React.FC<DeckAuditLogModalProps> = ({ deckId, onClose }) => {
  const [status, setStatus] = useState<AuditLogFetchStatus | 'loading'>('loading');
  const [events, setEvents] = useState<PresentationAuditLogEvent[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [actorFilters, setActorFilters] = useState<Set<FilterableActorType>>(
    () => new Set<FilterableActorType>(FILTERABLE_ACTOR_TYPES)
  );
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const toggleActor = useCallback((actor: FilterableActorType) => {
    setActorFilters((prev) => {
      const next = new Set(prev);
      if (next.has(actor)) {
        next.delete(actor);
      } else {
        next.add(actor);
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setActorFilters(new Set<FilterableActorType>(FILTERABLE_ACTOR_TYPES));
    setActionFilter('');
    setDateFrom('');
    setDateTo('');
  }, []);

  const filtersActive =
    actorFilters.size !== FILTERABLE_ACTOR_TYPES.length ||
    actionFilter !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.action) set.add(e.action);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const fromTs = dateFrom ? Date.parse(`${dateFrom}T00:00:00`) : NaN;
    const toTs = dateTo ? Date.parse(`${dateTo}T23:59:59.999`) : NaN;
    const hasDateFilter = !Number.isNaN(fromTs) || !Number.isNaN(toTs);

    return events.filter((e) => {
      const actorKey = normalizeActorForFilter(e.actorType) as FilterableActorType;
      if (!actorFilters.has(actorKey)) return false;

      if (actionFilter && e.action !== actionFilter) return false;

      if (hasDateFilter) {
        const ts = Date.parse(e.timestamp);
        if (Number.isNaN(ts)) return false;
        if (!Number.isNaN(fromTs) && ts < fromTs) return false;
        if (!Number.isNaN(toTs) && ts > toTs) return false;
      }

      return true;
    });
  }, [events, actorFilters, actionFilter, dateFrom, dateTo]);

  const handleExportCsv = useCallback(() => {
    if (filteredEvents.length === 0) return;

    const columns = [
      'id',
      'timestamp',
      'actorType',
      'actorId',
      'action',
      'resourceType',
      'resourceId',
      'scope',
      'operationId',
      'summary',
      'metadataJson',
    ];

    const lines: string[] = [];
    lines.push(columns.map(escapeCsv).join(','));

    for (const e of filteredEvents) {
      let metadataJson = '';
      try {
        metadataJson = JSON.stringify(e.metadata ?? {});
      } catch {
        metadataJson = '';
      }
      if (metadataJson.length > 500) {
        metadataJson = metadataJson.slice(0, 500);
      }

      const row = [
        e.id,
        e.timestamp,
        e.actorType,
        e.actorId ?? '',
        e.action,
        e.resourceType,
        e.resourceId ?? '',
        e.scope ?? '',
        e.operationId ?? '',
        e.summary,
        metadataJson,
      ].map((v) => escapeCsv(String(v ?? '')));

      lines.push(row.join(','));
    }

    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `audit-log-${deckId}-${todayYmd()}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [deckId, filteredEvents]);

  const loadInitial = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    setEvents([]);
    setTotal(0);
    const result = await fetchPresentationAuditLog(deckId, { limit: PAGE_SIZE, offset: 0 });
    if (result.status === 'ok') {
      setEvents(result.events || []);
      setTotal(result.total ?? (result.events ? result.events.length : 0));
      setStatus('ok');
      return;
    }
    setStatus(result.status);
    setErrorMessage(result.error || null);
  }, [deckId]);

  const loadMore = useCallback(async () => {
    if (status !== 'ok' || loadingMore) return;
    setLoadingMore(true);
    const result = await fetchPresentationAuditLog(deckId, {
      limit: PAGE_SIZE,
      offset: events.length,
    });
    if (result.status === 'ok') {
      const incoming = result.events || [];
      if (incoming.length > 0) {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          const merged = [...prev];
          for (const evt of incoming) {
            if (!seen.has(evt.id)) {
              seen.add(evt.id);
              merged.push(evt);
            }
          }
          return merged;
        });
      }
      if (typeof result.total === 'number') {
        setTotal(result.total);
      }
    } else {
      setStatus(result.status);
      setErrorMessage(result.error || null);
    }
    setLoadingMore(false);
  }, [deckId, events.length, loadingMore, status]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const titleId = 'deck-audit-log-title';

  const renderBody = () => {
    if (status === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Loading audit log…</p>
        </div>
      );
    }

    if (status !== 'ok') {
      const isForbidden = status === 'forbidden';
      const reason = isForbidden
        ? "You don't have permission to view this deck's audit log."
        : status === 'not_found'
          ? 'No audit log is available for this deck.'
          : status === 'unavailable'
            ? 'Audit log service is temporarily unreachable.'
            : 'Audit log could not be loaded.';

      return (
        <div className="rounded-lg border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 text-amber-600 dark:text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Audit log unavailable
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/90">{reason}</p>
              {errorMessage && !isForbidden ? (
                <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-300/80 font-mono break-all">
                  {errorMessage}
                </p>
              ) : null}
            </div>
            {!isForbidden ? (
              <button
                type="button"
                onClick={() => void loadInitial()}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-700/70 bg-white/70 dark:bg-amber-900/30 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-200 hover:bg-white dark:hover:bg-amber-900/50"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    if (events.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History size={20} className="text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            No audit events yet
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Activity for this deck will appear here once edits, shares, or AI proposals occur.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="mb-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/60 dark:bg-navy-900/40 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="audit-actor-filter">
                Actor type
              </label>
              <span
                id="audit-actor-filter"
                className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mr-1"
              >
                Actor
              </span>
              {FILTERABLE_ACTOR_TYPES.map((actor) => {
                const selected = actorFilters.has(actor);
                const label = ACTOR_FILTER_LABEL[actor];
                return (
                  <button
                    key={actor}
                    type="button"
                    onClick={() => toggleActor(actor)}
                    aria-pressed={selected}
                    aria-label={`Toggle ${label} filter`}
                    className={
                      selected
                        ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-primary-500 text-white ring-1 ring-primary-500 hover:bg-primary-600'
                        : 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-transparent text-slate-600 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-navy-600 hover:bg-slate-100 dark:hover:bg-navy-800'
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <label
                htmlFor="audit-action-filter"
                className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Action
              </label>
              <select
                id="audit-action-filter"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label="Filter by action"
                className="rounded-md border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All actions</option>
                {uniqueActions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label
                htmlFor="audit-date-from"
                className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                From
              </label>
              <input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Filter from date"
                className="rounded-md border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <label
                htmlFor="audit-date-to"
                className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                To
              </label>
              <input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Filter to date"
                className="rounded-md border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <button
              type="button"
              onClick={resetFilters}
              disabled={!filtersActive}
              aria-label="Reset filters"
              className="ml-auto text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
            >
              Reset filters
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Showing {filteredEvents.length} of {events.length}
            {total > events.length ? ` (loaded; ${total} total on server)` : ''}
          </p>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <History size={20} className="text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              No events match the current filters
            </p>
            <button
              type="button"
              onClick={resetFilters}
              aria-label="Reset filters"
              className="mt-2 text-[12px] font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-navy-800 -mx-5">
            {filteredEvents.map((evt) => (
              <AuditEventRow key={evt.id} event={evt} />
            ))}
          </ul>
        )}
      </>
    );
  };

  const canLoadMore =
    status === 'ok' && events.length > 0 && (total === 0 || events.length < total);
  const showFooter = status === 'ok' && events.length > 0;
  const exportDisabled = filteredEvents.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2">
            <History size={16} className="text-primary-500" />
            <h2 id={titleId} className="text-sm font-semibold text-slate-800 dark:text-white">
              Audit Log
            </h2>
            {status === 'ok' && events.length > 0 ? (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {events.length}
                {total > events.length ? ` of ${total}` : ''}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{renderBody()}</div>
        {showFooter ? (
          <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50/60 dark:bg-navy-900/60">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportDisabled}
              aria-label="Export filtered audit log as CSV"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={12} />
              Export CSV
            </button>
            {canLoadMore ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                aria-label="Load more events"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
};

export default DeckAuditLogModal;
