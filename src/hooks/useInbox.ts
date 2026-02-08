import { useCallback, useEffect, useState } from 'react';

import { Api } from '../services/api';

interface InboxItem {
  id: string;
  title: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  triaged: boolean;
  createdAt: string;
}

interface UseInboxOptions {
  autoLoad?: boolean;
  includeTriaged?: boolean;
  limit?: number;
}

export const useInbox = (options: UseInboxOptions = {}) => {
  const { autoLoad = true, includeTriaged = false, limit = 50 } = options;
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await Api.get(`/api/inbox?includeTriaged=${includeTriaged}&limit=${limit}`);
      const data = response as { items: InboxItem[]; summary: unknown };
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load inbox'));
    } finally {
      setLoading(false);
    }
  }, [includeTriaged, limit]);

  useEffect(() => {
    if (autoLoad) {
      loadInbox();
    }
  }, [autoLoad, loadInbox]);

  const triageItem = useCallback(async (itemId: string, action: string) => {
    try {
      await Api.post(`/api/inbox/${itemId}/triage`, { action });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to triage item'));
    }
  }, []);

  const bulkTriage = useCallback(async (itemIds: string[], action: string) => {
    try {
      await Api.post('/api/inbox/bulk-triage', { itemIds, action });
      setItems((prev) => prev.filter((i) => !itemIds.includes(i.id)));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to bulk triage'));
    }
  }, []);

  const selectItem = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const totalCount = items.length;
  const criticalCount = items.filter((i) => i.priority === 'critical').length;
  const hasSelection = selectedIds.size > 0;

  return {
    items,
    loading,
    error,
    selectedIds,
    totalCount,
    criticalCount,
    hasSelection,
    loadInbox,
    triageItem,
    bulkTriage,
    selectItem,
    selectAll,
    clearSelection,
    toggleSelection,
  };
};

export default useInbox;
