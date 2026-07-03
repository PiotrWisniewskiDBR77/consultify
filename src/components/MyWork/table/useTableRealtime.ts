/**
 * Table Platform real-time collaboration hook.
 * Connects to the /table-platform Socket.IO namespace for presence, cell cursors,
 * and live record/schema change broadcasts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface PresenceInfo {
  userId: string;
  userName: string;
  tableId: string;
  recordId?: string;
  fieldId?: string;
  color: string;
  lastSeen: number;
}

interface UseTableRealtimeOptions {
  tableId: string | null;
  userId: string;
  userName: string;
  onRecordCreated?: (record: unknown) => void;
  onRecordUpdated?: (data: { recordId: string; data: unknown }) => void;
  onRecordDeleted?: (data: { recordId: string }) => void;
  onSchemaChanged?: (change: unknown) => void;
  onCellUpdated?: (data: unknown) => void;
}

export type TableRealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded';

export function useTableRealtime(options: UseTableRealtimeOptions) {
  const {
    tableId,
    userId,
    userName,
    onRecordCreated,
    onRecordUpdated,
    onRecordDeleted,
    onSchemaChanged,
    onCellUpdated,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const [presence, setPresence] = useState<PresenceInfo[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<TableRealtimeConnectionState>('idle');

  const callbacksRef = useRef({
    onRecordCreated,
    onRecordUpdated,
    onRecordDeleted,
    onSchemaChanged,
    onCellUpdated,
  });
  callbacksRef.current = {
    onRecordCreated,
    onRecordUpdated,
    onRecordDeleted,
    onSchemaChanged,
    onCellUpdated,
  };

  useEffect(() => {
    if (!tableId) {
      setPresence([]);
      setConnected(false);
      setConnectionState('idle');
      hasConnectedOnceRef.current = false;
      return;
    }

    let disposed = false;
    setConnected(false);
    setConnectionState('connecting');

    // #101 Grupa 0 — the namespace now rejects anonymous connections; identity
    // comes from the verified JWT (client-sent userId is cosmetic only).
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
    const socket = io('/table-platform', {
      auth: { token, userId, userName },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (disposed) return;
      setConnected(true);
      setConnectionState('connected');
      hasConnectedOnceRef.current = true;
      socket.emit('join:table', tableId);
    });

    socket.on('disconnect', () => {
      if (disposed) return;
      setConnected(false);
      setPresence([]);
      setConnectionState(hasConnectedOnceRef.current ? 'reconnecting' : 'degraded');
    });
    socket.on('connect_error', () => {
      if (disposed) return;
      setConnected(false);
      setConnectionState(hasConnectedOnceRef.current ? 'reconnecting' : 'degraded');
    });
    socket.io.on('reconnect_attempt', () => {
      if (disposed) return;
      setConnected(false);
      setConnectionState('reconnecting');
    });
    socket.io.on('reconnect_failed', () => {
      if (disposed) return;
      setConnected(false);
      setConnectionState('degraded');
    });
    socket.on('presence:update', (data: PresenceInfo[]) => setPresence(data));
    socket.on('record:created', (record: unknown) =>
      callbacksRef.current.onRecordCreated?.(record)
    );
    socket.on('record:updated', (data: { recordId: string; data: unknown }) =>
      callbacksRef.current.onRecordUpdated?.(data)
    );
    socket.on('record:deleted', (data: { recordId: string }) =>
      callbacksRef.current.onRecordDeleted?.(data)
    );
    socket.on('schema:changed', (change: unknown) =>
      callbacksRef.current.onSchemaChanged?.(change)
    );
    socket.on('cell:updated', (data: unknown) => callbacksRef.current.onCellUpdated?.(data));

    return () => {
      disposed = true;
      setConnected(false);
      socket.io.off('reconnect_attempt');
      socket.io.off('reconnect_failed');
      socket.emit('leave:table', tableId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tableId, userId, userName]);

  const emitCellFocus = useCallback(
    (recordId: string, fieldId: string) => {
      if (socketRef.current && tableId) {
        socketRef.current.emit('focus:cell', { tableId, recordId, fieldId });
      }
    },
    [tableId]
  );

  const emitCellUpdate = useCallback(
    (recordId: string, fieldId: string, value: unknown) => {
      if (socketRef.current && tableId) {
        socketRef.current.emit('cell:update', {
          tableId,
          recordId,
          fieldId,
          value,
          userId,
          timestamp: Date.now(),
        });
      }
    },
    [tableId, userId]
  );

  return { presence, connected, connectionState, emitCellFocus, emitCellUpdate };
}
