/**
 * Facilitation realtime gateway (T9-1).
 *
 * A tiny Socket.IO `/facilitation` namespace so that when a facilitator drives the
 * shared session — advancing the phase, starting/stopping the timer, or ending the
 * session — every other open participant refreshes without polling.
 *
 * Same singleton shape as orgContextRealtime: the Socket.IO server lives in
 * `index.ts` and is not reachable from Express route handlers / services, so those
 * call the module-level `emitFacilitation*` helpers. If realtime was never
 * initialized (tests, serverless, the acceptance harness) every emit is a safe
 * no-op — the service never depends on the WS layer being up.
 *
 * Client contract:
 *   - connect to namespace `/facilitation`
 *   - emit `join:session` with the facilitation sessionId to join room `facilitation:<id>`
 *   - listen for:
 *       'facilitation:phase'  { sessionId, phase, at }
 *       'facilitation:timer'  { sessionId, timerEndsAt, timerState, at }
 *       'facilitation:ended'  { sessionId, endedAt, summary, at }
 *
 * NOTE: to keep the service/route import graph free of the socket auth dependency
 * (which the acceptance harness pulls transitively), socketAuth is imported
 * DYNAMICALLY inside init() — which only ever runs from the full server boot.
 */
import type { Server as SocketIOServer } from 'socket.io';

import logger from '../utils/Logger.js';

const NAMESPACE = '/facilitation';
const room = (sessionId: string) => `facilitation:${sessionId}`;

export interface FacilitationPhasePayload {
  sessionId: string;
  phase: string;
  at: string;
}
export interface FacilitationTimerPayload {
  sessionId: string;
  timerEndsAt: number | null;
  timerState: Record<string, unknown>;
  at: string;
}
export interface FacilitationEndedPayload {
  sessionId: string;
  endedAt: string | null;
  summary: Record<string, unknown>;
  at: string;
}

class FacilitationRealtime {
  private io: SocketIOServer | null = null;

  async init(io: SocketIOServer): Promise<void> {
    this.io = io;
    // Dynamic import keeps socketAuth out of the service/route (harness) import graph.
    const { socketAuthMiddleware } = await import('./socketAuth.js');

    // The repo ships a minimal socket.io type shim that omits namespace helpers
    // (.use()/.to()); cast to any to reach the runtime API, mirroring
    // orgContextRealtime / tablePlatform.
    const ns = io.of(NAMESPACE) as any;
    ns.use(socketAuthMiddleware);
    ns.on('connection', (socket: any) => {
      socket.on('join:session', (sessionId: unknown) => {
        const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
        if (!sid) return;
        socket.join(room(sid));
      });
      socket.on('leave:session', (sessionId: unknown) => {
        const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
        if (!sid) return;
        socket.leave(room(sid));
      });
    });

    logger.info('[FacilitationRealtime] Initialized on /facilitation namespace');
  }

  private emit(event: string, sessionId: string, payload: unknown): void {
    if (!this.io || !sessionId) return;
    try {
      (this.io.of(NAMESPACE) as any).to(room(sessionId)).emit(event, payload);
    } catch (err) {
      logger.warn(`[FacilitationRealtime] Failed to emit ${event}`, err);
    }
  }

  emitPhase(payload: FacilitationPhasePayload): void {
    this.emit('facilitation:phase', payload.sessionId, payload);
  }
  emitTimer(payload: FacilitationTimerPayload): void {
    this.emit('facilitation:timer', payload.sessionId, payload);
  }
  emitEnded(payload: FacilitationEndedPayload): void {
    this.emit('facilitation:ended', payload.sessionId, payload);
  }
}

export const facilitationRealtime = new FacilitationRealtime();

/** Convenience wrappers — safe no-ops if realtime is uninitialized. */
export function emitFacilitationPhase(payload: FacilitationPhasePayload): void {
  facilitationRealtime.emitPhase(payload);
}
export function emitFacilitationTimer(payload: FacilitationTimerPayload): void {
  facilitationRealtime.emitTimer(payload);
}
export function emitFacilitationEnded(payload: FacilitationEndedPayload): void {
  facilitationRealtime.emitEnded(payload);
}

export default facilitationRealtime;
