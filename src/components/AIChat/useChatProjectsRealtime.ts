/**
 * useChatProjectsRealtime (history F4b)
 *
 * Subscribes to the `/chat-projects` Socket.IO namespace and invokes `onChanged`
 * (debounced by the caller) whenever a teammate changes a shared folder in the
 * same organization — so the sidebar refreshes without polling. No-op when there
 * is no org context (personal-only user) or sockets are unavailable.
 */
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

export function useChatProjectsRealtime(
  organizationId: string | null | undefined,
  userId: string | null | undefined,
  onChanged: () => void
) {
  const cbRef = useRef(onChanged);
  cbRef.current = onChanged;

  useEffect(() => {
    if (!organizationId) return;
    let disposed = false;
    let socket: Socket | null = null;
    try {
      // Chat P0-1 — pass the JWT in the socket handshake so the namespace's
      // auth middleware can verify the connection. Without this the server
      // now rejects the connect entirely (security regression on purpose).
      const token =
        typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
      socket = io('/chat-projects', {
        auth: { token, userId: userId || '' },
        transports: ['websocket'],
      });
      socket.on('connect', () => {
        if (!disposed) socket?.emit('join:org', organizationId);
      });
      socket.on('chat:projects:changed', () => {
        if (!disposed) cbRef.current();
      });
    } catch {
      /* sockets unavailable — silent no-op */
    }
    return () => {
      disposed = true;
      try {
        socket?.emit('leave:org', organizationId);
        socket?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [organizationId, userId]);
}

export default useChatProjectsRealtime;
