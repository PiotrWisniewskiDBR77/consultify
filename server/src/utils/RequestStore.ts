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
  /**
   * Pamięć podręczna ważna WYŁĄCZNIE w obrębie jednego żądania HTTP.
   * Powstaje razem ze store'em i ginie wraz z nim — nic nie przecieka
   * między żądaniami ani między użytkownikami, więc zero zmiany semantyki:
   * w obrębie jednego żądania te same argumenty i tak dawały ten sam wynik.
   */
  memo: Map<string, Promise<unknown>>;
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
  storage.run({ correlationId, startTime: Date.now(), memo: new Map() }, () => {
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

/**
 * Policz `fabryka()` RAZ na żądanie HTTP dla danego `klucz`.
 *
 * Poza żądaniem (skrypty CLI, konsumenci kolejek, testy jednostkowe) store nie
 * istnieje — wtedy wołamy `fabryka()` normalnie, BEZ pamiętania. Dzięki temu
 * zachowanie poza HTTP nie zmienia się ani o krok.
 *
 * Odrzucony `Promise` jest usuwany z pamięci, żeby błąd jednego wywołania nie
 * przykleił się do całego żądania i nie zamienił chwilowej awarii bazy w trwałe
 * „brak uprawnień” do końca żądania.
 */
export const memoizeInRequest = <T>(klucz: string, fabryka: () => Promise<T>): Promise<T> => {
  const store = storage.getStore();
  if (!store) return fabryka();
  const zapamietany = store.memo.get(klucz);
  if (zapamietany) return zapamietany as Promise<T>;
  const swiezy = fabryka();
  store.memo.set(klucz, swiezy as Promise<unknown>);
  void swiezy.catch(() => {
    if (store.memo.get(klucz) === (swiezy as Promise<unknown>)) store.memo.delete(klucz);
  });
  return swiezy;
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

const requestStore = {
  correlationMiddleware,
  getCorrelationId,
  getStore,
  getStartTime,
  memoizeInRequest,
};

export default requestStore;
