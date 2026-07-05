/**
 * Presence indicator components for Table Platform real-time collaboration.
 * Shows avatar bubbles for users viewing the same table, and per-cell cursor highlights.
 */

import { Loader2, WifiOff } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TableRealtimeConnectionState } from './useTableRealtime';

interface PresenceInfo {
  userId: string;
  userName: string;
  color: string;
  recordId?: string;
  fieldId?: string;
}

interface PresenceIndicatorsProps {
  presence: PresenceInfo[];
  currentUserId: string;
  connectionState?: TableRealtimeConnectionState;
  enabled?: boolean;
}

interface TableRealtimeStatusIndicatorProps {
  connectionState: TableRealtimeConnectionState;
  enabled?: boolean;
}

export const TableRealtimeStatusIndicator: React.FC<TableRealtimeStatusIndicatorProps> = ({
  connectionState,
  enabled = true,
}) => {
  const { t } = useTranslation();

  if (!enabled || connectionState === 'idle' || connectionState === 'connected') {
    return null;
  }

  const isConnecting = connectionState === 'connecting';
  const isReconnecting = connectionState === 'reconnecting';

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${
        isConnecting || isReconnecting
          ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-100'
          : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100'
      }`}
      aria-label={
        isConnecting
          ? t('collaboration.realtimeConnecting', 'Realtime connecting')
          : isReconnecting
            ? t('collaboration.realtimeReconnecting', 'Realtime reconnecting')
            : t('collaboration.realtimeDegraded', 'Realtime degraded')
      }
    >
      {isConnecting || isReconnecting ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <WifiOff size={11} />
      )}
      <span>
        {isConnecting
          ? t('collaboration.realtimeConnecting', 'Realtime connecting')
          : isReconnecting
            ? t('collaboration.realtimeReconnecting', 'Realtime reconnecting')
            : t('collaboration.realtimeDegraded', 'Realtime degraded')}
      </span>
      {!isConnecting && (
        <span className="text-[9px] font-medium text-amber-700/90 dark:text-amber-200/80">
          {isReconnecting
            ? t('collaboration.recoveryInProgress', 'Recovery in progress')
            : t('collaboration.singleUserMode', 'Single-user mode')}
        </span>
      )}
    </div>
  );
};

export const PresenceIndicators: React.FC<PresenceIndicatorsProps> = ({
  presence,
  currentUserId,
  connectionState = 'connected',
  enabled = true,
}) => {
  const others = presence.filter((p) => p.userId !== currentUserId);
  if (others.length === 0 && (connectionState === 'idle' || connectionState === 'connected')) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 px-2">
      <TableRealtimeStatusIndicator connectionState={connectionState} enabled={enabled} />
      {others.slice(0, 5).map((p) => (
        <div
          key={p.userId}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white"
          style={{ backgroundColor: p.color }}
          title={p.userName}
        >
          {p.userName.charAt(0).toUpperCase()}
        </div>
      ))}
      {others.length > 5 && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-c-text-muted text-c-bg">
          +{others.length - 5}
        </div>
      )}
    </div>
  );
};

interface CellPresenceProps {
  recordId: string;
  fieldId: string;
  presence: PresenceInfo[];
  currentUserId: string;
}

export const CellPresenceIndicator: React.FC<CellPresenceProps> = ({
  recordId,
  fieldId,
  presence,
  currentUserId,
}) => {
  const editing = presence.find(
    (p) => p.userId !== currentUserId && p.recordId === recordId && p.fieldId === fieldId
  );
  if (!editing) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none border-2 rounded"
      style={{ borderColor: editing.color }}
    >
      <span
        className="absolute -top-5 left-0 text-[10px] px-1 rounded text-white whitespace-nowrap"
        style={{ backgroundColor: editing.color }}
      >
        {editing.userName}
      </span>
    </div>
  );
};
