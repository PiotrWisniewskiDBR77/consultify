/**
 * Request Store
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Middleware to initialize request context with a Correlation ID
 * Uses AsyncLocalStorage for request-scoped context
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// ==========================================
// TYPES
// ==========================================

interface RequestStore {
  correlationId: string;
  startTime: number;
}

// ==========================================
// STORAGE
// ==========================================

const storage = new AsyncLocalStorage<RequestStore>();
const CORRELATION_ID_SAFE_PATTERN = /[^a-zA-Z0-9._-]/g;
const CORRELATION_ID_MAX_LENGTH = 128;

function sanitizeCorrelationId(rawCorrelationId: unknown): string | null {
  if (typeof rawCorrelationId !== 'string') {
    return null;
  }

  const trimmed = rawCorrelationId.trim();
  if (!trimmed) {
    return null;
  }

  const safe = trimmed.replace(CORRELATION_ID_SAFE_PATTERN, '').slice(0, CORRELATION_ID_MAX_LENGTH);
  return safe || null;
}

// ==========================================
// MIDDLEWARE & UTILITIES
// ==========================================

/**
 * Middleware to initialize request context with a Correlation ID
 */
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Read existing correlation ID from frontend or generate a new one
  const correlationId = sanitizeCorrelationId(req.get('X-Correlation-ID')) || uuidv4();

  // Store it in AsyncLocalStorage
  storage.run({ correlationId, startTime: Date.now() }, () => {
    // Also attach to request and response for convenience
    (req as Request & { correlationId?: string }).correlationId = correlationId;
    res.set('X-Correlation-ID', correlationId);
    next();
  });
};

/**
 * Get correlation ID from current request context
 */
export const getCorrelationId = (): string | null => {
  const store = storage.getStore();
  return store ? store.correlationId : null;
};

/**
 * Get full request store
 */
export const getStore = (): RequestStore | undefined => {
  return storage.getStore();
};

/**
 * Get request start time
 */
export const getStartTime = (): number | null => {
  const store = storage.getStore();
  return store ? store.startTime : null;
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

const requestStore = {
  correlationMiddleware,
  getCorrelationId,
  getStore,
  getStartTime,
};

export default requestStore;
