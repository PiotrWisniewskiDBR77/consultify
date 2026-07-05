/**
 * useCollaboration — Yjs + WebSocket based real-time collaboration for Deck Builder.
 * Provides shared document state, presence/awareness, and live cursor tracking.
 *
 * Architecture: Yjs Doc -> WebSocket Provider -> Awareness Protocol
 * Each deck is a shared document identified by deckId.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface CollabUser {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  activeCardIndex?: number;
  cursor?: { x: number; y: number };
  isOnline: boolean;
  lastSeen: number;
}

interface CollaborationState {
  isConnected: boolean;
  connectedUsers: CollabUser[];
  localUser: CollabUser | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const PRESENCE_COLORS = [
  '#F43F5E',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#6366F1',
  '#EC4899',
  '#F59E0B',
  '#3B82F6',
  '#84CC16',
  '#A855F7',
  '#3B82F6',
  '#FB923C',
];

function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

export function useCollaboration(
  deckId: string | undefined,
  currentUser: { userId: string; name: string; avatarUrl?: string } | null,
  enabled = false
) {
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    connectedUsers: [],
    localUser: null,
    connectionStatus: 'disconnected',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const connect = useCallback(() => {
    if (!deckId || !currentUser || !enabled) return;

    // Fail-open to solo mode: the presence gateway requires a JWT (?token=). If
    // there's no token we simply never connect — the editor keeps working, the
    // hook just stays `disconnected`. Never block core editing on presence.
    const token = localStorage.getItem('token');
    if (!token) {
      setState((prev) => ({ ...prev, connectionStatus: 'disconnected' }));
      return;
    }

    setState((prev) => ({ ...prev, connectionStatus: 'connecting' }));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/presentations/${deckId}?token=${encodeURIComponent(
      token
    )}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const localUser: CollabUser = {
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

        ws.send(
          JSON.stringify({
            type: 'presence:join',
            user: localUser,
          })
        );

        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'presence:heartbeat', userId: currentUser.userId }));
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg, setState);
        } catch {
          /* ignore malformed messages */
        }
      };

      ws.onclose = () => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          connectionStatus: 'disconnected',
        }));
        clearInterval(heartbeatRef.current);
      };

      ws.onerror = () => {
        setState((prev) => ({ ...prev, connectionStatus: 'error' }));
      };
    } catch {
      setState((prev) => ({ ...prev, connectionStatus: 'error' }));
    }
  }, [deckId, currentUser, enabled]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      if (currentUser) {
        wsRef.current.send(
          JSON.stringify({
            type: 'presence:leave',
            userId: currentUser.userId,
          })
        );
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

  const updatePresence = useCallback(
    (updates: Partial<Pick<CollabUser, 'activeCardIndex' | 'cursor'>>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && currentUser) {
        wsRef.current.send(
          JSON.stringify({
            type: 'presence:update',
            userId: currentUser.userId,
            ...updates,
          })
        );
      }
    },
    [currentUser]
  );

  const broadcastChange = useCallback(
    (change: { type: string; payload: unknown }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'deck:change',
            userId: currentUser?.userId,
            change,
          })
        );
      }
    },
    [currentUser]
  );

  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    updatePresence,
    broadcastChange,
  };
}

function handleMessage(
  msg: { type: string; [key: string]: unknown },
  setState: React.Dispatch<React.SetStateAction<CollaborationState>>
) {
  switch (msg.type) {
    case 'presence:joined':
    case 'presence:update': {
      const user = msg.user as CollabUser;
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
      const users = msg.users as CollabUser[];
      setState((prev) => ({
        ...prev,
        connectedUsers: users.map((u) => ({ ...u, isOnline: true, lastSeen: Date.now() })),
      }));
      break;
    }
  }
}
