/**
 * useAuditTrail — fetches and manages audit events for table platform entities.
 */
import { useCallback, useEffect, useState } from 'react';

import i18n from '@/i18n';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

export interface AuditEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_id?: string;
  before_data?: Record<string, unknown>;
  after_data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface UseAuditTrailOpts {
  entityType?: string;
  entityId?: string;
  tableId?: string;
  enabled: boolean;
  pageSize?: number;
}

export interface UseAuditTrailReturn {
  events: AuditEvent[];
  total: number;
  loading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  hasMore: boolean;
}

export function useAuditTrail(opts: UseAuditTrailOpts): UseAuditTrailReturn {
  const { entityType, entityId, tableId, enabled, pageSize = 20 } = opts;
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const fetchEvents = useCallback(
    async (reset: boolean) => {
      if (!enabled) return;
      const currentOffset = reset ? 0 : offset;
      setLoading(true);
      setError(null);
      try {
        let result: any;
        if (tableId) {
          result = await TablePlatformApi.getTableAuditTrail(tableId, {
            limit: pageSize,
            offset: currentOffset,
          });
        } else if (entityType && entityId) {
          result = await TablePlatformApi.getAuditTrail(entityType, entityId, {
            limit: pageSize,
            offset: currentOffset,
          });
        } else {
          return;
        }

        const newEvents = (result?.events ?? []) as AuditEvent[];
        if (reset) {
          setEvents(newEvents);
          setOffset(newEvents.length);
        } else {
          setEvents((prev) => [...prev, ...newEvents]);
          setOffset((prev) => prev + newEvents.length);
        }
        setTotal(Number(result?.total ?? 0));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : i18n.t('ideas.table.failedToLoadAuditTrail', 'Failed to load audit trail')
        );
      } finally {
        setLoading(false);
      }
    },
    [enabled, entityType, entityId, tableId, pageSize, offset]
  );

  useEffect(() => {
    if (enabled && (tableId || (entityType && entityId))) {
      fetchEvents(true);
    }
  }, [enabled, tableId, entityType, entityId]); // eslint-disable-line react-hooks/exhaustive-deps -- fetchEvents intentionally excluded to avoid loops

  const loadMore = useCallback(async () => {
    await fetchEvents(false);
  }, [fetchEvents]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await fetchEvents(true);
  }, [fetchEvents]);

  const hasMore = events.length < total;

  return {
    events,
    total,
    loading,
    error,
    loadMore,
    refresh,
    hasMore,
  };
}
