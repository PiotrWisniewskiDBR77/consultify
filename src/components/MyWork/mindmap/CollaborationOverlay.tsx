/**
 * CollaborationOverlay — Multi-cursor + presence + shared session state.
 * Connects via authenticated WebSocket and surfaces degraded single-user mode.
 */
import { Lock, Users, WifiOff } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
  activeNodeId?: string;
  lastSeen: number;
}

export interface CollaborationSessionState {
  lockedNodes: Record<string, string>; // nodeId -> userId
  selections: Record<string, string[]>; // userId -> nodeIds
  viewportSync: boolean;
  lastActivity: number;
}

type CollaborationConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded';

interface CollaborationOverlayProps {
  ideaId: string;
  currentUserId: string;
  currentUserName: string;
  selectedNodeIds?: string[];
  onSessionStateChange?: (state: CollaborationSessionState | null) => void;
  onRegisterSend?: (sendFn: (msg: any) => void) => void;
}

// Presence cursor colors = DATA (per-user identity). Canonical identity palette.
const CURSOR_COLORS = [
  'var(--c-tag-1)',
  'var(--c-tag-2)',
  'var(--c-tag-4)',
  'var(--c-tag-6)',
  'var(--c-tag-9)',
  'var(--c-tag-11)',
];
const STALE_THRESHOLD_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
const CURSOR_THROTTLE_MS = 80;
const OVERLAY_SYNC_INTERVAL_MS = 250;

interface NodeOverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

function isE2EToken(token: string | null): boolean {
  if (!token) return false;
  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(window.atob(padded));
    return parsed?.e2e === true;
  } catch {
    return false;
  }
}

function escapeDomSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}

function areNodeRectsEqual(
  left: Record<string, NodeOverlayRect>,
  right: Record<string, NodeOverlayRect>
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => {
    const leftRect = left[key];
    const rightRect = right[key];

    return (
      rightRect &&
      leftRect.left === rightRect.left &&
      leftRect.top === rightRect.top &&
      leftRect.width === rightRect.width &&
      leftRect.height === rightRect.height
    );
  });
}

function useCollaboration(
  ideaId: string,
  userId: string,
  userName: string,
  selectedNodeIds: string[] = []
) {
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<CollaborationConnectionState>('idle');
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const [sessionState, setSessionState] = useState<CollaborationSessionState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttempt = useRef(0);
  const lockedNodeIdsRef = useRef<string[]>([]);
  const shouldReconnectRef = useRef(true);

  const normalizedSelection = useMemo(
    () => Array.from(new Set(selectedNodeIds.filter(Boolean))),
    [selectedNodeIds]
  );

  const sendMessage = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const connect = useCallback(() => {
    try {
      if (!shouldReconnectRef.current) return;
      const token = getAuthToken();
      if (!token || !ideaId || !userId) {
        setConnectionState('idle');
        return;
      }
      if (isE2EToken(token)) {
        setConnectionState('idle');
        return;
      }

      setConnectionState(reconnectAttempt.current > 0 ? 'reconnecting' : 'connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/ws/collab/${ideaId}?token=${encodeURIComponent(token)}`
      );

      ws.onopen = () => {
        setConnected(true);
        setConnectionState('connected');
        reconnectAttempt.current = 0;
        sendMessage({ type: 'join', userId, userName });
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
            case 'graph_patch':
              window.dispatchEvent(
                new CustomEvent('idea-collab-graph-patch', { detail: { ...msg, ideaId } })
              );
              break;
            case 'graph_version':
              // DP-3 (T6): canonical version confirmed by the gateway persist.
              // Consumed ref-only (useIdeaMapSync / useMindMapPersistence) —
              // silent adoption, never a re-hydration or canvas remount.
              window.dispatchEvent(
                new CustomEvent('idea-collab-graph-version', { detail: { ...msg, ideaId } })
              );
              break;
            case 'graph_sync_request':
              window.dispatchEvent(new CustomEvent('idea-collab-sync-request', { detail: msg }));
              break;
            case 'graph_full_state':
              window.dispatchEvent(new CustomEvent('idea-collab-full-state', { detail: msg }));
              break;
            default:
              break;
          }
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setUsers([]);
        setSessionState(null);
        wsRef.current = null;
        if (heartbeatTimer.current) {
          clearInterval(heartbeatTimer.current);
          heartbeatTimer.current = null;
        }
        if (!shouldReconnectRef.current) {
          setConnectionState('degraded');
          return;
        }
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30_000);
        reconnectAttempt.current += 1;
        setConnectionState('reconnecting');
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      setConnected(false);
      setConnectionState('degraded');
    }
  }, [ideaId, sendMessage, userId, userName]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    if (!connected) return;

    heartbeatTimer.current = setInterval(() => {
      sendMessage({ type: 'heartbeat' });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
    };
  }, [connected, sendMessage]);

  const sendCursor = useCallback(
    (x: number, y: number, activeNodeId?: string) => {
      sendMessage({ type: 'cursor', userId, x, y, activeNodeId });
    },
    [sendMessage, userId]
  );

  const lockNode = useCallback(
    (nodeId: string) => {
      sendMessage({ type: 'lock_node', nodeId });
    },
    [sendMessage]
  );

  const unlockNode = useCallback(
    (nodeId: string) => {
      sendMessage({ type: 'unlock_node', nodeId });
    },
    [sendMessage]
  );

  const selectNodes = useCallback(
    (nodeIds: string[]) => {
      sendMessage({ type: 'select_nodes', nodeIds });
    },
    [sendMessage]
  );

  useEffect(() => {
    if (!connected) return;

    selectNodes(normalizedSelection);

    const previousLocks = new Set(lockedNodeIdsRef.current);
    const nextLocks = new Set(normalizedSelection);

    previousLocks.forEach((nodeId) => {
      if (!nextLocks.has(nodeId)) {
        unlockNode(nodeId);
      }
    });

    nextLocks.forEach((nodeId) => {
      if (!previousLocks.has(nodeId)) {
        lockNode(nodeId);
      }
    });

    lockedNodeIdsRef.current = normalizedSelection;
  }, [connected, lockNode, normalizedSelection, selectNodes, unlockNode]);

  useEffect(() => {
    return () => {
      lockedNodeIdsRef.current.forEach((nodeId) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'unlock_node', nodeId }));
        }
      });
    };
  }, []);

  return {
    connected,
    connectionState,
    users,
    sessionState,
    sendCursor,
    sendMessage,
    lockNode,
    unlockNode,
    selectNodes,
  };
}

export const CollaborationOverlay: React.FC<CollaborationOverlayProps> = ({
  ideaId,
  currentUserId,
  currentUserName,
  selectedNodeIds = [],
  onSessionStateChange,
  onRegisterSend,
}) => {
  const { t } = useTranslation();
  const { connected, connectionState, users, sessionState, sendCursor, sendMessage } =
    useCollaboration(ideaId, currentUserId, currentUserName, selectedNodeIds);

  useEffect(() => {
    if (connected && onRegisterSend) {
      onRegisterSend(sendMessage);
    }
  }, [connected, onRegisterSend, sendMessage]);
  const overlayRootRef = useRef<HTMLDivElement | null>(null);
  const [nodeRects, setNodeRects] = useState<Record<string, NodeOverlayRect>>({});
  const lastCursorSentAtRef = useRef(0);

  const otherUsers = useMemo(
    () =>
      users.filter((u) => u.id !== currentUserId && Date.now() - u.lastSeen < STALE_THRESHOLD_MS),
    [currentUserId, users]
  );

  const userColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => {
      map[u.id] = u.color;
    });
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

  const shouldShowStatusState =
    connectionState === 'connecting' ||
    connectionState === 'reconnecting' ||
    connectionState === 'degraded';
  const shouldRenderOverlay =
    shouldShowStatusState ||
    otherUsers.length > 0 ||
    lockedNodeEntries.length > 0 ||
    otherSelections.length > 0;

  useEffect(() => {
    onSessionStateChange?.(sessionState);
  }, [onSessionStateChange, sessionState]);

  const trackedNodeIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...lockedNodeEntries.map(([nodeId]) => nodeId),
          ...otherSelections.map(({ nodeId }) => nodeId),
        ])
      ),
    [lockedNodeEntries, otherSelections]
  );

  useEffect(() => {
    if (!connected) return;

    const syncCursorToWorkspace = (event: PointerEvent) => {
      const container = overlayRootRef.current?.parentElement;
      if (!container) return;

      const bounds = container.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastCursorSentAtRef.current < CURSOR_THROTTLE_MS) {
        return;
      }
      lastCursorSentAtRef.current = now;

      sendCursor(event.clientX - bounds.left, event.clientY - bounds.top, selectedNodeIds[0]);
    };

    window.addEventListener('pointermove', syncCursorToWorkspace, { passive: true });
    return () => {
      window.removeEventListener('pointermove', syncCursorToWorkspace);
    };
  }, [connected, selectedNodeIds, sendCursor]);

  useEffect(() => {
    const container = overlayRootRef.current?.parentElement;
    if (!container || trackedNodeIds.length === 0) {
      setNodeRects((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    let rafId = 0;
    const syncRects = () => {
      const containerRect = container.getBoundingClientRect();
      const next: Record<string, NodeOverlayRect> = {};

      trackedNodeIds.forEach((nodeId) => {
        const nodeEl = container.querySelector(
          `.react-flow__node[data-id="${escapeDomSelector(nodeId)}"]`
        ) as HTMLElement | null;
        if (!nodeEl) return;

        const rect = nodeEl.getBoundingClientRect();
        next[nodeId] = {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        };
      });

      setNodeRects((prev) => (areNodeRectsEqual(prev, next) ? prev : next));
    };

    const scheduleSync = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncRects);
    };

    scheduleSync();
    const intervalId = window.setInterval(scheduleSync, OVERLAY_SYNC_INTERVAL_MS);
    window.addEventListener('resize', scheduleSync);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
      window.removeEventListener('resize', scheduleSync);
    };
  }, [trackedNodeIds, sessionState?.lastActivity]);

  if (!shouldRenderOverlay) return null;

  return (
    <div ref={overlayRootRef} className="absolute inset-0 z-30 pointer-events-none">
      {shouldShowStatusState && (
        <div className="absolute top-3 right-3 z-overlay flex items-center gap-2 rounded-full border border-amber-700 bg-c-surface-raised px-3 py-1.5 text-[10px] font-semibold text-amber-900 shadow-lg backdrop-blur-sm dark:border-amber-300 dark:bg-c-surface dark:text-amber-200">
          <WifiOff size={12} />
          <div className="flex flex-col leading-tight">
            <span>
              {connectionState === 'connecting'
                ? t('collaboration.connecting', 'Connecting collaboration')
                : connectionState === 'reconnecting'
                  ? t('collaboration.reconnecting', 'Reconnecting collaboration')
                  : t('collaboration.connectionDegraded', 'Connection degraded')}
            </span>
            <span className="text-[9px] font-medium text-amber-900 dark:text-amber-200">
              {connectionState === 'connecting'
                ? t('collaboration.establishingSession', 'Establishing session')
                : t('collaboration.singleUserMode', 'Single-user mode')}
            </span>
          </div>
        </div>
      )}

      {/* Presence badge */}
      {connected && otherUsers.length > 0 && (
        <div className="absolute top-3 right-3 z-overlay flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm shadow-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle">
          <Users size={12} className="text-c-success" />
          <span className="text-[10px] font-bold text-c-text-secondary dark:text-c-text-muted">
            {otherUsers.length + 1}
          </span>
          <div className="flex -space-x-1.5">
            {otherUsers.slice(0, 4).map((u, idx) => (
              <div
                key={u.id}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-c-text border-2 border-c-border-subtle dark:border-c-border-subtle"
                style={{ backgroundColor: u.color || CURSOR_COLORS[idx % CURSOR_COLORS.length] }}
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
          className="absolute z-dropdown pointer-events-none"
          style={{
            left: (nodeRects[nodeId]?.left ?? 0) + (nodeRects[nodeId]?.width ?? 0) / 2,
            top: (nodeRects[nodeId]?.top ?? 0) - 14,
            transform: 'translateX(-50%)',
            opacity: nodeRects[nodeId] ? 1 : 0,
          }}
        >
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-c-text whitespace-nowrap"
            style={{ backgroundColor: userColorMap[uid] || 'var(--c-tag-8)' }}
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
            left: nodeRects[nodeId]?.left ?? 0,
            top: nodeRects[nodeId]?.top ?? 0,
            width: nodeRects[nodeId]?.width ?? 0,
            height: nodeRects[nodeId]?.height ?? 0,
            borderColor: userColorMap[uid] || 'var(--c-tag-8)',
            boxShadow: `0 0 0 2px ${userColorMap[uid] || 'var(--c-tag-8)'}`,
            opacity: nodeRects[nodeId] ? 1 : 0,
          }}
        />
      ))}

      {/* Remote cursors */}
      {otherUsers.map((u, idx) => (
        <div
          key={u.id}
          className="absolute pointer-events-none z-overlay transition-all duration-200"
          style={{ left: u.cursorX, top: u.cursorY }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
            <path
              d="M0 0L16 12L8 12L4 20L0 0Z"
              fill={u.color || CURSOR_COLORS[idx % CURSOR_COLORS.length]}
            />
          </svg>
          <div
            className="ml-4 -mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-c-text whitespace-nowrap"
            style={{ backgroundColor: u.color || CURSOR_COLORS[idx % CURSOR_COLORS.length] }}
          >
            {u.name}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CollaborationOverlay;
