/**
 * AuditTrailPanel — Record-level revision history sidebar.
 *
 * Shows field-level diffs with old→new highlighting, user avatars,
 * relative timestamps, action badges, and pagination.
 */
import { Calendar, ChevronDown, Clock, Filter, Loader2, Plus, Trash2, User, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getHeaders } from '@/services/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface FieldChange {
  fieldId: string;
  fieldName?: string;
  oldValue: unknown;
  newValue: unknown;
}

interface RecordRevision {
  id: string;
  recordId: string;
  userId?: string;
  userName?: string;
  action: string;
  changes: FieldChange[];
  timestamp: string;
}

interface AuditTrailPanelProps {
  open: boolean;
  onClose: () => void;
  recordId: string | null;
  tableId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: string, isPl: boolean): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isPl ? 'teraz' : 'just now';
  if (mins < 60) return isPl ? `${mins} min temu` : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isPl ? `${hours} godz. temu` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isPl ? `${days} dn. temu` : `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatValue(val: unknown): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'boolean') return val ? '✓' : '✗';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const ACTION_STYLES: Record<string, string> = {
  created: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  updated: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  deleted: 'bg-danger-500/10 text-danger-600 dark:text-danger-400',
};

// ── Sub-components ───────────────────────────────────────────────────────────

const FieldDiff = React.memo(function FieldDiff({ change }: { change: FieldChange }) {
  return (
    <div className="ml-9 mt-1 text-[11px] leading-relaxed">
      <span className="font-medium text-slate-500 dark:text-slate-400">
        {change.fieldName || change.fieldId}
      </span>
      <div className="flex items-start gap-1.5 mt-0.5">
        <span className="inline-block px-1.5 py-0.5 rounded bg-danger-500/10 text-danger-600 dark:text-danger-400 line-through max-w-[45%] truncate">
          {formatValue(change.oldValue)}
        </span>
        <span className="text-slate-600 dark:text-slate-500 mt-0.5">→</span>
        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 max-w-[45%] truncate">
          {formatValue(change.newValue)}
        </span>
      </div>
    </div>
  );
});

const RevisionItem = React.memo(function RevisionItem({
  revision,
  isPl,
}: {
  revision: RecordRevision;
  isPl: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = revision.changes.length > 0;

  return (
    <div className="px-3 py-2.5 border-b border-slate-200 dark:border-white/[0.04] last:border-0">
      <div
        className={`flex items-start gap-2.5 ${hasChanges ? 'cursor-pointer' : ''}`}
        onClick={() => hasChanges && setExpanded((p) => !p)}
      >
        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 flex-shrink-0 mt-0.5">
          {getInitials(revision.userName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
              {revision.userName || (isPl ? 'Nieznany' : 'Unknown')}
            </span>
            <span
              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${ACTION_STYLES[revision.action] ?? 'bg-slate-100 dark:bg-navy-800 text-slate-500'}`}
            >
              {revision.action}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-600 dark:text-slate-500">
            <Clock size={10} />
            {relativeTime(revision.timestamp, isPl)}
            {hasChanges && (
              <span className="ml-1 text-slate-600">
                ({revision.changes.length} {isPl ? 'zmian' : 'changes'})
              </span>
            )}
            {hasChanges && (
              <ChevronDown
                size={10}
                className={`ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            )}
          </div>
        </div>
      </div>
      {expanded &&
        revision.changes.map((ch, i) => <FieldDiff key={`${ch.fieldId}-${i}`} change={ch} />)}
    </div>
  );
});

// ── Main Component ───────────────────────────────────────────────────────────

export const AuditTrailPanel: React.FC<AuditTrailPanelProps> = ({
  open,
  onClose,
  recordId,
  tableId,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [revisions, setRevisions] = useState<RecordRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchRevisions = useCallback(
    async (reset = false) => {
      if (!recordId) return;
      setLoading(true);
      try {
        const newOffset = reset ? 0 : offset;
        const res = await fetch(
          `/api/table-platform/tables/${tableId}/audit?recordId=${recordId}&limit=${PAGE_SIZE}&offset=${newOffset}`,
          { headers: getHeaders() }
        );
        if (!res.ok) throw new Error('Failed to fetch audit trail');
        const data: RecordRevision[] = await res.json();
        if (reset) {
          setRevisions(data);
          setOffset(data.length);
        } else {
          setRevisions((prev) => [...prev, ...data]);
          setOffset((prev) => prev + data.length);
        }
        setHasMore(data.length === PAGE_SIZE);
      } catch {
        // Silently handle — panel shows empty state
      } finally {
        setLoading(false);
      }
    },
    [recordId, tableId, offset]
  );

  useEffect(() => {
    if (open && recordId) {
      setRevisions([]);
      setOffset(0);
      setHasMore(true);
      fetchRevisions(true);
    }
  }, [open, recordId]);

  const filtered = useMemo(() => {
    let items = revisions;
    if (filterUser) {
      const q = filterUser.toLowerCase();
      items = items.filter((r) => r.userName?.toLowerCase().includes(q));
    }
    if (filterAction) {
      items = items.filter((r) => r.action === filterAction);
    }
    return items;
  }, [revisions, filterUser, filterAction]);

  if (!open) return null;

  return (
    <div className="w-80 border-l border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900 flex flex-col h-full overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200/60 dark:border-navy-700/60">
        <Clock size={14} className="text-slate-500 dark:text-slate-400" />
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">
          {isPl ? 'Historia zmian' : 'Revision History'}
        </span>
        <button
          onClick={() => setShowFilters((p) => !p)}
          className={`p-1 rounded transition-colors ${showFilters ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <Filter size={12} />
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-white/[0.04] space-y-2">
          <input
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder={isPl ? 'Filtruj po użytkowniku…' : 'Filter by user…'}
            className="w-full h-7 px-2 rounded-lg text-[11px] bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 outline-none focus:ring-2 focus:ring-primary-500/30 text-slate-700 dark:text-slate-200"
          />
          <div className="flex gap-1">
            {['created', 'updated', 'deleted'].map((a) => (
              <button
                key={a}
                onClick={() => setFilterAction(filterAction === a ? null : a)}
                className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full transition-colors ${
                  filterAction === a
                    ? ACTION_STYLES[a]
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!recordId ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 dark:text-slate-500 px-4 text-center">
            <Clock size={24} className="mb-2 opacity-40" />
            <span className="text-xs">
              {isPl ? 'Wybierz rekord, aby zobaczyć historię' : 'Select a record to view history'}
            </span>
          </div>
        ) : loading && revisions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-slate-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 dark:text-slate-500 px-4 text-center">
            <Clock size={20} className="mb-2 opacity-40" />
            <span className="text-[11px]">
              {isPl ? 'Brak historii zmian' : 'No revision history'}
            </span>
          </div>
        ) : (
          <>
            {filtered.map((rev) => (
              <RevisionItem key={rev.id} revision={rev} isPl={!!isPl} />
            ))}
            {hasMore && (
              <div className="px-3 py-3">
                <button
                  onClick={() => fetchRevisions(false)}
                  disabled={loading}
                  className="w-full py-2 rounded-lg text-[11px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-500/5 hover:bg-primary-500/10 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  {isPl ? 'Załaduj więcej' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuditTrailPanel;
