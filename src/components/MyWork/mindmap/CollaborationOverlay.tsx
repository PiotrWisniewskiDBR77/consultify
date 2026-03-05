/**
 * CollaborationOverlay — Frontend stub for multi-cursor + presence indicators.
 * Attempts WebSocket connection; gracefully falls back to single-user mode.
 */
import { Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
  activeNodeId?: string;
  lastSeen: number;
}

interface CollaborationOverlayProps {
  ideaId: string;
  currentUserId: string;
  currentUserName: string;
}

const CURSOR_COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899'];

function useCollaboration(ideaId: string, userId: string, userName: string) {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/collab/${ideaId}`);

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'join', userId, userName }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'presence') {
            setUsers(msg.users || []);
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      setConnected(false);
    }
  }, [ideaId, userId, userName]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendCursor = useCallback((x: number, y: number, activeNodeId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor', userId, x, y, activeNodeId }));
    }
  }, [userId]);

  return { connected, users, sendCursor };
}

export const CollaborationOverlay: React.FC<CollaborationOverlayProps> = ({
  ideaId,
  currentUserId,
  currentUserName,
}) => {
  const { connected, users } = useCollaboration(ideaId, currentUserId, currentUserName);

  const otherUsers = useMemo(
    () => users.filter((u) => u.id !== currentUserId && Date.now() - u.lastSeen < 30000),
    [currentUserId, users]
  );

  if (!connected && otherUsers.length === 0) return null;

  return (
    <>
      {/* Presence badge */}
      {connected && otherUsers.length > 0 && (
        <div className="absolute top-3 right-3 z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm shadow-lg border border-slate-200/30 dark:border-navy-700/30">
          <Users size={12} className="text-emerald-500" />
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{otherUsers.length + 1}</span>
          <div className="flex -space-x-1.5">
            {otherUsers.slice(0, 4).map((u, idx) => (
              <div
                key={u.id}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white border-2 border-white dark:border-navy-900"
                style={{ backgroundColor: CURSOR_COLORS[idx % CURSOR_COLORS.length] }}
                title={u.name}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remote cursors */}
      {otherUsers.map((u, idx) => (
        <div
          key={u.id}
          className="absolute pointer-events-none z-50 transition-all duration-200"
          style={{ left: u.cursorX, top: u.cursorY }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
            <path d="M0 0L16 12L8 12L4 20L0 0Z" fill={CURSOR_COLORS[idx % CURSOR_COLORS.length]} />
          </svg>
          <div
            className="ml-4 -mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap"
            style={{ backgroundColor: CURSOR_COLORS[idx % CURSOR_COLORS.length] }}
          >
            {u.name}
          </div>
        </div>
      ))}
    </>
  );
};

export default CollaborationOverlay;
