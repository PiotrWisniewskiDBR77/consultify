import type { NextFunction, Response } from 'express';

import { recordV8Request } from '../utils/v8MetricsStore.js';
import type { AuthRequest } from './auth.middleware.js';

const v8MetricsFinishHooked = new WeakSet<Response>();
const V8_METRICS_MAX_RECORDED_LATENCY_MS = 86_400_000;

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};
const normalizeStatusCode = (rawStatus: unknown): number => {
  const parsed = typeof rawStatus === 'number' ? rawStatus : Number(rawStatus);
  if (!Number.isFinite(parsed)) return 200;
  const integerStatus = Math.trunc(parsed);
  if (integerStatus < 100 || integerStatus > 599) return 200;
  return integerStatus;
};
const safeNext = (next: NextFunction): void => {
  if (typeof next !== 'function') return;
  try {
    next();
  } catch {
    // fail-open: telemetry middleware should never crash request flow
  }
};
const scheduleObservation = (fn: () => void): void => {
  if (typeof queueMicrotask === 'function') {
    try {
      queueMicrotask(fn);
      return;
    } catch {
      // Fall through to setImmediate/sync fallback.
    }
  }
  try {
    if (typeof setImmediate === 'function') {
      setImmediate(fn);
      return;
    }
  } catch {
    // Fall through to nextTick/sync fallback.
  }
  try {
    if (
      typeof process !== 'undefined' &&
      process !== null &&
      typeof process.nextTick === 'function'
    ) {
      process.nextTick(fn);
      return;
    }
  } catch {
    // Fall through to sync fallback.
  }
  try {
    fn();
  } catch {
    // fail-open: telemetry must never break response flow
  }
};
const readMonotonicNow = (): number | null => {
  const value = safeRead(
    () =>
      typeof performance !== 'undefined' &&
      performance !== null &&
      typeof performance.now === 'function'
        ? performance.now()
        : null,
    null as number | null
  );
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};
const readRecordedDuration = (
  startWall: number,
  endWall: number,
  startMono: number | null,
  endMono: number | null
): number => {
  let durationRaw: number | null = null;
  if (typeof startMono === 'number' && typeof endMono === 'number') {
    durationRaw = endMono - startMono;
  } else if (Number.isFinite(startWall) && Number.isFinite(endWall)) {
    durationRaw = endWall - startWall;
  }
  if (durationRaw == null || !Number.isFinite(durationRaw) || durationRaw < 0) return 0;
  return Math.min(durationRaw, V8_METRICS_MAX_RECORDED_LATENCY_MS);
};

export const v8MetricsMiddleware = (_req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!res || typeof res !== 'object') {
    safeNext(next);
    return;
  }
  const startWall = safeRead(() => Date.now(), Number.NaN);
  const startMono = readMonotonicNow();
  let finishRecorded = false;
  try {
    const responseWithEvents = res as Response & {
      on?: (event: string, listener: () => void) => unknown;
      once?: (event: string, listener: () => void) => unknown;
    };
    const hasOn = typeof responseWithEvents.on === 'function';
    const hasOnce = typeof responseWithEvents.once === 'function';
    if (hasOn || hasOnce) {
      if (v8MetricsFinishHooked.has(res)) {
        safeNext(next);
        return;
      }
      const registerFinish =
        hasOnce && typeof responseWithEvents.once === 'function'
          ? responseWithEvents.once.bind(res)
          : hasOn && typeof responseWithEvents.on === 'function'
            ? responseWithEvents.on.bind(res)
            : undefined;
      const registerClose =
        hasOnce && typeof responseWithEvents.once === 'function'
          ? responseWithEvents.once.bind(res)
          : hasOn && typeof responseWithEvents.on === 'function'
            ? responseWithEvents.on.bind(res)
            : undefined;
      if (!registerFinish) {
        safeNext(next);
        return;
      }
      const onDone = () => {
        if (finishRecorded) return;
        finishRecorded = true;
        try {
          const endWall = safeRead(() => Date.now(), Number.NaN);
          const endMono = readMonotonicNow();
          const recordedDuration = readRecordedDuration(startWall, endWall, startMono, endMono);
          const statusCode = normalizeStatusCode(safeRead(() => res.statusCode, 200));
          const isError = statusCode >= 400;
          scheduleObservation(() => {
            try {
              recordV8Request(recordedDuration, isError);
            } catch {
              // fail-open: telemetry must never break response flow
            }
          });
        } catch {
          // fail-open: telemetry must never break response flow
        }
      };
      try {
        registerFinish('finish', onDone);
        v8MetricsFinishHooked.add(res);
      } catch {
        // fail-open: finish hook registration must not block request flow
      }
      try {
        registerClose?.('close', onDone);
        v8MetricsFinishHooked.add(res);
      } catch {
        // fail-open: close hook registration must not block request flow
      }
    }
  } catch {
    // fail-open: telemetry hook registration must never block request flow
  }
  safeNext(next);
};
