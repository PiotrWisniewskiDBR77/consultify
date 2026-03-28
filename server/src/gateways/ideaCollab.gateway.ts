/**
 * Idea Collab Gateway — V4-IDEA-02 (stub)
 * WebSocket /ws/collab/:ideaId for presence and cursors.
 * Uses Socket.IO collab namespace; frontend CollaborationOverlay expects native ws.
 * TODO: Add ws package for native WebSocket or migrate frontend to socket.io-client.
 */

import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import logger from '../utils/Logger.js';

const ideaRooms = new Map<
  string,
  Map<
    string,
    { userId: string; userName: string; cursor?: { x: number; y: number; activeNodeId?: string } }
  >
>();

export function initializeIdeaCollabGateway(io: SocketIOServer): void {
  const collabNs = io.of('/collab');

  collabNs.on('connection', (socket: any) => {
    const ideaId = socket.handshake?.query?.ideaId as string;
    const userId = socket.handshake?.query?.userId as string;
    const userName = (socket.handshake?.query?.userName as string) || 'Anonymous';

    if (!ideaId) {
      socket.disconnect(true);
      return;
    }

    const room = `idea:${ideaId}`;
    socket.join(room);

    if (!ideaRooms.has(ideaId)) {
      ideaRooms.set(ideaId, new Map());
    }
    const participants = ideaRooms.get(ideaId)!;
    participants.set(socket.id, { userId: userId || socket.id, userName, cursor: undefined });

    (collabNs as any).to(room).emit('presence', {
      users: Array.from(participants.values()).map((p) => ({
        id: p.userId,
        name: p.userName,
        cursorX: p.cursor?.x ?? 0,
        cursorY: p.cursor?.y ?? 0,
        activeNodeId: p.cursor?.activeNodeId,
      })),
    });

    socket.on(
      'cursor',
      (payload: { userId: string; x: number; y: number; activeNodeId?: string }) => {
        const p = participants.get(socket.id);
        if (p) {
          p.cursor = { x: payload.x, y: payload.y, activeNodeId: payload.activeNodeId };
        }
        socket.to(room).emit('presence', {
          users: Array.from(participants.values()).map((p) => ({
            id: p.userId,
            name: p.userName,
            cursorX: p.cursor?.x ?? 0,
            cursorY: p.cursor?.y ?? 0,
            activeNodeId: p.cursor?.activeNodeId,
          })),
        });
      }
    );

    socket.on('disconnect', () => {
      participants.delete(socket.id);
      if (participants.size === 0) ideaRooms.delete(ideaId);
      (collabNs as any).to(room).emit('presence', {
        users: Array.from(participants.values()).map((p) => ({
          id: p.userId,
          name: p.userName,
          cursorX: p.cursor?.x ?? 0,
          cursorY: p.cursor?.y ?? 0,
          activeNodeId: p.cursor?.activeNodeId,
        })),
      });
    });

    logger.info(`[IdeaCollab] ${userName} joined idea ${ideaId}`);
  });

  logger.info('[IdeaCollab] Gateway initialized on /collab namespace');
}

export function attachIdeaCollabToServer(server: HttpServer): SocketIOServer | null {
  try {
    const io = new SocketIOServer(server, { path: '/ws', addTrailingSlash: false });
    initializeIdeaCollabGateway(io);
    return io;
  } catch (err: any) {
    logger.warn('[IdeaCollab] Failed to init:', err?.message);
    return null;
  }
}
