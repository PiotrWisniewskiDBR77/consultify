/**
 * AuditTrailPanel — Record-level revision history sidebar.
 *
 * Shows field-level diffs with old→new highlighting, user avatars,
 * relative timestamps, action badges, and pagination.
 */
import {
  Calendar,
  ChevronDown,
  Clock,
  Filter,
  Loader2,
  Lock,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/shared/states';
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
  /**
   * Whether `tableId` is a real `tp_tables.id` row (table-platform mode).
   *
   * Legacy idea-tables (map/blob persistence, no table-platform row) have no
   * `tp_tables` row, so the audit endpoint (`requireTableAccess` →
   * `canAccessTable`) always rejects with 403. When `false`, we skip fetching
   * entirely and show an explicit "not available" message instead of a silent
   * empty/error state.
   */
  isPlatformTable?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: string, t: TFunction): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('myWorkTable.auditTrailPanel.justNow');
  if (mins < 60) return t('myWorkTable.auditTrailPanel.minutesAgo', { value: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('myWorkTable.auditTrailPanel.hoursAgo', { value: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('myWorkTable.auditTrailPanel.daysAgo', { value: days });
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
      <span className="font-medium text-c-text-muted">{change.fieldName || change.fieldId}</span>
      <div className="flex items-start gap-1.5 mt-0.5">
        <span className="inline-block px-1.5 py-0.5 rounded bg-danger-500/10 text-danger-600 dark:text-danger-400 line-through max-w-[45%] truncate">
          {formatValue(change.oldValue)}
        </span>
        <span className="text-c-text-secondary mt-0.5">→</span>
        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 max-w-[45%] truncate">
          {formatValue(change.newValue)}
        </span>
      </div>
    </div>
  );
});

const RevisionItem = React.memo(function RevisionItem({
  revision,
}: {
  revision: RecordRevision;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasChanges = revision.changes.length > 0;

  return (
    <div className="px-3 py-2.5 border-b border-c-border-subtle last:border-0">
      <div
        className={`flex items-start gap-2.5 ${hasChanges ? 'cursor-pointer' : ''}`}
        onClick={() => hasChanges && setExpanded((p) => !p)}
      >
        <div className="w-7 h-7 rounded-full bg-c-border-subtle flex items-center justify-center text-[10px] font-bold text-c-text-secondary flex-shrink-0 mt-0.5">
          {getInitials(revision.userName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-c-text truncate">
              {revision.userName || t('myWorkTable.auditTrailPanel.unknown')}
            </span>
            <span
              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${ACTION_STYLES[revision.action] ?? 'bg-c-surface-raised text-c-text-muted'}`}
            >
              {revision.action}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-c-text-secondary">
            <Clock size={10} />
            {relativeTime(revision.timestamp, t)}
            {hasChanges && (
              <span className="ml-1 text-c-text-secondary">
                ({revision.changes.length} {t('myWorkTable.auditTrailPanel.changes')})
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
  isPlatformTable = false,
}) => {
  const { t } = useTranslation();

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
      if (!recordId || !isPlatformTable) return;
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
    [recordId, tableId, offset, isPlatformTable]
  );

  useEffect(() => {
    if (open && recordId && isPlatformTable) {
      setRevisions([]);
      setOffset(0);
      setHasMore(true);
      fetchRevisions(true);
    }
  }, [open, recordId, isPlatformTable]);

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

  if (!isPlatformTable) {
    return (
      <div className="w-80 border-l border-c-border-subtle bg-c-surface flex flex-col h-full overflow-hidden flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-c-border-subtle">
          <Clock size={14} className="text-c-text-muted" />
          <span className="text-xs font-bold text-c-text flex-1">
            {t('myWorkTable.auditTrailPanel.revisionHistory')}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded text-c-text-secondary hover:text-c-text-secondary transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <EmptyState
            variant="forbidden"
            icon={Lock}
            compact
            title={t('myWorkTable.auditTrailPanel.notAvailableForThisTable')}
            description={
              t('myWorkTable.auditTrailPanel.revisionHistoryIsOnlyAvailable')
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-c-border-subtle bg-c-surface flex flex-col h-full overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-c-border-subtle">
        <Clock size={14} className="text-c-text-muted" />
        <span className="text-xs font-bold text-c-text flex-1">
          {t('myWorkTable.auditTrailPanel.revisionHistory')}
        </span>
        <button
          onClick={() => setShowFilters((p) => !p)}
          className={`p-1 rounded transition-colors ${showFilters ? 'bg-c-accent-soft text-c-accent' : 'text-c-text-secondary hover:text-c-text-secondary'}`}
        >
          <Filter size={12} />
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded text-c-text-secondary hover:text-c-text-secondary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-3 py-2 border-b border-c-border-subtle space-y-2">
          <input
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder={t('myWorkTable.auditTrailPanel.filterByUser')}
            className="w-full h-7 px-2 rounded-lg text-[11px] bg-c-surface-raised border border-c-border-subtle outline-none focus:ring-2 focus:ring-blue-500/30 text-c-text"
          />
          <div className="flex gap-1">
            {['created', 'updated', 'deleted'].map((a) => (
              <button
                key={a}
                onClick={() => setFilterAction(filterAction === a ? null : a)}
                className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full transition-colors ${
                  filterAction === a
                    ? ACTION_STYLES[a]
                    : 'bg-c-surface-raised text-c-text-secondary'
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
          <EmptyState
            variant="new"
            icon={Clock}
            compact
            title={t('myWorkTable.auditTrailPanel.selectARecord')}
            description={
              t('myWorkTable.auditTrailPanel.selectARecordToView')
            }
          />
        ) : loading && revisions.length === 0 ? (
          <LoadingState template="list" rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            variant="new"
            icon={Clock}
            compact
            title={t('myWorkTable.auditTrailPanel.noRevisionHistory')}
            description={
              t('myWorkTable.auditTrailPanel.changesToThisRecordWill')
            }
          />
        ) : (
          <>
            {filtered.map((rev) => (
              <RevisionItem key={rev.id} revision={rev} />
            ))}
            {hasMore && (
              <div className="px-3 py-3">
                <button
                  onClick={() => fetchRevisions(false)}
                  disabled={loading}
                  className="w-full py-2 rounded-lg text-[11px] font-semibold text-c-accent bg-c-accent-soft hover:bg-c-accent-soft transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  {t('myWorkTable.auditTrailPanel.loadMore')}
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
