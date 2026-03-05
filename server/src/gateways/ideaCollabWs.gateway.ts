/**
 * Idea Collab — V4-IDEA-02 native WebSocket /ws/collab/:ideaId
 * Presence + cursors for CollaborationOverlay (native ws client).
 */

import type { Server as HttpServer } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';

import logger from '../utils/Logger.js';

interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
  activeNodeId?: string;
  lastSeen: number;
}

const ideaRooms = new Map<string, Map<WebSocket & { ideaId?: string }, CollabUser>>();
const COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899'];

function broadcastPresence(ideaId: string, exclude?: WebSocket & { ideaId?: string }) {
  const room = ideaRooms.get(ideaId);
  if (!room) return;
  const users = Array.from(room.values()).map((u) => ({
    id: u.id,
    name: u.name,
    color: u.color,
    cursorX: u.cursorX,
    cursorY: u.cursorY,
    activeNodeId: u.activeNodeId,
    lastSeen: u.lastSeen,
  }));
  room.forEach((_, ws) => {
    if (ws !== exclude && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'presence', users }));
    }
  });
}

export function attachIdeaCollabWs(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/ws\/collab\/([^/]+)$/);
    if (!match) return;

    const ideaId = match[1];
    if (!ideaId) return;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, ideaId);
    });
  });

  wss.on('connection', (ws: WebSocket & { ideaId?: string }, _req: unknown, ideaId: string) => {
    ws.ideaId = ideaId;
    if (!ideaRooms.has(ideaId)) ideaRooms.set(ideaId, new Map());
    const room = ideaRooms.get(ideaId)!;
    const color = COLORS[room.size % COLORS.length];
    const user: CollabUser = {
      id: 'pending',
      name: 'Anonymous',
      color,
      cursorX: 0,
      cursorY: 0,
      lastSeen: Date.now(),
    };
    room.set(ws, user);

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'join') {
          user.id = msg.userId || user.id;
          user.name = msg.userName || 'Anonymous';
        }
        if (msg.type === 'cursor') {
          user.cursorX = msg.x ?? 0;
          user.cursorY = msg.y ?? 0;
          user.activeNodeId = msg.activeNodeId;
          user.lastSeen = Date.now();
        }
        broadcastPresence(ideaId, ws);
      } catch {
        /* ignore */
      }
    });

    ws.on('close', () => {
      room.delete(ws);
      if (room.size === 0) ideaRooms.delete(ideaId);
      broadcastPresence(ideaId);
    });

    broadcastPresence(ideaId);
    logger.info(`[IdeaCollabWs] Client joined idea ${ideaId}`);
  });

  logger.info('[IdeaCollabWs] Native WebSocket /ws/collab/:ideaId attached');
}
