import React, { useCallback, useEffect, useState } from 'react';

import { offlineQueue } from './OfflineQueue';

function formatRelativeTime(ts: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(offlineQueue.getPendingCount());
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(offlineQueue.getLastSyncTime());
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsub = offlineQueue.subscribe((queue) => {
      setPendingCount(queue.length);
    });

    const unsubSync = offlineQueue.subscribeSyncTime((ts) => {
      setLastSync(ts);
    });

    // Refresh relative time display every 30s
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
      unsubSync();
      clearInterval(timer);
    };
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await offlineQueue.sync();
    } finally {
      setSyncing(false);
    }
  }, []);

  if (isOnline && pendingCount === 0) return null;

  const syncLabel = lastSync ? formatRelativeTime(lastSync) : null;

  return (
    <div
      className={`fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium z-50 max-w-[90vw] ${
        isOnline
          ? 'bg-c-warning text-c-warning border border-c-warning bg-c-warning text-c-warning border-c-warning'
          : 'bg-c-danger text-c-danger border border-c-danger bg-c-danger text-c-danger border-c-danger'
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-c-warning' : 'bg-c-danger animate-pulse'}`}
      />
      {!isOnline && <span>Offline</span>}
      {pendingCount > 0 && (
        <>
          <span className="whitespace-nowrap">
            {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}
          </span>
          {isOnline && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="ml-1 px-2 py-0.5 bg-c-warning text-c-text rounded text-xs hover:bg-c-warning disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          )}
        </>
      )}
      {syncLabel && (
        <span
          className="text-[10px] opacity-60 whitespace-nowrap"
          title={lastSync ? new Date(lastSync).toLocaleString() : undefined}
        >
          Last sync: {syncLabel}
        </span>
      )}
    </div>
  );
};

export default OfflineIndicator;
