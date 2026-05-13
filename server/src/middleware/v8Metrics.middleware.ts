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
    // Fall through to sync fallback.
  }
  try {
    fn();
  } catch {
    // fail-open: telemetry must never break response flow
  }
};

export const v8MetricsMiddleware = (_req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!res || typeof res !== 'object') {
    safeNext(next);
    return;
  }
  const start = safeRead(() => Date.now(), Number.NaN);
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
          const end = safeRead(() => Date.now(), Number.NaN);
          let recordedDuration = 0;
          if (Number.isFinite(start) && Number.isFinite(end)) {
            const durationRaw = end - start;
            const duration =
              Number.isFinite(durationRaw) && durationRaw >= 0 ? durationRaw : 0;
            recordedDuration = Math.min(duration, V8_METRICS_MAX_RECORDED_LATENCY_MS);
          }
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
