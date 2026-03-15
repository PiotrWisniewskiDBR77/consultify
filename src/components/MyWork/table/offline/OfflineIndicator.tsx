import React, { useState, useEffect } from 'react';
import { offlineQueue } from './OfflineQueue';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(offlineQueue.getPendingCount());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsub = offlineQueue.subscribe((queue) => {
      setPendingCount(queue.length);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await offlineQueue.sync();
    } finally {
      setSyncing(false);
    }
  };

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium z-50 ${
      isOnline
        ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
        : 'bg-red-50 text-red-800 border border-red-200'
    }`}>
      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
      {!isOnline && <span>Offline</span>}
      {pendingCount > 0 && (
        <>
          <span>{pendingCount} pending change{pendingCount !== 1 ? 's' : ''}</span>
          {isOnline && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="ml-1 px-2 py-0.5 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
