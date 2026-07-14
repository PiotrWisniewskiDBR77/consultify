import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Download,
  History,
  Link2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type AuditLogFetchStatus,
  fetchPresentationAuditLog,
  type PresentationAuditLogEvent,
} from '@/services/presentationAuditLog';
import {
  type AuditLogSavedView,
  type AuditLogSavedViewFilters,
  deleteSavedView,
  exportSavedViews,
  findMatchingSavedView,
  importSavedViews,
  isSavedViewsStorageAvailable,
  listSavedViews,
  saveSavedView,
} from '@/services/presentationAuditLogSavedViews';

interface DeckAuditLogModalProps {
  deckId: string;
  onClose: () => void;
  userKey?: string;
}

const SHARED_USER_KEY = '__shared__';

const PAGE_SIZE = 50;

const ACTION_CHIP: Record<string, { bg: string; text: string; ring: string }> = {
  create: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-1 ring-blue-500/30',
  },
  update: {
    bg: 'bg-c-surface-raised',
    text: 'text-c-text',
    ring: 'ring-1 ring-c-border',
  },
  delete: {
    bg: 'bg-danger-500/15',
    text: 'text-danger-700 dark:text-danger-300',
    ring: 'ring-1 ring-danger-500/30',
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
    bg: 'bg-c-surface-raised',
    text: 'text-c-text',
    ring: 'ring-1 ring-c-border',
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
    bg: 'bg-c-surface-raised',
    text: 'text-c-text',
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
      bg: 'bg-c-surface-raised',
      text: 'text-c-text',
      ring: 'ring-1 ring-c-border',
    }
  );
}

function actorChipStyle(actor: string): { bg: string; text: string; label: string } {
  const key = String(actor || '').toUpperCase();
  return (
    ACTOR_CHIP[key] || {
      bg: 'bg-c-surface-raised',
      text: 'text-c-text',
      label: key || 'System',
    }
  );
}

const FILTERABLE_ACTOR_TYPES = ['USER', 'AI_AGENT', 'SYSTEM'] as const;

const URL_PARAM_PREFIX = 'audit_';
const URL_PARAM_KEYS = {
  enable: `${URL_PARAM_PREFIX}log`,
  actors: `${URL_PARAM_PREFIX}actors`,
  action: `${URL_PARAM_PREFIX}action`,
  from: `${URL_PARAM_PREFIX}from`,
  to: `${URL_PARAM_PREFIX}to`,
} as const;

interface ParsedAuditFilters {
  actorTypes: Set<FilterableActorType> | null;
  action: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

function parseFiltersFromLocation(): ParsedAuditFilters {
  if (typeof window === 'undefined' || !window.location) {
    return { actorTypes: null, action: null, dateFrom: null, dateTo: null };
  }
  const params = new URLSearchParams(window.location.search);
  let actorTypes: Set<FilterableActorType> | null = null;
  const rawActors = params.get(URL_PARAM_KEYS.actors);
  if (rawActors) {
    const parts = rawActors
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean) as FilterableActorType[];
    const filtered = parts.filter((p): p is FilterableActorType =>
      (FILTERABLE_ACTOR_TYPES as readonly string[]).includes(p)
    );
    if (filtered.length > 0) actorTypes = new Set(filtered);
  }
  return {
    actorTypes,
    action: params.get(URL_PARAM_KEYS.action) || null,
    dateFrom: params.get(URL_PARAM_KEYS.from) || null,
    dateTo: params.get(URL_PARAM_KEYS.to) || null,
  };
}
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
    <li className="px-4 py-3 hover:bg-c-surface-raised">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-shrink-0 text-[11px] font-mono text-c-text-secondary min-w-[140px]">
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
          <span className="inline-flex items-center rounded-md bg-c-surface-raised px-1.5 py-0.5 text-[10px] italic text-c-text-secondary">
            {event.scope}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 text-sm text-c-text">{event.summary}</div>
        {hasMetadata ? (
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised"
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Details
          </button>
        ) : null}
      </div>
      {detailsOpen && hasMetadata ? (
        <pre className="mt-2 ml-[140px] max-h-72 overflow-auto rounded-md border border-c-border-subtle bg-c-surface-raised p-2 text-[11px] text-c-text-secondary whitespace-pre-wrap break-all">
          {truncateJson(event.metadata)}
        </pre>
      ) : null}
    </li>
  );
};

function buildFiltersPayload(
  actorFilters: Set<FilterableActorType>,
  actionFilter: string,
  dateFrom: string,
  dateTo: string
): AuditLogSavedViewFilters {
  return {
    actorTypes: Array.from(actorFilters).sort(),
    action: actionFilter || null,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
  };
}

export const DeckAuditLogModal: React.FC<DeckAuditLogModalProps> = ({
  deckId,
  onClose,
  userKey,
}) => {
  const resolvedUserKey = userKey ?? SHARED_USER_KEY;

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
  const [shareCopied, setShareCopied] = useState(false);

  const [savedViewsAvailable] = useState<boolean>(() => isSavedViewsStorageAvailable());
  const [savedViews, setSavedViews] = useState<AuditLogSavedView[]>(() =>
    isSavedViewsStorageAvailable() ? listSavedViews(resolvedUserKey) : []
  );
  const [activeView, setActiveView] = useState<AuditLogSavedView | null>(null);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [savedViewsManageOpen, setSavedViewsManageOpen] = useState(false);
  const [saveDraftOpen, setSaveDraftOpen] = useState(false);
  const [saveDraftName, setSaveDraftName] = useState('');
  const [saveDraftError, setSaveDraftError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const parsed = parseFiltersFromLocation();
    if (parsed.actorTypes) setActorFilters(parsed.actorTypes);
    if (parsed.action) setActionFilter(parsed.action);
    if (parsed.dateFrom) setDateFrom(parsed.dateFrom);
    if (parsed.dateTo) setDateTo(parsed.dateTo);
  }, []);

  // Auto-detect a matching saved view on mount + whenever savedViews load.
  useEffect(() => {
    if (!savedViewsAvailable || savedViews.length === 0) return;
    const payload = buildFiltersPayload(actorFilters, actionFilter, dateFrom, dateTo);
    const match = findMatchingSavedView(savedViews, payload);
    if (match) setActiveView(match);
    // We intentionally only run this when savedViews list changes, not on every
    // filter change — manual filter edits are tracked separately as "modified".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedViews, savedViewsAvailable]);

  const handleCopyShareLink = useCallback(() => {
    if (typeof window === 'undefined' || !window.location) return;
    const url = new URL(window.location.href);
    url.searchParams.set(URL_PARAM_KEYS.enable, 'true');
    if (actorFilters.size !== FILTERABLE_ACTOR_TYPES.length) {
      url.searchParams.set(URL_PARAM_KEYS.actors, Array.from(actorFilters).sort().join(','));
    } else {
      url.searchParams.delete(URL_PARAM_KEYS.actors);
    }
    if (actionFilter) {
      url.searchParams.set(URL_PARAM_KEYS.action, actionFilter);
    } else {
      url.searchParams.delete(URL_PARAM_KEYS.action);
    }
    if (dateFrom) {
      url.searchParams.set(URL_PARAM_KEYS.from, dateFrom);
    } else {
      url.searchParams.delete(URL_PARAM_KEYS.from);
    }
    if (dateTo) {
      url.searchParams.set(URL_PARAM_KEYS.to, dateTo);
    } else {
      url.searchParams.delete(URL_PARAM_KEYS.to);
    }
    const text = url.toString();
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // ignore
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(fallback);
    } else {
      fallback();
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, [actorFilters, actionFilter, dateFrom, dateTo]);

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
    setActiveView(null);
  }, []);

  const currentFiltersPayload = useMemo<AuditLogSavedViewFilters>(
    () => buildFiltersPayload(actorFilters, actionFilter, dateFrom, dateTo),
    [actorFilters, actionFilter, dateFrom, dateTo]
  );

  const activeViewModified = useMemo(() => {
    if (!activeView) return false;
    const a = currentFiltersPayload;
    const b = activeView.filters;
    if ((a.action ?? null) !== (b.action ?? null)) return true;
    if ((a.dateFrom ?? null) !== (b.dateFrom ?? null)) return true;
    if ((a.dateTo ?? null) !== (b.dateTo ?? null)) return true;
    const sortedA = [...a.actorTypes].sort();
    const sortedB = [...b.actorTypes].sort();
    if (sortedA.length !== sortedB.length) return true;
    for (let i = 0; i < sortedA.length; i += 1) {
      if (sortedA[i] !== sortedB[i]) return true;
    }
    return false;
  }, [activeView, currentFiltersPayload]);

  const refreshSavedViews = useCallback(() => {
    if (!savedViewsAvailable) return;
    setSavedViews(listSavedViews(resolvedUserKey));
  }, [resolvedUserKey, savedViewsAvailable]);

  const applySavedView = useCallback((view: AuditLogSavedView) => {
    const filterableActors = view.filters.actorTypes.filter((a): a is FilterableActorType =>
      (FILTERABLE_ACTOR_TYPES as readonly string[]).includes(a)
    );
    setActorFilters(
      filterableActors.length > 0
        ? new Set<FilterableActorType>(filterableActors)
        : new Set<FilterableActorType>(FILTERABLE_ACTOR_TYPES)
    );
    setActionFilter(view.filters.action ?? '');
    setDateFrom(view.filters.dateFrom ?? '');
    setDateTo(view.filters.dateTo ?? '');
    setActiveView(view);
    setSavedViewsOpen(false);
    setSaveDraftOpen(false);
    setSavedViewsManageOpen(false);
    setImportStatus(null);
  }, []);

  const handleSaveCurrentClick = useCallback(() => {
    setSaveDraftError(null);
    setSaveDraftName(activeView?.name ?? '');
    setSaveDraftOpen(true);
  }, [activeView]);

  const handleSaveDraftSubmit = useCallback(() => {
    const name = saveDraftName.trim();
    if (name.length < 1 || name.length > 40) {
      setSaveDraftError('Name must be 1–40 characters');
      return;
    }
    try {
      const saved = saveSavedView(resolvedUserKey, {
        id:
          activeView && activeView.name.toLowerCase() === name.toLowerCase()
            ? activeView.id
            : undefined,
        name,
        filters: currentFiltersPayload,
      });
      setActiveView(saved);
      setSaveDraftOpen(false);
      setSaveDraftName('');
      setSaveDraftError(null);
      refreshSavedViews();
    } catch (err) {
      const code = err instanceof Error ? err.message : 'UNKNOWN';
      if (code === 'NAME_TAKEN') {
        setSaveDraftError('A view with that name already exists');
      } else if (code === 'LIMIT_REACHED') {
        setSaveDraftError('Limit reached (max 20 saved views)');
      } else if (code === 'NAME_INVALID') {
        setSaveDraftError('Name must be 1–40 characters');
      } else {
        setSaveDraftError('Could not save view');
      }
    }
  }, [activeView, currentFiltersPayload, refreshSavedViews, resolvedUserKey, saveDraftName]);

  const handleDeleteView = useCallback(
    (viewId: string) => {
      deleteSavedView(resolvedUserKey, viewId);
      if (activeView?.id === viewId) setActiveView(null);
      refreshSavedViews();
    },
    [activeView, refreshSavedViews, resolvedUserKey]
  );

  const handleExportViews = useCallback(() => {
    if (!savedViewsAvailable) return;
    const json = exportSavedViews(resolvedUserKey);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-saved-views-${todayYmd()}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [resolvedUserKey, savedViewsAvailable]);

  const handleImportClick = useCallback(() => {
    setImportStatus(null);
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const result = importSavedViews(resolvedUserKey, text);
        setImportStatus({
          kind: 'success',
          message: `Imported ${result.added} · skipped ${result.skipped}`,
        });
        refreshSavedViews();
      } catch {
        setImportStatus({
          kind: 'error',
          message: 'Could not import: invalid JSON',
        });
      }
    },
    [refreshSavedViews, resolvedUserKey]
  );

  // Close popover on outside click.
  useEffect(() => {
    if (!savedViewsOpen) return;
    const handlePointer = (e: MouseEvent) => {
      const root = dropdownContainerRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setSavedViewsOpen(false);
        setSaveDraftOpen(false);
        setSavedViewsManageOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [savedViewsOpen]);

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
          <div className="animate-spin w-6 h-6 border-2 border-c-accent border-t-transparent rounded-full" />
          <p className="mt-3 text-xs text-c-text-secondary">Loading audit log…</p>
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
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-700/70 bg-c-surface dark:bg-amber-900/30 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-200 hover:bg-c-surface dark:hover:bg-amber-900/50"
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
          <History size={20} className="text-c-text-secondary" />
          <p className="mt-2 text-sm font-medium text-c-text-secondary">No audit events yet</p>
          <p className="mt-1 text-xs text-c-text-secondary">
            Activity for this deck will appear here once edits, shares, or AI proposals occur.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="mb-3 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="audit-actor-filter">
                Actor type
              </label>
              <span
                id="audit-actor-filter"
                className="text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary mr-1"
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
                        ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-c-accent-soft0 text-c-text ring-1 ring-c-focus hover:bg-c-accent-soft'
                        : 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-transparent text-c-text-secondary ring-1 ring-c-border hover:bg-c-surface-raised'
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
                className="text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary"
              >
                Action
              </label>
              <select
                id="audit-action-filter"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label="Filter by action"
                className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[11px] text-c-text focus:outline-none focus:ring-1 focus:ring-c-focus"
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
                className="text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary"
              >
                From
              </label>
              <input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Filter from date"
                className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[11px] text-c-text focus:outline-none focus:ring-1 focus:ring-c-focus"
              />
              <label
                htmlFor="audit-date-to"
                className="text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary"
              >
                To
              </label>
              <input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Filter to date"
                className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[11px] text-c-text focus:outline-none focus:ring-1 focus:ring-c-focus"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              {savedViewsAvailable ? (
                <div className="relative" ref={dropdownContainerRef}>
                  <div className="flex items-center gap-1.5">
                    {activeView ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-c-accent-soft0 px-2 py-0.5 text-[11px] font-medium text-c-accent ring-1 ring-c-focus"
                        aria-label={`Active saved view: ${activeView.name}${activeViewModified ? ' (modified)' : ''}`}
                      >
                        <Bookmark size={10} />
                        <span className="max-w-[120px] truncate">
                          {activeView.name}
                          {activeViewModified ? ' (modified)' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveView(null)}
                          aria-label="Clear active saved view"
                          className="ml-0.5 rounded-full p-0.5 hover:bg-c-accent-soft0"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setSavedViewsOpen((v) => !v);
                        setImportStatus(null);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={savedViewsOpen}
                      aria-label="Saved views"
                      className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[11px] font-medium text-c-text hover:bg-c-surface-raised"
                    >
                      <Bookmark size={11} />
                      Saved views
                      <ChevronDown size={10} />
                    </button>
                  </div>
                  {savedViewsOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-10 mt-1 w-72 rounded-md border border-c-border-subtle bg-c-surface shadow-lg p-2 text-[12px] text-c-text"
                    >
                      {saveDraftOpen ? (
                        <div className="border-b border-c-border-subtle pb-2 mb-2">
                          <label
                            htmlFor="audit-saved-view-name"
                            className="block text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary mb-1"
                          >
                            View name
                          </label>
                          <input
                            id="audit-saved-view-name"
                            type="text"
                            value={saveDraftName}
                            maxLength={40}
                            autoFocus
                            onChange={(e) => {
                              setSaveDraftName(e.target.value);
                              setSaveDraftError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveDraftSubmit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setSaveDraftOpen(false);
                              }
                            }}
                            className="w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[12px] text-c-text focus:outline-none focus:ring-1 focus:ring-c-focus"
                            placeholder="e.g. AI activity, last 7 days"
                          />
                          {saveDraftError ? (
                            <p className="mt-1 text-[11px] text-danger-600 dark:text-danger-400">
                              {saveDraftError}
                            </p>
                          ) : null}
                          <div className="mt-2 flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSaveDraftOpen(false)}
                              className="rounded-md px-2 py-1 text-[11px] text-c-text-secondary hover:bg-c-surface-raised"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveDraftSubmit}
                              className="rounded-md bg-c-accent-soft0 px-2 py-1 text-[11px] font-medium text-c-text hover:bg-c-accent-soft"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSaveCurrentClick}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-c-surface-raised"
                        >
                          <Bookmark size={11} className="text-c-accent" />
                          Save current as…
                        </button>
                      )}

                      <div className="max-h-48 overflow-y-auto">
                        {savedViews.length === 0 ? (
                          <p className="px-2 py-1.5 text-[11px] text-c-text-secondary">
                            No saved views yet.
                          </p>
                        ) : (
                          savedViews.map((view) => {
                            const isActive = activeView?.id === view.id;
                            return (
                              <div
                                key={view.id}
                                className={`group flex items-center gap-1 rounded-md px-1 ${
                                  isActive ? 'bg-c-border-subtle/[0.08]' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => applySavedView(view)}
                                  className="flex-1 truncate rounded-md px-2 py-1.5 text-left hover:bg-c-surface-raised"
                                  title={view.name}
                                >
                                  {view.name}
                                </button>
                                {savedViewsManageOpen ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteView(view.id)}
                                    aria-label={`Delete saved view ${view.name}`}
                                    className="rounded-md p-1 text-danger-500 hover:bg-danger-500/10"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="mt-2 border-t border-c-border-subtle pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSavedViewsManageOpen((v) => !v)}
                          className="font-medium text-c-accent hover:underline"
                        >
                          {savedViewsManageOpen ? 'Done' : 'Manage'}
                        </button>
                        <button
                          type="button"
                          onClick={handleExportViews}
                          disabled={savedViews.length === 0}
                          className="text-c-text-secondary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                        >
                          Export views
                        </button>
                        <button
                          type="button"
                          onClick={handleImportClick}
                          className="text-c-text-secondary hover:underline"
                        >
                          Import views
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/json,.json"
                          className="hidden"
                          onChange={handleImportFile}
                        />
                      </div>
                      {importStatus ? (
                        <p
                          role={importStatus.kind === 'error' ? 'alert' : undefined}
                          className={
                            importStatus.kind === 'error'
                              ? 'mt-2 rounded-md border border-danger-200 dark:border-danger-700/60 bg-danger-50 dark:bg-danger-900/20 px-2 py-1 text-[11px] text-danger-700 dark:text-danger-300'
                              : 'mt-2 rounded-md border border-emerald-200 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300'
                          }
                        >
                          {importStatus.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <span className="text-[10px] italic text-c-text-secondary">
                  Saved views require localStorage
                </span>
              )}
              <button
                type="button"
                onClick={resetFilters}
                disabled={!filtersActive}
                aria-label="Reset filters"
                className="text-[11px] font-medium text-c-accent hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
              >
                Reset filters
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-c-text-secondary">
            Showing {filteredEvents.length} of {events.length}
            {total > events.length ? ` (loaded; ${total} total on server)` : ''}
          </p>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <History size={20} className="text-c-text-secondary" />
            <p className="mt-2 text-sm font-medium text-c-text-secondary">
              No events match the current filters
            </p>
            <button
              type="button"
              onClick={resetFilters}
              aria-label="Reset filters"
              className="mt-2 text-[12px] font-medium text-c-accent hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-c-border-subtle -mx-5">
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
      className="fixed inset-0 z-overlay flex items-center justify-center bg-c-surface-raised px-4 py-8"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full rounded-xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03] shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-c-border-subtle">
          <div className="flex items-center gap-2">
            <History size={16} className="text-c-accent" />
            <h2 id={titleId} className="text-sm font-semibold text-c-text">
              Audit Log
            </h2>
            {status === 'ok' && events.length > 0 ? (
              <span className="text-[11px] text-c-text-secondary">
                {events.length}
                {total > events.length ? ` of ${total}` : ''}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{renderBody()}</div>
        {showFooter ? (
          <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle bg-c-surface-raised">
            <button
              type="button"
              onClick={handleCopyShareLink}
              aria-label="Copy a shareable link with the current filters"
              className="inline-flex items-center gap-1.5 rounded-md border border-c-border-subtle bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised"
            >
              <Link2 size={12} />
              {shareCopied ? 'Link copied!' : 'Copy share link'}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportDisabled}
              aria-label="Export filtered audit log as CSV"
              className="inline-flex items-center gap-1.5 rounded-md border border-c-border-subtle bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="inline-flex items-center gap-1.5 rounded-md border border-c-border-subtle bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
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
