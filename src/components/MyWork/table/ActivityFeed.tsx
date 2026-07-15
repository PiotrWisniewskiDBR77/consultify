/**
 * ActivityFeed — Table-level activity stream.
 *
 * Groups events by time window (Today, Yesterday, This week, Earlier),
 * supports compact/expanded modes, and polls for real-time updates.
 */
import type { TFunction } from 'i18next';
import { Activity, ChevronRight, Clock, Edit3, Lock, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/shared/states';

import { Api } from '../../../services/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorName?: string;
  details: Record<string, unknown>;
  timestamp: string;
  timeGroup?: string;
}

interface ActivityFeedProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  compact?: boolean;
  onEventClick?: (entityId: string) => void;
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

const POLL_INTERVAL = 30_000;

const TIME_GROUP_ORDER = ['last_hour', 'today', 'yesterday', 'this_week', 'earlier'] as const;

function timeGroupLabel(group: string, t: TFunction): string {
  const keys: Record<string, string> = {
    last_hour: 'myWorkTable.activityFeed.timeGroupLastHour',
    today: 'myWorkTable.activityFeed.timeGroupToday',
    yesterday: 'myWorkTable.activityFeed.timeGroupYesterday',
    this_week: 'myWorkTable.activityFeed.timeGroupThisWeek',
    earlier: 'myWorkTable.activityFeed.timeGroupEarlier',
  };
  const key = keys[group];
  return key ? t(key) : group;
}

function relativeTime(ts: string, t: TFunction): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('myWorkTable.activityFeed.justNow');
  if (mins < 60) return t('myWorkTable.activityFeed.minutesAgo', { value: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('myWorkTable.activityFeed.hoursAgo', { value: hours });
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function eventIcon(eventType: string) {
  switch (eventType) {
    case 'create':
      return <Plus size={12} className="text-emerald-500" />;
    case 'delete':
      return <Trash2 size={12} className="text-danger-500" />;
    default:
      return <Edit3 size={12} className="text-blue-500" />;
  }
}

function eventLabel(event: AuditEvent, t: TFunction): string {
  const actor = event.actorName || t('myWorkTable.activityFeed.someone');
  const entity =
    event.entityType === 'record' ? t('myWorkTable.activityFeed.recordNoun') : event.entityType;
  const actionKeys: Record<string, string> = {
    create: 'myWorkTable.activityFeed.actionCreated',
    update: 'myWorkTable.activityFeed.actionUpdated',
    delete: 'myWorkTable.activityFeed.actionDeleted',
  };
  const actionKey = actionKeys[event.eventType];
  const action = actionKey ? t(actionKey) : event.eventType;
  const shortId = event.entityId.slice(0, 8);
  return `${actor} ${action} ${entity} ${shortId}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

const EventItem = React.memo(function EventItem({
  event,
  compact,
  onClick,
}: {
  event: AuditEvent;
  compact: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-c-surface-raised transition-colors group"
    >
      <div className="w-6 h-6 rounded-full bg-c-surface-raised flex items-center justify-center flex-shrink-0 mt-0.5">
        {eventIcon(event.eventType)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-c-text leading-snug truncate">{eventLabel(event, t)}</p>
        {!compact && (
          <span className="text-[10px] text-c-text-secondary flex items-center gap-1 mt-0.5">
            <Clock size={9} />
            {relativeTime(event.timestamp, t)}
          </span>
        )}
      </div>
      {onClick && (
        <ChevronRight
          size={12}
          className="text-c-text-secondary opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0"
        />
      )}
    </button>
  );
});

// ── Main Component ───────────────────────────────────────────────────────────

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  open,
  onClose,
  tableId,
  compact = false,
  onEventClick,
  isPlatformTable = false,
}) => {
  const { t } = useTranslation();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvents = useCallback(
    async (since?: string) => {
      if (!tableId || !isPlatformTable) return;
      setLoading(true);
      try {
        let path = `/table-platform/tables/${tableId}/audit?limit=50`;
        if (since) path += `&since=${encodeURIComponent(since)}`;
        const json = await (Api as any).get(path);
        const raw: any[] = json.events ?? json;
        const data: AuditEvent[] = raw.map((r: any) => ({
          id: r.id,
          eventType: r.event_type ?? r.eventType,
          entityType: r.entity_type ?? r.entityType,
          entityId: r.entity_id ?? r.entityId,
          actorId: r.actor_id ?? r.actorId,
          actorName: r.actor_name ?? r.actorName ?? r.metadata?.actorName,
          details: r.metadata ?? r.details ?? {},
          timestamp: r.created_at ?? r.timestamp,
          timeGroup: r.time_group ?? r.timeGroup,
        }));
        if (since && data.length > 0) {
          setEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newItems = data.filter((e) => !existingIds.has(e.id));
            return [...newItems, ...prev];
          });
        } else if (!since) {
          setEvents(data);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    },
    [tableId, isPlatformTable]
  );

  useEffect(() => {
    if (open && tableId && isPlatformTable) {
      fetchEvents();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, tableId, isPlatformTable]);

  useEffect(() => {
    if (!open || !tableId || !isPlatformTable) return;
    pollRef.current = setInterval(() => {
      const latest = events[0]?.timestamp;
      fetchEvents(latest);
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, tableId, isPlatformTable, events]);

  if (!open) return null;

  if (!isPlatformTable) {
    return (
      <div
        className={`${compact ? 'w-64' : 'w-80'} border-l border-c-border-subtle bg-c-surface flex flex-col h-full overflow-hidden flex-shrink-0`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-c-border-subtle">
          <Activity size={14} className="text-c-text-muted" />
          <span className="text-xs font-bold text-c-text flex-1">
            {t('myWorkTable.activityFeed.title')}
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
            title={t('myWorkTable.activityFeed.notAvailableForTable')}
            description={t('myWorkTable.activityFeed.historyAvailableOnlyForPlatform')}
          />
        </div>
      </div>
    );
  }

  const grouped = new Map<string, AuditEvent[]>();
  for (const ev of events) {
    const group = ev.timeGroup || 'earlier';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(ev);
  }

  return (
    <div
      className={`${compact ? 'w-64' : 'w-80'} border-l border-c-border-subtle bg-c-surface flex flex-col h-full overflow-hidden flex-shrink-0`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-c-border-subtle">
        <Activity size={14} className="text-c-text-muted" />
        <span className="text-xs font-bold text-c-text flex-1">
          {t('myWorkTable.activityFeed.title')}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded text-c-text-secondary hover:text-c-text-secondary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && events.length === 0 ? (
          <LoadingState template="list" rows={5} />
        ) : events.length === 0 ? (
          <EmptyState
            variant="new"
            icon={Activity}
            compact
            title={t('myWorkTable.activityFeed.noActivityYet')}
            description={t('myWorkTable.activityFeed.changesWillAppearHere')}
          />
        ) : (
          TIME_GROUP_ORDER.map((group) => {
            const items = grouped.get(group);
            if (!items || items.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-c-text-secondary bg-c-surface-raised sticky top-0 z-[1]">
                  {timeGroupLabel(group, t)}
                </div>
                {items.map((ev) => (
                  <EventItem
                    key={ev.id}
                    event={ev}
                    compact={compact}
                    onClick={onEventClick ? () => onEventClick(ev.entityId) : undefined}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
