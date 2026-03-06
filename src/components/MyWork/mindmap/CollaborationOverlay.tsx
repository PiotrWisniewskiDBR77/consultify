/**
 * CollaborationOverlay — Multi-cursor + presence + shared session state.
 * Connects via authenticated WebSocket; gracefully falls back to single-user mode.
 */
import { Lock, Users } from 'lucide-react';
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

interface SessionState {
  lockedNodes: Record<string, string>; // nodeId -> userId
  selections: Record<string, string[]>; // userId -> nodeIds
  viewportSync: boolean;
  lastActivity: number;
}

interface CollaborationOverlayProps {
  ideaId: string;
  currentUserId: string;
  currentUserName: string;
}

const CURSOR_COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899'];

function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

function useCollaboration(ideaId: string, userId: string, userName: string) {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);

  const connect = useCallback(() => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/ws/collab/${ideaId}?token=${encodeURIComponent(token)}`
      );

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempt.current = 0;
        ws.send(JSON.stringify({ type: 'join', userId, userName }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'presence':
              setUsers(msg.users || []);
              break;
            case 'session_state':
              setSessionState({
                lockedNodes: msg.lockedNodes || {},
                selections: msg.selections || {},
                viewportSync: msg.viewportSync ?? false,
                lastActivity: msg.lastActivity || 0,
              });
              break;
            case 'lock_rejected':
              break;
            default:
              break;
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30_000);
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
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
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendCursor = useCallback((x: number, y: number, activeNodeId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor', userId, x, y, activeNodeId }));
    }
  }, [userId]);

  const lockNode = useCallback((nodeId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'lock_node', nodeId }));
    }
  }, []);

  const unlockNode = useCallback((nodeId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unlock_node', nodeId }));
    }
  }, []);

  const selectNodes = useCallback((nodeIds: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'select_nodes', nodeIds }));
    }
  }, []);

  return { connected, users, sessionState, sendCursor, lockNode, unlockNode, selectNodes };
}

export const CollaborationOverlay: React.FC<CollaborationOverlayProps> = ({
  ideaId,
  currentUserId,
  currentUserName,
}) => {
  const { connected, users, sessionState } = useCollaboration(ideaId, currentUserId, currentUserName);

  const otherUsers = useMemo(
    () => users.filter((u) => u.id !== currentUserId && Date.now() - u.lastSeen < 30000),
    [currentUserId, users]
  );

  const userColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => { map[u.id] = u.color; });
    return map;
  }, [users]);

  const lockedNodeEntries = useMemo(() => {
    if (!sessionState?.lockedNodes) return [];
    return Object.entries(sessionState.lockedNodes).filter(([, uid]) => uid !== currentUserId);
  }, [sessionState, currentUserId]);

  const otherSelections = useMemo(() => {
    if (!sessionState?.selections) return [];
    return Object.entries(sessionState.selections)
      .filter(([uid]) => uid !== currentUserId)
      .flatMap(([uid, nodeIds]) => nodeIds.map((nid) => ({ userId: uid, nodeId: nid })));
  }, [sessionState, currentUserId]);

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

      {/* Locked node indicators */}
      {lockedNodeEntries.map(([nodeId, uid]) => (
        <div
          key={`lock-${nodeId}`}
          className="absolute z-40 pointer-events-none"
          data-locked-node={nodeId}
        >
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap"
            style={{ backgroundColor: userColorMap[uid] || '#94a3b8' }}
          >
            <Lock size={8} />
            {users.find((u) => u.id === uid)?.name || 'User'}
          </div>
        </div>
      ))}

      {/* Other users' selections (visual indicator) */}
      {otherSelections.map(({ userId: uid, nodeId }) => (
        <div
          key={`sel-${uid}-${nodeId}`}
          className="absolute z-30 pointer-events-none rounded ring-2"
          style={{
            borderColor: userColorMap[uid] || '#94a3b8',
            boxShadow: `0 0 0 2px ${userColorMap[uid] || '#94a3b8'}`,
          }}
          data-selected-node={nodeId}
          data-selected-by={uid}
        />
      ))}

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
