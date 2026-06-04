/**
 * Chat projects realtime gateway (history F4b).
 *
 * A tiny Socket.IO `/chat-projects` namespace so that when a teammate changes a
 * shared (team) folder — creates/renames/moves it, edits membership, or adds a
 * conversation to it — every other open client in the same organization can
 * refresh its sidebar without polling.
 *
 * Mirrors orgContextRealtime: a singleton (the Socket.IO server lives in
 * index.ts and isn't reachable from Express handlers). Route handlers call
 * `emitChatProjectsChanged(orgId)`; if realtime was never initialized (tests,
 * serverless), the call is a safe no-op.
 *
 * Client contract:
 *   - connect to namespace `/chat-projects`
 *   - emit `join:org` with the organizationId to join room `org:<id>`
 *   - listen for `chat:projects:changed` with `{ organizationId, at }`
 */
import type { Server as SocketIOServer } from 'socket.io';

import logger from '../utils/Logger.js';

const NAMESPACE = '/chat-projects';

class ChatProjectsRealtime {
  private io: SocketIOServer | null = null;

  init(io: SocketIOServer): void {
    this.io = io;
    const ns = io.of(NAMESPACE);
    ns.on('connection', (socket: any) => {
      socket.on('join:org', (organizationId: unknown) => {
        const orgId = typeof organizationId === 'string' ? organizationId.trim() : '';
        if (orgId) socket.join(`org:${orgId}`);
      });
      socket.on('leave:org', (organizationId: unknown) => {
        const orgId = typeof organizationId === 'string' ? organizationId.trim() : '';
        if (orgId) socket.leave(`org:${orgId}`);
      });
    });
    logger.info('[ChatProjectsRealtime] Initialized on /chat-projects namespace');
  }

  emitChanged(organizationId: string): void {
    if (!this.io || !organizationId) return;
    try {
      (this.io.of(NAMESPACE) as any)
        .to(`org:${organizationId}`)
        .emit('chat:projects:changed', { organizationId, at: new Date().toISOString() });
    } catch (err) {
      logger.warn('[ChatProjectsRealtime] Failed to emit chat:projects:changed', err);
    }
  }
}

export const chatProjectsRealtime = new ChatProjectsRealtime();

/** Convenience wrapper for route handlers — safe no-op if realtime is uninitialized. */
export function emitChatProjectsChanged(organizationId?: string | null): void {
  if (organizationId) chatProjectsRealtime.emitChanged(organizationId);
}

export default chatProjectsRealtime;
