import { useCallback, useMemo } from 'react';

import { offlineQueue } from './OfflineQueue';

export function useOfflineAware(tableId: string) {
  const createRecord = useCallback(
    async (data: Record<string, unknown>) => {
      if (navigator.onLine) {
        const resp = await fetch(`/api/table-platform/tables/${tableId}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
        return resp.json() as Promise<Record<string, unknown>>;
      }

      const tempId = crypto.randomUUID();
      offlineQueue.enqueue({ type: 'create', tableId, recordId: tempId, data });
      return { id: tempId, data, _offline: true };
    },
    [tableId]
  );

  const updateRecord = useCallback(
    async (recordId: string, data: Record<string, unknown>) => {
      if (navigator.onLine) {
        const resp = await fetch(`/api/table-platform/records/${recordId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
        return resp.json() as Promise<Record<string, unknown>>;
      }

      offlineQueue.enqueue({ type: 'update', tableId, recordId, data });
      return { id: recordId, data, _offline: true };
    },
    [tableId]
  );

  const deleteRecord = useCallback(
    async (recordId: string) => {
      if (navigator.onLine) {
        await fetch(`/api/table-platform/records/${recordId}`, { method: 'DELETE' });
      } else {
        offlineQueue.enqueue({ type: 'delete', tableId, recordId });
      }
    },
    [tableId]
  );

  return useMemo(
    () => ({ createRecord, updateRecord, deleteRecord }),
    [createRecord, updateRecord, deleteRecord]
  );
}
