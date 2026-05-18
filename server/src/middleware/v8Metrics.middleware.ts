import type { NextFunction, Response } from 'express';

import { recordV8Request } from '../utils/v8MetricsStore.js';
import type { AuthRequest } from './auth.middleware.js';

const METRICS_LISTENERS_ATTACHED = Symbol('v8.metrics.listeners.attached');
const METRICS_RECORDED = Symbol('v8.metrics.recorded');
const METRICS_START_WALL = Symbol('v8.metrics.start.wall');
const METRICS_START_WALL_AVAILABLE = Symbol('v8.metrics.start.wall.available');
const METRICS_START_MONO = Symbol('v8.metrics.start.mono');
const MAX_DURATION_MS = 86_400_000;

const safeNowWall = (): number => {
  try {
    const value = Date.now();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const safeNowMonotonic = (): number | undefined => {
  try {
    const value = performance.now();
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

const clampDuration = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  const rounded = Math.round(value);
  return rounded > MAX_DURATION_MS ? MAX_DURATION_MS : rounded;
};

const readStatusCode = (res: Response): number => {
  try {
    const code = Number((res as any).statusCode);
    return Number.isFinite(code) ? code : 200;
  } catch {
    return 200;
  }
};

const computeDurationMs = (res: Response): number => {
  if ((res as any)[METRICS_START_WALL_AVAILABLE] === false) {
    return 0;
  }
  const startWall = Number((res as any)[METRICS_START_WALL] ?? 0);
  const startMono = (res as any)[METRICS_START_MONO];
  const endMono = safeNowMonotonic();
  if (typeof startMono === 'number' && typeof endMono === 'number') {
    return clampDuration(endMono - startMono);
  }
  return clampDuration(safeNowWall() - startWall);
};

const schedule = (task: () => void): void => {
  try {
    queueMicrotask(task);
    return;
  } catch {
    // try next scheduler
  }
  try {
    setImmediate(task);
    return;
  } catch {
    // final scheduler below
  }
  process.nextTick(task);
};

export const v8MetricsMiddleware = (_req: AuthRequest, res: Response, next: NextFunction): void => {
  const safeNext = () => {
    if (typeof next === 'function') {
      next();
    }
  };

  if (!res || typeof res !== 'object') {
    safeNext();
    return;
  }

  if (typeof (res as any)[METRICS_START_WALL] !== 'number') {
    try {
      const wall = Date.now();
      (res as any)[METRICS_START_WALL] = Number.isFinite(wall) ? wall : 0;
      (res as any)[METRICS_START_WALL_AVAILABLE] = true;
    } catch {
      (res as any)[METRICS_START_WALL] = 0;
      (res as any)[METRICS_START_WALL_AVAILABLE] = false;
    }
  }
  if (typeof (res as any)[METRICS_START_MONO] !== 'number') {
    (res as any)[METRICS_START_MONO] = safeNowMonotonic();
  }

  const recordOnce = () => {
    if ((res as any)[METRICS_RECORDED]) return;
    (res as any)[METRICS_RECORDED] = true;
    try {
      const duration = computeDurationMs(res);
      const isError = readStatusCode(res) >= 400;
      recordV8Request(duration, isError);
    } catch {
      // Metrics must never break request lifecycle.
    }
  };

  const scheduleRecordOnce = () => {
    try {
      schedule(recordOnce);
    } catch {
      // no-op
    }
  };

  const registerListener = (event: 'finish' | 'close'): boolean => {
    const onceFn = (res as any).once;
    if (typeof onceFn === 'function') {
      try {
        onceFn.call(res, event, scheduleRecordOnce);
        return true;
      } catch {
        return false;
      }
    }
    const onFn = (res as any).on;
    if (typeof onFn === 'function') {
      try {
        onFn.call(res, event, scheduleRecordOnce);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  if (!(res as any)[METRICS_LISTENERS_ATTACHED]) {
    const finishRegistered = registerListener('finish');
    const closeRegistered = registerListener('close');
    if (finishRegistered || closeRegistered) {
      (res as any)[METRICS_LISTENERS_ATTACHED] = true;
    }
  }

  const alreadyDone =
    (res as any).finished === true ||
    (res as any).writableEnded === true ||
    (res as any).headersSent === true;
  if (alreadyDone) {
    scheduleRecordOnce();
  }

  safeNext();
};
