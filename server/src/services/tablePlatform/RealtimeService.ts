/**
 * Table Platform Realtime Service
 * WebSocket layer for real-time collaboration: presence, cell cursors, live CRUD broadcasts.
 * Non-blocking — if WebSocket fails, CRUD operations still succeed.
 *
 * Security (#101 Grupa 0 — WS org-context):
 * - connections require a verified JWT (socketAuthMiddleware); the client-sent
 *   `auth.userId` is IGNORED — identity comes from the token.
 * - `join:table` is gated on the table's org (tp_tables → tp_bases) matching
 *   the user's ACTIVE org (demo-aware via resolveWsOrgContext, same contract
 *   as ideaCollabWs), so a demo session cannot subscribe/relay into real-org
 *   tables and vice versa.
 * - `cell:update` (the only client→peers write relay) requires prior room
 *   membership and a fresh org context; a demo↔real org switch mid-connection
 *   disconnects the stale socket. Rejections are logged + surfaced via
 *   `realtime:error`, never silently dropped.
 */

import type { Server as SocketIOServer } from 'socket.io';

import { getDatabase } from '../../database/Database.js';
import { socketAuthMiddleware } from '../../realtime/socketAuth.js';
import {
  isWsOrgContextFresh,
  resolveWsOrgContext,
  type WsOrgContext,
} from '../../realtime/wsOrgContext.js';
import logger from '../../utils/Logger.js';

export interface CellUpdate {
  tableId: string;
  recordId: string;
  fieldId: string;
  value: unknown;
  userId: string;
  timestamp: number;
}

export interface PresenceInfo {
  userId: string;
  userName: string;
  tableId: string;
  recordId?: string;
  fieldId?: string;
  color: string;
  lastSeen: number;
}

export class TablePlatformRealtimeService {
  private io: SocketIOServer | null = null;
  private presence = new Map<string, PresenceInfo>();
  private userColors = new Map<string, string>();

  private static COLORS = [
    '#3b82f6',
    '#ef4444',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#6366f1',
  ];

  init(io: SocketIOServer): void {
    this.io = io;

    const tpNamespace = io.of('/table-platform');

    // #101 Grupa 0: verified JWT required — anonymous / client-claimed
    // identities used to be accepted here.
    (tpNamespace as any).use(socketAuthMiddleware);

    tpNamespace.on('connection', (socket: any) => {
      // Identity from the VERIFIED token; auth.userName stays cosmetic.
      const userId = socket.data?.user?.id as string | undefined;
      const jwtOrgId = String(socket.data?.user?.organizationId || '');
      const userName = socket.handshake?.auth?.userName as string | undefined;

      if (!userId) {
        socket.disconnect();
        return;
      }

      if (!this.userColors.has(userId)) {
        const idx = this.userColors.size % TablePlatformRealtimeService.COLORS.length;
        this.userColors.set(userId, TablePlatformRealtimeService.COLORS[idx]);
      }

      // Per-user room (identity from the verified JWT) — lets server-side
      // producers (watch notifications, @mention delivery) push directly to
      // a specific user regardless of which table room(s) they've joined.
      // Joining is automatic on connect; no client-side change required.
      socket.join(`user:${userId}`);

      logger.info('[TablePlatformRealtime] User connected', { userId, socketId: socket.id });

      socket.on('join:table', async (rawTableId: unknown) => {
        const tableId = typeof rawTableId === 'string' ? rawTableId.trim() : '';
        if (!tableId) return;
        const ctx = await this.ensureFreshOrgContext(socket, userId, jwtOrgId);
        if (!ctx) return;
        const inOrg = await this.tableBelongsToOrg(tableId, ctx.organizationId);
        if (!inOrg) {
          logger.warn('[TablePlatformRealtime] join:table rejected — table not in active org', {
            userId,
            tableId,
            activeOrg: ctx.organizationId,
            demoMode: ctx.demoMode,
          });
          socket.emit('realtime:error', { code: 'TABLE_ORG_FORBIDDEN', tableId });
          return;
        }
        socket.join(`table:${tableId}`);
        this.updatePresence(userId, userName ?? 'Anonymous', tableId);
        this.broadcastPresence(tableId);
      });

      socket.on('leave:table', (tableId: string) => {
        socket.leave(`table:${tableId}`);
        this.removePresence(userId, tableId);
        this.broadcastPresence(tableId);
      });

      socket.on('focus:cell', (data: { tableId: string; recordId: string; fieldId: string }) => {
        if (!this.isInTableRoom(socket, data?.tableId)) {
          logger.warn('[TablePlatformRealtime] focus:cell rejected — not joined to table', {
            userId,
            tableId: data?.tableId,
          });
          socket.emit('realtime:error', { code: 'TABLE_NOT_JOINED', tableId: data?.tableId });
          return;
        }
        this.updatePresence(
          userId,
          userName ?? 'Anonymous',
          data.tableId,
          data.recordId,
          data.fieldId
        );
        socket
          .to(`table:${data.tableId}`)
          .emit('presence:update', this.getTablePresence(data.tableId));
      });

      socket.on('cell:update', async (data: CellUpdate) => {
        // Write relay: room membership (org-validated at join) + fresh org
        // context + write permission (demo shared org is read-only).
        if (!this.isInTableRoom(socket, data?.tableId)) {
          logger.warn('[TablePlatformRealtime] cell:update rejected — not joined to table', {
            userId,
            tableId: data?.tableId,
          });
          socket.emit('realtime:error', { code: 'TABLE_NOT_JOINED', tableId: data?.tableId });
          return;
        }
        const ctx = await this.ensureFreshOrgContext(socket, userId, jwtOrgId);
        if (!ctx) return;
        if (!ctx.writeAllowed) {
          logger.warn('[TablePlatformRealtime] cell:update rejected — read-only demo context', {
            userId,
            tableId: data?.tableId,
            org: ctx.organizationId,
          });
          socket.emit('realtime:error', { code: 'DEMO_READ_ONLY', tableId: data?.tableId });
          return;
        }
        socket.to(`table:${data.tableId}`).emit('cell:updated', {
          ...data,
          userId,
          timestamp: Date.now(),
        });
      });

      socket.on('disconnect', () => {
        for (const [key, info] of this.presence.entries()) {
          if (info.userId === userId) {
            const { tableId } = info;
            this.presence.delete(key);
            this.broadcastPresence(tableId);
          }
        }
        logger.info('[TablePlatformRealtime] User disconnected', { userId, socketId: socket.id });
      });
    });

    logger.info('[TablePlatformRealtime] Initialized on /table-platform namespace');
  }

  notifyRecordCreated(tableId: string, record: unknown): void {
    try {
      (this.io?.of('/table-platform') as any)
        ?.to(`table:${tableId}`)
        .emit('record:created', record);
    } catch (err) {
      logger.warn('[TablePlatformRealtime] notifyRecordCreated failed', {
        tableId,
        error: (err as Error).message,
      });
    }
  }

  notifyRecordUpdated(tableId: string, recordId: string, data: unknown): void {
    try {
      (this.io?.of('/table-platform') as any)
        ?.to(`table:${tableId}`)
        .emit('record:updated', { recordId, data });
    } catch (err) {
      logger.warn('[TablePlatformRealtime] notifyRecordUpdated failed', {
        tableId,
        recordId,
        error: (err as Error).message,
      });
    }
  }

  notifyRecordDeleted(tableId: string, recordId: string): void {
    try {
      (this.io?.of('/table-platform') as any)
        ?.to(`table:${tableId}`)
        .emit('record:deleted', { recordId });
    } catch (err) {
      logger.warn('[TablePlatformRealtime] notifyRecordDeleted failed', {
        tableId,
        recordId,
        error: (err as Error).message,
      });
    }
  }

  notifySchemaChanged(tableId: string, change: unknown): void {
    try {
      (this.io?.of('/table-platform') as any)
        ?.to(`table:${tableId}`)
        .emit('schema:changed', change);
    } catch (err) {
      logger.warn('[TablePlatformRealtime] notifySchemaChanged failed', {
        tableId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Push a notification (watch update/delete, @mention) directly to one
   * user's room, regardless of which table room(s) they currently have
   * joined. Fail-soft — a realtime-emit failure must never affect the
   * notification write it accompanies (callers already wrap this in
   * try/catch or fire-and-forget .catch()).
   */
  notifyUser(userId: string, notification: unknown): void {
    try {
      (this.io?.of('/table-platform') as any)
        ?.to(`user:${userId}`)
        .emit('notification:new', notification);
    } catch (err) {
      logger.warn('[TablePlatformRealtime] notifyUser failed', {
        userId,
        error: (err as Error).message,
      });
    }
  }

  /** Room-membership check for write/focus relays (join already org-gated). */
  private isInTableRoom(socket: any, tableId: unknown): boolean {
    const id = typeof tableId === 'string' ? tableId.trim() : '';
    if (!id) return false;
    try {
      return Boolean(socket?.rooms?.has?.(`table:${id}`));
    } catch {
      return false;
    }
  }

  /**
   * Resolve (with per-socket TTL cache) the user's ACTIVE org context — demo
   * aware. When the active org changes mid-connection (demo↔real switch) the
   * stale socket is disconnected so it cannot keep relaying into old-org
   * rooms. Fail-closed: resolver errors also disconnect. Returns null when the
   * caller must NOT proceed.
   */
  private async ensureFreshOrgContext(
    socket: any,
    userId: string,
    jwtOrgId: string
  ): Promise<WsOrgContext | null> {
    const cached = socket.data?.orgCtx as WsOrgContext | undefined;
    if (cached && isWsOrgContextFresh(cached)) return cached;
    try {
      const fresh = await resolveWsOrgContext(getDatabase(), userId, jwtOrgId);
      if (cached && fresh.organizationId !== cached.organizationId) {
        logger.warn(
          '[TablePlatformRealtime] Org context changed mid-connection — disconnecting stale socket',
          { userId, boundOrg: cached.organizationId, activeOrg: fresh.organizationId }
        );
        socket.emit('realtime:error', { code: 'ORG_CONTEXT_CHANGED' });
        socket.disconnect(true);
        return null;
      }
      if (socket.data) socket.data.orgCtx = fresh;
      return fresh;
    } catch (err) {
      logger.warn('[TablePlatformRealtime] Org-context resolution failed — fail-closed', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      socket.emit('realtime:error', { code: 'ORG_CONTEXT_UNAVAILABLE' });
      socket.disconnect(true);
      return null;
    }
  }

  /** Table → org lookup (tp_tables → tp_bases). Fail-closed on errors. */
  private async tableBelongsToOrg(tableId: string, organizationId: string): Promise<boolean> {
    if (!organizationId) return false;
    try {
      const row = await getDatabase().get<{ org_id?: unknown }>(
        `SELECT b.organization_id AS org_id
         FROM tp_tables t
         JOIN tp_bases b ON t.base_id = b.id
         WHERE t.id = ?`,
        [tableId]
      );
      return Boolean(row) && String((row as any)?.org_id || '') === organizationId;
    } catch (err) {
      logger.warn('[TablePlatformRealtime] table org lookup failed — fail-closed', {
        tableId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  private updatePresence(
    userId: string,
    userName: string,
    tableId: string,
    recordId?: string,
    fieldId?: string
  ): void {
    const key = `${userId}:${tableId}`;
    this.presence.set(key, {
      userId,
      userName,
      tableId,
      recordId,
      fieldId,
      color: this.userColors.get(userId) || '#6366f1',
      lastSeen: Date.now(),
    });
  }

  private removePresence(userId: string, tableId: string): void {
    this.presence.delete(`${userId}:${tableId}`);
  }

  private getTablePresence(tableId: string): PresenceInfo[] {
    const result: PresenceInfo[] = [];
    for (const [, info] of this.presence) {
      if (info.tableId === tableId) result.push(info);
    }
    return result;
  }

  private broadcastPresence(tableId: string): void {
    try {
      const ns = this.io?.of('/table-platform');
      if (ns)
        (ns as any).to(`table:${tableId}`).emit('presence:update', this.getTablePresence(tableId));
    } catch (err) {
      logger.warn('[TablePlatformRealtime] broadcastPresence failed', {
        tableId,
        error: (err as Error).message,
      });
    }
  }
}

export const tablePlatformRealtime = new TablePlatformRealtimeService();
