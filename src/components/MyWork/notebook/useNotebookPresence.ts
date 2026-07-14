/**
 * useNotebookPresence — #23 real-time presence for a notebook page.
 *
 * A faithful reuse of the Deck Builder's useCollaboration pattern: the SAME
 * native WebSocket presence protocol (presence:join / heartbeat / leave /
 * joined / update / left / list), bound to a note via /ws/notebook/:noteId.
 * Backed by server/src/gateways/notebookCollabWs.gateway.ts.
 *
 * Fail-open to solo mode by construction: no token, gateway down, or flag off →
 * the hook stays `disconnected` and reports zero peers. It NEVER blocks editing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface NotebookPresenceUser {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: number;
}

export type NotebookPresenceStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface NotebookPresenceState {
  isConnected: boolean;
  connectedUsers: NotebookPresenceUser[];
  localUser: NotebookPresenceUser | null;
  connectionStatus: NotebookPresenceStatus;
}

// Palette parity with the notebook UI tag tokens (c-tag-*), resolved to concrete
// hex so avatars keep contrast against ring-c-surface. Deterministic per user.
const PRESENCE_COLORS = [
  '#3b8ea5',
  '#ae6429',
  '#10b981',
  '#3b82f6',
  '#6366f1',
  '#ec4899',
  '#84cc16',
  '#a855f7',
];

function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

export function useNotebookPresence(
  noteId: string | null | undefined,
  currentUser: { userId: string; name: string; avatarUrl?: string } | null,
  enabled = true
) {
  const [state, setState] = useState<NotebookPresenceState>({
    isConnected: false,
    connectedUsers: [],
    localUser: null,
    connectionStatus: 'disconnected',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const connect = useCallback(() => {
    if (!noteId || !currentUser || !enabled) return;

    // Fail-open to solo mode: the presence gateway requires a JWT (?token=). If
    // there's no token we simply never connect — the notebook keeps working, the
    // hook just stays `disconnected`. Never block core editing on presence.
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setState((prev) => ({ ...prev, connectionStatus: 'disconnected' }));
      return;
    }

    setState((prev) => ({ ...prev, connectionStatus: 'connecting' }));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/notebook/${encodeURIComponent(
      noteId
    )}?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const localUser: NotebookPresenceUser = {
        userId: currentUser.userId,
        name: currentUser.name,
        color: getColorForUser(currentUser.userId),
        avatarUrl: currentUser.avatarUrl,
        isOnline: true,
        lastSeen: Date.now(),
      };

      ws.onopen = () => {
        setState((prev) => ({
          ...prev,
          isConnected: true,
          localUser,
          connectionStatus: 'connected',
        }));

        ws.send(JSON.stringify({ type: 'presence:join', user: localUser }));

        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'presence:heartbeat', userId: currentUser.userId }));
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data), setState);
        } catch {
          /* ignore malformed messages */
        }
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, isConnected: false, connectionStatus: 'disconnected' }));
        clearInterval(heartbeatRef.current);
      };

      ws.onerror = () => {
        setState((prev) => ({ ...prev, connectionStatus: 'error' }));
      };
    } catch {
      setState((prev) => ({ ...prev, connectionStatus: 'error' }));
    }
  }, [noteId, currentUser, enabled]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      if (currentUser && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'presence:leave', userId: currentUser.userId }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    clearInterval(heartbeatRef.current);
    setState({
      isConnected: false,
      connectedUsers: [],
      localUser: null,
      connectionStatus: 'disconnected',
    });
  }, [currentUser]);

  useEffect(() => {
    if (enabled) connect();
    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return { ...state, connect, disconnect };
}

function handleMessage(
  msg: { type: string; [key: string]: unknown },
  setState: React.Dispatch<React.SetStateAction<NotebookPresenceState>>
) {
  switch (msg.type) {
    case 'presence:joined':
    case 'presence:update': {
      const user = msg.user as NotebookPresenceUser;
      setState((prev) => ({
        ...prev,
        connectedUsers: [
          ...prev.connectedUsers.filter((u) => u.userId !== user.userId),
          { ...user, isOnline: true, lastSeen: Date.now() },
        ],
      }));
      break;
    }
    case 'presence:left': {
      const userId = msg.userId as string;
      setState((prev) => ({
        ...prev,
        connectedUsers: prev.connectedUsers.filter((u) => u.userId !== userId),
      }));
      break;
    }
    case 'presence:list': {
      const users = msg.users as NotebookPresenceUser[];
      setState((prev) => ({
        ...prev,
        connectedUsers: users.map((u) => ({ ...u, isOnline: true, lastSeen: Date.now() })),
      }));
      break;
    }
  }
}
