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

export function resolveChatProjectsSocketEndpoint(
  apiTarget = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_TARGET
): string {
  const target = String(apiTarget || '').trim().replace(/\/+$/, '');
  return target ? `${target}/chat-projects` : '/chat-projects';
}

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
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
      socket = io(resolveChatProjectsSocketEndpoint(), {
        auth: { token, userId: userId || '' },
        // This channel carries low-frequency invalidation events. Long-polling
        // avoids the browser-level "closed before established" error emitted
        // when a mobile route reload interrupts an in-flight WS upgrade.
        transports: ['polling'],
      });
      socket.on('connect', () => {
        if (!disposed) socket?.emit('join:org', organizationId);
      });
      socket.on('chat:projects:changed', () => {
        if (!disposed) cbRef.current();
      });
      const disconnectBeforePageTeardown = () => socket?.disconnect();
      window.addEventListener('pagehide', disconnectBeforePageTeardown);
      socket.on('disconnect', () => {
        window.removeEventListener('pagehide', disconnectBeforePageTeardown);
      });
    } catch {
      /* sockets unavailable — silent no-op */
    }
    return () => {
      disposed = true;
      try {
        // React cleanup normally runs before route changes; pagehide covers a
        // full reload so the active polling request closes before navigation.
        socket?.emit('leave:org', organizationId);
        socket?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [organizationId, userId]);
}

export default useChatProjectsRealtime;
