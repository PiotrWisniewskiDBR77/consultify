/**
 * Organization Context realtime gateway (M16 P1-3).
 *
 * Provides a tiny Socket.IO `/org-context` namespace so that when an admin
 * rebuilds the organization context snapshot, every other open client for the
 * same organization can refresh its OrgContextSummaryBanner without polling.
 *
 * The module exposes a singleton because the Socket.IO server instance lives in
 * `index.ts` and is not otherwise reachable from Express route handlers. The
 * route handler calls `emitOrgContextRebuilt(orgId, payload)`; if realtime was
 * never initialized (e.g. tests, serverless), the call is a safe no-op.
 *
 * Client contract:
 *   - connect to namespace `/org-context`
 *   - emit `join:org` with the organizationId to join room `org:<id>`
 *   - listen for `org:context:rebuilt` with `{ organizationId, rebuiltAt, counts }`
 */
import type { Server as SocketIOServer } from 'socket.io';

import logger from '../utils/Logger.js';

export interface OrgContextRebuiltPayload {
  organizationId: string;
  rebuiltAt: string | null;
  counts?: { items: number; claims: number; conflicts: number };
}

const NAMESPACE = '/org-context';

class OrgContextRealtime {
  private io: SocketIOServer | null = null;

  init(io: SocketIOServer): void {
    this.io = io;

    // The repo ships a minimal socket.io type shim (server/src/types/socket.io.d.ts)
    // that omits room helpers like Namespace.to(); cast to any to match the runtime
    // API, mirroring the existing tablePlatform RealtimeService.
    const ns = io.of(NAMESPACE);
    ns.on('connection', (socket: any) => {
      socket.on('join:org', (organizationId: unknown) => {
        const orgId = typeof organizationId === 'string' ? organizationId.trim() : '';
        if (!orgId) return;
        socket.join(`org:${orgId}`);
      });

      socket.on('leave:org', (organizationId: unknown) => {
        const orgId = typeof organizationId === 'string' ? organizationId.trim() : '';
        if (!orgId) return;
        socket.leave(`org:${orgId}`);
      });
    });

    logger.info('[OrgContextRealtime] Initialized on /org-context namespace');
  }

  emitRebuilt(payload: OrgContextRebuiltPayload): void {
    if (!this.io || !payload?.organizationId) return;
    try {
      (this.io.of(NAMESPACE) as any)
        .to(`org:${payload.organizationId}`)
        .emit('org:context:rebuilt', payload);
    } catch (err) {
      logger.warn('[OrgContextRealtime] Failed to emit org:context:rebuilt', err);
    }
  }
}

export const orgContextRealtime = new OrgContextRealtime();

/** Convenience wrapper for route handlers — safe no-op if realtime is uninitialized. */
export function emitOrgContextRebuilt(payload: OrgContextRebuiltPayload): void {
  orgContextRealtime.emitRebuilt(payload);
}

export default orgContextRealtime;
