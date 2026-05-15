/**
 * Fire-and-forget promise wrapper that logs errors instead of silently swallowing them.
 *
 * Replaces the anti-pattern: somePromise.catch(() => {})
 * With:                       fireAndForget(somePromise, 'context')
 *
 * For database ROLLBACK or pool.end() cleanup, .catch(() => {}) remains acceptable.
 */

import logger from './Logger.js';

export function fireAndForget(promise: Promise<unknown>, context: string): void {
  promise.catch((err: unknown) => {
    logger.warn(`[FireAndForget] ${context}:`, err instanceof Error ? err.message : err);
  });
}
