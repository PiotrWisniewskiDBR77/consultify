/**
 * Table Platform Realtime Service
 * WebSocket layer for real-time collaboration: presence, cell cursors, live CRUD broadcasts.
 * Non-blocking — if WebSocket fails, CRUD operations still succeed.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';

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
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  ];

  init(io: SocketIOServer): void {
    this.io = io;

    const tpNamespace = io.of('/table-platform');

    tpNamespace.on('connection', (socket: Socket) => {
      const userId = (socket.handshake.auth as Record<string, unknown>)?.userId as string | undefined;
      const userName = (socket.handshake.auth as Record<string, unknown>)?.userName as string | undefined;

      if (!userId) {
        socket.disconnect();
        return;
      }

      if (!this.userColors.has(userId)) {
        const idx = this.userColors.size % TablePlatformRealtimeService.COLORS.length;
        this.userColors.set(userId, TablePlatformRealtimeService.COLORS[idx]);
      }

      logger.info('[TablePlatformRealtime] User connected', { userId, socketId: socket.id });

      socket.on('join:table', (tableId: string) => {
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
        this.updatePresence(userId, userName ?? 'Anonymous', data.tableId, data.recordId, data.fieldId);
        socket.to(`table:${data.tableId}`).emit('presence:update', this.getTablePresence(data.tableId));
      });

      socket.on('cell:update', (data: CellUpdate) => {
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
      this.io?.of('/table-platform').to(`table:${tableId}`).emit('record:created', record);
    } catch (err) {
      logger.warn('[TablePlatformRealtime] notifyRecordCreated failed', { tableId, error: (err as Error).message });
    }
  }

  notifyRecordUpdated(tableId: string, recordId: string, data: unknown): void {
    try {
      this.io?.of('/table-platform').to(`table:${tableId}`).emit('record:updated', { recordId, data });
    } catch (err) {
      logger.warn('[TablePlatformRealtime] notifyRecordUpdated failed', { tableId, recordId, error: (err as Error).message });
    }
  }

  notifyRecordDeleted(tableId: string, recordId: string): void {
    try {
      this.io?.of('/table-platform').to(`table:${tableId}`).emit('record:deleted', { recordId });
    } catch (err) {
      logger.warn('[TablePlatformRealtime] notifyRecordDeleted failed', { tableId, recordId, error: (err as Error).message });
    }
  }

  notifySchemaChanged(tableId: string, change: unknown): void {
    try {
      this.io?.of('/table-platform').to(`table:${tableId}`).emit('schema:changed', change);
    } catch (err) {
      logger.warn('[TablePlatformRealtime] notifySchemaChanged failed', { tableId, error: (err as Error).message });
    }
  }

  private updatePresence(userId: string, userName: string, tableId: string, recordId?: string, fieldId?: string): void {
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
      this.io?.of('/table-platform').to(`table:${tableId}`).emit('presence:update', this.getTablePresence(tableId));
    } catch (err) {
      logger.warn('[TablePlatformRealtime] broadcastPresence failed', { tableId, error: (err as Error).message });
    }
  }
}

export const tablePlatformRealtime = new TablePlatformRealtimeService();
